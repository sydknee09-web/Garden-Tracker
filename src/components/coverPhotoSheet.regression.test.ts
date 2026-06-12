/**
 * Regression tests — Cover Photo picker for plant instances
 * (Syd design lock 2026-06-11, shipped from the pencil Edit Plant menu).
 *
 * Locks guarded here:
 *  1. Three-mode state machine writes: Auto-Update resets the pin; Use Profile
 *     Hero pins the species photo; tapping a journal tile pins that entry.
 *     All writes go through the offline queue with the owner-scoped RLS match.
 *  2. The picker grid shows ALL journal photos including vault_add receipts
 *     (user agency) — only the AUTO picker skips receipts (coverPhoto.ts).
 *  3. Upload New creates a journal entry stub ("Photo added", entry_type note,
 *     NO weather snapshot — a library photo can be days old) and pins it.
 *  4. Consumers route through the shared resolver: instance hero
 *     (GrowInstanceModal) + Garden cards (GardenView, incl. the NULL-safe
 *     vault_add exclusion in the batched candidates query).
 *  5. Tokens: selected = emerald-500 border (STATE, VISION §8); Title Case
 *     buttons; sentence-case descriptions + toast.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(join(ROOT, p), "utf-8");

const sheet = read("src/components/CoverPhotoSheet.tsx");
const lib = read("src/lib/coverPhoto.ts");
const instanceModal = read("src/components/GrowInstanceModal.tsx");
const gardenView = read("src/components/GardenView.tsx");
const groupsLib = read("src/lib/groups.ts");
const migration = read("supabase/migrations/20260612090000_grow_instances_cover_photo.sql");

describe("Cover photo state-machine writes", () => {
  it("Auto-Update clears the pin; Use Profile Hero and journal tiles set their modes", () => {
    expect(sheet).toContain('commit("auto", null)');
    expect(sheet).toContain('commit("pinned_profile_hero", null)');
    expect(sheet).toContain('commit("pinned_journal", entry.id)');
  });

  it("writes go through the offline queue with the owner-scoped match (household RLS)", () => {
    expect(sheet).toContain("{ cover_photo_mode: nextMode, cover_photo_journal_entry_id: entryId },");
    expect(sheet).toContain("{ id: growId, user_id: ownerId }");
    expect(sheet).toContain("updateWithOfflineQueue(");
  });

  it("a single saving flag gates every action (no double-fire)", () => {
    const actionButtons = sheet.match(/disabled=\{saving\}/g) ?? [];
    expect(actionButtons.length).toBeGreaterThanOrEqual(5); // auto + hero + tiles + upload + done
  });
});

describe("Picker grid + receipt behavior", () => {
  it("grid query takes ALL journal photos for the grow (no entry_type filter — receipts visible)", () => {
    const gridQuery = sheet.match(/from\("journal_entries"\)[\s\S]*?order\("created_at"/);
    expect(gridQuery).not.toBeNull();
    expect(gridQuery![0]).not.toContain("vault_add");
    expect(gridQuery![0]).toContain('is("deleted_at", null)');
  });

  it("only the AUTO picker skips receipts, via the shared skip list", () => {
    expect(lib).toContain('COVER_AUTO_SKIP_ENTRY_TYPES: readonly string[] = ["vault_add"]');
    expect(lib).toContain("!COVER_AUTO_SKIP_ENTRY_TYPES.includes(e.entry_type ?? \"\")");
  });

  it("Use Profile Hero is hidden when no profile hero exists (can't pin to nothing)", () => {
    expect(sheet).toContain("{profileHeroUrl && (");
  });
});

describe("Upload New → journal stub + pin", () => {
  it("creates the stub with note 'Photo added', entry_type note, and NO weather snapshot", () => {
    expect(sheet).toContain('note: "Photo added"');
    expect(sheet).toContain('entry_type: "note"');
    expect(sheet).not.toContain("weather_snapshot");
    expect(sheet).not.toContain("fetchWeatherSnapshot");
  });

  it("uploads compressed to journal-photos under the acting user's folder", () => {
    expect(sheet).toContain("compressImage(file)");
    expect(sheet).toContain('from("journal-photos")');
    expect(sheet).toContain("${currentUserId}/grow-cover-");
  });

  it("pins the new entry in the same flow", () => {
    expect(sheet).toContain('cover_photo_mode: "pinned_journal", cover_photo_journal_entry_id: (entry as { id: string }).id');
  });
});

describe("Consumers route through the shared resolver", () => {
  it("instance hero resolves via resolveCoverEntry before the profile chain", () => {
    expect(instanceModal).toContain("resolveCoverEntry(grow, journalEntries)");
  });

  it("Garden cards prefer the load-time cover URL, then the profile chain", () => {
    expect(gardenView).toContain("resolveCoverEntry(r, coverEntriesByGrow.get(r.id) ?? [])");
    expect(gardenView).toContain("if (batch.cover_journal_image_url) return batch.cover_journal_image_url;");
  });

  it("Garden auto-candidates query is NULL-safe on entry_type (legacy rows included, receipts excluded)", () => {
    expect(gardenView).toContain('or("entry_type.is.null,entry_type.neq.vault_add")');
    expect(gardenView).toContain('or("image_file_path.not.is.null,photo_url.not.is.null")');
  });

  it("both grow selects carry the cover columns (GardenView family view + shared helper)", () => {
    expect(gardenView).toContain("cover_photo_mode, cover_photo_journal_entry_id");
    expect(groupsLib).toContain("cover_photo_mode, cover_photo_journal_entry_id");
  });
});

describe("Schema migration (staged — gated on Syd greenlight)", () => {
  it("is additive + idempotent with the 3-mode CHECK and SET NULL FK", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS cover_photo_mode text NOT NULL DEFAULT 'auto'");
    expect(migration).toContain("CHECK (cover_photo_mode IN ('auto', 'pinned_journal', 'pinned_profile_hero'))");
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS cover_photo_journal_entry_id uuid");
    expect(migration).toContain("REFERENCES journal_entries(id) ON DELETE SET NULL");
    expect(migration).not.toMatch(/DROP|TRUNCATE|DELETE FROM/i);
  });
});

describe("Tokens + casing", () => {
  it("selected state uses the emerald-500 STATE token (VISION §8 split)", () => {
    expect(sheet).toContain("border-emerald-500");
    expect(sheet).not.toContain("bg-emerald-600");
  });

  it("buttons are Title Case; toast is sentence case", () => {
    expect(sheet).toContain(">Cover Photo<");
    expect(sheet).toContain("Auto-Update");
    expect(sheet).toContain("Use Profile Hero");
    expect(sheet).toContain("Upload New");
    expect(read("src/components/EditGrowModal.tsx")).toContain('showToast("Cover photo updated.")');
  });

  it("no user-visible batch vocab", () => {
    expect(sheet).not.toMatch(/[Bb]atch/);
  });
});
