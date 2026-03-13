/**
 * Regression tests for:
 *
 *  1. §1.4 cross-links between Quick Log and the full journal entry form
 *     — QuickLogModal must contain a "Full journal entry" link to /journal/new
 *     — /journal/new must contain a back-reference to the Quick Log (Add → Add journal)
 *
 *  2. Permanent plant profile_type tab handling
 *     — The tab bar must NOT show "Packets" for permanent plants
 *       (seed packets are meaningless for trees/perennials — Law 10)
 *     — A redirect effect must exist to move away from the "packets" tab
 *       for permanent plants (guards against direct URL navigation)
 *     — The Care tab must render permanent-specific content (profileType="permanent")
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
// Permanent plant profile — tab bar (Law 10)
// ---------------------------------------------------------------------------
describe("Permanent plant profile — Packets tab is hidden (Law 10)", () => {
  it("tab bar uses isPermanent to conditionally exclude the packets tab", () => {
    // The tab list for permanent plants should omit "packets"
    expect(vaultPage).toContain('isPermanent\n            ? (["about","care","plantings","journal"] as const)');
  });

  it("seed plants still get the full five-tab list including packets", () => {
    expect(vaultPage).toContain('["about","care","packets","plantings","journal"] as const');
  });

  it("a useEffect redirects away from 'packets' tab when isPermanent is true", () => {
    expect(vaultPage).toContain('if (isPermanent && activeTab === "packets") setActiveTab("care")');
  });

  it("does NOT render a flat hardcoded five-tab list for all profile types", () => {
    // Guard: the old single-line array that ignored profile_type must be gone
    expect(vaultPage).not.toContain('(["about","care","packets","plantings","journal"] as const).map');
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
