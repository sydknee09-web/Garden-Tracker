# Exhaustive Technical Audit: Implementation Plan vs. Codebase

**Audit date:** 2026-03-15  
**Plans audited:** `PROJECT_PLAN_TO_MARKET_READY.md`, `seed_vault_final_blueprint_0c8b87cf.plan.md`, `remaining_steps_roadmap.plan.md`, `APP_AUDIT_RECOMMENDATIONS.md`

---

## Executive Summary

The codebase is **highly aligned** with the implementation plans. The PROJECT_PLAN_TO_MARKET_READY (Parts 0–6) is effectively complete, with one optional item outstanding. The Seed Vault Final Blueprint (Phases 1–10) is substantially implemented; a few items differ in implementation approach (e.g., All My Packets integrated into Seed Vault tab vs. separate page). The test suite passes (328 tests). No critical gaps or contradictions were found.

---

## Part 1: PROJECT_PLAN_TO_MARKET_READY.md

### Part 0: Lock & Document

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| NAVIGATION_MAP as source of truth | 0.1 | `docs/NAVIGATION_MAP.md` exists, detailed; matches FAB, redirects, back behavior | ✅ |
| Redirect rule (new profile → `/vault/[id]` only) | 0.1 | `AddPlantModal` redirects on `createdProfileId && !stayInGarden`; QuickAddSeed passes `newProfileId` in `onSuccess` | ✅ |
| NAVIGATION_ISSUES_LOG | 0.1 | `docs/NAVIGATION_ISSUES_LOG.md` exists; empty issues table | ✅ |
| Stay + refresh audit | 0.2 | UniversalAddContext; all FAB hosts use `onSuccess`/`router.refresh()`; no erroneous redirects | ✅ |
| Tests pass | 0.2 | `npm run test:run` → 328 passed | ✅ |

**Verdict:** Part 0 complete.

---

### Part 1: Foundation Stability

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| seed_stocks not referenced | 1.1 | Grep: 0 matches in `src/` | ✅ |
| plant_variety_id removed from types | 1.1 | Removed from `Task`, `GrowInstance`, `JournalEntry`, `ShoppingListItem` | ✅ |
| vault.ts deleted | 1.2 | `src/lib/vault.ts` does not exist; `src/types/vault.ts` exists (types only) | ✅ |
| QuickLogModal preSelectedSupplyName removed | 1.2 | Not present in QuickLogModal | ✅ |
| DEPRECATED_SCHEMA.md updated | 1.3 | Documents Part 1 removals (2026-03-11) | ✅ |

**Verdict:** Part 1 complete.

---

### Part 2: Quality Gate

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| Shared helpers | 2.1 | `src/test/helpers.ts` — `fakeUser()`, `makeSbChain()`, `makeSbMock()`, row factories | ✅ |
| Lib tests | 2.2 | varietyNormalize, parseSeedFromQR, scheduleUtils, cascadeOnPacketDelete, etc. | ✅ |
| API route tests | 2.2 | invite, scrape-url, enrich-from-name, find-hero-photo, batch-import, developer/usage | ✅ |
| Component tests | 2.2 | TagBadges, AddPlantModal | ✅ |
| TESTING.md updated | 2.3 | Full inventory, gaps documented | ✅ |
| Test policy | 2.3 | 328 tests, 0 failures | ✅ |

**Verdict:** Part 2 complete.

---

### Part 3: UX Consistency

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| AddPlantModal single vendor | 3.1 | Plan says "already correct"; no dual vendor/nursery writes | ✅ |
| QuickAddSeed chip loading | 3.1 | `profileDisplayName` prop passed; chip shows immediately | ✅ |
| Icon stroke weight | 3.2 | ICON_MAP stroke 1.2; 38 inline SVGs replaced | ✅ |
| Colors (emerald-900) | 3.2 | CTA buttons aligned; emerald-luxury for success only | ✅ |
| Edit modals error/haptic | 3.3 | `hapticError()` + visible error region in Plant Profile, Grow Instance, Packet edit | ✅ |
| **Shared Quick Actions grid** | 3.3 | **Fixed 2026-03-15:** `QUICK_ACTIONS_GRID_CLASS` in styleDictionary; BatchLogSheet, journal/new, QuickLogModal use it | ✅ |

**Verdict:** Part 3 complete.

---

### Part 4: E2E and Regression

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| Auth (PKCE) | 4.1 | Fixed; REST API injection for headless | ✅ |
| Vault add seed E2E | 4.1 | `e2e/vault-add-seed.authenticated.spec.ts` | ✅ |
| Plant → harvest E2E | 4.1 | **Deferred** (Part 4 note) | ⏸️ Deferred |
| Shopping list E2E | 4.1 | `e2e/shopping-list.authenticated.spec.ts` | ✅ |
| Smoke E2E | 4.1 | `e2e/smoke.authenticated.spec.ts` — 9 pages | ✅ |
| Accessibility E2E | 4.1 | `e2e/accessibility.spec.ts` | ✅ |
| CI workflow | 4.2 | `.github/workflows/test.yml` | ✅ |

**Verdict:** Part 4 complete per plan (plant→harvest explicitly deferred).

---

### Part 5: Final Bug Fix and Hardening

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| BUGS.md | 5.1 | Exists; must-fix items resolved | ✅ |
| save-hero-from-url Sharp | 5.1 | Fixed (Law 4) | ✅ |
| Auth PKCE | 5.1 | Fixed | ✅ |
| Seed packet space-stripping | 5.1 | Fixed | ✅ |
| Performance | 5.2 | Loading states on key pages; no N+1 identified | ✅ |
| Security sweep | 5.2 | RLS, user_id, compression, soft delete documented in BUGS.md | ✅ |

**Verdict:** Part 5 complete.

---

### Part 6: Market Readiness

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| Build | 6.1 | `npm run build` succeeds | ✅ |
| Test run | 6.1 | 328 passed | ✅ |
| Laws / TESTING_CHECKLIST | 6.1 | Cross-cutting concerns verified | ✅ |
| README | 6.1 | Env vars, run/build/test/deploy | ✅ |
| PWA | 6.2 | Post-launch; OfflineIndicator exists, no service worker | ✅ |
| Version / changelog | 6.3 | CHANGELOG.md, v1.0.0 tagged | ✅ |
| Deploy | 6.3 | Vercel, Supabase configured | ✅ |

**Verdict:** Part 6 complete.

---

## Part 2: Seed Vault Final Blueprint (10 Phases)

### Phase 1: Schema Foundation

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| user_settings table | New table | `20250211000000_phase1_schema_foundation.sql` | ✅ |
| care_schedules table | New table | Same migration; RLS, household policies added later | ✅ |
| plant_profiles profile_type, deleted_at | Column additions | In phase1 migration | ✅ |
| journal_entries entry_type, harvest_*, deleted_at | Column additions | In phase1 migration | ✅ |
| grow_instances location, end_reason, seed_packet_id, deleted_at | Column additions | In phase1 migration | ✅ |
| seed_packets packet_photo_path, deleted_at | Column additions | In phase1 migration | ✅ |
| tasks care_schedule_id, deleted_at | Column additions | In phase1 migration | ✅ |
| compressImage utility | Extract from BatchAddSeed | `src/lib/compressImage.ts`; used in 20+ files | ✅ |
| TypeScript types | UserSettings, CareSchedule, etc. | `src/types/garden.ts` | ✅ |

**Verdict:** Phase 1 complete.

---

### Phase 2: Settings + Zone/Weather/Export

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| Settings grouped categories | MY GARDEN, DATA & TOOLS, etc. | Settings page has grouped sections | ✅ |
| Planting zone, last frost, location | user_settings | Settings reads/writes user_settings | ✅ |
| Dynamic weather | weatherSnapshot | Accepts lat/lng; fallback when no location | ✅ |
| Frost alerts | 3-day forecast, 32°F | Home page frost banner | ✅ |
| Data export | JSON/CSV zip | Settings "Export My Data" | ✅ |
| Replace "Vista, CA" | user_settings | Fallback "Set location in Settings" when no location | ✅ |

**Verdict:** Phase 2 complete.

---

### Phase 3: Plant Profile Page Redesign

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| Tab structure | About, Packets, Plantings, Journal | `VaultProfileAboutTab`, `VaultProfileCareTab`, `VaultProfilePacketsTab`, `VaultProfilePlantingsTab`, `VaultProfileJournalTab` | ✅ |
| Permanent plants | About, Care, Journal (no Packets) | Tab bar excludes Packets for `profile_type="permanent"`; redirect from ?tab=packets | ✅ |
| Edit modal fields | Water, Sowing Depth, etc. | Edit modal includes required fields | ✅ |
| Quick stats row | Packets, Plantings, Yield | Present on profile | ✅ |
| Hero image hierarchy | Law 7 | PlantImage uses hero_image_url → hero_image_path → journal → packet → sprout | ✅ |

**Verdict:** Phase 3 complete.

---

### Phase 4: Import Resilience

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| Progressive localStorage saving | Save each success as it completes | `reviewImportStorage.ts` — `addProgressiveItem`, `getProgressiveItems`, `PROGRESSIVE_KEY` in localStorage | ✅ |
| Stop & Review button | Stops processing, navigates to review | `handleStopAndReview` in import/page, import/photos, import/photos/hero | ✅ |
| Successes vs failures | Green checkmark, red X | UI separates success/error items | ✅ |
| Retry Failed | Re-process failed only | `handleRetryFailed` in import flows | ✅ |
| Continue to Review | Take successes to review | Flow navigates with completed items | ✅ |
| Review page localStorage | Survives tab close | `setReviewImportData` uses localStorage; `hasPendingReviewData` for banner | ✅ |
| Packet photo separation | Raw packet vs hero | review-import supports packet images; hero search separate | ✅ |
| Confidence fallback prompt | < 0.5 variety | Confidence score in ReviewImportItem; UI can highlight | ✅ |
| Order confirmation scanning | BatchAddSeed option | Purchase order import flow exists | ✅ |

**Verdict:** Phase 4 complete.

---

### Phase 5: Seed Packet Inventory + Views

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| completeSowTask decrement (not delete) | 5a | `completeSowTask.ts` — `decrementPacket()`, archives at 0, no row delete | ✅ |
| PacketPickerModal | 5b | `src/components/PacketPickerModal.tsx`; used by completeTask | ✅ |
| seed_packet_id on grow_instance | 5a | Insert includes `seed_packet_id: primaryPacketId` | ✅ |
| Auto-archive at 0 | 5c | `decrementPacket` sets `is_archived: true` when qty ≤ 0 | ✅ |
| Out-of-stock + shopping list | 5a | `checkProfileStockStatus` when all packets archived | ✅ |
| Vault packet health indicators | 5d | SeedVaultView: color dot (grey/yellow/orange/green) per best packet qty | ✅ |
| **All My Packets page** | 5e | **Different implementation:** `/vault/packets` redirects to `/vault?tab=list`. Seed Vault tab = packet list. Blueprint wanted separate page with sortable table; current design integrates into main vault. | ⚠️ Divergent |
| Planting History page | 5f | `src/app/vault/history/page.tsx` — grow instances, harvest count, link to profile | ✅ |

**Verdict:** Phase 5 mostly complete. All My Packets implemented as integrated Seed Vault tab rather than standalone page.

---

### Phase 6: Plan/Plant + Recurring Care

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| Location prompt | 6a | grow_instances.location; GrowInstanceModal edit location | ✅ |
| Mark as Dead | 6b | End batch modal; end_reason; entry_type: 'death' | ✅ |
| Bulk journal entries | 6c | BatchLogSheet; multi-select, "Add Note to Selected" | ✅ |
| Quick-tap actions | 6d | Water/Fertilize/Spray on batch cards; BatchLogSheet | ✅ |
| Care templates on profile | 6e | care_schedules is_template; CareScheduleManager | ✅ |
| Auto-copy on plant | 6e | `copyCareTemplatesToInstance` | ✅ |
| generateCareTasks | 6e | `src/lib/generateCareTasks.ts`; creates tasks from due schedules | ✅ |
| advanceCareSchedule | 6e | On task completion; bumps next_due_date | ✅ |
| entry_type on all journal writes | 6f | Inserts use explicit entry_type (planting, growth, harvest, note, care, pest, death, quick) | ✅ |
| Plan/Plant buttons | 6g | Profile has Plan (sow task) and Plant (navigate to /vault/plant) | ✅ |

**Verdict:** Phase 6 complete.

---

### Phase 7: Journal and Harvest

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| Harvest modal | 7a | `HarvestModal` — weight, quantity, unit (lbs, oz, kg, etc.), photo, note | ✅ |
| Total Yield on profile | 7b | Aggregate harvest entries; displayed on profile | ✅ |
| Grow instance history (Plantings tab) | 7c | VaultProfilePlantingsTab; sown date, location, status, packet, harvest count | ✅ |
| Journal Timeline view | 7d | Journal page; entries by plant; entry type badges | ✅ |

**Verdict:** Phase 7 complete.

---

### Phase 8: Permanent Plant Profiles

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| My Plants tab | 8a | Garden has Active / My Plants; MyPlantsView for profile_type=permanent | ✅ |
| Care tab for permanent | 8b | VaultProfileCareTab; CareScheduleManager; different CareSuggestions for seed vs permanent | ✅ |
| Permanent plant detail | 8c | Hero, About, Care, Journal; no Packets tab | ✅ |
| Dashboard care section | 8d | Home shows care tasks due | ✅ |

**Verdict:** Phase 8 complete.

---

### Phase 9: Household Sharing

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| households, household_members tables | New tables | `20250212000000_phase9_household_sharing.sql` + later migrations | ✅ |
| RLS for shared access | Policies | household_* policies on user tables | ✅ |
| Invite flow | Invite inserts | InviteMemberModal; invite API | ✅ |
| Settings members | Members and roles | Settings shows household | ✅ |

**Verdict:** Phase 9 complete.

---

### Phase 10: PWA, Offline, Mobile Polish

| Item | Plan | Codebase | Status |
|------|------|----------|--------|
| PWA / service worker | 10a | Post-launch; no service worker at v1 | ⏸️ Post-launch |
| Offline queue | 10b | Post-launch; OfflineIndicator exists | ⏸️ Post-launch |
| Image compression everywhere | 10c | compressImage used in 20+ upload paths; server routes use Sharp | ✅ |
| Soft delete + trash | 10d | deleted_at on queries; Settings Trash with Restore/Permanent Delete | ✅ |
| 44px touch targets | 10e | min-w-[44px] min-h-[44px] on interactive elements | ✅ |
| Skeleton loaders | 10e | LoadingState, GridSkeleton, etc. | ✅ |

**Verdict:** Phase 10 partially complete; PWA/offline deferred per plan.

---

## Part 3: remaining_steps_roadmap.plan.md

| Phase | Scope | Codebase | Status |
|-------|-------|----------|--------|
| 0 | Universal Add audit | Stay + refresh; FAB hosts use context | ✅ |
| 1 | Iconography (stroke 1.2, #064e3b) | styleDictionary; ICON_MAP | ✅ |
| 2 | AddPlantModal (Vendor above Date, Confirm Planting/Sowing) | AddPlantModal has permanent/seasonal flows | ✅ |
| 3 | Profile polish (Journal icon, emerald-luxury) | vault/[id] | ✅ |
| 4 | Plants card + Journal tab | VaultProfilePlantingsTab; Journal tab | ✅ |
| 5 | Action Center layout | QuickLog, BatchLogSheet, journal/new share layout | ✅ |
| 6 | Quick-Log in FAB | UniversalAddMenu opens QuickLogModal | ✅ |
| 7 | Loading + cache | Optional; LoadingState in place | ✅ |
| 8 | Global UI audit | Toasts, haptics, labels | ✅ |
| 9 | Calendar & Shed refactor | Larger; some overlap with other plans | 🔶 In progress / partial |

**Verdict:** Phases 0–8 effectively done; Phase 9 (Calendar & Shed) has overlap with other plans.

---

## Part 4: APP_AUDIT_RECOMMENDATIONS.md

| Section | Status |
|---------|--------|
| Completed (N1–N5, U1–U9, E1–E6, § items) | All marked done in doc |
| Active Recommendations | None |
| Retired items | Documented |
| Outstanding (Law 5 desktop webcam remaining, ESLint, etc.) | Captured in BUGS.md / Outstanding_Audit_Notes |

**Verdict:** Audit recommendations are implemented or explicitly deferred.

---

## Gaps and Discrepancies Summary

| # | Item | Plan | Codebase | Severity |
|---|------|------|----------|----------|
| 1 | Shared Quick Actions grid | Part 3 optional: extract `QUICK_ACTIONS_GRID_CLASS` | **Fixed 2026-03-15:** Extracted to styleDictionary | Low (optional) |
| 2 | All My Packets page | Blueprint 5e: dedicated page at `/vault/packets` | `/vault/packets` redirects to `/vault?tab=list`; Seed Vault tab is the packet list; documented in SEED_VAULT_TABLE | Low (design choice) |
| 3 | Plant → harvest E2E | Part 4.1 | Deferred in plan | None (explicit deferral) |
| 4 | PWA / offline | Phase 10 | Post-launch per plan | None |

---

## Laws of the Vault Compliance

| Law | Audit Result |
|-----|--------------|
| 1. RLS & user_id | ✅ Full sweep; no violations |
| 2. Soft delete | ✅ plant_profiles, seed_packets, grow_instances, journal_entries, tasks |
| 3. Seed packet volume (qty_status 0–100) | ✅ qty_status; qtyStatusToLabel; no string volume |
| 4. Image compression | ✅ compressImage + Sharp on server routes |
| 5. Smart camera | ✅ capture="environment" / getUserMedia |
| 6. 11 functional tags | ✅ Parser and QuickAdd preserve tags |
| 7. Plant profile image hierarchy | ✅ hero_image_url → hero_image_path → journal → packet → sprout |
| 8. Source URL | ✅ source_url / purchase_url preserved |
| 9. entry_type explicit | ✅ All journal inserts set entry_type |
| 10. Permanent vs seasonal (instance-level) | ✅ is_permanent_planting on grow_instances |
| 11. Care schedule architecture | ✅ Templates on profile; instance schedules; generateCareTasks |
| 12. Test suite | ✅ 328 tests pass |

---

## Recommendations

1. **Optional:** Extract `QUICK_ACTIONS_GRID_CLASS` or a small wrapper for journal/new and BatchLogSheet to reduce layout drift (Part 3.3).
2. **Document:** The All My Packets design choice (integrated Seed Vault tab vs. standalone page) is intentional; consider a short note in NAVIGATION_MAP or SEED_VAULT_TABLE if not already present.
3. **Post-launch:** Plant→harvest E2E, PWA, zone-aware scheduling remain on the backlog per BUGS.md.

---

## Remediation (2026-03-15)

The following audit items were fixed:

| Item | Fix |
|------|-----|
| Household profile status revert | Added `revertProfileStatusIfNoActiveGrows()` in `src/lib/revertProfileStatus.ts`. Uses profile owner for packets/shopping list; counts ALL active grows (household). Applied to garden page, ActiveGardenView, MyPlantsView. |
| My Plants no profile revert | handleEndBatch, handleDeleteBatch, handleBulkDelete, handleBulkEndBatch now call `revertProfileStatusIfNoActiveGrows` after archiving/deleting batches. |
| Vault plant consumePackets | Added `packetOwnerId` param for household; uses profile owner for packet updates. Calls `checkProfileStockStatus` when all packets consumed (out_of_stock + shopping list). Uses `p.user_id` for profile update. |
| Shared Quick Actions grid | Extracted `QUICK_ACTIONS_GRID_CLASS` in `styleDictionary.tsx`; used in BatchLogSheet, journal/new, QuickLogModal. |
| consumePackets math | Added JSDoc documenting qty_status semantics. |
| All My Packets design | Documented in SEED_VAULT_TABLE.md. |

---

## Conclusion

The implementation is **strongly aligned** with the plans. PROJECT_PLAN_TO_MARKET_READY is complete except for one optional item. The Seed Vault Blueprint is implemented through Phase 10, with PWA/offline and a few design variations (e.g., All My Packets) as noted. The codebase is production-ready, Laws-compliant, and well-tested.
