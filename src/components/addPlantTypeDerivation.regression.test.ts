/**
 * Add Plant type derivation — regression guards.
 *
 * History:
 * - Ship 4 (Finding 29): removed the "[ My Plants | Active Garden ]" entry-point toggle;
 *   moved permanent/seasonal to an inline "Plant type" control in AddPlantModal's add-new body.
 * - 2026-06-10 sweep (Syd dogfood): removed that inline control AND review-import's
 *   Permanent/Seasonal picker. Creation flows no longer ask the user for a type at all —
 *   the AI-filled lifecycle derives profile_type (B6 mapping: Annual → "seed",
 *   Biennial/Perennial → "permanent") and the add-new path corrects is_permanent_planting
 *   + gates care templates / harvest task on the derived type.
 *
 * These are source-text regression guards — the repo pattern for derivation that the
 * 300-line multi-table add-plant submit can't assert cheaply behaviorally
 * (cf. permanentPlantProfile.regression.test.ts, gardenView.regression.test.ts).
 *
 * Plan-doc: .claude/plans/remove_seasonal_permanent_toggle_sweep.md
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const addPlantModal = readFileSync(join(ROOT, "src/components/AddPlantModal.tsx"), "utf-8");
const universalAddMenu = readFileSync(join(ROOT, "src/components/UniversalAddMenu.tsx"), "utf-8");
const purchaseOrderImport = readFileSync(join(ROOT, "src/components/PurchaseOrderImport.tsx"), "utf-8");
const reviewImport = readFileSync(join(ROOT, "src/app/vault/review-import/page.tsx"), "utf-8");
const enrichLib = readFileSync(join(ROOT, "src/lib/enrichProfileFromName.ts"), "utf-8");

describe("Add Plant creation flows — Seasonal/Permanent toggle removed (2026-06-10 sweep)", () => {
  // Test 1 — the inline Plant type control is gone from AddPlantModal; no UI sets plantType.
  it("AddPlantModal renders no Seasonal/Permanent toggle", () => {
    expect(addPlantModal).not.toContain('onClick={() => setPlantType("permanent")}');
    expect(addPlantModal).not.toContain('onClick={() => setPlantType("seasonal")}');
    expect(addPlantModal).not.toContain("Perennial, tree, or shrub = permanent");
  });

  // Test 2 — add-new inserts the seed default and lets AI derive the type:
  // enrichment is awaited with deriveProfileType, then the derived profile_type
  // corrects is_permanent_planting (permanent) or runs care templates + harvest task.
  it("add-new defers type to AI-derived lifecycle (deriveProfileType + post-enrichment branch)", () => {
    expect(addPlantModal).not.toContain('profileType: plantType === "permanent" ? "permanent" : "seed"');
    expect(addPlantModal).toContain("deriveProfileType: true,");
    expect(addPlantModal).toContain("await runEnrichment();");
    expect(addPlantModal).not.toContain("void runEnrichment();");
    const derivedFetch = addPlantModal.indexOf('.select("harvest_days, profile_type").eq("id", profileId)');
    const permanentFixup = addPlantModal.indexOf('.update({ is_permanent_planting: true }).eq("id", growInstanceIdNew)');
    const careCopy = addPlantModal.indexOf("copyCareTemplatesToInstance(profileId, growInstanceIdNew");
    expect(derivedFetch).toBeGreaterThan(-1);
    expect(permanentFixup).toBeGreaterThan(derivedFetch);
    expect(careCopy).toBeGreaterThan(derivedFetch);
  });

  // Test 3 — link-to-existing still derives is_permanent_planting from the selected
  // profile's profile_type (DB fetch), unchanged by the sweep (Ship 4 invariant).
  it("link-to-existing derives is_permanent_planting from the profile's profile_type", () => {
    expect(addPlantModal).toContain('.select("harvest_days, profile_type")');
    expect(addPlantModal).toContain(
      'const isPermanentExisting = typedProfileRow?.profile_type === "permanent"'
    );
    expect(addPlantModal).toContain("is_permanent_planting: isPermanentExisting,");
  });

  // Test 4 — the enrichment lib writes lifecycle and derives profile_type ONLY when
  // opted in, so packet/variety flows (QuickAddSeed, AddVarietyModal, PlantingForm)
  // never flip an existing profile_type.
  it("enrichProfileFromName derivation is opt-in (deriveProfileType flag, B6 mapping)", () => {
    expect(enrichLib).toContain("deriveProfileType = false");
    expect(enrichLib).toContain("updates.lifecycle = aiLifecycle;");
    expect(enrichLib).toContain('updates.profile_type = aiLifecycle === "Annual" ? "seed" : "permanent";');
  });

  // Test 5 — Ship 4 invariants still hold: no entry-point toggle / establishedMode revival.
  it("entry-point toggle + establishedMode stay removed from UniversalAddMenu", () => {
    expect(universalAddMenu).not.toContain("establishedMode");
    expect(universalAddMenu).not.toContain("My Plants");
    expect(universalAddMenu).not.toContain("Active Garden");
    expect(universalAddMenu).not.toContain('setAddPlantDefaultType("permanent")');
    expect(addPlantModal).not.toContain("establishedMode");
  });
});

describe("Review-import (PO/photo Add Plant) — Permanent/Seasonal picker removed", () => {
  // The step-1 review page no longer asks for a type (Syd dogfood 2026-06-10).
  it("review-import renders no Permanent/Seasonal picker", () => {
    expect(reviewImport).not.toContain('onClick={() => setDefaultProfileType("permanent")}');
    expect(reviewImport).not.toContain('onClick={() => setDefaultProfileType("seed")}');
  });

  // Post-save fill-blanks corrects profile_type from the AI lifecycle in addPlantMode only.
  it("review-import forwards deriveProfileType to fill-blanks in addPlantMode", () => {
    expect(reviewImport).toContain("...(addPlantMode && { deriveProfileType: true })");
  });

  // Ship 4 scope-gap invariants: PO input step has no type toggle either.
  it("PurchaseOrderImport stays toggle-free", () => {
    expect(purchaseOrderImport).not.toContain("My Plants");
    expect(purchaseOrderImport).not.toContain("Active Garden");
    expect(purchaseOrderImport).not.toContain("setProfileType");
    expect(purchaseOrderImport).toContain('source: "purchase_order", defaultProfileType, addPlantMode');
  });
});
