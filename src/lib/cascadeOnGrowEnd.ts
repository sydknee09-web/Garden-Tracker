import { supabase } from "@/lib/supabase";

/**
 * When a grow instance is ended (archived, harvested, dead) or soft-deleted,
 * soft-delete all calendar tasks linked to that instance so they no longer appear.
 */
export async function softDeleteTasksForGrowInstance(
  growInstanceId: string,
  userId: string
): Promise<void> {
  await supabase
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("grow_instance_id", growInstanceId)
    .eq("user_id", userId);
}
