/**
 * Regression tests for U24 — silent-failure pattern in bulk-end handlers.
 *
 * Covers:
 *  - ActiveGardenView.handleBulkEndBatch: { data, error } destructure + .select("id") row-count check
 *    + console.error instrumentation + error toast + skip-revert-on-error
 *  - MyPlantsView.handleBulkEndBatch: { error } destructure from updateWithOfflineQueue
 *    + console.error instrumentation + error toast
 *  - GrowInstanceModal.handleArchive: showErrorToast on err + console.error instrumentation
 *  - Sibling cohesion: every bulk-handler error toast uses friendly+refresh wording;
 *    old "Some X failed — try again" strings removed.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const activeGardenView = readFileSync(join(ROOT, "src/components/ActiveGardenView.tsx"), "utf-8");
const myPlantsView = readFileSync(join(ROOT, "src/components/MyPlantsView.tsx"), "utf-8");
const growInstanceModal = readFileSync(join(ROOT, "src/components/GrowInstanceModal.tsx"), "utf-8");
const gardenPage = readFileSync(join(ROOT, "src/app/garden/page.tsx"), "utf-8");

describe("U24 — ActiveGardenView handleBulkEndBatch surfaces errors (no silent failure)", () => {
  it("destructures { data, error } from supabase update with .select('id')", () => {
    expect(activeGardenView).toContain("const { data, error } = await supabase");
    expect(activeGardenView).toContain('.select("id")');
  });

  it("treats error or zero-row match as failure", () => {
    expect(activeGardenView).toContain("if (error || !data || data.length === 0)");
  });

  it("instruments console.error with batchId for debug log capture", () => {
    expect(activeGardenView).toContain('console.error("ActiveGardenView.handleBulkEndBatch: update failed"');
  });

  it("surfaces error toast on failure path", () => {
    expect(activeGardenView).toContain("Couldn't end some plantings — please refresh and try again");
  });

  it("skips revertProfileStatusIfNoActiveGrows when hadError is true", () => {
    expect(activeGardenView).toContain("if (!hadError)");
  });
});

describe("U24 — MyPlantsView handleBulkEndBatch surfaces errors (no silent failure)", () => {
  it("destructures { error } from updateWithOfflineQueue inside bulk-end loop", () => {
    expect(myPlantsView).toContain('const { error } = await updateWithOfflineQueue("grow_instances", { status: "archived"');
  });

  it("instruments console.error with batchId for debug log capture", () => {
    expect(myPlantsView).toContain('console.error("MyPlantsView.handleBulkEndBatch: update failed"');
  });

  it("surfaces error toast on failure path", () => {
    expect(myPlantsView).toContain("Couldn't end some plantings — please refresh and try again");
  });
});

describe("U24 — GrowInstanceModal handleArchive surfaces errors (no silent failure)", () => {
  it("surfaces error toast via showErrorToast on archive failure", () => {
    expect(growInstanceModal).toContain("Couldn't archive — please try again");
    expect(growInstanceModal).toContain("showErrorToast");
  });

  it("instruments console.error for archive failures", () => {
    expect(growInstanceModal).toContain('console.error("GrowInstanceModal.handleArchive: update failed"');
  });
});

describe("U24 — sibling bulk-handler error toasts use friendly+refresh wording", () => {
  it("ActiveGardenView handleBulkDelete uses friendly+refresh wording", () => {
    expect(activeGardenView).toContain("Couldn't delete some plantings — please refresh and try again");
    expect(activeGardenView).not.toContain("Some deletions failed — try again");
  });

  it("ActiveGardenView moveSelectedToPermanentPlants uses friendly+refresh wording", () => {
    expect(activeGardenView).toContain("Couldn't move some plantings — please refresh and try again");
    expect(activeGardenView).not.toContain("Some moves failed — try again");
  });

  it("MyPlantsView handleBulkDelete uses friendly+refresh wording", () => {
    expect(myPlantsView).toContain("Couldn't delete some plantings — please refresh and try again");
    expect(myPlantsView).not.toContain("Some deletions failed — try again");
  });

  it("garden page handleMoveToGrowingGarden uses friendly+refresh wording", () => {
    expect(gardenPage).toContain("Couldn't move some plantings — please refresh and try again");
    expect(gardenPage).not.toContain("Some moves failed — try again");
  });
});
