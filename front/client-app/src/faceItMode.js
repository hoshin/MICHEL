// FaceIt "mode" is an operator preference that hides the FaceIt configuration
// section unless the operator actually relies on a FaceIt feed. The choice is
// persisted per Configuration Center (localStorage) so a reload does not reset
// it, while still auto-enabling for setups that already carry a match id.

import { useCallback, useEffect, useState } from "react";

export const FACEIT_MODE_STORAGE_KEY = "michel.faceItMode";

export function hasFaceItMatchId(faceIt) {
  return typeof faceIt?.matchId === "string" && faceIt.matchId.length > 0;
}

// Returns the stored choice as a boolean, or null when the operator has never
// made an explicit choice (so callers can fall back to the auto-enable rule).
export function readFaceItModeFromStorage(storage) {
  const raw = storage?.getItem(FACEIT_MODE_STORAGE_KEY);
  if (raw === null || raw === undefined) return null;
  return raw === "true";
}

export function writeFaceItModeToStorage(storage, value) {
  storage?.setItem(FACEIT_MODE_STORAGE_KEY, value ? "true" : "false");
}

// Explicit stored choice always wins; otherwise auto-enable when the back-end
// already knows about a match so a pre-configured setup is not surprised by a
// hidden section.
export function resolveInitialFaceItMode(storage, faceIt) {
  const stored = readFaceItModeFromStorage(storage);
  if (stored !== null) return stored;
  return hasFaceItMatchId(faceIt);
}

// The back-end snapshot arrives asynchronously, after the initial render: the
// first paint sees DEFAULT_STATE (empty match id) and only a later WebSocket
// push carries a real match id. This decides whether that late arrival should
// flip the mode on. A stored explicit choice (on OR off) is always respected,
// so this never fights a deliberate operator toggle.
export function shouldAutoEnableOnSnapshot(storage, faceIt) {
  const stored = readFaceItModeFromStorage(storage);
  if (stored !== null) return false;
  return hasFaceItMatchId(faceIt);
}

function safeLocalStorage() {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    // Accessing localStorage can throw in locked-down/embedded contexts
    // (e.g. some Electron sandbox configurations); degrade to in-memory.
    return null;
  }
}

// React binding around the pure helpers above. The initial value is resolved
// once from storage + the current FaceIt snapshot, and every toggle is written
// straight back so the preference survives reloads.
export function useFaceItMode(faceIt, storage = safeLocalStorage()) {
  const [enabled, setEnabled] = useState(() =>
    resolveInitialFaceItMode(storage, faceIt),
  );

  const setFaceItMode = useCallback(
    (next) => {
      setEnabled(next);
      writeFaceItModeToStorage(storage, next);
    },
    [storage],
  );

  // Catch the case where the back-end snapshot (and thus the match id) only
  // lands after mount. We key the effect on the match id so it re-evaluates
  // whenever it changes, and we leave the stored preference untouched: this
  // is an in-session auto-reveal, not a persisted operator choice.
  const matchId = faceIt?.matchId;
  useEffect(() => {
    if (shouldAutoEnableOnSnapshot(storage, faceIt)) {
      setEnabled(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, storage]);

  return [enabled, setFaceItMode];
}
