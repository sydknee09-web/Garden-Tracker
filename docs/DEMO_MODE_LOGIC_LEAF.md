# Demo Mode — Logic & Leaf Heuristic

**Purpose:** Define pack behavior when Supabase is not used (offline/demo).  
**Status:** Locked  
**Related:** [PRE_FLIGHT_ARCHITECTURE_SPEC.md](PRE_FLIGHT_ARCHITECTURE_SPEC.md), [VALIDITY_FILTER_RPC_SPEC.md](VALIDITY_FILTER_RPC_SPEC.md)

---

## Strategy: Simplified Heuristic

**Do not replicate full Postgres logic in Dart.** Maintenance nightmare and drift risk.

**Demo pack logic:** Return all **leaf** nodes (nodes with no children) that are incomplete and not packed.

---

## What Demo Gets

| Feature | Sanctuary (Supabase) | Demo |
|---------|----------------------|------|
| Leaf-only packing | ✓ | ✓ |
| Layout gate (Climb vs Survey) | ✓ | ✗ |
| Sequential gate (pebble_logic) | ✓ | ✗ |
| Priority (Starred → Due → FIFO) | ✓ | ✓ (client-side sort) |

---

## Compromise

**Sequential and Layout gates are "Sanctuary-only" features.**  
Encourages users to create an account for the full experience.

---

## Implementation

- `SatchelRepository` (or equivalent) has two implementations: `SupabaseSatchelRepository` and `DemoSatchelRepository`.
- `SupabaseSatchelRepository.packableCandidates()` → calls `get_packable_candidates` RPC.
- `DemoSatchelRepository.packableCandidates()` → filters in-memory: leaf only, `is_complete = false`, not in satchel. Sort by starred, due_date, created_at.

---

**End of Demo Mode Logic & Leaf.**
