-- Remove schedule_defaults (Brain) table.
-- Planting windows are now per-plant on plant_profiles.planting_window with zone10b fallback.
DROP TABLE IF EXISTS schedule_defaults;
