# Project Plan: From Current State to Market-Ready Product

**Purpose:** Single roadmap from where the app is today to a fully market-ready product. Designed to avoid "one step forward, ten steps back" and to stop churning core processes. Execute in order; do not skip parts.

**Status:** Plan only. No code changes until you explicitly start a part.

---

## Guiding Principles

| Principle | Meaning |
|-----------|--------|
| **Lock core first** | Freeze navigation, FAB behavior, add flows, and redirect rules. Document them. Do not change them again except for critical bugs. |
| **Stabilize before polish** | Clean schema and legacy code before adding UX polish. Polish on a moving foundation causes rework. |
| **Test gate** | Every part ends with a passing test run. No part is "done" until `npm run test:run` passes and, where specified, E2E/smoke passes. |
| **One-way doors** | Decisions that affect many files (e.g. "only redirect when new profile is created") are documented and treated as final. Reversing them is a new project. |
| **No flow changes in polish** | UX consistency work (icons, labels, error messages) does not add new screens, redirects, or change what happens on submit. |

**Cursor model:** For plan-driven or multi-file work, use a more capable model (e.g. Sonnet); for single-file or docs-only work, Auto or a faster model is fine. See `.cursor/rules/model-selection.mdc`.

---

## Current State Summary

**Working:** Vault (Plant Profiles + Seed Vault tabs), Shed, Garden (Active + My Plants), Journal, Calendar, Shopping List, Settings. Universal Add Menu, QuickAddSeed, QuickAddSupply, AddPlantModal, Quick Log modal, BatchLogSheet. Link/photo import, review-import, hero search, global cache. Care schedules (templates + instance), generateCareTasks, completeSowTask with qty_status. Soft delete, RLS, Laws 1–12 in force. Loading states, filter defaults, packet selection.

**Plans in play:** remaining_steps_roadmap (Phase 0–9), full_luxury_polish, loading_screen_ux_fixes, global_ui_ux_audit, calendar_shed_fab_refactor, add_plant_and_seed_packet_flows, others in `.cursor/plans/`.

**Known debt:** seed_stocks table deprecated (use qty_status only); legacy vault.ts seed_stocks code; plant_variety_id in types (column dropped); AddPlantModal dual vendor/nursery; icon stroke inconsistency; QuickAddSeed chip empty until profiles load; zone-aware scheduling TODO; some plan overlap (e.g. loading screen vs plant placeholder).

---

## Part 0: Lock & Document (No New Core Process Changes)

**Goal:** Treat current core flows as final. Document them. Fix only clear bugs (e.g. missing refresh); do not add new redirects or change what each FAB option does.

### 0.1 Freeze and document navigation

- [ ] **NAVIGATION_MAP.md** is the single source of truth. Confirm it matches current behavior for: Universal Add options, Add plant (Manual / Start Seeds), Add to shed (stay-in-place), Back from QuickAddSupply, Vault tabs, Garden selection mode, Journal entry cards, Calendar FAB, Shopping List access, filter reset on section change.
- [ ] **Redirect rule (locked):** The only intentional redirect after an add is: user creates a **new plant profile** (new variety) → redirect to `/vault/[id]`. All other adds (packet to existing, sow, supply, task, journal, grow on existing profile) = **stay on page + refresh**. Document this in NAVIGATION_MAP and in this plan. No new redirects without explicit approval.
- [ ] **NAVIGATION_ISSUES_LOG.md:** Ensure it exists; use it to log any nav bugs found during testing. When a bug is fixed, move to change log and update NAVIGATION_MAP if needed.

### 0.2 Stay + refresh audit

- [ ] For each FAB host (Home, Vault, Garden, Journal, Calendar), verify: Add Seed Packet → parent refetches and stays; Add plant (Manual / Start Seeds) → parent refreshes and stays; Add to shed → parent refreshes Shed and stays; Add task → calendar refetches and stays; Add journal → parent refreshes and stays. Fix only missing refresh or erroneous redirects; no new behavior.
- [ ] Run `npm run test:run`. Document any failing tests and fix before leaving Part 0.

**Exit criteria:** NAVIGATION_MAP and redirect rule are documented and match code. All FAB add paths stay + refresh except new-profile → `/vault/[id]`. Tests pass.

---

## Part 1: Foundation Stability (Schema & Legacy Cleanup)

**Goal:** Remove deprecated schema and legacy code so future work does not depend on dead paths. No new features.

### 1.1 Schema

- [x] **seed_stocks:** Confirmed no application code reads or writes `seed_stocks`. DB table still exists in Supabase but is never referenced by the app. Can be dropped via a future migration when ready.
- [x] **Types:** Removed `plant_variety_id` from `Task`, `GrowInstance`, `JournalEntry`, and `ShoppingListItem` in `src/types/garden.ts`. Removed `SeedStockRow` and `SeedStockDisplay` from `src/types/vault.ts`.

### 1.2 Legacy code

- [x] **vault.ts / vault types:** Deleted `src/lib/vault.ts` (`normalizeSeedStockRow`, `normalizeSeedStockRows`, `SeedStockRowRaw`) and `src/lib/vault.test.ts`. Deleted `src/app/calendar/page_prev.tsx`. Updated `SeedVaultView.tsx` comment. All consumers already use `seed_packets` and `qty_status` only.
- [ ] **QuickLogModal:** Remove or update the `@deprecated` JSDoc about supply name in notes (line 44).

### 1.3 Docs

- [x] **DEPRECATED_SCHEMA.md:** Updated to record Part 1 removals (2026-03-11) and DB table status.

**Exit criteria:** No references to seed_stocks in app code. Types match DB. Tests pass. Migration applied in target environment.

---

## Part 2: Quality Gate (Testing Foundation)

**Goal:** So that polish and bug fixes don’t regress, add test infrastructure and critical-path tests first.

### 2.1 Test infrastructure

- [x] **Shared helpers:** Added `src/test/helpers.ts` with `fakeUser()`, `makeSbChain()`, `makeSbMock()`, and row factories for `plant_profile`, `seed_packet`, `grow_instance`.
- [x] **Coverage:** Thresholds raised to `lines: 5, functions: 15, branches: 50` in `vitest.config.mts`. Start conservative; raise as tests are added.

### 2.2 Unit tests (high value, low effort)

- [x] **Lib:** Added tests for `varietyNormalize` (stripVarietySuffixes, stripPlantFromVariety, cleanVarietyForDisplay), `parseSeedFromQR`, `scheduleUtils` (getGuideHarvestDays, isGuideCropStartIndoors), `cascadeOnPacketDelete`. `fillBlanksCache`, `plantingWindow`, `mergeProfiles` noted in TESTING.md Gaps for next pass.
- [x] **API routes:** Added tests for: `invite`, `scrape-url`, `enrich-from-name`, `find-hero-photo`. batch-import, developer/usage, save-hero-to-cache already covered.
- [x] **Components:** Added `TagBadges.test.tsx` (getTagStyle + rendering). `QuickAddSeed`/`AddPlantModal` happy-path submission noted in Gaps.

### 2.3 Test discipline

- [x] **TESTING.md:** Updated "Current tests" with full inventory (shared helpers, lib, API routes, components, E2E). Updated "Gaps" to reflect remaining items.
- [x] **Policy:** `npm run test:run` passes — 36 test files, 307 tests, 0 failures.

**Exit criteria:** Shared test helpers exist. Critical lib/API/component tests added. Coverage threshold set and passing. TESTING.md updated.

---

## Part 3: UX Consistency (No Flow Changes)

**Goal:** Fix inconsistencies from the Technical Audit and iconography. Do not add new flows, screens, or redirects.

### 3.1 Data and labels

- [ ] **AddPlantModal:** For new plant_profiles inserts, set only `purchase_vendor` from the "Vendor / Nursery" field. Stop setting `purchase_nursery` so the UI matches the one-column rule.
- [ ] **QuickAddSeed:** When opened with `preSelectedProfileId`, show variety in the chip immediately: either pass `profileDisplayName` from parent for the chip until `preSelectedProfile` loads, or show a short loading state in the chip area.

### 3.2 Icons and visuals

- [ ] **Stroke weight:** Consolidate to styleDictionary/ICON_MAP (stroke 1.2 per remaining_steps_roadmap). Replace inline SVGs (close, edit, trash, chevrons) that use stroke 2 or 2.5 with ICON_MAP equivalents. Do not change behavior or layout.
- [ ] **Colors:** Align with locked decisions: primary #064e3b; emerald-luxury (#50C878) for success states only. No new UI logic.

### 3.3 Error and feedback

- [ ] **Edit modals:** Ensure each Edit flow (Plant Profile, Grow Instance, Packet) has one visible error region above the primary button and shows save failure inside the modal. Add `hapticError()` on save failure in all three; keep `hapticSuccess()` on success.
- [ ] **Shared Quick Actions grid:** Extract `QUICK_ACTIONS_GRID_CLASS` or a small wrapper from journal/new and BatchLogSheet so the grid layout lives in one place. Optional but reduces drift.

**Exit criteria:** Single vendor field, chip loading fixed, icons consistent, error/haptic consistent. No new flows or redirects. Tests pass.

---

## Part 4: E2E and Regression

**Goal:** Critical user paths are covered by E2E so future changes can be validated without manual-only testing.

### 4.1 E2E critical paths

- [ ] **Auth:** Login, signup, reset-password (existing). Keep and maintain.
- [ ] **Vault → add seed:** Open vault, FAB → Add Seed Packet, complete manual add (or link) with required fields, assert new profile or packet appears and URL does not change (stay + refresh).
- [ ] **Plant → harvest:** From vault profile, Plant, complete sow flow; from Active Garden, open Harvest, submit with weight/unit; assert harvest appears on profile or journal.
- [ ] **Shopping list:** Add plant to shopping list from profile; open shopping list page; assert item present. Remove item; assert removed.
- [ ] **Smoke (authenticated):** Existing smoke (vault, garden, calendar, etc.) — ensure it still passes and extend if key pages are missing.
- [ ] **Accessibility:** Existing axe E2E — keep and run in CI. Fix any new violations introduced in Parts 1–3.

### 4.2 CI and local

- [ ] **CI:** E2E runs on push/PR (or on release branch). Use `E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` for authenticated smoke if available.
- [ ] **Local:** Document in TESTING.md that `npm run test:all` (or unit + E2E) is the pre-release suite. Run before tagging a release.

**Exit criteria:** E2E covers vault add seed, plant→harvest, shopping list, smoke, a11y. CI runs E2E. Tests pass.

---

## Part 5: Final Bug Fix and Hardening

**Goal:** Address known issues, then a single pass for performance and security. No new features.

### 5.1 Known issues

- [ ] **List:** From TECHNICAL_AUDIT, RECOMMENDATIONS_MASTER, and NAVIGATION_ISSUES_LOG, maintain a single "Known issues" list (in this doc or a linked BUGS.md). Include: zone-aware scheduling not using planting_zone; ActiveGardenView scroll-to-batch when `?grow=`; My Plants `?profile=` filter from vault; any open nav issues.
- [ ] **Fix:** Triage: must-fix before release vs. post-launch. Fix must-fix items. For each fix, add or extend a test, then run full suite.

### 5.2 Hardening

- [ ] **Performance:** Spot-check slow pages (vault grid with many profiles, journal with many entries, calendar with many tasks). Add loading states where missing; fix obvious N+1 or over-fetching if found. No broad refactor.
- [ ] **Security:** Confirm RLS and user_id on all inserts/updates/deletes (Law 1). Confirm no secrets in client code. Confirm image upload paths use compression (Law 4). Document in a short "Pre-release security checklist" if not already in TESTING_CHECKLIST.

**Exit criteria:** Known issues list exists and must-fix items are done. Performance and security checklists run. Tests pass.

---

## Part 6: Market Readiness

**Goal:** Release-ready artifact, store/launch prep, and clear definition of "shipped."

### 6.1 Release checklist

- [ ] **Build and test:** `npm run build` and `npm run test:run` and `npm run test:e2e` (or `test:all`) pass.
- [ ] **Laws and TESTING_CHECKLIST:** Run through the Cross-Cutting Concerns and Smoke Test Workflow in TESTING_CHECKLIST.md. Mark any items that are out of scope for v1; fix the rest.
- [ ] **Docs:** README or docs describe how to run, build, test, and deploy. Environment variables documented. NAVIGATION_MAP and TESTING.md are up to date.

### 6.2 PWA / offline (if in scope)

- [ ] If PWA/offline is required for v1: manifest, service worker, offline indicator, and image compression on all upload paths (Law 4). If not in scope, document as "Post-launch" and skip.

### 6.3 Launch prep

- [ ] **Version and changelog:** Tag version (e.g. v1.0.0). Changelog or release notes listing major features and known limitations.
- [ ] **Store / distribution:** If app is distributed via a store or specific URL, list steps (e.g. build for production, env for production, deploy URL). No code change in this plan — only documentation.

**Exit criteria:** Full test suite and build pass. Release checklist and security checklist done. Version tagged. Launch steps documented.

---

## Definition of Done (Every Part)

- All checkboxes in that part are done or explicitly deferred with a note.
- `npm run test:run` passes (and, where specified, E2E/CI passes).
- No new failing tests introduced.
- NAVIGATION_MAP and redirect rule are unchanged unless the part explicitly allows a change (Part 0 documents; later parts do not change core flows).

---

## Appendix A: Recommendation → Part Mapping

| Recommendation | Part |
|----------------|------|
| Follow remaining_steps_roadmap in order | After Part 4; luxury polish (icons, Action Center, etc.) can run in parallel with or after Part 3, respecting "no flow changes." |
| Resolve plan overlap (loading screen vs plant placeholder) | Part 5 or 6; document decision. |
| Import parity (link = source of truth) | Locked in Part 0 as a one-way door; apply when touching import code. |
| Drop seed_stocks, remove legacy vault code, plant_variety_id cleanup | Part 1 |
| AddPlantModal single vendor, QuickAddSeed chip, icon stroke, error/haptic | Part 3 |
| Zone-aware scheduling, VaultPageContent refactor, scroll-to-batch, My Plants ?profile= | Part 5 (known issues / hardening) or post-launch. |
| Shared Quick Actions grid | Part 3 |
| Unit tests for lib/API/components, shared helpers, coverage | Part 2 |
| E2E vault add seed, plant→harvest, shopping list, smoke, a11y | Part 4 |
| NAVIGATION_MAP sync, NAVIGATION_ISSUES_LOG, TESTING.md gaps | Part 0, 2, 6 |
| Mobile keyboard in drawers, overflow audit | Part 5 optional or post-launch |
| Companion planting, pre-seed library | Post-launch or optional |
| Add plant vs add packet flows, packet selection/edit, Calendar/Shed refactor | Only if they do not change core redirect/nav; otherwise post-launch. |

---

## Appendix B: References

- **Navigation and flows:** `docs/NAVIGATION_MAP.md`, `docs/NAVIGATION_ISSUES_LOG.md`
- **Laws and schema:** `.cursor/rules/laws-of-the-vault.mdc`, `.cursor/rules/schema-reference.mdc`, `docs/DEPRECATED_SCHEMA.md`
- **Testing:** `TESTING.md`, `docs/TESTING_CHECKLIST.md`, `docs/TDD_GUIDE.md`
- **Audit:** `docs/TECHNICAL_AUDIT_ACTION_CENTER_AND_EDIT.md`
- **Plans:** `.cursor/plans/remaining_steps_roadmap.plan.md`, `.cursor/plans/full_luxury_polish.plan.md`, and others in `.cursor/plans/`
- **Recommendations:** `docs/RECOMMENDATIONS_MASTER.md` (if created)

---

## Summary Table

| Part | Name | Goal |
|------|------|------|
| 0 | Lock & Document | Freeze core flows; document; stay+refresh audit |
| 1 | Foundation Stability | Drop seed_stocks; remove legacy code; fix types |
| 2 | Quality Gate | Test helpers; critical unit/API/component tests; coverage |
| 3 | UX Consistency | Vendor field, chip, icons, error/haptic; no flow changes |
| 4 | E2E & Regression | Critical path E2E; smoke; a11y; CI |
| 5 | Final Bug Fix & Hardening | Known issues; performance; security |
| 6 | Market Readiness | Release checklist; PWA if needed; version; launch docs |

Execute in order. Do not start Part N+1 until Part N meets its exit criteria. After Part 6, the app is in a market-ready state for v1; further polish (e.g. remaining_steps Phases 1–9) can be scheduled as v1.1+ without changing core processes.
