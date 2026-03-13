# App Audit: Navigation, Data-Input Clarity, Efficiency & Unification

**Date:** 2025-03-12  
**Focus:** Where to go for data/information/input, efficiency, code quality, unification.

---

## Does the app hit “easy to navigate, user friendly, useful”?

| Criteria | Verdict | Notes |
|----------|--------|--------|
| **Easy to navigate** | **Partly** | Bottom nav (Home, Vault, Garden, Calendar, Journal) is clear. Same FAB everywhere is good. Gaps: Shed is a Vault tab (not obvious); Schedule is only from Home; “where do I add X?” requires learning the FAB tree; no in-app wayfinding for first-time users. |
| **User friendly** | **Mostly** | Touch targets (44px), loading states, soft delete, back/escape behavior, empty states (`EmptyState`), error fallbacks (`RouteErrorFallback`), haptics, and aria usage are in place. Gaps: no onboarding; Quick Log vs full journal not explained in UI; some copy could be more action-oriented. |
| **Useful** | **Yes** | Core value is there: seed vault, plantings, journal, tasks/calendar, shopping list, care schedules, zone/schedule, supplies. Stays on page after add (no jarring redirects except new profile). Offline and sync indicators. |

**Bottom line:** The app is **useful and largely user friendly**, but **navigation and discoverability** are the main gaps. Making “where to go” obvious (especially Shed, Schedule, and the FAB paths) and adding light guidance (e.g. “Where do I…?” or first-run hints) would move it solidly into “easy to navigate” and “user friendly” for new users.

---

## Executive summary

The app is **feature-rich and consistent** under the hood (Universal Add Menu, stay+refresh, RLS, soft delete). The main pain is **discoverability**: one FAB opens many branches (seed → manual/photo/link/PO; plant → manual vs start seeds; shed → manual/photo/batch/link/PO; task; journal), and key areas (Shed, Schedule, Shopping list, full Journal form) are not obvious from the bottom nav or a single “data input” map. Below are concrete findings and recommendations.

---

## 1. Navigation & “Where do I input data?”

### 1.1 Single entry point, deep tree

**Current:** The FAB is the main add entry point on Home, Vault, Garden, Journal, and Calendar. Tapping it opens “Add” with five options; “Add plant” has a second screen (Manual Entry | Start Seeds). Each of “Add Seed Packet,” “Add to shed,” etc. has its own sub-flows (e.g. QuickAddSeed: Manual, Photo, Link, PO).

**Issue:** Users can’t easily answer “where do I add seeds from a URL?” or “where do I log a quick note?” without learning the tree.

**Recommendations:**

- **Add a “Where do I…?” guide** (in-app or in docs) that maps intent → path, e.g.:
  - “Add seeds from a link” → FAB → Add Seed Packet → (in QuickAddSeed) Link / paste URL
  - “Log a quick note with plants” → FAB → Add journal (Quick Log)
  - “Add a supply from a photo” → FAB → Add to shed → Photo Import
  - “Plan when to start seeds” → Home → Planting Schedule (or Resources)
- **Optional:** Short contextual hints on the Universal Add Menu (e.g. under “Add Seed Packet”: “Manual, photo, link, or order screenshot”). You already have sub-labels; a one-line “Ways: Manual · Photo · Link · PO” could reduce trial-and-error.

### 1.2 Shed is inside Vault, not in the nav

**Current:** `/shed` redirects to `/vault?tab=shed`. Supply detail is `/vault/shed/[id]`. Bottom nav has Home, Vault, Garden, Calendar, Journal—no “Shed” or “Supplies.”

**Issue:** Users looking for “where do I add fertilizer / supplies?” may not think “Vault” first. Shed is a tab, not a top-level destination.

**Recommendations:**

- **Option A:** Rename or subtitle the Vault nav item (e.g. “Vault” with subtitle “Seeds & supplies” or “Seeds · Shed”) so “supplies” is discoverable.
- **Option B:** Add a 6th nav item “Shed” that goes to `/vault?tab=shed` (same content, clearer intent). Consider only if you’re okay with 6 nav items.
- **Option C:** On first open of Vault, show a one-time tooltip or chip: “Seeds and supplies live here — switch tabs to see Shed.”

### 1.3 Schedule vs Calendar

**Current:** “Planting Schedule” (when to plant: Action now, Monthly pulse, Annual roadmap) lives at `/schedule`, linked from Home and Resources. “Calendar” in the nav is tasks (overdue, upcoming, completed). Schedule is not in the bottom nav.

**Issue:** “When do I plant?” (schedule) vs “What do I do today?” (calendar) are different; schedule is easy to miss if users don’t scroll Home.

**Recommendations:**

- Keep Schedule as a secondary destination (no nav bloat), but make the **Home section label** very explicit: e.g. “When to plant (by zone)” with subtext “Action now · Monthly pulse · Annual roadmap” so the purpose is clear. **Done (2025-03-12):** Home schedule section title set to "When to plant (by zone)" and subtext to "Action now · Monthly pulse · Annual roadmap."
- In **Resources**, keep a prominent “Zone charts & planting schedule” so planning has a second anchor.

### 1.4 Journal: Quick Log vs full form

**Current:** FAB → Add journal opens the Quick Log modal. Full form is at `/journal/new` (e.g. from a “Detailed” or “Full entry” link if you add one, or direct URL).

**Issue:** Two ways to add a journal entry (quick vs full) can confuse unless the distinction is clear: “Quick Log = fast note + plants + date,” “Full form = full note, photos, plant selection, entry type.”

**Recommendations:**

- In the Quick Log modal header or footer, add a link: “Need more fields? **Full journal entry**” → `/journal/new`.
- On `/journal/new`, add a line: “For a quick note, use **Add → Add journal** from any page.”

### 1.5 Shopping list

**Current:** Shopping list is in the header (cart icon) and on the Home dashboard; “Add item” is modal from dashboard or from the Shopping List page FAB. Not in the bottom nav.

**Recommendations:**

- No change required if the header icon is visible and the dashboard “Add item” is obvious. If users report “where do I add to shopping list?”, consider a small hint on the plant profile (“Add to list” near cart icon) or a one-liner in the “Where do I…?” guide.

### 1.6 Back behavior and context

**Current:** Back and “from” params (`from=garden`, `from=calendar`, etc.) are documented and consistent. They improve context but add complexity for documentation and debugging.

**Recommendation:** Keep as is. Optionally add a single **back-button matrix** in `NAVIGATION_MAP.md` (e.g. "From profile opened from Garden → Back goes to Garden") so future changes don't break expectations.

**Done (2025-03-12):** Added **When Back goes where** table to NAVIGATION_MAP.md (Universal Add Menu, QuickAddSupply, Vault profile, Grow popup, Journal New, Shopping List, add modals, Calendar date selection). (e.g. “From profile opened from Garden → Back goes to Garden”) so future changes don’t break expectations.

---

## 2. Efficiency & code quality

### 2.1 Modal state duplicated across pages

**Done (2025-03-12):** Introduced **UniversalAddContext** and **useUniversalAddModals()** hook. The context holds: `addMenuOpen`, `activeModal` (`'seed' | 'shed' | 'plant' | 'task' | 'journal' | null`), `addPlantDefaultType`, and actions: `openMenu`, `closeMenu`, `openSeed`, `openShed`, `openPlant`, `openTask`, `openJournal`, `closeActiveModal`, `backToMenu`, `closeAll`. **UniversalAddProvider** wraps the app in the root layout. Home, Vault, Garden, Journal, and Calendar use the hook and render modals when `activeModal === 'seed'` etc. Page-specific state (e.g. batch add, purchase order, Vault scanner/qrPrefill) remains local. Back/escape and useModalBackClose call `closeAll()` so behavior is consistent.

**Removed duplicate recommendation.** (e.g. `UniversalAddContext`) that holds: FAB menu open, and which “add” modal is open (seed, shed, plant, task, journal). Each page uses one context instead of 5–10 `useState` calls. Back/escape closes the whole stack in one place.
### 2.2 Inconsistent FAB state naming

**Current:** Garden page uses `fabMenuOpen` / `setFabMenuOpen`; Home, Vault, Journal, and Calendar use `universalAddMenuOpen` / `setUniversalAddMenuOpen`. Same menu, different names.

**Recommendation:** Rename Garden to `universalAddMenuOpen` (and same setter naming as other pages) so grep and docs refer to one concept. Update `NAVIGATION_MAP.md` if it mentions “fabMenuOpen.”

### 2.3 Vault profile page size

**Current:** `src/app/vault/[id]/page.tsx` is very large (≈2800+ lines), with tabs (About, Care, Pkts, Plants, Journal), modals, and many handlers.

**Recommendation:** Split by tab or by concern: e.g. `VaultProfileAboutTab`, `VaultProfileCareTab`, `VaultProfilePacketsTab`, `VaultProfilePlantingsTab`, `VaultProfileJournalTab`, and keep the page as a thin shell that composes them and owns URL/query state. Improves readability and tests.

### 2.4 Dynamic imports

**Current:** Heavy use of `dynamic(..., { ssr: false })` for UniversalAddMenu, QuickAddSeed, QuickAddSupply, AddPlantModal, NewTaskModal, QuickLogModal, etc. is appropriate for bundle size and hydration.

**Recommendation:** No change. If you add more modals, keep the same pattern and document it in your conventions (e.g. “Add flows and FAB menus are dynamically imported with ssr: false”).

---

## 3. Unification

### 3.1 One “add” state layer (see 2.1)

Unifying modal state (context or hook) also unifies behavior: one place to implement “close all add modals on back” and “back from QuickAddSupply → re-open Universal Add Menu.”

### 3.2 Naming (see 2.2)

Use `universalAddMenuOpen` (and same pattern for “open seed modal,” “open shed modal,” etc.) everywhere so code and docs speak one language.

### 3.3 “Where do I…?” and docs

- **User-facing:** Short in-app or help doc: “Where do I…?” mapping intent → FAB path (and optionally Schedule, Shopping list, `/journal/new`).
- **Developer-facing:** `NAVIGATION_MAP.md` is already the source of truth. Add a one-page **“Data input map”** that lists: Input type (e.g. “Seed packet from URL”) → Entry (FAB → Add Seed Packet → Link) → Optional redirect (e.g. new profile → `/vault/[id]`). This complements the existing flow docs and helps onboarding and audits.

### 3.4 Back-button matrix (optional)

In `NAVIGATION_MAP.md`, add a compact table: “When I’m on [screen] and I got here from [context], Back goes to [destination].” Reduces ambiguity for support and future changes.

---

## 4. Quick wins (no flow changes)

- Rename Garden’s `fabMenuOpen` → `universalAddMenuOpen` (and setter) for consistency.
- Add “Full journal entry” link in Quick Log modal → `/journal/new`, and “Quick log: FAB → Add journal” on `/journal/new`.
- Add a “Where do I…?” section to docs (and optionally in-app) mapping intent → path.
- Add a “Data input map” subsection to `NAVIGATION_MAP.md`: input type → entry point → redirect rule.

---

## 5. Summary table

| Area              | Issue                          | Recommendation                                      |
|------------------|---------------------------------|-----------------------------------------------------|
| Discoverability  | FAB tree is deep                | “Where do I…?” guide; optional short hints in menu  |
| Shed             | Not in nav, lives under Vault   | Subtitle “Seeds & supplies” or 6th nav “Shed”       |
| Schedule         | Not in nav, only from Home      | Clear Home label; keep Schedule off nav            |
| Journal          | Quick vs full unclear            | Cross-links: Quick Log ↔ Full form                  |
| Modal state      | Duplicated across 5 pages        | Context or `useUniversalAddModals()` hook           |
| Naming           | Garden: `fabMenuOpen`            | Use `universalAddMenuOpen` everywhere               |
| Vault profile    | Very large file                 | Split by tab / component                            |
| Docs             | No intent→path map              | “Data input map” + optional back matrix in NAV_MAP  |

---

## 6. Out of scope for this audit

- Schema or RLS (already governed by Laws of the Vault).
- Changing redirect rules (e.g. “only redirect when new profile”) unless you explicitly ask.
- Adding or removing FAB options; only clarity and discoverability of existing flows were considered.

---

## 7. Anything else to add (easy + friendly + useful)

### 7.1 First-run / onboarding

**Current:** No guided tour or “first time here?” experience. New users land on Home and see sections (weather, schedule, shopping list, tasks) and the FAB.

**Suggestion:** Light touch is enough. Options: (A) One-time dismissible tip on Home: “Tap **+** to add seeds, plants, supplies, tasks, or a quick log.” (B) On first open of Vault, a small chip: “Seeds & supplies live here — switch tabs to see Shed.” (C) A **Help** or “?” in the header linking to a short “Where do I…?” page (docs or in-app). Avoid a long multi-step tour.

### 7.2 Error recovery and feedback

**Current:** `RouteErrorFallback` shows a friendly message; modals (e.g. `NewTaskModal`, `AddItemModal`) show inline errors and use haptics. Submit loading overlays prevent double-submit.

**Suggestion:** Ensure every add flow (seed, plant, supply, task, journal) shows a clear success state (e.g. “Added” toast or inline message) and, on failure, “Something went wrong. Try again.” with the error message when safe. You already have hapticSuccess/hapticError; consistent copy helps.

**Done (2025-03-12):** Added `src/lib/addFlowError.ts` with `ADD_FLOW_ERROR_PRIMARY` and `formatAddFlowError(err)`. All add flows (QuickAddSeed, QuickAddSupply, AddPlantModal, NewTaskModal, QuickLogModal, AddItemModal, AddPlantManualModal, EditJournalModal, EditPacketModal, HarvestModal, InviteMemberModal, BatchAddSeed, PurchaseOrderImport, CareScheduleManager) now use this for save/API/DB failures; validation messages (e.g. "Title is required", "Select a variety") remain specific.

### 7.3 Copy and labels

**Current:** Universal Add Menu uses “Add Seed Packet,” “Add plant,” “Add to shed,” “Add task,” “Add journal” with short sub-labels. Empty states use `EmptyState` with message + optional action.

**Suggestion:** (A) Use action-oriented empty states where possible: e.g. “No seeds yet — add your first packet” with button “Add Seed Packet.” (B) Keep section titles consistent: “Planting Schedule” vs “When to plant (by zone)” so purpose is obvious. (C) On Vault, if you add a subtitle, “Seeds & supplies” is clearer than “Vault” alone.

### 7.4 Accessibility

**Current:** Touch targets (min 44px), aria-labels on FAB and key actions, `role="dialog"` and `aria-modal` on modals, `LoadingState` and skeletons. Focus handling in modals should be verified.

**Suggestion:** (A) Confirm focus is trapped in open modals and returns to trigger on close. (B) Ensure “Back” and “Cancel” are consistently labeled (e.g. “Back to menu” vs “Cancel”). (C) If you add a “Where do I…?” page, keep it keyboard- and screen-reader friendly.

**Done (2025-03-12):** (A) useFocusTrap now saves/restores focus on close; applied to AddPlantModal, NewTaskModal, EditJournalModal, EditPacketModal, QuickLogModal, InviteMemberModal, AddItemModal, PacketPickerModal, HarvestModal, QRScannerModal, ImageCropModal, GrowInstanceModal.

### 7.5 One place to “start”

**Current:** Home is the natural start (dashboard). FAB is the single add entry point. There is no dedicated “Get started” or “Quick start” path.

**Suggestion:** Optional: On Home, when the user has no seeds and no tasks, show a single prominent card: “Get started: add your first seed packet or log a quick note” with one primary button that opens the FAB (or directly QuickAddSeed). Removes guesswork for brand-new users without changing flows.

---

If you tell me which parts you want to implement first (e.g. “rename Garden FAB state,” “add Where do I doc,” “extract useUniversalAddModals,” “add first-run tip”), I can outline or apply the code/docs changes step by step.
