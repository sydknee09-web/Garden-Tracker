import { describe, it, expect } from "vitest";
import {
  isCopyLocallyEdited,
  computeCascadeNextDueDate,
  type CascadeTemplateValues,
} from "./generateCareTasks";

function baseTemplate(overrides: Partial<CascadeTemplateValues> = {}): CascadeTemplateValues {
  return {
    title: "Water weekly",
    category: "water",
    recurrence_type: "interval",
    interval_days: 7,
    months: null,
    day_of_month: null,
    custom_dates: null,
    notes: null,
    supply_profile_id: null,
    end_date: null,
    ...overrides,
  };
}

describe("isCopyLocallyEdited", () => {
  it("returns false when copy matches template exactly", () => {
    const t = baseTemplate();
    expect(isCopyLocallyEdited(t, t)).toBe(false);
  });

  it("detects title change", () => {
    expect(isCopyLocallyEdited(baseTemplate({ title: "Water deeply" }), baseTemplate())).toBe(true);
  });

  it("detects interval_days change", () => {
    expect(isCopyLocallyEdited(baseTemplate({ interval_days: 14 }), baseTemplate())).toBe(true);
  });

  it("detects notes change including null/empty divergence", () => {
    expect(isCopyLocallyEdited(baseTemplate({ notes: "extra" }), baseTemplate({ notes: null }))).toBe(true);
    expect(isCopyLocallyEdited(baseTemplate({ notes: null }), baseTemplate({ notes: "extra" }))).toBe(true);
    expect(isCopyLocallyEdited(baseTemplate({ notes: "same" }), baseTemplate({ notes: "same" }))).toBe(false);
  });

  it("detects months array change in yearly recurrence", () => {
    const tpl = baseTemplate({ recurrence_type: "yearly", interval_days: null, months: [3, 6, 9], day_of_month: 1 });
    const copy = baseTemplate({ recurrence_type: "yearly", interval_days: null, months: [3, 6, 12], day_of_month: 1 });
    expect(isCopyLocallyEdited(copy, tpl)).toBe(true);
  });

  it("treats identical months arrays (same order) as unchanged", () => {
    const tpl = baseTemplate({ recurrence_type: "yearly", interval_days: null, months: [3, 6, 9], day_of_month: 1 });
    const copy = baseTemplate({ recurrence_type: "yearly", interval_days: null, months: [3, 6, 9], day_of_month: 1 });
    expect(isCopyLocallyEdited(copy, tpl)).toBe(false);
  });

  it("treats different array lengths as a change", () => {
    const tpl = baseTemplate({ recurrence_type: "yearly", interval_days: null, months: [3, 6], day_of_month: 1 });
    const copy = baseTemplate({ recurrence_type: "yearly", interval_days: null, months: [3, 6, 9], day_of_month: 1 });
    expect(isCopyLocallyEdited(copy, tpl)).toBe(true);
  });

  it("detects supply_profile_id divergence (null vs set)", () => {
    expect(isCopyLocallyEdited(baseTemplate({ supply_profile_id: "sup-1" }), baseTemplate({ supply_profile_id: null }))).toBe(true);
    expect(isCopyLocallyEdited(baseTemplate({ supply_profile_id: "sup-1" }), baseTemplate({ supply_profile_id: "sup-2" }))).toBe(true);
    expect(isCopyLocallyEdited(baseTemplate({ supply_profile_id: "sup-1" }), baseTemplate({ supply_profile_id: "sup-1" }))).toBe(false);
  });

  it("detects custom_dates divergence", () => {
    const tpl = baseTemplate({ recurrence_type: "custom_dates", custom_dates: ["2026-06-01", "2026-07-01"] });
    const copy = baseTemplate({ recurrence_type: "custom_dates", custom_dates: ["2026-06-01", "2026-08-01"] });
    expect(isCopyLocallyEdited(copy, tpl)).toBe(true);
  });

  it("returns false when both copy and template have null arrays", () => {
    expect(isCopyLocallyEdited(baseTemplate({ months: null }), baseTemplate({ months: null }))).toBe(false);
    expect(isCopyLocallyEdited(baseTemplate({ custom_dates: null }), baseTemplate({ custom_dates: null }))).toBe(false);
  });
});

describe("computeCascadeNextDueDate", () => {
  it("computes today + interval_days for interval recurrence", () => {
    const today = new Date();
    const result = computeCascadeNextDueDate(baseTemplate({ recurrence_type: "interval", interval_days: 7 }));
    const expected = new Date(today.getTime() + 7 * 86400000);
    const expectedStr = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, "0")}-${String(expected.getDate()).padStart(2, "0")}`;
    expect(result).toBe(expectedStr);
  });

  it("returns null for unsupported recurrence with no interval (one_off without interval_days)", () => {
    expect(computeCascadeNextDueDate(baseTemplate({ recurrence_type: "one_off", interval_days: null }))).toBeNull();
  });

  it("computes monthly next due using day_of_month clamped to 28", () => {
    const result = computeCascadeNextDueDate(baseTemplate({ recurrence_type: "monthly", interval_days: null, day_of_month: 31 }));
    expect(result).not.toBeNull();
    expect(result!.split("-")[2]).toBe("28");
  });

  it("computes one_off as today + interval_days when interval_days provided", () => {
    const today = new Date();
    const result = computeCascadeNextDueDate(baseTemplate({ recurrence_type: "one_off", interval_days: 5 }));
    const expected = new Date(today.getTime() + 5 * 86400000);
    const expectedStr = `${expected.getFullYear()}-${String(expected.getMonth() + 1).padStart(2, "0")}-${String(expected.getDate()).padStart(2, "0")}`;
    expect(result).toBe(expectedStr);
  });

  it("computes yearly next due picking earliest future month, falling back to next year", () => {
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const futureMonth = currentMonth < 12 ? currentMonth + 1 : 1;
    const result = computeCascadeNextDueDate(baseTemplate({
      recurrence_type: "yearly",
      interval_days: null,
      months: [futureMonth],
      day_of_month: 15,
    }));
    expect(result).not.toBeNull();
    const expectedYear = futureMonth > currentMonth ? today.getFullYear() : today.getFullYear() + 1;
    expect(result!.startsWith(`${expectedYear}-${String(futureMonth).padStart(2, "0")}-15`)).toBe(true);
  });
});
