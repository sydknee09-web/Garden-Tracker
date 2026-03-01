# Pre-Seed Plant Library with Gemini

**Standalone plan** — moved from Garden Tracker Brain Dump for focused implementation.

---

## Goal

Run a script to fill a database with plant profiles (description, watering, germination, seed extraction, etc.) so new users don't need to call Gemini every time. Zone-specific data (planting timeline) stays in the app.

---

## Current State

- [global_plant_cache](supabase/migrations/20250210200000_global_plant_cache.sql) exists, keyed by `source_url` for vendor imports
- Used for Quick Add suggestions
- No separate "plant library" for common plants (e.g., Zone 10B)

---

## Recommendation

**Table:** Either extend `global_plant_cache` with a "library" mode (no `source_url`) or create a `plant_library` table. Schema: `botanical_name`, `common_name`, `description`, `watering_needs`, `germination_instructions`, `seed_extraction`, `category`, `life_cycle`, etc. No zone-specific dates.

**Script:**
- CSV of plant names → loop → call Gemini with a strict JSON prompt → validate → upsert
- Use `botanical_name` as unique key
- Rate limit (e.g., 2 s delay) for free tier

**Zone logic:** Store relative offsets (e.g., "2 weeks after last frost") in the library. The app computes actual dates from `user_settings.planting_zone` and frost dates.

**Cursor prompt:** Use the prompt Gemini gave you; Cursor can generate `scripts/seed_plant_library.ts` (or `.py`) and `plants_to_seed.txt`.

---

## Files to Touch

- `supabase/migrations/` — new table or migration for plant library
- `scripts/seed_plant_library.ts` — new script
- `plants_to_seed.txt` — input list of plant names

---

## Defer

- **"Verified" flag for plant library:** Human review before making entries public. Defer until you have multiple users.
