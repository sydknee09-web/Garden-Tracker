-- Library card composite indexes — additive perf insurance.
--
-- Audit rationale: closes R1.2 + R1.3 from .claude/plans/supabase_library_load_audit.md
-- (severity: medium — sequential scans degrade as user-data accrues year over year per VISION §2).
--
-- Anchor pattern: idx_plant_profiles_not_deleted at
--   supabase/migrations/20250211000000_phase1_schema_foundation.sql:85 (single-column partial).
--
-- Why composite + partial:
--   1) grow_instances has zero indexes today — every status filter is a sequential scan.
--      The Library load query at src/components/SeedVaultView.tsx:893-898 filters
--      plant_profile_id IN (...) AND status = 'growing' AND deleted_at IS NULL.
--      Same shape recurs on Active Garden, My Plants, History, vault profile Plantings tab.
--   2) seed_packets has single-column idx_seed_packets_plant_profile + idx_seed_packets_user
--      but no composite covering the (plant_profile_id, deleted_at, is_archived) filter
--      used by the Library packets query at src/components/SeedVaultView.tsx:880-885,
--      Packets tab, and vault profile Packets tab.
--
-- CONCURRENTLY intentionally NOT used: matches the codebase-wide prevailing pattern
-- (zero CONCURRENTLY usage across 111 migrations); supabase db push wraps migrations
-- in transactions, which would error on CONCURRENTLY. Tables are small at audit time
-- (grow_instances=30 rows, seed_packets=1 row per docs/SUPABASE_OPS.md §6.a) so the
-- brief AccessExclusiveLock during CREATE INDEX is negligible.
--
-- Idempotent: IF NOT EXISTS guards both statements. Safe to re-apply.

CREATE INDEX IF NOT EXISTS idx_grow_instances_profile_status
  ON grow_instances (plant_profile_id, status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_seed_packets_profile_active
  ON seed_packets (plant_profile_id, deleted_at, is_archived);
