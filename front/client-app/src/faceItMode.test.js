import { describe, expect, it } from "vitest";
import {
  FACEIT_MODE_STORAGE_KEY,
  hasFaceItMatchId,
  readFaceItModeFromStorage,
  resolveInitialFaceItMode,
  shouldAutoEnableOnSnapshot,
  writeFaceItModeToStorage,
} from "./faceItMode.js";

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

describe("hasFaceItMatchId", () => {
  it("should return `true` when a non-empty match id is present", () => {
    // setup
    const faceIt = { matchId: "match-123" };
    // action
    const result = hasFaceItMatchId(faceIt);
    // assert
    expect(result).toBe(true);
  });

  it("should return `false` for an empty string, missing field, or missing object", () => {
    // setup / action / assert
    expect(hasFaceItMatchId({ matchId: "" })).toBe(false);
    expect(hasFaceItMatchId({})).toBe(false);
    expect(hasFaceItMatchId(undefined)).toBe(false);
  });
});

describe("readFaceItModeFromStorage", () => {
  it("should return `null` when no explicit choice was stored", () => {
    // setup
    const storage = fakeStorage();
    // action
    const result = readFaceItModeFromStorage(storage);
    // assert
    expect(result).toBeNull();
  });

  it("should return `true` if localStorage is set and its value is `'true'`", () => {
    // setup
    const storage = fakeStorage({ [FACEIT_MODE_STORAGE_KEY]: "true" });
    // action
    const result = readFaceItModeFromStorage(storage);
    // assert
    expect(result).toBe(true);
  });

  it("should return `false` if localStorage is set and its value is different from `'true'`", () => {
    // setup
    const storage = fakeStorage({ [FACEIT_MODE_STORAGE_KEY]: "foobar" });
    // action
    const result = readFaceItModeFromStorage(storage);
    // assert
    expect(result).toBe(false);
  });
});

describe("writeFaceItModeToStorage", () => {
  it("should persist the choice so it can be read back", () => {
    // setup
    const storage = fakeStorage();
    // action
    writeFaceItModeToStorage(storage, false);
    // assert
    expect(readFaceItModeFromStorage(storage)).toBe(false);
  });
});

describe("resolveInitialFaceItMode", () => {
  it("should auto-enable when there is no stored choice but a match id exists", () => {
    // setup
    const storage = fakeStorage();
    const faceIt = { matchId: "match-123" };
    // action
    const result = resolveInitialFaceItMode(storage, faceIt);
    // assert
    expect(result).toBe(true);
  });

  it("should stay off when there is no stored choice and no match id", () => {
    // setup
    const storage = fakeStorage();
    const faceIt = { matchId: "" };
    // action
    const result = resolveInitialFaceItMode(storage, faceIt);
    // assert
    expect(result).toBe(false);
  });

  it("should let an explicit stored choice override a present match id", () => {
    // setup
    const storage = fakeStorage({ [FACEIT_MODE_STORAGE_KEY]: "false" });
    const faceIt = { matchId: "match-123" };
    // action
    const result = resolveInitialFaceItMode(storage, faceIt);
    // assert
    expect(result).toBe(false);
  });

  it("should honor an explicit stored 'on' even without a match id", () => {
    // setup
    const storage = fakeStorage({ [FACEIT_MODE_STORAGE_KEY]: "true" });
    const faceIt = { matchId: "" };
    // action
    const result = resolveInitialFaceItMode(storage, faceIt);
    // assert
    expect(result).toBe(true);
  });
});

describe("shouldAutoEnableOnSnapshot", () => {
  it("should auto-enable when a match id arrives and no explicit choice was stored", () => {
    // setup
    const storage = fakeStorage();
    const faceIt = { matchId: "match-123" };
    // action
    const result = shouldAutoEnableOnSnapshot(storage, faceIt);
    // assert
    expect(result).toBe(true);
  });

  it("should not auto-enable when the operator already chose 'off'", () => {
    // setup
    const storage = fakeStorage({ [FACEIT_MODE_STORAGE_KEY]: "false" });
    const faceIt = { matchId: "match-123" };
    // action
    const result = shouldAutoEnableOnSnapshot(storage, faceIt);
    // assert
    expect(result).toBe(false);
  });

  it("should not auto-enable when there is no match id to begin with", () => {
    // setup
    const storage = fakeStorage();
    const faceIt = { matchId: "" };
    // action
    const result = shouldAutoEnableOnSnapshot(storage, faceIt);
    // assert
    expect(result).toBe(false);
  });
});
