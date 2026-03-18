# Synthetic User Procedure

A **single sequential user journey** that simulates a real user session through the app. One login, one browser context, multiple actions in order. Use for pre-deploy smoke, production monitoring, or regression verification.

## What it does

The procedure runs these steps in sequence:

1. **Home** — Load dashboard, verify no login redirect
2. **Vault** — Navigate, verify load
3. **Add Seed Packet** — FAB → Add Seed Packet → Manual Entry → fill name → save (creates a unique test plant)
4. **Journal** — FAB → Add journal → Quick Log → save note
5. **Calendar** — Load, open FAB, close
6. **Shopping List** — Load, verify heading
7. **Garden** — Load, verify
8. **Settings** — Load, verify
9. **Shed** — Load, verify
10. **Home** — Return, verify full loop

Each step asserts: no login redirect, main content visible, no visible error alerts where applicable.

## Requirements

- **Auth:** `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` in `.env.local` (or environment)
- **Browsers:** `npx playwright install` (first time)

## Running

### Local (default)

Starts the dev server and runs the procedure against `http://localhost:3000`:

```bash
npm run test:synthetic
```

### Production or staging

Run against a deployed URL. Use `CI=true` to skip starting the dev server:

```bash
CI=true PLAYWRIGHT_BASE_URL=https://your-app.vercel.app npm run test:synthetic
```

Or if the dev server is not needed (e.g. external cron):

```bash
PLAYWRIGHT_BASE_URL=https://your-app.vercel.app npm run test:synthetic
```

(If no server is running on localhost, Playwright will fail to connect for the health check — use `CI=true` when testing remote URLs.)

### Direct Playwright

```bash
npx playwright test synthetic-user.authenticated.spec.ts --project=chromium-authenticated
```

## Use cases

| Use case | How to run |
|----------|------------|
| **Pre-commit / pre-push** | `npm run test:synthetic` (with dev server) |
| **CI before deploy** | Same as full E2E; synthetic runs with other authenticated specs |
| **Production monitoring** | Cron job: `CI=true PLAYWRIGHT_BASE_URL=https://... npm run test:synthetic` |
| **Staging smoke** | `CI=true PLAYWRIGHT_BASE_URL=https://staging.vercel.app npm run test:synthetic` |

## Scheduling (production monitoring)

For synthetic monitoring against production:

1. **Cron / GitHub Actions:** Add a scheduled workflow that runs the synthetic procedure against your production URL. Use `E2E_TEST_EMAIL` and `E2E_TEST_PASSWORD` as secrets.
2. **External monitors:** Services like Checkly or Browserbase can run Playwright scripts against your app. This procedure is a good candidate for that.
3. **Vercel Cron:** The health endpoint (`/api/health`) is for uptime. The synthetic procedure exercises **user flows** (login, add seed, journal, etc.) — a stronger signal than a simple health check.

## Output

Steps are logged to the console with `[Synthetic] Step N: ...`. The HTML report (default) shows the full trace. On failure, a screenshot and trace are captured.

## Relation to other tests

- **Smoke tests** (`smoke.authenticated.spec.ts`): Each route tested in isolation, in parallel.
- **Synthetic procedure**: One session, one flow, sequential. Catches issues that only appear when state accumulates (e.g. navigation after adding data).
- **Critical-path specs** (vault-add-seed, journal-create, etc.): Focused flows, run in parallel. Synthetic runs a superset in sequence.
