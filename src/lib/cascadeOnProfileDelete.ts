import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * When plant profiles are soft-deleted, cascade:
 * - Soft-delete all tasks linked to those profiles (plant_profile_id or plant_variety_id).
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
      .from("tasks")
      .update({ deleted_at: now })
      .in("plant_variety_id", profileIds)
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
