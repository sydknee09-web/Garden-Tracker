import { describe, it, expect, vi } from "vitest";
import {
  fetchUserGroups,
  fetchInstanceGroups,
  assignInstanceToGroup,
  unassignInstanceFromGroup,
  createGroup,
  renameGroup,
  deleteGroup,
  updateGroupPositions,
  fetchAllUserGrowInstances,
  setInstanceGroup,
  fetchGroupAssignments,
} from "./groups";

/** sb mock that records journal_entries inserts + plant_groups ops (for setInstanceGroup tests). */
function makeSbCapture() {
  const journalInserts: Array<Record<string, unknown>> = [];
  const plantGroupOps: string[] = [];
  const sb = {
    from: vi.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      Object.assign(chain, {
        select: vi.fn(() => chain),
        insert: vi.fn((arg: Record<string, unknown>) => {
          if (table === "journal_entries") journalInserts.push(arg);
          if (table === "plant_groups") plantGroupOps.push("insert");
          return chain;
        }),
        update: vi.fn(() => chain),
        delete: vi.fn(() => {
          if (table === "plant_groups") plantGroupOps.push("delete");
          return chain;
        }),
        eq: vi.fn(() => chain),
        is: vi.fn(() => chain),
        order: vi.fn(() => chain),
        single: vi.fn(() => Promise.resolve({ data: { id: "je-1" }, error: null })),
        then: (resolve: (v: { data: unknown; error: unknown }) => void) =>
          Promise.resolve({ data: [], error: null }).then(resolve),
      });
      return chain;
    }),
  };
  return { sb, journalInserts, plantGroupOps };
}

function makeChain(result: { data?: unknown; error?: unknown } = {}) {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    is: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(() =>
      Promise.resolve({ data: result.data ?? null, error: result.error ?? null })
    ),
  };
  type Thenable = {
    then: (resolve: (v: { data: unknown; error: unknown }) => void) => Promise<void>;
  };
  (chain as unknown as Thenable).then = (
    resolve: (v: { data: unknown; error: unknown }) => void
  ) =>
    Promise.resolve({
      data: result.data ?? [],
      error: result.error ?? null,
    }).then(resolve);
  return chain;
}

describe("groups helpers", () => {
  it("fetchUserGroups queries groups by user_id, filters soft-deleted, orders by position then created_at", async () => {
    const chain = makeChain({
      data: [
        { id: "g1", user_id: "u1", name: "Patio", position: 0, created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null },
      ],
    });
    const sb = { from: vi.fn(() => chain) };
    const result = await fetchUserGroups(sb as never, "u1");

    expect(sb.from).toHaveBeenCalledWith("groups");
    expect(chain.select).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
    expect(chain.order).toHaveBeenCalledWith("position", {
      ascending: true,
      nullsFirst: false,
    });
    expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe("Patio");
  });

  it("fetchInstanceGroups joins plant_groups → groups and flattens nested rows", async () => {
    const chain = makeChain({
      data: [
        { groups: { id: "g1", user_id: "u1", name: "Patio", position: 0, created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null } },
        { groups: { id: "g2", user_id: "u1", name: "Bedroom", position: 1, created_at: "2026-01-02", updated_at: "2026-01-02", deleted_at: null } },
        { groups: null },
        { groups: { id: "g3", user_id: "u1", name: "Stale", position: null, created_at: "2026-01-03", updated_at: "2026-01-03", deleted_at: "2026-01-04" } },
      ],
    });
    const sb = { from: vi.fn(() => chain) };
    const result = await fetchInstanceGroups(sb as never, "gi-1");

    expect(sb.from).toHaveBeenCalledWith("plant_groups");
    expect(chain.eq).toHaveBeenCalledWith("grow_instance_id", "gi-1");
    expect(result.map((g) => g.name)).toEqual(["Patio", "Bedroom"]);
  });

  it("assignInstanceToGroup inserts plant_groups row with denormalized user_id", async () => {
    const chain = makeChain();
    const sb = { from: vi.fn(() => chain) };
    await assignInstanceToGroup(sb as never, "gi-1", "g-1", "u-1");

    expect(sb.from).toHaveBeenCalledWith("plant_groups");
    expect(chain.insert).toHaveBeenCalledWith({
      grow_instance_id: "gi-1",
      group_id: "g-1",
      user_id: "u-1",
    });
  });

  it("unassignInstanceFromGroup hard-deletes by compound match including user_id", async () => {
    const chain = makeChain();
    const sb = { from: vi.fn(() => chain) };
    await unassignInstanceFromGroup(sb as never, "gi-1", "g-1", "u-1");

    expect(sb.from).toHaveBeenCalledWith("plant_groups");
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("grow_instance_id", "gi-1");
    expect(chain.eq).toHaveBeenCalledWith("group_id", "g-1");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "u-1");
  });

  it("createGroup inserts groups row with user_id and name; returns the created row", async () => {
    const chain = makeChain({
      data: {
        id: "g-new",
        user_id: "u-1",
        name: "New Group",
        position: null,
        created_at: "2026-05-29",
        updated_at: "2026-05-29",
        deleted_at: null,
      },
    });
    const sb = { from: vi.fn(() => chain) };
    const result = await createGroup(sb as never, "u-1", "New Group");

    expect(sb.from).toHaveBeenCalledWith("groups");
    expect(chain.insert).toHaveBeenCalledWith({ user_id: "u-1", name: "New Group" });
    expect(chain.single).toHaveBeenCalled();
    expect(result?.id).toBe("g-new");
    expect(result?.position).toBeNull();
  });

  it("renameGroup updates groups.name and bumps updated_at", async () => {
    const chain = makeChain();
    const sb = { from: vi.fn(() => chain) };
    await renameGroup(sb as never, "g-1", "Renamed");

    expect(sb.from).toHaveBeenCalledWith("groups");
    expect(chain.update).toHaveBeenCalled();
    const updateArg = chain.update.mock.calls[0]![0] as { name: string; updated_at: string };
    expect(updateArg.name).toBe("Renamed");
    expect(typeof updateArg.updated_at).toBe("string");
    expect(chain.eq).toHaveBeenCalledWith("id", "g-1");
  });

  it("deleteGroup hard-deletes plant_groups assignments THEN soft-deletes the group", async () => {
    const calls: Array<{ table: string; op: string }> = [];
    const sb = {
      from: vi.fn((table: string) => {
        const chain = makeChain();
        const originalDelete = chain.delete;
        const originalUpdate = chain.update;
        chain.delete = vi.fn((...args) => {
          calls.push({ table, op: "delete" });
          return originalDelete(...args);
        });
        chain.update = vi.fn((...args) => {
          calls.push({ table, op: "update" });
          return originalUpdate(...args);
        });
        return chain;
      }),
    };
    await deleteGroup(sb as never, "g-1");

    expect(calls).toEqual([
      { table: "plant_groups", op: "delete" },
      { table: "groups", op: "update" },
    ]);
  });

  it("updateGroupPositions issues sequential UPDATE per group with new position + updated_at", async () => {
    const updateCalls: Array<{ id: string; position: number }> = [];
    const sb = {
      from: vi.fn(() => {
        const chain = makeChain();
        const originalUpdate = chain.update;
        chain.update = vi.fn((arg: { position: number; updated_at: string }) => {
          const eqOriginal = chain.eq;
          chain.eq = vi.fn((col: string, val: string) => {
            if (col === "id") updateCalls.push({ id: val, position: arg.position });
            return eqOriginal(col, val);
          });
          return originalUpdate(arg);
        });
        return chain;
      }),
    };
    await updateGroupPositions(sb as never, [
      { id: "g-1", position: 0 },
      { id: "g-2", position: 1 },
      { id: "g-3", position: 2 },
    ]);

    expect(updateCalls).toEqual([
      { id: "g-1", position: 0 },
      { id: "g-2", position: 1 },
      { id: "g-3", position: 2 },
    ]);
  });

  it("fetchAllUserGrowInstances filters by user + deleted_at, flattens plant_groups → groups[]", async () => {
    const chain = makeChain({
      data: [
        {
          id: "gi-1",
          plant_profile_id: "pp-1",
          sown_date: "2026-04-01",
          expected_harvest_date: null,
          status: "growing",
          ended_at: null,
          location: null,
          end_reason: null,
          seed_packet_id: null,
          created_at: "2026-04-01",
          user_id: "u-1",
          deleted_at: null,
          sow_method: null,
          seeds_sown: null,
          seeds_sprouted: null,
          sprout_date: null,
          plant_count: 1,
          is_permanent_planting: false,
          purchase_price: null,
          purchase_quantity: null,
          vendor: null,
          plant_groups: [
            { groups: { id: "g1", user_id: "u-1", name: "Patio", position: 0, created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null } },
            { groups: null },
          ],
        },
        {
          id: "gi-2",
          plant_profile_id: "pp-2",
          sown_date: "2026-03-01",
          expected_harvest_date: null,
          status: "growing",
          ended_at: null,
          location: null,
          end_reason: null,
          seed_packet_id: null,
          created_at: "2026-03-01",
          user_id: "u-1",
          deleted_at: null,
          sow_method: null,
          seeds_sown: null,
          seeds_sprouted: null,
          sprout_date: null,
          plant_count: 1,
          is_permanent_planting: true,
          purchase_price: null,
          purchase_quantity: null,
          vendor: null,
          plant_groups: null,
        },
      ],
    });
    const sb = { from: vi.fn(() => chain) };
    const result = await fetchAllUserGrowInstances(sb as never, "u-1");

    expect(sb.from).toHaveBeenCalledWith("grow_instances");
    expect(chain.eq).toHaveBeenCalledWith("user_id", "u-1");
    expect(chain.is).toHaveBeenCalledWith("deleted_at", null);
    expect(chain.order).toHaveBeenCalledWith("sown_date", { ascending: false });

    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe("gi-1");
    expect(result[0]!.groups).toHaveLength(1);
    expect(result[0]!.groups![0]!.name).toBe("Patio");
    expect(result[1]!.id).toBe("gi-2");
    expect(result[1]!.groups).toEqual([]);
    // confirm both annual + perennial returned by the unified fetch
    expect(result[0]!.is_permanent_planting).toBe(false);
    expect(result[1]!.is_permanent_planting).toBe(true);
  });

  // -------------------------------------------------------------------------
  // setInstanceGroup — single-membership + Added/Moved/Removed journal language
  // -------------------------------------------------------------------------
  const grp = (id: string, name: string) => ({
    id, user_id: "u-1", name, position: 0, created_at: "2026-01-01", updated_at: "2026-01-01", deleted_at: null,
  });

  it("setInstanceGroup: no prior + next → 'added', journals 'Added to {name}'", async () => {
    const { sb, journalInserts, plantGroupOps } = makeSbCapture();
    const kind = await setInstanceGroup(sb as never, {
      growInstanceId: "gi-1", userId: "u-1", plantProfileId: "pp-1",
      nextGroup: { id: "g-1", name: "Patio" }, priorGroups: [],
    });
    expect(kind).toBe("added");
    expect(plantGroupOps).toContain("insert");
    expect(plantGroupOps).not.toContain("delete"); // no prior to clear
    expect(journalInserts).toHaveLength(1);
    expect(journalInserts[0]!.entry_type).toBe("group_change");
    expect(journalInserts[0]!.note).toBe("Added to Patio");
  });

  it("setInstanceGroup: prior A + next B → 'moved', journals 'Moved A → B', clears then inserts", async () => {
    const { sb, journalInserts, plantGroupOps } = makeSbCapture();
    const kind = await setInstanceGroup(sb as never, {
      growInstanceId: "gi-1", userId: "u-1", plantProfileId: "pp-1",
      nextGroup: { id: "g-2", name: "Bedroom" }, priorGroups: [grp("g-1", "Patio")],
    });
    expect(kind).toBe("moved");
    expect(plantGroupOps).toEqual(["delete", "insert"]);
    expect(journalInserts[0]!.note).toBe("Moved Patio → Bedroom");
  });

  it("setInstanceGroup: prior A + next null → 'removed', journals 'Removed from A', clears only", async () => {
    const { sb, journalInserts, plantGroupOps } = makeSbCapture();
    const kind = await setInstanceGroup(sb as never, {
      growInstanceId: "gi-1", userId: "u-1", plantProfileId: "pp-1",
      nextGroup: null, priorGroups: [grp("g-1", "Patio")],
    });
    expect(kind).toBe("removed");
    expect(plantGroupOps).toEqual(["delete"]);
    expect(journalInserts[0]!.note).toBe("Removed from Patio");
  });

  it("setInstanceGroup: same group (prior === next) → 'none', no writes", async () => {
    const { sb, journalInserts, plantGroupOps } = makeSbCapture();
    const kind = await setInstanceGroup(sb as never, {
      growInstanceId: "gi-1", userId: "u-1", plantProfileId: "pp-1",
      nextGroup: { id: "g-1", name: "Patio" }, priorGroups: [grp("g-1", "Patio")],
    });
    expect(kind).toBe("none");
    expect(plantGroupOps).toEqual([]);
    expect(journalInserts).toHaveLength(0);
  });

  it("fetchGroupAssignments returns grow_instance_id + plant_profile_id per assignment", async () => {
    const chain = makeChain({
      data: [
        { grow_instance_id: "gi-1", user_id: "u-1", grow_instances: { plant_profile_id: "pp-1" } },
        { grow_instance_id: "gi-2", user_id: "u-1", grow_instances: null },
      ],
    });
    const sb = { from: vi.fn(() => chain) };
    const result = await fetchGroupAssignments(sb as never, "g-1");
    expect(sb.from).toHaveBeenCalledWith("plant_groups");
    expect(chain.eq).toHaveBeenCalledWith("group_id", "g-1");
    expect(result).toEqual([
      { grow_instance_id: "gi-1", user_id: "u-1", plant_profile_id: "pp-1" },
      { grow_instance_id: "gi-2", user_id: "u-1", plant_profile_id: null },
    ]);
  });
});
