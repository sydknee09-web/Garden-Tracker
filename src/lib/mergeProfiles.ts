import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Merge source plant profiles into the master. Reassigns all related records
 * (packets, grow instances, journal entries, care schedules, tasks, shopping list)
 * to the master profile, then soft-deletes the source profiles. History is preserved.
 */
export async function reassignAndMergeProfiles(
  supabase: SupabaseClient,
  masterProfileId: string,
  sourceProfileIds: string[],
  userId: string
): Promise<void> {
  if (sourceProfileIds.length === 0) return;
  if (sourceProfileIds.includes(masterProfileId)) {
    throw new Error("Master profile cannot be in source list.");
  }

  const now = new Date().toISOString();

  // 1. Move seed packets to master
  const { error: packetsErr } = await supabase
    .from("seed_packets")
    .update({ plant_profile_id: masterProfileId })
    .in("plant_profile_id", sourceProfileIds)
    .eq("user_id", userId);
  if (packetsErr) throw new Error(`Could not move packets: ${packetsErr.message}`);

  // 2. Move grow instances to master (no user_id filter — household plantings)
  const { error: growsErr } = await supabase
    .from("grow_instances")
    .update({ plant_profile_id: masterProfileId })
    .in("plant_profile_id", sourceProfileIds);
  if (growsErr) throw new Error(`Could not move plantings: ${growsErr.message}`);

  // 3. Move journal entries to master
  const { error: journalErr } = await supabase
    .from("journal_entries")
    .update({ plant_profile_id: masterProfileId })
    .in("plant_profile_id", sourceProfileIds)
    .eq("user_id", userId);
  if (journalErr) throw new Error(`Could not move journal entries: ${journalErr.message}`);

  // 4. Move journal_entry_plants — handle duplicates (same entry tagging both source and master)
  const { data: jepRows } = await supabase
    .from("journal_entry_plants")
    .select("id, journal_entry_id")
    .in("plant_profile_id", sourceProfileIds)
    .eq("user_id", userId);
  const rows = (jepRows ?? []) as { id: string; journal_entry_id: string }[];

  if (rows.length > 0) {
    const { data: existingMaster } = await supabase
      .from("journal_entry_plants")
      .select("journal_entry_id")
      .eq("plant_profile_id", masterProfileId)
      .eq("user_id", userId);
    const entryIdsWithMaster = new Set(
      (existingMaster ?? []).map((r: { journal_entry_id: string }) => r.journal_entry_id)
    );

    const toDelete: string[] = [];
    const toUpdate: string[] = [];
    for (const r of rows) {
      if (entryIdsWithMaster.has(r.journal_entry_id)) {
        toDelete.push(r.id);
      } else {
        toUpdate.push(r.id);
      }
    }

    if (toDelete.length > 0) {
      const { error: delErr } = await supabase
        .from("journal_entry_plants")
        .delete()
        .in("id", toDelete)
        .eq("user_id", userId);
      if (delErr) throw new Error(`Could not consolidate journal links: ${delErr.message}`);
    }
    if (toUpdate.length > 0) {
      const { error: updErr } = await supabase
        .from("journal_entry_plants")
        .update({ plant_profile_id: masterProfileId })
        .in("id", toUpdate)
        .eq("user_id", userId);
      if (updErr) throw new Error(`Could not move journal links: ${updErr.message}`);
    }
  }

  // 5. Move care schedules (templates on plant_profile_id) to master
  const { error: careErr } = await supabase
    .from("care_schedules")
    .update({ plant_profile_id: masterProfileId })
    .in("plant_profile_id", sourceProfileIds)
    .eq("user_id", userId);
  if (careErr) throw new Error(`Could not move care schedules: ${careErr.message}`);

  // 6. Move tasks linked directly to plant_profile_id
  const { error: tasksErr } = await supabase
    .from("tasks")
    .update({ plant_profile_id: masterProfileId })
    .in("plant_profile_id", sourceProfileIds)
    .eq("user_id", userId);
  if (tasksErr) throw new Error(`Could not move tasks: ${tasksErr.message}`);

  // 7. Shopping list — update or remove duplicates (unique on user_id, plant_profile_id)
  const { data: slRows } = await supabase
    .from("shopping_list")
    .select("id")
    .in("plant_profile_id", sourceProfileIds)
    .eq("user_id", userId);
  const slIds = (slRows ?? []).map((r: { id: string }) => r.id);

  if (slIds.length > 0) {
    const { data: masterSl } = await supabase
      .from("shopping_list")
      .select("id")
      .eq("plant_profile_id", masterProfileId)
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();
    if (masterSl) {
      // Master already on list — remove source rows
      const { error: slDelErr } = await supabase
        .from("shopping_list")
        .delete()
        .in("id", slIds)
        .eq("user_id", userId);
      if (slDelErr) throw new Error(`Could not update shopping list: ${slDelErr.message}`);
    } else {
      // Update first source row to master (only one can point to master)
      const [first, ...rest] = slIds;
      if (first) {
        const { error: slUpdErr } = await supabase
          .from("shopping_list")
          .update({ plant_profile_id: masterProfileId })
          .eq("id", first)
          .eq("user_id", userId);
        if (slUpdErr) throw new Error(`Could not update shopping list: ${slUpdErr.message}`);
      }
      if (rest.length > 0) {
        const { error: slDelErr } = await supabase
          .from("shopping_list")
          .delete()
          .in("id", rest)
          .eq("user_id", userId);
        if (slDelErr) throw new Error(`Could not update shopping list: ${slDelErr.message}`);
      }
    }
  }

  // 8. Soft-delete source plant profiles (no cascade — we've moved everything)
  const { error: deleteErr } = await supabase
    .from("plant_profiles")
    .update({ deleted_at: now })
    .in("id", sourceProfileIds)
    .eq("user_id", userId);
  if (deleteErr) throw new Error(`Could not remove source profiles: ${deleteErr.message}`);
}
