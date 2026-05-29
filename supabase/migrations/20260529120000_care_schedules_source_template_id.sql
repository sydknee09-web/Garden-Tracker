-- Phase C C1: lineage tracking for care_schedules cloned from templates.
-- Self-referential FK: an instance schedule points back to the template it was cloned from.
-- NULL = standalone schedule (no template lineage) OR pre-C1 cloned schedule (lazy backfill possible later).
--
-- Additive + idempotent; safe to re-apply.

ALTER TABLE public.care_schedules
  ADD COLUMN IF NOT EXISTS source_template_id uuid REFERENCES public.care_schedules(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.care_schedules.source_template_id IS
  'Self-FK to care_schedules.id. Set when this row is a cloned instance-schedule from a profile template (via copyCareTemplatesToInstance). NULL on standalone schedules and pre-C1 clones. ON DELETE SET NULL preserves the instance row when the template is deleted.';
