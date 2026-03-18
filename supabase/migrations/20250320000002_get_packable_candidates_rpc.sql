-- Logic & Leaf: get_packable_candidates RPC
-- Returns only nodes valid to pack: leaf, layout-gated, sequential-gated, not packed.
-- ORDER BY order_index ASC, created_at ASC for sibling ordering.
-- Returns full node rows (including node_type) so client knows Pebble vs Shard without second fetch.

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
  -- 1. First incomplete boulder per Climb mountain (for layout gate)
  first_climb_boulder AS (
    SELECT DISTINCT ON (n.mountain_id) n.id, n.path
    FROM nodes n
    JOIN mountains m ON m.id = n.mountain_id AND m.user_id = n.user_id
    WHERE n.user_id = p_user_id
      AND m.user_id = p_user_id
      AND m.layout_type = 'climb'
      AND n.node_type = 'boulder'
      AND nlevel(n.path) = 2
      AND n.is_complete = false
    ORDER BY n.mountain_id, n.order_index ASC, n.created_at ASC
  ),

  -- 2. Roots: entry points for "unlocked" tree
  -- Survey = all boulders; Climb = first incomplete boulder per mountain
  roots AS (
    SELECT n.id, n.path, n.mountain_id
    FROM nodes n
    JOIN mountains m ON m.id = n.mountain_id AND m.user_id = n.user_id
    WHERE n.user_id = p_user_id
      AND m.user_id = p_user_id
      AND m.layout_type = 'survey'
      AND n.node_type = 'boulder'
      AND nlevel(n.path) = 2
    UNION ALL
    SELECT n.id, n.path, n.mountain_id
    FROM nodes n
    JOIN first_climb_boulder f ON f.id = n.id
    WHERE n.user_id = p_user_id
  ),

  -- 3. Recursive CTE: "unlocked" nodes (respecting sequential gate)
  -- Start from roots; add children. For sequential parent, only first incomplete child.
  unlocked AS (
    SELECT r.id, r.path, r.mountain_id FROM roots r
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

  -- 4. Packable = leaves in unlocked set, not packed, not complete
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
