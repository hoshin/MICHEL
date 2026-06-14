import { useCallback, useEffect, useState } from "react";
import { DEFAULT_STATE, WEBSOCKET_URL } from "./config.js";

/**
 * Connection status of the singleton back-end WebSocket.
 *
 * - `connecting`: socket is being opened (initial connect or post-disconnect
 *   reconnect attempt).
 * - `open`: socket is open and exchanging messages.
 * - `closed`: socket is currently closed and a reconnect attempt is scheduled
 *   (or already in flight). The manager never enters a permanently-closed
 *   state — callers can treat `closed` as "transient".
 */
export type SocketStatus = "connecting" | "open" | "closed";

type TeamsDataListener = (data: any) => void;
type StatusListener = (status: SocketStatus) => void;

const INITIAL_RECONNECT_DELAY_MS = 250;
const MAX_RECONNECT_DELAY_MS = 5000;

/**
 * Singleton WebSocket manager for the team-data stream.
 *
 * The front-end has many overlay components, each of which historically
 * opened its own WebSocket against the back-end. That created
 * (a) one socket per mounted overlay (wasteful) and (b) no recovery if
 * the socket closed mid-session — e.g. when the Electron Settings dialog
 * restarts the back-end fork. This class owns a single socket, transparently
 * reconnects with exponential backoff, re-sends the `{ init: 1 }` greeting
 * on every (re)connect, and buffers `send()` calls placed while the socket
 * is not currently open.
 *
 * It is exposed both directly (`teamsDataSocket`) and through the
 * {@link useTeamsData} React hook below, which is the recommended consumer
 * surface for components.
 */
class TeamsDataSocketManager {
  private socket: WebSocket | null = null;
  private status: SocketStatus = "connecting";
  private reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private sendQueue: string[] = [];
  private dataListeners = new Set<TeamsDataListener>();
  private statusListeners = new Set<StatusListener>();
  private latestData: any = DEFAULT_STATE;
  // True as soon as the back-end has pushed at least one snapshot during
  // this singleton's lifetime. Consumers (notably the catchup mechanism in
  // ConfigurationCenter) use this to tell apart "first ever open, nothing
  // to re-assert" from "we have a meaningful last-known state we can
  // re-assert after a reconnect".
  private hasReceivedSnapshot = false;
  // The last server snapshot observed BEFORE the most recent disconnect.
  // Captured on `close` because by the time the socket reopens, the back's
  // first broadcast will have already overwritten `latestData` with whatever
  // state the back currently holds (possibly a clean default after a fork
  // restart). Cleared once consumed by {@link consumeCatchupIntent}.
  private lastSnapshotBeforeClose: any | null = null;
  // Tells the socket's `close` event listener whether the close was the
  // result of an intentional {@link close} call (true) or an unexpected
  // network/back-end disconnect (false). Only the latter should trigger
  // automatic reconnect; the former is by definition a request to stop.
  private closedExplicitly = false;

  constructor() {
    this.connect();
  }

  /**
   * Subscribe to incoming team-data messages. The callback is invoked with
   * the latest cached value immediately (so a newly-mounted component does
   * not have to wait for the next server push to render with real data) and
   * for every subsequent message. Returns an unsubscribe function suitable
   * for use in a React `useEffect` cleanup.
   */
  subscribeData(listener: TeamsDataListener): () => void {
    this.dataListeners.add(listener);
    // Push the cached value to the new subscriber so it can render
    // immediately if we have already received at least one message.
    try {
      listener(this.latestData);
    } catch (err) {
      console.error("[teamsDataSocket] data listener threw on subscribe", err);
    }
    return () => {
      this.dataListeners.delete(listener);
    };
  }

  /**
   * Subscribe to connection status changes. The callback is invoked with
   * the current status immediately and for every subsequent transition.
   * Returns an unsubscribe function.
   */
  subscribeStatus(listener: StatusListener): () => void {
    this.statusListeners.add(listener);
    try {
      listener(this.status);
    } catch (err) {
      console.error("[teamsDataSocket] status listener threw on subscribe", err);
    }
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  /**
   * Send a payload to the back-end. If the socket is currently open the
   * payload is sent immediately; otherwise it is queued and flushed once
   * the socket reopens. The payload is serialised to JSON here so callers
   * pass plain objects.
   */
  send(payload: unknown): void {
    const serialized = JSON.stringify(payload);
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(serialized);
        return;
      } catch (err) {
        console.error("[teamsDataSocket] send failed, queueing for retry", err);
      }
    }
    this.sendQueue.push(serialized);
  }

  /**
   * Return — and immediately clear — the snapshot captured at the moment
   * of the last disconnect, or `null` if there is no such snapshot (first
   * ever open, or no server message had been received before disconnect).
   *
   * Intended to be called once by the {@link ConfigurationCenter} when it
   * detects a reconnect (status went `closed`/`connecting` -> `open`).
   * The "consume" semantics prevent a second consumer (e.g. another tab
   * mounting after the reconnect already happened) from re-asserting an
   * already-applied intent.
   */
  consumeCatchupIntent(): any | null {
    const snapshot = this.lastSnapshotBeforeClose;
    this.lastSnapshotBeforeClose = null;
    return snapshot;
  }

  private setStatus(next: SocketStatus): void {
    if (this.status === next) return;
    this.status = next;
    // A single log line per transition gives us a usable trail in the
    // browser console when an overlay misbehaves in an opaque environment
    // like an OBS browser source.
    console.log(`[teamsDataSocket] status -> ${next}`);
    for (const listener of this.statusListeners) {
      try {
        listener(next);
      } catch (err) {
        console.error("[teamsDataSocket] status listener threw", err);
      }
    }
  }

  /**
   * Permanently close the socket and stop any pending reconnects. The
   * singleton is not expected to be closed in normal app lifecycles
   * (overlay pages stay alive for the duration of the OBS scene); this
   * method exists for defensive cleanup paths and tests.
   */
  close(): void {
    // Mark BEFORE calling socket.close() so the listener (which may fire
    // synchronously in some browsers, and definitely will fire on the
    // next tick in others) sees the explicit-shutdown flag and skips the
    // automatic reconnect path. Without this gate, intentional shutdown
    // and unexpected disconnect were indistinguishable to the listener.
    this.closedExplicitly = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch (err) {
        console.error("[teamsDataSocket] close failed", err);
      }
      this.socket = null;
    }
    this.setStatus("closed");
  }

  private connect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    // Clear the explicit-shutdown flag whenever we deliberately start a
    // new connection. Today this matters only as a future-proofing
    // measure: nothing in the codebase calls connect() after close(), but
    // exposing a clean re-init path later would otherwise inherit the
    // stale flag and silently swallow the first unexpected disconnect.
    this.closedExplicitly = false;
    this.setStatus("connecting");
    let socket: WebSocket;
    try {
      socket = new WebSocket(WEBSOCKET_URL);
    } catch (err) {
      console.error("[teamsDataSocket] WebSocket construction threw", err);
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;

    socket.addEventListener("open", () => {
      // The reconnect delay is only reset once a fresh connection actually
      // opens, so a series of failed attempts genuinely backs off.
      this.reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
      this.setStatus("open");
      // Greet the back-end so it pushes us the current state.
      try {
        socket.send(JSON.stringify({ init: 1 }));
      } catch (err) {
        console.error("[teamsDataSocket] init send failed", err);
      }
      this.flushSendQueue();
    });

    socket.addEventListener("message", (event) => {
      let parsed: any;
      try {
        parsed = JSON.parse(event.data);
      } catch (err) {
        console.error(
          "[teamsDataSocket] could not parse message as JSON",
          err,
          event.data,
        );
        return;
      }
      this.latestData = parsed;
      this.hasReceivedSnapshot = true;
      for (const listener of this.dataListeners) {
        try {
          listener(parsed);
        } catch (err) {
          console.error("[teamsDataSocket] data listener threw", err);
        }
      }
    });

    socket.addEventListener("close", () => {
      const ownedByUs = this.socket === socket;
      if (ownedByUs) {
        this.socket = null;
      }
      // Snapshot the last good state so a reconnecting consumer can
      // re-assert the operator's intent via the back-end's `catchup`
      // command. We only do this when we have actually received a
      // server snapshot in this session — otherwise we'd be re-asserting
      // DEFAULT_STATE, which is never useful.
      if (this.hasReceivedSnapshot) {
        this.lastSnapshotBeforeClose = this.latestData;
      }
      this.setStatus("closed");
      // Only auto-reconnect for unexpected disconnects on the current
      // socket. Skip when this close was triggered by an explicit shutdown
      // (close() set the flag), or when the closing socket is a stale
      // handle we have already replaced (ownedByUs === false), which would
      // otherwise schedule a second reconnect on top of the in-flight one.
      if (!this.closedExplicitly && ownedByUs) {
        this.scheduleReconnect();
      }
    });

    socket.addEventListener("error", (event) => {
      // We don't react directly to `error` — `close` will fire right after
      // and that's where we handle reconnect. We just log so the developer
      // console makes it obvious something is wrong.
      console.warn("[teamsDataSocket] socket error", event);
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const delay = this.reconnectDelayMs;
    this.reconnectDelayMs = Math.min(
      this.reconnectDelayMs * 2,
      MAX_RECONNECT_DELAY_MS,
    );
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private flushSendQueue(): void {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    while (this.sendQueue.length > 0) {
      const serialized = this.sendQueue.shift()!;
      try {
        this.socket.send(serialized);
      } catch (err) {
        // Put it back at the head of the queue so we don't lose it. The
        // subsequent close handler will trigger a new reconnect.
        this.sendQueue.unshift(serialized);
        console.error("[teamsDataSocket] flush send failed", err);
        return;
      }
    }
  }
}

/**
 * Module-level singleton. Imported by {@link useTeamsData} and may also be
 * used directly when a non-React caller needs to send a one-off command.
 */
export const teamsDataSocket = new TeamsDataSocketManager();

/**
 * React hook giving the calling component:
 *
 * - `teamsData`: the latest snapshot pushed by the back-end (or
 *   `DEFAULT_STATE` until the first message arrives).
 * - `send`: a stable function that ships a payload to the back-end, queued
 *   if the socket happens to be in the middle of a reconnect cycle.
 * - `status`: the current connection status, useful for showing a
 *   reconnecting indicator if a consumer wants to.
 *
 * Subscribes on mount and unsubscribes on unmount, so it plays well with
 * React Strict Mode's double-invocation in dev.
 */
export function useTeamsData() {
  const [teamsData, setTeamsData] = useState<any>(DEFAULT_STATE);
  const [status, setStatus] = useState<SocketStatus>("connecting");

  useEffect(() => {
    const unsubscribeData = teamsDataSocket.subscribeData(setTeamsData);
    const unsubscribeStatus = teamsDataSocket.subscribeStatus(setStatus);
    return () => {
      unsubscribeData();
      unsubscribeStatus();
    };
  }, []);

  // Both helpers below delegate to the module-level singleton and capture
  // no per-render state, so an empty dependency list is correct: their
  // identity is stable for the entire lifetime of the component. This
  // matters because consumers (notably ConfigurationCenter) use these
  // functions in `useEffect` dependency arrays; without stable identity
  // those effects would re-run on every parent render, with the cleanup
  // wiping any in-flight timer or subscription set up by the previous run.
  const send = useCallback(
    (payload: unknown) => teamsDataSocket.send(payload),
    [],
  );
  /**
   * Pull (and clear) the snapshot captured at the moment of the last
   * disconnect. Used by the configuration center to assemble its
   * `catchup` payload on reconnect.
   */
  const consumeCatchupIntent = useCallback(
    () => teamsDataSocket.consumeCatchupIntent(),
    [],
  );

  return {
    teamsData,
    status,
    send,
    consumeCatchupIntent,
  };
}
