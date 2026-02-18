/**
 * Layout regression tests for the Edit Plant Profile modal.
 *
 * These guard against two bugs that were fixed:
 *
 *  Bug 1 — Status dropdown clipped at screen bottom
 *    The Status <select> was the last field in the form. When opened near the
 *    bottom of the modal the native OS dropdown was cut off by the viewport.
 *    Fix: Status must be the FIRST field so the dropdown expands into open space.
 *
 *  Bug 2 — Save button hidden behind the fixed bottom navigation bar
 *    The modal backdrop had `pb-0` on mobile, so the bottom sheet extended flush
 *    to the screen edge — directly behind the 64px fixed BottomNav — hiding the
 *    Save Changes button entirely.
 *    Fix: backdrop uses `pb-20` (80px) to clear the nav; modal card uses
 *    `max-h-[calc(100dvh-6rem)]` (100dvh minus 1rem top + 5rem bottom padding).
 *
 * These tests read source files so that any future refactor that accidentally
 * reverts these classes will fail the test suite immediately.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

const vaultPage = readFileSync(
  join(ROOT, "src/app/vault/[id]/page.tsx"),
  "utf-8"
);

const bottomNav = readFileSync(
  join(ROOT, "src/components/BottomNav.tsx"),
  "utf-8"
);

// ---------------------------------------------------------------------------
// Bug 1: Status dropdown clipping
// ---------------------------------------------------------------------------
describe("Edit Plant Profile modal — Status field position (Bug 1 regression)", () => {
  it("Status is the first field in the edit form array so the dropdown has room to expand", () => {
    // The array of form fields starts with { id: "edit-status" ...}.
    // If Status drifts back to the end, the native <select> dropdown will be
    // clipped by the bottom of the screen when the user scrolls down.
    const arrayStart = vaultPage.indexOf('"edit-status"');
    const nextField = vaultPage.indexOf('"edit-plant-type"');

    expect(arrayStart).toBeGreaterThan(-1);
    expect(nextField).toBeGreaterThan(-1);
    expect(arrayStart).toBeLessThan(nextField);
  });

  it("edit-status appears before edit-variety-name in the form", () => {
    const statusPos = vaultPage.indexOf('"edit-status"');
    const varietyPos = vaultPage.indexOf('"edit-variety-name"');
    expect(statusPos).toBeLessThan(varietyPos);
  });

  it("edit-status appears before edit-planting-window in the form", () => {
    const statusPos = vaultPage.indexOf('"edit-status"');
    const windowPos = vaultPage.indexOf('"edit-planting-window"');
    expect(statusPos).toBeLessThan(windowPos);
  });
});

// ---------------------------------------------------------------------------
// Bug 2: Save button hidden behind bottom nav
// ---------------------------------------------------------------------------
describe("Edit Plant Profile modal — backdrop clearance for bottom nav (Bug 2 regression)", () => {
  it("modal backdrop uses pb-20 on mobile to clear the fixed bottom navigation bar", () => {
    // pb-0 caused the Save Changes button to be hidden behind the 64px BottomNav.
    // pb-20 = 80px, which clears h-16 (64px) + safe-area-inset.
    expect(vaultPage).toContain("pb-20");
  });

  it("modal backdrop does not use pb-0 alongside items-end", () => {
    // The bad pattern was: `flex items-end ... pb-0 sm:pb-4`
    // Any match of items-end followed (within 80 chars) by pb-0 is the regression.
    const badPattern = /items-end.{0,80}pb-0/s;
    expect(vaultPage).not.toMatch(badPattern);
  });

  it("modal card uses max-h-[calc(100dvh-6rem)] to fit within the padded backdrop", () => {
    // 6rem = 1rem (p-4 top) + 5rem (pb-20 bottom).
    // Removing this causes the modal to overflow and push the Save button off-screen.
    expect(vaultPage).toContain("max-h-[calc(100dvh-6rem)]");
  });

  it("desktop modal card retains sm:max-h-[90vh] for larger screens", () => {
    expect(vaultPage).toContain("sm:max-h-[90vh]");
  });
});

// ---------------------------------------------------------------------------
// BottomNav height guard — if nav height changes, modal clearance must be updated
// ---------------------------------------------------------------------------
describe("BottomNav height (informs required modal clearance)", () => {
  it("BottomNav inner container is h-16 (64px) — update pb-* in edit modal if this changes", () => {
    // The modal uses pb-20 (80px) to clear this nav.
    // If the nav grows (e.g. h-20), pb-20 may no longer be enough.
    expect(bottomNav).toContain("h-16");
  });

  it("BottomNav is fixed to the bottom of the screen", () => {
    expect(bottomNav).toContain("fixed bottom-0");
  });

  it("BottomNav has a z-index that overlaps page content (z-50)", () => {
    // Both nav and modal are z-50; the nav must not silently drop to a lower
    // z-index or the Save button clipping bug could reappear in a different form.
    expect(bottomNav).toContain("z-50");
  });
});
