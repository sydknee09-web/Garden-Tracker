-- seed_stocks: ensure table exists with user_id and RLS for Quick Add / Batch Add
-- Fixes "new row violates row-level security policy" when inserting.

CREATE TABLE IF NOT EXISTS seed_stocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plant_variety_id uuid NOT NULL REFERENCES plant_varieties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  volume text NOT NULL DEFAULT 'full' CHECK (volume IN ('full', 'partial', 'low', 'empty')),
  created_at timestamptz DEFAULT now()
);

-- If table already existed without user_id, add it (no-op if column exists)
ALTER TABLE seed_stocks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE seed_stocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own seed_stocks" ON seed_stocks;
CREATE POLICY "Users can manage own seed_stocks" ON seed_stocks
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
