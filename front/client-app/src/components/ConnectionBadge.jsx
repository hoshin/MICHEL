import { useEffect, useState } from "react";
import { useTeamsData } from "../teamsDataSocket.ts";

/**
 * Tiny diagnostic badge that pops a small label in a corner of the screen
 * when the WebSocket connection is not in `open` state for more than a
 * brief grace window. Default delay is 2 seconds so the badge is invisible
 * during normal startup but appears reliably if the back-end goes away.
 *
 * Drop this into any overlay during debugging:
 *
 * ```jsx
 * import ConnectionBadge from "./components/ConnectionBadge.jsx";
 * // inside the component's JSX:
 * <ConnectionBadge />
 * ```
 *
 * When everything is healthy the badge renders nothing. When the socket
 * stays in `connecting` or `closed` past the grace window it shows the
 * current status in the bottom-right corner so you can tell at a glance
 * whether an OBS source is "blank because the socket is dead" vs. "blank
 * because the page itself has a problem".
 */
function ConnectionBadge({ corner = "bottom-right", graceMs = 2000 }) {
  const { status } = useTeamsData();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (status === "open") {
      setShow(false);
      return;
    }
    const timer = setTimeout(() => setShow(true), graceMs);
    return () => clearTimeout(timer);
  }, [status, graceMs]);

  if (!show) return null;

  const positionStyles = {
    "bottom-right": { right: 12, bottom: 12 },
    "bottom-left": { left: 12, bottom: 12 },
    "top-right": { right: 12, top: 12 },
    "top-left": { left: 12, top: 12 },
  };

  const colorByStatus = {
    connecting: "#dba300",
    closed: "#c0382e",
    open: "#46a35e",
  };

  return (
    <div
      style={{
        position: "fixed",
        zIndex: 9999,
        padding: "4px 10px",
        borderRadius: 4,
        background: "rgba(0, 0, 0, 0.7)",
        color: colorByStatus[status] ?? "#ffffff",
        fontFamily:
          "ui-monospace, SFMono-Regular, 'Cascadia Code', Consolas, monospace",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.4,
        pointerEvents: "none",
        ...positionStyles[corner],
      }}
    >
      WS: {status}
    </div>
  );
}

export default ConnectionBadge;
