import { describe, it, expect } from "vitest";

describe("test configuration sanity check", () => {
  it("should run a test file and resolve assertions", () => {
    // setup
    const add = (a, b) => a + b;
    // action
    const result = add(2, 3);
    // assert
    expect(result).toBe(5);
  });
});
