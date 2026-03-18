-- Voyager Sanctuary: RLS for profiles and mountains
-- Without these policies, Supabase rejects UPDATE (and other) calls even when code is correct.
-- "Couldn't save" errors are often RLS denying the operation.

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE mountains ENABLE ROW LEVEL SECURITY;

-- Profiles: users can see and edit only their own data
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Mountains: users can manage their own mountains (SELECT, INSERT, UPDATE, DELETE)
DROP POLICY IF EXISTS "Users can manage own mountains" ON mountains;
CREATE POLICY "Users can manage own mountains"
  ON mountains FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
