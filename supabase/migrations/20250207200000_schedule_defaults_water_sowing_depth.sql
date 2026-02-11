-- Deep Brain: default care notes per plant type (fallback when Perenual API is missing data).
ALTER TABLE schedule_defaults
  ADD COLUMN IF NOT EXISTS water text,
  ADD COLUMN IF NOT EXISTS sowing_depth text;
