-- Logic & Leaf: Recursive completion cascade (HEALTH_AND_IMPROVEMENTS Item 55 gatekeeper)
-- When Shard or Pebble is marked is_complete = true, cascade to parent if all siblings are complete.
-- Shards "extinguish" (complete); pebbles complete when all shards done; boulders when all children done.
-- Cascade stops at boulder (parent = mountain, not in nodes).

CREATE OR REPLACE FUNCTION check_parent_completion_on_node_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_parent_path ltree;
  v_incomplete_count int;
BEGIN
  IF NEW.is_complete = true AND nlevel(NEW.path) > 1 THEN
    v_parent_path := subpath(NEW.path, 0, nlevel(NEW.path) - 1);

    -- Count incomplete direct children of parent
    SELECT COUNT(*) INTO v_incomplete_count
    FROM nodes
    WHERE path <@ v_parent_path
      AND nlevel(path) = nlevel(v_parent_path) + 1
      AND is_complete = false
      AND user_id = NEW.user_id;

    IF v_incomplete_count = 0 THEN
      -- Parent exists in nodes (boulder's parent = mountain, not in nodes; UPDATE affects 0 rows)
      -- Zero-Ghost: archive parent so it vanishes from the map when all children are done.
      UPDATE nodes
      SET is_complete = true, completed_at = NOW(), is_archived = true, updated_at = NOW()
      WHERE path = v_parent_path AND user_id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_shard_complete_check_pebble ON nodes;
DROP TRIGGER IF EXISTS on_node_complete_cascade_parent ON nodes;
CREATE TRIGGER on_node_complete_cascade_parent
  AFTER UPDATE OF is_complete ON nodes
  FOR EACH ROW
  WHEN (NEW.is_complete = true)
  EXECUTE FUNCTION check_parent_completion_on_node_update();
