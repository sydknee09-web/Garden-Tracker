import { describe, it, expect } from "vitest";
import {
  isSeedTypeTag,
  getSeedTypesFromTags,
  inferSeedTypesFromPlantName,
  getEffectiveSeedTypes,
  SEED_TYPE_TAGS,
} from "./seedTypes";

describe("seedTypes", () => {
  describe("isSeedTypeTag", () => {
    it("returns true for canonical seed types", () => {
      expect(isSeedTypeTag("Vegetable")).toBe(true);
      expect(isSeedTypeTag("Herb")).toBe(true);
      expect(isSeedTypeTag("Flower")).toBe(true);
      expect(isSeedTypeTag("Ground Cover")).toBe(true);
      expect(isSeedTypeTag("groundcover")).toBe(true);
    });
    it("returns false for non-seed-type tags", () => {
      expect(isSeedTypeTag("Heat Lover")).toBe(false);
      expect(isSeedTypeTag("F1")).toBe(false);
      expect(isSeedTypeTag("Tomato")).toBe(false);
    });
  });

  describe("getSeedTypesFromTags", () => {
    it("extracts seed type tags from mixed array", () => {
      expect(getSeedTypesFromTags(["Vegetable", "Heat Lover", "Herb"])).toEqual(["Vegetable", "Herb"]);
    });
    it("normalizes Groundcover to Ground Cover", () => {
      expect(getSeedTypesFromTags(["groundcover"])).toEqual(["Ground Cover"]);
    });
    it("returns empty for empty or null", () => {
      expect(getSeedTypesFromTags([])).toEqual([]);
      expect(getSeedTypesFromTags(null)).toEqual([]);
      expect(getSeedTypesFromTags(undefined)).toEqual([]);
    });
  });

  describe("inferSeedTypesFromPlantName", () => {
    it("infers Vegetable for Tomato", () => {
      expect(inferSeedTypesFromPlantName("Tomato")).toEqual(["Vegetable", "Edible"]);
    });
    it("infers Herb for Basil", () => {
      expect(inferSeedTypesFromPlantName("Basil")).toEqual(["Herb", "Edible"]);
    });
    it("infers Flower for Sunflower", () => {
      expect(inferSeedTypesFromPlantName("Sunflower")).toEqual(["Flower", "Edible Flower"]);
    });
    it("handles Sweet Pea as Flower", () => {
      expect(inferSeedTypesFromPlantName("Sweet Pea")).toEqual(["Flower"]);
    });
    it("returns empty for unknown plant", () => {
      expect(inferSeedTypesFromPlantName("Xyzzy")).toEqual([]);
    });
  });

  describe("getEffectiveSeedTypes", () => {
    it("uses tags when profile has seed-type tags", () => {
      expect(getEffectiveSeedTypes(["Vegetable", "Herb"], "Tomato")).toEqual(["Vegetable", "Herb"]);
    });
    it("infers from name when no seed-type tags", () => {
      expect(getEffectiveSeedTypes(["Heat Lover"], "Tomato")).toEqual(["Vegetable", "Edible"]);
    });
    it("infers when tags are empty", () => {
      expect(getEffectiveSeedTypes([], "Basil")).toEqual(["Herb", "Edible"]);
    });
  });
});
