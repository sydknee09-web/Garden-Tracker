/**
 * Sprint 4 Sources-section foundation guard (Syd 2026-06-10).
 *
 * The instance page's Sources section (queued) finds the acquisition event by querying
 * journal_entries on `grow_instance_id`. That only works if EVERY add path that creates a
 * growing instance also tags its acquisition/planting journal entry with that instance id.
 * Building Sources on a broken linkage = wasted work, so these source-level invariants lock
 * the linkage across all instance-creating add flows (NORTH_STAR "Information-hub framing":
 * one acquisition event surfaces on the instance hub it belongs to — not a duplicate path).
 *
 * Also guards the 2026-06-10 reversal of the 2026-05-28 "Journal = user-logs-only" filter:
 * the instance Journal tab must NOT silently re-exclude vault_add acquisition entries.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

/**
 * Extract each `.from("journal_entries").insert({ ... })` object-literal body, brace-matched
 * so nested spreads like `...(cond && { purchase_price })` don't truncate the capture.
 */
function journalInsertObjects(src: string): string[] {
  const objs: string[] = [];
  const needle = '"journal_entries"';
  let from = 0;
  for (;;) {
    const fromIdx = src.indexOf(needle, from);
    if (fromIdx === -1) break;
    from = fromIdx + needle.length;
    const insertIdx = src.indexOf(".insert(", fromIdx);
    // Only pair when .insert( immediately follows the .from("journal_entries") call.
    if (insertIdx === -1 || insertIdx - fromIdx > 60) continue;
    const braceStart = src.indexOf("{", insertIdx);
    if (braceStart === -1) continue;
    let depth = 0;
    let i = braceStart;
    for (; i < src.length; i++) {
      if (src[i] === "{") depth++;
      else if (src[i] === "}") {
        depth--;
        if (depth === 0) {
          i++;
          break;
        }
      }
    }
    objs.push(src.slice(braceStart, i));
  }
  return objs;
}

// Files where an add flow creates a growing instance AND writes a journal entry for it.
const INSTANCE_CREATING_ADD_FLOWS: { label: string; path: string }[] = [
  { label: "PO Import → Add Plant (vault_add)", path: "src/app/vault/review-import/page.tsx" },
  { label: "Manual / Photo / Link → Add Plant (vault_add)", path: "src/components/AddPlantModal.tsx" },
  { label: "Sow-task completion → instance (planting)", path: "src/lib/completeSowTask.ts" },
  { label: "PlantingForm → instance (planting)", path: "src/components/PlantingForm.tsx" },
];

describe("Add-flow acquisition/planting entries carry grow_instance_id (Sprint 4 Sources foundation)", () => {
  for (const flow of INSTANCE_CREATING_ADD_FLOWS) {
    it(`${flow.label}: every journal_entries insert tags the instance`, () => {
      const inserts = journalInsertObjects(read(flow.path));
      // Sanity: the extractor actually found the inserts (guards against a path/refactor that
      // moves the inserts and silently makes the linkage assertion vacuously pass).
      expect(inserts.length).toBeGreaterThan(0);
      for (const obj of inserts) {
        expect(obj).toContain("grow_instance_id");
      }
    });
  }

  it("the PO Import vault_add entry specifically links the freshly-created instance", () => {
    const src = read("src/app/vault/review-import/page.tsx");
    expect(src).toContain('entry_type: "vault_add"');
    expect(src).toContain("grow_instance_id: growId");
  });
});

describe("Instance Journal tab surfaces vault_add acquisition entries (2026-06-10 reversal)", () => {
  const instanceModal = read("src/components/GrowInstanceModal.tsx");

  it("no longer filters out vault_add from the Journal tab list", () => {
    expect(instanceModal).not.toContain('e.entry_type !== "vault_add"');
  });

  it("records the 2026-06-10 reversal of the 2026-05-28 user-logs-only lock in source", () => {
    expect(instanceModal).toContain("2026-06-10 Syd lock");
  });

  it("the Journal tab query still scopes entries to this grow_instance_id (consumer side)", () => {
    expect(instanceModal).toContain('.eq("grow_instance_id", instanceId)');
  });
});
