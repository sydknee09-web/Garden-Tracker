/**
 * Regression test for /plants viewMode lock against sessionStorage restore drift.
 *
 * Bug (2026-05-29, caught by Syd dogfood):
 *   /plants is single-mode Library (viewMode force-locked to "grid"). VaultPageContent
 *   shares sessionStorage namespace ("vault-view-mode") with /vault. The mount-time
 *   restore effect read sessionStorage and called setViewMode(savedView) WITHOUT
 *   checking isPlantsSurface. If sessionStorage held "list" from a prior /vault?tab=list
 *   visit, the restore overrode the forced "grid" → /plants rendered the Packets
 *   surface (vendor name + qty stock overlay + "Search packets…" toolbar) instead of
 *   the Library encyclopedia. Self-healed on the next searchParams change, but the
 *   user never reached that because the page looked broken on landing.
 *
 * Invariant locked here: the savedView restore must be gated by !isPlantsSurface
 * so /plants always renders SeedVaultView mode="grid" regardless of sessionStorage
 * history. Other restore reads (gridDisplayStyle, packetDisplayStyle, status, search,
 * sort) remain unconditional — they're orthogonal sub-state and don't cause the bug.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

const vaultPageContent = readFileSync(
  join(ROOT, "src/app/vault/VaultPageContent.tsx"),
  "utf-8"
);

describe("/plants viewMode lock — restore effect must skip on isPlantsSurface", () => {
  it("savedView restore is gated by !isPlantsSurface", () => {
    // The structural assertion: somewhere in the file, the savedView restore
    // must be wrapped in an `if (!isPlantsSurface)` block. We look for the
    // savedView identifier near a !isPlantsSurface guard.
    const savedViewIdx = vaultPageContent.indexOf(
      'sessionStorage.getItem("vault-view-mode")'
    );
    expect(savedViewIdx).toBeGreaterThan(-1);

    // The guard must appear AFTER the savedView read (in the same restore effect block).
    // Slice a window forward from the read site and assert the guard is in it.
    const window = vaultPageContent.slice(savedViewIdx, savedViewIdx + 800);
    expect(window).toContain("if (!isPlantsSurface)");
  });

  it("setViewMode(savedView) only fires inside the !isPlantsSurface guard", () => {
    // Find the restore-effect savedView read site.
    const savedViewIdx = vaultPageContent.indexOf(
      'sessionStorage.getItem("vault-view-mode")'
    );
    expect(savedViewIdx).toBeGreaterThan(-1);

    // From the read site forward, the next setViewMode(savedView) call must
    // sit inside an `if (!isPlantsSurface)` block (no bare setViewMode before
    // the guard). We assert by walking forward and confirming the guard token
    // appears BEFORE the setViewMode(savedView) call.
    const window = vaultPageContent.slice(savedViewIdx, savedViewIdx + 800);
    const guardIdx = window.indexOf("if (!isPlantsSurface)");
    const setViewIdx = window.indexOf("setViewMode(savedView)");
    expect(guardIdx).toBeGreaterThan(-1);
    expect(setViewIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(setViewIdx);
  });

  it('legacy "table" → "list" migration also respects isPlantsSurface', () => {
    // The legacy "table" → "list" fallback was the second setViewMode call in
    // the restore block. It must also sit inside the !isPlantsSurface guard so
    // a stale legacy "table" value can't flip /plants to list either.
    const savedViewIdx = vaultPageContent.indexOf(
      'sessionStorage.getItem("vault-view-mode")'
    );
    const window = vaultPageContent.slice(savedViewIdx, savedViewIdx + 800);
    const guardIdx = window.indexOf("if (!isPlantsSurface)");
    const tableMigrationIdx = window.indexOf('savedView === "table"');
    expect(tableMigrationIdx).toBeGreaterThan(-1);
    expect(guardIdx).toBeLessThan(tableMigrationIdx);
  });

  it("init function forces viewMode='grid' when isPlantsSurface=true", () => {
    // Belt-and-suspenders: the init function (line ~128-136) must also force
    // grid on /plants. This is the first defense; the restore-effect guard
    // above is the second. Locking both prevents a future refactor from
    // silently breaking the lock.
    expect(vaultPageContent).toContain(
      "if (isPlantsSurface) return \"grid\""
    );
  });

  it("tab-sync effect re-forces viewMode='grid' when isPlantsSurface=true", () => {
    // Third defense: tab-sync effect (line ~370) re-forces grid on subsequent
    // searchParams changes. Verifies the if-isPlantsSurface branch exists.
    // Match the body of the branch directly to avoid coupling to formatting.
    expect(vaultPageContent).toContain("if (isPlantsSurface) {");
    expect(vaultPageContent).toContain('setViewMode("grid");');
  });
});
