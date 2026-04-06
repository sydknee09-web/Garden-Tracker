# Project status & action plan

**Purpose:** Living snapshot of where Seed Vault stands, which plans are authoritative, and what to do next. Update this when major milestones land or priorities shift.

**Last updated:** 2026-04-06

---

## Executive summary

The **market-readiness** track (navigation, schema cleanup, tests, UX gates, security notes) is largely complete. The **Seed Vault blueprint** is substantially implemented; a few blueprint items differ by design (e.g. packet list integrated into the Vault tab rather than a separate “All My Packets” page). See **`docs/IMPLEMENTATION_PLAN_AUDIT.md`** (dated 2026-03-15) for line-by-line verification.

**Tests:** Run `npm run test:run` before merges; policy in **`TESTING.md`**.

**Forward-looking work** clusters into two tracks: **offline write sync / replay** (infrastructure) and **ordered UX polish** (roadmap phases). Longer-horizon docs (companion planting, global library, import parity addenda) are reference-only until scheduled.

---

## Recently shipped (2026-04 session)

- **Calendar:** Overdue/upcoming loads first; `generateCareTasks` runs afterward with a visible “Updating care tasks…” state so the overdue section is not blocked.
- **Task detail:** Linked shed/supply resolves from `tasks.supply_profile_id` or, when needed, from `care_schedules` via `care_schedule_id`.
- **Care tasks:** Schedules can propagate `supply_profile_id` into generated tasks; pending tasks for dead/archived/soft-deleted grows are cleaned up.
- **Vault — Edit Plant Profile:** Modal scroll + `max-h` so Save/Delete stay reachable on small viewports.
- **Phase 0 Universal Add audit:** Verified stay + refresh across FAB hosts; fixed missing `NewTaskModal` `onSuccess` on Vault, Garden, and Journal (aligned with Home/Calendar).
- **Phase 1 iconography:** Updated `Plant`, `Journal`, `Harvest`, `Seed`, and `Pest` icons in `styleDictionary.tsx` (lined-paper journal, teardrop leaf, basket + fruit, sharper packet, bug silhouette); aligned JSDoc stroke comments to 1.2.
- **Phase 2 Add plant modal:** Permanent “link to existing” vendor field grouped above date; dedicated `profileId` flow shows plant line + vendor (permanent) instead of empty “create new” fields; tighter padding (`p-3`, `space-y-2.5`); confirm buttons unchanged (`Confirm Planting` / `Confirm Sowing`, `Adding…`).

---

## Authoritative plans (use these first)

| Document | Role |
|----------|------|
| [`.cursor/plans/remaining_steps_roadmap.plan.md`](../.cursor/plans/remaining_steps_roadmap.plan.md) | **Ordered UX backlog** — Universal Add audit (Phase 0), then luxury polish phases; run tests after each phase. |
| [`.cursor/plans/offline_write_sync.plan.md`](../.cursor/plans/offline_write_sync.plan.md) | **Offline writes** — audit, Tier A migration, ordered replay, storage policy, replay UX, tests; optional Phase 2 read cache. |
| [`docs/IMPLEMENTATION_PLAN_AUDIT.md`](IMPLEMENTATION_PLAN_AUDIT.md) | **Audit vs code** — what matched plans as of 2026-03-15. |

**Navigation and product flows:** [`docs/NAVIGATION_MAP.md`](NAVIGATION_MAP.md) is the source of truth; do not change FAB/back behavior without updating it.

---

## `.cursor/plans/` inventory (20 files)

Treat **`remaining_steps_roadmap`** + **`offline_write_sync`** as the **action backlog**. Other files are **deep dives or archives**:

| Theme | Examples |
|-------|----------|
| Roadmap / polish | `full_luxury_polish.plan.md`, `combined_ux_updates.plan.md`, `global_ui_ux_audit_refactor.plan.md` — largely sequenced inside `remaining_steps_roadmap`. |
| Feature-specific | `calendar_shed_fab_refactor.plan.md`, `planting_and_journal_ux_fixes.plan.md`, `packet_selection_and_edit.plan.md`, `add_plant_and_seed_packet_flows.plan.md`, `universal_add_menu.plan.md`, `filter_default_save_remove_flow.plan.md`, `loading_*.plan.md`, `plant_placeholder_and_loading_screen.plan.md` — many items already marked done in the roadmap; reopen only when needed. |
| Product / data | `seed_vault_final_blueprint_0c8b87cf.plan.md`, `pre_seed_plant_library.md`, `companion_planting_single_source_of_truth.md`, `estate_utility_global_library_handshake.plan.md`, `import_parity_addendum_link_import_source_of_truth.md`. |
| Execution notes | `vaultpagecontent_refactor_execution_addendum.md` — useful when touching Vault shell. |

No separate “orphan” doc is required if work is tracked here and in the two master plans above.

---

## Outstanding action items (consolidated backlog)

### Track A — Offline write sync

Source: `offline_write_sync.plan.md`.

1. Audit client writes (flow → tables → offline helper vs raw Supabase).
2. Ordered multi-step queue (client UUIDs, dependency order) and OfflineIndicator replay.
3. Migrate Tier A flows (e.g. Quick Log, journal, BatchLogSheet) to offline-safe writes; journal + junction tables consistent from the user’s perspective.
4. Storage policy: MVP vs deferred blob upload; document in UI.
5. Failed replay: no silent drops; user-visible errors and last-resort export/debug.
6. Verify Laws on queued operations (`user_id`, soft delete, etc.).
7. Automated tests + manual checklist (airplane mode, Safari, household as needed).
8. **Defer:** Phase 2 optional “offline browse” / read cache / heavy PWA until product demands it.

### Track B — Roadmap phases

Source: `remaining_steps_roadmap.plan.md`.

- **Phase 0:** Universal Add Menu audit — **done (2026-04-06):** code trace + fix for Add task on Vault/Garden/Journal; other paths already matched stay + refresh.
- **Phase 1:** Iconography in `styleDictionary.tsx` — **done** (see Recently shipped).
- **Phase 2:** Add permanent plant modal (`AddPlantModal.tsx`) — **done** (see Recently shipped).
- **Phases 3+:** Full luxury polish (vault profile, journal/garden alignment, `/journal/new` handling per locked decisions, etc.) — **in order**; run full test suite after each phase.

### Track C — Explicit deferrals (not blocking)

- **E2E plant → harvest** — deferred per implementation audit / Part 4 notes.
- **PWA “offline browse”** — distinct from write queue; optional Phase 2 in offline plan.

### Track D — Hygiene

- Group git commits by intent (e.g. calendar/care fixes vs unrelated vault/docs) to keep history reviewable.

---

## Quick health check

| Check | Command / reference |
|-------|---------------------|
| Unit & integration tests | `npm run test:run` |
| Plan vs codebase (periodic) | Re-run or spot-check `docs/IMPLEMENTATION_PLAN_AUDIT.md`; update audit date when you refresh it |
| Laws (RLS, soft delete, qty_status, compression, etc.) | `.cursor/rules/laws-of-the-vault.mdc` |

When this file and the audit diverge, **prefer updating this file** for “what’s next” and **update the audit** when you want a formal codebase verification pass.
