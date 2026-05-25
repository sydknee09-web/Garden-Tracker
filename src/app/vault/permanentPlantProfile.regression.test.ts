/**
 * Regression tests for:
 *
 *  1. Vault profile tabs (Law 10)
 *     — All plant profiles show the same five tabs: About, Care, Packets, Plantings, Journal
 *     — isPermanent is derived from grow instances (has any permanent instance), not profile
 *     — The Care tab still receives isPermanent and profileType for content (CareSuggestions)
 *
 *  Note: §1.4 cross-links (QuickLogModal "Full journal entry" link → /journal/new + the
 *  back-reference test) removed 2026-05-24 when /journal/new was deleted as part of FAB
 *  polish bundle 2 (X2 locked: QuickLog is the canonical journal-entry experience).
 *  See ROADMAP §6 2026-05-24 (latest) entry.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

const vaultPage = readFileSync(
  join(ROOT, "src/app/vault/[id]/page.tsx"),
  "utf-8"
);

const careTab = readFileSync(
  join(ROOT, "src/app/vault/[id]/VaultProfileCareTab.tsx"),
  "utf-8"
);

// ---------------------------------------------------------------------------
// Vault profile tabs — unified for all (Law 10)
// ---------------------------------------------------------------------------
describe("Vault profile — same five tabs for all profiles (Law 10)", () => {
  it("tab bar shows all five tabs: about, care, packets, plantings, journal", () => {
    expect(vaultPage).toContain('(["about","care","packets","plantings","journal"] as const)');
  });

  it("isPermanent is derived from grow instances (not profile_type)", () => {
    expect(vaultPage).toContain("growInstances.some");
    expect(vaultPage).toContain("is_permanent_planting");
  });

  it("no redirect effect that forces user off packets tab for permanent", () => {
    expect(vaultPage).not.toContain('if (isPermanent && activeTab === "packets") setActiveTab("care")');
  });
});

// ---------------------------------------------------------------------------
// Permanent plant profile — Care tab renders permanent-specific content
// ---------------------------------------------------------------------------
describe("Permanent plant profile — Care tab uses profileType='permanent'", () => {
  it("CareScheduleManager receives isPermanent prop when plant is permanent", () => {
    expect(careTab).toContain("isPermanent={isPermanent}");
  });

  it("permanent branch passes profileType='permanent' to CareSuggestions", () => {
    expect(careTab).toContain('profileType="permanent"');
  });

  it("seed branch passes profileType='seed' to CareSuggestions", () => {
    expect(careTab).toContain('profileType="seed"');
  });

  it("permanent branch does NOT show the seed-specific 'auto-copies when you plant' message", () => {
    // That message only applies when isPermanent is false
    const seedMsg = "auto-copies when you plant this variety";
    const seedBranchStart = careTab.indexOf("!isLegacy && !isPermanent");
    const permBranchStart = careTab.indexOf("!isLegacy && isPermanent");
    const msgPos = careTab.indexOf(seedMsg);
    expect(msgPos).toBeGreaterThan(seedBranchStart);
    expect(msgPos).toBeLessThan(permBranchStart);
  });
});
