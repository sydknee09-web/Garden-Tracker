/**
 * One-time backfill: add inferred seed type tags to plant profiles that don't have any.
 * Runs once per user (localStorage flag). Batches updates to avoid timeouts.
 */
import { supabase } from "@/lib/supabase";
import { getSeedTypesFromTags, inferSeedTypesFromPlantName } from "@/constants/seedTypes";

const BACKFILL_DONE_KEY = "seed-type-backfill-done";
const BATCH_SIZE = 50;

export function isSeedTypeBackfillDone(userId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(BACKFILL_DONE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { userId?: string; done?: boolean };
    return parsed.userId === userId && parsed.done === true;
  } catch {
    return false;
  }
}

export function setSeedTypeBackfillDone(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BACKFILL_DONE_KEY, JSON.stringify({ userId, done: true }));
  } catch {
    /* ignore */
  }
}

/** Returns true if any profiles were updated. */
export async function runSeedTypeBackfill(userId: string): Promise<boolean> {
  if (isSeedTypeBackfillDone(userId)) return false;

  const { data: profiles, error } = await supabase
    .from("plant_profiles")
    .select("id, name, tags")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("profile_type", "seed");

  if (error || !profiles?.length) {
    setSeedTypeBackfillDone(userId);
    return false;
  }

  const toUpdate: { id: string; tags: string[] }[] = [];
  for (const p of profiles as { id: string; name: string; tags?: string[] | null }[]) {
    const existingTags = p.tags ?? [];
    const existingSeedTypes = getSeedTypesFromTags(existingTags);
    if (existingSeedTypes.length > 0) continue;
    const inferred = inferSeedTypesFromPlantName(p.name);
    if (inferred.length === 0) continue;
    const newTags = [...new Set([...existingTags, ...inferred])];
    toUpdate.push({ id: p.id, tags: newTags });
  }

  if (toUpdate.length === 0) {
    setSeedTypeBackfillDone(userId);
    return false;
  }

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(({ id, tags }) =>
        supabase.from("plant_profiles").update({ tags, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId)
      )
    );
  }

  setSeedTypeBackfillDone(userId);
  return true;
}
