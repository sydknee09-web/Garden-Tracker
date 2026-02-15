import { describe, it, expect } from "vitest";
import { identityKeyFromVariety, isGenericTrapName } from "./identityKey";

describe("isGenericTrapName", () => {
  it("returns true for trap values that would merge unrelated items", () => {
    expect(isGenericTrapName("vegetables")).toBe(true);
    expect(isGenericTrapName("seeds")).toBe(true);
    expect(isGenericTrapName("cool season")).toBe(true);
    expect(isGenericTrapName("shop")).toBe(true);
  });

  it("is case-insensitive and trims", () => {
    expect(isGenericTrapName("  VEGETABLES  ")).toBe(true);
    expect(isGenericTrapName("Cool Season")).toBe(true);
  });

  it("returns false for real variety names", () => {
    expect(isGenericTrapName("Cherokee Purple")).toBe(false);
    expect(isGenericTrapName("Tomato")).toBe(false);
    expect(isGenericTrapName("")).toBe(false);
  });
});

describe("identityKeyFromVariety", () => {
  it("returns type_variety in canonical form (alphanumeric, lowercase)", () => {
    const key = identityKeyFromVariety("Tomato", "Cherokee Purple");
    expect(key).toBe("tomato_cherokeepurple");
  });

  it("strips variety suffixes before building key", () => {
    // "Cherokee Purple Heirloom" -> stripVarietySuffixes strips "Heirloom" -> "Cherokee Purple"
    const key = identityKeyFromVariety("Tomato", "Cherokee Purple Heirloom");
    expect(key).toBe("tomato_cherokeepurple");
  });

  it("returns empty string for generic trap variety", () => {
    expect(identityKeyFromVariety("Tomato", "vegetables")).toBe("");
    expect(identityKeyFromVariety("Tomato", "cool season")).toBe("");
    expect(identityKeyFromVariety("Tomato", "shop")).toBe("");
  });

  it("returns type-only key when variety strips to empty (e.g. 'seeds')", () => {
    // "seeds" is stripped by stripVarietySuffixes to "" so key is type only
    expect(identityKeyFromVariety("Tomato", "seeds")).toBe("tomato");
  });

  it("handles empty or missing type/variety", () => {
    expect(identityKeyFromVariety("", "Cherokee Purple")).toBe("cherokeepurple");
    expect(identityKeyFromVariety("Tomato", "")).toBe("tomato");
    expect(identityKeyFromVariety("", "")).toBe("");
    expect(identityKeyFromVariety("", "vegetables")).toBe("");
  });

  it("trims type and variety", () => {
    expect(identityKeyFromVariety("  Tomato  ", "  Cherokee Purple  ")).toBe(
      "tomato_cherokeepurple"
    );
  });

  it("produces consistent key for same logical variety across spellings", () => {
    const a = identityKeyFromVariety("Cucumber", "Dragon's Egg");
    const b = identityKeyFromVariety("Cucumber", "Dragons Egg");
    expect(a).toBe(b);
    // getCanonicalKey strips non-alphanumeric: "Dragon's Egg" -> "dragonsegg"
    expect(a).toBe("cucumber_dragonsegg");
  });
});
