# App Audit: Navigation, Data-Input Clarity, Efficiency & Unification

**Originally written:** 2025-03-12  
**Last updated:** 2026-03-13  
**Focus:** Where to go for data/information/input, efficiency, code quality, unification, and **enjoyment** (delight, personality, making the app feel good to use).

---

## Does the app hit "easy to navigate, user friendly, useful"?

| Criteria | Verdict | Notes |
|----------|--------|--------|
| **Easy to navigate** | **Yes** | Bottom nav is clear. Universal Add Menu is consistent across all five main pages. Back behavior and `from=` param documented in NAVIGATION_MAP. Back arrow uses `from=` correctly; journal/new shows "← Garden" or "← Journal"; vault profile tab clicks update URL. |
| **User friendly** | **Yes** | Touch targets (44px), loading states, soft delete, back/escape, focus trap, haptics. Quick Log ↔ Full journal entry cross-links. Permanent plant profile shows correct tabs. Shared useToast(); success feedback on Calendar, Home, Journal, Garden. NoMatchCard has "Clear filters" where applicable. |
| **Useful** | **Yes** | Core value is fully present. All major flows (vault, plantings, journal, tasks, calendar, shopping list, care schedules, supplies) operational. Offline and sync indicators. Stay+refresh after add (redirects only on new profile creation). |

**Bottom line:** All tracked audit recommendations have been completed. Navigation, toasts, empty states, and back labels are consistent.

---

## Enjoyment audit — making the app more enjoyable

**Focus:** Delight, personality, and moments that make using the app feel good (beyond correctness and efficiency).

**What’s already in place:** Planting celebration (seed → sprout animation) on Calendar and vault/plant; harvest toast on Calendar; "Insight of the day — Great weather for sowing!" on Home; frost alert; Journal empty state with rotating daily prompts; haptics on success/error; shimmer skeletons; reduced-motion support; friendly empty-state copy in many places ("Add your first packet", "No journal entries yet" with prompts).

**Gaps and opportunities:** The recommendations below aim to increase enjoyment without adding clutter. All are optional and can be prioritized by impact vs effort.

---

## Executive summary

The app is **feature-rich, well-structured, and consistent** under the hood. All major architecture goals (Universal Add Menu, context-based modal state, custom hooks for vault profile, soft delete, RLS, focus traps, error messages, stay+refresh) have been implemented. All items from the active recommendations list (N1–N5, U1–U9) have been completed and are recorded in the ✅ Completed section.

---

## ✅ Completed

All items below have been implemented and can be considered closed.

| Item | What was done |
|------|--------------|
| **§1.3 Schedule label** | Home schedule section title set to "When to plant (by zone)" with subtext "Action now · Monthly pulse · Annual roadmap." |
| **§1.4 Journal cross-links** | `QuickLogModal` footer: "Need more fields? **Full journal entry**" → `/journal/new` (calls `onClose` on click). `/journal/new` page: subtitle "For a quick note, use **Add → Add journal** from any page." Regression tests added. |
| **§1.5 Shopping list discoverability** | Shopping list accessible via header cart icon and Home dashboard. No change required. |
| **§1.6 Back-button matrix** | "When Back goes where" table added to `NAVIGATION_MAP.md`. All contexts documented (vault profile, grow popup, journal new, shopping list, add modals). |
| **§2.1 Modal state unification** | `UniversalAddContext` and `useUniversalAddModals()` introduced. All five main pages (Home, Vault, Garden, Journal, Calendar) use `addMenuOpen` state from shared context. Back/escape closes entire stack consistently. |
| **§2.2 FAB state naming** | Garden's `fabMenuOpen` renamed to `universalAddMenuOpen`. Zero matches for `fabMenuOpen` in `src/`. `NAVIGATION_MAP.md` updated to reflect this. |
| **§2.3 Vault profile page split** | `vault/[id]/page.tsx` refactored: tab content extracted to `VaultProfileAboutTab`, `VaultProfileCareTab`, `VaultProfilePacketsTab`, `VaultProfilePlantingsTab`, `VaultProfileJournalTab`. State and handlers extracted into four custom hooks: `useVaultPlantingsHandlers`, `useVaultPacketHandlers`, `useVaultHeroHandlers`, `useVaultEditHandlers`. Shared utility `syncExtractCache` moved to `vaultProfileUtils.ts`. |
| **§2.4 Dynamic imports** | Pattern is established and correct. No changes needed. |
| **§7.2 Error recovery** | `src/lib/addFlowError.ts` added (`ADD_FLOW_ERROR_PRIMARY`, `formatAddFlowError()`). All add flows use it for save/API/DB failures. |
| **§7.4 Focus trap** | `useFocusTrap` hook saves/restores focus on close. Applied to: `AddPlantModal`, `NewTaskModal`, `EditJournalModal`, `EditPacketModal`, `QuickLogModal`, `InviteMemberModal`, `AddItemModal`, `PacketPickerModal`, `HarvestModal`, `QRScannerModal`, `ImageCropModal`, `GrowInstanceModal`. |
| **Companion planting → About tab** | Companion/avoid planting section moved from Care tab to About tab on the vault plant profile. |
| **My Plants card tap → vault profile** | Short tap on a My Plants card now navigates to `/vault/[profile_id]?from=garden&gardenTab=plants` (plant profile). Previously incorrectly went to the grow popup. Regression test added. |
| **Permanent plant tab handling** | Vault profile tab bar now conditionally excludes the Packets tab for `profile_type="permanent"` plants. A redirect effect moves users from `?tab=packets` to `care` if they land there for a permanent plant. Regression tests added. |
| **Permanent plant Care tab** | `VaultProfileCareTab` correctly differentiates seed (`profileType="seed"`) vs permanent (`profileType="permanent"`) — different `CareSuggestions` and `CareScheduleManager` rendering per type. |
| **N1 — Back arrow overrides `from=` param** | Back-link logic uses `fromParam` only; `validTab`/active tab never overrides. Comment: "fromParam always wins — back destination reflects where user came from, never the active tab." |
| **N2 — `journal/new` back button has no label** | Back link shows `← Garden` or `← Journal` per `?from=garden`; unauthenticated path shows `← Back to Garden` / `← Back to Journal`. |
| **N3 — Vault profile tab clicks don't update URL** | Tab button onClick calls `setActiveTab(tab)` and `router.replace` with `?tab=` so URL and tab stay in sync. |
| **N4 — Double `useModalBackClose`** | `NewTaskModal` does not call `useModalBackClose`; only `calendar/page.tsx` does. Regression test added. |
| **N5 — Shopping list "← Back" label is generic** | Back button checks `?from=home` param; shows "← Home" when from=home, else "← Back". Added `aria-label`. |
| **U1 — FAB menu inconsistent capitalization** | Added sub-labels to "Scan purchase order" and "Photo import" in add-plant sub-screen. Main options lowercase. |
| **U2 — Journal page: no direct "New entry" path** | Journal page has "+ Entry" button in toolbar that opens Quick Log directly. |
| **U3 — `EmptyState` component is dead code** | Deleted unused `EmptyState.tsx`. Added "Clear filters" to NoMatchCard usages (ActiveGardenView, PacketVaultView, SeedVaultView, ShedView). |
| **U4 — Toast messages inconsistent** | Shared `useToast()` hook (2500ms, top-20, bg-emerald-600). Success toasts on Garden, Journal, Calendar, Home. |
| **U5 — Double `<h1>` on detail pages** | Detail-page body headings downgraded to `<h2>` on vault/[id], vault/shed/[id], journal/new, shopping-list. |
| **U6 — Weather default "Vista, CA"** | Fallback is `"Set location in Settings"` when no user location (`src/app/page.tsx`). |
| **U7 — Shopping list empty state missing Add button** | `/shopping-list` empty state has "Add item" button opening add-item modal, matching Home dashboard. |
| **U8 — First-run FAB tip dismisses permanently** | "?" Help link in header linking to `/help`. Help page has "Where do I…?" content. |
| **U9 — Vault tab naming confusion** | User keeps **Plant Profiles** (not "Plants"). Vault tabs: Plant Profiles, Packets, Shed. |
| **E1 — Rotate Insight of the day copy** | Home insight banner rotates 4 variants by day of week. |
| **E2 — Added to Vault success moment** | First-time add: redirect with ?added=1; vault profile shows seedling celebration once per device (localStorage). |
| **E3 — Empty-state visual consistency** | EmptyStateCard component used on Journal, SeedVaultView, MyPlantsView, ShedView, shopping-list. |
| **E4 — Journal empty state: mention + Entry** | Copy updated to include "or + Entry above". |
| **E5 — Card hover/active state on desktop** | .card-interactive utility; applied to Journal, SeedVaultView, ActiveGardenView, MyPlantsView, ShedView cards. |
| **E6 — Optional success sound** | Settings toggle; successSound.ts + useToast integration. |
| **Error toasts in distinct style** | useToast supports variant `success` \| `error`; `showErrorToast(msg)` uses bg-amber-600, no success sound, aria-live="assertive". AddItemModal optional `onErrorToast`; Home and shopping-list pass showErrorToast. |
| **Success feedback audit** | Added success toasts: GrowInstanceModal archive; BatchLogSheet (Garden, vault profile); HarvestModal (Garden, vault); EditPacketModal (Vault list); AddItemModal (shopping list). Shopping list: "Removed from list", "Saved", "Marked as purchased". |
| **Outstanding #15 packet_images** | Confirmed N/A — table has no user_id; RLS via seed_packets. Doc updated. |
| **Law 5 desktop webcam** | deviceUtils.ts + useDesktopPhotoCapture hook. Applied to HarvestModal, AddPlantModal, vault/[id] hero, garden (Log Growth + Quick Add), BatchLogSheet. Outstanding #6 updated. |

---

## 🔧 Active Recommendations

None. All enjoyment items (E1–E6) have been completed and are in the ✅ Completed section above.

---

## 🗄️ Retired

These were recommendations in the original audit that are either no longer applicable or superseded by the completed work.

| Item | Reason retired |
|------|---------------|
| **§3.1 "One add state layer"** | Completed — `UniversalAddContext` was implemented. |
| **§3.2 Naming unification** | Completed — `universalAddMenuOpen` / `addMenuOpen` consistent. `fabMenuOpen` fully removed. |
| **§3.3 "Where do I…?" docs** | `docs/WHERE_DO_I.md` exists and is linked from `NAVIGATION_MAP.md`. `NAVIGATION_MAP.md` data input map section added. No further action needed unless content needs updating. |
| **§3.4 Back-button matrix** | Completed — full matrix added to `NAVIGATION_MAP.md`. |
| **§7.1 First-run onboarding** | FAB tip implemented (dismissible banner on Home). See U8 if you want to go further. |
| **§7.3 Copy and labels** | "When to plant (by zone)" label is in place. Empty state copy is action-oriented on Vault/Garden. Remaining copy issues captured in active recommendations (U1–U9). |
| **§7.5 "One place to start"** | FAB is the universal entry point across all pages. Onboarding tip added to Home. Superseded by U8 (help link) if more is needed. |

---

## Priority matrix

### Enjoyment (E1–E6)

| Priority | Item | Status |
|----------|------|--------|
| ~~🟡 Low~~ | ~~**E1** — Rotate Insight of the day copy~~ | Done |
| ~~🟡 Low~~ | ~~**E2** — Added to Vault success moment~~ | Done |
| ~~🟡 Low~~ | ~~**E3** — Empty-state visual consistency~~ | Done |
| ~~🟢 Trivial~~ | ~~**E4** — Journal empty state: mention + Entry~~ | Done |
| ~~🟡 Low~~ | ~~**E5** — Card hover/active state on desktop~~ | Done |
| ~~🟡 Low~~ | ~~**E6** — Optional success sound (Settings)~~ | Done |

### Previously completed (reference)

| Priority | Item | Effort |
|----------|------|--------|
| ~~🔴 High~~ | ~~**N1** — Back arrow ignores `from=` param~~ | Done |
| ~~🟠 Medium~~ | ~~**N3** — Vault profile tab clicks don't update URL~~ | Done |
| ~~🟠 Medium~~ | ~~**N4** — Double `useModalBackClose` in NewTaskModal~~ | Done |
| ~~🟠 Medium~~ | ~~**U2** — Journal page: no direct "New entry" path~~ | Done |
| ~~🟠 Medium~~ | ~~**U3** — `EmptyState` component is dead code~~ | Done |
| ~~🟠 Medium~~ | ~~**U4** — Toast inconsistency~~ | Done |
| ~~🟡 Low~~ | ~~**N2** — `journal/new` back button has no label~~ | Done |
| ~~🟡 Low~~ | ~~**N5** — Shopping list "← Back" is generic~~ | Done |
| ~~🟡 Low~~ | ~~**U1** — FAB menu capitalization + sub-screen sub-labels~~ | Done |
| ~~🟡 Low~~ | ~~**U5** — Double `<h1>` on detail pages~~ | Done |
| ~~🟡 Low~~ | ~~**U6** — Weather hardcoded to "Vista, CA"~~ | Done |
| ~~🟡 Low~~ | ~~**U7** — Shopping list empty state missing Add button~~ | Done |
| ~~🟡 Low~~ | ~~**U8** — First-run tip dismisses permanently~~ | Done |
| ~~🟡 Low~~ | ~~**U9** — Vault tab naming confusion~~ | Done |

---

## Medium- and high-effort tasks (final polish reference)

Below are **all** tasks from the app audits that were (or are) **medium effort** or **high effort**, so you can confirm what’s already done and what might be worth doing for final polish. (The main recommendations list emphasized high-impact, low-effort items first.)

### ✅ Completed (medium/high effort or priority)

| Item | Effort / priority | What was done |
|------|-------------------|----------------|
| **N1 — Back arrow overrides `from=`** | High priority | Back-link logic uses `fromParam` only; comment added. |
| **N3 — Vault profile tab clicks don’t update URL** | Medium priority | Tab click calls `router.replace` with `?tab=...`. |
| **N4 — Double `useModalBackClose` in NewTaskModal** | Medium priority | Removed duplicate; regression test added. |
| **U2 — Journal page: no direct "New entry" path** | Medium priority | "+ Entry" in toolbar opens Quick Log. |
| **U3 — EmptyState component dead code** | Medium priority | Deleted; added "Clear filters" to NoMatchCard usages. |
| **U4 — Toast inconsistency** | Medium priority | Shared `useToast()`; success toasts on Garden, Journal, Calendar, Home. |
| **E3 — Empty-state visual consistency** | **Medium effort** | EmptyStateCard component; used on Journal, SeedVaultView, MyPlantsView, ShedView, shopping-list. |
| **§2.3 Vault profile page split** | High effort (already done earlier) | Tabs + four custom hooks; state/handlers extracted. |
| **§7.4 Focus trap** | Medium effort | useFocusTrap applied to 12 modals. |

### 🔶 Open or optional (medium / high effort)

*From FULL_APP_AUDIT.md and Outstanding_Audit_Notes.md — not in the main “active” list but relevant for final polish.*

| Item | Effort | Source | Notes |
|------|--------|--------|--------|
| **Signature success moment (e.g. confetti/glow on “Planted!” / “Added to Vault”)** | Medium | FULL_APP_AUDIT §1.1 | Optional; user setting. E2 already added first-time “Added to Vault” celebration. |
| **Light illustration set for empty states** | Medium | FULL_APP_AUDIT §1.1, §1.5 | One shared illustration (sprout, empty vault, empty journal) instead of text-only. EmptyStateCard is in place; adding art is optional. |
| **Audit every save/complete for success toast** | Medium | FULL_APP_AUDIT §1.3 | Ensure every “save” / “complete” / “archive” shows toast or clear inline success. Main flows already use useToast; a full pass would catch edge cases. |
| **Error toasts in distinct style (e.g. red/amber)** | Low–Medium | FULL_APP_AUDIT §1.3 | useToast variant for errors so they’re clearly different from success. |
| **Document CONTRIBUTING or ARCHITECTURE** | Medium | FULL_APP_AUDIT §2.1 | “Where to put new X”; which page owns modals, which context holds state. |
| **Getting started in README** | Low–Medium | FULL_APP_AUDIT §2.3 | Required env vars, first-run commands for new devs. |
| **Optional “Quick start” onboarding (3 steps)** | Medium–High | FULL_APP_AUDIT §3.2 | e.g. set zone → add first seed → add first task. Product decision. |
| **Law 5: Photo inputs — desktop webcam path** | **High** | Outstanding #6 | All photo-taking components (HarvestModal, AddPlantModal, QuickAddSupply, vault hero, garden, review-import, shed, etc.) should use `isMobileDevice()` + `getUserMedia` on desktop. Several components already do; rest need the same pattern. |
| **Dual Gemini SDK migration** | Medium–High | Outstanding #10 | Migrate to `@google/genai`, remove `@google/generative-ai`; reduces bundle ~300KB. |
| **ESLint re-enabled in builds** | **High** | Outstanding #8 | 50+ existing warnings + 2 errors; fix then set `ignoreDuringBuilds: false`. |
| **grow_instances mutations: add user_id scope + error handling** | Medium | Outstanding #3 | vault/[id], BatchLogSheet; add `.eq("user_id", user.id)` and surface DB failures. |
| **SeedVaultView: journal photo in hierarchy (Law 7)** | Medium | Outstanding #14 | Optional; cards could show first journal photo; currently skipped for performance. |

### Summary for final polish

- **Already dialed in:** All previously tracked medium/high priority and the one explicit medium-effort enjoyment item (E3) are done. Vault tab URL, toasts, empty-state component, focus trap, and vault profile structure are in place.
- **If you want to go further:** Success-feedback audit (shopping-list toasts) and Law 5 desktop webcam (main flows) are done. Remaining optional: illustration set for empty states; Law 5 on QuickAddSupply and review-import pages; Technical/debt: Gemini migration, ESLint (Outstanding #8, #10).

---

## Out of scope

- Schema or RLS (governed by Laws of the Vault).
- Changing redirect rules unless explicitly requested.
- Adding or removing FAB options; only clarity and discoverability of existing flows.
