import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * When plant profiles are soft-deleted, cascade:
 * - Soft-delete all tasks linked to those profiles (plant_profile_id).
 * - Remove shopping list items for those profiles (hard delete; table has no deleted_at).
 */
export async function cascadeTasksAndShoppingForDeletedProfiles(
  supabase: SupabaseClient,
  profileIds: string[],
  userId: string
): Promise<void> {
  if (profileIds.length === 0) return;

  try {
    const now = new Date().toISOString();

    await supabase
      .from("tasks")
      .update({ deleted_at: now })
      .in("plant_profile_id", profileIds)
      .eq("user_id", userId);

    await supabase
      .from("shopping_list")
      .delete()
      .in("plant_profile_id", profileIds)
      .eq("user_id", userId);
  } catch (err) {
    console.error("cascadeTasksAndShoppingForDeletedProfiles: unexpected error", err);
  }
}

/**
 * Full cascade when plant profiles are soft-deleted. Use this for batch delete and merge flows.
 * Cascades to: tasks, shopping_list, grow_instances, journal_entries, seed_packets, care_schedules.
 * Grow instances are soft-deleted by plant_profile_id only (no user_id filter) so household
 * members' plantings are also removed when the profile owner deletes.
 */
export async function cascadeAllForDeletedProfiles(
  supabase: SupabaseClient,
  profileIds: string[],
  userId: string
): Promise<void> {
  if (profileIds.length === 0) return;

  const now = new Date().toISOString();

  try {
    await cascadeTasksAndShoppingForDeletedProfiles(supabase, profileIds, userId);

    // Soft-delete tasks linked to grow instances (by grow_instance_id)
    const { data: grows } = await supabase
      .from("grow_instances")
      .select("id, user_id")
      .in("plant_profile_id", profileIds)
      .is("deleted_at", null);

    for (const g of grows ?? []) {
      await supabase
        .from("tasks")
        .update({ deleted_at: now })
        .eq("grow_instance_id", g.id)
        .eq("user_id", g.user_id ?? userId);
    }

    // Soft-delete grow instances (no user_id filter — cascade to all plantings for this profile)
    await supabase
      .from("grow_instances")
      .update({ deleted_at: now })
      .in("plant_profile_id", profileIds);

    await supabase
      .from("journal_entries")
      .update({ deleted_at: now })
      .in("plant_profile_id", profileIds)
      .eq("user_id", userId);

    await supabase
      .from("journal_entry_plants")
      .delete()
      .in("plant_profile_id", profileIds)
      .eq("user_id", userId);

    await supabase
      .from("seed_packets")
      .update({ deleted_at: now })
      .in("plant_profile_id", profileIds)
      .eq("user_id", userId);

    await supabase
      .from("care_schedules")
      .update({ deleted_at: now })
      .in("plant_profile_id", profileIds)
      .eq("user_id", userId);
  } catch (err) {
    console.error("cascadeAllForDeletedProfiles: unexpected error", err);
  }
}
