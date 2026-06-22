import { describe, it, expect } from "vitest";

describe("test configuration sanity check", () => {
  it("runs a test file and resolves assertions", () => {
    // setup
    const add = (a, b) => a + b;
    // action
    const result = add(2, 3);
    // assert
    expect(result).toBe(5);
  });
});
