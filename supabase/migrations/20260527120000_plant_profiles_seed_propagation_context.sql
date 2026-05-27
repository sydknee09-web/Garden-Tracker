-- Vault Propagate / Save Seeds — contextual empty-state.
-- Adds a single AI-populated free-text field that explains why seed-propagation
-- data may be absent for a variety. Covers 4 cases the AI prompt handles:
--   (1) doesn't grow from seed (succulents, leaf-cuttings plants)
--   (2) grows from seed but offspring vary (apples, many fruit trees)
--   (3) sterile / won't fruit when grown from seed (grafted, sterile hybrids)
--   (4) standard seed-grown — field stays empty, no note rendered
--
-- Lazy-populated: existing profiles stay NULL until the user taps the AI Fill
-- Blanks button. No backfill job in this migration.
--
-- Additive + idempotent; safe to re-apply.

ALTER TABLE public.plant_profiles
  ADD COLUMN IF NOT EXISTS seed_propagation_context TEXT;

COMMENT ON COLUMN public.plant_profiles.seed_propagation_context IS
  'One-sentence AI-generated caveat about seed-propagation suitability. Rendered on Vault Propagate / Save Seeds card + as footer note on How to Grow card when seed rows are empty. NULL = standard seed-grown variety, no caveat needed.';
