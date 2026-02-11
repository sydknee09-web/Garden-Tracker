-- ============================================================================
-- Phase 1: Schema Foundation
-- New tables: user_settings, care_schedules
-- Column additions: plant_profiles, journal_entries, grow_instances,
--                   seed_packets, tasks
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1a. user_settings – zone, location, weather coordinates
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  planting_zone text,                          -- e.g. '8b', '9a', '10b'
  last_frost_date date,
  latitude numeric,
  longitude numeric,
  timezone text DEFAULT 'America/Los_Angeles',
  location_name text,                          -- e.g. 'Vista, CA'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own settings" ON user_settings;
CREATE POLICY "Users can manage own settings"
  ON user_settings FOR ALL USING (auth.uid() = user_id);

-- --------------------------------------------------------------------------
-- 1b. care_schedules – recurring care for seasonal + permanent plants
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS care_schedules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  plant_profile_id uuid REFERENCES plant_profiles ON DELETE CASCADE,
  grow_instance_id uuid REFERENCES grow_instances ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users NOT NULL,
  title text NOT NULL,                        -- e.g. 'Fertilize', 'Prune'
  category text NOT NULL DEFAULT 'maintenance',
  recurrence_type text NOT NULL
    CHECK (recurrence_type IN ('interval','monthly','yearly','custom_dates','one_off')),
  interval_days integer,                      -- for 'interval': every N days
  months integer[],                           -- for 'monthly'/'yearly': which months (1-12)
  day_of_month integer,                       -- for 'monthly': which day
  custom_dates date[],                        -- for 'custom_dates': specific dates
  next_due_date date,                         -- precomputed next due date
  last_completed_at timestamptz,
  is_active boolean DEFAULT true,
  is_template boolean DEFAULT false,          -- true = profile-level template; auto-copied on Plant
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE care_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own care schedules" ON care_schedules;
CREATE POLICY "Users can manage own care schedules"
  ON care_schedules FOR ALL USING (auth.uid() = user_id);

COMMENT ON TABLE care_schedules IS
  'Recurring or one-off care items. is_template=true lives on profile; copied to grow_instance on Plant.';

-- --------------------------------------------------------------------------
-- 1c. plant_profiles – add profile_type + soft delete
-- --------------------------------------------------------------------------
ALTER TABLE plant_profiles
  ADD COLUMN IF NOT EXISTS profile_type text NOT NULL DEFAULT 'seed';

-- Add check constraint only if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'plant_profiles_profile_type_check'
  ) THEN
    ALTER TABLE plant_profiles
      ADD CONSTRAINT plant_profiles_profile_type_check
      CHECK (profile_type IN ('seed', 'permanent'));
  END IF;
END $$;

ALTER TABLE plant_profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_plant_profiles_not_deleted
  ON plant_profiles (user_id) WHERE deleted_at IS NULL;

COMMENT ON COLUMN plant_profiles.profile_type IS
  'seed = seasonal from seed packets; permanent = trees, perennials, established plants.';

-- --------------------------------------------------------------------------
-- 1d. journal_entries – add entry_type + harvest fields + soft delete
-- --------------------------------------------------------------------------
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS entry_type text DEFAULT 'note';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'journal_entries_entry_type_check'
  ) THEN
    ALTER TABLE journal_entries
      ADD CONSTRAINT journal_entries_entry_type_check
      CHECK (entry_type IN ('planting','growth','harvest','note','care','pest','death','quick'));
  END IF;
END $$;

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS harvest_weight numeric,
  ADD COLUMN IF NOT EXISTS harvest_unit text,
  ADD COLUMN IF NOT EXISTS harvest_quantity numeric,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- --------------------------------------------------------------------------
-- 1e. grow_instances – add location, end_reason, seed_packet_id, dead status
-- --------------------------------------------------------------------------
ALTER TABLE grow_instances
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS end_reason text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Add seed_packet_id FK only if column doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'grow_instances' AND column_name = 'seed_packet_id'
  ) THEN
    ALTER TABLE grow_instances
      ADD COLUMN seed_packet_id uuid REFERENCES seed_packets ON DELETE SET NULL;
  END IF;
END $$;

COMMENT ON COLUMN grow_instances.seed_packet_id IS
  'Primary packet used to start this planting. Multi-packet tracked via journal_entries.seed_packet_id.';

-- Expand status constraint to include 'dead'
ALTER TABLE grow_instances DROP CONSTRAINT IF EXISTS grow_instances_status_check;
ALTER TABLE grow_instances ADD CONSTRAINT grow_instances_status_check
  CHECK (status IN ('pending', 'growing', 'harvested', 'dead', 'archived'));

COMMENT ON COLUMN grow_instances.status IS
  'pending=scheduled; growing=in ground; harvested=done; dead=plant died; archived=season ended.';

-- --------------------------------------------------------------------------
-- 1f. seed_packets – add packet_photo_path + soft delete
-- --------------------------------------------------------------------------
ALTER TABLE seed_packets
  ADD COLUMN IF NOT EXISTS packet_photo_path text,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN seed_packets.packet_photo_path IS
  'Path to raw photo of the physical seed packet, distinct from the product/hero image.';

-- --------------------------------------------------------------------------
-- 1g. tasks – add care_schedule_id + soft delete
-- --------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tasks' AND column_name = 'care_schedule_id'
  ) THEN
    ALTER TABLE tasks
      ADD COLUMN care_schedule_id uuid REFERENCES care_schedules ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN tasks.care_schedule_id IS
  'Links task to its generating care_schedule for duplicate prevention and completion hooks.';
