import { describe, it, expect } from "vitest";
import { isPreviouslyOwned } from "./previouslyOwned";

describe("isPreviouslyOwned (Sprint 13 — Library 'Previously owned')", () => {
  it("excludes a profile that never had a packet (Parsley false-positive fix)", () => {
    // Parsley: status was out_of_stock but it never had a packet → must NOT match.
    expect(isPreviouslyOwned({ ever_owned: false, packet_count: 0 })).toBe(false);
  });

  it("matches a profile with packet history but none in stock now", () => {
    expect(isPreviouslyOwned({ ever_owned: true, packet_count: 0 })).toBe(true);
  });

  it("excludes a profile that currently has packets in stock", () => {
    // Currently owned, not 'previously' — regardless of ever_owned.
    expect(isPreviouslyOwned({ ever_owned: true, packet_count: 2 })).toBe(false);
  });

  it("treats missing packet_count as zero", () => {
    expect(isPreviouslyOwned({ ever_owned: true })).toBe(true);
  });

  it("treats missing ever_owned as not-previously-owned", () => {
    expect(isPreviouslyOwned({ packet_count: 0 })).toBe(false);
  });
});
