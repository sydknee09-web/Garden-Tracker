import type { SupabaseClient } from "@supabase/supabase-js";
import type { Group, GrowInstance } from "@/types/garden";
import { createJournalEntry } from "@/lib/createJournalEntry";

export type GroupChangeKind = "added" | "moved" | "removed" | "none";

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
 * Update group positions in bulk. Used by B3 Manage Groups reorder UI.
 * Loops sequential updates; group count per user is small (<20 typical) so cost is bounded.
 */
export async function updateGroupPositions(
  supabase: SupabaseClient,
  positions: Array<{ id: string; position: number }>
): Promise<void> {
  try {
    for (const { id, position } of positions) {
      const { error } = await supabase
        .from("groups")
        .update({ position, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        console.error("updateGroupPositions: update failed", error);
        throw error;
      }
    }
  } catch (err) {
    console.error("updateGroupPositions: unexpected error", err);
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
 * Single-membership group assignment (locked 2026-06-09: ONE group per plant).
 *
 * Removes ALL existing plant_groups rows for the instance (this also collapses
 * any legacy multi-membership left over from the shipped multi-select Door 1),
 * then inserts the new membership if `nextGroup` is provided. Writes a compact
 * `group_change` journal entry with the correct Added / Moved / Removed language
 * (locked: distinguish first-assignment "Added" from between-groups "Moved").
 *
 * Returns the change kind. Journal write is non-throwing (createJournalEntry
 * swallows its own errors) so a failed log never breaks the assignment.
 *
 * Used by all three assignment doors + the delete-group reassignment flow, so
 * the language is defined in exactly one place.
 */
export async function setInstanceGroup(
  supabase: SupabaseClient,
  params: {
    growInstanceId: string;
    userId: string;
    plantProfileId?: string | null;
    /** Destination group, or null to unassign (back to "All" only). */
    nextGroup: { id: string; name: string } | null;
    /** Prior memberships if already known (avoids a round-trip); falls back to fetchInstanceGroups. */
    priorGroups?: Group[];
  }
): Promise<GroupChangeKind> {
  const { growInstanceId, userId, plantProfileId = null, nextGroup } = params;
  const nextId = nextGroup?.id ?? null;
  const prior =
    params.priorGroups ?? (await fetchInstanceGroups(supabase, growInstanceId));
  // The "from" group for journal language: prefer a prior group that differs
  // from the destination (handles legacy multi-membership collapse gracefully).
  const priorPrimary = prior.find((g) => g.id !== nextId) ?? prior[0] ?? null;

  // No-op cases.
  if (!nextId && prior.length === 0) return "none";
  if (nextId && prior.length === 1 && prior[0]!.id === nextId) return "none";

  // Clear all existing memberships (single-membership enforcement + legacy cleanup).
  if (prior.length > 0) {
    const { error: delErr } = await supabase
      .from("plant_groups")
      .delete()
      .eq("grow_instance_id", growInstanceId)
      .eq("user_id", userId);
    if (delErr) {
      console.error("setInstanceGroup: clear failed", delErr);
      throw delErr;
    }
  }

  // Insert the new membership.
  if (nextId) {
    const { error: insErr } = await supabase
      .from("plant_groups")
      .insert({ grow_instance_id: growInstanceId, group_id: nextId, user_id: userId });
    if (insErr) {
      console.error("setInstanceGroup: insert failed", insErr);
      throw insErr;
    }
  }

  // Change kind + journal language.
  let kind: GroupChangeKind;
  let note: string;
  if (!priorPrimary && nextGroup) {
    kind = "added";
    note = `Added to ${nextGroup.name}`;
  } else if (priorPrimary && nextGroup) {
    kind = "moved";
    note = `Moved ${priorPrimary.name} → ${nextGroup.name}`;
  } else {
    // priorPrimary && !nextGroup
    kind = "removed";
    note = `Removed from ${priorPrimary!.name}`;
  }

  await createJournalEntry(supabase, {
    user_id: userId,
    entry_type: "group_change",
    plant_profile_id: plantProfileId,
    grow_instance_id: growInstanceId,
    note,
  });

  return kind;
}

/**
 * Instances currently assigned to a group, with plant_profile_id for journaling
 * on reassign. Used by the delete-group-with-plants edge case (count + reassign).
 */
export async function fetchGroupAssignments(
  supabase: SupabaseClient,
  groupId: string
): Promise<Array<{ grow_instance_id: string; user_id: string; plant_profile_id: string | null }>> {
  try {
    const { data, error } = await supabase
      .from("plant_groups")
      .select("grow_instance_id, user_id, grow_instances(plant_profile_id)")
      .eq("group_id", groupId);
    if (error) {
      console.error("fetchGroupAssignments: query failed", error);
      return [];
    }
    const rows = (data ?? []) as unknown as Array<{
      grow_instance_id: string;
      user_id: string;
      grow_instances: { plant_profile_id: string | null } | null;
    }>;
    return rows.map((r) => ({
      grow_instance_id: r.grow_instance_id,
      user_id: r.user_id,
      plant_profile_id: r.grow_instances?.plant_profile_id ?? null,
    }));
  } catch (err) {
    console.error("fetchGroupAssignments: unexpected error", err);
    return [];
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
        "id, plant_profile_id, sown_date, expected_harvest_date, status, ended_at, location, end_reason, seed_packet_id, created_at, user_id, deleted_at, sow_method, seeds_sown, seeds_sprouted, sprout_date, plant_count, is_permanent_planting, purchase_price, purchase_quantity, vendor, cover_photo_mode, cover_photo_journal_entry_id, plant_groups(groups(id, user_id, name, position, created_at, updated_at, deleted_at))"
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
