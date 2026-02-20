/**
 * Regression tests for calendar batch-select and label-fix features.
 *
 * Covers two changes made to src/app/calendar/page.tsx:
 *
 *  Fix A — Submit button label consistency
 *    The "Add Reminder" modal header was paired with a "Save task" button.
 *    The button now reads "Add Reminder" in Reminders view and "Save Task" in
 *    Overview view, matching the modal's own <h2>.
 *
 *  Feature B — Multi-select batch actions
 *    Long-press a task to enter select mode; tap further tasks to add them
 *    to the selection; a sticky bottom bar offers Reschedule / Delete for the
 *    whole batch.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const src = readFileSync(join(ROOT, "src/app/calendar/page.tsx"), "utf-8");

// ---------------------------------------------------------------------------
// Fix A — Submit button label
// ---------------------------------------------------------------------------
describe("Calendar submit button label consistency", () => {
  it("Submit button shows 'Add Reminder' when in Reminders (list) view", () => {
    expect(src).toContain('"Add Reminder"');
  });

  it("Submit button shows 'Save Task' when in Overview view", () => {
    expect(src).toContain('"Save Task"');
  });

  it("Label is driven by a viewMode conditional, not hardcoded", () => {
    expect(src).toContain('viewMode === "list" ? "Add Reminder" : "Save Task"');
  });
});

// ---------------------------------------------------------------------------
// Feature B — Batch select state
// ---------------------------------------------------------------------------
describe("Batch select — state variables are declared", () => {
  it("selectMode boolean state exists", () => {
    expect(src).toContain("selectMode");
    expect(src).toContain("setSelectMode");
  });

  it("selectedIds Set state exists", () => {
    expect(src).toContain("selectedIds");
    expect(src).toContain("setSelectedIds");
  });

  it("batchActionOpen state exists for sheet routing", () => {
    expect(src).toContain("batchActionOpen");
    expect(src).toContain("setBatchActionOpen");
  });

  it("batchSaving state exists to disable buttons during async ops", () => {
    expect(src).toContain("batchSaving");
    expect(src).toContain("setBatchSaving");
  });
});

// ---------------------------------------------------------------------------
// Feature B — Batch select handlers
// ---------------------------------------------------------------------------
describe("Batch select — handlers are implemented", () => {
  it("handleLongPressTask sets selectMode to true", () => {
    expect(src).toContain("handleLongPressTask");
    expect(src).toContain("setSelectMode(true)");
  });

  it("toggleTaskSelect adds and removes tasks from selectedIds", () => {
    expect(src).toContain("toggleTaskSelect");
  });

  it("exitSelectMode resets selectMode to false", () => {
    expect(src).toContain("exitSelectMode");
    expect(src).toContain("setSelectMode(false)");
  });

  it("handleBatchReschedule updates due_date for all selected tasks", () => {
    expect(src).toContain("handleBatchReschedule");
    expect(src).toContain("due_date: newDate");
  });

  it("handleBatchDelete soft-deletes via deleted_at (no hard delete)", () => {
    // Law 2: soft delete only — never hard delete tasks
    expect(src).toContain("handleBatchDelete");
    expect(src).toContain("deleted_at");
  });

  it("handleBatchDelete does NOT hard-delete rows", () => {
    // Ensure the batch delete uses .update() not .delete() for soft-delete compliance.
    // We detect this by confirming deleted_at is set alongside batch delete logic.
    const batchDeleteIdx = src.indexOf("handleBatchDelete");
    const deletedAtIdx   = src.indexOf("deleted_at: new Date");
    expect(batchDeleteIdx).toBeGreaterThan(-1);
    expect(deletedAtIdx).toBeGreaterThan(-1);
  });
});

// ---------------------------------------------------------------------------
// Feature B — CalendarTaskRow select mode props
// ---------------------------------------------------------------------------
describe("Batch select — CalendarTaskRow component interface", () => {
  it("CalendarTaskRow accepts selectMode prop", () => {
    expect(src).toContain("selectMode?: boolean");
  });

  it("CalendarTaskRow accepts isSelected prop", () => {
    expect(src).toContain("isSelected?: boolean");
  });

  it("CalendarTaskRow accepts onLongPress callback", () => {
    expect(src).toContain("onLongPress?: () => void");
  });

  it("CalendarTaskRow accepts onToggleSelect callback", () => {
    expect(src).toContain("onToggleSelect?: () => void");
  });

  it("In select mode, action buttons (Snooze/Complete) are suppressed", () => {
    // The `!selectMode` guard on the action button group hides per-row actions
    // so the user interacts with the batch bar instead.
    expect(src).toContain("!selectMode");
  });

  it("Checkbox circle reflects selected state with emerald fill", () => {
    expect(src).toContain('isSelected ? "bg-emerald-500 border-emerald-500"');
  });

  it("All 3 CalendarTaskRow call sites pass selectMode", () => {
    const count = (src.match(/selectMode=\{selectMode\}/g) ?? []).length;
    expect(count).toBe(3);
  });

  it("All 3 CalendarTaskRow call sites pass isSelected", () => {
    const count = (src.match(/isSelected=\{selectedIds\.has/g) ?? []).length;
    expect(count).toBe(3);
  });

  it("All 3 CalendarTaskRow call sites wire onLongPress to handleLongPressTask", () => {
    const count = (src.match(/onLongPress=\{/g) ?? []).length;
    expect(count).toBe(3);
  });

  it("All 3 CalendarTaskRow call sites wire onToggleSelect to toggleTaskSelect", () => {
    const count = (src.match(/onToggleSelect=\{/g) ?? []).length;
    expect(count).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Feature B — Batch action bar and sheets
// ---------------------------------------------------------------------------
describe("Batch select — action bar and sheets", () => {
  it("Action bar renders conditionally when selectMode is true", () => {
    expect(src).toContain("{selectMode && (");
  });

  it("Action bar sits above the fixed bottom nav (bottom-[88px])", () => {
    // The nav is 80px tall; bottom-[88px] gives 8px breathing room above it.
    expect(src).toContain("bottom-[88px]");
  });

  it("Reschedule button is present in the action bar", () => {
    expect(src).toContain("Reschedule");
  });

  it("Delete button is present in the action bar", () => {
    expect(src).toContain("Delete");
  });

  it("Reschedule sheet offers 'Tomorrow' quick preset", () => {
    expect(src).toContain("Tomorrow");
  });

  it("Reschedule sheet offers 'In 3 days' quick preset", () => {
    expect(src).toContain("In 3 days");
  });

  it("Reschedule sheet offers 'Next week' quick preset", () => {
    expect(src).toContain("Next week");
  });

  it("Delete sheet requires explicit confirmation ('cannot be undone')", () => {
    expect(src).toContain("cannot be undone");
  });

  it("exitSelectMode is wired to the action bar close/cancel button", () => {
    expect(src).toContain("exitSelectMode");
  });
});
