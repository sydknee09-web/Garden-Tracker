/**
 * Regression test for U25 — cross-surface icon cohesion on "Add journal entry" trigger.
 *
 * Active Garden gallery + list use <ICON_MAP.Edit /> (pen-with-motion); My Plants
 * list previously used inline SVG of a notebook. After the U25 fix, both surfaces
 * use ICON_MAP.Edit for the same action.
 *
 * Prevents revert by asserting:
 *  - ICON_MAP imported in MyPlantsView
 *  - <ICON_MAP.Edit className="w-5 h-5" /> present on the "Add journal entry" trigger
 *  - The old inline-SVG notebook path strings are gone
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const myPlantsView = readFileSync(join(ROOT, "src/components/MyPlantsView.tsx"), "utf-8");

describe("U25 — MyPlantsView 'Add journal entry' trigger uses ICON_MAP.Edit", () => {
  it("imports ICON_MAP from styleDictionary", () => {
    expect(myPlantsView).toContain('import { ICON_MAP } from "@/lib/styleDictionary"');
  });

  it("renders <ICON_MAP.Edit className=\"w-5 h-5\" /> matching ActiveGardenView", () => {
    expect(myPlantsView).toContain('<ICON_MAP.Edit className="w-5 h-5" />');
  });

  it("does not retain the inline notebook SVG path strings", () => {
    expect(myPlantsView).not.toContain('d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"');
    expect(myPlantsView).not.toContain('d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"');
  });
});
