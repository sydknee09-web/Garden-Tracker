-- Plant > Packets architecture: PlantProfile (master biological) + SeedPacket (inventory per vendor).
-- Run this before the data migration script. After the script, run 20250205800000_plant_profiles_drop_legacy.sql.

-- Parent: biological identity (one per plant+variety per user)
CREATE TABLE IF NOT EXISTS plant_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  variety_name text,
  primary_image_path text,
  sun text,
  water text,
  plant_spacing text,
  days_to_germination text,
  harvest_days integer,
  height text,
  tags text[] DEFAULT '{}',
  status text DEFAULT 'vault',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plant_profiles_user_name_variety
  ON plant_profiles (user_id, trim(lower(name)), trim(lower(coalesce(variety_name, ''))));

ALTER TABLE plant_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own plant_profiles" ON plant_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Child: physical inventory (vendor, url, qty slider, scraped details)
CREATE TABLE IF NOT EXISTS seed_packets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_profile_id uuid NOT NULL REFERENCES plant_profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_name text,
  purchase_url text,
  purchase_date date,
  price text,
  qty_status integer NOT NULL DEFAULT 100 CHECK (qty_status >= 0 AND qty_status <= 100),
  scraped_details text,
  primary_image_path text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seed_packets_plant_profile ON seed_packets (plant_profile_id);
CREATE INDEX IF NOT EXISTS idx_seed_packets_user ON seed_packets (user_id);

ALTER TABLE seed_packets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own seed_packets" ON seed_packets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Optional: add plant_profile_id to dependent tables (nullable until migration script backfills)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'plant_profile_id') THEN
    ALTER TABLE tasks ADD COLUMN plant_profile_id uuid REFERENCES plant_profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'grow_instances' AND column_name = 'plant_profile_id') THEN
    ALTER TABLE grow_instances ADD COLUMN plant_profile_id uuid REFERENCES plant_profiles(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'journal_entries' AND column_name = 'plant_profile_id') THEN
    ALTER TABLE journal_entries ADD COLUMN plant_profile_id uuid REFERENCES plant_profiles(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shopping_list' AND column_name = 'plant_profile_id') THEN
    ALTER TABLE shopping_list ADD COLUMN plant_profile_id uuid REFERENCES plant_profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
