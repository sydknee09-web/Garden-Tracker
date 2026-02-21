/**
 * UI consistency regression tests.
 *
 * Guards against regressions in header/tab alignment changes made across
 * multiple pages to ensure visual consistency:
 *
 *  Fix 1 — Garden page tab wrapper: removed justify-center (floating-island bug)
 *  Fix 2 — Calendar page tab wrapper: removed justify-center
 *  Fix 3 — Journal page subtitle: removed "Notes and photos from your garden" line
 *  Fix 4 — AuthGuard toggle: added w-[76px] so header title stays centred
 *
 * The Vault page is the reference standard for all of these.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

const gardenPage   = readFileSync(join(ROOT, "src/app/garden/page.tsx"),       "utf-8");
const calendarPage = readFileSync(join(ROOT, "src/app/calendar/page.tsx"),     "utf-8");
const journalPage  = readFileSync(join(ROOT, "src/app/journal/page.tsx"),      "utf-8");
const vaultPage    = readFileSync(join(ROOT, "src/app/vault/page.tsx"),        "utf-8");
const authGuard    = readFileSync(join(ROOT, "src/components/AuthGuard.tsx"),  "utf-8");

// ---------------------------------------------------------------------------
// Fix 1 & 2 — Tab wrapper must NOT use justify-center
// ---------------------------------------------------------------------------
describe("Tab wrapper consistency — no justify-center floating island", () => {
  it("Vault tab wrapper does not use justify-center (reference standard)", () => {
    expect(vaultPage).not.toContain("flex justify-center mb-3");
  });

  it("Garden tab wrapper does not use justify-center", () => {
    // justify-center made the tab pill float as a centred island, eating vertical
    // space and looking different from the Vault tab style.
    expect(gardenPage).not.toContain("flex justify-center mb-3");
  });

  it("Garden tab wrapper uses left-aligned flex mb-3 to match Vault", () => {
    expect(gardenPage).toContain("flex mb-3");
  });

  it("Calendar page does not use justify-center on a tab wrapper", () => {
    // The Reminders/Overview tab switcher was removed; guard against re-adding
    // it with a centred layout that breaks visual consistency.
    expect(calendarPage).not.toContain("flex justify-center mb-3");
  });
});

// ---------------------------------------------------------------------------
// Fix 3 — Journal subtitle removed
// ---------------------------------------------------------------------------
describe("Journal page — redundant subtitle removed", () => {
  it('Journal page does not contain "Notes and photos from your garden"', () => {
    // This subtitle added ~28px of vertical dead space not present on any other
    // page (Vault, Garden, Calendar have no subtitle beneath the header).
    expect(journalPage).not.toContain("Notes and photos from your garden");
  });
});

// ---------------------------------------------------------------------------
// Fix 4 — AuthGuard toggle fixed width
// ---------------------------------------------------------------------------
describe("AuthGuard Family/Personal toggle — fixed width prevents title drift", () => {
  it("Toggle button has fixed w-[76px]", () => {
    // Without a fixed width, switching 'Family' (6 chars) <-> 'Personal' (8 chars)
    // resizes the right column and the flex-1 title drifts horizontally.
    expect(authGuard).toContain("w-[76px]");
  });

  it("Toggle button uses justify-center so label stays centred within the fixed width", () => {
    expect(authGuard).toContain("justify-center");
  });
});
