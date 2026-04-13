-- =============================================================
-- VOYAGER SANCTUARY — SUPABASE SCHEMA
-- Version: 1.0  |  Date: March 11, 2026
-- Paste this entire file into: Supabase Dashboard → SQL Editor → New query
-- Run it once. It is idempotent (safe to re-run via IF NOT EXISTS).
-- =============================================================


-- -------------------------------------------------------------
-- 0. EXTENSIONS
-- -------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS ltree;


-- -------------------------------------------------------------
-- 1. PROFILES
-- Extends auth.users. Auto-created on signup via trigger below.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
  id                    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username              TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  has_seen_elias_intro  BOOLEAN DEFAULT FALSE  -- Elias intro sequence on first login
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only access own profile" ON profiles;
CREATE POLICY "Users can only access own profile"
  ON profiles FOR ALL
  USING (auth.uid() = id);

-- Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: ensures profile exists for current user (fixes users who signed up before schema)
CREATE OR REPLACE FUNCTION public.ensure_profile()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id)
  VALUES (auth.uid())
  ON CONFLICT (id) DO NOTHING;
END;
$$;


-- -------------------------------------------------------------
-- 2. MOUNTAINS
-- Top-level goal categories. Hard cap: 3 active per user
-- (enforced at application layer, not DB constraint).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mountains (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  order_index INT  DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS mountains_user_active
  ON mountains(user_id, is_archived);

ALTER TABLE mountains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns their mountains" ON mountains;
CREATE POLICY "User owns their mountains"
  ON mountains FOR ALL
  USING (auth.uid() = user_id);


-- -------------------------------------------------------------
-- 3. NODES
-- The full hierarchy: Boulder → Pebble → Shard
-- Uses LTREE for efficient subtree queries.
--
-- LTREE path convention (underscores, no hyphens):
--   Boulder:  {mountain_id}.{boulder_id}
--   Pebble:   {mountain_id}.{boulder_id}.{pebble_id}
--   Shard:    {mountain_id}.{boulder_id}.{pebble_id}.{shard_id}
--
-- RULES (enforced at app layer + trigger):
--   - is_complete: pebbles and shards. Shards "extinguish" (complete); trigger cascades to pebble when all shards done.
--   - Only leaves enter the Satchel (Logic & Leaf): boulders without pebbles, pebbles without shards, or shards when pebble has shards.
--   - Burn shard: set is_complete=true; trigger marks pebble complete when all siblings done. No cascade delete.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS nodes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mountain_id   UUID NOT NULL REFERENCES mountains(id) ON DELETE CASCADE,
  path          LTREE NOT NULL,
  node_type     TEXT  NOT NULL CHECK (node_type IN ('boulder', 'pebble', 'shard')),
  title         TEXT  NOT NULL DEFAULT '',
  is_starred    BOOLEAN DEFAULT FALSE,
  due_date      DATE,
  is_complete   BOOLEAN DEFAULT FALSE,
  completed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Critical: GiST index makes LTREE subtree queries O(log n)
CREATE INDEX IF NOT EXISTS nodes_path_gist
  ON nodes USING GIST(path);

CREATE INDEX IF NOT EXISTS nodes_user_mountain
  ON nodes(user_id, mountain_id);

CREATE INDEX IF NOT EXISTS nodes_user_satchel_candidates
  ON nodes(user_id, node_type, is_complete)
  WHERE node_type = 'pebble' AND is_complete = FALSE;

ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns their nodes" ON nodes;
CREATE POLICY "User owns their nodes"
  ON nodes FOR ALL
  USING (auth.uid() = user_id);


-- -------------------------------------------------------------
-- 4. SATCHEL SLOTS
-- Snapshot of what is currently in the user's 6-slot bag.
-- NULL node_id = empty slot. NEVER auto-populated by the DB.
-- Only "Pack Satchel" writes here. Burning sets node_id to NULL.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS satchel_slots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_index     INT  NOT NULL CHECK (slot_index BETWEEN 1 AND 6),
  node_id        UUID REFERENCES nodes(id) ON DELETE SET NULL,
  packed_at      TIMESTAMPTZ DEFAULT NOW(),
  ready_to_burn  BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, slot_index)
);

-- Migration: add ready_to_burn if upgrading from a schema without it
ALTER TABLE satchel_slots ADD COLUMN IF NOT EXISTS ready_to_burn BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE satchel_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns their satchel" ON satchel_slots;
CREATE POLICY "User owns their satchel"
  ON satchel_slots FOR ALL
  USING (auth.uid() = user_id);

-- Seed 6 empty slots for a new user (called after profile creation)
CREATE OR REPLACE FUNCTION public.seed_satchel_for_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO satchel_slots (user_id, slot_index, node_id)
  SELECT p_user_id, s, NULL
  FROM generate_series(1, 6) s
  ON CONFLICT (user_id, slot_index) DO NOTHING;
END;
$$;


-- -------------------------------------------------------------
-- 5. WHETSTONE ITEMS
-- The user's recurring daily habits/rituals.
-- Seeded with 5 starter habits on first login (app layer).
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whetstone_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  order_index INT  DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS whetstone_items_user
  ON whetstone_items(user_id, is_active);

ALTER TABLE whetstone_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns their whetstone items" ON whetstone_items;
CREATE POLICY "User owns their whetstone items"
  ON whetstone_items FOR ALL
  USING (auth.uid() = user_id);


-- -------------------------------------------------------------
-- 6. WHETSTONE COMPLETIONS
-- One row per (user, item, local date).
-- "Midnight reset" = querying by today's date returns nothing new.
-- Data is NEVER deleted — yesterday's completions remain visible.
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS whetstone_completions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id         UUID NOT NULL REFERENCES whetstone_items(id) ON DELETE CASCADE,
  completed_date  DATE NOT NULL,   -- local date (YYYY-MM-DD), NOT UTC
  completed_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id, completed_date)
);

CREATE INDEX IF NOT EXISTS whetstone_completions_user_date
  ON whetstone_completions(user_id, completed_date);

ALTER TABLE whetstone_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns their completions" ON whetstone_completions;
CREATE POLICY "User owns their completions"
  ON whetstone_completions FOR ALL
  USING (auth.uid() = user_id);


-- -------------------------------------------------------------
-- 7. USER STREAKS (Grace Day — Whetstone ritual)
-- One row per user. Option A: one miss = freeze, two consecutive = reset.
-- See docs/GRACE_DAY_STREAK_SPEC.md
-- -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_streaks (
  user_id               UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak        INT NOT NULL DEFAULT 0,
  last_completion_date  DATE,
  grace_used            BOOLEAN NOT NULL DEFAULT FALSE
);

ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "User owns their streak" ON user_streaks;
CREATE POLICY "User owns their streak"
  ON user_streaks FOR ALL
  USING (auth.uid() = user_id);


-- =============================================================
-- VERIFICATION QUERIES
-- Run these after the schema to confirm everything is in place.
-- =============================================================

-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN (
    'profiles', 'mountains', 'nodes',
    'satchel_slots', 'whetstone_items', 'whetstone_completions', 'user_streaks'
  )
ORDER BY table_name;

-- Check LTREE extension is active
SELECT extname FROM pg_extension WHERE extname = 'ltree';

-- Check RLS is enabled on all tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'profiles', 'mountains', 'nodes',
    'satchel_slots', 'whetstone_items', 'whetstone_completions', 'user_streaks'
  )
ORDER BY tablename;
