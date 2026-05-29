# Ship A — Plants Tab + FAB Consistency

> **CORRECTION 2026-05-28:** Top-level tab renamed "Plants" → "Library" + reordered Home / Library / Garden / Vault / Calendar / Journal (Library now precedes Garden). AddVarietyForm submit CTA "Save to Plants" → "Save to Library". Original Ship A landed with "Plants" label + Home/Garden/Plants order; corrected post-dogfood. See ROADMAP §6 2026-05-28 Ship A correction note for rationale.
> **Status:** Plan-of-record. Awaiting Q1+Q2 lock + greenlight before code.
> **Anchor:** [.claude/plans/ia_restructure_discussion.md](ia_restructure_discussion.md) §§1, 4, 5, 7. Scope per chat brief 2026-05-28.
> **Scope:** pure UI restructure — no schema, no groups, no Garden merge.

## 1. Audit summary (current state)

**Bottom nav** ([BottomNav.tsx](../../src/components/BottomNav.tsx) + [navItems.tsx:111-117](../../src/components/navItems.tsx:111)) — 5 tabs: Home / Vault / Garden (`/garden?tab=active`) / Calendar / Journal. Custom inline SVG icons. Container `flex justify-around h-16 max-w-lg mx-auto px-2`. `xl:hidden` (Sidebar takes over on desktop). Active = `text-emerald`.

**Sidebar** ([Sidebar.tsx](../../src/components/Sidebar.tsx)) — same `primaryNavItems` source, rendered as left-column nav on `xl:` widths only. Adding a Plants item to navItems flows to both surfaces automatically.

**Vault route** (`/vault`) — single `VaultPageContent` ([VaultPageContent.tsx:1](../../src/app/vault/VaultPageContent.tsx:1)) with `viewMode: "grid" | "list" | "shed"` ([line 148](../../src/app/vault/VaultPageContent.tsx:148)):
- `"grid"` = **Library** (plant profiles encyclopedia, default view)
- `"list"` = **Packets** (seed inventory; handled by [VaultPacketWing.tsx](../../src/app/vault/components/VaultPacketWing.tsx))
- `"shed"` = **Shed** (supply inventory; handled by [VaultShedWing.tsx](../../src/app/vault/components/VaultShedWing.tsx))

URL params: `?tab=grid|list|shed` map 1:1 to viewMode. Legacy `?tab=active|plants` also resolve to `"grid"` ([line 140](../../src/app/vault/VaultPageContent.tsx:140)). 3-tab switcher at [lines 976-1003](../../src/app/vault/VaultPageContent.tsx:976) drives `setViewMode` + `router.replace`.

**Add Variety inline button** ([VaultPageContent.tsx:1034-1042](../../src/app/vault/VaultPageContent.tsx:1034)) — toolbar button rendered only in "grid" mode; opens standalone `<AddVarietyModal>` ([line 1897](../../src/app/vault/VaultPageContent.tsx:1897), [AddVarietyModal.tsx](../../src/components/AddVarietyModal.tsx)). Modal owns form state, validation, Supabase insert, background enrichment. No FAB entry today.

**FAB menu** ([UniversalAddMenu.tsx:135-203](../../src/components/UniversalAddMenu.tsx:135)) — 5 main chips: Add Seed Packet / Add Plant / Add to Shed / Add Task / Add Journal. Path Y refactor (2026-05-20 `bee5338`) extracted `SeedPacketForm` / `SupplyForm` / `TaskForm` / `JournalEntryForm` as named exports embedded inline. `UniversalAddMenuScreen` union covers `main | add-plant | add-plant-manual | add-plant-from-vault | seed | shed | task | journal`. Context activeModal type ([UniversalAddContext.tsx:5](../../src/contexts/UniversalAddContext.tsx:5)): `"seed" | "shed" | "plant" | "task" | "journal" | null`.

**e2e specs** — zero references to `tab=grid|tab=list|/plants|Library|Add Variety` (grepped). Smoke + auth + journal + vault-add-seed + vault-profile-edit specs all avoid the Library URL surface. **No e2e rewrites required for Ship A.**

**Other code paths referencing `/vault?tab=grid` or `/vault?tab=list`** — only [VaultPageContent.tsx](../../src/app/vault/VaultPageContent.tsx) (own logic), [VaultPacketWing.tsx](../../src/app/vault/components/VaultPacketWing.tsx) (own clear-filters return path), and [vault/packets/page.tsx](../../src/app/vault/packets/page.tsx) (legacy `/vault/packets` → `/vault?tab=list` redirect). No external surfaces deep-link `?tab=grid` from outside Vault.

## 2. Proposed changes (Ship A scope)

**Implementation strategy: pathname-aware delegation, NOT a full Wing extraction.**

Rationale: extracting a `VaultLibraryWing` peer to VaultPacketWing/VaultShedWing is a 3–4h structural refactor of deeply interlocked state (search query shared across grid/list, gridFilters/listFilters, batch select per mode, AddVarietyModal, refine modals). The refactor adds zero user-visible value beyond what pathname-routing achieves. **Defer the Wing extraction to a separate cohesion chunk** post-Ship A (logged as a 🟣 parked refactor in ROADMAP §4). Ship A keeps Library rendering inside VaultPageContent and routes the new `/plants` URL into the same component with a `surface: "vault" | "plants"` signal. Saves ~3h + de-risks the user-visible UI ship.

**(a) Bottom nav + Sidebar → 6 tabs.**
- Add `SproutIcon` to [navItems.tsx](../../src/components/navItems.tsx) (inline 24×24 stroke-currentColor SVG matching the existing icon family — Lucide Sprout shape, flat monochromatic per VISION §8 chrome convention).
- `primaryNavItems` reorder per IA discussion §1.1: `Home / Garden / Plants / Vault / Calendar / Journal`.
- Plants entry: `{ href: "/plants", label: "Plants", Icon: SproutIcon }`.
- Garden entry preserved as `/garden?tab=active` (Ship B will rewrite when merge lands).
- BottomNav stays `flex justify-around max-w-lg mx-auto px-2`. With 6 items and `min-w-[64px]`, each tab is ~64px wide (matches existing tap target). On the narrowest phones (~360–390px wide), Tailwind's `min-w` may overflow; mitigate via responsive label hiding: hide the `<span>{label}</span>` on phones <412px wide using `hidden xs:inline` (custom breakpoint), OR keep labels on by default and let Tailwind flex shrink the gap — pick at impl time after first render check. Per IA discussion §1.1, recommended treatment: icons-only on phones <412px, icons+labels on tablet+. Anchor: VISION §8 chrome icon style.

**(b) New `/plants` route — thin wrapper around VaultPageContent.**
- Create `src/app/plants/page.tsx` mirroring [/vault/page.tsx](../../src/app/vault/page.tsx) shell (`VaultProvider` + dynamic VaultPageContent with `surface="plants"` prop OR pathname detect).
- Decision: **pathname detect via `usePathname()` inside VaultPageContent**, not a prop. Cleaner — VaultPageContent already consumes pathname-aware logic (`useSearchParams`, `router.replace`). Single source of truth, no prop drilling.
- VaultPageContent surface detection: `const surface = pathname.startsWith("/plants") ? "plants" : "vault"`.

**(c) Vault tab switcher — Library tab removed on `/vault`; 3-tab → 2-tab.**
- Lines [976-1003](../../src/app/vault/VaultPageContent.tsx:976) tab switcher: gate the Library tab button render with `surface === "vault" ? null : ...` (i.e. hide Library button entirely on `/vault`). Show only Packets + Shed tabs.
- On `/plants`: hide the entire 3-tab switcher row (no tabs — Plants is single-mode). The grid renders directly.
- `getInitialViewMode()` ([line 132](../../src/app/vault/VaultPageContent.tsx:132)) becomes surface-aware:
  - surface=plants → always return `"grid"` regardless of `?tab=` param.
  - surface=vault → `?tab=list` → `"list"`; `?tab=shed` → `"shed"`; everything else → default `"list"` (NEW DEFAULT — was `"grid"`). Legacy `?tab=grid|active|plants` triggers redirect (see §4).

**(d) URL operations within VaultPageContent become surface-aware.**
- `router.replace("/vault?tab=grid", ...)` calls (sow filter clears, tab switches) → if surface=plants, replace with `/plants?...`; if surface=vault, NEVER routes to `?tab=grid` (Library button is gone).
- All grid-related `router.replace("/vault?tab=grid&sow=...")` etc. become `router.replace("/plants?sow=...")` when surface=plants.
- Packets/Shed URL ops stay on `/vault?tab=list|shed` as today.

**(e) FAB menu — `+Add Variety` chip at top.**
- Extend `UniversalAddMenuScreen` ([UniversalAddMenu.tsx:14](../../src/components/UniversalAddMenu.tsx:14)) with `"variety"`.
- Extend `UniversalAddModal` ([UniversalAddContext.tsx:5](../../src/contexts/UniversalAddContext.tsx:5)) with `"variety"`.
- Add `openVariety()` callback to context + handler on activeModal.
- Add new "Add Variety" main-screen chip at TOP of the FAB menu (above Add Seed Packet) per IA discussion §1.3 (encyclopedia adds first; Title Case label `Add Variety` per VISION §8 casing rule).
- Chip icon: `ICON_MAP.Plant` or `ICON_MAP.Tree` — pick at impl time matching the existing Library card affordance. Sub-copy: `Save to your plant encyclopedia` (sentence case per VISION §8).
- Extract `AddVarietyForm` from [AddVarietyModal.tsx](../../src/components/AddVarietyModal.tsx) as a named export (mirrors `TaskForm` / `JournalEntryForm` / `SupplyForm` / `SeedPacketForm` Path Y extraction).
- Add `"variety"` screen branch in UniversalAddMenu that renders `<AddVarietyForm onClose={...} onBack={goBackToMain} />` inline (in-place sub-screen, matches Path Y).
- Keep `AddVarietyModal` mountable component intact for backward-compat / non-FAB callers (none today, but cheap to preserve).

**(f) Drop inline `+Add Variety` button.**
- Remove the toolbar button + handlers at [VaultPageContent.tsx:1034-1042](../../src/app/vault/VaultPageContent.tsx:1034).
- Remove `addVarietyOpen` state ([line 224](../../src/app/vault/VaultPageContent.tsx:224)) and the inline `<AddVarietyModal>` mount ([line 1897](../../src/app/vault/VaultPageContent.tsx:1897)).
- FAB chip is the single source of truth.

## 3. Files touched

| File | Change | Size |
|---|---|---|
| [src/components/navItems.tsx](../../src/components/navItems.tsx) | Add `SproutIcon` + insert `{ href: "/plants", label: "Plants", Icon: SproutIcon }` in `primaryNavItems`; reorder to Home / Garden / Plants / Vault / Calendar / Journal | S |
| [src/components/BottomNav.tsx](../../src/components/BottomNav.tsx) | Optional responsive label hiding `hidden xs:inline` if 6-tab phone layout cramps; verify first | XS |
| [src/app/plants/page.tsx](../../src/app/plants/page.tsx) | **NEW** — `VaultProvider` + dynamic VaultPageContent shell mirroring `/vault/page.tsx` | XS |
| [src/app/vault/VaultPageContent.tsx](../../src/app/vault/VaultPageContent.tsx) | `usePathname` surface detection; surface-aware `getInitialViewMode` + tab switcher render + URL ops; drop inline Add Variety button + state + mount | M |
| [src/contexts/UniversalAddContext.tsx](../../src/contexts/UniversalAddContext.tsx) | Extend `UniversalAddModal` union with `"variety"`; add `openVariety()` callback | XS |
| [src/components/UniversalAddMenu.tsx](../../src/components/UniversalAddMenu.tsx) | Extend `UniversalAddMenuScreen` with `"variety"`; add `variety` main-screen chip at top; add `variety` screen branch rendering `<AddVarietyForm>` | S |
| [src/components/AddVarietyModal.tsx](../../src/components/AddVarietyModal.tsx) | Extract `AddVarietyForm` as named export (Path Y pattern); preserve standalone modal shell for backward compat | S |
| [src/app/vault/components/VaultPacketWing.tsx](../../src/app/vault/components/VaultPacketWing.tsx) | Update internal `router.replace("/vault?tab=list", ...)` calls — no change required unless surface-aware behavior bleeds in (verify at impl time) | review |
| Wiring callers of `<AddVarietyModal>` outside Vault | None expected (grep confirms no external callers) | — |

**Estimated commit count:** 3 logical commits.
1. **`feat(plants): add /plants route + 6-tab nav (Plants tab promotion, Ship A part 1)`** — files (a), (b), (c), (d) above. Adds Plants tab, /plants route, surface-aware Vault rendering, redirects.
2. **`feat(fab): +Add Variety chip + AddVarietyForm extraction (Ship A part 2)`** — files (e), (f). Moves Add Variety from Vault toolbar to FAB.
3. **`docs(roadmap+vision): Ship A landed — note Wing-extract follow-up + IA chunk 1 close`** — ROADMAP §5 Recently shipped + §6 Decision log + §4 parked refactor (VaultLibraryWing extraction); VISION §8 untouched (no token changes).

## 4. Migration / redirect strategy

**URL redirects (mount-time `router.replace`):**

| Legacy URL | Lands at | Where |
|---|---|---|
| `/vault?tab=grid` | `/plants` (preserves `?sow=`, `?search=`, etc.) | VaultPageContent surface=vault detects `?tab=grid` on mount, `router.replace` to `/plants` with query preserved |
| `/vault?tab=active` | `/plants` (legacy alias) | Same handler |
| `/vault?tab=plants` | `/plants` (legacy alias) | Same handler |
| `/vault?tab=list` | unchanged | — |
| `/vault?tab=shed` | unchanged | — |
| `/vault` (no tab) | `/vault?tab=list` (NEW DEFAULT — Packets becomes the default Vault landing) | `getInitialViewMode` returns `"list"` when surface=vault and no `?tab=` |
| `/vault/[id]` | unchanged (canonical detail route — preserves all existing deep links from Calendar, Home, Garden, household-view, etc.) | — |
| `/vault/packets` | `/vault?tab=list` (already exists at [vault/packets/page.tsx](../../src/app/vault/packets/page.tsx)) | — |
| `/plants/[id]` | NOT created in Ship A (Q5 lock — defer detail-route rename) | — |

**No data migration. No schema changes. No SQL.**

**Backwards-compat:** legacy `?tab=grid|active|plants` redirect lives for ≥2 releases before cleanup chunk. Bookmarks survive transparently.

**Vault default-tab UX shift:** Today, `/vault` (no query) defaults to Library/grid. Post-Ship-A, `/vault` defaults to Packets (`?tab=list`). Rationale: Library exited; the remaining 2 tabs are Packets + Shed; Packets is the more frequently-tapped per usage pattern + earlier in the alphabetical order. This is a user-visible default change that ALL Vault entry points (sidebar, bottom nav tap, deep links without `?tab=`) will land on Packets. Flag in greenlight ask if Syd wants this called out.

## 5. Test plan

**Unit / regression tests:**
- New: `src/components/ia_ship_a_nav.regression.test.ts` (or extend existing `primaryNavItems` regression if one exists) — assert `primaryNavItems` has 6 entries in correct order with Plants between Garden and Vault.
- New: `src/app/plants/route.regression.test.tsx` — smoke that `/plants` mounts VaultPageContent in grid mode, no tab switcher, no inline Add Variety button.
- New: `src/app/vault/surface_aware.regression.test.tsx` — `/vault?tab=grid` mount redirects to `/plants`; `/vault` (no tab) defaults to Packets list view; Library tab button absent from Vault switcher.
- New: `src/components/UniversalAddMenu_variety.regression.test.tsx` — main-screen has 6 chips with `Add Variety` at top; tapping it renders `<AddVarietyForm>` sub-screen; Back returns to main; submit calls the Supabase insert + closes menu.
- Existing tests: full `npm run test:run` must stay green (387/387 baseline per CLAUDE.md). Touch points that could regress: `UniversalAddMenu.*.test.tsx` (chip count changes), VaultPageContent legacy URL handling, any AddVarietyModal direct mount tests.

**Build:**
- `npm run build` clean — catches TS errors on the `surface` discrimination + `UniversalAddMenuScreen` union widening + `UniversalAddModal` union widening.

**E2E:**
- Zero e2e rewrites required for Ship A (confirmed via grep — no spec references `tab=grid|Library|Add Variety|/plants`). If any spec navigates `/vault` and asserts initial content, the new Packets-default might surface; verify via `npx playwright test` at impl time but expect green.

**No Preview MCP per chat brief HARD-RULE.** Visual confirmation deferred to Syd's phone dogfood.

**Manual dogfood checklist for Syd (post-ship phone verification):**
- [ ] Bottom nav: 6 tabs render on phone width; tap Plants → lands on `/plants` with Library content (gallery cards); tap Vault → lands on `/vault?tab=list` (Packets); tap Garden → unchanged.
- [ ] `/vault?tab=grid` typed manually → redirects to `/plants`.
- [ ] FAB → Add Variety chip at top → form opens inline → submit creates profile, modal closes, card appears on `/plants`.
- [ ] Inline "Add Variety" button GONE from Library toolbar (no leftover ghost).
- [ ] Existing deep links from Calendar / Home / Garden / Vault profiles all still work (no /vault/[id] breakage).
- [ ] Sidebar (`xl:` desktop) shows 6 nav items in same order.

## 6. Risk + rollback

**Risk register:**

| Risk | Severity | Mitigation |
|---|---|---|
| 6-tab bottom nav cramps phones <412px | Med | Responsive label hide treatment; verify after first dev render. If cramped, drop labels at narrow widths (icon-only) — Tailwind `hidden xs:inline` or `text-[10px]` shrink. |
| Surface-aware logic in VaultPageContent leaks (e.g. clears wrong filter state, redirects wrong URL) | Med | Surface signal derived from `usePathname()` once at top of component; pass to lower functions via prop or closure. Tests cover both surfaces. Audit pass 1 verifies every existing `router.replace` site. |
| `UniversalAddMenuScreen` widening breaks existing exhaustive switch checks elsewhere | Low | Union widening is additive; existing `screen === "main" | "add-plant" | ...` blocks unaffected. Build catches if anything switches exhaustively. |
| AddVarietyForm extraction breaks the standalone AddVarietyModal mount used by any non-FAB caller | Low | Grep confirms zero non-Vault callers. Standalone modal shell preserved for safety even if unused. |
| Vault default-tab shift to Packets surprises users mid-session | Low-Med | One-time UX shift; bookmarks survive (legacy URLs redirect); call out in commit message + ROADMAP §6. |
| `/vault?tab=grid&sow=2026-03` deep link from external (e.g. notification, share) loses `sow` param during redirect | Low | Redirect handler preserves all query params except `tab=`. Test covers. |
| Plants tab icon visually conflicts with Garden Leaf icon (both green nature shapes) | Low | Sprout shape distinct from leaf (germinating seedling vs mature leaf). Anchor to VISION §8 chrome icon style — flat monochromatic; Sprout matches existing icon family. |

**Rollback strategy:**
- All 3 commits are atomic and revert cleanly. No DB migration, no destructive ops.
- If Plants tab + 6-nav causes layout regression: revert commit 1 → `/plants` route gone, nav returns to 5 tabs, `/vault` default returns to grid. Users on bookmarks for `/plants` get 404 briefly until revert deploy.
- If FAB chip breaks: revert commit 2 → inline Add Variety button returns; FAB returns to 5 chips.
- Doc-only commit 3 is doc-tier per CLAUDE.md push tier — independent revert.

## 7. Open questions (load-bearing only)

Anchored locks per chat brief: terminology=Groups; Garden tab name stays "Garden"; 2-ship phasing (this is Ship A); no card badge for multi-group; detail routes stay `/vault/[id]`. Q1-Q5 in [ia_restructure_discussion.md §6.2](ia_restructure_discussion.md) all already answered.

**Remaining Ship-A-specific decisions for Syd:**

**Q-A — `/vault` default tab post-Ship-A: Packets or Shed?**
- (A) Packets `?tab=list` (Recommended). Earlier in tab order, more frequent use, less behavioral surprise vs. today's Library default.
- (B) Shed `?tab=shed`. Lower-frequency surface, more surprising default.

Recommend (A). Mostly mechanical but flag in case there's an opinion.

**Q-B — Plants tab icon: new SproutIcon or reuse an existing ICON_MAP?**
- (A) New `SproutIcon` (Recommended) — inline 24×24 stroke-currentColor SVG, Lucide Sprout shape, matches existing nav-icon family (HomeIcon, LeafIcon, etc.). Cohesion-by-aggregation per VISION §8.
- (B) Reuse `ICON_MAP.Tree` or `ICON_MAP.Plant` — both exist in styleDictionary for FAB chips, but they're optical-weight peers of FAB icons not nav icons (different visual register — VISION §8 chrome split).

Recommend (A). Pass 3 sibling-sweep finding: nav icons are a sibling family (5 inline SVGs in navItems.tsx), so the 6th should match the family, not import from a different family. Anchor: VISION §8 chrome icon style.

**Q-C — Responsive label treatment for 6-tab bottom nav: hide labels under 412px, or shrink label `text-xs` → `text-[10px]`?**
- (A) Hide labels under 412px width via `hidden xs:inline` (Recommended). Cleanest treatment, matches Apple/Material patterns for tight nav. Icons remain plain meaning.
- (B) Shrink to `text-[10px]`. Keeps labels but risks readability + visual noise at small sizes.

Recommend (A). Anchored in IA discussion §1.1. Verify at impl time — may end up that 6 64px tabs fit fine at 412px+ and only the narrowest phones need this treatment.

**Q-D — Plants tab chip Add Variety icon: `ICON_MAP.Plant` or `ICON_MAP.Tree`?**
- (A) `ICON_MAP.Plant` (Recommended) — semantically matches "plant profile" / encyclopedia entry; pairs with "From Vault" Plant icon already used in Add Plant sub-screen.
- (B) `ICON_MAP.Tree` — taller silhouette; used by Add Plant main chip; could imply structural plant.

Recommend (A). Audit pass 3 finding: encyclopedia adds (`Add Variety`) sit at top of menu before inventory adds (`Add Seed Packet`); using `Plant` chip-icon vs `SeedPacket` for the next-row chip preserves the SeedPacket/Plant visual distinction Path Y already locked.

