-- Phase A: collapse grow_instances.status from 5-state to 2-state (growing | archived).
-- Locked 2026-05-28 (Syd) — see .claude/plans/plant_instance_phase_a.md
-- Mapping rules:
--   pending                                     -> growing  (catch-up tracker default; user can manually archive)
--   growing                                     -> growing  (no change)
--   harvested + is_permanent_planting=true      -> growing  (perennial still in garden; recorded harvest)
--   harvested + is_permanent_planting=false/null -> archived (annual season ended)
--   dead (any)                                  -> archived (no longer in garden)
--   archived                                    -> archived (no change)

ALTER TABLE grow_instances DROP CONSTRAINT IF EXISTS grow_instances_status_check;

UPDATE grow_instances SET status = 'growing'
  WHERE status = 'pending';

UPDATE grow_instances SET status = 'growing'
  WHERE status = 'harvested' AND is_permanent_planting = true;

UPDATE grow_instances SET status = 'archived'
  WHERE status = 'harvested' AND (is_permanent_planting IS NULL OR is_permanent_planting = false);

UPDATE grow_instances SET status = 'archived'
  WHERE status = 'dead';

ALTER TABLE grow_instances ADD CONSTRAINT grow_instances_status_check
  CHECK (status IN ('growing', 'archived'));

ALTER TABLE grow_instances ALTER COLUMN status SET DEFAULT 'growing';

COMMENT ON COLUMN grow_instances.status IS 'growing = in your garden now (incl. producing fruit, dormant perennials); archived = historical (removed, dead, season ended).';
