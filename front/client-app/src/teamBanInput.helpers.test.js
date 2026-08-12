import { describe, it, expect } from "vitest";
import {
  kebabToCamel,
  humanizeKey,
  resolveSelectedValue,
} from "./teamBanInput.helpers.js";

describe("kebabToCamel", () => {
  it("camel-cases a single kebab segment", () => {
    // setup
    const slug = "jetpack-cat";
    // action
    const result = kebabToCamel(slug);
    // assert
    expect(result).toBe("jetpackCat");
  });

  it("camel-cases a kebab segment followed by a digit", () => {
    // setup
    const slug = "soldier-76";
    // action
    const result = kebabToCamel(slug);
    // assert
    expect(result).toBe("soldier76");
  });

  it("leaves a slug without separators untouched", () => {
    // setup
    const slug = "ana";
    // action
    const result = kebabToCamel(slug);
    // assert
    expect(result).toBe("ana");
  });
});

describe("humanizeKey", () => {
  it("splits camelCase and capitalizes each word", () => {
    // setup
    const key = "jetpackCat";
    // action
    const result = humanizeKey(key);
    // assert
    expect(result).toBe("Jetpack Cat");
  });

  it("inserts a space between letters and digits", () => {
    // setup
    const key = "soldier76";
    // action
    const result = humanizeKey(key);
    // assert
    expect(result).toBe("Soldier 76");
  });

  it("capitalizes a single lowercase word", () => {
    // setup
    const key = "ana";
    // action
    const result = humanizeKey(key);
    // assert
    expect(result).toBe("Ana");
  });
});

describe("resolveSelectedValue", () => {
  it("returns undefined when nothing is selected", () => {
    // setup
    const selected = undefined;
    // action
    const result = resolveSelectedValue(selected);
    // assert
    expect(result).toBeUndefined();
  });

  it("extracts and camel-cases the slug from a kebab-case ban path", () => {
    // setup
    const selected = "/assets/portraits/jetpack-cat.png";
    // action
    const result = resolveSelectedValue(selected);
    // assert
    expect(result).toBe("jetpackCat");
  });

  it("resolves a plain slug with a digit", () => {
    // setup
    const selected = "/assets/portraits/soldier-76.png";
    // action
    const result = resolveSelectedValue(selected);
    // assert
    expect(result).toBe("soldier76");
  });

  it("returns undefined when the path has no .png slug to match", () => {
    // setup
    const selected = "not-a-portrait-path";
    // action
    const result = resolveSelectedValue(selected);
    // assert
    expect(result).toBeUndefined();
  });
});
