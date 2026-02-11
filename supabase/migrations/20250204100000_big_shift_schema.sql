-- Vista Garden Tracker: "The Big Shift" — schema alignment and new tables

-- journal_entries: ensure note exists, add image_file_path for Supabase Storage
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS note text,
  ADD COLUMN IF NOT EXISTS image_file_path text;

-- grow_instances: expected_harvest_date (already in original migration; ensure it exists)
ALTER TABLE grow_instances
  ADD COLUMN IF NOT EXISTS expected_harvest_date date;

-- plant_varieties: inventory count, status, tags for orchestration and shopping list
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS inventory_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'vault',
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- shopping_list: in-app list when inventory_count == 0
CREATE TABLE IF NOT EXISTS shopping_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plant_variety_id uuid NOT NULL REFERENCES plant_varieties(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, plant_variety_id)
);

ALTER TABLE shopping_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own shopping_list" ON shopping_list
  FOR ALL USING (auth.uid() = user_id);

-- tasks: category column (start_seed, transplant, direct_sow, sow, harvest)
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_type_check;
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_category_check
  CHECK (category IN ('sow', 'harvest', 'start_seed', 'transplant', 'direct_sow'));

-- Storage bucket for journal photos (public read so image_file_path can be used as public URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('journal-photos', 'journal-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: users can upload/read their own files under {user_id}/
CREATE POLICY "Users can upload own journal photos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'journal-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public read journal photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'journal-photos');
