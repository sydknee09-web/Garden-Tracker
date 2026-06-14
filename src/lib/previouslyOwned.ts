/**
 * Sprint 13 — "Previously owned" predicate for the Library/Vault grid.
 *
 * A variety is "previously owned" when the user HAD ≥1 packet of it at some point
 * (`ever_owned` — any packet row ever, including archived + soft-deleted/consumed history)
 * but has NONE in stock right now (`packet_count` is in-stock only).
 *
 * Replaces the old `plant_profiles.status ∈ {out_of_stock, archived}` proxy, which
 * false-matched profiles that never had a packet (the Parsley dogfood bug, Sprint 12 Phase 2 #73).
 */
export function isPreviouslyOwned(item: {
  ever_owned?: boolean;
  packet_count?: number | null;
}): boolean {
  return item.ever_owned === true && (item.packet_count ?? 0) === 0;
}
