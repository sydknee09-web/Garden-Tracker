import { describe, it, expect, vi } from "vitest";
import { cascadeForDeletedPackets } from "./cascadeOnPacketDelete";
import { makeSbChain } from "@/test/helpers";

function makeMockClient(growsResult?: { id: string; user_id: string }[]) {
  const mockFrom = vi.fn((table: string) => {
    if (table === "grow_instances" && growsResult !== undefined) {
      return {
        select: vi.fn(() => ({
          in: vi.fn(() => ({
            is: vi.fn(() =>
              Promise.resolve({ data: growsResult, error: null })
            ),
          })),
        })),
        update: vi.fn(() => makeSbChain()),
      };
    }
    return makeSbChain();
  });
  return { from: mockFrom };
}

describe("cascadeForDeletedPackets", () => {
  it("returns immediately when packetIds is empty", async () => {
    const sb = makeMockClient();
    await expect(
      cascadeForDeletedPackets(
        sb as never,
        [],
        "user-1",
        { deleteGrowInstances: false }
      )
    ).resolves.toBeUndefined();
    expect(sb.from).not.toHaveBeenCalled();
  });

  it("soft-deletes packets and journal entries when deleteGrowInstances is false", async () => {
    const sb = makeMockClient([]);
    await cascadeForDeletedPackets(
      sb as never,
      ["packet-1", "packet-2"],
      "user-1",
      { deleteGrowInstances: false }
    );
    // seed_packets update
    expect(sb.from).toHaveBeenCalledWith("seed_packets");
    // journal_entries update
    expect(sb.from).toHaveBeenCalledWith("journal_entries");
    // grow_instances — clear seed_packet_id only
    expect(sb.from).toHaveBeenCalledWith("grow_instances");
    // tasks should NOT be touched
    expect(sb.from).not.toHaveBeenCalledWith("tasks");
  });

  it("soft-deletes packets, journal, grows, and tasks when deleteGrowInstances is true", async () => {
    const sb = makeMockClient([{ id: "grow-1", user_id: "user-1" }]);
    await cascadeForDeletedPackets(
      sb as never,
      ["packet-1"],
      "user-1",
      { deleteGrowInstances: true }
    );
    expect(sb.from).toHaveBeenCalledWith("seed_packets");
    expect(sb.from).toHaveBeenCalledWith("journal_entries");
    expect(sb.from).toHaveBeenCalledWith("grow_instances");
    expect(sb.from).toHaveBeenCalledWith("tasks");
  });

  it("does not touch tasks when deleteGrowInstances is true but no grows are found", async () => {
    const sb = makeMockClient([]);
    await cascadeForDeletedPackets(
      sb as never,
      ["packet-1"],
      "user-1",
      { deleteGrowInstances: true }
    );
    expect(sb.from).not.toHaveBeenCalledWith("tasks");
  });

  it("throws when an unexpected error is thrown by the DB call", async () => {
    const mockFrom = vi.fn(() => {
      throw new Error("DB connection lost");
    });
    const sb = { from: mockFrom };
    await expect(
      cascadeForDeletedPackets(
        sb as never,
        ["packet-1"],
        "user-1",
        { deleteGrowInstances: false }
      )
    ).rejects.toThrow("DB connection lost");
  });
});
