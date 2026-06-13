import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { isCopyLocallyEdited, type CascadeTemplateValues } from "../lib/generateCareTasks";

/**
 * Regression coverage for Sprint 2 Phase C Chunk C4 — Instance Care tab.
 *
 * Two layers:
 *   1. Source-level invariants on the tab structure (ActiveTab union widened, tab row label list)
 *   2. Pure-logic verification of the badge selector — proves Inherited / Overridden / no-badge
 *      logic matches the Pass 2 / Q7 ratification (AMBER = Overridden).
 */

const MODAL_SRC = readFileSync(join(__dirname, "GrowInstanceModal.tsx"), "utf8");
const MANAGER_SRC = readFileSync(join(__dirname, "CareScheduleManager.tsx"), "utf8");
const TAB_SRC = readFileSync(join(__dirname, "InstanceCareTab.tsx"), "utf8");

describe("GrowInstanceModal — Care tab structure (C4)", () => {
  it("widens ActiveTab union to include 'care'", () => {
    expect(MODAL_SRC).toMatch(/type ActiveTab = "overview" \| "journal" \| "care" \| "history"/);
  });

  it("renders 4 tab buttons in canonical order Overview / Journal / Care / Task History", () => {
    expect(MODAL_SRC).toMatch(/\["overview", "journal", "care", "history"\] as const/);
  });

  it("maps the 'care' tab key to the label 'Care'", () => {
    expect(MODAL_SRC).toMatch(/tab === "care" \? "Care"/);
  });

  it("mounts InstanceCareTab when activeTab === 'care'", () => {
    expect(MODAL_SRC).toMatch(/activeTab === "care"[\s\S]*?<InstanceCareTab/);
  });

  it("forwards focusScheduleId prop into InstanceCareTab for deep-link", () => {
    expect(MODAL_SRC).toMatch(/focusScheduleId\?: string/);
    expect(MODAL_SRC).toMatch(/<InstanceCareTab[\s\S]*?focusScheduleId=\{focusScheduleId\}/);
  });
});

describe("InstanceCareTab — instance-mode wiring (C4)", () => {
  it("passes isTemplate={false} to CareScheduleManager so cascade prompts skip in instance mode", () => {
    expect(TAB_SRC).toMatch(/isTemplate=\{false\}/);
  });

  it("passes growInstanceId so new schedules attach to this instance only", () => {
    expect(TAB_SRC).toMatch(/growInstanceId=\{growInstanceId\}/);
  });

  it("sorts schedules by next_due_date ASC per Q8 ratification", () => {
    expect(TAB_SRC).toMatch(/sort.*next_due_date/);
    expect(TAB_SRC).toMatch(/av\.localeCompare\(bv\)/);
  });

  it("fetches source-template values for any schedule with source_template_id", () => {
    expect(TAB_SRC).toMatch(/source_template_id/);
    expect(TAB_SRC).toMatch(/setTemplateLookup/);
  });
});

describe("CareScheduleManager — instance-attached insert (C4)", () => {
  it("accepts an optional growInstanceId prop for instance mode", () => {
    expect(MANAGER_SRC).toMatch(/growInstanceId\?: string/);
  });

  it("attaches grow_instance_id to the insert payload when growInstanceId is provided on Add", () => {
    expect(MANAGER_SRC).toMatch(/payload\.grow_instance_id = growInstanceId/);
  });

  it("accepts an optional templateLookup prop for badge rendering", () => {
    expect(MANAGER_SRC).toMatch(/templateLookup\?: Map<string, CascadeTemplateValues>/);
  });
});

describe("CareScheduleManager — badge render tokens (C4 / Q7 lock)", () => {
  it("Inherited badge uses neutral chip tokens (anchored to journal-entry supply pill)", () => {
    expect(MANAGER_SRC).toMatch(/bg-neutral-100[\s\S]{0,200}>Inherited</);
  });

  it("Overridden badge uses AMBER tokens per Q7 lock", () => {
    expect(MANAGER_SRC).toMatch(/bg-amber-50[\s\S]{0,200}>Overridden</);
    expect(MANAGER_SRC).toMatch(/text-amber-700[\s\S]{0,200}>Overridden</);
  });

  it("badge selector returns null when no templateLookup is provided (profile-level mode)", () => {
    expect(MANAGER_SRC).toMatch(/if \(!templateLookup\) return null;/);
  });

  it("badge selector returns null when schedule has no source_template_id (instance-only)", () => {
    expect(MANAGER_SRC).toMatch(/if \(!sourceId\) return null;/);
  });
});

/**
 * Verify the inherited-vs-overridden decision delegates to the audited isCopyLocallyEdited.
 * This is the same diff helper that 17 cascadeCare.test.ts tests cover, so we get coverage
 * by integration rather than duplication.
 */
describe("InstanceCareTab badge — delegates to isCopyLocallyEdited (C4)", () => {
  const base: CascadeTemplateValues = {
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
  };

  it("copy matching template => not locally edited => Inherited", () => {
    expect(isCopyLocallyEdited(base, base)).toBe(false);
  });

  it("copy with edited interval => locally edited => Overridden", () => {
    expect(isCopyLocallyEdited({ ...base, interval_days: 14 }, base)).toBe(true);
  });

  it("copy with edited notes => locally edited => Overridden", () => {
    expect(isCopyLocallyEdited({ ...base, notes: "twice on hot days" }, base)).toBe(true);
  });
});

describe("Calendar deep-link routing (C4)", () => {
  const CAL_SRC = readFileSync(join(__dirname, "..", "app", "calendar", "page.tsx"), "utf8");

  it("routes instance-scoped care tasks (grow_instance_id set) to the instance page Care tab", () => {
    // Sprint 3 2026-06-10: instance is a standalone page; canonical deep-link is /garden/grow/<id>?instanceTab=care.
    expect(CAL_SRC).toMatch(/\/garden\/grow\/\$\{gid\}\?instanceTab=care&schedule=\$\{sid\}/);
  });

  it("preserves /library Care-tab routing fallback when no grow_instance_id", () => {
    expect(CAL_SRC).toMatch(/\/library\/\$\{pid\}\?tab=care&from=calendar/);
  });
});
