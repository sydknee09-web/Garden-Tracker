# Pre-Flight Architecture Spec — Logic & Leaf Implementation

**Purpose:** Close the critical engineering bottlenecks before building UI. These sit at the bottom of the stack; if they shift, everything above (Riverpod, UI, animations) breaks.  
**Status:** Locked — implementation-ready  
**Related:** [MASTER_PLAN.md](MASTER_PLAN.md) § Logic & Leaf Protocol, [LOGIC_LEAF_PROTOCOL_AUDIT.md](LOGIC_LEAF_PROTOCOL_AUDIT.md)

---

## 1. Validity Filter RPC — "The Brain of the Pack"

**Do not leave pack logic to the client.** It kills the "polished and smooth" feel.

### Signature

```sql
get_packable_candidates(p_user_id UUID, p_limit INT)
RETURNS SETOF nodes
```

Or, if returning IDs only for lighter payload:

```sql
get_packable_candidates(p_user_id UUID, p_limit INT)
RETURNS TABLE (node_id UUID)
```

### Logic (Pseudocode)

A node is packable if:

1. **Leaf check:** No children exist (`WHERE NOT EXISTS` — no node has this node's path as ancestor).
2. **Layout gate:** For Climb peaks, only return nodes under the *first incomplete boulder* (by `order_index` or path). For Survey, all leaves under the peak. **Limitation:** Climb currently gates on top-level boulders only (`nlevel = 2`); sub-boulders under a complete top-level boulder never unlock. Planned refactor: "First Blockage" rule. See [VALIDITY_FILTER_RPC_SPEC.md](VALIDITY_FILTER_RPC_SPEC.md).
3. **Sequential gate:** If parent boulder has `pebble_logic = 'sequential'`, only return the *first incomplete leaf* among siblings (by `order_index`).
4. **Exclude packed:** Exclude node IDs already in `satchel_slots` for this user.
5. **Exclude complete:** `is_complete = false`.

### Priority (Inside SQL)

Keep sorting in the DB for predictability:

- **Starred** first (`is_starred DESC`)
- **Due date** next (`due_date ASC` nulls last)
- **FIFO** (`created_at ASC`)

### Implementation Notes

- Use `ltree` operators (`@>`, `<@`) for ancestor/descendant checks.
- Join to `mountains` for `layout_type`.
- Join to parent node for `pebble_logic` when checking sequential gate.
- RLS: function must run as `SECURITY DEFINER` with `search_path = public` and filter by `p_user_id` (or use `auth.uid()`).

---

## 2. Shard Burn & Progress — "The Soul of the Loop"

Shards don't "die" (delete); they "extinguish" (complete). Mini-task manager.

### Schema

**Existing:** `nodes` already has `is_complete`, `completed_at`. Shards are nodes with `node_type = 'shard'`.

**Migration:** None for columns. **Behavior change:** Shards can have `is_complete = true`. Remove the app-layer rule that "shards always stay FALSE."

**Migration sketch (if needed):**

```sql
-- No schema change. Document: shards now use is_complete.
-- Optional: Add comment to nodes table.
COMMENT ON COLUMN nodes.is_complete IS 'For pebbles and shards (Logic & Leaf). Shards extinguish; pebbles complete when all shards done.';
```

### Cascade Trigger

When a **Shard** is updated to `is_complete = true`:

1. Find the parent Pebble (path = shard's path with last segment removed).
2. Check if all sibling Shards are complete.
3. If yes, set parent Pebble `is_complete = true`, `completed_at = NOW()`.

**Trigger sketch:**

```sql
CREATE OR REPLACE FUNCTION check_pebble_completion_on_shard_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_parent_path ltree;
  v_incomplete_count int;
BEGIN
  IF NEW.node_type = 'shard' AND NEW.is_complete = true THEN
    v_parent_path := subpath(NEW.path, 0, nlevel(NEW.path) - 1);
    
    SELECT COUNT(*) INTO v_incomplete_count
    FROM nodes
    WHERE path <@ v_parent_path
      AND nlevel(path) = nlevel(v_parent_path) + 1  -- direct children only (sibling shards)
      AND node_type = 'shard'
      AND is_complete = false
      AND user_id = NEW.user_id;
    
    IF v_incomplete_count = 0 THEN
      UPDATE nodes
      SET is_complete = true, completed_at = NOW(), updated_at = NOW()
      WHERE path = v_parent_path AND user_id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_shard_complete_check_pebble
  AFTER UPDATE OF is_complete ON nodes
  FOR EACH ROW
  WHEN (NEW.node_type = 'shard' AND NEW.is_complete = true)
  EXECUTE FUNCTION check_pebble_completion_on_shard_update();
```

**Note:** Recursive completion (pebble → boulder → mountain) can be added if needed. For MVP, pebble completion is enough.

### Burn Logic (App)

- **burnNode(nodeId):** Set `is_complete = true`, `completed_at = NOW()`, `is_archived = true`. No delete. Trigger cascades to parent. Clear satchel slot.
- **Shards extinguish** — rows stay; weight transforms into Light (progress). Preserves Sanctuary history.
- **Burn Pebble (with shards):** Invalid—pebble with shards is a container, not packable. Should never be in satchel.

---

## 3. Progress Calculation

**Do not calculate on device.** Use Postgres.

**Option A — Generated Column:** Not ideal for recursive hierarchy.

**Option B — View:** Create a view that joins nodes to mountains and computes leaf counts per peak. Materialized if needed for performance.

**Option C — Function:** `get_peak_progress(p_mountain_id UUID)` returns `(burned_count, total_count)`.

**Recommendation:** Start with a **Postgres function** or **view** that counts leaves (`WHERE NOT EXISTS` child) and `is_complete = true` for burned. Call from Flutter when loading Peak Journal. Cache in Riverpod if needed.

---

## 4. Hammer — One Modal, Two Contexts

**Same Refine Modal; context determines behavior.**

| Context | Action | UI Label |
|---------|--------|----------|
| **Boulder** (container) | Shatter into Pebbles | "Shatter into Pebbles" |
| **Pebble** (container) | Refine into Shards | "Refine into Shards" |

**UI cue:** Hammer glows/appears on a Pebble in the Satchel **only if** that pebble has no shards yet (i.e. it's a leaf and could be refined) or has shards (container—shouldn't be in satchel per leaf-only; but if user added it before Logic & Leaf, allow refine). For leaf pebbles: show Hammer so user can "Refine into Shards" and break it down. For containers: Hammer to add more shards.

**Clarification:** With leaf-only packing, only leaves are in the Satchel. So a Pebble in the Satchel is a **Rune Pebble** (no shards). Hammer on it = "Refine into Shards" — user breaks it into sub-tasks. After refine, pebble becomes container; its shards (new leaves) become packable.

---

## 5. Sub-Boulder Creation — Mallet Menu

When user applies **Mallet** to a **Boulder** on the Map:

**Show a bottom-sheet menu** (not radial). More accessible for one-handed thumb use; allows descriptive labels.

- **[+] New Sub-Boulder (Landmark)** — Creates child boulder. Path: `parent_path.{new_boulder_id}`.
- **[+] New Pebble (Rune)** — Creates pebble (existing behavior).

**Path builder:** `buildChildPath(parentPath, newId)` in `ltree_path.dart`.

**Depth-agnostic creation:** `createNodeUnderParent(parentPath, mountainId, nodeType, title)` — use for Hammer and Mallet at any depth. Replaces path-level hacks.

**Depth cap:** Use `maxDepthReached(path)` / `canAddSubBoulder(path)`. If depth ≥ 3 (sub-boulder level), disable "New Sub-Boulder"; only offer "New Pebble".

---

## 6. Forest Threshold — Flow & Timing

**Integration:** Use Forest as a **crossfade overlay on EntranceScreen**. Not a separate route.

**Flow:**

1. **Splash / Auth check** — App launch. Check auth state.
2. **If not authed** → Auth screen.
3. **If authed:**
   - **If `has_seen_elias_intro = false`** → Play full Intro sequence (Forest fades as part of Beat 1, then 5 beats, Wizard, Whetstone).
   - **If `has_seen_elias_intro = true`** → EntranceScreen shows Forest image (1s hold) → Crossfade (1.5s) to Sanctuary Map. "Waking up" in the sanctuary.

**Timing:**

- First 1s: EntranceScreen with Forest image.
- Next 1.5s: Crossfade to Sanctuary Map.

**Direction:** Crossfade. Forest image fades out while Sanctuary fades in.

---

## 7. Sanctuary Priority Map

| Gap | Urgency | Fix Strategy |
|-----|---------|--------------|
| **RPC Spec** | 🔴 Critical | Write the SQL function logic. It's the engine. |
| **Shard Schema** | 🔴 Critical | Run migration for shard completion behavior + trigger. Schema already has columns; add trigger. |
| **Repository Audit** | 🟡 Medium | Find every `Supabase.instance` call; wrap in provider. Repository pattern for Demo. |
| **Progress Calc** | 🟡 Medium | Use Generated Column, View, or Function in Postgres. Don't calculate on device. |

---

## 8. Implementation Order

1. **order_index migration** — `20250320000001_add_order_index_to_nodes.sql`. Enables sibling ordering.
2. **Shard trigger** — `20250320000000_shard_completion_trigger.sql`. Recursive cascade (shard→pebble→boulder).
3. **Validity Filter RPC** — `20250320000002_get_packable_candidates_rpc.sql`. SatchelRepository calls it.
4. **Progress RPC** — `20250320000003_get_peak_progress_rpc.sql`. Wire to Peak Journal.
5. **Path helper** — `maxDepthReached(path)`, `canAddSubBoulder(path)` in `ltree_path.dart`.
6. **Mallet menu** — Bottom-sheet on Boulder. Use `canAddSubBoulder` for depth cap.
7. **Hammer context** — Refine modal: Boulder vs Pebble; "Shatter" vs "Refine into Shards."
8. **Forest Threshold** — Crossfade overlay on EntranceScreen. 1s Forest → 1.5s crossfade to Sanctuary.
9. **Demo mode** — Simplified leaf-only heuristic. See [DEMO_MODE_LOGIC_LEAF.md](DEMO_MODE_LOGIC_LEAF.md).

---

## 9. Final Logic Migration Plan

| Priority | Task | Migration / Spec |
|---------|------|------------------|
| 1 | order_index column | `20250320000001_add_order_index_to_nodes.sql` |
| 2 | Recursive completion trigger | `20250320000000_shard_completion_trigger.sql` |
| 3 | get_packable_candidates RPC | `20250320000002_get_packable_candidates_rpc.sql` |
| 4 | get_peak_progress RPC | `20250320000003_get_peak_progress_rpc.sql` |
| 5 | Path helper (depth cap) | `ltree_path.dart` — `maxDepthReached`, `canAddSubBoulder` |

---

**End of Pre-Flight Architecture Spec.**
