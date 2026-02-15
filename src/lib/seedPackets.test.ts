import { describe, it, expect } from "vitest";
import type { SeedPacket } from "@/types/garden";
import { SEED_PACKET_PROFILE_SELECT } from "./seedPackets";

describe("seedPackets", () => {
  it("SEED_PACKET_PROFILE_SELECT includes storage_location (required by plant profile page)", () => {
    const columns = SEED_PACKET_PROFILE_SELECT.split(",").map((c) => c.trim());
    expect(columns).toContain("storage_location");
  });

  it("SeedPacket type allows storage_location so DB column is expected", () => {
    const packet: SeedPacket = {
      id: "p1",
      plant_profile_id: "pp1",
      user_id: "u1",
      qty_status: 100,
      storage_location: "Green box",
    };
    expect(packet.storage_location).toBe("Green box");
  });
});
