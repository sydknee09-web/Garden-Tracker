/**
 * Layout regression tests — form-modal footers must stay reachable above the BottomNav.
 *
 * Bug class (Syd dogfood 2026-06-10): BottomNav is `fixed bottom-0 z-50` and renders AFTER
 * page content (AuthGuard), so any modal overlay at z-50 whose sheet extends into the bottom
 * ~64-80px band gets its Save/Cancel footer painted over by the nav — visible fields end at
 * the last input and the buttons are untappable. The footer is outside the scroll container,
 * so no amount of scrolling reaches it.
 *
 * Fixes locked here:
 *  1. EditPacketModal — full-height sheet goes ABOVE the nav (z-[60], the established
 *     form-modal tier shared by AddPlantModal / QuickLogModal / NewTaskModal et al.)
 *     + safe-area padding on the sticky footer.
 *  2. vault/[id] editGrow "Edit Plant" modal — same z fix PLUS structural fix: the sheet
 *     was one big `overflow-y-auto` with Save/Cancel at the end of the scroll content;
 *     now a flex-col shell with pinned header + scrolling body + flex-shrink-0 footer.
 *  3. vault/import "New Plant Detected" dialog — items-end sheet had only pb-4 clearance,
 *     so its footer sat inside the nav band at z-50; now pb-20 (the documented carve-out,
 *     see vaultEditModal.layout.test.ts Bug 2).
 *
 * Plus the Packets-tab action parity wiring (NORTH_STAR "No duplicate paths"):
 *  4. VaultProfilePacketsTab rows carry the same Edit + Journal icon-button primitive as
 *     the Plants tab cards, and QuickLogModal can link an entry to a seed packet.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const editPacketModal = read("src/components/EditPacketModal.tsx");
const vaultProfile = read("src/app/library/[id]/page.tsx");
const editGrowModal = read("src/components/EditGrowModal.tsx");
const packetsTab = read("src/app/library/[id]/VaultProfilePacketsTab.tsx");
const quickLog = read("src/components/QuickLogModal.tsx");
const importPage = read("src/app/vault/import/page.tsx");

// ---------------------------------------------------------------------------
// 1. EditPacketModal — footer above nav + sticky-footer shell intact
// ---------------------------------------------------------------------------
describe("EditPacketModal — Save/Cancel reachable above BottomNav", () => {
  it("overlay sits above the z-50 BottomNav (z-[60] form-modal tier)", () => {
    expect(editPacketModal).toContain('fixed inset-0 z-[60]');
    expect(editPacketModal).not.toContain("fixed inset-0 z-50");
  });

  it("keeps the flex-col shell with a scrolling body (footer outside the scroll region)", () => {
    expect(editPacketModal).toContain("overflow-hidden flex flex-col");
    expect(editPacketModal).toContain("flex-1 overflow-y-auto");
  });

  it("footer is flex-shrink-0 with safe-area inset padding", () => {
    expect(editPacketModal).toContain(
      "flex-shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
    );
  });
});

// ---------------------------------------------------------------------------
// 2. EditGrowModal "Edit Plant" — sticky footer + z fix (extracted 2026-06-11 from
//    the vault/[id] inline modal; shared with the instance page's pencil affordance)
// ---------------------------------------------------------------------------
describe("EditGrowModal Edit Plant — sticky footer above BottomNav", () => {
  it("overlay uses z-[60] (was z-50, occluded by the nav)", () => {
    const overlay = editGrowModal.match(/className="fixed inset-0 [^"]*"[^>]*aria-labelledby="edit-grow-title"/);
    expect(overlay).not.toBeNull();
    expect(overlay![0]).toContain("z-[60]");
  });

  it("sheet is a flex-col shell, not one big overflow-y-auto scroll region", () => {
    // The old broken shape put Save/Cancel at the end of the scroll content.
    expect(editGrowModal).toContain("overflow-hidden flex flex-col");
    expect(editGrowModal).toContain("flex-1 overflow-y-auto");
    expect(editGrowModal).toContain("flex-shrink-0 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]");
  });

  it("both hosts render the shared component (no inline duplicate left on the vault page)", () => {
    expect(vaultProfile).toContain("<EditGrowModal");
    expect(vaultProfile).not.toContain('id="edit-grow-title"');
  });
});

// ---------------------------------------------------------------------------
// 3. vault/import "New Plant Detected" dialog — nav clearance
// ---------------------------------------------------------------------------
describe("Import New Plant dialog — backdrop clears BottomNav", () => {
  it("uses pb-20 on mobile (pb-4 left the sticky footer inside the z-50 nav band)", () => {
    const overlay = importPage.match(/className="fixed inset-0 z-50 [^"]*"[^>]*aria-labelledby="new-plant-dialog-title"/);
    expect(overlay).not.toBeNull();
    expect(overlay![0]).toContain("pb-20");
    expect(overlay![0]).not.toMatch(/pb-4 sm:pb-4/);
  });
});

// ---------------------------------------------------------------------------
// 4. Packets-tab action parity (NORTH_STAR "No duplicate paths")
// ---------------------------------------------------------------------------
describe("Profile Packets tab — Edit + Journal actions match Plants tab primitive", () => {
  it("rows expose both inline actions with the sibling-canonical aria-labels", () => {
    expect(packetsTab).toContain('aria-label="Edit packet"');
    expect(packetsTab).toContain('aria-label="Add journal entry"');
    expect(packetsTab).toContain("ICON_MAP.Edit");
    expect(packetsTab).toContain("ICON_MAP.Journal");
  });

  it("action buttons are siblings of the row Link, not nested inside it (valid HTML)", () => {
    // The Link must close before the canEdit action block begins.
    const linkClose = packetsTab.indexOf("</Link>");
    const actionBlock = packetsTab.indexOf("onEditPacket(pkt)");
    expect(linkClose).toBeGreaterThan(-1);
    expect(actionBlock).toBeGreaterThan(linkClose);
  });

  it("vault profile page wires the actions (editor modal + packet-linked journal)", () => {
    expect(vaultProfile).toContain("onEditPacket={(pkt) => setEditPacketId(pkt.id)}");
    expect(vaultProfile).toContain("setQuickLogPacketId(pkt.id)");
    expect(vaultProfile).toContain("useModalBackClose(!!editPacketId");
    expect(vaultProfile).toContain("preSelectedPacketId={quickLogPacketId ?? undefined}");
  });
});

// ---------------------------------------------------------------------------
// 5. QuickLogModal — seed packet linkage threaded to the insert
// ---------------------------------------------------------------------------
describe("QuickLogModal — preSelectedPacketId reaches the journal insert", () => {
  it("no longer hardcodes seed_packet_id: null", () => {
    expect(quickLog).not.toContain("seed_packet_id: null");
    expect(quickLog).toContain("seed_packet_id: preSelectedPacketId ?? null");
  });

  it("prop is declared on both the form and the modal shell and passed through", () => {
    const occurrences = quickLog.match(/preSelectedPacketId/g) ?? [];
    // 2 interface decls + form destructure + shell destructure + pass-through + insert + deps
    expect(occurrences.length).toBeGreaterThanOrEqual(6);
  });
});
