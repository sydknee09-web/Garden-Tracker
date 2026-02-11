-- Phase 9: Household sharing
-- Creates households and household_members tables for family/multi-user sharing

-- ======================================================================
-- households table
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

-- Owner can do anything
CREATE POLICY "household_owner_all" ON households
  FOR ALL USING (owner_id = auth.uid());

-- Members can read their household
CREATE POLICY "household_members_read" ON households
  FOR SELECT USING (
    id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- ======================================================================
-- household_members table
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

-- Members can see who else is in their household
CREATE POLICY "hm_read" ON household_members
  FOR SELECT USING (
    household_id IN (SELECT household_id FROM household_members WHERE user_id = auth.uid())
  );

-- Only owner/admin can insert new members
CREATE POLICY "hm_insert" ON household_members
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT h.id FROM households h WHERE h.owner_id = auth.uid()
      UNION
      SELECT hm.household_id FROM household_members hm WHERE hm.user_id = auth.uid() AND hm.role IN ('owner', 'admin')
    )
  );

-- Only owner can delete members (or member can remove self)
CREATE POLICY "hm_delete" ON household_members
  FOR DELETE USING (
    user_id = auth.uid() OR
    household_id IN (SELECT h.id FROM households h WHERE h.owner_id = auth.uid())
  );

-- ======================================================================
-- Add household_id to plant_profiles for shared gardens
-- ======================================================================
ALTER TABLE plant_profiles ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES households(id) ON DELETE SET NULL;

-- ======================================================================
-- Helper function to get all household IDs for current user
-- ======================================================================
CREATE OR REPLACE FUNCTION my_household_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT household_id FROM public.household_members WHERE user_id = auth.uid();
$$;

-- ======================================================================
-- Enable Realtime on relevant tables
-- ======================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE households;
ALTER PUBLICATION supabase_realtime ADD TABLE household_members;
