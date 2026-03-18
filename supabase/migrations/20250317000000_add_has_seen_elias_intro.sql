-- Elias Introduction: flag to show intro sequence on first login only.
-- Stored in profiles so it syncs across devices (e.g. accountant switching devices).
-- See docs/ELIAS_INTRODUCTION_SPEC.md

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_seen_elias_intro BOOLEAN DEFAULT FALSE;
