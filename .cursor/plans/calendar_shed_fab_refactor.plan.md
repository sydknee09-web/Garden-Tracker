---
name: Calendar Shed FAB Refactor
overview: "Refactor Calendar, Shed, and FAB/Universal Add Menu for Architectural Luxury: schema and UI parity, timezone-safe dates, recurrence and deletion semantics, Quick-Log modal with Action Center layout, surface consistency, and performance/validation fixes."
todos: []
isProject: false
---

# Calendar, Shed, and FAB Architectural Luxury Refactor

## Decisions (confirmed)

These choices are fixed before implementation.


| Topic                         | Decision                             | Rationale                                                                                                                                                                                              |
| ----------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Delete All vs soft-delete** | **Option B: Soft-delete only**       | Data is "insurance." Soft-delete the entire series and deactivate the care_schedule. To the user it looks like a total purge (tasks and schedule vanish); the database keeps the "bones" for recovery. |
| **QuickLogModal layout**      | **Option A: Unified Action Center**  | Consistency = luxury. Use the same Quick Actions row (Water, Fertilize, etc.) and Photo Import as `/journal/new`. Condensed powerful version, not a lite form.                                         |
| **Supply image cropping**     | **Option A: User-guided crop**       | Automatic trim fails on complex product shots. High-performance modal with square/circular crop box during import review so every Shed asset looks intentional.                                        |
| **Recurrence pre-populate**   | **Batch creation: 30 rows up front** | When creating or updating a recurring schedule, generate the next 30 task rows immediately. Fills the calendar grid so the user sees the full rhythm (e.g. 3-day feeding) at a glance.                 |


---

## 1. Data schema and Shed UI

### 1.1 Database: supply_profiles size columns (BV-002)

- **Migration:** Add `size` (text) and `size_uom` (text) to `supply_profiles`. New file: `supabase/migrations/YYYYMMDD_supply_profiles_size.sql` with `ALTER TABLE supply_profiles ADD COLUMN IF NOT EXISTS size text;` and `ADD COLUMN IF NOT EXISTS size_uom text;`.
- **Types:** In [src/types/garden.ts](src/types/garden.ts), add `size?: string | null` and `size_uom?: string | null` to `SupplyProfile`.
- **Shed views:** Include `size`, `size_uom` in ShedView select and in [src/app/vault/shed/[id]/page.tsx](src/app/vault/shed/[id]/page.tsx); add optional display/edit in detail and review-import if desired.

### 1.2 Shed review-import: Save button label (BV-003)

- **File:** [src/app/shed/review-import/page.tsx](src/app/shed/review-import/page.tsx) (around line 430).
- **Change:** Button text: `Save Product` when `items.length === 1`, otherwise `Save All (${items.length})`. Keep "Saving…" and "Saved ${savedCount}!" as-is.

### 1.3 Supply import: user-guided image cropping (BV-004)

- **Scope:** During supply import review, add a **user-guided crop step** so every Shed asset is intentionally framed. Simple, high-performance modal with square or circular crop box.
- **Execution:** In [src/app/shed/review-import/page.tsx](src/app/shed/review-import/page.tsx), for each item that has a primary image, offer "Crop image" that opens a modal with a crop control (e.g. canvas-based or a library like `react-image-crop`). On confirm, replace the item's image blob/preview and use the cropped blob on Save. Continue to run [compressImage](src/lib/compressImage.ts) before upload. Ensure upload at line 136 has `cacheControl: "31536000"`.

### 1.4 Shed tab: skeleton loader (BV-007) — "Luxury" branded shimmer

- **File:** [src/components/ShedView.tsx](src/components/ShedView.tsx) (lines 319–321).
- **Current:** `{loading ? <p className="text-neutral-500 py-8">Loading…</p> : ...`
- **Change:** Replace with a skeleton that matches the list layout: same structure as list rows (thumbnail placeholder, title/line placeholders, category chip placeholder). Use **5–6 placeholder rows** with a **branded shimmer** instead of plain grey: a **linear-gradient** that matches the Emerald-900 tone—e.g. a very faint emerald-to-white gradient (e.g. `linear-gradient(90deg, transparent, rgba(6, 78, 59, 0.08), transparent)` or similar) animated across the skeleton blocks so the loading state feels "branded" and on-theme. Combine with `animate-pulse` or a custom shimmer keyframe; avoid flat `bg-neutral-100` only so the loader feels part of the Garden Vault aesthetic.

---

## 2. Calendar and task engine

### 2.1 Date bug: UTC/local consistency (BV-009, BV-010)

- **Problem:** `todayStr = new Date().toISOString().slice(0, 10)` is UTC date; can be off by one in late evening local time.
- **Fix:** Add a local-date helper (e.g. [src/lib/calendarDate.ts](src/lib/calendarDate.ts)): `localDateString(d: Date): string` using `getFullYear()`, `getMonth()`, `getDate()` padded to `YYYY-MM-DD`. Use for: `todayStr`, first/last day of month in calendar, and any "today" comparisons. Use the same helper or a local-date formatter for the Date header and task card display so header and card body use identical timezone-agnostic logic.
- **Task card:** In [src/app/calendar/page.tsx](src/app/calendar/page.tsx), `CalendarTaskRow` currently shows `displayLine` including `(${new Date(task.due_date).toLocaleDateString()})`. When the task is under a daily header, pass `hideDateInCard={true}` and omit the date suffix so the card does not repeat the header date.

### 2.2 Dot logic (BV-013)

- **Rule:** Future pending tasks = active colors (Emerald/Orange/etc.). Grey = completed/past only.
- **Current:** In [src/app/calendar/page.tsx](src/app/calendar/page.tsx) (around 825–846), `hasUpcoming` uses `getCategoryDotColor`; `hasCompletedOnly` uses `bg-slate-400`. Verify no grey is shown for days that have any pending tasks; grey only when the day has completed (or past) tasks only.

### 2.3 Recurrence: 30-day batch creation and reschedule prompt (BV-014, BV-017)

- **Pre-populate 30 days (batch creation):** When a recurring care schedule is created or updated, **generate the next 30 task rows immediately** (not one-at-a-time). In [src/lib/generateCareTasks.ts](src/lib/generateCareTasks.ts), for each active recurring schedule, create multiple task rows: one per occurrence for the next 30 days (based on `interval_days` or recurrence rule). This fills the calendar grid so the user sees the full rhythm at a glance. Ensure completion/advance logic (e.g. `advanceCareSchedule`) still works when completing one of these tasks (e.g. advance `next_due_date` and optionally leave other pre-generated rows as-is or adjust per product rules).
- **Reschedule prompt:** When the user reschedules one or more tasks that have `care_schedule_id`, show:
  - **"Just this instance"** — update only the selected task(s) `due_date`; do not change the care_schedule.
  - **"This and all future (Push schedule)"** — **Reschedule ripple / interval gap:** Recalculate the schedule from the new date using the **original interval**, rather than just incrementing from the old schedule. Set `care_schedule.next_due_date = newSelectedDate` (the date the user chose). Then derive the next occurrence as `newSelectedDate + interval_days` (e.g. move Monday to Tuesday on a 3-day schedule → next task is Tuesday + 3 days = Friday, not Thursday). Update selected task(s) to the new date; soft-delete or regenerate future pre-generated tasks so they align with this recalculated sequence. This preserves the intended interval and avoids compressing the gap (e.g. 2 days instead of 3).
- **UI:** In the batch reschedule sheet in [src/app/calendar/page.tsx](src/app/calendar/page.tsx), when any selected task has `care_schedule_id`, add a choice: "Just this instance" vs "This and all future (Push schedule)". Branch in `handleBatchReschedule` on that choice.

### 2.4 Deletion: Delete All vs Delete Future (BV-018) — soft-delete only

- **Delete All:** Soft-delete the **entire series** (all tasks with that `care_schedule_id`) and deactivate or soft-delete the care_schedule. No hard delete. To the user it looks like a total purge; tasks and schedule vanish from active views.
- **Delete Future:** Soft-delete only tasks in the series where `due_date >= todayStr`; optionally deactivate the schedule so no new instances are generated. Past tasks in the series remain soft-deleted in the DB for "insurance."
- **UI:** When the selection includes tasks with `care_schedule_id`, show two actions in the delete confirmation: **"Delete Future"** (soft-delete upcoming only) and **"Delete All"** (soft-delete entire series + deactivate schedule). For non-recurring selection, keep a single **"Delete"** (soft-delete selected tasks). Implement in [src/app/calendar/page.tsx](src/app/calendar/page.tsx) and reuse existing soft-delete paths; no `.delete()` calls.
- **Delete All safety guard:** "Delete All" is high-stakes (e.g. wiping a 7-year history of feedings). Differentiate it from the standard soft-delete in the UI: (1) **Double confirmation** — e.g. first tap shows "Delete entire series? This cannot be undone." with a second step or confirmation toast before executing, and/or (2) **Destructive styling** — style the "Delete All" button as a red/destructive action (e.g. `bg-red-600` or `text-red-600 border-red-300`) so it is visually distinct from "Delete Future" and the user understands the gravity. Backend remains soft-delete; the guard is UX-only.
- **Shadow deletion rule:** When soft-deleting the entire series for "Delete All," ensure every task in the series and the care_schedule receive a `**deleted_at` timestamp** (or, if the schema uses it, a `**status = 'archived'`** flag). This preserves the historical record for "Garden Vault" logs and analytics while hiding the series from the active UI. All list and calendar queries must continue to filter on `deleted_at IS NULL` (or equivalent) so archived series do not appear in the main views.

---

## 3. FAB and unified action center

### 3.1 Quick-Log modal with Action Center layout (BV-024, BV-025)

- **New component:** `QuickLogModal` — slide-over (overlay + panel), **same layout as Action Center**: Quick Actions row (top), Quick Memo (middle), Photo Import (bottom). Event type via Quick Actions (Water, Fertilize, Growth, Harvest, Note, Pest/Issue, etc.); date (default today); plant selector; note textarea; photo attach. Submit: insert into `journal_entries`; on success close and call `onJournalAdded?.()` so parent can `router.refresh()`.
- **Integration:** [src/components/UniversalAddMenu.tsx](src/components/UniversalAddMenu.tsx): "Add journal" opens QuickLogModal instead of navigating to `/journal/new`. Add optional `preSelectedProfileId?: string` and `onJournalAdded?: () => void`. When on `vault/[id]`, parent passes current profile id so QuickLogModal pre-selects that plant and can hide the search bar.
- **Consistency:** QuickLogModal must look and behave like a condensed version of [src/app/journal/new/page.tsx](src/app/journal/new/page.tsx) (same Quick Actions, Quick Memo, Photo Import). Consider a shared `ActionCenterLayout` or duplicated structure so the three surfaces (QuickLogModal, BatchLogSheet, journal/new) stay identical.
- **Navigation:** Update [docs/NAVIGATION_MAP.md](docs/NAVIGATION_MAP.md): "Add journal" opens Quick-Log modal; post-save stays on current page with refresh. Keep `/journal/new` for direct URL access.

### 3.2 Surface consistency and assets (BV-026)

- **Surface variable:** Single design token for FAB menu surface (e.g. in Tailwind or [src/lib/styleDictionary.tsx](src/lib/styleDictionary.tsx)): e.g. `FAB_SURFACE_BG`, `FAB_SURFACE_BORDER`, `FAB_ITEM_ROUND = "rounded-xl"`. Replace hard-coded backgrounds in [UniversalAddMenu.tsx](src/components/UniversalAddMenu.tsx) so all menu items share the same background, border, and rounded-xl.
- **Icons:** Replace Cancel "×" and Back "←" with `ICON_MAP.Close` and `ICON_MAP.Back`. Centered icons and uniform padding.
- **strokeWidth: 1.2:** In [src/lib/styleDictionary.tsx](src/lib/styleDictionary.tsx), set `strokeWidth: 1.2` in `iconProps()`.

---

## 4. Performance and validation

### 4.1 Edit flows: error block and haptic

- **Edit Plant Profile** in [src/app/vault/[id]/page.tsx](src/app/vault/[id]/page.tsx): Add error block above Save button; in `handleSaveEdit` on failure call `hapticError()`.
- **Edit Grow:** Same: error block above primary button and `hapticError()` on save failure.

### 4.2 cacheControl on uploads

- Audit every Supabase Storage `.upload()` call for `cacheControl: "31536000"`. Add where missing (e.g. [src/app/api/supply/extract-from-url/route.ts](src/app/api/supply/extract-from-url/route.ts), [src/app/api/seed/batch-import/route.ts](src/app/api/seed/batch-import/route.ts), [src/components/BatchAddSeed.tsx](src/components/BatchAddSeed.tsx), [src/lib/reviewImportSave.ts](src/lib/reviewImportSave.ts), [src/app/vault/review-import/page.tsx](src/app/vault/review-import/page.tsx), [src/app/shed/review-import/page.tsx](src/app/shed/review-import/page.tsx)).

### 4.3 Hero images (vault [id])

- Already implemented: `heroImageLoaded`, `onLoad`, skeleton when !heroImageLoaded, "Change photo" overlay only when `canEdit && heroImageLoaded`. No change unless a different skeleton style is desired.

### 4.4 Calendar: horizontal swipe margins

- In [src/app/calendar/page.tsx](src/app/calendar/page.tsx), expand the swipeable area so left/right margins trigger month change. **Edge gesture conflict:** On iOS/Android, swiping from the very edge triggers OS-level back navigation. To capture the "thumb zone" without intercepting that gesture, set the **horizontal padding for the gesture detector to 20px–30px** (e.g. `px-5` to `px-[30px]` or a wrapper with `paddingLeft: 24, paddingRight: 24`). Attach the same touch handlers to a wrapper that includes this inset around the calendar content so swipes that start in that band trigger prev/next month; swipes that start at the literal screen edge can still be claimed by the OS for back.
- **Swipe sensitivity:** Set a **minimum horizontal delta (minDelta) of about 25px** before treating a gesture as a month-swipe. This prevents vertical scrolling on a long task list from accidentally triggering prev/next month when the user's thumb drifts slightly left or right. Only trigger month change when `Math.abs(deltaX) >= 25` (or similar threshold); the existing 50px threshold can remain for the final decision, but ensure the horizontal component is at least ~25px so small drift is ignored.

### 4.5 Design tokens: strokeWidth 1.2, no pure black

- [src/lib/styleDictionary.tsx](src/lib/styleDictionary.tsx): `strokeWidth: 1.2` in `iconProps()`.
- Primary action text: use `text-emerald-900` (or design system primary) instead of `text-black` for primary CTAs; leave body text neutral.

---

## 5. Files to create

- `supabase/migrations/YYYYMMDD_supply_profiles_size.sql`
- `src/lib/calendarDate.ts` (local date string helper)
- `src/components/QuickLogModal.tsx` (Action Center layout: Quick Actions + Quick Memo + Photo Import)

## 6. Files to modify

- [src/types/garden.ts](src/types/garden.ts) — SupplyProfile size/size_uom
- [src/components/ShedView.tsx](src/components/ShedView.tsx) — skeleton; select size/size_uom if displayed
- [src/app/shed/review-import/page.tsx](src/app/shed/review-import/page.tsx) — Save label; user-guided crop modal
- [src/app/vault/shed/[id]/page.tsx](src/app/vault/shed/[id]/page.tsx) — size/size_uom in select and UI if needed
- [src/app/calendar/page.tsx](src/app/calendar/page.tsx) — local date, dot logic, reschedule prompt (Just this / Push schedule), Delete All vs Delete Future (soft-delete only), task card hide date under header, swipe margins
- [src/lib/generateCareTasks.ts](src/lib/generateCareTasks.ts) — batch-create next 30 task rows for recurring schedules
- [src/components/UniversalAddMenu.tsx](src/components/UniversalAddMenu.tsx) — open QuickLogModal, preSelectedProfileId, onJournalAdded, surface tokens, ICON_MAP for Cancel/Back
- [src/app/vault/[id]/page.tsx](src/app/vault/[id]/page.tsx) — Edit Plant Profile and Edit Grow error block + hapticError; pass preSelectedProfileId and onJournalAdded to UniversalAddMenu
- [src/app/page.tsx](src/app/page.tsx), [src/app/garden/page.tsx](src/app/garden/page.tsx), [src/app/journal/page.tsx](src/app/journal/page.tsx), [src/app/calendar/page.tsx](src/app/calendar/page.tsx) — wire QuickLogModal and onJournalAdded instead of push to /journal/new
- [src/lib/styleDictionary.tsx](src/lib/styleDictionary.tsx) — strokeWidth 1.2, optional FAB surface tokens
- [docs/NAVIGATION_MAP.md](docs/NAVIGATION_MAP.md) — Add journal flow update
- All upload call sites missing cacheControl

---

## 7. Implementation order

1. Schema + types (supply_profiles size, SupplyProfile).
2. Shed: Save button label, skeleton loader.
3. Local date helper and calendar date/dot/card fixes.
4. generateCareTasks: 30-day batch creation for recurring schedules.
5. Calendar: reschedule prompt (Just this / Push schedule), Delete All vs Delete Future (soft-delete).
6. QuickLogModal (Action Center layout) and UniversalAddMenu integration.
7. FAB surface tokens and icons; styleDictionary strokeWidth 1.2.
8. Edit error/haptic; cacheControl audit; primary color; swipe margins.
9. Supply review-import: user-guided crop modal.

