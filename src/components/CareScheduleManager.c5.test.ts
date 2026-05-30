import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildOverdueOccurrenceDates } from "../lib/generateCareTasks";

/**
 * Regression coverage for Sprint 2 Phase C Chunk C5 —
 * Skip-today / Catch-up (inline expander) / Retro-apply affordances on instance Care tab cards.
 *
 * Two layers:
 *   1. Pure-logic verification of buildOverdueOccurrenceDates (interval / monthly / yearly / cap / edges).
 *   2. Source-level invariants on the manager and helper module so the wiring + skip-not-complete
 *      semantic stay locked.
 */

const MANAGER_SRC = readFileSync(join(__dirname, "CareScheduleManager.tsx"), "utf8");
const GEN_SRC = readFileSync(join(__dirname, "..", "lib", "generateCareTasks.ts"), "utf8");

describe("buildOverdueOccurrenceDates — interval recurrence", () => {
  it("returns one date when next_due_date is the day before today", () => {
    const dates = buildOverdueOccurrenceDates(
      { recurrence_type: "interval", interval_days: 7, months: null, day_of_month: null, next_due_date: "2026-05-28" },
      "2026-05-29",
    );
    expect(dates).toEqual(["2026-05-28"]);
  });

  it("returns multiple dates when several intervals have elapsed", () => {
    const dates = buildOverdueOccurrenceDates(
      { recurrence_type: "interval", interval_days: 7, months: null, day_of_month: null, next_due_date: "2026-05-01" },
      "2026-05-29",
    );
    expect(dates).toEqual(["2026-05-01", "2026-05-08", "2026-05-15", "2026-05-22"]);
  });

  it("caps at 12 occurrences so a year of missed weeklies does not explode the UI", () => {
    const dates = buildOverdueOccurrenceDates(
      { recurrence_type: "interval", interval_days: 7, months: null, day_of_month: null, next_due_date: "2025-05-29" },
      "2026-05-29",
    );
    expect(dates.length).toBe(12);
  });

  it("returns [] when next_due_date is today or later", () => {
    expect(
      buildOverdueOccurrenceDates(
        { recurrence_type: "interval", interval_days: 7, months: null, day_of_month: null, next_due_date: "2026-05-29" },
        "2026-05-29",
      ),
    ).toEqual([]);
    expect(
      buildOverdueOccurrenceDates(
        { recurrence_type: "interval", interval_days: 7, months: null, day_of_month: null, next_due_date: "2026-06-01" },
        "2026-05-29",
      ),
    ).toEqual([]);
  });

  it("returns [] when next_due_date is null", () => {
    expect(
      buildOverdueOccurrenceDates(
        { recurrence_type: "interval", interval_days: 7, months: null, day_of_month: null, next_due_date: null },
        "2026-05-29",
      ),
    ).toEqual([]);
  });
});

describe("buildOverdueOccurrenceDates — monthly / yearly / one_off recurrences", () => {
  it("monthly: returns one date per missed month", () => {
    const dates = buildOverdueOccurrenceDates(
      { recurrence_type: "monthly", interval_days: null, months: null, day_of_month: 15, next_due_date: "2026-03-15" },
      "2026-05-29",
    );
    expect(dates).toEqual(["2026-03-15", "2026-04-15", "2026-05-15"]);
  });

  it("yearly: returns one date per missed year (incl. current-year occurrence already past)", () => {
    const dates = buildOverdueOccurrenceDates(
      { recurrence_type: "yearly", interval_days: null, months: [3], day_of_month: 1, next_due_date: "2024-03-01" },
      "2026-05-29",
    );
    expect(dates).toEqual(["2024-03-01", "2025-03-01", "2026-03-01"]);
  });

  it("one_off: returns the single missed occurrence", () => {
    const dates = buildOverdueOccurrenceDates(
      { recurrence_type: "one_off", interval_days: 30, months: null, day_of_month: null, next_due_date: "2026-05-01" },
      "2026-05-29",
    );
    expect(dates).toEqual(["2026-05-01"]);
  });
});

describe("CareScheduleManager — C5 affordance render gates", () => {
  it("only renders C5 action row when growInstanceId is set (instance Care tab mode)", () => {
    expect(MANAGER_SRC).toMatch(/growInstanceId && !readOnly/);
  });

  it("Skip Today chip lives in the per-card action row", () => {
    expect(MANAGER_SRC).toMatch(/setSkipConfirmId\(s\.id\)/);
    expect(MANAGER_SRC).toMatch(/Skip Today/);
  });

  it("Catch Up chip only renders when overdueDates.length > 0", () => {
    expect(MANAGER_SRC).toMatch(/const overdueDates = buildOverdueOccurrenceDates/);
    expect(MANAGER_SRC).toMatch(/isOverdue && \(/);
  });

  it("Log Past Completion chip lives in the per-card action row", () => {
    expect(MANAGER_SRC).toMatch(/Log Past Completion/);
  });
});

describe("CareScheduleManager — Catch-up inline expander (Q10 lock = inline, NOT modal)", () => {
  it("expander renders inside the schedule card, not as a fixed overlay", () => {
    // Q10: the catch-up surface is an inline expander inside the card.
    // Verify the catch-up block uses id={`catchup-${s.id}`} on a non-fixed div, not a fixed overlay.
    expect(MANAGER_SRC).toMatch(/id=\{`catchup-\$\{s\.id\}`\}[\s\S]{0,80}rounded-xl border border-amber-200/);
    // Sanity: the catch-up block is NOT inside a fixed-overlay wrapper.
    expect(MANAGER_SRC).not.toMatch(/fixed inset-0[\s\S]{0,200}catchup-/);
  });

  it("supports All Done / Skip All shortcuts plus per-occurrence toggle", () => {
    expect(MANAGER_SRC).toMatch(/setAllCatchUpDecisions\("complete"\)/);
    expect(MANAGER_SRC).toMatch(/setAllCatchUpDecisions\("skip"\)/);
    expect(MANAGER_SRC).toMatch(/toggleCatchUpDecision\(d\)/);
  });

  it("default per-occurrence decision is complete (matches §5.3 recommended default)", () => {
    expect(MANAGER_SRC).toMatch(/for \(const d of dates\) next\.set\(d, "complete"\);/);
  });
});

describe("CareScheduleManager — Retro-apply inline expander with date picker", () => {
  it("renders an inline date picker bounded to today (max={localDateString()})", () => {
    expect(MANAGER_SRC).toMatch(/id=\{`retro-date-\$\{s\.id\}`\}/);
    expect(MANAGER_SRC).toMatch(/type="date"[\s\S]{0,250}max=\{localDateString\(\)\}/);
  });

  it("guards against future dates in handleRetroApply", () => {
    expect(MANAGER_SRC).toMatch(/if \(retroDate > localDateString\(\)\)/);
  });
});

describe("CareScheduleManager — Skip-today gentle-confirm dialog", () => {
  it("mirrors the Archive precedent: bottom-anchored fixed popup with z-[101]", () => {
    expect(MANAGER_SRC).toMatch(/skipConfirmId && \(\(\)/);
    expect(MANAGER_SRC).toMatch(/fixed left-4 right-4 bottom-4 z-\[101\][\s\S]{0,400}Skip Today/);
  });

  it("calls skipNextCareOccurrence on confirm and not on cancel", () => {
    expect(MANAGER_SRC).toMatch(/await skipNextCareOccurrence\(id, userId\)/);
  });
});

describe("generateCareTasks.ts — C5 helper exports", () => {
  it("exports buildOverdueOccurrenceDates", () => {
    expect(GEN_SRC).toMatch(/export function buildOverdueOccurrenceDates/);
  });

  it("exports skipNextCareOccurrence", () => {
    expect(GEN_SRC).toMatch(/export async function skipNextCareOccurrence/);
  });

  it("exports catchUpCareSchedule", () => {
    expect(GEN_SRC).toMatch(/export async function catchUpCareSchedule/);
  });

  it("exports applyRetroactiveCompletion", () => {
    expect(GEN_SRC).toMatch(/export async function applyRetroactiveCompletion/);
  });
});

describe("generateCareTasks.ts — skip != complete semantic", () => {
  it("skipNextCareOccurrence does NOT update last_completed_at", () => {
    // Grab the skipNextCareOccurrence function body and assert last_completed_at is not in it.
    const start = GEN_SRC.indexOf("export async function skipNextCareOccurrence");
    const end = GEN_SRC.indexOf("export async function catchUpCareSchedule");
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const body = GEN_SRC.slice(start, end);
    expect(body).not.toMatch(/last_completed_at/);
  });

  it("applyRetroactiveCompletion DOES update last_completed_at (to the backdated time)", () => {
    const start = GEN_SRC.indexOf("export async function applyRetroactiveCompletion");
    const end = GEN_SRC.indexOf("Copy care_schedule templates from a profile");
    expect(start).toBeGreaterThan(0);
    const body = GEN_SRC.slice(start, end);
    expect(body).toMatch(/last_completed_at: completedAtISO/);
  });

  it("retro-apply computes next_due_date FROM the backdated completion date, not from today", () => {
    const start = GEN_SRC.indexOf("export async function applyRetroactiveCompletion");
    const end = GEN_SRC.indexOf("Copy care_schedule templates from a profile");
    const body = GEN_SRC.slice(start, end);
    // baseline = new Date(completedDate + "T12:00:00") is the recompute baseline.
    expect(body).toMatch(/const baseline = new Date\(completedDate \+ "T12:00:00"\)/);
    expect(body).toMatch(/computeNextDueFromBaseline\(s, baseline\)/);
  });
});

describe("generateCareTasks.ts — catch-up insert shape", () => {
  it("inserts backdated tasks with completed_at set so they appear in history", () => {
    const start = GEN_SRC.indexOf("export async function catchUpCareSchedule");
    const end = GEN_SRC.indexOf("export async function applyRetroactiveCompletion");
    const body = GEN_SRC.slice(start, end);
    expect(body).toMatch(/completed_at: completedAtISO/);
  });

  it("sweeps existing overdue pending tasks before inserting backdated rows", () => {
    const start = GEN_SRC.indexOf("export async function catchUpCareSchedule");
    const end = GEN_SRC.indexOf("export async function applyRetroactiveCompletion");
    const body = GEN_SRC.slice(start, end);
    expect(body).toMatch(/\.lt\("due_date", today\)[\s\S]{0,200}\.is\("deleted_at", null\)/);
  });
});
