# Deprecated schema

Schema elements removed or awaiting DB-level cleanup.

## seed_stocks table

- **Migration:** `supabase/migrations/20250204500000_seed_stocks_rls.sql`
- **Columns:** `id`, `plant_variety_id`, `user_id`, `volume` (text: 'full'|'partial'|'low'|'empty'), `created_at`
- **Reason:** The app uses **`seed_packets.qty_status`** (numeric 0–100) as the single source of truth for seed inventory.
- **App code removed (Part 1, 2026-03-11):** `src/lib/vault.ts` (`normalizeSeedStockRow`, `normalizeSeedStockRows`, `SeedStockRowRaw`), `src/types/vault.ts` (`SeedStockDisplay`, `SeedStockRow`), and `plant_variety_id` legacy fields in `Task`, `GrowInstance`, `JournalEntry`, `ShoppingListItem` interfaces. `src/lib/vault.test.ts` and `src/app/calendar/page_prev.tsx` also deleted.
- **DB table status:** Table still exists in Supabase but is never read or written by the app. Safe to drop via a future migration if desired.

## plant_variety_id column

- **Tables affected:** `tasks`, `grow_instances`, `journal_entries`, `shopping_list`
- **Status:** Column was dropped from DB previously. Legacy `plant_variety_id` optional fields removed from TypeScript interfaces in Part 1 (2026-03-11).

## Other notes

`plant_profiles` and `seed_packets` do **not** have `volume` or `stock_level` columns. All quantity is in `seed_packets.qty_status` (0–100).
