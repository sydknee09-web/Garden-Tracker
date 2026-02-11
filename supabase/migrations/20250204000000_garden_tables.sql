-- Vista Garden Tracker: tasks, grow_instances, journal_entries
-- Run this in Supabase SQL Editor if tables don't exist.

-- Optional: add care spec columns to plant_varieties if missing
ALTER TABLE plant_varieties
  ADD COLUMN IF NOT EXISTS sun text,
  ADD COLUMN IF NOT EXISTS water text,
  ADD COLUMN IF NOT EXISTS harvest text,
  ADD COLUMN IF NOT EXISTS vendor text,
  ADD COLUMN IF NOT EXISTS harvest_days integer;

-- Grow instances (batches / sowings)
CREATE TABLE IF NOT EXISTS grow_instances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_variety_id uuid NOT NULL REFERENCES plant_varieties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sown_date date NOT NULL,
  expected_harvest_date date,
  created_at timestamptz DEFAULT now()
);

-- Tasks (Sow / Harvest) — generated from batches or manual
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_variety_id uuid NOT NULL REFERENCES plant_varieties(id) ON DELETE CASCADE,
  grow_instance_id uuid REFERENCES grow_instances(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('sow', 'harvest')),
  due_date date NOT NULL,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Journal entries (notes + photos)
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_variety_id uuid REFERENCES plant_varieties(id) ON DELETE SET NULL,
  grow_instance_id uuid REFERENCES grow_instances(id) ON DELETE SET NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  photo_url text,
  created_at timestamptz DEFAULT now()
);

-- RLS (use your own policies; allow dev user or auth.uid())
ALTER TABLE grow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own grow_instances" ON grow_instances
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own tasks" ON tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own journal_entries" ON journal_entries
  FOR ALL USING (auth.uid() = user_id);
