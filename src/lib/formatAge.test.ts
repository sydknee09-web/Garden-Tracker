import { describe, it, expect } from "vitest";
import { formatAge } from "./formatAge";

describe("formatAge", () => {
  it("returns '—' for empty / missing sow date", () => {
    expect(formatAge("")).toBe("—");
    expect(formatAge("   ")).toBe("—");
  });

  it("handles a full-ISO sown_date WITHOUT producing 'NaN yr' (Snow Pea Beauregarde bug)", () => {
    // Full ISO timestamp with a "T" — the old code appended "T12:00:00" → Invalid Date → "NaN yr".
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const iso = twoYearsAgo.toISOString(); // e.g. 2024-06-10T...Z
    const out = formatAge(iso);
    expect(out).not.toContain("NaN");
    expect(out).toMatch(/yr|mo/);
  });

  it("handles a date-only sown_date", () => {
    // 730 days = floor(730/30.44) = 23 months, just under the 24-month → years threshold.
    const out = formatAge("2024-06-10", "2026-06-10");
    expect(out).not.toContain("NaN");
    expect(out).toBe("23 mo");
  });

  it("returns '—' for an unparseable date", () => {
    expect(formatAge("not-a-date")).toBe("—");
  });

  it("returns day/week/month/year buckets correctly", () => {
    expect(formatAge("2026-06-08", "2026-06-10")).toBe("2 days");
    expect(formatAge("2026-05-10", "2026-06-10")).toBe("4 wks");
    expect(formatAge("2026-01-10", "2026-06-10")).toBe("4 mo");
    expect(formatAge("2024-01-10", "2026-06-10")).toMatch(/^2 yr/);
  });

  it("returns 'Not yet planted' when the date is in the future", () => {
    const future = new Date();
    future.setDate(future.getDate() + 30);
    expect(formatAge(future.toISOString().slice(0, 10))).toBe("Not yet planted");
  });
});
