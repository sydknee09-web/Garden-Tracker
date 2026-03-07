import type { SupabaseClient } from "@supabase/supabase-js";

export type CascadePacketDeleteOptions = {
  /** When true, soft-delete grow instances that reference these packets. When false, clear seed_packet_id only. */
  deleteGrowInstances: boolean;
};

/**
 * Cascade when seed packets are soft-deleted.
 * - Soft-delete the packets
 * - Soft-delete journal entries where seed_packet_id = packetId
 * - If deleteGrowInstances: soft-delete grow_instances and their tasks
 * - If !deleteGrowInstances: clear seed_packet_id on grow_instances (keep plantings)
 */
export async function cascadeForDeletedPackets(
  supabase: SupabaseClient,
  packetIds: string[],
  userId: string,
  options: CascadePacketDeleteOptions
): Promise<void> {
  if (packetIds.length === 0) return;

  const now = new Date().toISOString();

  try {
    // 1. Soft-delete the packets
    await supabase
      .from("seed_packets")
      .update({ deleted_at: now })
      .in("id", packetIds)
      .eq("user_id", userId);

    // 2. Soft-delete journal entries that reference these packets
    await supabase
      .from("journal_entries")
      .update({ deleted_at: now })
      .in("seed_packet_id", packetIds)
      .eq("user_id", userId);

    if (options.deleteGrowInstances) {
      // 3a. Get grow instances that reference these packets
      const { data: grows } = await supabase
        .from("grow_instances")
        .select("id, user_id")
        .in("seed_packet_id", packetIds)
        .is("deleted_at", null);

      // 4a. Soft-delete tasks linked to those grow instances
      for (const g of grows ?? []) {
        await supabase
          .from("tasks")
          .update({ deleted_at: now })
          .eq("grow_instance_id", g.id)
          .eq("user_id", g.user_id ?? userId);
      }

      // 5a. Soft-delete grow instances
      await supabase
        .from("grow_instances")
        .update({ deleted_at: now })
        .in("seed_packet_id", packetIds);
    } else {
      // 3b. Clear seed_packet_id on grow instances (keep plantings, remove link)
      await supabase
        .from("grow_instances")
        .update({ seed_packet_id: null })
        .in("seed_packet_id", packetIds);
    }
  } catch (err) {
    console.error("cascadeForDeletedPackets: unexpected error", err);
    throw err;
  }
}
