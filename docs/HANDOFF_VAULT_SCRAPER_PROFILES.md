# Technical summary: Vault, scraper, plant_profiles

Use this as a handoff for a new chat. Paste into a new chat to restore context.

---

## 1. Vault UI (`src/app/vault/page.tsx`)

- **No `Vault.tsx`** – main vault lives in **`src/app/vault/page.tsx`** (and `import/page.tsx`, `[id]/page.tsx`).

**Recent behavior:**

- **Title:** Page title is **"Plant Vault"** (not "Seed Vault").
- **View toggle:** Tab bar at top: **"Seed Vault"** (grid) and **"Plant Profiles"** (detailed list). No separate `ViewToggle` component.
- **Selection / action bar:** When items are selected, the action bar is **inline above the grid/list** (not fixed to bottom). Buttons: **Cancel**, **Select All**, **Merge**, **Plant**, **Dispose**, **Schedule**. Merge and Dispose are wired; Plant and Schedule show "coming soon" toasts.
- **Merge modal:** Fixed layout: scrollable body + **fixed footer** with **Cancel** and **Confirm Merge** (emerald). `handleConfirmMerge`: update `seed_packets.plant_profile_id` to master, delete source rows from `plant_profiles`, then close modal and refetch.
- **QR:** No "Scan QR" in the vault header. `QRScannerModal` and `handleQRScan` still exist for possible future use. **"Scan QR Packet" was removed from the Add Seed flow** in `QuickAddSeed.tsx` (Manual Entry and Batch Add only).
- **Removed:** "Load Seed Details Selected" and "Scan QR Packet" from vault/Add Seed.

---

## 2. Scraper (`src/app/api/seed/scrape-url/route.ts`)

- **File:** Main scraper is **`src/app/api/seed/scrape-url/route.ts`** (no `scraper.ts`).

**Relevant behavior:**

- **Zone 10b:** Uses **`applyZone10bToProfile(plantName, scraped)`** from `@/data/zone10b_schedule` to merge scraped data with static schedule (sowing_method, planting_window, sun, spacing, germination, maturity). Schedule overrides when a plant is in `ZONE_10B_SCHEDULE`.
- **Output:** Returns scraped fields (plant, variety, sun, spacing, harvest_days, days_to_germination, imageUrl, vendor, etc.) used by Link Import and batch-import to create/update **plant_profiles** and **seed_packets**. Batch-import and Link Import also write **sowing_method** and **planting_window** to `plant_profiles` when present from the schedule.

---

## 3. `plant_profiles` (and related) schema

**`plant_profiles`** (migrations `202502057*`, `202502059*`):

- **Core:** `id`, `user_id`, `name`, `variety_name`, `primary_image_path`, `sun`, `water`, `plant_spacing`, `days_to_germination`, `harvest_days`, `height`, `tags`, `status`, `created_at`, `updated_at`.
- **Zone 10b / "Brain":** `sowing_method text`, `planting_window text` (added in `20250205900000_plant_profiles_sowing_planting_window.sql`).
- **Unique:** One profile per user per (name, variety_name) via index on `(user_id, trim(lower(name)), trim(lower(coalesce(variety_name, ''))))`.
- **RLS:** Users can only access their own rows.

**`seed_packets`** (same migration):

- **FK:** `plant_profile_id` → `plant_profiles(id)` ON DELETE CASCADE; `user_id`; plus vendor/purchase fields, `qty_status` (0–100), `scraped_details`, `primary_image_path`, `purchase_date`, etc.
- **Default:** `qty_status` default 100 (e.g. in `202502060*` if present).

**`schedule_defaults`** ("Teach the Brain"):

- **Table:** `user_id`, `plant_type`, `sun`, `plant_spacing`, `sowing_method`, `planting_window`, `days_to_germination`, `harvest_days`, timestamps. **UNIQUE (user_id, plant_type)**.
- **Use:** User-defined defaults per plant type; merged with `ZONE_10B_SCHEDULE` via `applyZone10bToProfileWithUser()` / `fetchScheduleDefaults()` so Link Import and profile UI can show and use "Brain" data.

**Legacy:**

- **`plant_varieties`** still exists; vault and profile pages support both **plant_profiles** and legacy **plant_varieties** (e.g. delete and load logic try `plant_profiles` first, then `plant_varieties`). Migration script and optional drop-legacy migration exist.

---

## 4. Quick reference

| Area            | Main file(s)                                      | Notes                                                                 |
|-----------------|---------------------------------------------------|-----------------------------------------------------------------------|
| Vault list/grid | `src/app/vault/page.tsx`, `SeedVaultView.tsx`    | Tab bar, inline selection bar, Merge modal with fixed footer         |
| Add Seed        | `QuickAddSeed.tsx`                                | Manual Entry + Batch Add only; no Scan QR                             |
| Link Import     | `src/app/vault/import/page.tsx`                   | "New Plant Detected" modal, Save to Brain → `schedule_defaults`       |
| Scraper API     | `src/app/api/seed/scrape-url/route.ts`            | Uses Zone 10b schedule; no direct DB write                            |
| Schedule data   | `src/data/zone10b_schedule.ts`, `schedule_defaults` | Static schedule + user "Brain" in DB                              |
| Profiles schema | `plant_profiles`, `seed_packets`, `schedule_defaults` | Profiles + packets; sowing_method/planting_window on profiles     |
