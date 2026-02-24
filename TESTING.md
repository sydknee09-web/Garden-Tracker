# Testing Suite — Garden Tracker

This project uses **Vitest** for unit and component tests, with **Testing Library** for React components and **jsdom** for a browser-like environment.

## When to run the test suite

**Run the entire test suite whenever you implement a new feature or fix a bug.** Treat it as mandatory:

- **Before committing** — Run `npm run test:run` (or `npm run test:ci` if you want coverage) and fix any failures.
- **When adding a feature** — Run tests after each logical change; keep the suite green before and after.
- **When fixing a bug** — Run the full suite to ensure the fix doesn’t break something else; add a test for the bug if it’s in testable logic.

Do not merge or ship code with failing tests. If you’re in a hurry, at minimum run `npm run test:run` once before you push. In CI, use `npm run test:ci` so the pipeline fails when tests fail.

## Quick start

| Command | Description |
|--------|-------------|
| `npm test` | Run tests in **watch mode** (re-runs on file changes) |
| `npm run test:run` | Run all tests **once** (e.g. before commit) |
| `npm run test:ci` | Run tests once **with coverage** (for CI or local report) |
| `npm run test:e2e` | Run **E2E tests** (Playwright). Auto-starts dev server, or run `npm run dev` first |
| `npm run test:e2e:ui` | Run E2E tests with **Playwright UI** |

## What’s included

- **Config:** `vitest.config.mts` — jsdom, React, path aliases (`@/`), setup file
- **Setup:** `src/test/setup.ts` — extends Vitest with `@testing-library/jest-dom` matchers (e.g. `toBeInTheDocument()`)
- **Convention:** Test files live next to source as `*.test.ts` or `*.test.tsx`, under `src/`

## Current tests

- **`src/sanity.test.ts`** — Sanity check that the runner works
- **`src/lib/canonicalKey.test.ts`** — `getCanonicalKey()` normalization
- **`src/lib/htmlEntities.test.ts`** — `decodeHtmlEntities()`, `stripHtmlForDisplay()` (scientific name and other display-safe text)
- **`src/lib/matchExistingProfile.test.ts`** — Existing profile matching when adding a packet (canonical name/variety, modifiers stripped)
- **`src/lib/vault.test.ts`** — Vault seed data transforms (`normalizeSeedStockRow`, etc.)
- **`src/lib/varietyModifiers.test.ts`** — `parseVarietyWithModifiers`, `normalizeForMatch` (manual/link import)
- **`src/lib/identityKey.test.ts`** — `identityKeyFromVariety`, `isGenericTrapName` (import dedupe/cache)
- **`src/lib/reviewImportSave.test.ts`** — `buildPlantProfileInsertPayload` (review-import save to plant_profiles)
- **`src/lib/seedPackets.test.ts`** — `SEED_PACKET_PROFILE_SELECT` includes `storage_location`; `SeedPacket` type (plant profile page)
- **`src/lib/supabaseAuthGetUser.test.ts`** — Supabase `auth.getUser()` response shape (`data: { user }`, not `data: user`); prevents type error in API routes that destructure incorrectly
- **`src/lib/parseFindHeroPhotoResponse.test.ts`** — Set Profile Photo “Search web” response parsing: valid JSON, invalid JSON / HTML / timeout bodies return friendly errors instead of “Unexpected token … is not valid JSON”
- **`src/app/settings/page.test.tsx`** — Settings page (with mocked auth/developer context)
- **`src/app/api/seed/batch-import/route.test.ts`** — Batch import API (auth, validation)
- **`e2e/home.spec.ts`** — E2E: Home page load, navigation
- **`e2e/accessibility.spec.ts`** — E2E: axe accessibility audit (home, login)

## Coverage

Run `npm run test:ci` to generate coverage. Reports:

- **Terminal:** Summary and per-file percentages
- **HTML:** `coverage/index.html` — open in a browser for line-by-line view

Coverage includes `src/**/*.{ts,tsx}` and excludes test files, `src/test/`, and type declarations.

**Coverage thresholds** (in `vitest.config.mts`): CI fails if coverage drops below `lines: 1.5`, `functions: 10`, `branches: 50`. Raise these as tests are added.

## Writing tests

See **[docs/TDD_GUIDE.md](docs/TDD_GUIDE.md)** for how to write tests in this project (TDD cycle, what to test, and examples).

## E2E troubleshooting

If you see `lockfileTryAcquireSync is not a function` when running `npm run test:e2e` (or `npm run dev`), it’s a known Next.js issue on some Windows/OneDrive setups. Try:

1. **Start dev server manually** — Run `npm run dev` in a separate terminal. If it starts, run `npm run test:e2e` in another; Playwright will reuse the server.
2. **Try webpack** — `npm run dev:webpack` instead of `npm run dev` (may avoid the lockfile error).
3. **Move project** — Move the repo outside OneDrive or a synced folder.
4. **Exclude from antivirus** — Add the project folder to Windows Defender exclusions.

## CI

Use `npm run test:ci` in your pipeline. It exits with a non-zero code if tests fail. Optionally add coverage thresholds in `vitest.config.mts` under `coverage.lines`, `coverage.functions`, etc., to fail the build when coverage drops below a target.

---

## Gaps and suggested next steps

These are the main missing pieces; add them when you want more safety or documentation.

| Gap | Why it matters | Effort |
|-----|----------------|--------|
| **Lib utilities with no tests** | Pure logic that’s easy to test and often used in import/cache flows. | Low |
| **More API route tests** | batch-import, developer/usage, save-hero-to-cache covered. Add invite, scrape-url, etc. | Medium |
| **More component tests** | Only Settings page is tested. Small components (e.g. `TagBadges`, `getTagStyle`) are good next targets. | Low–medium |
| **Shared test helpers** | No shared mocks (e.g. Supabase client, `user`, or fake DB rows). Adding `src/test/helpers.ts` or `mocks/` would reduce duplication once you test API routes or auth-dependent code. | Low to add as you need them |
| **More E2E flows** | Home, login, accessibility covered. Add vault → add seed, plant → harvest, etc. | Medium |
| ~~Coverage thresholds~~ ✓ | Coverage is reported but doesn’t fail the build. Optional: set `coverage.lines: 80` (or similar) in `vitest.config.mts` to enforce a minimum. | Low |

### Recommended next tests (high value, low effort)

1. **`src/lib/htmlEntities.test.ts`** — `decodeHtmlEntities()` is small and pure; test numeric, hex, and named entities, plus null/empty.
2. **`src/lib/parseSeedFromQR.test.ts`** — Test URL query params, JSON payload, invalid input, empty string.
3. **`src/lib/varietyNormalize.test.ts`** — `stripVarietySuffixes()` (and related helpers) drive identity keys and cache; worth locking down.
4. **`src/lib/identityKey.test.ts`** — Depends on canonicalKey + varietyNormalize; test `identityKeyFromVariety` and `isGenericTrapName`.
5. **`src/components/TagBadges.test.tsx`** — Test that tags render and `getTagStyle` returns the right class for known tags (and a default for unknowns).
