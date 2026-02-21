-- Supplies Vault (Shed): supply_profiles table and links to care, tasks, journal, shopping list.

-- ============================================================
-- 1. supply_profiles table
-- ============================================================
CREATE TABLE IF NOT EXISTS supply_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  brand text,
  category text NOT NULL DEFAULT 'fertilizer'
    CHECK (category IN ('fertilizer', 'pesticide', 'soil_amendment', 'other')),
  usage_instructions text,
  application_rate text,
  primary_image_path text,
  source_url text,
  npk text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  deleted_at timestamptz,
  replaced_by_id uuid REFERENCES supply_profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_supply_profiles_user ON supply_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_supply_profiles_deleted ON supply_profiles (user_id) WHERE deleted_at IS NULL;

ALTER TABLE supply_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own supply_profiles" ON supply_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "household_supply_profiles_select" ON supply_profiles
  FOR SELECT
  USING (user_id IN (SELECT public.my_household_member_user_ids()));

-- ============================================================
-- 2. Add supply_profile_id to care_schedules, tasks, journal_entries
-- ============================================================
ALTER TABLE care_schedules
  ADD COLUMN IF NOT EXISTS supply_profile_id uuid REFERENCES supply_profiles(id) ON DELETE SET NULL;

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS supply_profile_id uuid REFERENCES supply_profiles(id) ON DELETE SET NULL;

ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS supply_profile_id uuid REFERENCES supply_profiles(id) ON DELETE SET NULL;

-- ============================================================
-- 3. shopping_list: add supply_profile_id and partial unique index
-- ============================================================
ALTER TABLE shopping_list
  ADD COLUMN IF NOT EXISTS supply_profile_id uuid REFERENCES supply_profiles(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_list_user_supply
  ON shopping_list (user_id, supply_profile_id)
  WHERE supply_profile_id IS NOT NULL;
