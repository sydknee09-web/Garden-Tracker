# App Audit: Navigation, Data-Input Clarity, Efficiency & Unification

**Originally written:** 2025-03-12  
**Last updated:** 2026-03-13  
**Focus:** Where to go for data/information/input, efficiency, code quality, unification.

---

## Does the app hit "easy to navigate, user friendly, useful"?

| Criteria | Verdict | Notes |
|----------|--------|--------|
| **Easy to navigate** | **Mostly** *(improved from Partly)* | Bottom nav is clear. Universal Add Menu is consistent across all five main pages. Back behavior and `from=` param are documented and mostly reliable. Remaining gaps: back arrow title overrides `from=` param when on Journal tab of vault profile; `journal/new` back arrow has no label; tab clicks on vault profile don't update the URL. |
| **User friendly** | **Mostly** | Touch targets (44px), loading states, soft delete, back/escape, focus trap, haptics all in place. Quick Log ↔ Full journal entry cross-links added. Permanent plant profile now shows correct tabs (no Packets tab). Remaining gaps: toast position/color/duration is inconsistent across pages; filter no-match states have no inline "Clear filters" action; no success feedback on Garden or Journal after completing actions. |
| **Useful** | **Yes** | Core value is fully present. All major flows (vault, plantings, journal, tasks, calendar, shopping list, care schedules, supplies) operational. Offline and sync indicators. Stay+refresh after add (redirects only on new profile creation). |

**Bottom line:** The app has improved significantly. Navigation is reliable and consistent. The remaining gaps are primarily cosmetic/polish: back arrow label edge cases, toast inconsistency, and a handful of empty-state UX gaps.

---

## Executive summary

The app is **feature-rich, well-structured, and consistent** under the hood. All major architecture goals (Universal Add Menu, context-based modal state, custom hooks for vault profile, soft delete, RLS, focus traps, error messages, stay+refresh) have been implemented. What remains is **polish and edge-case navigation**: a back arrow that misbehaves when switching tabs, a few inconsistent toasts, and the `EmptyState` component that was defined but never actually used in favor of inline implementations.

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

---

## 🔧 Active Recommendations

### N1 — Back arrow overrides `from=` param when on Journal tab *(High)* — **Completed**

**Fix applied:** Back-link logic uses `fromParam` only; `validTab`/active tab never overrides. Comment added: "fromParam always wins — back destination reflects where user came from, never the active tab."

---

### N2 — `journal/new` back button has no label *(Medium)*

**Current:** The back arrow on `/journal/new` (the authenticated main path) renders only `←` — a bare left arrow inside a styled button. There is no text beside it. The destination depends on `?from=garden` (→ `/garden`) or default (→ `/journal`), but nothing tells the user where tapping it will go.

**Fix:** Add dynamic label matching the destination:

```tsx
← {fromGarden ? "Garden" : "Journal"}
```

Matches the unauthenticated path, which already uses this pattern correctly.

---

### N3 — Vault profile tab clicks don't update the URL *(Medium)*

**Current:** Opening `/vault/[id]?tab=care` correctly activates the Care tab. But clicking a tab at runtime only calls `setActiveTab(tab)` — the URL is never updated. This means:
- If you click to the Care tab and then navigate away and return, you're back on About.
- Prev/next arrow navigation preserves the tab as loaded from URL (`validTab`), not as the user last clicked.
- Deep-linking to a specific tab for sharing or bookmarking only works if the URL was set on entry.

**Fix:** When a tab button is clicked, do a `router.replace` (not `push`) with the updated `?tab=` param:

```tsx
onClick={() => {
  setActiveTab(tab);
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  router.replace(url.toString(), { scroll: false });
}}
```

Garden, Journal, and the Vault list page already do this — vault profile should match.

---

### N4 — Double `useModalBackClose` in `NewTaskModal` + `calendar/page.tsx` *(Medium)* — **Completed**

**Fix applied:** `NewTaskModal` does not call `useModalBackClose`; only `calendar/page.tsx` does. Regression test added to prevent future duplicate.

---

### N5 — Shopping list "← Back" label is generic *(Low)*

**Current:** The Shopping List back button uses `router.back()` with label `← Back`. Because the shopping list is accessible from any page via the header cart icon, `router.back()` is unpredictable if the user opened it by navigating directly (e.g., bookmarked URL or link). The label gives no hint where Back goes.

**Recommendation:** Use `router.back()` is fine for history-based navigation, but improve the label by checking a `?from=` param (if available) or replace with a fixed "← Home" as a safer default. Add `aria-label="Back to previous page"` for accessibility.

---

### U1 — FAB menu has inconsistent capitalization *(Low)*

**Current:** `UniversalAddMenu` has five options:

| Option | Sub-label |
|--------|-----------|
| **Add Seed Packet** ← title case | "Seeds for your vault" |
| Add plant ← lowercase | "Trees, perennials, or seasonal" |
| Add to shed ← lowercase | "Fertilizer, soil, supplies" |
| Add task ← lowercase | "Reminder or to-do for calendar" |
| Add journal ← lowercase | "Log growth, harvest, notes" |

"Add Seed Packet" is title-cased; all others are lowercase. Pick one convention and apply it consistently. Lowercase sentence-style ("Add seed packet") is recommended — matches the rest of the UI.

Also: the "Add plant" sub-screen options ("Manual Entry", "Start Seeds", "Scan Purchase Order", "Photo Import") have **no sub-labels**, while the main screen has helpful ones. Add a one-liner to each:

| Sub-option | Suggested sub-label |
|-----------|---------------------|
| Manual Entry | "Enter name, variety, notes" |
| Start Seeds | "Plant from your existing vault" |

The label "Start Seeds" also implies you're beginning to germinate seeds, when it actually means "choose seeds from your vault to plant." Consider renaming to **"From Vault"** or **"Plant from Vault"** for clarity.

---

### U2 — Journal page: no direct "New entry" path *(Medium)*

**Current:** On `/journal`, the only way to add an entry is: FAB → Universal Add Menu → "Add journal" → Quick Log modal. For a page dedicated to journaling, this is one tap too many. The full form at `/journal/new` is not linked from the journal page at all.

**Recommendations:**
- In the journal page header toolbar (alongside the view toggle icons), add a compact **"+ Entry"** button that opens the Quick Log modal directly (bypassing the Universal Add Menu).
- Or: the existing rotating empty-state prompt could include an inline "Add entry" button, not just "Tap the + button below."
- The link to `/journal/new` from `QuickLogModal` ("Full journal entry") is good; it just isn't surfaced on the journal page itself. A text link "Full entry →" in the toolbar or near the empty state would help.

---

### U3 — `EmptyState` component is dead code *(Medium)*

**Current:** `src/components/EmptyState.tsx` is defined but never imported or used anywhere. All empty states are implemented inline, resulting in 15+ inconsistently styled empty state blocks across the codebase.

**Recommendation:** Either:
- **Adopt it:** Replace inline empty states with `<EmptyState message="..." action={...} />` calls everywhere, making them visually consistent and centrally styleable. 
- **Delete it:** If the inline approach is preferred, remove the unused file to avoid confusion.

Filter no-match states (Vault, Garden, Shed) currently show only text with no "Clear filters" action button. Whatever pattern you choose, these should include a `Clear filters` button inline.

---

### U4 — Toast messages are inconsistent across pages *(Medium)*

**Current:** Three different toast implementations across three files:

| Page | Position | Color | Timeout |
|------|----------|-------|---------|
| `vault/[id]` | `fixed top-20, centered` | `bg-emerald-luxury` | unclear |
| `vault/shed/[id]` | `fixed top-20, centered` | `bg-emerald-600` | 2500ms |
| `vault/VaultPageContent` | `fixed above bottom nav` | `bg-black/85` | 5000ms |

And no toast at all on Garden or Journal pages — successful actions there give no feedback.

**Recommendation:** Create a shared `<Toast>` component (or a `useToast()` hook) with a single position, color, and 2500ms default timeout. Add success toasts to Garden (e.g., "Task completed", "Batch ended") and Journal (e.g., "Entry deleted") to match vault behavior.

---

### U5 — Double `<h1>` on detail pages *(Low — accessibility)*

**Current:** `AuthGuard` renders a global `<h1>` in the sticky header for every route. Detail pages (`/vault/[id]`, `/vault/shed/[id]`, `/journal/new`, `/shopping-list`) also render their own `<h1>` in the page body. This results in two `<h1>` elements simultaneously — a screen-reader and SEO concern.

**Fix options:**
- Change the global header element to `<p>` or `<span>` with `role="heading" aria-level="1"` only when no page-level `<h1>` exists.
- Or: downgrade detail-page body headings to `<h2>` since the header `<h1>` already names the section.

---

### U6 — Weather default location is hardcoded to "Vista, CA" *(Low)*

**Current:** `src/app/page.tsx` falls back to `"Vista, CA"` when no user location is set:

```tsx
const locationLabel = userSettings?.location_name?.trim() || "Vista, CA";
```

New users who haven't set a location see weather labeled for Vista, CA, which may confuse or mislead.

**Fix:** Replace the hardcoded fallback with a neutral prompt: `"Set your location in Settings"` — or hide the weather widget entirely until location is configured.

---

### U7 — Shopping list empty state missing "Add item" button *(Low)*

**Current:** The Home dashboard shopping list empty state has an "Add item" button. The `/shopping-list` page empty state shows only the message "No items on your shopping list yet." with no inline action — the user must use the FAB.

**Fix:** Add an "Add item" button to the `/shopping-list` empty state, matching the Home dashboard pattern.

---

### U8 — First-run FAB tip dismisses permanently *(Low)*

**Current:** The Home page shows a one-time dismissible tip: "Tap + to add seeds, plants, supplies, tasks, or a quick log." Once dismissed (stored in localStorage), it never returns.

**Recommendation:** This is acceptable behavior for an onboarding tip. However, consider adding a **Help link** (e.g., a `?` or `ⓘ` in the header) that links to `docs/WHERE_DO_I.md` or a `/help` page. This gives users a permanent escape hatch after dismissing the tip.

---

### U9 — Vault tab naming creates confusion *(Low)*

**Current:** The bottom nav says "Vault." Inside Vault, the three tabs are: **Plant Profiles**, **Seed Vault**, **Shed**. The second tab is called "Seed Vault" — the same word as the top-level section. A user may wonder: "Is the whole page the Vault, or just that tab?"

**Recommendation:** Rename the second tab to **"Packets"** (matching the URL param `?tab=list` / the model name `seed_packets`) to remove the name collision. The first tab could become **"Plants"** and the third stays **"Shed"**:

| Current | Suggested |
|---------|-----------|
| Plant Profiles | Plants |
| Seed Vault | Packets |
| Shed | Shed |

This also aligns with the vault profile sub-tab labels ("Packets (N)" / "Plants (N)") already in use.

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

| Priority | Item | Effort |
|----------|------|--------|
| ~~🔴 High~~ | ~~**N1** — Back arrow ignores `from=` param~~ | Done |
| 🟠 Medium | **N3** — Vault profile tab clicks don't update URL | Small — add `router.replace` on tab click |
| ~~🟠 Medium~~ | ~~**N4** — Double `useModalBackClose` in NewTaskModal~~ | Done |
| 🟠 Medium | **U2** — Journal page: no direct "New entry" path | Small — add "+" button to journal header |
| 🟠 Medium | **U3** — `EmptyState` component is dead code | Medium — either adopt everywhere or delete |
| 🟠 Medium | **U4** — Toast inconsistency | Medium — shared Toast component |
| 🟡 Low | **N2** — `journal/new` back button has no label | Trivial — add text |
| 🟡 Low | **N5** — Shopping list "← Back" is generic | Small |
| 🟡 Low | **U1** — FAB menu capitalization + sub-screen sub-labels | Small |
| 🟡 Low | **U5** — Double `<h1>` on detail pages | Small |
| 🟡 Low | **U6** — Weather hardcoded to "Vista, CA" | Trivial |
| 🟡 Low | **U7** — Shopping list empty state missing Add button | Trivial |
| 🟡 Low | **U8** — First-run tip dismisses permanently | Small |
| 🟡 Low | **U9** — Vault tab naming confusion | Small — rename two tab labels |

---

## Out of scope

- Schema or RLS (governed by Laws of the Vault).
- Changing redirect rules unless explicitly requested.
- Adding or removing FAB options; only clarity and discoverability of existing flows.
