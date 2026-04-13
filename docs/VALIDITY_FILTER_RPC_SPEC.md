# Validity Filter RPC Spec — get_packable_candidates

**Purpose:** Postgres-side "brain" for the Satchel. Returns only nodes that are valid to pack (leaf, layout-gated, sequential-gated, not already packed).  
**Status:** Implementation-ready  
**Related:** [PRE_FLIGHT_ARCHITECTURE_SPEC.md](PRE_FLIGHT_ARCHITECTURE_SPEC.md), [LOGIC_LEAF_PROTOCOL_AUDIT.md](LOGIC_LEAF_PROTOCOL_AUDIT.md)

---

## Signature

```sql
get_packable_candidates(
  p_user_id UUID,
  p_limit INT DEFAULT 10,
  p_exclude_ids UUID[] DEFAULT '{}'
)
RETURNS SETOF nodes
```

**p_exclude_ids:** Node IDs to exclude (e.g. already assigned during pack flow). Pass empty array when not needed.

Or for lighter payload (IDs only):

```sql
get_packable_candidates(p_user_id UUID, p_limit INT DEFAULT 10)
RETURNS TABLE (node_id UUID)
```

**Recommendation:** Return `SETOF nodes` so the client gets full node rows in one call. Limit keeps payload small.

---

## Packability Rules

A node is packable iff:

1. **Leaf:** No children exist (no node has this node's path as ancestor).
2. **Layout gate:** For Climb peaks, only nodes under the *first incomplete boulder* (by `order_index`). For Survey, all leaves under the peak.
3. **Sequential gate:** If the parent boulder has `pebble_logic = 'sequential'`, only the *first incomplete leaf* among siblings is packable.
4. **Not packed:** Node ID not in `satchel_slots` for this user.
5. **Not complete:** `is_complete = false`.
6. **User-scoped:** `user_id = p_user_id`.

---

## Previous Limitation (Resolved by First Blockage)

*Before migration 20250320000004:* Climb gated only on the *first incomplete top-level boulder* (`nlevel(path) = 2`), so completing Office meant Kitchen’s sub-boulders (e.g. Organize Pantry) never became packable. **Now:** Gatekeeper (First Blockage) finds the highest incomplete ancestor in depth-first order; nested boulders unlock correctly. Survey unchanged.

---

## First Blockage Rule (Implemented)

**Implemented** in migration `supabase/migrations/20250320000004_first_blockage_refactor.sql`. See [POST_V1_ROADMAP](POST_V1_ROADMAP.md) § 2 for Naive vs Gatekeeper and tree diagram.

### The "Highest Incomplete Ancestor" (Gatekeeper)

Instead of a fixed `nlevel = 2` root, find the node that is the **First Blockage** in a depth-first journey:

1. **First-Child-First traversal:** Start at mountain root. For each level, take the first child by `order_index ASC, created_at ASC`.
2. **Gatekeeper:** The first node encountered that has `is_complete = false` becomes the **Root** for the `unlocked` CTE.
3. **Path:** If Office is 100% complete → move to Kitchen. If Kitchen is incomplete → Gatekeeper. If Kitchen is complete but has sub-boulders → descend to first incomplete sub-boulder (e.g. Organize Pantry). That sub-boulder becomes the sub-gatekeeper; its leaves are packable.

### Reworking the `unlocked` CTE

- **Current:** Recursion starts at depth 2 (top-level boulders) and moves down.
- **Planned:** The Root is no longer a fixed level. Recursion starts at `Gatekeeper.path` and descends to leaves.
- **Constraint:** In Climb, descend only into the first incomplete child at each level. In Survey, descend into all children.

### Technical Implications & Risks

| Priority | Risk | Mitigation |
|----------|------|------------|
| High | Complexity of SQL | Build "Highest Incomplete" as standalone CTE first. |
| Medium | Logic drift (Survey) | Strictly define: only Climb uses gatekeeper; Survey remains open field. |
| Low | Performance | LTREE index; `path <@ gatekeeper.path` grabs subtree. Sub-millisecond. |

### Survey Exception

**Must not** accidentally "Climb-ify" Survey. In Survey, every incomplete top-level boulder acts as a root; every branch within them is wide open. The refactor applies **only** to `layout_type = 'climb'`.

---

## SQL Logic (Pseudocode)

```
WITH leaves AS (
  SELECT n.*
  FROM nodes n
  WHERE n.user_id = p_user_id
    AND n.is_complete = false
    AND NOT EXISTS (
      SELECT 1 FROM nodes c
      WHERE c.user_id = n.user_id
        AND c.path <@ n.path
        AND nlevel(c.path) = nlevel(n.path) + 1
    )
),
layout_filtered AS (
  -- For Climb: restrict to first incomplete boulder's subtree
  -- For Survey: keep all leaves under peak
  -- Join to mountains for layout_type
  ...
),
sequential_filtered AS (
  -- For each boulder with pebble_logic = 'sequential',
  -- keep only the first incomplete leaf among its direct children
  ...
),
not_packed AS (
  SELECT lf.*
  FROM layout_filtered lf
  WHERE NOT EXISTS (
    SELECT 1 FROM satchel_slots ss
    WHERE ss.user_id = p_user_id AND ss.node_id = lf.id
  )
)
SELECT * FROM not_packed
ORDER BY is_starred DESC NULLS LAST, due_date ASC NULLS LAST, created_at ASC
LIMIT p_limit;
```

---

## Implementation Notes

- **Leaf check:** `NOT EXISTS (SELECT 1 FROM nodes c WHERE c.path <@ n.path AND nlevel(c.path) = nlevel(n.path) + 1)` — no direct children.
- **Layout:** Join `nodes` → `mountains` (via path or `mountain_id` if present). Use `mountains.layout_type`.
- **First incomplete boulder (Climb):** *Current:* Order top-level boulders (`nlevel = 2`) by `order_index`, find first with `is_complete = false`, restrict leaves to that subtree. *Planned:* "First Blockage" rule—Highest Incomplete Ancestor at any depth as gatekeeper. See § Planned Refactor.
- **Sequential:** For each boulder with `pebble_logic = 'sequential'`, among its direct children (pebbles/sub-boulders), find first incomplete; among that node's leaves, only the first incomplete leaf is packable. Recursive for sub-boulders.
- **RLS:** Function runs as `SECURITY DEFINER` with `search_path = public`. Filter all queries by `p_user_id` (or `auth.uid()` if called from authenticated context).

---

## Edge Cases

- **Empty result:** Return empty. Satchel stays empty.
- **All complete:** No leaves with `is_complete = false` → empty.
- **All packed:** All valid leaves already in satchel_slots → empty.
- **No mountains:** User has no peaks → empty.

---

## Full Implementation

See `supabase/migrations/20250320000002_get_packable_candidates_rpc.sql` for executable SQL.

**Return:** `SETOF nodes` — full node rows including `node_type` so client knows Pebble vs Shard without second fetch.

**Ordering:** `ORDER BY order_index ASC, created_at ASC` for sibling fallback; final sort `is_starred DESC, due_date ASC, created_at ASC`.

---

**End of Validity Filter RPC Spec.**
