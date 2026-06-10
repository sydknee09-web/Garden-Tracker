import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared helper for programmatic (system-authored) journal_entries inserts.
 *
 * Anchors to the existing inline insert shape used across the app (vault_add,
 * planting, note). Introduced for the Groups follow-up ship so the three
 * assignment doors all write group_change entries through one path; existing
 * inline call-sites are intentionally NOT retrofitted here (separate cohesion
 * ticket) to keep this ship scoped.
 */

export type JournalEntryType =
  | "planting"
  | "growth"
  | "harvest"
  | "note"
  | "care"
  | "pest"
  | "death"
  | "quick"
  | "vault_add"
  | "prune"
  | "cold_stratify"
  | "group_change";

export interface CreateJournalEntryInput {
  user_id: string;
  entry_type: JournalEntryType;
  plant_profile_id?: string | null;
  grow_instance_id?: string | null;
  seed_packet_id?: string | null;
  note?: string | null;
  image_file_path?: string | null;
  weather_snapshot?: Record<string, unknown> | null;
}

/**
 * Insert a journal entry. Returns the new row id, or null on failure.
 * Non-throwing by design: auto-journal is a side effect of a primary action
 * (e.g. a group change) and must never break that action if the log write fails.
 */
export async function createJournalEntry(
  supabase: SupabaseClient,
  input: CreateJournalEntryInput
): Promise<{ id: string } | null> {
  try {
    const { data, error } = await supabase
      .from("journal_entries")
      .insert({
        user_id: input.user_id,
        entry_type: input.entry_type,
        plant_profile_id: input.plant_profile_id ?? null,
        grow_instance_id: input.grow_instance_id ?? null,
        seed_packet_id: input.seed_packet_id ?? null,
        note: input.note ?? null,
        image_file_path: input.image_file_path ?? null,
        weather_snapshot: input.weather_snapshot ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("createJournalEntry: insert failed", error);
      return null;
    }
    return (data ?? null) as { id: string } | null;
  } catch (err) {
    console.error("createJournalEntry: unexpected error", err);
    return null;
  }
}
