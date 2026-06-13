/**
 * Sprint 3 — Growing-Instance Detail Page Conversion regression tests.
 *
 * The instance becomes the 4th detail surface on the real-page pattern (NORTH_STAR "No duplicate
 * paths"), reusing GrowInstanceModal via `variant="page"`. These source-level invariants lock the
 * conversion's load-bearing wiring so a later refactor can't silently regress it.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const instancePage = read("src/app/garden/grow/[id]/page.tsx");
const instanceModal = read("src/components/GrowInstanceModal.tsx");
const swipeOrder = read("src/lib/swipeOrder.ts");
const gardenView = read("src/components/GardenView.tsx");
const gardenPage = read("src/app/garden/page.tsx");
const packetPage = read("src/app/vault/packets/[id]/page.tsx");
const vaultProfile = read("src/app/library/[id]/page.tsx");
const calendarPage = read("src/app/calendar/page.tsx");

// ---------------------------------------------------------------------------
// The page wrapper reuses the modal content via variant="page" (Option C — no rebuild)
// ---------------------------------------------------------------------------
describe("Instance page — reuses GrowInstanceModal via variant prop", () => {
  it("renders <GrowInstanceModal variant=\"page\"> (single source of truth, no rebuild)", () => {
    expect(instancePage).toContain("<GrowInstanceModal");
    expect(instancePage).toContain('variant="page"');
  });

  it("is a real client route, not the legacy redirect-to-modal stub", () => {
    expect(instancePage).toContain('"use client"');
    expect(instancePage).not.toContain("/garden?grow=");
  });

  it("hosts the HarvestModal itself (no Garden parent to delegate to) and refetches on save", () => {
    expect(instancePage).toContain("<HarvestModal");
    expect(instancePage).toContain("setReloadKey");
    expect(instancePage).toContain("reloadKey={reloadKey}");
  });

  it("adds loading.tsx + error.tsx for sibling route parity", () => {
    expect(() => read("src/app/garden/grow/[id]/loading.tsx")).not.toThrow();
    expect(() => read("src/app/garden/grow/[id]/error.tsx")).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// GrowInstanceModal — variant gating (modal branch dormant but intact)
// ---------------------------------------------------------------------------
describe("GrowInstanceModal — variant gating", () => {
  it("accepts a variant prop defaulting to \"page\"", () => {
    expect(instanceModal).toMatch(/variant\?:\s*"modal"\s*\|\s*"page"/);
    expect(instanceModal).toMatch(/variant\s*=\s*"page"/);
  });

  it("gates focus-trap + Escape behind modal mode (page mode uses the real route)", () => {
    expect(instanceModal).toContain('useEscapeKey(variant === "modal"');
    expect(instanceModal).toContain('useFocusTrap(variant === "modal")');
  });

  it("notifies the wrapper when a sub-sheet opens (page-mode swipe guard)", () => {
    expect(instanceModal).toContain("onSubSheetOpenChange");
    expect(instanceModal).toContain("editOpen || batchLogOpen");
  });

  it("supports reloadKey to refetch in place after the wrapper's HarvestModal saves", () => {
    expect(instanceModal).toMatch(/reloadKey\?:\s*number/);
  });
});

// ---------------------------------------------------------------------------
// Filter-aware swipe — instances scope end-to-end
// ---------------------------------------------------------------------------
describe("Filter-aware swipe — instances scope", () => {
  it("swipeOrder declares the instances scope", () => {
    expect(swipeOrder).toContain('"instances"');
  });

  it("GardenView snapshots the filtered+sorted order under the instances scope", () => {
    expect(gardenView).toContain('useSwipeOrderSnapshot("instances"');
    expect(gardenView).toContain("sortedBatches.map");
  });

  it("the page reads the snapshot then falls back to status=growing, sown_date desc (Q4 lock)", () => {
    expect(instancePage).toContain('getSwipeOrder("instances"');
    expect(instancePage).toContain('.eq("status", "growing")');
    expect(instancePage).toContain('.order("sown_date", { ascending: false })');
  });

  it("reuses the 50px swipe threshold (cohesion — no new value)", () => {
    expect(instancePage).toContain("Math.abs(dx) < 50");
  });
});

// ---------------------------------------------------------------------------
// Callsite migration — every entry point reaches the real page
// ---------------------------------------------------------------------------
describe("Callsite migration — single path to the instance page", () => {
  it("Garden grid + list card-taps route to /garden/grow/<id>", () => {
    const occurrences = (gardenView.match(/`\/garden\/grow\/\$\{batch\.id\}`/g) ?? []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });

  it("Calendar care deep-link routes to the instance page", () => {
    expect(calendarPage).toContain("/garden/grow/${gid}?instanceTab=care&schedule=${sid}");
  });

  it("Packet 'Used in Plantings' passes from=packet context for Back", () => {
    expect(packetPage).toContain("/garden/grow/${gi.id}?from=packet&packetId=${pkt.id}");
  });

  it("Library profile peek navigates to the page (no read-only modal) with from=library context", () => {
    expect(vaultProfile).toContain("/garden/grow/${gi.id}?from=library&profileId=${id}");
    expect(vaultProfile).not.toContain("<GrowInstanceModal");
  });

  it("Garden page drops the modal render + redirects legacy ?grow= deep-links to the page", () => {
    expect(gardenPage).not.toContain("<GrowInstanceModal");
    expect(gardenPage).toContain("router.replace(`/garden/grow/${growParam}");
  });
});
