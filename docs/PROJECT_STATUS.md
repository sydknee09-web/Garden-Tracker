# Project status & action plan

> ⚠️ **SUPERSEDED (2026-06-14).** The live single source of truth is now [`/STATUS.md`](../STATUS.md) at the repo root. This file is a stale 2026-05-07 snapshot, kept for historical reference only. **For "where are we right now," read `/STATUS.md`.**

**Purpose:** Living snapshot of where Seed Vault stands, which plans are authoritative, and what to do next. Update this when major milestones land or priorities shift.

**Last updated:** 2026-05-07 (audit refresh; no code changes since 2026-04-06)

---

## Executive summary

The **market-readiness** track (navigation, schema cleanup, tests, UX gates, security notes) is complete. **Roadmap Phases 0–7 are shipped** (verified by file-level audit on 2026-05-07; see "Phase status" table below). The remaining UX-polish surface is narrow: parts of Phase 8 (global UI sweep) and Phase 9 (calendar recurrence + delete semantics) remain.

**Track A (offline write sync) is also substantially shipped** — `offlineQueue.ts`, `SyncContext`, `OfflineIndicator`, and Law-2-protected soft-delete normalization are all in place and used across 15+ flows. What's left is polish: ordered multi-step replay with dependency order, failed-replay UX, and an airplane-mode manual test pass.

**Tests:** 329 passing (`npm run test:run`, 2026-05-07). E2E suite has grown to 11 specs.

---

## Locked design decisions

These were verified during the 2026-05-07 audit and **should not be reopened** without explicit re-decision:

| Decision | What it is | Where to find it |
|----------|-----------|------------------|
| **Journal icon on planting card** | Opens QuickLog modal scoped to that batch (preselects grow_instance). NOT the original Option A (tab-switch + scroll). | [VaultProfilePlantingsTab.tsx:131](../src/app/vault/[id]/VaultProfilePlantingsTab.tsx), [page.tsx:1398](../src/app/vault/[id]/page.tsx) |
| **/journal/new** | Kept as the "Full journal entry" deep form, linked from QuickLogModal. NOT deprecated/redirected. | Regression-tested in [permanentPlantProfile.regression.test.ts:44](../src/app/vault/permanentPlantProfile.regression.test.ts) |
| **LoadingScreen** | Background matches manifest splash for seamless transition — no teal, no fade-out. | Comment in [LoadingScreen.tsx:5](../src/components/LoadingScreen.tsx) |
| **Stroke 1.2** | All ICON_MAP icons use `strokeWidth: 1.2`. | [styleDictionary.tsx:20](../src/lib/styleDictionary.tsx) |
| **Emerald-luxury (#50C878)** | Reserved for success/reward contexts (toasts, completed checkmarks, generic journal "logged" types). NOT a default UI color. | Roadmap "Locked decisions" header |
| **Phase 0 redirect rule** | New plant profile creation → redirect to `/vault/[id]`. All other adds (packet, sow, task, supply, journal, grow) = stay + refresh. | Roadmap "Locked decisions" header |

---

## Open decisions

Decisions still pending or recently made. Resolve or revisit as needed; don't let them sit implicit.

| # | Decision | Status | Notes |
|---|----------|--------|-------|
| 1 | **Framework upgrade posture** — stay on Next 14 LTS or schedule Next 14→16 + React 18→19 upgrade | Open | 11 remaining npm advisories blocked behind this (`npm audit fix --force`). Recommendation: stay on 14 LTS for now; revisit when forced (EOL, feature need, or new advisory). |
| 2 | **Next implementation focus** — (a) hub-coherence pass vs (b) import-flow polish | ✅ Resolved 2026-05-07 → **(b) import polish** | Import flows named as a real frustration; more bounded scope than hub coherence. |
| 3 | **Phase 4 `plant_count` qtyLabel on Plantings cards** — keep or drop? | Tentatively resolved → **keep** | Roadmap spec said drop; [FEEDBACK_AND_FEATURE_NOTES.md](FEEDBACK_AND_FEATURE_NOTES.md) hub principle says keep cards informative. Confirm explicitly when next touching the file so future audits don't re-flag it as a deviation. |

---

## Phase status (verified 2026-05-07)

| Phase | Status | Notes |
|-------|--------|-------|
| 0 — Universal Add audit | ✅ done | |
| 1 — Iconography | ✅ done | strokeWidth 1.2 in styleDictionary |
| 2 — AddPlantModal | ✅ done | |
| 3 — Profile polish | ✅ done | `// Phase 3 luxury polish` marker in [VaultProfileJournalTab.tsx](../src/app/vault/[id]/VaultProfileJournalTab.tsx) |
| 4 — Plants card + Journal tab | ✅ mostly done | Vertical timeline shipped; one minor deviation (plant_count qtyLabel still on cards — leave or remove per taste) |
| 5 — Action Center | ✅ done | Shared `QUICK_ACTIONS_GRID_CLASS`; `onJournalAdded → router.refresh()` wired |
| 6 — Quick-Log in FAB | ✅ done | `preSelectedProfileId` supported |
| 7 — Loading + cache (optional) | ✅ done | `cacheControl: "31536000"` on 30+ uploads; SW `CACHE_NAME='seed-vault-v4'` |
| 8 — Global UI audit | ⚠️ partial | See "Outstanding action items" below |
| 9 — Calendar & Shed refactor | ⚠️ partial | Local-date helper shipped; recurrence/delete semantics open |

---

## Authoritative plans (use these first)

| Document | Role |
|----------|------|
| [`docs/PRODUCT_AUDIT_2026-05-07.md`](PRODUCT_AUDIT_2026-05-07.md) | **Pattern-level synthesis** of live user feedback. 9 cross-cutting patterns + 10 workstreams + recommended sequencing. Read this when planning UX work bigger than a single fix. |
| [`docs/IMPORT_FLOW_AUDIT.md`](IMPORT_FLOW_AUDIT.md) | Friction audit of every import path with re-prioritized recommendations after 2026-05-07 user feedback. |
| [`docs/FEEDBACK_AND_FEATURE_NOTES.md`](FEEDBACK_AND_FEATURE_NOTES.md) | **Current product intent** — north-star principles for the plant profile (information hub, not a navigation menu). Read first when planning UX work. |
| [`docs/BUGS.md`](BUGS.md) | Concrete reproducible bugs, including user-reported items from 2026-05-07. |
| [`.cursor/plans/remaining_steps_roadmap.plan.md`](../.cursor/plans/remaining_steps_roadmap.plan.md) | Ordered UX backlog. Phases 0–7 done; 8 and 9 partial. |
| [`.cursor/plans/offline_write_sync.plan.md`](../.cursor/plans/offline_write_sync.plan.md) | Track A. Foundation shipped; ordered replay + failed-replay UX + manual test pass remain. |
| [`docs/IMPLEMENTATION_PLAN_AUDIT.md`](IMPLEMENTATION_PLAN_AUDIT.md) | Audit vs code as of 2026-03-15. Refresh when needed. |

**Navigation and product flows:** [`docs/NAVIGATION_MAP.md`](NAVIGATION_MAP.md) is the source of truth; do not change FAB/back behavior without updating it.

---

## Outstanding action items

### Phase 8 — Global UI/UX audit (partial)

| Item | Status |
|------|--------|
| Global Toast component + haptics | ✅ done — `useToast` hook, 92 usages |
| Skip removal in vault/import (hero only) | ✅ done |
| Top-left Back + centered titles on FAB sub-menus | ❓ unverified — visual check needed |
| Vault Select flicker fix | ❓ unverified — visual check needed |
| **supply_profiles vendor + price migration** | ❌ open — no migration adds these columns |
| **Shed 2-column Vendor/Price grid** | ❌ open — depends on migration |
| **Remove "(optional)" labels** | ❌ open — 105 occurrences across 19 files |
| **Add `active:scale-95` to buttons** | ❌ open — 0 occurrences |
| Primary green #064e3b sweep + button order audit | ❓ unverified — visual pass needed |

### Phase 9 — Calendar & Shed refactor (partial)

| Item | Status |
|------|--------|
| Local-date helper (no UTC off-by-one) | ✅ done — [src/lib/calendarDate.ts](../src/lib/calendarDate.ts) |
| supply_profiles size/size_uom migration | ✅ done — `20250325100000_supply_profiles_size.sql` |
| **Recurrence: Just this instance / Push schedule** | ❌ open |
| **Delete: Future vs All semantics (soft-delete + double confirm)** | ❌ open |
| Shed user-guided crop | ❓ unverified |
| Shed branded skeleton loader | ❓ unverified |

### Track A — Offline write sync (substantially shipped)

| Item | Status |
|------|--------|
| IndexedDB queue + Law 2 soft-delete normalization | ✅ done — [src/lib/offlineQueue.ts](../src/lib/offlineQueue.ts) |
| SyncContext + OfflineIndicator | ✅ done |
| Tier A flows migrated (Quick Log, journal, BatchLogSheet, etc.) | ✅ partially confirmed — 15+ files use offline helpers |
| **Ordered multi-step queue with dependency order** | ❓ unverified — needs deeper audit |
| **Failed-replay UX (no silent drops)** | ❓ unverified |
| **Manual airplane-mode test pass** | ❌ not done |
| Phase 2 read cache / "offline browse" | 🟡 deferred |

### Backlog spot checks

| Item | Status |
|------|--------|
| Edit button on Packets tab (next to Remove) | ❌ open — [VaultProfilePacketsTab.tsx](../src/app/vault/[id]/VaultProfilePacketsTab.tsx) has delete only |
| Edit option in Garden FAB single-select | ❓ unverified |
| Other earlier-notes items | ❓ unverified |

### Test gaps

| Item | Status |
|------|--------|
| Plant → Harvest E2E | ❌ open |
| `mergeProfiles` unit test | ❌ open |
| `fillBlanksCache` unit test | ❌ open |
| QuickAddSeed/AddPlantModal happy-path component tests | ❌ open |

### Outstanding audit items

| Item | Status |
|------|--------|
| #8 ESLint re-enabled in builds | ✅ done — `next.config.js:9` `ignoreDuringBuilds: false` |
| #10 Dual Gemini SDK cleanup | ✅ done — only `@google/genai` in package.json (commit `e15221f`) |
| Other items | See [docs/Outstanding_Audit_Notes.md](Outstanding_Audit_Notes.md) |

---

## Quick health check

| Check | Command / reference |
|-------|---------------------|
| Unit & integration tests | `npm run test:run` (329 passing as of 2026-05-07) |
| E2E suite | `npm run test:e2e` — 11 specs in `e2e/` |
| Build (with ESLint) | `npm run build` |
| Plan vs codebase | Re-run `docs/IMPLEMENTATION_PLAN_AUDIT.md` periodically |
| Laws (RLS, soft delete, qty_status, compression, etc.) | `.cursor/rules/laws-of-the-vault.mdc` |

When this file and the audit diverge, **prefer updating this file** for "what's next" and **update the audit** when you want a formal codebase verification pass.
