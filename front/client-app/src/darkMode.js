// Dark mode is a purely cosmetic operator preference for the Configuration
// Center. It defaults to light and is persisted in localStorage so the choice
// is re-applied every time the Configuration Center is loaded.

import { useCallback, useState } from "react";

export const DARK_MODE_STORAGE_KEY = "michel.darkMode";

// Returns the stored choice as a boolean, or null when the operator has never
// made an explicit choice (so callers can fall back to the light default).
export function readDarkModeFromStorage(storage) {
  const raw = storage?.getItem(DARK_MODE_STORAGE_KEY);
  if (raw === null || raw === undefined) return null;
  return raw === "true";
}

export function writeDarkModeToStorage(storage, value) {
  storage?.setItem(DARK_MODE_STORAGE_KEY, value ? "true" : "false");
}

// A stored explicit choice wins; otherwise default to light (false).
export function resolveInitialDarkMode(storage) {
  const stored = readDarkModeFromStorage(storage);
  if (stored !== null) return stored;
  return false;
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
// once from storage, and every toggle is written straight back so the
// preference survives reloads.
export function useDarkMode(storage = safeLocalStorage()) {
  const [enabled, setEnabled] = useState(() => resolveInitialDarkMode(storage));

  const setDarkMode = useCallback(
    (next) => {
      setEnabled(next);
      writeDarkModeToStorage(storage, next);
    },
    [storage],
  );

  return [enabled, setDarkMode];
}
