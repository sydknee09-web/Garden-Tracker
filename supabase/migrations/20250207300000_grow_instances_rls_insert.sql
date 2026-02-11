-- Fix RLS on grow_instances so INSERT is allowed when user_id = auth.uid().
-- Some Postgres/RLS setups require an explicit WITH CHECK for INSERT; this ensures Plant workflow works.

DROP POLICY IF EXISTS "Users can manage own grow_instances" ON grow_instances;

CREATE POLICY "Users can manage own grow_instances" ON grow_instances
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
