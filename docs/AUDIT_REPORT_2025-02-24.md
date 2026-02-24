# Garden Tracker — Full Audit Report (Updated)

**Date:** February 24, 2025 (updated post–legacy cleanup)  
**Scope:** Software engineering review + user experience review  
**Status:** 201 tests passing

---

## Executive Summary

The codebase is in good shape after the legacy `plant_variety_id` cleanup. Migration `20250205800000` has been applied; all critical paths use `plant_profile_id` only. Laws of the Vault are followed, tests pass, and the app is aligned with the current schema. Remaining legacy references are limited to types, tests, and admin tools.

---

## 1. Software Engineering Audit

### 1.1 Laws of the Vault Compliance

| Law | Status | Notes |
|-----|--------|------|
| **1. RLS & User ID** | ✅ Compliant | Inserts/upserts include `user_id` where required. Shared caches omit user_id correctly. |
| **2. Soft Delete** | ✅ Compliant | plant_profiles, seed_packets, journal_entries, grow_instances, tasks use `deleted_at`. |
| **3. Seed Packet Volume** | ✅ Compliant | qty_status decremented; packets archived when 0; profile status + shopping_list updated. |
| **4. Image Compression** | ✅ Compliant | All upload paths use `compressImage()` before Supabase Storage. |
| **5. Smart Camera** | ✅ Compliant | `isMobileDevice()` → native camera vs getUserMedia. `capture="environment"` on file inputs. |
| **6. 11 Functional Tags** | ✅ Present | parseVarietyWithModifiers + getTagsFromText in parser/QuickAdd. |
| **7. Plant Profile Image Hierarchy** | ✅ Documented | hero_image_url → hero_image_path → journal → packet → emoji. |
| **8. Source URL Preservation** | ✅ Compliant | source_url / purchase_url saved on import. |
| **9. Entry Types Explicit** | ✅ Compliant | All journal inserts set `entry_type`. |
| **10. Profile Type Distinction** | ✅ Compliant | seed vs permanent drives tab structure. |
| **11. Care Schedule Architecture** | ✅ Compliant | Templates on profiles, instance schedules on grows. |
| **12. Test Suite** | ✅ Passing | 201 tests; run before commit per policy. |

### 1.2 Schema State (Post–Legacy Cleanup)

**Migration `20250205800000` applied.** `plant_variety_id` has been dropped from:
- tasks
- shopping_list
- grow_instances
- journal_entries

**Current model:** `plant_profiles` + `seed_packets` are the source of truth. All links use `plant_profile_id`.

**Remaining legacy references (safe):**

| Location | Purpose | Risk |
|----------|---------|------|
| `vault.ts` + `vault.test.ts` | `normalizeSeedStockRows` for legacy seed_stocks shape | None – used only in tests; SeedVaultView no longer uses it |
| `types/garden.ts`, `types/vault.ts` | Optional `plant_variety_id` in types | None – backward compat only |
| `shed/[id]/page.tsx` | `plant_variety_id: null` in optimistic JournalEntry | None – local object only, not sent to DB |
| `admin/scraper-audit` | Queries `plant_varieties` | Low – table may still exist; admin-only |
| `calendar/page_prev.tsx` | Backup file with old code | None – not in active use |
| `vault/[id]/page.tsx` | `isLeg` check for edit/delete | None – legacy load removed, so `isLeg` never true |

### 1.3 Insert / Upsert Audit (user_id)

- **plant_profiles, seed_packets, journal_entries, tasks, grow_instances, shopping_list:** All include `user_id`.
- **care_schedules:** Include `user_id` in copyCareTemplatesToInstance.
- **global_plant_cache, plant_extract_cache:** Correctly omit user_id (shared cache).

No violations found.

### 1.4 Offline Support

- `supabaseWithOffline.ts` queues failed writes to IndexedDB.
- `OfflineIndicator` replays on reconnect.
- Components use `updateWithOfflineQueue` for soft deletes.

### 1.5 Dependencies

- Next.js 16, React 19
- Supabase, Tailwind, Vitest, Testing Library
- No obvious security or compatibility issues.

---

## 2. User Experience Audit

### 2.1 Navigation & Flows

- **NAVIGATION_MAP.md** documents FAB behavior, tab structure, back/cancel/save redirects.
- Filter reset on section change; profile/grow params persist when navigating vault → garden.

### 2.2 Mobile-First & Touch Targets

- Laws require `min-w-[44px] min-h-[44px]` for interactive elements.
- Modals use `max-h-[85vh]` with internal scroll.
- Bottom nav 80px; content should not be obscured.

### 2.3 Error Handling

- `error.tsx` and `global-error.tsx` provide generic error boundaries.
- API routes return structured errors.

### 2.4 Loading & Empty States

- Loading skeletons/spinners on key pages.
- EmptyState component used where appropriate.

### 2.5 Chat & Shopping List

- Chat at `/chat` is a placeholder.
- Shopping list is functional and linked from dashboard.

---

## 3. Recommendations

### Completed Since Last Audit

- [x] Legacy `plant_variety_id` cleanup (completeSowTask, generateCareTasks, cascadeOnProfileDelete, SeedVaultView, calendar, page, journal, vault)
- [x] Schema aligned with migration 20250205800000

### Medium Priority

1. **API route tests** – Add request/response tests for critical routes with mocked Supabase.
2. **Coverage thresholds** – Add `coverage.lines: 80` in vitest.config.mts to fail CI when coverage drops.
3. **Shared test helpers** – Add `src/test/helpers.ts` or `mocks/` for Supabase, user, and fake DB rows.

### Lower Priority

4. **E2E tests** – Playwright/Cypress for critical flows (login → vault → add seed → plant).
5. **Accessibility audit** – Run axe or similar on key pages.
6. **Remove or update `calendar/page_prev.tsx`** – Backup file still references `plant_variety_id`; consider deleting or updating.
7. **Admin scraper-audit** – If `plant_varieties` table is dropped, update or remove this page.

---

## 4. Summary Table

| Area | Status | Notes |
|------|--------|-------|
| Laws compliance | ✅ | All 12 laws followed |
| user_id in writes | ✅ | No omissions found |
| Soft delete | ✅ | Correct usage |
| Image compression | ✅ | All uploads compressed |
| Smart camera | ✅ | Mobile/desktop handled |
| Legacy schema | ✅ | Cleanup complete; plant_profile_id only |
| Tests | ✅ | 201 passing |
| Navigation docs | ✅ | Up to date |
| Error handling | ✅ | Boundaries and messages present |
| Offline support | ✅ | Queue + replay |

---

*Report updated after legacy plant_variety_id cleanup. Re-run after schema or flow changes.*
