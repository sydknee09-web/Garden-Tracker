/**
 * Regression tests for My Plants batch selection (mirror Active Garden).
 *
 * Covers:
 *  - Garden page FAB: orange >> icon when plants/active tab has selections; opens selection menu
 *  - MyPlantsView: BatchLogSheet, Selecting bar, bulk delete, handlers
 *  - openBulkLogRequest timing guard: only open when selected plants exist (not while loading)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const gardenPage = readFileSync(join(ROOT, "src/app/garden/page.tsx"), "utf-8");
const myPlantsView = readFileSync(join(ROOT, "src/components/MyPlantsView.tsx"), "utf-8");

// ---------------------------------------------------------------------------
// Garden page — FAB >> for selections (Active Garden + My Plants unified)
// ---------------------------------------------------------------------------
describe("Garden page — FAB shows orange >> when selections exist", () => {
  it("FAB with selections opens selection menu; Journal opens BatchLogSheet", () => {
    expect(gardenPage).toContain("effectiveViewMode === \"plants\" && plantsBatchSelectMode && selectedPlantGrows.length > 0");
    expect(gardenPage).toContain("setOpenBulkLogForPlants");
    expect(gardenPage).toContain("selectionActionsOpen");
  });

  it("FAB icon shows >> when plants or active tab has selections", () => {
    expect(gardenPage).toContain("(effectiveViewMode === \"active\" && bulkModeActive && bulkSelectedCount > 0) || (effectiveViewMode === \"plants\" && plantsBatchSelectMode && selectedPlantGrows.length > 0)");
  });

  it("FAB is hidden when plants tab in selection mode but zero selected", () => {
    expect(gardenPage).toContain("effectiveViewMode === \"plants\" && plantsBatchSelectMode && selectedPlantGrows.length === 0");
  });

  it("MyPlantsView receives openBulkLogRequest and onBulkLogRequestHandled", () => {
    expect(gardenPage).toContain("openBulkLogRequest={openBulkLogForPlants}");
    expect(gardenPage).toContain("onBulkLogRequestHandled");
  });
});

// ---------------------------------------------------------------------------
// MyPlantsView — openBulkLogRequest timing guard
// ---------------------------------------------------------------------------
describe("MyPlantsView — openBulkLogRequest timing guard", () => {
  it("Only opens BatchLogSheet when selected plants exist in plants array", () => {
    expect(myPlantsView).toContain("const selected = plants.filter((p) => selectedGrowIds.has(p.id))");
    expect(myPlantsView).toContain("if (selected.length > 0)");
  });

  it("Resets parent when no selected plants (avoids stuck state)", () => {
    expect(myPlantsView).toContain("onBulkLogRequestHandled?.()");
  });

  it("Shows Loading toast when plants still loading and request received", () => {
    expect(myPlantsView).toContain("Loading plants…");
    expect(myPlantsView).toContain("plants.length === 0");
  });
});

// ---------------------------------------------------------------------------
// MyPlantsView — card tap navigation
// ---------------------------------------------------------------------------
describe("MyPlantsView — card tap navigation", () => {
  it("Short tap navigates to vault profile with from=garden&gardenTab=plants", () => {
    expect(myPlantsView).toContain("router.push(`/vault/${profileId}?from=garden&gardenTab=plants`)");
  });

  it("Does NOT navigate to the grow popup (/garden?grow=) on short tap", () => {
    expect(myPlantsView).not.toContain("/garden?tab=plants&grow=");
  });
});

// ---------------------------------------------------------------------------
// MyPlantsView — Batch select state and handlers
// ---------------------------------------------------------------------------
describe("MyPlantsView — batch select state and handlers", () => {
  it("batchLogOpen and batchLogBatches state exist", () => {
    expect(myPlantsView).toContain("batchLogOpen");
    expect(myPlantsView).toContain("batchLogBatches");
  });

  it("handleQuickTap creates journal entry with entry_type quick", () => {
    expect(myPlantsView).toContain("handleQuickTap");
    expect(myPlantsView).toContain('entry_type: "quick"');
  });

  it("handleBulkQuickTap creates journal entries for multiple plants", () => {
    expect(myPlantsView).toContain("handleBulkQuickTap");
    expect(myPlantsView).toContain("insertManyWithOfflineQueue");
  });

  it("handleDeleteBatch uses soft delete (Law 2)", () => {
    expect(myPlantsView).toContain("handleDeleteBatch");
    expect(myPlantsView).toContain("deleted_at");
  });

  it("handleEndBatch archives or marks dead with journal entry", () => {
    expect(myPlantsView).toContain("handleEndBatch");
    expect(myPlantsView).toContain("status");
    expect(myPlantsView).toContain("ended_at");
  });

  it("handleBulkDelete soft-deletes selected grow_instances", () => {
    expect(myPlantsView).toContain("handleBulkDelete");
    expect(myPlantsView).toContain("softDeleteTasksForGrowInstance");
  });
});

// ---------------------------------------------------------------------------
// MyPlantsView — BatchLogSheet and Selecting bar
// ---------------------------------------------------------------------------
describe("MyPlantsView — BatchLogSheet and Selecting bar", () => {
  it("BatchLogSheet is rendered with isPermanent", () => {
    expect(myPlantsView).toContain("<BatchLogSheet");
    expect(myPlantsView).toContain("isPermanent={true}");
  });

  it("Selecting bar shows when batchSelectMode and items selected", () => {
    expect(myPlantsView).toContain("batchSelectMode && selectedGrowIds.size > 0");
    expect(myPlantsView).toContain("Selecting (");
  });

  it("Bulk delete confirmation modal exists", () => {
    expect(myPlantsView).toContain("bulkDeleteConfirmOpen");
    expect(myPlantsView).toContain("Delete ");
    expect(myPlantsView).toContain("plant");
  });

  it("Single delete confirmation modal exists", () => {
    expect(myPlantsView).toContain("deleteBatchTarget");
    expect(myPlantsView).toContain("Delete Planting");
  });
});
