# Seed Vault Table — Technical Summary

Short reference for the next AI assistant or developer.

## Table state (list view)

- **Component:** `src/components/SeedVaultView.tsx`
- **Persistence:** `localStorage` key `"seed-vault-table-state"`.
- **Stored shape:** `{ columnOrder: string[], columnWidths: Record<string, number> }`.
- **Column IDs:** `name` | `variety` | `vendor` | `sun` | `spacing` | `germination` | `maturity` | `pkts` | `rating`.
- **Defaults:** Order `["name","variety","vendor","sun","spacing","germination","maturity","pkts","rating"]`; widths (px): name 140, variety 160, vendor 100, sun 88, spacing 100, germination 100, maturity 88, pkts 64, rating 88.
- **Load:** `loadListTableState()` — merges saved order with default so all 7 columns appear; missing columns are appended. Widths default then override from storage.
- **Save:** `saveListTableState(columnOrder, columnWidths)` — called when order or widths change.
- **Interactions:** Column **resize** = drag the right edge of a data column header; **reorder** = drag a data column header to a new position. Fixed columns: optional batch checkbox, then icon; then the seven data columns in `listColumnOrder`.
- **Rendering:** `<colgroup>` + `tableLayout: "fixed"`; headers and cells built from `listColumnOrder` via `renderHeader(colId)` and `renderCell(colId, seed)`.

## Database relationships (Variety vs Packet)

- **Parent (Variety):** `plant_profiles` — one row per variety; list view shows one row per `plant_profile`.
- **Child (Packet):** `seed_packets` — many per variety; `seed_packets.plant_profile_id` → `plant_profiles.id`.
- **Pkts column:** Displays the **count of child packets** per variety: `seed.packet_count` (count of `seed_packets` where `plant_profile_id` = that profile). Shows “Out of Stock” when count is 0 or status is `out_of_stock`.

## Import Logs

- **Settings:** Single card “Import Logs” linking to `/settings/import-logs` (see `src/app/settings/page.tsx`).
- **Full table + Clear Logs:** `src/app/settings/import-logs/page.tsx`.

## Dependencies

- **@tanstack/react-table** is installed but **not used** in the current table implementation (vanilla state + HTML5 drag-and-drop and resize). Optional: migrate to `useReactTable` for column APIs or remove the package if not needed elsewhere.
