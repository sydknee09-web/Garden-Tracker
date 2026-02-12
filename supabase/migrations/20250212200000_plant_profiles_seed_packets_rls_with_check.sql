-- Explicit WITH CHECK for INSERT on plant_profiles and seed_packets (Save to Vault flow).
-- Ensures RLS allows inserts when auth.uid() = user_id.

DROP POLICY IF EXISTS "Users can manage own plant_profiles" ON plant_profiles;
CREATE POLICY "Users can manage own plant_profiles" ON plant_profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own seed_packets" ON seed_packets;
CREATE POLICY "Users can manage own seed_packets" ON seed_packets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
