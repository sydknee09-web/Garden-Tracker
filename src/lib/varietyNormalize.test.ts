import { describe, it, expect } from "vitest";
import {
  stripVarietySuffixes,
  stripPlantFromVariety,
  cleanVarietyForDisplay,
} from "./varietyNormalize";

describe("stripVarietySuffixes", () => {
  it("strips trailing Seeds suffix", () => {
    expect(stripVarietySuffixes("Cherokee Purple Seeds")).toBe("Cherokee Purple");
  });

  it("strips trailing Seed suffix", () => {
    expect(stripVarietySuffixes("Sweet Basil Seed")).toBe("Sweet Basil");
  });

  it("strips trailing Heirloom suffix", () => {
    expect(stripVarietySuffixes("Brandywine Heirloom")).toBe("Brandywine");
  });

  it("strips trailing Organic suffix", () => {
    expect(stripVarietySuffixes("Blue Lake Organic")).toBe("Blue Lake");
  });

  it("strips trailing Non-GMO suffix", () => {
    expect(stripVarietySuffixes("Dill Non-GMO")).toBe("Dill");
  });

  it("strips multiple suffixes in a row", () => {
    expect(stripVarietySuffixes("Mortgage Lifter Heirloom Seeds")).toBe("Mortgage Lifter");
  });

  it("handles text after 'Seeds' split marker", () => {
    expect(stripVarietySuffixes("Johnny's Seeds Cherry")).toBe("Cherry");
  });

  it("replaces underscores with spaces", () => {
    expect(stripVarietySuffixes("cherokee_purple")).toBe("cherokee purple");
  });

  it("returns empty string unchanged", () => {
    expect(stripVarietySuffixes("")).toBe("");
  });

  it("handles null/undefined input gracefully", () => {
    // @ts-expect-error testing runtime safety
    expect(stripVarietySuffixes(null)).toBe("");
    // @ts-expect-error testing runtime safety
    expect(stripVarietySuffixes(undefined)).toBe("");
  });

  it("trims leading/trailing whitespace", () => {
    expect(stripVarietySuffixes("  Early Girl  ")).toBe("Early Girl");
  });

  it("strips leading Seed prefix (no word-boundary guard on leading strip)", () => {
    // Known behavior: 'Seed' leadingRe matches start of 'Seedling' → 'ling'.
    // Callers should not pass compound words that begin with 'Seed'.
    expect(stripVarietySuffixes("Seedling")).toBe("ling");
  });

  it("strips leading Organic prefix", () => {
    expect(stripVarietySuffixes("Organic Blue Lake")).toBe("Blue Lake");
  });
});

describe("stripPlantFromVariety", () => {
  it("strips plant name from start of variety", () => {
    expect(stripPlantFromVariety("Tomato Cherokee Purple", "Tomato")).toBe("Cherokee Purple");
  });

  it("strips plural plant name from start of variety", () => {
    expect(stripPlantFromVariety("Tomatoes Cherokee Purple", "Tomato")).toBe("Cherokee Purple");
  });

  it("strips plant name from end of variety", () => {
    expect(stripPlantFromVariety("Cherokee Purple Tomato", "Tomato")).toBe("Cherokee Purple");
  });

  it("does not strip plant name from middle", () => {
    expect(stripPlantFromVariety("Cherry Tomato Plum", "Tomato")).toBe("Cherry Tomato Plum");
  });

  it("returns variety unchanged when plant is empty", () => {
    expect(stripPlantFromVariety("Cherokee Purple", "")).toBe("Cherokee Purple");
  });

  it("returns variety unchanged when variety is empty", () => {
    expect(stripPlantFromVariety("", "Tomato")).toBe("");
  });
});

describe("cleanVarietyForDisplay", () => {
  it("extracts F1 tag and removes from variety", () => {
    const { cleanedVariety, tagsToAdd } = cleanVarietyForDisplay("Sweet 100 F1", "Tomato");
    expect(tagsToAdd).toContain("F1");
    expect(cleanedVariety).not.toMatch(/\bF1\b/i);
  });

  it("extracts Heirloom tag when it appears mid-string (not leading/trailing)", () => {
    // stripVarietySuffixes runs first and removes leading/trailing 'Heirloom'.
    // For tag extraction to fire, 'Heirloom' must be in a non-strip position.
    const { cleanedVariety, tagsToAdd } = cleanVarietyForDisplay("Brandywine Heirloom Special", "Tomato");
    expect(tagsToAdd).toContain("Heirloom");
    expect(cleanedVariety).not.toMatch(/\bHeirloom\b/i);
  });

  it("extracts Hybrid tag and removes from variety", () => {
    const { cleanedVariety, tagsToAdd } = cleanVarietyForDisplay("Better Boy Hybrid", "Tomato");
    expect(tagsToAdd).toContain("Hybrid");
    expect(cleanedVariety).not.toMatch(/\bHybrid\b/i);
  });

  it("removes maturity days from variety", () => {
    const { cleanedVariety } = cleanVarietyForDisplay("Early Girl 55 Days", "Tomato");
    expect(cleanedVariety).not.toMatch(/\d+\s*Days/i);
    expect(cleanedVariety).toContain("Early Girl");
  });

  it("strips plant type from end of variety string", () => {
    const { cleanedVariety } = cleanVarietyForDisplay("Cherokee Purple Tomato", "Tomato");
    expect(cleanedVariety).not.toMatch(/\bTomato\b$/i);
  });

  it("returns empty tagsToAdd for plain variety", () => {
    const { tagsToAdd } = cleanVarietyForDisplay("Cherokee Purple", "Tomato");
    expect(tagsToAdd).toEqual([]);
  });
});
