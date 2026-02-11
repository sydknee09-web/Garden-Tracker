import { describe, it, expect } from "vitest";
import { getCanonicalKey } from "./canonicalKey";

describe("getCanonicalKey", () => {
  it("lowercases and strips non-alphanumeric characters", () => {
    expect(getCanonicalKey("Tomato")).toBe("tomato");
    expect(getCanonicalKey("Benary's Giant")).toBe("benarysgiant");
  });

  it("normalizes different spellings to the same key", () => {
    expect(getCanonicalKey("benary-s-giant")).toBe("benarysgiant");
    expect(getCanonicalKey("Benarys Giant")).toBe("benarysgiant");
  });

  it("returns empty string for empty or missing input", () => {
    expect(getCanonicalKey("")).toBe("");
    expect(getCanonicalKey(null as unknown as string)).toBe("");
    expect(getCanonicalKey(undefined as unknown as string)).toBe("");
  });
});
