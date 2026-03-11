# Deprecated schema (mark for removal)

Schema elements that are no longer used by the app and are candidates for removal in a future migration.

## seed_stocks table

- **Migration:** `supabase/migrations/20250204500000_seed_stocks_rls.sql`
- **Columns:** `id`, `plant_variety_id`, `user_id`, `volume` (text: 'full'|'partial'|'low'|'empty'), `created_at`
- **Reason:** The app uses **`seed_packets.qty_status`** (numeric 0–100) as the single source of truth for seed inventory. The `seed_stocks` table and its string-based `volume` column are legacy. No application code reads or writes `seed_stocks`.
- **Action:** In a future Phase 2 migration, drop `seed_stocks` (or leave in place but never reference it). Ensure no RLS or triggers depend on it.

## Other tables

`plant_profiles` and `seed_packets` do **not** have `volume` or `stock_level` columns. All quantity is in `seed_packets.qty_status` (0–100).
