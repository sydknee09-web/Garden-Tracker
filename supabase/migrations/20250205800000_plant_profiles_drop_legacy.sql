-- Run AFTER scripts/migrate-to-plant-packets.ts. Drops legacy plant_variety_id columns and old tables.

-- Prefer plant_profile_id over plant_variety_id on dependent tables
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_plant_variety_id_fkey;
ALTER TABLE tasks DROP COLUMN IF EXISTS plant_variety_id;
ALTER TABLE grow_instances DROP CONSTRAINT IF EXISTS grow_instances_plant_variety_id_fkey;
ALTER TABLE grow_instances DROP COLUMN IF EXISTS plant_variety_id;
ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_plant_variety_id_fkey;
ALTER TABLE journal_entries DROP COLUMN IF EXISTS plant_variety_id;
ALTER TABLE shopping_list DROP CONSTRAINT IF EXISTS shopping_list_plant_variety_id_fkey;
ALTER TABLE shopping_list DROP COLUMN IF EXISTS plant_variety_id;

-- Rename plant_profile_id to plant_variety_id for app compatibility (optional; app can use plant_profile_id)
-- ALTER TABLE tasks RENAME COLUMN plant_profile_id TO plant_variety_id;
-- (Skip rename so app uses plant_profile_id explicitly.)

-- Drop legacy tables (only after confirming migration success)
-- DROP TABLE IF EXISTS seed_stocks;
-- DROP TABLE IF EXISTS plant_varieties;
