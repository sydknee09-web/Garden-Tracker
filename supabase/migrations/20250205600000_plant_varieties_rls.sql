-- plant_varieties: enforce row-level security so users can only access their own rows.
-- Without this, any authenticated user could read/update any plant_variety by id.

ALTER TABLE plant_varieties ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own plant_varieties" ON plant_varieties;
CREATE POLICY "Users can read own plant_varieties"
  ON plant_varieties FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own plant_varieties" ON plant_varieties;
CREATE POLICY "Users can insert own plant_varieties"
  ON plant_varieties FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own plant_varieties" ON plant_varieties;
CREATE POLICY "Users can update own plant_varieties"
  ON plant_varieties FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own plant_varieties" ON plant_varieties;
CREATE POLICY "Users can delete own plant_varieties"
  ON plant_varieties FOR DELETE
  USING (auth.uid() = user_id);
