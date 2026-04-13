# Logic & Leaf Protocol — Full Audit Report

**Date:** March 2026  
**Scope:** MASTER_PLAN.md + all linked docs, aligned with Logic & Leaf Protocol (MASTER_PLAN § Logic & Leaf Protocol)  
**Status:** Planned. Not yet implemented.

---

## 1. Summary of Logic & Leaf Protocol

| Rule | Description |
|------|-------------|
| **Leaf-only packing** | Only nodes with no children are packable. Boulder without pebbles = packable. Pebble without shards = packable. |
| **Containers** | Nodes with children are "landmarks" — not packable. Complete when all children are complete. |
| **Shards as actionable** | Shards become burnable tasks. Pebble with shards = container; shards are the packable leaves. |
| **Sub-boulders** | Boulders can have child boulders. Mixed logic via nesting. **Depth cap: 3 levels** (Peak → Boulder → Sub-Boulder → Pebble). |
| **Logic on pebbles** | Pebbles with shards have logic for their shards (sequential vs freeform). |
| **Validity Filter** | Pack logic respects sequentiality. For Climb parents, only first incomplete child is packable. |
| **Next-In-Line Promotion** | Burn X → next sibling becomes packable. |
| **UI for locked steps** | Grey or hide locked steps in Climb parents. |
| **Rune** | Packable = rune. Rune boulder, rune pebble, rune shard. Distinct rune visualization. See [RUNE_TERMINOLOGY_AUDIT.md](RUNE_TERMINOLOGY_AUDIT.md). |

---

## 2. Documents Requiring Updates

### 2.1 CRITICAL — Schema & Data Model

| Doc | Location | Current | Required Change |
|-----|----------|---------|------------------|
| **schema.sql** | §3 NODES, lines 100–105 | "Shards are visual-only: is_complete always stays FALSE. Only pebbles can enter the Satchel." | Add note: *Future (Logic & Leaf): Shards become actionable; pebble with shards = container. See MASTER_PLAN § Logic & Leaf Protocol.* |
| **schema.sql** | nodes table | No `logic_type` / `pebble_logic` on nodes | Migration adds `pebble_logic` (MASTER_LEDGER). Logic & Leaf extends: pebbles with shards need logic for shards. |
| **schema.sql** | nodes index | `nodes_user_satchel_candidates` filters `node_type = 'pebble'` | Future: extend to include packable shards (leaves). |
| **MASTER_LEDGER_ARCHITECTURE_OVERHAUL** | §2 Schema in Tree, lines 92–95 | "SHARD (nodes, parent = pebble) — Sub-tasks under a pebble." | Add: *Logic & Leaf: Shards become actionable. Pebble with shards = container; shards packable. See MASTER_PLAN § Logic & Leaf Protocol.* |
| **MASTER_LEDGER_ARCHITECTURE_OVERHAUL** | §2 Schema in Tree | Flat: Mountain → Boulder → Pebble → Shard | Add: *Logic & Leaf: Sub-boulders supported (Boulder → Boulder → Pebble). LTREE supports arbitrary depth.* |

---

### 2.2 CRITICAL — Satchel & Pack Logic

| Doc | Location | Current | Required Change |
|-----|----------|---------|------------------|
| **NAVIGATION_MAP** | §4 Pack Satchel flow, lines 154–163 | "run priority query (Due Date → Starred → FIFO)" | Add: *Future (Logic & Leaf): Validity Filter — pack only packable leaves; respect sequentiality (Climb parents). See MASTER_PLAN § Logic & Leaf Protocol.* |
| **MASTER_PLAN** | PHASE 6, line 175 | "Priority queue: Due Date -> Starred -> FIFO" | Add note: *Logic & Leaf: Validity Filter applies before priority. Leaf-only; sequential lock.* |
| **SATCHEL_PACK_ANIMATION_SPEC** | §1 Origin | "Stones animate from Marker positions on the Map" | Clarify: *Leaves (pebbles without shards, boulders without pebbles, or shards when pebble has shards) animate from their hierarchy position.* |

**Validity Filter implementation:** Postgres RPC (not client-side). DB returns only packable node IDs. Avoids round-trip death with 500+ shards. Single source of truth.

---

### 2.3 HIGH — Shards & Mallet

| Doc | Location | Current | Required Change |
|-----|----------|---------|------------------|
| **MASTER_PLAN** | PHASE 5, lines 163–164 | "Mallet on Pebble creates Shard (visual note)" | Add: *Logic & Leaf: Shards become actionable. Pebble with shards = container; shards packable. Mallet on Pebble creates shard (task) or splits pebble.* |
| **NAVIGATION_MAP** | §6 Mallet targets | "Mallet on Pebble → SPLIT: creates 1 new sibling Pebble" | Note: *Logic & Leaf: Mallet on Pebble may also create Shard (child) when breaking down into sub-tasks. Shards = actionable.* |
| **schema.sql** | RULES | "Burning a pebble cascades a delete of its child shards" | *Logic & Leaf: When shards are actionable, burning a shard marks it complete; pebble completes when all shards done. No cascade delete of shards.* |

---

### 2.4 HIGH — Hierarchy & Progress

| Doc | Location | Current | Required Change |
|-----|----------|---------|------------------|
| **PEAK_JOURNAL_SPEC** | §3 Progress | "Burned Pebbles vs Total Weight" | Add: *Logic & Leaf: Progress counts leaves (packable nodes). Containers (pebble with shards, boulder with pebbles) complete when all children done.* |
| **MASTER_PLAN** | PHASE 10, line 213 | "Peak progress bar: (burned_pebbles / total_pebbles) * 100" | Add: *Logic & Leaf: Count leaves (packable nodes) for progress. Containers contribute when all children burned.* |
| **MASTER_LEDGER** | §2 Schema in Tree | No sub-boulders | Add: *Logic & Leaf: Sub-boulders (Boulder → Boulder) supported. Each sub-boulder has pebble_logic.* |

---

### 2.5 MEDIUM — Promote & Lifecycle

| Doc | Location | Current | Required Change |
|-----|----------|---------|------------------|
| **GAPS_AND_ASSUMPTIONS** | §3 Promote + Pebbles with Shards | "Shards move with. Become pebbles in new Peak's first Milestone." | Add: *Logic & Leaf: When shards are actionable, Promote may move shards as pebbles (they are already tasks). Container pebbles: promote children (shards) as pebbles.* |
| **MASTER_LEDGER** | §6 Lifecycle, Promote | "Shards: Move with (become pebbles in new Peak's first Milestone)" | Same as GAPS. Logic & Leaf preserves: shards-as-tasks move as pebbles. |

---

### 2.6 MEDIUM — Hammer Refine Modal

| Doc | Location | Current | Required Change |
|-----|----------|---------|------------------|
| **HAMMER_REFINE_MODAL_SPEC** | §2 | "Shatter boulder into pebbles" | Add: *Logic & Leaf: Hammer may also shatter pebble into shards (actionable sub-tasks). Pebble becomes container.* |
| **MASTER_PLAN** | Part B 2.1 | "Hammer … splits a Stone (boulder) into Pebbles" | Add: *Logic & Leaf: Hammer may split pebble into shards. Stone = boulder or pebble (container).* |

---

### 2.7 LOW — Terminology & Cross-References

| Doc | Location | Current | Required Change |
|-----|----------|---------|------------------|
| **MASTER_PLAN** | Table of Contents | No Logic & Leaf entry | Add "Logic & Leaf Protocol" to TOC. |
| **GAPS_AND_ASSUMPTIONS** | §0 Scenario Coverage | "Pebbles in a landmark sequential" — pebble_logic | Add: *Logic & Leaf: Logic on pebbles for shards. Sub-boulders for mixed logic. Validity Filter in pack.* |
| **FEATURES_EXPANSION_DOC** | §4 Pebble Logic Toggle | "Phase 2: Add toggle … Sequential / Any order" | Add: *Logic & Leaf: Same. Also logic on pebbles for shards. Sub-boulders achieve mixed logic.* |
| **ALIGNMENT_OUTCOME_SPEC** | §8 Developer Pre-Flight | pebble_logic per marker | Add: *Logic & Leaf: logic_type / pebble_logic on pebbles (for shards). Sub-boulders.* |

---

## 3. Implementation Order (When Building Logic & Leaf)

1. **Schema** — Add `logic_type` or extend `pebble_logic`; shards get `is_complete` (or equivalent).
2. **Path builders** — Support sub-boulders (Boulder → Boulder → Pebble). Extend `ltree_path.dart`. **Depth cap: 3 levels.**
3. **Postgres RPC for packable candidates** — Validity Filter lives in DB. Single RPC returns packable node IDs. Do NOT do client-side filtering with 500+ nodes.
4. **`isPackable(node)`** — Client-side helper for UI; DB RPC is source of truth for pack.
5. **SatchelRepository** — Call Postgres RPC for packable IDs; apply Due Date → Starred → FIFO in DB or client.
6. **Burn logic** — Shards burnable; pebble completes when all shards done.
7. **Progress** — Count leaves; containers complete when children done.
8. **UI** — Grey/hide locked steps in Climb parents.
9. **Mallet/Hammer** — Create shards under pebble; pebble becomes container. **High-impact shatter animation** — payoff for leaf-only packing.
10. **Demo mode** — Repository pattern. `SupabaseRepository` vs `MockLocalRepository` = toggle. UI talks to `DataRepository` only.

---

## 4. Backward Compatibility

- **Existing data:** Pebbles without shards remain packable (current behavior). Shards remain visual-only until migration.
- **Migration path:** Add columns; default shards to non-actionable (or migrate). No breaking change to current flows until Logic & Leaf is implemented.

---

## 5. Resolved (No Change Needed)

| Doc | Reason |
|-----|--------|
| **ELIAS_DIALOGUE_REFERENCE** | No hierarchy/satchel logic. |
| **GRACE_DAY_STREAK_SPEC** | Unrelated to Logic & Leaf. |
| **RLS_VERIFICATION** | Unrelated. |
| **WHETSTONE_CHOICE_OVERLAY_SPEC** | Unrelated. |
| **ELIAS_INTRODUCTION_SPEC** | Unrelated. |

---

**End of Logic & Leaf Protocol Audit.**
