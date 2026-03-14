# Outstanding Audit Notes

Items from the March 2026 app audit that were **not** fixed in the initial batch. Refer back to these when planning future work.

---

## #1 — Perenual update missing `user_id` scope (Law 1) ✅ Fixed

**File:** `src/app/vault/import/page.tsx` (lines ~348–355)

**Bug:** The Perenual enrich update on `plant_profiles` uses only `.eq("id", profileId)` and does not scope by `user_id`. This violates Law 1 (RLS & User ID).

**Fix:** Add `.eq("user_id", uid)` after `.eq("id", profileId)` on the update chain. **Done 2026-03-13.**

---

## #3 — `grow_instances` mutations without `user_id` scope ✅ Fixed

**Files:**
- `src/app/vault/[id]/useVaultPlantingsHandlers.ts` — end batch, soft delete
- `src/components/BatchLogSheet.tsx` — germination, plant count, transplant

**Bug:** Updates to `grow_instances` scope only by `id`, not `user_id`. RLS may mitigate, but defensive coding per Law 1 recommends adding `.eq("user_id", user.id)`. `BatchLogSheet` also does not check `error` from the Supabase response, so DB failures are silent.

**Fix:** Add `user_id` scope to all mutations. Add error handling in `BatchLogSheet` and `useVaultPlantingsHandlers`; surface failures via `showErrorToast`. **Done 2026-03-13.**

---

## #5 — Touch targets below 44px minimum ✅ Fixed

**Files:**
- `src/app/settings/profile/page.tsx` — "Edit" garden button
- `src/app/login/page.tsx` — Submit button

**Bug:** Mobile-first touch targets should be at least 44px. These fell short.

**Fix:** Add `min-h-[44px]` (and `min-w-[44px]` if needed) to both elements. **Done 2026-03-13.**

---

## #6 — Law 5: Photo inputs missing desktop webcam path ✅ Partially done

**Done (2026-03):** Shared `src/lib/deviceUtils.ts` (`isMobileDevice`) and `src/hooks/useDesktopPhotoCapture.ts`. Applied to: `HarvestModal`, `AddPlantModal`, `vault/[id]` (hero photo), `garden/page` (Log Growth + Quick Add Journal modals), `BatchLogSheet`. On desktop, "Take photo" now opens webcam via `getUserMedia`; mobile still uses `capture="environment"`.

**Remaining (optional):** `QuickAddSupply`, `vault/review-import`, `vault/shed/[id]`, `shed/review-import` — same pattern can be applied when touching those flows. `BatchAddSeed`, `BatchAddSupply`, `PurchaseOrderImport` already use `getUserMedia` for scan flows.

---

## #9 — Admin scraper-audit page unprotected ✅ Fixed

**File:** `src/app/admin/scraper-audit/page.tsx`

**Bug:** The route was accessible to any authenticated user. It should be restricted to developers/admins.

**Fix:** Use `useDeveloperUnlock()`; when `!isUnlocked`, show "Developer tools require unlock" message and link to Settings. **Done 2026-03-13.**

---

## #10 — Dual Gemini SDK (~300KB bundle bloat)

**Package:** Both `@google/generative-ai` and `@google/genai` are in `dependencies`.

**Bug:** Two SDKs add unnecessary bundle size. The newer `@google/genai` is preferred.

**Fix:** Migrate all usage to `@google/genai`, remove `@google/generative-ai` from `package.json`, and run tests.

---

## #14 — SeedVaultView skips journal photos in image hierarchy (optional)

**File:** `src/components/SeedVaultView.tsx`

**Bug:** Profile grid cards skip step 3 of Law 7 (first journal photo fallback) for performance. Cards may show sprout emoji even when a journal photo exists.

**Fix:** Either add the journal photo step (with extra queries) or document this as an intentional trade-off.

---

## #15 — `packet_images` INSERT missing `user_id` — N/A

**File:** `src/app/vault/review-import/page.tsx` line ~945

**Check:** The `packet_images` table (migration `20250209200000_packet_images_table.sql`) has no `user_id` column. RLS is enforced via `EXISTS (SELECT 1 FROM seed_packets sp WHERE sp.id = seed_packet_id AND sp.user_id = auth.uid())`. No code change needed.

---

---

## #8 — ESLint re-enabled in builds (deferred)

**Status:** Attempted. The build fails with 50+ pre-existing lint warnings (react-hooks/exhaustive-deps, no-img-element, etc.) and 2 errors (duplicate props, missing rule in test/helpers). Reverted to `ignoreDuringBuilds: true` for now.

**Fix:** Address lint warnings across the codebase, fix `src/test/helpers.ts` eslint-disable for non-existent rule, then set `eslint: { ignoreDuringBuilds: false }` in `next.config.js`.

---

---

## Future audit — How the AI process works

A dedicated **AI process audit** is in [docs/AI_PROCESS_AUDIT.md](AI_PROCESS_AUDIT.md). It covers: entry points (Fill blanks, Magic Fill, import flows, developer), APIs (scrape-url, find-hero-photo, enrich-from-name, recommend-care-tasks, fill-blanks-for-profile, supply enrich/extract), client libs (enrichProfileFromName, researchVariety, fillBlanksCache), data flow (cache vs live AI), consistency (identity key, logging), errors/limits, and the dual Gemini SDK (#10). Update that doc when adding or changing AI behavior.

---

*Last updated: March 2026*
