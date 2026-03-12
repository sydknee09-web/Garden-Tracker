# Changelog

All notable changes to Garden Tracker are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) · Versioning: [SemVer](https://semver.org/)

---

## [1.0.0] — 2026-03-11

First market-ready release of Garden Tracker / Seed Vault.

### Added

**Seed Vault**
- Import seed packets by URL (scrape vendor pages), photo (AI extraction), or manual entry
- Plant profile detail: About, Care, Packets, Plantings, Journal tabs
- Hero image search (Gemini) with fallback chain (URL → storage → journal photo → packet → emoji)
- Batch import with review page; progressive save to localStorage
- Purchase order / order confirmation scanning (multiple line items)
- QR code scanning for seed packets
- Packet quantity tracking (`qty_status` 0–100); auto-archive at 0
- Auto-tag logic: 11 functional tags (Heat Lover, Pollinator, Cool Season, etc.)
- Profile type distinction: Seed (seasonal) vs Permanent (trees, perennials)

**Garden**
- Active plantings view with quick-tap Water / Fertilize / Spray care (instant journal entry)
- Harvest modal: weight, quantity, unit, photo, notes
- My Plants tab for permanent plant profiles with care schedules
- Batch selection: bulk journal entries, end crop, delete
- Grow filter (`?grow=`) from profile page → scroll-to and highlight batch

**Calendar**
- Monthly task grid with colored dots
- Overdue section (amber) at top; Upcoming; Completed (collapsible)
- New Task modal; `?openTask=1` URL param
- Care schedule tasks auto-generated from templates

**Journal**
- Timeline, table, and grid views
- Quick Log modal (slide-over) from any page's FAB
- Full journal entry form at `/journal/new`
- Edit entries (note, photos, plant links)
- Bulk selection and delete

**Shopping List**
- Out-of-stock seeds and supplies auto-added when packet qty hits 0
- Wishlist placeholder items (manual add by name)
- Dashboard section with "View full list" and "Add item"

**Settings**
- Planting zone, last frost date, location (lat/lng, name, geolocation)
- Weather widget using user coordinates
- Frost alert banner when ≤ 32°F forecast and active plantings exist
- Data export (JSON: profiles, packets, journal, tasks)
- Trash: soft-delete + restore + permanent delete
- Household sharing: create/join household, invite code, member list
- Developer tools: API usage, cache management, scraper audit

**Auth**
- Supabase PKCE flow for signup email verification and password reset
- `/auth/callback` page for code exchange
- Dynamic `redirectTo` using `window.location.origin` (works locally and in production)

**Universal Add Menu**
- FAB on every main page opens consistent menu: Add Seed Packet, Add plant, Add to shed, Add task, Add journal
- Stay-in-place behavior — only new plant profile creation redirects

**Infrastructure**
- Row Level Security on all user tables (`auth.uid() = user_id`)
- Image compression on all upload paths (client: `compressImage()`; server: Sharp)
- Soft delete throughout (`deleted_at` column on all user tables)
- Care schedule templates (on profiles) auto-copy to grow instances on planting
- Household-aware RLS and shared data access

### Testing

- 307 unit tests (Vitest + Testing Library)
- 14 Playwright E2E tests (auth, vault add seed, shopping list, 9-page authenticated smoke, accessibility)
- GitHub Actions CI: unit tests + E2E on every push/PR
- Auth setup via Supabase REST API injection (reliable in headless CI)

### Known limitations (post-launch)

- Zone-aware planting windows: `planting_zone` stored but not used in schedule calculations yet
- PWA / offline mode: not enabled for v1 (no service worker)
- Plant → Harvest E2E test: automated test deferred
- Virtual keyboard handling in full-screen modals (mobile): not explicitly handled

---

## [0.x] — Pre-release development

See git history for incremental development changes across Parts 0–5 of the project plan.
