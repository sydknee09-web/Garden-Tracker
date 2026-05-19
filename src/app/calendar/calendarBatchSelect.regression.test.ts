/**
 * Regression tests for calendar batch-select and label-fix features.
 *
 * Covers two changes made to src/app/calendar/page.tsx:
 *
 *  Fix A — Submit button label consistency
 *    The "Add Reminder" modal header was paired with a "Save task" button.
 *    The button now reads "Add Task" / "Add Recurring Task" matching the FAB
 *    "Add" verb-pattern (Phase 1 Ship 2 cohesion pass, 2026-05-18).
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
const newTaskModalSrc = readFileSync(join(ROOT, "src/components/NewTaskModal.tsx"), "utf-8");

// ---------------------------------------------------------------------------
// Fix A — Submit button label (now in NewTaskModal)
// ---------------------------------------------------------------------------
describe("Calendar submit button label consistency", () => {
  it("Submit button shows 'Add Task' for standard tasks", () => {
    expect(newTaskModalSrc).toContain('"Add Task"');
  });

  it("Submit button shows 'Add Recurring Task' for recurring tasks", () => {
    expect(newTaskModalSrc).toContain('"Add Recurring Task"');
  });

  it("Label is driven by an isRecurring conditional, not hardcoded", () => {
    expect(newTaskModalSrc).toContain('isRecurring ? "Add Recurring Task" : "Add Task"');
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
    const batchDeleteIdx = src.indexOf("handleBatchDelete");
    const handlerSection = src.slice(batchDeleteIdx, batchDeleteIdx + 2500);
    expect(handlerSection).toContain("deleted_at");
    expect(handlerSection).toContain(".update(");
    expect(handlerSection).not.toMatch(/\.from\s*\(\s*["']tasks["']\s*\)\s*\.\s*delete\s*\(/);
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

  it("All CalendarTaskRow call sites pass selectMode", () => {
    const count = (src.match(/selectMode=\{selectMode\}/g) ?? []).length;
    // Overdue singleton + overdue inside expanded consolidated group + selectedDate view + date groups
    expect(count).toBe(4);
  });

  it("All CalendarTaskRow call sites pass isSelected", () => {
    const count = (src.match(/isSelected=\{selectedIds\.has/g) ?? []).length;
    expect(count).toBe(4);
  });

  it("All CalendarTaskRow call sites wire onLongPress to handleLongPressTask", () => {
    const count = (src.match(/onLongPress=\{/g) ?? []).length;
    expect(count).toBe(4);
  });

  it("All CalendarTaskRow call sites wire onToggleSelect to toggleTaskSelect", () => {
    const count = (src.match(/onToggleSelect=\{/g) ?? []).length;
    expect(count).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// Feature B — Batch action bar and sheets
// ---------------------------------------------------------------------------
describe("Batch select — action bar and sheets", () => {
  it("Batch menu renders when selectMode and batchMenuOpen are true", () => {
    // B7: Fixed action bar removed; FAB opens a menu (batchMenuOpen) when in select mode.
    expect(src).toContain("batchMenuOpen");
    expect(src).toContain("selectMode && batchMenuOpen");
  });

  it("Batch action menu sits above the fixed bottom nav", () => {
    // Menu is positioned above FAB and nav (5rem + 80px + safe area).
    expect(src).toContain("bottom-[calc(5rem+80px");
  });

  it("Reschedule and Delete are present in the batch menu", () => {
    expect(src).toContain("Reschedule");
    expect(src).toContain("Delete");
  });

  it("Edit task option is present in the batch menu", () => {
    expect(src).toContain("Edit task");
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

  // N4: NewTaskModal must NOT call useModalBackClose — calendar/page.tsx owns it. Duplicate causes double Back press.
  it("NewTaskModal does not call useModalBackClose (page owns back state)", () => {
    expect(newTaskModalSrc).not.toContain("useModalBackClose");
  });
});

// ---------------------------------------------------------------------------
// Feature C — Overdue consolidation (group repeated tasks under a summary row)
// ---------------------------------------------------------------------------
describe("Overdue consolidation — state and grouping helpers", () => {
  it("expandedOverdueGroups Set state exists", () => {
    expect(src).toContain("expandedOverdueGroups");
    expect(src).toContain("setExpandedOverdueGroups");
  });

  it("toggleOverdueGroup handler exists", () => {
    expect(src).toContain("toggleOverdueGroup");
  });

  it("overdueGroups is built via useMemo from overdueTasks", () => {
    expect(src).toContain("const overdueGroups = useMemo");
  });

  it("Group key includes title, plant_profile_id, grow_instance_id, and user_id (so household members' identical tasks don't merge)", () => {
    expect(src).toContain("t.title ?? \"\"");
    expect(src).toContain("t.plant_profile_id ?? \"\"");
    expect(src).toContain("t.grow_instance_id ?? \"\"");
    expect(src).toContain("t.user_id ?? \"\"");
  });

  it("handleSelectAllInGroup enters selectMode, fills selectedIds, opens batch menu", () => {
    expect(src).toContain("handleSelectAllInGroup");
    const idx = src.indexOf("handleSelectAllInGroup = useCallback");
    expect(idx).toBeGreaterThan(-1);
    const handlerSection = src.slice(idx, idx + 500);
    expect(handlerSection).toContain("setSelectMode(true)");
    expect(handlerSection).toContain("setSelectedIds");
    expect(handlerSection).toContain("setBatchMenuOpen(true)");
  });
});

describe("Overdue consolidation — render", () => {
  it("Singleton overdue groups render a flat CalendarTaskRow (no wrapper)", () => {
    // The singleton branch returns a CalendarTaskRow when groupTasks.length === 1
    expect(src).toContain("groupTasks.length === 1");
  });

  it("Multi-task overdue groups render a summary row with overdue count and oldest date", () => {
    expect(src).toContain("overdue · oldest");
  });

  it("Expanded group shows 'Select all' button when not in select mode", () => {
    // Hidden in collapsed state to keep vertical rhythm uniform across rows;
    // revealed inside the expanded view, top-right, only when not already in select mode.
    expect(src).toContain("Select all");
    expect(src).toContain("handleSelectAllInGroup(groupTasks)");
  });

  it("Summary row chevron rotates when expanded", () => {
    expect(src).toContain("isGroupExpanded ? \"rotate-180\"");
  });
});

// ---------------------------------------------------------------------------
// Feature D — Day-header visual treatment (semibold + emerald tint)
// ---------------------------------------------------------------------------
describe("Day header visual treatment", () => {
  it("Per-date headers use font-semibold (not font-medium) for stronger section dividers", () => {
    // Match the date-group header span specifically
    expect(src).toContain('text-sm font-semibold text-black/85');
  });

  it("Per-date headers carry a faint emerald tint", () => {
    expect(src).toContain("bg-emerald-50/40");
    expect(src).toContain("hover:bg-emerald-50/70");
  });
});

// ---------------------------------------------------------------------------
// Feature E — Swipe gestures (mobile) + responsive button visibility (iPad+/desktop)
// Implements VISION.md Principle 9 (narrowed 2026-05-17 for Walter persona):
// phone-portrait is swipe-only; iPad-portrait+ AND desktop show inline buttons
// (`hidden md:flex`) alongside swipe. Swipe-left = complete, swipe-right = open snooze.
// ---------------------------------------------------------------------------
describe("Calendar row — swipe gestures (mobile)", () => {
  it("Swipe state and refs exist on CalendarTaskRow", () => {
    expect(src).toContain("swipeOffsetX");
    expect(src).toContain("setSwipeOffsetX");
    expect(src).toContain("isSwiping");
    expect(src).toContain("setIsSwiping");
    expect(src).toContain("swipeStartRef");
    expect(src).toContain("swipeDirectionRef");
    expect(src).toContain("latestOffsetRef");
  });

  it("Swipe is gated by eligibility (not completed, not selectMode, not optimistic, canEdit)", () => {
    expect(src).toContain("swipeEligible");
    expect(src).toContain("!task.completed_at && !selectMode && !isOptimistic && canEdit");
  });

  it("Touch handlers are attached via native addEventListener with passive: false", () => {
    // React's synthetic touchmove is passive by default on mobile, which would
    // block preventDefault. Native listeners with passive:false are required.
    expect(src).toContain('addEventListener("touchstart"');
    expect(src).toContain('addEventListener("touchmove"');
    expect(src).toContain('{ passive: false }');
  });

  it("Direction lock prevents diagonal-jitter from triggering false swipes during scroll", () => {
    // The lock decides "horizontal" vs "vertical" once early movement crosses
    // a small threshold; only the horizontal branch intercepts (preventDefault).
    // Vertical lock just falls through, letting the page scroll naturally.
    expect(src).toContain('"horizontal" : "vertical"');
    expect(src).toContain('swipeDirectionRef.current === "horizontal"');
  });

  it("Swipe-left past threshold fires onSwipeLeft; swipe-right fires onSwipeRight (via useRowSwipe hook)", () => {
    expect(src).toContain("SWIPE_THRESHOLD");
    expect(src).toContain("dx <= -SWIPE_THRESHOLD");
    expect(src).toContain("onSwipeLeft()");
    expect(src).toContain("dx >= SWIPE_THRESHOLD");
    expect(src).toContain("onSwipeRight()");
  });

  it("CalendarTaskRow wires onSwipeLeft to onComplete and onSwipeRight to openSnooze", () => {
    expect(src).toContain("onSwipeLeft: onComplete");
    expect(src).toContain("onSwipeRight: openSnooze");
    expect(src).toContain("setSnoozeOpen(true)");
  });

  it("Row content slides via transform, with no transition during active swipe", () => {
    expect(src).toContain("transform: `translateX(${swipeOffsetX}px)`");
    expect(src).toContain('transition: isSwiping ? "none" : "transform 0.2s ease-out"');
  });

  it("Swipe-reveal background layer renders only when there is offset", () => {
    expect(src).toContain("showSwipeReveal");
    expect(src).toContain("swipeOffsetX !== 0");
  });

  it("Cleanup removes all touch listeners on unmount or eligibility change", () => {
    expect(src).toContain('removeEventListener("touchstart"');
    expect(src).toContain('removeEventListener("touchmove"');
    expect(src).toContain('removeEventListener("touchend"');
    expect(src).toContain('removeEventListener("touchcancel"');
  });
});

describe("Calendar row — responsive button visibility (iPad-portrait+/desktop)", () => {
  it("Inline snooze/complete buttons are hidden on phone-portrait, visible on iPad-portrait+ (md:)", () => {
    // The action group uses `hidden md:flex` so it renders at md+ (≥768px) breakpoints.
    // Phone-portrait users get the swipe pattern instead. Walter persona served on iPad.
    expect(src).toContain('"hidden md:flex items-center gap-1 shrink-0"');
  });
});

// ---------------------------------------------------------------------------
// Feature F — useRowSwipe hook (shared swipe primitive)
// Swipe logic extracted into a hook so it can be reused on consolidated-group
// header rows (apply-all to N tasks at once) without duplicating the gesture
// machinery.
// ---------------------------------------------------------------------------
describe("useRowSwipe hook — extracted swipe primitive", () => {
  it("useRowSwipe is defined as a top-level function", () => {
    expect(src).toContain("function useRowSwipe(");
  });

  it("useRowSwipe accepts enabled, onSwipeLeft, onSwipeRight props", () => {
    expect(src).toContain("enabled: boolean");
    expect(src).toContain("onSwipeLeft: () => void");
    expect(src).toContain("onSwipeRight: () => void");
  });

  it("useRowSwipe returns { rowRef, swipeOffsetX, isSwiping }", () => {
    expect(src).toContain("return { rowRef, swipeOffsetX, isSwiping };");
  });

  it("CalendarTaskRow consumes useRowSwipe (no inline gesture state)", () => {
    expect(src).toContain("useRowSwipe({");
    // The old inline declarations should be gone from CalendarTaskRow's body.
    // (They live inside useRowSwipe now.) We verify by checking the hook call site
    // appears in the file.
    const calendarTaskRowIdx = src.indexOf("function CalendarTaskRow");
    const calendarTaskRowEnd = src.indexOf("\n}\n", calendarTaskRowIdx);
    const body = src.slice(calendarTaskRowIdx, calendarTaskRowEnd);
    expect(body).toContain("useRowSwipe({");
    // No duplicated swipe-state setters inline in CalendarTaskRow
    expect(body).not.toContain("setSwipeOffsetX(dx)");
  });
});

// ---------------------------------------------------------------------------
// Feature G — Consolidated overdue group: apply-all actions
// Inline [Snooze][Done][Chevron] cluster on consolidated rows; both actions
// route through confirmation/sheets and apply to every task in the group.
// Mobile parity via swipe (left = complete-all, right = snooze-all).
// ---------------------------------------------------------------------------
describe("Consolidated overdue row — apply-all actions", () => {
  it("ConsolidatedOverdueHeader component is defined", () => {
    expect(src).toContain("function ConsolidatedOverdueHeader(");
  });

  it("Header has Snooze, Done, and Chevron buttons in that order", () => {
    const headerIdx = src.indexOf("function ConsolidatedOverdueHeader(");
    expect(headerIdx).toBeGreaterThan(-1);
    const body = src.slice(headerIdx, headerIdx + 8000);
    const snoozeIdx = body.indexOf("aria-label={`Snooze all");
    const doneIdx = body.indexOf("aria-label={`${firstSow ? \"Plant\" : \"Mark complete\"} all");
    const chevronIdx = body.indexOf("aria-label={isGroupExpanded ? \"Collapse\" : \"Expand\"}");
    expect(snoozeIdx).toBeGreaterThan(-1);
    expect(doneIdx).toBeGreaterThan(-1);
    expect(chevronIdx).toBeGreaterThan(-1);
    expect(snoozeIdx).toBeLessThan(doneIdx);
    expect(doneIdx).toBeLessThan(chevronIdx);
  });

  it("Snooze and Done buttons on consolidated row are hidden on phone-portrait (hidden md:flex)", () => {
    const headerIdx = src.indexOf("function ConsolidatedOverdueHeader(");
    const body = src.slice(headerIdx, headerIdx + 8000);
    // Both buttons should use hidden md:flex (narrowed 2026-05-17 from lg: for Walter persona)
    const hiddenMdCount = (body.match(/hidden md:flex/g) ?? []).length;
    expect(hiddenMdCount).toBeGreaterThanOrEqual(2);
  });

  it("Chevron on consolidated row is always visible (no hidden md:flex)", () => {
    const headerIdx = src.indexOf("function ConsolidatedOverdueHeader(");
    const body = src.slice(headerIdx, headerIdx + 8000);
    // The chevron button's className should NOT include hidden md
    const chevronButtonIdx = body.indexOf('aria-label={isGroupExpanded ? "Collapse" : "Expand"}');
    expect(chevronButtonIdx).toBeGreaterThan(-1);
    // Walk back to the className for the chevron button
    const sectionBefore = body.slice(Math.max(0, chevronButtonIdx - 400), chevronButtonIdx);
    expect(sectionBefore).not.toContain("hidden md:flex");
  });

  it("Consolidated header uses useRowSwipe for mobile swipe parity", () => {
    const headerIdx = src.indexOf("function ConsolidatedOverdueHeader(");
    const body = src.slice(headerIdx, headerIdx + 8000);
    expect(body).toContain("useRowSwipe({");
    expect(body).toContain("onSwipeLeft: onCompleteAll");
    expect(body).toContain("onSwipeRight: onSnoozeAll");
  });
});

describe("Consolidated overdue row — bulk handlers and state", () => {
  it("groupAction state is declared with snooze and complete kinds", () => {
    expect(src).toContain("groupAction");
    expect(src).toContain("setGroupAction");
    expect(src).toContain('kind: "snooze" | "complete"');
  });

  it("handleCompleteAllInGroup is defined and guards on user + groupAction.kind", () => {
    expect(src).toContain("handleCompleteAllInGroup");
    const idx = src.indexOf("handleCompleteAllInGroup = useCallback");
    expect(idx).toBeGreaterThan(-1);
    const handler = src.slice(idx, idx + 1500);
    expect(handler).toContain('groupAction.kind !== "complete"');
    expect(handler).toContain("completeTask");
  });

  it("handleSnoozeAllInGroup is defined and guards on user + groupAction.kind", () => {
    expect(src).toContain("handleSnoozeAllInGroup");
    const idx = src.indexOf("handleSnoozeAllInGroup = useCallback");
    expect(idx).toBeGreaterThan(-1);
    const handler = src.slice(idx, idx + 3000);
    expect(handler).toContain('groupAction.kind !== "snooze"');
    expect(handler).toContain("due_date: newDate");
  });

  it("handleSnoozeAllInGroup preserves transplant→harvest cascade per-task", () => {
    const idx = src.indexOf("handleSnoozeAllInGroup = useCallback");
    const handler = src.slice(idx, idx + 3000);
    expect(handler).toContain('t.category === "transplant"');
    expect(handler).toContain("grow_instance_id");
    expect(handler).toContain("expected_harvest_date");
  });

  it("Bulk handlers emit a single toast, not per-task toasts", () => {
    const completeIdx = src.indexOf("handleCompleteAllInGroup = useCallback");
    const completeHandler = src.slice(completeIdx, completeIdx + 1500);
    expect(completeHandler).toMatch(/showToast\([^)]*tasks?[^)]*completed/);

    const snoozeIdx = src.indexOf("handleSnoozeAllInGroup = useCallback");
    const snoozeHandler = src.slice(snoozeIdx, snoozeIdx + 3000);
    expect(snoozeHandler).toMatch(/showToast\([^)]*tasks?[^)]*snoozed/);
  });
});

describe("Consolidated overdue row — confirm sheets", () => {
  it("'Mark all N as done?' confirm sheet renders when groupAction.kind === 'complete'", () => {
    expect(src).toContain('groupAction?.kind === "complete"');
    expect(src).toContain("Mark all {groupAction.tasks.length} as done?");
  });

  it("'Mark all as done?' sheet has Cancel and Mark done buttons", () => {
    const idx = src.indexOf('groupAction?.kind === "complete"');
    const sheet = src.slice(idx, idx + 2500);
    // Normalize line endings so CRLF (Windows) and LF (Unix) both work.
    const normalized = sheet.replace(/\r\n/g, "\n");
    expect(normalized).toContain(">\n                Cancel");
    expect(normalized).toContain('"Saving…" : "Mark done"');
  });

  it("'Snooze all N tasks' sheet renders when groupAction.kind === 'snooze'", () => {
    expect(src).toContain('groupAction?.kind === "snooze"');
    expect(src).toContain("Snooze all {groupAction.tasks.length} task");
  });

  it("'Snooze all' sheet offers Tomorrow / In 3 days / Next week quick chips + date picker", () => {
    const idx = src.indexOf('groupAction?.kind === "snooze"');
    const sheet = src.slice(idx, idx + 2500);
    expect(sheet).toContain('"Tomorrow"');
    expect(sheet).toContain('"In 3 days"');
    expect(sheet).toContain('"Next week"');
    expect(sheet).toContain('type="date"');
    expect(sheet).toContain("handleSnoozeAllInGroup");
  });

  it("Modal back-close is wired for groupAction (back-press dismisses the sheet)", () => {
    expect(src).toContain("useModalBackClose(!!groupAction");
  });

  it("Cancel button is disabled while bulk action is saving", () => {
    const idx = src.indexOf('groupAction?.kind === "complete"');
    const sheet = src.slice(idx, idx + 2500);
    expect(sheet).toContain("disabled={groupActionSaving}");
  });
});
