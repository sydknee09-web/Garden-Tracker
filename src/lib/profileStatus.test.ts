import { describe, it, expect } from "vitest";
import { PROFILE_STATUS_OPTIONS, getProfileStatusLabel } from "./profileStatus";

describe("PROFILE_STATUS_OPTIONS", () => {
  it("contains all expected status values", () => {
    const values = PROFILE_STATUS_OPTIONS.map((o) => o.value);
    expect(values).toContain("in_stock");
    expect(values).toContain("out_of_stock");
    expect(values).toContain("vault");
    expect(values).toContain("active");
    expect(values).toContain("low_inventory");
    expect(values).toContain("archived");
  });

  it("has Status as the first option so the dropdown renders near the top of the edit form", () => {
    // Regression guard: Status must stay first so the native <select> dropdown
    // has room to expand downward and is never clipped by the viewport edge.
    expect(PROFILE_STATUS_OPTIONS[0].value).toBe("in_stock");
  });

  it("has no duplicate values", () => {
    const values = PROFILE_STATUS_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("has a human-readable label for every option", () => {
    for (const opt of PROFILE_STATUS_OPTIONS) {
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });
});

describe("getProfileStatusLabel", () => {
  it("returns the correct label for known statuses", () => {
    expect(getProfileStatusLabel("in_stock")).toBe("In stock");
    expect(getProfileStatusLabel("out_of_stock")).toBe("Out of stock");
    expect(getProfileStatusLabel("vault")).toBe("In storage");
    expect(getProfileStatusLabel("active")).toBe("Active (in garden)");
    expect(getProfileStatusLabel("low_inventory")).toBe("Low inventory");
    expect(getProfileStatusLabel("archived")).toBe("Archived");
  });

  it("falls back to title-cased value for unknown statuses", () => {
    expect(getProfileStatusLabel("my_custom_status")).toBe("My Custom Status");
  });

  it("handles an empty string without crashing", () => {
    expect(() => getProfileStatusLabel("")).not.toThrow();
  });
});
