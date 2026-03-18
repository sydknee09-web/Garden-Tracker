-- Logic & Leaf: get_peak_progress RPC
-- Returns (completed_leaves, total_leaves) for a mountain. Leaves only; no double-counting.
-- SECURITY: Verifies caller owns the mountain. Prevents data bleed between users.

CREATE OR REPLACE FUNCTION get_peak_progress(p_mountain_id UUID)
RETURNS TABLE (completed_leaves BIGINT, total_leaves BIGINT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH leaves AS (
    SELECT n.id, n.is_complete
    FROM nodes n
    WHERE n.mountain_id = p_mountain_id
      AND EXISTS (
        SELECT 1 FROM mountains m
        WHERE m.id = p_mountain_id AND m.user_id = auth.uid()
      )
      AND NOT EXISTS (
        SELECT 1 FROM nodes c
        WHERE c.mountain_id = n.mountain_id
          AND c.path <@ n.path
          AND nlevel(c.path) = nlevel(n.path) + 1
      )
  )
  SELECT
    (SELECT COUNT(*)::BIGINT FROM leaves WHERE is_complete = true),
    (SELECT COUNT(*)::BIGINT FROM leaves);
$$;
