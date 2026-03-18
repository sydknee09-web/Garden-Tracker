-- Migration: First Blockage Refactor
-- Target: Implement Highest Incomplete Ancestor (Gatekeeper) logic for Climb peaks.
-- Replaces "first incomplete top-level boulder" with depth-first, first-child-order gatekeeper.
-- Survey unchanged. Sequential gate and packable logic preserved.
-- See VALIDITY_FILTER_RPC_SPEC.md § Planned Refactor; POST_V1_ROADMAP.md § 2.

CREATE OR REPLACE FUNCTION get_packable_candidates(
  p_user_id UUID,
  p_limit INT DEFAULT 10,
  p_exclude_ids UUID[] DEFAULT '{}'
)
RETURNS SETOF nodes
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE
  -- 1. Build full tree for Climb mountains with a sortable path (depth-first, first-child order)
  tree_order AS (
    SELECT
      n.id,
      n.path,
      n.mountain_id,
      n.is_complete,
      ARRAY[n.order_index, EXTRACT(EPOCH FROM n.created_at)]::numeric[] AS sort_key
    FROM nodes n
    JOIN mountains m ON m.id = n.mountain_id AND m.user_id = n.user_id
    WHERE n.user_id = p_user_id
      AND m.user_id = p_user_id
      AND m.layout_type = 'climb'
      AND n.node_type = 'boulder'
      AND nlevel(n.path) = 2

    UNION ALL

    SELECT
      n.id,
      n.path,
      n.mountain_id,
      n.is_complete,
      to_sort.sort_key || ARRAY[n.order_index, EXTRACT(EPOCH FROM n.created_at)]::numeric[]
    FROM nodes n
    INNER JOIN tree_order to_sort
      ON subpath(n.path, 0, nlevel(n.path) - 1) = to_sort.path
      AND n.user_id = p_user_id
    WHERE n.user_id = p_user_id
  ),

  -- 2. First Blockage per Climb mountain: first node (depth-first order) that is not complete
  gatekeeper AS (
    SELECT DISTINCT ON (to_sort.mountain_id)
      to_sort.id,
      to_sort.path,
      to_sort.mountain_id
    FROM tree_order to_sort
    JOIN mountains m ON m.id = to_sort.mountain_id AND m.user_id = p_user_id
    WHERE m.layout_type = 'climb'
      AND to_sort.is_complete = false
    ORDER BY to_sort.mountain_id, to_sort.sort_key ASC
  ),

  -- 3. Roots: Climb = gatekeeper; Survey = all top-level boulders (unchanged)
  roots AS (
    SELECT g.id, g.path, g.mountain_id
    FROM gatekeeper g
    UNION ALL
    SELECT n.id, n.path, n.mountain_id
    FROM nodes n
    JOIN mountains m ON m.id = n.mountain_id AND m.user_id = n.user_id
    WHERE n.user_id = p_user_id
      AND m.user_id = p_user_id
      AND m.layout_type = 'survey'
      AND n.node_type = 'boulder'
      AND nlevel(n.path) = 2
  ),

  -- 4. Unlocked subtree (respecting sequential gate): same logic as before
  unlocked AS (
    SELECT r.id, r.path, r.mountain_id
    FROM roots r
    UNION
    SELECT n.id, n.path, n.mountain_id
    FROM nodes n
    JOIN unlocked u ON n.path <@ u.path AND nlevel(n.path) = nlevel(u.path) + 1
      AND n.user_id = p_user_id
    JOIN nodes parent ON parent.path = subpath(n.path, 0, nlevel(n.path) - 1)
      AND parent.user_id = p_user_id
    WHERE (
      parent.pebble_logic = 'freeform'
      OR NOT EXISTS (
        SELECT 1 FROM nodes s
        WHERE s.path <@ parent.path
          AND nlevel(s.path) = nlevel(parent.path) + 1
          AND s.user_id = p_user_id
          AND s.is_complete = false
          AND (s.order_index, s.created_at) < (n.order_index, n.created_at)
      )
    )
  ),

  -- 5. Packable = leaves in unlocked set, not packed, not complete
  packable AS (
    SELECT n.*
    FROM nodes n
    WHERE n.user_id = p_user_id
      AND n.is_complete = false
      AND n.id IN (SELECT id FROM unlocked)
      AND NOT EXISTS (
        SELECT 1 FROM nodes c
        WHERE c.user_id = p_user_id
          AND c.path <@ n.path
          AND nlevel(c.path) = nlevel(n.path) + 1
      )
      AND NOT EXISTS (
        SELECT 1 FROM satchel_slots ss
        WHERE ss.user_id = p_user_id AND ss.node_id = n.id
      )
      AND (p_exclude_ids IS NULL OR NOT (n.id = ANY(p_exclude_ids)))
  )
  SELECT * FROM packable
  ORDER BY is_starred DESC NULLS LAST, due_date ASC NULLS LAST, created_at ASC
  LIMIT p_limit;
$$;
