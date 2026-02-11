import { supabase } from "@/lib/supabase";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import type { Task } from "@/types/garden";

/**
 * When a user marks a Sow (or Sowing) task as Done:
 * 1. Redate: set task due_date to today, completed_at to now.
 * 2. If plant_profile_id and no grow_instance_id:
 *    - Create grow_instance with seed_packet_id
 *    - Journal "Sown (from task)" with entry_type: 'planting'
 *    - Decrement oldest non-archived packet qty_status by 50% (default partial use)
 *    - Archive packet if qty reaches 0
 *    - Mark profile out_of_stock + add to shopping list if ALL packets archived
 *    - Create harvest task
 * 3. Legacy plant_variety_id: decrement inventory_count, add to shopping_list if 0.
 */
export async function completeTask(
  task: Task & { plant_name?: string },
  userId: string,
  /** Optional overrides from PacketPickerModal -- when provided, skip auto-packet logic */
  packetUsage?: { packetId: string; percentUsed: number }[],
): Promise<void> {
  if (task.completed_at) return;

  const now = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const isSowTask =
    task.category === "sow" ||
    task.category === "start_seed" ||
    task.category === "direct_sow";

  // Mark task as completed
  if (isSowTask) {
    await supabase.from("tasks").update({ due_date: today, completed_at: now }).eq("id", task.id).eq("user_id", userId);
  } else {
    await supabase.from("tasks").update({ completed_at: now }).eq("id", task.id).eq("user_id", userId);
  }

  // ---- Sow task for plant_profiles (new schema) ----
  if (
    (task.category === "sow" || task.category === "start_seed") &&
    task.plant_profile_id
  ) {
    if (!task.grow_instance_id) {
      const { data: profile } = await supabase
        .from("plant_profiles")
        .select("id, name, variety_name, harvest_days")
        .eq("id", task.plant_profile_id)
        .eq("user_id", userId)
        .single();

      if (profile) {
        const harvestDays = (profile as { harvest_days: number | null }).harvest_days;
        const expectedHarvestDate =
          harvestDays != null && harvestDays > 0
            ? new Date(new Date(today).getTime() + harvestDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            : null;

        // Get the packet to use (oldest non-archived, or from picker)
        let primaryPacketId: string | null = null;

        if (packetUsage && packetUsage.length > 0) {
          // Use explicit packet selections from PacketPickerModal
          primaryPacketId = packetUsage[0].packetId;
          for (const usage of packetUsage) {
            await decrementPacket(usage.packetId, userId, usage.percentUsed);
          }
        } else {
          // Auto-select oldest non-archived packet and use 50%
          const { data: packets } = await supabase
            .from("seed_packets")
            .select("id, qty_status")
            .eq("plant_profile_id", task.plant_profile_id)
            .eq("user_id", userId)
            .or("is_archived.is.null,is_archived.eq.false")
            .order("created_at", { ascending: true })
            .limit(1);
          if (packets && packets.length > 0) {
            primaryPacketId = packets[0].id;
            await decrementPacket(packets[0].id, userId, 50);
          }
        }

        // Create grow instance with seed_packet_id
        const { data: growRow, error: growErr } = await supabase
          .from("grow_instances")
          .insert({
            user_id: userId,
            plant_profile_id: task.plant_profile_id,
            plant_variety_id: task.plant_profile_id,
            sown_date: today,
            expected_harvest_date: expectedHarvestDate ?? null,
            status: "growing",
            seed_packet_id: primaryPacketId,
          })
          .select("id")
          .single();

        if (!growErr && growRow?.id) {
          const weatherSnapshot = await fetchWeatherSnapshot();
          await supabase.from("journal_entries").insert({
            user_id: userId,
            plant_profile_id: task.plant_profile_id,
            grow_instance_id: growRow.id,
            seed_packet_id: primaryPacketId,
            note: `Sowed ${(profile as { variety_name?: string | null }).variety_name?.trim() ? `${(profile as { name: string }).name} (${(profile as { variety_name: string }).variety_name})` : (profile as { name: string }).name}`,
            entry_type: "planting",
            weather_snapshot: weatherSnapshot ?? undefined,
          });

          // Check if all packets are now archived/empty
          await checkProfileStockStatus(task.plant_profile_id, userId);

          // Create harvest task
          const displayName = (profile as { variety_name?: string | null }).variety_name?.trim()
            ? `${(profile as { name: string }).name} (${(profile as { variety_name: string }).variety_name})`
            : (profile as { name: string }).name;
          if (expectedHarvestDate) {
            await supabase.from("tasks").insert({
              user_id: userId,
              plant_profile_id: task.plant_profile_id,
              grow_instance_id: growRow.id,
              category: "harvest",
              due_date: expectedHarvestDate,
              title: `Harvest ${displayName}`,
            });
          }
        }
      }
    }
  }
  // ---- Legacy plant_variety_id ----
  else if (
    (task.category === "sow" || task.category === "start_seed") &&
    task.plant_variety_id
  ) {
    const { data: p } = await supabase
      .from("plant_varieties")
      .select("inventory_count")
      .eq("id", task.plant_variety_id)
      .single();
    const current = (p as { inventory_count?: number } | null)?.inventory_count ?? 0;
    const next = Math.max(0, current - 1);
    await supabase.from("plant_varieties").update({ inventory_count: next }).eq("id", task.plant_variety_id).eq("user_id", userId);
    if (next === 0) {
      await supabase.from("shopping_list").upsert(
        { user_id: userId, plant_variety_id: task.plant_variety_id },
        { onConflict: "user_id,plant_variety_id", ignoreDuplicates: true },
      );
    }
  }

  // ---- Transplant status update (legacy) ----
  if (task.category === "transplant" && task.plant_variety_id) {
    await supabase.from("plant_varieties").update({ status: "Active on Hillside" }).eq("id", task.plant_variety_id).eq("user_id", userId);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Decrement a packet's qty_status by a given percentage amount.
 * If qty reaches 0, mark as archived.
 */
async function decrementPacket(packetId: string, userId: string, percentToUse: number): Promise<void> {
  const { data: pkt } = await supabase
    .from("seed_packets")
    .select("qty_status")
    .eq("id", packetId)
    .eq("user_id", userId)
    .single();
  if (!pkt) return;

  const current = (pkt as { qty_status: number }).qty_status;
  const newQty = Math.max(0, current - percentToUse);

  const updates: Record<string, unknown> = { qty_status: newQty };
  if (newQty <= 0) {
    updates.is_archived = true;
  }
  await supabase.from("seed_packets").update(updates).eq("id", packetId).eq("user_id", userId);
}

/**
 * After planting, check if all packets for a profile are archived/empty.
 * If so, set profile status to out_of_stock and add to shopping list.
 */
async function checkProfileStockStatus(profileId: string, userId: string): Promise<void> {
  const { data: remaining } = await supabase
    .from("seed_packets")
    .select("id")
    .eq("plant_profile_id", profileId)
    .eq("user_id", userId)
    .or("is_archived.is.null,is_archived.eq.false")
    .gt("qty_status", 0);

  if (!remaining?.length) {
    await supabase.from("plant_profiles").update({ status: "out_of_stock" }).eq("id", profileId).eq("user_id", userId);
    await supabase.from("shopping_list").upsert(
      { user_id: userId, plant_profile_id: profileId, is_purchased: false },
      { onConflict: "user_id,plant_profile_id", ignoreDuplicates: false },
    );
  }
}
