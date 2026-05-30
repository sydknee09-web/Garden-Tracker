/**
 * Sprint 3 Ship B B2 — regression tests for the unified Garden tab.
 *
 * Replaces three pre-B2 test files (activeGardenBulkEnd, myPlantsBatchSelect,
 * myPlantsIconCohesion) — those asserted the dual-tab + dual-component split
 * that B2 dissolves.
 *
 * Covers:
 *  - Unified Garden page wires GardenView (no ActiveGardenView / MyPlantsView refs)
 *  - GardenView card-tap → /garden?grow=<id> (instance modal), NOT /vault/<id>
 *    (the Syd 2026-05-29 finding; My Plants used to route to profile page)
 *  - GroupTabs sub-tab primitive matches Vault sub-tab JSX shape (cohesion-by-aggregation)
 *  - URL migration: ?tab=active|plants → /garden one-time redirect on mount
 *  - sessionStorage migration: legacy "active"/"plants" → "all"
 *  - fetchAllUserGrowInstances is the data source (B1 helper)
 *  - Bulk-mode handle uses single gardenRef (not dual activeGardenRef + myPlantsRef)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const gardenPage = readFileSync(join(ROOT, "src/app/garden/page.tsx"), "utf-8");
const gardenView = readFileSync(join(ROOT, "src/components/GardenView.tsx"), "utf-8");
const groupTabs = readFileSync(join(ROOT, "src/components/GroupTabs.tsx"), "utf-8");
const navItems = readFileSync(join(ROOT, "src/components/navItems.tsx"), "utf-8");

// ---------------------------------------------------------------------------
// Garden page — uses unified GardenView, not the deleted dual components
// ---------------------------------------------------------------------------
describe("Garden page — unified GardenView wiring", () => {
  it("imports GardenView + GroupTabs from @/components", () => {
    expect(gardenPage).toContain('from "@/components/GardenView"');
    expect(gardenPage).toContain('from "@/components/GroupTabs"');
  });

  it("does NOT import the deleted ActiveGardenView or MyPlantsView", () => {
    expect(gardenPage).not.toContain("ActiveGardenView");
    expect(gardenPage).not.toContain("MyPlantsView");
  });

  it("renders a single GardenView with the unified prop set", () => {
    expect(gardenPage).toContain("<GardenView");
    expect(gardenPage).toContain("ref={gardenRef}");
    expect(gardenPage).toContain("groupFilter={effectiveGroup}");
  });

  it("uses a single gardenRef (not dual activeGardenRef + myPlantsRef)", () => {
    expect(gardenPage).toContain("const gardenRef = useRef<GardenViewHandle | null>(null)");
    expect(gardenPage).not.toContain("activeGardenRef");
    expect(gardenPage).not.toContain("myPlantsRef");
  });
});

// ---------------------------------------------------------------------------
// URL migration — legacy ?tab=active|plants → /garden one-time redirect
// ---------------------------------------------------------------------------
describe("Garden page — URL migration", () => {
  it("redirects legacy ?tab=active|plants to /garden on mount", () => {
    // The migration effect inspects tabParam and runs router.replace once.
    expect(gardenPage).toContain('tabParam === "active" || tabParam === "plants"');
    expect(gardenPage).toContain("hasMigratedTabParamRef");
    expect(gardenPage).toContain('router.replace(`/garden${qs}`)');
  });

  it("uses ?group=<id> as the canonical deep-link param (not ?tab=)", () => {
    expect(gardenPage).toContain('searchParams.get("group")');
    expect(gardenPage).toContain("`group=${encodeURIComponent");
  });

  it("preserves grow/profile/from params during the legacy redirect", () => {
    expect(gardenPage).toContain('preserved.push(`grow=${encodeURIComponent(growParam)}`)');
    expect(gardenPage).toContain('preserved.push(`profile=${encodeURIComponent(profileParam)}`)');
    expect(gardenPage).toContain('preserved.push(`from=${encodeURIComponent(fromParam)}`)');
  });
});

// ---------------------------------------------------------------------------
// sessionStorage migration — legacy "active"/"plants" deserialize → "all"
// ---------------------------------------------------------------------------
describe("Garden page — sessionStorage migration", () => {
  it("deserializes legacy active/plants values → \"all\"", () => {
    expect(gardenPage).toContain('s === "active" || s === "plants" ? "all"');
  });

  it("uses the new sessionStorage key 'garden-selected-group'", () => {
    expect(gardenPage).toContain('"garden-selected-group"');
  });

  it("URL group param wins over sessionStorage when both present", () => {
    // The effectiveGroup derives from URL groupParam first, fallback to selectedGroup.
    expect(gardenPage).toContain("groupParam || (tabParam === \"active\" || tabParam === \"plants\" ? \"all\" : selectedGroup)");
  });
});

// ---------------------------------------------------------------------------
// GardenView — unified data source + card-tap routing unification
// ---------------------------------------------------------------------------
describe("GardenView — unified data + routing", () => {
  it("consumes fetchAllUserGrowInstances from B1 (the unified data path)", () => {
    expect(gardenView).toContain('from "@/lib/groups"');
    expect(gardenView).toContain("fetchAllUserGrowInstances");
  });

  it("card-tap routes to /garden?grow=<id> (instance modal) in BOTH grid and list modes", () => {
    // Per Syd 2026-05-29 lock: unified card-tap → instance modal. Pre-B2, MyPlantsView
    // routed grid-card-taps to /vault/<profileId> (profile page) — that divergence is closed.
    const occurrences = (gardenView.match(/`\/garden\?grow=\$\{batch\.id\}`/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("does NOT route card-tap to /vault/<profileId> anywhere", () => {
    expect(gardenView).not.toContain("/vault/${profileId}");
    expect(gardenView).not.toContain("/vault/${batch.plant_profile_id}");
  });

  it("filters by selected group via instance.groups[] membership (client-side)", () => {
    expect(gardenView).toContain('groupFilter === "all"');
    expect(gardenView).toContain("b.groups.some((g) => g.id === groupFilter)");
  });

  it("exposes a unified imperative handle with both perennial-toggle actions", () => {
    expect(gardenView).toContain("moveSelectedToPermanentPlants");
    expect(gardenView).toContain("moveSelectedToGrowingGarden");
  });

  it("renders a Perennial pill for is_permanent_planting=true instances", () => {
    expect(gardenView).toContain("isPerennial");
    expect(gardenView).toContain("Perennial");
  });
});

// ---------------------------------------------------------------------------
// GroupTabs — Vault sub-tab primitive cohesion anchor
// ---------------------------------------------------------------------------
describe("GroupTabs — Vault sub-tab primitive cohesion", () => {
  it("uses Vault sub-tab JSX shape (rounded-xl p-1 bg-neutral-100, emerald-700 active)", () => {
    // Same shape as VaultPageContent.tsx:994 sub-tab. emerald-500 STATE token per VISION §8.
    expect(groupTabs).toContain('rounded-xl p-1 bg-neutral-100');
    expect(groupTabs).toContain('bg-white text-emerald-700 shadow-sm');
  });

  it("renders the All tab first, then user-defined groups", () => {
    expect(groupTabs).toContain("All");
    expect(groupTabs).toContain("groups.map((g)");
  });

  it("fetches groups via the B1 helper", () => {
    expect(groupTabs).toContain("fetchUserGroups");
  });

  it("falls back to 'all' when the currently-selected group disappears", () => {
    expect(groupTabs).toContain('onSelectGroup("all")');
  });
});

// ---------------------------------------------------------------------------
// navItems — bottom nav points at /garden (not legacy /garden?tab=active)
// ---------------------------------------------------------------------------
describe("Bottom nav — /garden (post-B2 clean URL)", () => {
  it("Garden tab href is /garden, not /garden?tab=active", () => {
    expect(navItems).toContain('href: "/garden",');
    expect(navItems).not.toContain('href: "/garden?tab=active"');
    expect(navItems).not.toContain('href: "/garden?tab=plants"');
  });
});
