import { describe, it, expect } from "vitest";
import {
  parseVarietyWithModifiers,
  normalizeForMatch,
  VARIETY_MODIFIERS,
} from "./varietyModifiers";

describe("parseVarietyWithModifiers", () => {
  it("returns empty core and no tags for empty, null, or undefined", () => {
    expect(parseVarietyWithModifiers("")).toEqual({ coreVariety: "", tags: [] });
    expect(parseVarietyWithModifiers(null)).toEqual({ coreVariety: "", tags: [] });
    expect(parseVarietyWithModifiers(undefined)).toEqual({ coreVariety: "", tags: [] });
    expect(parseVarietyWithModifiers("   ")).toEqual({ coreVariety: "", tags: [] });
  });

  it("strips modifiers and returns core variety plus extracted tags", () => {
    const r = parseVarietyWithModifiers("Bulls Blood F1 Organic");
    expect(r.coreVariety).toBe("Bulls Blood");
    expect(r.tags).toEqual(expect.arrayContaining(["F1", "Organic"]));
    expect(r.tags).toHaveLength(2);
  });

  it("returns full string as core when no modifiers present", () => {
    expect(parseVarietyWithModifiers("Cherokee Purple")).toEqual({
      coreVariety: "Cherokee Purple",
      tags: [],
    });
  });

  it("normalizes open-pollinated / open pollinated to single tag", () => {
    const r = parseVarietyWithModifiers("Sunflower Open Pollinated");
    expect(r.coreVariety).toBe("Sunflower");
    expect(r.tags).toContain("Open Pollinated");
  });

  it("handles multiple modifiers and trims spaces", () => {
    const r = parseVarietyWithModifiers("  Dragon's Egg  F1  Heirloom  ");
    expect(r.coreVariety).toBe("Dragon's Egg");
    expect(r.tags).toEqual(expect.arrayContaining(["F1", "Heirloom"]));
  });

  it("deduplicates same modifier (case-insensitive)", () => {
    const r = parseVarietyWithModifiers("Tomato F1 F1 organic");
    expect(r.coreVariety).toBe("Tomato");
    expect(r.tags).toHaveLength(2); // F1 once, Organic once
  });
});

describe("normalizeForMatch", () => {
  it("trims and lowercases", () => {
    expect(normalizeForMatch("  Tomato  ")).toBe("tomato");
    expect(normalizeForMatch("CHERRY")).toBe("cherry");
  });

  it("handles null and undefined", () => {
    expect(normalizeForMatch(null)).toBe("");
    expect(normalizeForMatch(undefined)).toBe("");
  });
});

describe("VARIETY_MODIFIERS", () => {
  it("includes expected modifiers used for matching", () => {
    expect(VARIETY_MODIFIERS).toContain("f1");
    expect(VARIETY_MODIFIERS).toContain("organic");
    expect(VARIETY_MODIFIERS).toContain("heirloom");
    expect(VARIETY_MODIFIERS).toContain("open pollinated");
  });
});
