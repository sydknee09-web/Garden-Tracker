import type { CoverPhotoMode } from "@/types/garden";

/**
 * Cover-photo resolution for growing instances (Syd design lock 2026-06-11).
 *
 * Pure logic — no supabase import — so consumers (GrowInstanceModal hero,
 * GardenView cards, CoverPhotoSheet) share ONE resolution path and the rules
 * are unit-testable. URL-from-path stays consumer-local per the prevailing
 * getPublicUrl pattern.
 *
 * Modes:
 *   auto (default)      — most-recent journal photo, skipping receipt/acquisition
 *                         artifacts; resolves to null when none → consumer falls
 *                         back to its existing profile-hero chain (silent).
 *   pinned_journal      — the referenced entry, if alive and photo-bearing;
 *                         silent auto fallback when the pin is gone (soft-deleted
 *                         entry) so the surface never breaks.
 *   pinned_profile_hero — always null here; consumer shows its profile chain.
 */

/**
 * Entry types the AUTO picker never selects on its own. vault_add is GT's
 * acquisition/receipt artifact type (nursery receipts, purchase photos).
 * Users can still PIN these explicitly from the picker grid — user agency wins;
 * only the automatic pick skips them.
 */
export const COVER_AUTO_SKIP_ENTRY_TYPES: readonly string[] = ["vault_add"];

export interface CoverEntryLike {
  id: string;
  created_at: string;
  entry_type?: string | null;
  image_file_path?: string | null;
  photo_url?: string | null;
  deleted_at?: string | null;
}

export function coverEntryHasPhoto(entry: CoverEntryLike): boolean {
  return !!(entry.image_file_path?.trim() || entry.photo_url?.trim());
}

function isAlive(entry: CoverEntryLike): boolean {
  return !entry.deleted_at;
}

/**
 * Most-recent photo-bearing, non-receipt, non-deleted entry.
 * Legacy rows with entry_type null are INCLUDED (they predate typed entries
 * and are ordinary observations, not receipts). Input order is not assumed.
 */
export function pickAutoCoverEntry<T extends CoverEntryLike>(entries: T[]): T | null {
  const candidates = entries.filter(
    (e) =>
      isAlive(e) &&
      coverEntryHasPhoto(e) &&
      !COVER_AUTO_SKIP_ENTRY_TYPES.includes(e.entry_type ?? "")
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((latest, e) => (e.created_at > latest.created_at ? e : latest));
}

export interface CoverGrowLike {
  cover_photo_mode?: CoverPhotoMode | null;
  cover_photo_journal_entry_id?: string | null;
}

/**
 * Resolve the journal entry that should be this instance's cover photo, or
 * null when the cover is the profile hero (pinned_profile_hero, or no
 * qualifying journal photo exists). Null means: use the existing profile
 * fallback chain (hero path → hero url → packet → placeholder), unchanged.
 */
export function resolveCoverEntry<T extends CoverEntryLike>(
  grow: CoverGrowLike,
  entries: T[]
): T | null {
  const mode: CoverPhotoMode = grow.cover_photo_mode ?? "auto";
  if (mode === "pinned_profile_hero") return null;
  if (mode === "pinned_journal" && grow.cover_photo_journal_entry_id) {
    const pinned = entries.find((e) => e.id === grow.cover_photo_journal_entry_id);
    if (pinned && isAlive(pinned) && coverEntryHasPhoto(pinned)) return pinned;
    // Pin target gone (soft-deleted / photo-less) — fall back to auto silently
    // rather than breaking the surface; the mode value is preserved so a
    // restored entry resumes its pin.
  }
  return pickAutoCoverEntry(entries);
}
