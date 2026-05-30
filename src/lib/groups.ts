import type { SupabaseClient } from "@supabase/supabase-js";
import type { Group, GrowInstance } from "@/types/garden";

/**
 * Sprint 3 Ship B B1 — data-layer helpers for user-defined Groups.
 *
 * Per-user only (planning doc §2.3 lock); no household sharing in v1.
 * Hard-delete on plant_groups unassign matches journal_entry_plants pattern.
 * deleteGroup soft-deletes the group AND hard-deletes its plant_groups rows
 * (CASCADE FK only fires on hard delete of groups; soft-delete leaves the row).
 */

/** Fetch all of a user's active groups, ordered for tab-row display (position NULLS LAST, then oldest first). */
export async function fetchUserGroups(
  supabase: SupabaseClient,
  userId: string
): Promise<Group[]> {
  try {
    const { data, error } = await supabase
      .from("groups")
      .select("id, user_id, name, position, created_at, updated_at, deleted_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("position", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("fetchUserGroups: query failed", error);
      return [];
    }
    return (data ?? []) as Group[];
  } catch (err) {
    console.error("fetchUserGroups: unexpected error", err);
    return [];
  }
}

/** Fetch all groups a given grow_instance is currently assigned to. */
export async function fetchInstanceGroups(
  supabase: SupabaseClient,
  growInstanceId: string
): Promise<Group[]> {
  try {
    const { data, error } = await supabase
      .from("plant_groups")
      .select("groups(id, user_id, name, position, created_at, updated_at, deleted_at)")
      .eq("grow_instance_id", growInstanceId);
    if (error) {
      console.error("fetchInstanceGroups: query failed", error);
      return [];
    }
    const rows = (data ?? []) as unknown as Array<{ groups: Group | null }>;
    return rows
      .map((row) => row.groups)
      .filter((g): g is Group => g !== null && g.deleted_at == null);
  } catch (err) {
    console.error("fetchInstanceGroups: unexpected error", err);
    return [];
  }
}

/** Insert a plant_groups row assigning the instance to the group. Denormalized user_id required by RLS + zombie trigger. */
export async function assignInstanceToGroup(
  supabase: SupabaseClient,
  growInstanceId: string,
  groupId: string,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("plant_groups")
      .insert({
        grow_instance_id: growInstanceId,
        group_id: groupId,
        user_id: userId,
      });
    if (error) {
      console.error("assignInstanceToGroup: insert failed", error);
      throw error;
    }
  } catch (err) {
    console.error("assignInstanceToGroup: unexpected error", err);
    throw err;
  }
}

/** Hard-delete the plant_groups row. Matches existing M-N pattern (journal_entry_plants/supplies hard-delete on unlink). */
export async function unassignInstanceFromGroup(
  supabase: SupabaseClient,
  growInstanceId: string,
  groupId: string,
  userId: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("plant_groups")
      .delete()
      .eq("grow_instance_id", growInstanceId)
      .eq("group_id", groupId)
      .eq("user_id", userId);
    if (error) {
      console.error("unassignInstanceFromGroup: delete failed", error);
      throw error;
    }
  } catch (err) {
    console.error("unassignInstanceFromGroup: unexpected error", err);
    throw err;
  }
}

/** Create a new group for the user. Position left null; B2/B3 UI sets explicit positions on drag-reorder. */
export async function createGroup(
  supabase: SupabaseClient,
  userId: string,
  name: string
): Promise<Group | null> {
  try {
    const { data, error } = await supabase
      .from("groups")
      .insert({ user_id: userId, name })
      .select("id, user_id, name, position, created_at, updated_at, deleted_at")
      .single();
    if (error) {
      console.error("createGroup: insert failed", error);
      throw error;
    }
    return (data ?? null) as Group | null;
  } catch (err) {
    console.error("createGroup: unexpected error", err);
    throw err;
  }
}

/** Update a group's name and bump updated_at. */
export async function renameGroup(
  supabase: SupabaseClient,
  groupId: string,
  newName: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("groups")
      .update({ name: newName, updated_at: new Date().toISOString() })
      .eq("id", groupId);
    if (error) {
      console.error("renameGroup: update failed", error);
      throw error;
    }
  } catch (err) {
    console.error("renameGroup: unexpected error", err);
    throw err;
  }
}

/**
 * Soft-delete the group AND hard-delete its plant_groups assignments.
 * FK CASCADE on plant_groups.group_id only fires when groups row is hard-deleted;
 * since we soft-delete (set deleted_at), we must explicitly remove junction rows
 * first to avoid orphan assignments pointing at a hidden group.
 */
export async function deleteGroup(
  supabase: SupabaseClient,
  groupId: string
): Promise<void> {
  try {
    const { error: junctionError } = await supabase
      .from("plant_groups")
      .delete()
      .eq("group_id", groupId);
    if (junctionError) {
      console.error("deleteGroup: plant_groups cleanup failed", junctionError);
      throw junctionError;
    }

    const { error: groupError } = await supabase
      .from("groups")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", groupId);
    if (groupError) {
      console.error("deleteGroup: group soft-delete failed", groupError);
      throw groupError;
    }
  } catch (err) {
    console.error("deleteGroup: unexpected error", err);
    throw err;
  }
}

/**
 * Unified Garden-tab data fetch: ALL of a user's active grow_instances
 * regardless of annual vs perennial, each with their groups[] populated.
 *
 * This is the foundation the future B2 Garden tab will use to replace the
 * current Active Garden + My Plants split queries:
 *   - src/components/ActiveGardenView.tsx:262-268 (is_permanent_planting != true)
 *   - src/components/MyPlantsView.tsx:233-239 (is_permanent_planting = true)
 * Both get replaced by this helper + client-side filter in B2.
 */
export async function fetchAllUserGrowInstances(
  supabase: SupabaseClient,
  userId: string
): Promise<GrowInstance[]> {
  try {
    const { data, error } = await supabase
      .from("grow_instances")
      .select(
        "id, plant_profile_id, sown_date, expected_harvest_date, status, ended_at, location, end_reason, seed_packet_id, created_at, user_id, deleted_at, sow_method, seeds_sown, seeds_sprouted, sprout_date, plant_count, is_permanent_planting, purchase_price, purchase_quantity, vendor, plant_groups(groups(id, user_id, name, position, created_at, updated_at, deleted_at))"
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .order("sown_date", { ascending: false });
    if (error) {
      console.error("fetchAllUserGrowInstances: query failed", error);
      return [];
    }
    type RawRow = Omit<GrowInstance, "groups"> & {
      plant_groups: Array<{ groups: Group | null }> | null;
    };
    const rows = (data ?? []) as unknown as RawRow[];
    return rows.map((row) => {
      const { plant_groups, ...rest } = row;
      const groups = (plant_groups ?? [])
        .map((pg) => pg.groups)
        .filter((g): g is Group => g !== null && g.deleted_at == null);
      return { ...rest, groups } as GrowInstance;
    });
  } catch (err) {
    console.error("fetchAllUserGrowInstances: unexpected error", err);
    return [];
  }
}
