-- Sprint 3 Ship B B1: user-defined Groups + plant_groups M-N join.
-- Foundation for the Active Garden + My Plants tab merge (B2) where groups become
-- the primary intra-Garden nav, replacing the lifecycle-based split.
--
-- Per-user only (planning doc §2.3 lock); no household sharing in v1.
-- Additive + idempotent — safe to re-apply. Code-tier per CLAUDE.md SQL migrations subsection.
--
-- Mirrors existing M-N pattern from journal_entry_plants + journal_entry_supplies:
-- denormalized user_id for RLS, ON DELETE CASCADE both FKs + user_id,
-- UNIQUE(fk1, fk2) to prevent duplicate assignments, per-FK + user_id indexes,
-- cross-user zombie-prevention trigger.

-- ---------------------------------------------------------------------------
-- groups: user-defined organization labels for plantings ("Patio", "Bedroom", etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_groups_user_position_deleted
  ON groups (user_id, position, deleted_at);

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_owner_manage" ON groups
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE groups IS
  'User-defined organization labels for plantings (e.g. "Patio", "Front yard", "Bedroom"). Per-user; no household sharing in v1. Soft-deleted via deleted_at. M-N to grow_instances via plant_groups.';

-- ---------------------------------------------------------------------------
-- plant_groups: M-N join between grow_instances and groups
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS plant_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grow_instance_id uuid NOT NULL REFERENCES grow_instances(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(grow_instance_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_plant_groups_grow
  ON plant_groups (grow_instance_id);
CREATE INDEX IF NOT EXISTS idx_plant_groups_group
  ON plant_groups (group_id);
CREATE INDEX IF NOT EXISTS idx_plant_groups_user
  ON plant_groups (user_id);

ALTER TABLE plant_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plant_groups_owner_manage" ON plant_groups
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE plant_groups IS
  'M-N join between grow_instances and groups. Denormalized user_id for RLS performance. Hard-deleted on unassign (matches journal_entry_plants/supplies pattern). CASCADE on both FKs handles cleanup when underlying grow or group is hard-deleted.';

-- ---------------------------------------------------------------------------
-- Cross-user zombie-prevention trigger
-- Mirrors journal_entry_supplies pattern: ensure plant_groups.user_id matches
-- both the referenced grow_instance.user_id and the referenced group.user_id,
-- so a user cannot assign their own instance to another user's group or vice
-- versa even if RLS WITH CHECK on user_id alone is satisfied.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_plant_groups_user_match()
RETURNS TRIGGER AS $$
DECLARE
  grow_owner uuid;
  group_owner uuid;
BEGIN
  SELECT user_id INTO grow_owner FROM grow_instances WHERE id = NEW.grow_instance_id;
  SELECT user_id INTO group_owner FROM groups WHERE id = NEW.group_id;

  IF NEW.user_id != grow_owner THEN
    RAISE EXCEPTION 'plant_groups.user_id must match grow_instances.user_id';
  END IF;

  IF NEW.user_id != group_owner THEN
    RAISE EXCEPTION 'plant_groups.user_id must match groups.user_id';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS plant_groups_user_match ON plant_groups;
CREATE TRIGGER plant_groups_user_match
  BEFORE INSERT OR UPDATE ON plant_groups
  FOR EACH ROW EXECUTE FUNCTION check_plant_groups_user_match();
