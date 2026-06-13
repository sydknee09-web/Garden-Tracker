/**
 * Regression tests — pencil edit affordance + Edit Plant menu restructure
 * (Syd lock 2026-06-11, dogfood Findings #12 + #13).
 *
 * Locks guarded here:
 *  1. EditGrowModal is the single canonical planting editor (NORTH_STAR "No
 *     duplicate paths") — both hosts (instance page chrome strip pencil + vault
 *     profile Plantings tab) open it; the vault page's old inline modal is gone.
 *  2. Archive Planting is the merged archive/end flow: reason dialog → status
 *     'archived' + ended_at + end_reason, then task soft-delete cascade + profile
 *     status revert. The old standalone "Archive Plant" chrome pill is gone.
 *  3. Delete Planting is high-friction (type the plant name to confirm) and
 *     CASCADES: journal entries + tasks soft-deleted with the grow row.
 *  4. No user-visible "batch" vocab remains in the edit flow (Finding #13C).
 *  5. Field-set expansion: sow method (seasonal), expected harvest (edible),
 *     quantity purchased (permanent) — gated so hidden fields never clobber.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const editGrowModal = read("src/components/EditGrowModal.tsx");
const instanceModal = read("src/components/GrowInstanceModal.tsx");
const vaultProfile = read("src/app/library/[id]/page.tsx");
const plantingsHandlers = read("src/app/library/[id]/useVaultPlantingsHandlers.ts");

// ---------------------------------------------------------------------------
// 1. Pencil affordance + single canonical editor
// ---------------------------------------------------------------------------
describe("Pencil edit affordance (Finding #12)", () => {
  it("instance chrome strip renders an icon-only pencil that opens the edit menu", () => {
    expect(instanceModal).toContain("ICON_MAP.Pencil");
    expect(instanceModal).toContain('aria-label="Edit plant"');
    expect(instanceModal).toContain("setEditOpen(true)");
  });

  it("the standalone Archive Plant chrome pill is gone (archive moved into the menu)", () => {
    expect(instanceModal).not.toContain('aria-label="Archive this plant"');
    expect(instanceModal).not.toContain(">Archive Plant<");
  });

  it("profile header edit button uses the canonical pencil glyph", () => {
    const headerBtn = vaultProfile.match(/aria-label="Edit profile"[^<]*<ICON_MAP\.(\w+)/);
    expect(headerBtn).not.toBeNull();
    expect(headerBtn![1]).toBe("Pencil");
  });

  it("both hosts mount the shared EditGrowModal", () => {
    expect(instanceModal).toContain("<EditGrowModal");
    expect(vaultProfile).toContain("<EditGrowModal");
    expect(plantingsHandlers).not.toContain("handleEditGrowSave");
  });

  it("instance page swipe guard tracks the edit menu", () => {
    expect(instanceModal).toContain("editOpen || batchLogOpen");
  });
});

// ---------------------------------------------------------------------------
// 2. Archive Planting — merged flow with full cascade
// ---------------------------------------------------------------------------
describe("Archive Planting (merged archive/end flow)", () => {
  it("writes the 2-state terminal status with ended_at + end_reason", () => {
    expect(editGrowModal).toContain('{ status: "archived", ended_at: now, end_reason: archiveReason }');
  });

  it("cascades: soft-deletes tasks and reverts profile status", () => {
    expect(editGrowModal).toContain("softDeleteTasksForGrowInstance(grow.id, ownerId)");
    expect(editGrowModal).toContain("revertProfileStatusIfNoActiveGrows(supabase, grow.plant_profile_id)");
  });

  it("preserves the death journal entry path", () => {
    expect(editGrowModal).toContain('entry_type: isDead ? "death" : "note"');
  });

  it("keeps the amber warning treatment + reason radios", () => {
    expect(editGrowModal).toContain("Archive Planting");
    expect(editGrowModal).toContain("border-amber-200/80 text-amber-700");
    expect(editGrowModal).toContain('value: "season_ended"');
    expect(editGrowModal).toContain('value: "harvested_all"');
    expect(editGrowModal).toContain('value: "plant_died"');
  });
});

// ---------------------------------------------------------------------------
// 3. Delete Planting — high-friction confirm + journal cascade
// ---------------------------------------------------------------------------
describe("Delete Planting (type-name confirm + cascade)", () => {
  it("delete button is disabled until the typed name matches", () => {
    expect(editGrowModal).toContain("deleteNameInput.trim().toLowerCase() === profileName.trim().toLowerCase()");
    expect(editGrowModal).toContain("disabled={!deleteNameMatches || deleteSaving}");
  });

  it("soft-deletes linked journal entries BEFORE the grow row (bulk-delete sibling order)", () => {
    const journalCascade = editGrowModal.indexOf('updateWithOfflineQueue("journal_entries", { deleted_at: now }, { grow_instance_id: grow.id, user_id: ownerId })');
    const growDelete = editGrowModal.indexOf('updateWithOfflineQueue("grow_instances", { deleted_at: now }, { id: grow.id, user_id: ownerId })');
    expect(journalCascade).toBeGreaterThan(-1);
    expect(growDelete).toBeGreaterThan(journalCascade);
  });

  it("uses alertdialog semantics and the destructive token", () => {
    expect(editGrowModal).toContain('role="alertdialog"');
    expect(editGrowModal).toContain("bg-red-600 text-white font-medium text-sm hover:bg-red-700");
  });
});

// ---------------------------------------------------------------------------
// 4. Vocab — no user-visible "batch" in the edit flow (Finding #13C)
// ---------------------------------------------------------------------------
describe("Planting vocab (no batch leak)", () => {
  it("EditGrowModal has zero user-visible batch strings", () => {
    expect(editGrowModal).not.toMatch(/[Bb]atch/);
  });

  it("vault profile page no longer renders End Batch / Delete Batch dialogs", () => {
    expect(vaultProfile).not.toContain("End Batch");
    expect(vaultProfile).not.toContain("Delete Batch");
    expect(vaultProfile).not.toContain("End batch");
    expect(vaultProfile).not.toContain("Delete batch");
  });
});

// ---------------------------------------------------------------------------
// 5. Field-set expansion (Finding #13) — gated so hidden fields never clobber
// ---------------------------------------------------------------------------
describe("Edit Plant field-set expansion", () => {
  it("sow method dropdown exists and only writes for seasonal plantings", () => {
    expect(editGrowModal).toContain('id="edit-grow-sow-method"');
    expect(editGrowModal).toMatch(/if \(!isPermanent\) \{\s*patch\.sow_method/);
  });

  it("expected harvest date exists and only writes for edible profiles", () => {
    expect(editGrowModal).toContain('id="edit-grow-expected-harvest"');
    expect(editGrowModal).toMatch(/if \(isEdible\) \{\s*patch\.expected_harvest_date/);
  });

  it("quantity purchased exists and only writes for permanent plantings", () => {
    expect(editGrowModal).toContain('id="edit-grow-purchase-qty"');
    expect(editGrowModal).toContain("patch.purchase_quantity");
  });

  it("Edit Photo entry opens the CoverPhotoSheet picker (TODO placeholder replaced — Cover Photo ship)", () => {
    expect(editGrowModal).toContain("Edit Photo");
    expect(editGrowModal).not.toContain("Cover photo editing is coming in an upcoming update.");
    expect(editGrowModal).toContain("<CoverPhotoSheet");
    expect(editGrowModal).toContain("setPhotoSheetOpen(true)");
  });

  it("Edit Photo button uses the compact camera-icon treatment ported from Plant Profile (#16b cohesion)", () => {
    // Compact outlined + camera icon, matching src/app/library/[id]/page.tsx Plant Profile photo button.
    expect(editGrowModal).toContain("ICON_MAP.Camera");
    expect(editGrowModal).toMatch(/inline-flex items-center gap-2[^"]*rounded-xl border border-neutral-300/);
  });

  it("cover changes refetch the host but keep the edit menu open (onCoverChanged, no onClose)", () => {
    expect(editGrowModal).toContain("onCoverChanged?.()");
    expect(editGrowModal).toContain('showToast("Cover photo updated.")');
    expect(instanceModal).toContain("onCoverChanged={() => loadData()}");
    expect(vaultProfile).toContain("onCoverChanged={() => loadProfile()}");
  });

  it("save goes through the offline queue with owner-scoped match", () => {
    expect(editGrowModal).toContain('updateWithOfflineQueue("grow_instances", patch, { id: grow.id, user_id: ownerId })');
  });
});
