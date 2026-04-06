import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * When no active grows remain for a profile, revert status to in_stock or out_of_stock.
 * Uses profile owner for packets/shopping list; counts ALL active grows (household).
 * Call after archiving or deleting grow instances.
 */
export async function revertProfileStatusIfNoActiveGrows(
  supabase: SupabaseClient,
  profileId: string
): Promise<void> {
  try {
    // Count ALL active grows for this profile (household: any user's plantings)
    const { data: activeGrows } = await supabase
      .from("grow_instances")
      .select("id")
      .eq("plant_profile_id", profileId)
      .in("status", ["growing", "pending"])
      .is("deleted_at", null);

    if (activeGrows?.length) return;

    // Fetch profile owner (packets and profile belong to owner)
    const { data: profile } = await supabase
      .from("plant_profiles")
      .select("user_id")
      .eq("id", profileId)
      .is("deleted_at", null)
      .single();

    const profileOwnerId = (profile as { user_id?: string } | null)?.user_id;
    if (!profileOwnerId) return;

    const { data: stockedPackets } = await supabase
      .from("seed_packets")
      .select("id")
      .eq("plant_profile_id", profileId)
      .eq("user_id", profileOwnerId)
      .is("deleted_at", null)
      .or("is_archived.is.null,is_archived.eq.false")
      .gt("qty_status", 0);

    const revertStatus = stockedPackets?.length ? "in_stock" : "out_of_stock";
    await supabase
      .from("plant_profiles")
      .update({ status: revertStatus })
      .eq("id", profileId)
      .eq("user_id", profileOwnerId);

    if (revertStatus === "out_of_stock") {
      await supabase.from("shopping_list").upsert(
        { user_id: profileOwnerId, plant_profile_id: profileId, is_purchased: false },
        { onConflict: "user_id,plant_profile_id", ignoreDuplicates: false }
      );
    }
  } catch (err) {
    console.error("revertProfileStatusIfNoActiveGrows: unexpected error", err);
  }
}
