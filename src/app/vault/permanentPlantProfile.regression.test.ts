/**
 * Regression tests for:
 *
 *  1. §1.4 cross-links between Quick Log and the full journal entry form
 *     — QuickLogModal must contain a "Full journal entry" link to /journal/new
 *     — /journal/new must contain a back-reference to the Quick Log (Add → Add journal)
 *
 *  2. Vault profile tabs (Law 10)
 *     — All plant profiles show the same five tabs: About, Care, Packets, Plantings, Journal
 *     — isPermanent is derived from grow instances (has any permanent instance), not profile
 *     — The Care tab still receives isPermanent and profileType for content (CareSuggestions)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

const quickLogModal = readFileSync(
  join(ROOT, "src/components/QuickLogModal.tsx"),
  "utf-8"
);

const journalNewPage = readFileSync(
  join(ROOT, "src/app/journal/new/page.tsx"),
  "utf-8"
);

const vaultPage = readFileSync(
  join(ROOT, "src/app/vault/[id]/page.tsx"),
  "utf-8"
);

const careTab = readFileSync(
  join(ROOT, "src/app/vault/[id]/VaultProfileCareTab.tsx"),
  "utf-8"
);

// ---------------------------------------------------------------------------
// §1.4 — Quick Log ↔ Full journal entry cross-links
// ---------------------------------------------------------------------------
describe("§1.4 — QuickLogModal: 'Full journal entry' cross-link", () => {
  it("contains a link to /journal/new labelled 'Full journal entry'", () => {
    expect(quickLogModal).toContain('href="/journal/new"');
    expect(quickLogModal).toContain("Full journal entry");
  });

  it("calls onClose when the Full journal entry link is clicked (prevents stale modal)", () => {
    expect(quickLogModal).toContain("onClick={onClose}");
  });

  it("the cross-link appears after the Submit button (in the footer area)", () => {
    const submitPos = quickLogModal.indexOf('type="submit"');
    const linkPos = quickLogModal.indexOf('href="/journal/new"');
    expect(submitPos).toBeGreaterThan(-1);
    expect(linkPos).toBeGreaterThan(-1);
    expect(linkPos).toBeGreaterThan(submitPos);
  });
});

describe("§1.4 — /journal/new: back-reference to Quick Log", () => {
  it("contains guidance pointing users back to Quick Log for simple notes", () => {
    expect(journalNewPage).toContain("Add journal");
  });

  it("the back-reference appears near the page heading (before the form fields)", () => {
    const headingPos = journalNewPage.indexOf("Add Journal Entry");
    const referencePos = journalNewPage.indexOf("Add journal");
    expect(headingPos).toBeGreaterThan(-1);
    expect(referencePos).toBeGreaterThan(-1);
    // reference should appear close to heading, not buried at the bottom
    expect(referencePos - headingPos).toBeLessThan(500);
  });
});

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
