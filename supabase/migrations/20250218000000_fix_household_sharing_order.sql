-- Fix: household_members must exist before policies on households reference it.
-- Recreates tables and policies in correct order (idempotent).

-- ======================================================================
-- 1. households table
-- ======================================================================
CREATE TABLE IF NOT EXISTS households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'My Garden',
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code text UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE households ENABLE ROW LEVEL SECURITY;

-- ======================================================================
-- 2. household_members table (must exist before household policies reference it)
-- ======================================================================
CREATE TABLE IF NOT EXISTS household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id, user_id)
);

ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;

-- ======================================================================
-- 3. Policies on households (household_members now exists)
-- ======================================================================
DROP POLICY IF EXISTS "household_owner_all" ON households;
CREATE POLICY "household_owner_all" ON households
  FOR ALL USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "household_members_read" ON households;
CREATE POLICY "household_members_read" ON households
  FOR SELECT USING (
    id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- ======================================================================
-- 4. Policies on household_members
-- ======================================================================
DROP POLICY IF EXISTS "hm_read" ON household_members;
CREATE POLICY "hm_read" ON household_members
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "hm_insert" ON household_members;
CREATE POLICY "hm_insert" ON household_members
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT h.id FROM households h WHERE h.owner_id = auth.uid()
      UNION
      SELECT hm.household_id FROM household_members hm WHERE hm.user_id = auth.uid() AND hm.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "hm_delete" ON household_members;
CREATE POLICY "hm_delete" ON household_members
  FOR DELETE USING (
    user_id = auth.uid() OR
    household_id IN (SELECT h.id FROM households h WHERE h.owner_id = auth.uid())
  );

-- ======================================================================
-- 5. Add household_id to plant_profiles
-- ======================================================================
ALTER TABLE plant_profiles ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id) ON DELETE SET NULL;

-- ======================================================================
-- 6. Helper function
-- ======================================================================
CREATE OR REPLACE FUNCTION my_household_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT household_id FROM public.household_members WHERE user_id = auth.uid();
$$;

-- ======================================================================
-- 7. Realtime (ignore if already added)
-- ======================================================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE households;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE household_members;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
