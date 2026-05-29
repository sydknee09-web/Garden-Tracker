# Supabase operational runbook

> Operational playbook for the Supabase project that powers Garden Tracker. Covers backup posture, restore procedures, drill cadence, and migration hygiene pointers. Read this when planning a restore, evaluating tier costs, scheduling a drill, or onboarding a new dev to platform ops.
>
> **First written:** 2026-05-28 (closes R1.1 from `.claude/plans/supabase_library_load_audit.md`).
> **Why this doc exists:** VISION §2 anchors the product's moat in a multi-year personal-library accrual ("year 5 is more valuable than year 1"). Backup loss = product death for a long-horizon-accrual product. The cheapest moment to confirm backups work is BEFORE losing data.

---

## 1. Project identity

| Field | Value |
|---|---|
| Project ref | `ocupjwbksaqmujbpolwp` |
| Project name | Garden Tracker |
| Region | West US (Oregon) |
| Organization | `sydneysubscribed@gmail.com's Org` (`ksljkwmteedopglacypi`) |
| Created | 2026-02-04 |
| Postgres version | 17.6.1.063 (per `supabase services`) |
| supabase-js | 2.94.1 (per `package.json`) |
| Supabase CLI tested with | 2.98.2 |

---

## 2. Current backup configuration (as of 2026-05-28)

Verified directly via `supabase backups list --project-ref ocupjwbksaqmujbpolwp`:

| Axis | Value | Source / verification |
|---|---|---|
| Automated daily physical backups (WAL-G) | **enabled** | CLI output `WALG: true` |
| Point-in-Time Recovery (PITR) | **disabled** | CLI output `PITR: false` |
| Earliest / Latest PITR timestamp | 0 / 0 | Consistent with PITR off |
| Backup region | West US (Oregon) | CLI output (same region as DB) |
| Database size | 81 MB | `supabase inspect db db-stats --linked` |
| WAL size | 64 MB | same |

**Inferred but not directly CLI-verifiable** — confirm via Supabase dashboard (`https://supabase.com/dashboard/project/ocupjwbksaqmujbpolwp/database/backups` + billing page):

| Axis | Inferred value | Why inferred | Status |
|---|---|---|---|
| Plan tier | Pro (≥) | WAL-G physical backups are unavailable on Free tier — their presence implies Pro tier or higher | needs dashboard confirmation |
| Retention period | 7 days | Pro tier default (Team extends to 14 days) | needs dashboard confirmation |
| Restore granularity | Daily snapshots only | Direct consequence of PITR-disabled — no sub-day rollback target available | confirmed |

**What this means for recovery:**

- **Up to ~24 hours of data loss** is possible in a worst-case scenario (catastrophe right before the next daily snapshot, restore to the previous one). With PITR off, this is the floor.
- **Snapshots older than ~7 days are unrecoverable** (assuming Pro retention). Anything older than the retention window is gone unless a manual export was taken.
- **Physical-restore path requires Supabase support OR dashboard clone** (Pro tier exposes "Restore a backup" UI; otherwise file a ticket). Not user-self-serviceable from the CLI.

---

## 3. How backups actually work here

Two backup paths are available, each with different recovery characteristics:

### Path A — Supabase platform backups (automatic)

What Supabase runs for you behind the scenes. Currently enabled (see §2):

- **WAL-G physical backups** — daily snapshot of the entire Postgres cluster at the storage layer. Restored by Supabase support (or via dashboard clone on Pro+). Granularity = 1 snapshot per day.
- **PITR (currently OFF)** — when enabled, archives WAL segments continuously so you can restore to any second within the retention window. Costs extra (~$100/mo on Pro at audit-time pricing); we don't have it. To enable: dashboard → project → Database → Backups → Enable PITR. **Decision deferred** until first non-household user lands (see §9).

### Path B — Manual logical export (user-controlled)

What you can take and restore yourself, independent of plan tier:

- **`pg_dump` via the Supabase CLI** (`supabase db dump --linked`) produces a portable `.sql` file. Restorable into any Postgres instance via `psql` or `supabase db reset`. Self-serviceable, free, but only as fresh as the most recent dump.
- **Caveat — this path needs Docker on the local machine.** `supabase db dump` runs `pg_dump` inside a Docker container that matches the remote Postgres version. On a machine without Docker Desktop the command fails (see §4 fallback).
- **Frequency:** ad-hoc / pre-migration / pre-major-ship. Not automated today.

**Path A is the day-to-day insurance.** Path B is the user-controlled belt-and-suspenders option that exists independent of Supabase's tier.

---

## 4. How to download a backup manually

### 4.a Prerequisites

- Supabase CLI installed + logged in: `supabase login` (one-time). Verify with `supabase projects list` — you should see Garden Tracker with `LINKED ●`.
- Project linked from the repo root: `supabase link --project-ref ocupjwbksaqmujbpolwp` (one-time). Verify with `supabase migration list --linked` — it should not error.
- **Docker Desktop running** (required for `supabase db dump`). The CLI runs `pg_dump` inside a Docker container matching the remote Postgres version. Without Docker, the dump step fails with "docker client must be run" — fall back to dashboard-only paths (§4.d).

### 4.b Schema-only dump (DDL — small, fast)

From the repo root:

```bash
supabase db dump --linked -f "$HOME/supabase-backups/gt-schema-$(date +%Y%m%d).sql"
```

Produces a `.sql` file containing every `CREATE TABLE`, `CREATE INDEX`, `CREATE POLICY`, etc. for the `public` schema. Typically a few hundred KB. Safe to keep around (no user data).

### 4.c Full data dump (schema + data via COPY statements)

```bash
supabase db dump --linked --data-only --use-copy -f "$HOME/supabase-backups/gt-data-$(date +%Y%m%d).sql"
```

Produces a `.sql` file containing `COPY` statements for every table's rows. Size scales with DB size — at audit time (2026-05-28) the database was 81 MB so the dump is in the tens-of-MB range. **Contains user data. Never commit. Keep outside the repo. Encrypt if storing long-term.**

For a combined schema + data dump (single file restorable end-to-end), omit `--data-only`:

```bash
supabase db dump --linked --use-copy -f "$HOME/supabase-backups/gt-full-$(date +%Y%m%d).sql"
```

### 4.d Dashboard fallback (when local Docker isn't available)

If `supabase db dump` fails because Docker isn't installed:

1. Open `https://supabase.com/dashboard/project/ocupjwbksaqmujbpolwp/database/backups`.
2. Pick the most recent daily backup row → "Download backup" (or "Restore"). Pro tier exposes both.
3. Verify the download size matches the dashboard-reported backup size.

Direct dashboard downloads are the workaround for any local environment that can't run the CLI dump path.

---

## 5. How to restore from a backup

Three restore scenarios, each with a different procedure:

### 5.a Restore from a manual `.sql` dump (Path B)

Use this when you have a `.sql` file from §4 and need to reconstitute the database (e.g. spinning up a fresh staging copy, recovering from a logical-corruption you caught yourself, validating a backup file is replayable).

**Target a fresh project (NEVER the live prod project):**

1. Create a throwaway Supabase project via the dashboard (or `supabase projects create`). Note the project ref.
2. Link it locally: `supabase link --project-ref <new-ref>`.
3. Apply the dump:
   ```bash
   psql "<connection-string-from-dashboard>" -f "$HOME/supabase-backups/gt-full-YYYYMMDD.sql"
   ```
   Requires `psql` on the local machine, OR push via a Docker container that has it.
4. Verify with `supabase inspect db table-stats --linked` — row counts should match the source DB at dump time.
5. Re-link back to the prod project: `supabase link --project-ref ocupjwbksaqmujbpolwp`. **CRITICAL** — don't leave the CLI linked to the throwaway project; the next `supabase db push` would target the wrong DB.

### 5.b Restore from a Supabase platform backup (Path A — same project)

Use this when production data has been lost / corrupted at the platform layer and the most recent daily snapshot is the recovery target. **This is destructive on the live project.**

1. Open `https://supabase.com/dashboard/project/ocupjwbksaqmujbpolwp/database/backups`.
2. Pick the snapshot row → "Restore". The dashboard will warn — read it.
3. **Without PITR**, the restore overwrites the project with the snapshot state. Any writes since the snapshot are lost.
4. After restore: run `npm run test:run` against any local clients pointed at this project; verify a small read via the app.

### 5.c Restore by cloning a backup to a new project (Path A — non-destructive)

Use this when you want to inspect a backup without touching prod (forensics, audit, training a new dev). Available on Pro tier.

1. Dashboard → Backups → pick the snapshot → "Clone to new project".
2. Wait for the clone to provision (~5 min).
3. Connect to the clone via its own project ref. Inspect at will.
4. Delete the clone when done (recurring cost otherwise).

### 5.d Decision matrix — which restore method when?

| Scenario | Use |
|---|---|
| "I want to test that a backup file replays cleanly" | 5.a — manual dump → fresh project replay |
| "Prod is corrupted; roll back to yesterday's snapshot" | 5.b — same-project restore (destructive) |
| "I need to inspect what changed since last Tuesday without touching prod" | 5.c — clone to new project |
| "Yesterday a user reported they lost data; can I recover their specific rows?" | 5.c — clone, query the clone, copy the rows back into prod manually |

---

## 6. Restore drill — log

A restore drill validates that the documented procedure actually works on this project. Without periodic drills, the procedure rots and discovers gaps only during a real recovery (the worst possible moment).

### 6.a Drill — 2026-05-28 (lightweight connectivity validation)

**Method.** CLI-direct reachability validation (no Docker available on the dev machine; full replay drill deferred).

**Commands run + observations:**

| Command | Result |
|---|---|
| `supabase projects list` | Project shown as `LINKED ●` |
| `supabase backups list --project-ref ocupjwbksaqmujbpolwp` | WAL-G=true, PITR=false, region West US (Oregon) |
| `supabase services` | Postgres 17.6.1.063 (local CLI version aligned with linked project) |
| `supabase inspect db table-stats --linked` | Full table list with row counts (e.g. `plant_profiles=590`, `grow_instances=30`, `journal_entries=441`, `tasks=956`, `seed_packets=1`, `global_plant_cache=23`) |
| `supabase inspect db db-stats --linked` | DB size = 81 MB, Index hit rate = 1.00, Table hit rate = 1.00, WAL = 64 MB |
| `supabase db dump --linked -f <path>` | **FAILED** — required Docker, not available locally. Dump path is documented in §4 but couldn't be drill-tested in this environment. |

**Outcome:** PARTIAL — API-tier reachability is proven (the data is queryable end-to-end via authenticated CLI). Manual-dump path (§4 / §5.a) and platform-restore paths (§5.b / §5.c) were NOT drill-tested in this environment.

**Time-to-complete:** ~5 min for the commands that worked. Docker install + full dump-and-replay drill would be a separate session (estimate: 30-60 min once Docker Desktop is installed).

**Gotchas surfaced:**

1. `supabase db dump` requires Docker Desktop on Windows. The CLI exits with `failed to inspect docker image` if Docker isn't running. **Implication:** any dev who needs to take a manual backup must install Docker Desktop first.
2. `supabase inspect db role-stats --linked` fails with `cannot scan null into *string` — a CLI bug at v2.98.2 with the current DB role inventory. Not blocking; informational.
3. The `--schema-only` flag does NOT exist; `supabase db dump --linked` (no extra flags) is already DDL-only. Use `--data-only` separately for data, or `--use-copy` for full schema+data.

### 6.b Drill — pending (full dump-and-replay, needs Docker)

Open follow-up: install Docker Desktop on the dev machine, then run the full §4.c → §5.a sequence to validate end-to-end. Adds confidence that Path B is genuinely user-self-serviceable.

### 6.c Drill — pending (dashboard clone, needs Syd)

Open follow-up: Syd to test the dashboard "Clone backup to new project" flow (§5.c) at least once. Adds confidence in the Path A user-self-serviceable restore path (separate from filing a support ticket).

---

## 7. Recommended ops cadence

Not enforced — having it documented means future-Claude or future-Syd can pick up the rhythm without re-deriving from scratch. Anchored in audit doc R1.9.

| Task | Cadence | Why |
|---|---|---|
| Backup verification (dashboard skim) | Monthly | Confirms daily snapshots are landing; takes ~30s |
| Manual dump archive (§4.c full dump) | Quarterly | Belt-and-suspenders against tier downgrade / Supabase outage / catastrophic platform corruption |
| Restore drill — dashboard clone (§5.c) | Annually | Validates the user-self-serviceable platform restore path. Most likely path during a real incident; rusts without exercise |
| Restore drill — manual dump replay (§5.a) | Annually | Validates Path B end-to-end |
| Supabase changelog scan | Monthly | Catches breaking changes, new deprecations, pricing shifts. ~5 min |
| Dependency bump — `@supabase/supabase-js` minor | When shipped | Bug fixes + minor features land here |
| Dependency bump — `@supabase/supabase-js` major | Dedicated chat | Breaking changes; treat as its own ship with audit |
| Tier / quota snapshot | Monthly | Cost trajectory visibility; foundation for VISION §1 freemium tier-design work. See audit doc R1.8 |
| RLS regression test run | On every migration touching policies | Catches the regression class that's bitten this codebase 9 times in household-sharing space. See audit doc R1.5 |

---

## 8. Migration hygiene — pointer

This doc does NOT canonicalize migration discipline. The canon lives in [`CLAUDE.md`](../CLAUDE.md) under the "SQL migrations" subsection. Key points (paraphrased — `CLAUDE.md` wins on conflict):

- Migration filename format = `YYYYMMDDHHMMSS_<description>.sql` (14-digit timestamp). **Duplicate prefixes cause silent skip on apply** — verified to have produced the U24-era bug. Mechanical guard shipped 2026-05-28 (R1.6): `npm run migration:check` runs locally and in CI (`.github/workflows/test.yml` `unit` job) and fails non-zero on duplicate prefixes. Known historical collisions already applied on remote are exempted via an explicit allowlist in [`scripts/check-migration-prefixes.js`](../scripts/check-migration-prefixes.js).
- Additive / idempotent SQL (CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS, etc.) → code-tier push; needs the standard "yes build" greenlight per push.
- Destructive / non-idempotent SQL (DROP TABLE, DROP COLUMN, TRUNCATE, RLS policy replacements) → always-ask tier; explicit per-push approval required EVEN after a general "yes build" on the broader change set.
- Migration history was reconciled 2026-05-17; `supabase migration list --linked` shows Local|Remote columns matching for every applied version.

---

## 9. Open follow-ups / known limitations

Documented so they don't get lost. Each is a separable item — work them in subsequent sessions per the audit doc's follow-up chapter list.

- **Tier + retention confirmation (Syd ask).** §2 infers Pro tier + 7-day retention from `WAL-G: true`. Direct confirmation requires the dashboard. Cheap to verify; just hasn't happened yet.
- **PITR cost decision deferred.** PITR is an additional ~$100/mo add-on at audit-time pricing. Decision deferred until first non-household user lands. The trade-off: with PITR off, worst-case data loss = up to 24 hours (between daily snapshots). With PITR on, worst-case data loss = seconds. For an app-store-distributed product (VISION §1, locked 2026-05-17), this is a real fork; not urgent today.
- **Docker not installed on the primary dev machine.** Blocks `supabase db dump` and `supabase start`. Workaround = dashboard download (§4.d). Decide whether to install Docker Desktop OR formally adopt dashboard-only as the canonical manual-export path.
- **Restore drill 6.a is PARTIAL.** Full §4.c → §5.a replay drill is queued (drill 6.b). Dashboard-clone drill is queued (drill 6.c). The connectivity validation drill 6.a does NOT substitute for a full replay test.
- **No automated backup-validation alert.** Today there's no monitoring on whether daily backups continue to land. The monthly dashboard skim (§7) is the manual proxy. Audit doc R1.8 (Management API quota snapshot script) is the natural future home for this.
- **R1.2 / R1.3 (composite indexes) not addressed here.** Those are separate ships per the audit doc; see `.claude/plans/supabase_library_load_audit.md`.
- **R1.6 (migration-collision guard).** Shipped 2026-05-28 — `npm run migration:check` is wired into the `unit` CI job. The `20260528120000` doublet that prompted the ship was resolved separately by `c81c3ab` (renamed `plant_profiles_planting_window_zone` to `20260528120001_*`); the allowlist entry is now inert and retained as a worked example of the mechanism. **R1.6 follow-up:** confirm `c81c3ab`'s rename was paired with `supabase migration repair --status applied 20260528120001` on remote — otherwise `migration_history` holds an orphan row for the original `20260528120000` version (same pattern as the historical `20250330000000` orphan documented in CLAUDE.md "SQL migrations").
- **CLI version drift.** v2.98.2 was used for this audit. v2.101.0 is current at write time. Bump opportunistically; not urgent.

---

## 10. Related docs

- **[`.claude/plans/supabase_library_load_audit.md`](../.claude/plans/supabase_library_load_audit.md)** — the full audit that produced this runbook (R1.1 is what's shipped here).
- **[`CLAUDE.md`](../CLAUDE.md)** — process canon. "SQL migrations" subsection is the migration-discipline source of truth.
- **[`docs/VISION.md`](VISION.md)** — §2 (multi-year accrual moat — backup-criticality anchor), §1 (app-store distribution — backup-as-platform-obligation anchor).
- **[`docs/DATA_MAINTENANCE.md`](DATA_MAINTENANCE.md)** — orthogonal: plant-cache scraping operations. Not backup-related; cross-linked here only to disambiguate.
- **`supabase/migrations/`** — every applied migration. The full schema history is reconstructable from this directory plus the reconciled remote state.

---

*Created 2026-05-28 closing audit R1.1. Update §2 dashboard-confirmed cells once Syd confirms tier + retention. Re-stamp §6 with each drill run.*






