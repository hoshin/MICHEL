import { describe, expect, it } from "vitest";
import {
  DARK_MODE_STORAGE_KEY,
  readDarkModeFromStorage,
  resolveInitialDarkMode,
  writeDarkModeToStorage,
} from "./darkMode.js";

function fakeStorage(initial = {}) {
  const store = { ...initial };
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
}

describe("readDarkModeFromStorage", () => {
  it("returns null when no choice was stored", () => {
    // setup
    const storage = fakeStorage();
    // action
    const result = readDarkModeFromStorage(storage);
    // assert
    expect(result).toBeNull();
  });

  it("reads back a previously written choice", () => {
    // setup
    const storage = fakeStorage({ [DARK_MODE_STORAGE_KEY]: "true" });
    // action
    const result = readDarkModeFromStorage(storage);
    // assert
    expect(result).toBe(true);
  });
});

describe("writeDarkModeToStorage", () => {
  it("persists the choice so it can be read back", () => {
    // setup
    const storage = fakeStorage();
    // action
    writeDarkModeToStorage(storage, true);
    // assert
    expect(readDarkModeFromStorage(storage)).toBe(true);
  });
});

describe("resolveInitialDarkMode", () => {
  it("defaults to light (false) when nothing was stored", () => {
    // setup
    const storage = fakeStorage();
    // action
    const result = resolveInitialDarkMode(storage);
    // assert
    expect(result).toBe(false);
  });

  it("honors a stored 'on' choice", () => {
    // setup
    const storage = fakeStorage({ [DARK_MODE_STORAGE_KEY]: "true" });
    // action
    const result = resolveInitialDarkMode(storage);
    // assert
    expect(result).toBe(true);
  });

  it("honors a stored 'off' choice", () => {
    // setup
    const storage = fakeStorage({ [DARK_MODE_STORAGE_KEY]: "false" });
    // action
    const result = resolveInitialDarkMode(storage);
    // assert
    expect(result).toBe(false);
  });
});
