# Testing Suite — Garden Tracker

This project uses **Vitest** for unit and component tests, with **Testing Library** for React components and **jsdom** for a browser-like environment.

## When to run the test suite

**Run the entire test suite whenever you implement a new feature or fix a bug.** Treat it as mandatory:

- **Before committing** — Run `npm run test:run` (or `npm run test:ci` if you want coverage) and fix any failures.
- **When adding a feature** — Run tests after each logical change; keep the suite green before and after.
- **When fixing a bug** — Run the full suite to ensure the fix doesn't break something else; add a test for the bug if it's in testable logic.

Do not merge or ship code with failing tests. If you're in a hurry, at minimum run `npm run test:run` once before you push. In CI, use `npm run test:ci` so the pipeline fails when tests fail.

## Quick start

| Command | Description |
|--------|-------------|
| `npm test` | Run tests in **watch mode** (re-runs on file changes) |
| `npm run test:run` | Run all tests **once** (e.g. before commit) |
| `npm run test:ci` | Run tests once **with coverage** (for CI or local report) |
| `npm run test:e2e` | Run **E2E tests** (Playwright). Auto-starts dev server, or run `npm run dev` first |
| `npm run test:e2e:ui` | Run E2E tests with **Playwright UI** |
| `npm run test:all` | Run unit tests + coverage + E2E (full suite before push) |

## What's included

- **Config:** `vitest.config.mts` — jsdom, React, path aliases (`@/`), setup file
- **Setup:** `src/test/setup.ts` — extends Vitest with `@testing-library/jest-dom` matchers (e.g. `toBeInTheDocument()`)
- **Convention:** Test files live next to source as `*.test.ts` or `*.test.tsx`, under `src/`

## Current tests

### Shared helpers

- **`src/test/helpers.ts`** — `fakeUser()`, `makeSbChain()`, `makeSbMock()`, `fakePlantProfile()`, `fakeSeedPacket()`, `fakeGrowInstance()` — reduce boilerplate in lib and API route tests

### Lib

- **`src/sanity.test.ts`** — Sanity check that the runner works
- **`src/lib/canonicalKey.test.ts`** — `getCanonicalKey()` normalization
- **`src/lib/htmlEntities.test.ts`** — `decodeHtmlEntities()`, `stripHtmlForDisplay()` (scientific name and other display-safe text)
- **`src/lib/matchExistingProfile.test.ts`** — Existing profile matching when adding a packet (canonical name/variety, modifiers stripped)
- **`src/lib/varietyNormalize.test.ts`** — `stripVarietySuffixes`, `stripPlantFromVariety`, `cleanVarietyForDisplay` (variety normalization pipeline)
- **`src/lib/varietyModifiers.test.ts`** — `parseVarietyWithModifiers`, `normalizeForMatch` (manual/link import)
- **`src/lib/identityKey.test.ts`** — `identityKeyFromVariety`, `isGenericTrapName` (import dedupe/cache)
- **`src/lib/reviewImportSave.test.ts`** — `buildPlantProfileInsertPayload` (review-import save to plant_profiles)
- **`src/lib/seedPackets.test.ts`** — `SEED_PACKET_PROFILE_SELECT` includes `storage_location`; `SeedPacket` type (plant profile page)
- **`src/lib/supabaseAuthGetUser.test.ts`** — Supabase `auth.getUser()` response shape (`data: { user }`, not `data: user`); prevents type error in API routes that destructure incorrectly
- **`src/lib/parseFindHeroPhotoResponse.test.ts`** — Set Profile Photo "Search web" response parsing: valid JSON, invalid JSON / HTML / timeout bodies return friendly errors instead of "Unexpected token … is not valid JSON"
- **`src/lib/parseSeedFromQR.test.ts`** — `parseSeedFromQR`: URL query params, JSON payload, invalid input, empty string
- **`src/lib/scheduleUtils.test.ts`** — `getGuideHarvestDays`, `isGuideCropStartIndoors`, `getSowMonthsForGuide`
- **`src/lib/cascadeOnPacketDelete.test.ts`** — `cascadeForDeletedPackets`: empty list, soft-delete with/without grow instances, error handling
- **`src/lib/packetQtyLabels.test.ts`** — `qtyStatusToLabel`, `packetQtyLabels` mapping

### API routes

- **`src/app/api/seed/batch-import/route.test.ts`** — Batch import API (auth, validation)
- **`src/app/api/seed/scrape-url/route.test.ts`** — Scrape URL (missing url, invalid URL, disallowed domain, rate limit)
- **`src/app/api/seed/enrich-from-name/route.test.ts`** — Enrich from name (missing name, rate limit, missing API key)
- **`src/app/api/seed/find-hero-photo/route.test.ts`** — Find hero photo (missing name, rate limit, missing API key)
- **`src/app/api/seed/save-hero-to-cache/route.test.ts`** — Save hero to cache
- **`src/app/api/invite/route.test.ts`** — Invite user (missing env, invalid JSON, missing email, Supabase error, success)
- **`src/app/api/developer/usage/route.test.ts`** — Developer usage API

### Components

- **`src/app/settings/page.test.tsx`** — Settings page (with mocked auth/developer context)
- **`src/components/AddPlantModal.test.tsx`** — Add plant modal (render, seasonal/permanent options)
- **`src/components/TagBadges.test.tsx`** — `getTagStyle` (known tags, default, trimming) and `TagBadges` rendering (empty, tags, styles, className)

### E2E (Playwright)

**Unauthenticated (public pages — always run):**
- **`e2e/home.spec.ts`** — Login page load, sign-in prompt
- **`e2e/public-pages.spec.ts`** — Login, signup, reset-password pages load without error
- **`e2e/accessibility.spec.ts`** — axe accessibility audit (home, login)

**Authenticated (critical paths — run when `E2E_TEST_EMAIL` + `E2E_TEST_PASSWORD` are set):**
- **`e2e/auth.setup.ts`** — Signs in via Supabase REST API, injects session into localStorage, saves `storageState` to `.auth/user.json`
- **`e2e/smoke.authenticated.spec.ts`** — Smoke test: all main app pages load without redirecting to `/login` (Home, Vault, Garden, Calendar, Journal, Schedule, Shopping List, Settings, Shed)
- **`e2e/vault-add-seed.authenticated.spec.ts`** — FAB → Add Seed Packet: menu opens, QuickAddSeed modal opens, manual add flow completes on `/vault`
- **`e2e/shopping-list.authenticated.spec.ts`** — Shopping list page renders heading and content; add-from-vault flow (skips gracefully if no eligible profile)

## Coverage

Run `npm run test:ci` to generate coverage. Reports:

- **Terminal:** Summary and per-file percentages
- **HTML:** `coverage/index.html` — open in a browser for line-by-line view

Coverage includes `src/**/*.{ts,tsx}` and excludes test files, `src/test/`, and type declarations.

**Coverage thresholds** (in `vitest.config.mts`): CI fails if coverage drops below `lines: 2`, `functions: 14`, `branches: 50`. Current baselines at v1.0.0: lines 2.97%, functions 14.55%, branches 51.58%. Raise the thresholds as tests are added.

## Writing tests

See **[docs/TDD_GUIDE.md](docs/TDD_GUIDE.md)** for how to write tests in this project (TDD cycle, what to test, and examples).

## E2E troubleshooting

If you see `lockfileTryAcquireSync is not a function` when running `npm run test:e2e` (or `npm run dev`), it's a known Next.js issue on some Windows/OneDrive setups. Try:

1. **Start dev server manually** — Run `npm run dev` in a separate terminal. If it starts, run `npm run test:e2e` in another; Playwright will reuse the server.
2. **Try webpack** — `npm run dev:webpack` instead of `npm run dev` (may avoid the lockfile error).
3. **Move project** — Move the repo outside OneDrive or a synced folder.
4. **Exclude from antivirus** — Add the project folder to Windows Defender exclusions.

## CI

GitHub Actions (`.github/workflows/test.yml`) runs on every push and PR to `main`:

| Job | What it does |
|-----|-------------|
| `unit` | `npm run test:ci` — unit tests + coverage |
| `e2e` | Build → start server → Playwright (public + authenticated if secrets are set) |

The `e2e` job uploads the Playwright HTML report as an artifact (`playwright-report`, 14-day retention) so you can inspect failures without re-running locally.

### GitHub Secrets required

Add these in **GitHub → your repo → Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|--------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon/publishable key |
| `E2E_TEST_EMAIL` | Email of a confirmed Supabase user for E2E tests |
| `E2E_TEST_PASSWORD` | Password for that user |

Without `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` the build will fail (Next.js needs them at compile time). Without `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` the authenticated E2E project is skipped automatically — only public-page tests run.

### Running the full suite locally before pushing

```bash
npm run test:all
```

This runs unit tests (with coverage) and then E2E. Requires `E2E_TEST_EMAIL` + `E2E_TEST_PASSWORD` in `.env.local` for the authenticated suite.

---

## Gaps and suggested next steps

| Gap | Why it matters | Effort | Status |
|-----|----------------|--------|--------|
| **Plant → harvest E2E** | Sow + harvest is the core garden loop; not yet automated. | Medium | Open |
| **mergeProfiles test** | `reassignAndMergeProfiles` touches many tables; worth a focused DB-mock test. | Medium | Open |
| **fillBlanksCache test** | Cache-fill logic used during import; a unit test would lock down cache-hit behavior. | Medium | Open |
| **Component integration** | `QuickAddSeed` and `AddPlantModal` happy-path submission. | Medium–high | Open |
| ~~**More E2E flows**~~ | ~~Vault → add seed and shopping list added.~~ | — | Done |
