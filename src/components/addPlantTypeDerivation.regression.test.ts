/**
 * Sprint 5 cont Ship 4 — Finding 29 regression guards (v1-blocking MUST).
 *
 * The "[ My Plants | Active Garden ]" entry-point toggle (which set the in-memory
 * addPlantDefaultType used to type every Manual add) was removed from UniversalAddMenu.
 * Its single responsibility — setting permanent/seasonal on the Manual add-new path —
 * moved to an inline "Plant type" control inside AddPlantModal's add-new body.
 * The link-to-existing path's is_permanent_planting now derives from the SELECTED
 * profile's profile_type (DB), not the toggle.
 *
 * These are source-text regression guards — the repo pattern for derivation that the
 * 300-line multi-table add-plant submit can't assert cheaply behaviorally
 * (cf. permanentPlantProfile.regression.test.ts, gardenView.regression.test.ts).
 *
 * Plan-doc: .claude/plans/add_plant_flow_restructure.md §"Forward-compat for Ship 4".
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const addPlantModal = readFileSync(join(ROOT, "src/components/AddPlantModal.tsx"), "utf-8");
const universalAddMenu = readFileSync(join(ROOT, "src/components/UniversalAddMenu.tsx"), "utf-8");
const purchaseOrderImport = readFileSync(join(ROOT, "src/components/PurchaseOrderImport.tsx"), "utf-8");
const reviewImport = readFileSync(join(ROOT, "src/app/vault/review-import/page.tsx"), "utf-8");

describe("Ship 4 — Add Plant type derivation (Finding 29 toggle removal)", () => {
  // Test 1 — Manual add-new derives profile_type + is_permanent_planting from the inline plantType.
  // Permanent → profile_type "permanent" + is_permanent_planting true.
  it("add-new derives profile_type + is_permanent_planting from the inline plantType", () => {
    expect(addPlantModal).toContain(
      'profileType: plantType === "permanent" ? "permanent" : "seed"'
    );
    expect(addPlantModal).toContain('is_permanent_planting: plantType === "permanent",');
  });

  // Test 2 — Seasonal add-new gets care templates + harvest task; permanent skips them
  // (both live inside `if (plantType === "seasonal")`, so permanent never reaches them).
  it("care-template copy + harvest task are seasonal-gated (permanent skips them)", () => {
    const seasonalGate = addPlantModal.indexOf('if (plantType === "seasonal") {');
    const careCopy = addPlantModal.indexOf("copyCareTemplatesToInstance(profileId, growInstanceIdNew");
    const harvestTask = addPlantModal.indexOf('category: "harvest"');
    expect(seasonalGate).toBeGreaterThan(-1);
    expect(careCopy).toBeGreaterThan(seasonalGate);
    expect(harvestTask).toBeGreaterThan(seasonalGate);
    // Permanent runs enrichment in the background and creates neither.
    expect(addPlantModal).toContain('if (plantType === "permanent") {');
    expect(addPlantModal).toContain("void runEnrichment();");
  });

  // Test 3 — link-to-existing derives is_permanent_planting from the selected profile's
  // profile_type (DB fetch), NOT the removed toggle / addPlantDefaultType.
  it("link-to-existing derives is_permanent_planting from the profile's profile_type", () => {
    expect(addPlantModal).toContain('.select("harvest_days, profile_type")');
    expect(addPlantModal).toContain(
      'const isPermanentExisting = typedProfileRow?.profile_type === "permanent"'
    );
    expect(addPlantModal).toContain("is_permanent_planting: isPermanentExisting,");
  });

  // Test 4 — The "Established Plant" entry + establishedMode were removed (Finding 30 minimal,
  // Syd dogfood 2026-06-01: "this page is a How not a what"). Acquisition was never a separate
  // entity — establishedMode only forced permanent + relabeled copy. The inline Plant type
  // control now renders unconditionally on the add-new path (no longer gated by establishedMode).
  it("Established Plant entry + establishedMode fully removed; inline type control unconditional", () => {
    expect(universalAddMenu).not.toContain("establishedMode");
    expect(universalAddMenu).not.toContain("add-plant-established");
    expect(universalAddMenu).not.toContain("Established Plant");
    expect(addPlantModal).not.toContain("establishedMode");
    expect(addPlantModal).not.toContain("{!establishedMode && (");
  });

  // Test 5 — the My Plants / Active Garden entry-point toggle is gone (no stale in-memory
  // type leak); the inline Plant type control is the replacement source of truth.
  it("entry-point toggle removed; inline Plant type control present", () => {
    expect(universalAddMenu).not.toContain("My Plants");
    expect(universalAddMenu).not.toContain("Active Garden");
    expect(universalAddMenu).not.toContain('setAddPlantDefaultType("permanent")');
    expect(universalAddMenu).not.toContain('setAddPlantDefaultType("seasonal")');
    expect(addPlantModal).toContain('onClick={() => setPlantType("permanent")}');
    expect(addPlantModal).toContain('onClick={() => setPlantType("seasonal")}');
  });
});

describe("Ship 4 scope-gap close — stale type toggle removed from PO sub-flow (Syd dogfood 2026-06-01)", () => {
  // The "[ My Plants | Active Garden ]" labels are post-Ship-B dead tab names. They survived in
  // the PurchaseOrderImport input step after Ship 4 removed the entry-point toggle. That input
  // toggle was redundant — it only seeded review-import's own (correctly-labeled) picker.
  it("PurchaseOrderImport no longer renders the stale My Plants / Active Garden toggle", () => {
    expect(purchaseOrderImport).not.toContain("My Plants");
    expect(purchaseOrderImport).not.toContain("Active Garden");
    // The vestigial local type state is gone; the prop flows straight through to review-import.
    expect(purchaseOrderImport).not.toContain("setProfileType");
    expect(purchaseOrderImport).toContain('source: "purchase_order", defaultProfileType, addPlantMode');
  });

  // Type determination still happens — once, with correct lifecycle labels — at the review step,
  // for BOTH the PO and Photo Add-Plant flows. This is the single source of truth post-fix.
  it("review-import retains the correctly-labeled Permanent / Seasonal picker", () => {
    expect(reviewImport).toContain('onClick={() => setDefaultProfileType("permanent")}');
    expect(reviewImport).toContain('onClick={() => setDefaultProfileType("seed")}');
    expect(reviewImport).toContain('is_permanent_planting: defaultProfileType === "permanent"');
  });
});
