-- Zone 10b schedule overrides: sowing_method and planting_window from src/data/zone10b_schedule.ts
ALTER TABLE plant_profiles
  ADD COLUMN IF NOT EXISTS sowing_method text,
  ADD COLUMN IF NOT EXISTS planting_window text;
