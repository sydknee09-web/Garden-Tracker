-- =============================================================
-- VOYAGER SANCTUARY — All Migrations (Combined)
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Prerequisite: docs/schema.sql must be run first (creates base tables)
-- This file is idempotent — safe to re-run.
-- =============================================================

-- -------------------------------------------------------------
-- 20250315: Ritual flow and burn archive
-- -------------------------------------------------------------
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS is_pending_ritual BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS nodes_pending_ritual
  ON nodes(user_id, is_pending_ritual)
  WHERE is_pending_ritual = true;

CREATE INDEX IF NOT EXISTS nodes_archived
  ON nodes(user_id, is_archived)
  WHERE is_archived = true;

-- -------------------------------------------------------------
-- 20250316: Master Ledger (intent, layout, pebble_logic)
-- -------------------------------------------------------------
ALTER TABLE mountains ADD COLUMN IF NOT EXISTS intent_statement TEXT;
ALTER TABLE mountains ADD COLUMN IF NOT EXISTS layout_type TEXT DEFAULT 'climb' CHECK (layout_type IN ('climb', 'survey'));
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS pebble_logic TEXT DEFAULT 'freeform' CHECK (pebble_logic IN ('sequential', 'freeform'));

-- -------------------------------------------------------------
-- 20250317: Elias intro flag
-- -------------------------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_seen_elias_intro BOOLEAN DEFAULT FALSE;

-- -------------------------------------------------------------
-- 20250318: User streaks (Whetstone / Grace Day)
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_streaks (
  user_id               UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak        INT NOT NULL DEFAULT 0,
  last_completion_date  DATE,
  grace_used            BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns their streak" ON user_streaks;
CREATE POLICY "User owns their streak"
  ON user_streaks FOR ALL
  USING (auth.uid() = user_id);

-- -------------------------------------------------------------
-- 20250319: Appearance style for peaks
-- -------------------------------------------------------------
ALTER TABLE mountains ADD COLUMN IF NOT EXISTS appearance_style TEXT DEFAULT 'slate'
  CHECK (appearance_style IN ('dark_walnut', 'navy', 'slate', 'charcoal', 'burgundy', 'forest'));

-- -------------------------------------------------------------
-- 20250320: Logic & Leaf — Completion cascade (Zero-Ghost)
-- -------------------------------------------------------------
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

    SELECT COUNT(*) INTO v_incomplete_count
    FROM nodes
    WHERE path <@ v_parent_path
      AND nlevel(path) = nlevel(v_parent_path) + 1
      AND is_complete = false
      AND user_id = NEW.user_id;

    IF v_incomplete_count = 0 THEN
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

-- -------------------------------------------------------------
-- 20250320: order_index for sibling ordering
-- -------------------------------------------------------------
ALTER TABLE nodes ADD COLUMN IF NOT EXISTS order_index INT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS nodes_order_index ON nodes(user_id, path, order_index);

-- -------------------------------------------------------------
-- 20250320: get_packable_candidates RPC
-- -------------------------------------------------------------
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

-- -------------------------------------------------------------
-- 20250320: get_peak_progress RPC
-- -------------------------------------------------------------
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

-- -------------------------------------------------------------
-- Done
-- -------------------------------------------------------------
SELECT 'All migrations complete.' AS status;
