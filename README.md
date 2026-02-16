# Garden Tracker

Universal Garden Management PWA — **Garden Tracker / Seed Vault**. Next.js (App Router), TypeScript, Tailwind CSS. Supabase + Google Gemini for extraction/AI.

## Design system

- **Background:** Pure White `#FFFFFF`
- **Actions:** Emerald `#50C878`
- **Alerts:** Citrus `#FFD700`
- No grey; hierarchy via opacity, soft shadows (`0 10px 30px rgba(0,0,0,0.05)`), and white space.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) (or the port shown in the terminal).

**Auth sync:** Set `NEXT_PUBLIC_DEV_USER_ID` in `.env.local` to your Supabase user id so all data (vault, journal, tasks, batches) is saved and loaded for your account.

**Database:** Apply all migrations in `supabase/migrations/` in order (e.g. via Supabase CLI `supabase db push`, or run each `.sql` file in the Supabase SQL Editor). The foundation migration assumes `plant_profiles`, `seed_packets`, `grow_instances`, and related tables exist from earlier migrations.

**Data maintenance** (discover, scrape, cleanup, normalize): see [docs/DATA_MAINTENANCE.md](docs/DATA_MAINTENANCE.md).

**Testing:** Run the full suite for every feature or fix: `npm run test:run` (or `npm test` in watch mode). See [TESTING.md](TESTING.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Structure

- **Home** — Dashboard: pending tasks, recent activity, journal photos; link to Shopping List
- **Vault** — Seed Vault (grid / list / active / plants). Import (link, photo, manual), review, plant; profile detail at `/vault/[id]` (About, Packets, Plantings, Journal). Also: history, packets list, tags
- **Garden** — Active plantings, quick-tap care (water/fertilize/spray), harvest, bulk notes
- **Calendar** — Tasks from Supabase by month (Sow/Harvest from batches)
- **Journal** — Journal entries (table / grid / timeline), new entry
- **Shopping List** — Out-of-stock items + wishlist placeholders (linked from dashboard)
- **Settings** — Zone, location, weather, export, trash, household, developer tools, etc.
- **Chat** — AI assistant at `/chat` (coming soon; not in bottom nav)

## Data architecture

Plant Profile (master) → Seed Packets (inventory) → Grow Instances (seasonal plantings). Care schedules, tasks, and journal entries tie to profiles and instances.
