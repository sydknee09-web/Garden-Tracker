-- Enrichment versioning (2026-06-13)
-- Adds enrichment_version to mark current-gen AI enrichment vs legacy/needs-re-enrichment.
-- enrichment_version = 0  → legacy / pre-versioning data (migration default for all existing rows).
-- enrichment_version = N  → enriched by CURRENT_AI_FILL_VERSION = N (see src/lib/ai-fill/version.ts).
--
-- Replaces the deferred backfill pass: legacy data self-heals on next AI-fill touch
-- (version-aware Fill Blanks + global_plant_library cache self-heal).
--
-- Additive + idempotent (ADD COLUMN IF NOT EXISTS). Safe to re-run. No data backfill.

ALTER TABLE plant_profiles
  ADD COLUMN IF NOT EXISTS enrichment_version integer NOT NULL DEFAULT 0;

ALTER TABLE global_plant_library
  ADD COLUMN IF NOT EXISTS enrichment_version integer NOT NULL DEFAULT 0;
