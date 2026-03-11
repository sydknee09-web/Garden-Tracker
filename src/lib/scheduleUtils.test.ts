import { describe, it, expect } from "vitest";
import { getGuideHarvestDays, isGuideCropStartIndoors, getSowMonthsForGuide } from "./scheduleUtils";

describe("getGuideHarvestDays", () => {
  it("returns null for undefined input", () => {
    expect(getGuideHarvestDays(undefined)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getGuideHarvestDays("")).toBeNull();
  });

  it("returns null for whitespace-only string", () => {
    expect(getGuideHarvestDays("   ")).toBeNull();
  });

  it("parses a range and returns the average", () => {
    expect(getGuideHarvestDays("75-90 days")).toBe(83);
  });

  it("parses a range with em-dash", () => {
    expect(getGuideHarvestDays("60–80 days")).toBe(70);
  });

  it("parses a single number", () => {
    expect(getGuideHarvestDays("65 days")).toBe(65);
  });

  it("parses a bare number", () => {
    expect(getGuideHarvestDays("90")).toBe(90);
  });

  it("returns null when no digits found", () => {
    expect(getGuideHarvestDays("days")).toBeNull();
  });
});

describe("isGuideCropStartIndoors", () => {
  it("returns false for undefined", () => {
    expect(isGuideCropStartIndoors(undefined)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isGuideCropStartIndoors("")).toBe(false);
  });

  it("returns true when method contains 'indoor'", () => {
    expect(isGuideCropStartIndoors("Start indoors 6 weeks before transplant")).toBe(true);
  });

  it("returns true when method contains 'transplant'", () => {
    expect(isGuideCropStartIndoors("Direct sow or transplant")).toBe(true);
  });

  it("returns true when method contains 'tray'", () => {
    expect(isGuideCropStartIndoors("Sow in tray first")).toBe(true);
  });

  it("returns true when method contains 'seedling'", () => {
    expect(isGuideCropStartIndoors("Seedling method recommended")).toBe(true);
  });

  it("returns false for direct sow method", () => {
    expect(isGuideCropStartIndoors("Direct sow in garden")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isGuideCropStartIndoors("START INDOORS")).toBe(true);
  });
});

describe("getSowMonthsForGuide", () => {
  it("returns an object with 12 boolean sow_* keys for known plant", () => {
    const result = getSowMonthsForGuide("Fall/Spring");
    const keys = ["sow_jan","sow_feb","sow_mar","sow_apr","sow_may","sow_jun","sow_jul","sow_aug","sow_sep","sow_oct","sow_nov","sow_dec"];
    for (const k of keys) {
      expect(typeof (result as Record<string, unknown>)[k]).toBe("boolean");
    }
  });

  it("returns all false sow months for undefined planting window", () => {
    const result = getSowMonthsForGuide(undefined);
    const keys = ["sow_jan","sow_feb","sow_mar","sow_apr","sow_may","sow_jun","sow_jul","sow_aug","sow_sep","sow_oct","sow_nov","sow_dec"];
    for (const k of keys) {
      expect((result as Record<string, unknown>)[k]).toBe(false);
    }
  });
});
