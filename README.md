# Garden Tracker

Universal Garden Management PWA — **Garden Tracker / Seed Vault**. Next.js (App Router), TypeScript, Tailwind CSS. Supabase + Vercel AI SDK planned.

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

**Database:** Run `supabase/migrations/20250204000000_garden_tables.sql` in the Supabase SQL Editor if you haven’t already (creates `tasks`, `grow_instances`, `journal_entries`, and optional columns on `plant_varieties`).

**Data maintenance** (discover, scrape, cleanup, normalize): see [docs/DATA_MAINTENANCE.md](docs/DATA_MAINTENANCE.md).

## Structure

- **Home** — Dashboard: pending tasks, recent activity, journal photos
- **Vault** — Seed Vault (Icon Grid / Detailed List). Click a plant → `/vault/[id]` (Specs, Journal, Batches)
- **Calendar** — Tasks from Supabase by month (Sow/Harvest from batches)
- **Journal** — Journal entries from Supabase (notes/photos by plant)
- **Chat** — AI assistant (planned)

## 3-tier data (planned)

1. **Tier 1:** Plant Variety (master care specs)
2. **Tier 2:** Seed Stock (inventory: Full / Partial / Low / Empty)
3. **Tier 3:** Grow Instance (seasonal record linking 1 & 2)
