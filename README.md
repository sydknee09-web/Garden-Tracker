# Garden Tracker — Seed Vault

A personal garden management web app. Track your seed packets, plan and record plantings, log growth and harvests, manage care schedules, and collaborate with your household.

**Live app:** [https://garden-tracker-cyan.vercel.app](https://garden-tracker-cyan.vercel.app)  
**Stack:** Next.js 14 (App Router) · TypeScript · Tailwind CSS · Supabase · Google Gemini

---

## Getting started

**Prerequisites:** Node **24.x**, npm, and a [Supabase](https://supabase.com) project (create one at supabase.com → New project; get URL and anon key from **Project settings → API**).

1. **Clone and install**
   ```bash
   git clone <your-repo-url>
   cd garden-tracker
   npm install
   ```

2. **Environment variables**  
   Create `.env.local` in the project root with at least:
   - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL  
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key  
   - `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` (for auth redirects)  
   Add `SUPABASE_SERVICE_ROLE_KEY` for storage and invite flows. For AI features (photo extraction, hero image search), add `GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY`.  
   Full list and optional keys: [Environment variables](#environment-variables) below.

3. **Database**  
   Apply migrations so the schema exists:
   ```bash
   supabase db push
   ```
   Or run each `.sql` in `supabase/migrations/` in order via the Supabase **SQL Editor**.

4. **Run the app**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000), then sign up or sign in.

5. **Run tests**  
   `npm run test:run` — unit tests. See [Testing](#testing) for E2E and coverage.

---

## Features

| Section | What it does |
|---------|-------------|
| **Vault** | Seed packet inventory — import by link, photo, or manual entry. Profile detail with About, Care, Packets, Plantings, Journal tabs. |
| **Garden** | Active plantings with quick-tap Water / Fertilize / Spray care. Harvest modal with weight and unit. My Plants (permanent plants). |
| **Calendar** | Tasks by month — Sow, Harvest, Care. Overdue section. |
| **Journal** | Timeline, table, and grid views. Edit entries. Photos with compression. |
| **Shopping List** | Out-of-stock seeds and supplies. Wishlist placeholders. |
| **Settings** | Planting zone, location, weather, data export, household sharing, developer tools. |

---

## Running locally

New to the project? See [Getting started](#getting-started) above.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port shown in the terminal).

### Environment variables

Create `.env.local` in the project root:

```env
# Supabase (required)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # needed for some admin/storage flows

# App URL — used for auth email redirects (use http://localhost:3000 locally)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# AI / enrichment (optional — features degrade gracefully without them)
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-key      # or GEMINI_API_KEY — photo extraction, hero image search
OPENAI_API_KEY=your-openai-key                    # OCR fallback
PERENUAL_API_KEY=your-perenual-key                # botanical enrichment
TAVILY_API_KEY=your-tavily-key                    # web scraping search

# E2E testing (optional — only needed to run authenticated Playwright tests)
E2E_TEST_EMAIL=your-test-account@example.com
E2E_TEST_PASSWORD=your-test-password
```

### Database

Apply all migrations in `supabase/migrations/` in order:

```bash
supabase db push          # via Supabase CLI
# or run each .sql file in the Supabase SQL Editor
```

See [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md) for Vercel-specific setup.

---

## Testing

```bash
npm run test:run          # unit tests (run once)
npm test                  # unit tests in watch mode
npm run test:ci           # unit tests + coverage report
npm run test:e2e          # Playwright E2E tests (requires dev server or npm run dev)
npm run test:all          # full suite: unit + coverage + E2E (run before tagging a release)
```

See [TESTING.md](TESTING.md) for the full test inventory, CI setup, and E2E troubleshooting.

**Law:** Run `npm run test:run` before every commit. Do not ship with failing tests.

---

## Project structure

```
src/
  app/           # Next.js App Router pages and API routes
  components/    # Shared React components
  lib/           # Utility functions (compressImage, generateCareTasks, etc.)
  types/         # Shared TypeScript interfaces (garden.ts)
  test/          # Test helpers and setup
e2e/             # Playwright E2E tests
docs/            # Architecture, nav map, testing checklist, bugs, deployment
supabase/
  migrations/    # SQL migration files (apply in order)
```

---

## Key architecture

| Layer | Tech |
|-------|------|
| Framework | Next.js 14 App Router |
| Database + Auth + Storage | Supabase (Postgres + RLS) |
| Styling | Tailwind CSS (`emerald`, `citrus` design system) |
| AI | Google Gemini — extraction, hero image, research |
| OCR | OpenAI gpt-4o-mini + Tesseract.js |
| State | React `useState` / `useCallback` — Supabase is source of truth |

**Data model:** `plant_profiles` → `seed_packets` → `grow_instances` → `journal_entries`  
All user tables are protected by Supabase Row Level Security (`auth.uid() = user_id`).

---

## Deployment

Deployed to Vercel. See [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md) for the full checklist including required environment variables, build settings, and post-deploy Supabase auth configuration.

---

## Design system

- **Background:** Paper white `#FAFAF8`
- **Primary action:** Emerald `#064e3b` (`emerald-900`)
- **Success state:** Emerald luxury `#50C878` (toasts only)
- **Alert:** Citrus `#FFD700`
- Touch targets: `min-w-[44px] min-h-[44px]` on all interactive elements
- Modals: `max-h-[85vh]` with internal scroll

---

## Docs

| Doc | Purpose |
|-----|---------|
| [TESTING.md](TESTING.md) | Test inventory, CI, E2E setup |
| [docs/NAVIGATION_MAP.md](docs/NAVIGATION_MAP.md) | All app navigation flows (do not change without approval) |
| [docs/BUGS.md](docs/BUGS.md) | Known issues triage and security checklist |
| [docs/VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md) | Deploy checklist and env vars |
| [docs/TESTING_CHECKLIST.md](docs/TESTING_CHECKLIST.md) | Manual QA checklist by phase |
| [docs/TDD_GUIDE.md](docs/TDD_GUIDE.md) | How to write tests in this project |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
