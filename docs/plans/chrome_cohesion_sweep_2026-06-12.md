# Chrome Cohesion Sweep — 2026-06-12

> App-wide layout/nav/spacing cohesion sweep per Syd's 2026-06-12 brief (Dispatch).
> Worktree `chrome-cohesion-sweep` off origin/main `a2e509b`.

## Audit matrix (current state, pre-fix)

| Surface | Outer px | Top rhythm (main pt + page pt) | First content | Sticky chrome | Skeleton |
|---|---|---|---|---|---|
| Home `/` ([page.tsx:315](../../src/app/page.tsx)) | px-6 | pt-2 + pt-2 = 16px | greeting card | none | Home skel — matches old layout only |
| Library `/plants` (VaultPageContent:1013) | px-6 | pt-2 + pt-0 = 8px | sticky toolbar | top-11 (broken, see F6) | **Home skeleton (wrong component)**; no route loading.tsx; header title EMPTY |
| Garden ([garden/page.tsx:438](../../src/app/garden/page.tsx)) | px-6 | pt-2 + pt-0 = 8px | sticky GroupTabs | top-11, `-mx-6 px-6` | Garden skel: `p-4 md:p-6 max-w-4xl`, h1 bar, 2-col — no match |
| Vault `/vault` (VaultPageContent:1013) | px-6 | **pt-0** (isVault) + pt-0 = 0px | sticky toolbar | top-11, `-mx-6` ×3 (1038/1054/1091) | Vault skel: own sticky top-0, px-4, 2-5-col — no match |
| Shed (VaultShedWing:468 + ShedView:296) | (same) | wing pt-2 + ShedView pt-2 = **16px above cards** (Packets = 8px) | cards | — | — |
| Calendar ([calendar/page.tsx:955](../../src/app/calendar/page.tsx)) | px-6 | pt-2 + pt-2 = 16px | month nav | banner `-mx-6 px-4` (1140) | Calendar skel: `p-4 md:p-6 max-w-4xl` — no match |
| Journal ([journal/page.tsx:527](../../src/app/journal/page.tsx)) | px-6 | pt-2 + pt-2 = 16px | sticky toolbar (550) | top-11 `-mx-6 px-6`; mobile list `-mx-6 px-4` (671); table `-mx-6 px-6` (749) | Journal skel: `p-4 md:p-6 max-w-2xl` — no match |
| Instance `/garden/grow/[id]` | back chip px-4 | pt-2 + pt-4 = **24px to back chip** | back chip | GrowInstanceModal tab bar `sticky top-0` (773) | VaultDetail skel `p-6` — no match |
| Plant profile `/vault/[id]` | px-6 | pt-0 + pt-6 = **24px to back chip** | back chip | AboutTab anchor nav `sticky top-0 z-20` (287) | VaultDetail skel — no match; header title "Vault"; bottom nav highlights **Vault** not Library |
| Packet detail `/vault/packets/[id]` | px-6 | pt-0 + none = **0px to back chip** | back chip | — | inherits /vault loading → grid skel |
| Shed item `/vault/shed/[id]` | p-6 | pt-0 + p-6 = **24px to back chip** | back chip | — | same |

**F6 root cause (header "disappears" on scroll):** `body { overflow-x: auto }` ([globals.css:29](../../src/app/globals.css), commit `3e871cb` 2026-02-13) makes `body` a scroll container, which silently breaks `position: sticky` for every descendant — the global h-11 header, Garden/Vault/Journal toolbars, all of it. Nothing in the app has EVER stuck since that commit. The code already implements Syd's named fallback ("simple sticky thin header"); it just never rendered as designed.

## Canonical values (locks)

1. **Page gutter = `px-2` (8px)** on the six primary list surfaces (Home, Library, Garden, Vault, Calendar, Journal). Syd lock 2026-06-12 (4-8px range; 8px chosen — top of range, standard token). Inter-card spacing + per-card padding untouched per the same lock. Detail pages (instance px-4, profile/packet/shed-item px-6) keep their reading-width gutters — flagged for Syd as a follow-up question, NOT changed here. Cite: VISION §4 P7 cohesion; NORTH_STAR "No duplicate paths" (one gutter primitive across list siblings).
2. **Top rhythm: `main` owns 8px (`pt-2`) globally; page wrappers contribute `pt-0`.** Kill the `isVault ? pt-0 : pt-2` special case in AuthGuard (drift-prone per-route conditional; Library vs Vault currently differ on the SAME component). Home/Calendar/Journal page `pt-2` → `pt-0`. Shed: ShedView root `pt-2` becomes non-embedded-only (kills the double-gap; Shed cards align with Packets). Result: every list surface's first block rests 8px below the header. Cite: NORTH_STAR §2 (predictable chrome = less load).
3. **Back-chip rhythm: 16px below header** (main pt-2 + page pt-2) on every detail page. Instance pt-4→pt-2; profile pt-6→pt-2; packet detail +pt-2; shed item p-6→px-6 pb-6 pt-2. Unframed chevron back per VISION §8 chrome-control framing (unchanged visually — placement only).
4. **Sticky restoration:** remove `overflow-x: auto` from `body` (keep `html` rule — root overflow propagates to the viewport and does not break sticky). Restores the designed sticky header + toolbars = Syd's authorized fallback for F6. The full iOS large-title collapse is DEFERRED (implementation-heavy; needs per-page title duplication + scroll-linked animation — aesthetic call for Syd once the fallback is visible on-device).
5. **Sticky offset corrections** (consequence of restoration): VaultProfileAboutTab anchor nav `top-0`→`top-11`; GrowInstanceModal tab bar `top-0`→`top-11` in page variant only (modal variant keeps top-0 — its scroll container is the dialog). PageSkeletons rewritten with top-11.
6. **Nav truth: `/vault/[id]` belongs to Library.** `isPlantProfilePath()` helper in navItems; BottomNav/Sidebar highlight Library on profile pages, Vault on /vault + packets/shed/import/etc. `getPageTitle`: `/plants` → "Library", `/vault/<uuid>` → "Library".
7. **Skeletons mirror the loaded layout 1:1** (new px-2/pt-0 values): rewrite PageSkeletonHome/Garden/Vault/Journal/Calendar; new PageSkeletonLibrary (single inert tab + toolbar + 2-col photo grid); PageSkeletonVaultDetail → back-chip + hero mirror (max-w-2xl), used for instance + profile + packet/shed detail in getSkeletonForPath; add `/plants` mapping + `src/app/plants/loading.tsx`; replace the centered "Loading…" text fallbacks in plants/page.tsx.
8. **Edit modal canon: photo CTA at TOP, label "Edit Photo"** (Syd lock; "Add Photo" stays for the no-photo state — semantic, not drift). EditGrowModal: move photo button above Date planted. vault/[id] edit modal: "Change Photo"→"Edit Photo".
9. **Edit modal subtitle: stacked italic variety** (VISION §8 variety lock applied to the modal header slot per Syd's explicit unify ask — supersedes the "modal body copy stays inline" carve-out for this slot only). Name line `text-sm text-neutral-500 mt-0.5`; variety line `text-sm italic text-neutral-600` (anchors the §8 list-row token). Dialog BODY copy (Archive/Delete confirm sentences) keeps inline `Name (Variety)` per §8.
10. **PO Import chrome follows mode** (f5f80b8 pattern): error copy "No seed items…" / fallback `"Imported seed"` / tips copy get `addPlantMode` branches. Extraction/data plumbing untouched.

## Compound-conditional / Pass-2 dependencies (the f5f80b8 class)

Every `-mx-6` that mirrors the page `px-6` flips with it:
- garden:439 `-mx-6 px-6` → `-mx-2 px-2`
- journal:550 `-mx-6 px-6` → `-mx-2 px-2`
- journal:671 `-mx-6 px-4` → removed (cards inherit page px-2 — that wrapper IS a page-gutter override, not card padding)
- journal:749 `-mx-6 px-6` → `-mx-2` + keep `px-6` (bordered card; internal padding = per-card, untouched)
- calendar:1140 `-mx-6 px-4` → `-mx-2 px-4` (full-bleed banner preserved)
- VaultPageContent:1038/1054/1091 `-mx-6 …` → `-mx-2` (+ inner `px-6`→`px-2` where it mirrors the gutter)
- VaultProfileAboutTab:287 `-mx-6 px-6` — profile keeps px-6 → unchanged (only top-0→top-11)
- PlantingForm:547 `-mx-6` — modal-internal (mirrors modal px-6, not page) → unchanged
- `isVault` (AuthGuard:98) read at :244/:338 only → both flip to unconditional pt-2; no other readers (grepped)
- `body{overflow-x}`: no JS reads body.scrollLeft/scrollX horizontally (grepped); wide tables have their own `overflow-x-auto` wrappers (journal:749, schedule)
- Regression tests grep source strings: editGrowModal.regression.test.ts expects "Edit Photo" (still present), editModalFooter.layout.test.ts expects footer classes (untouched). e2e has no assertions on changed strings (grepped old + new forms).

## ADJACENT findings (named, not fixed here)

- journal:675 mobile month-section headers `sticky top-11 z-10` will pin BEHIND the journal toolbar (z-30, opaque) once sticky works — labels vanish while pinned. Needs a measured offset or de-stickying; aesthetic call → report to Syd.
- `getNavSection` (navSectionClear.ts) returns "home" for `/plants` — filter-clear semantics gap, behavioral not visual → report, defer.
- iOS PWA safe-area: top-11 offsets assume header height 44px; with non-zero `safe-area-inset-top` (iOS standalone) sticky toolbars would underlap. Pre-existing; Syd is Android-primary → note only.
- Detail-page gutters stay px-6/px-4 while list surfaces go px-2 — Syd question queued.

## Files

globals.css · AuthGuard.tsx · navItems.tsx · PageSkeleton.tsx · plants/page.tsx · plants/loading.tsx (new) · garden/page.tsx · journal/page.tsx · calendar/page.tsx · page.tsx (home) · VaultPageContent.tsx · ShedView.tsx · VaultProfileAboutTab.tsx · GrowInstanceModal.tsx · garden/grow/[id]/page.tsx · vault/[id]/page.tsx · vault/packets/[id]/page.tsx · vault/shed/[id]/page.tsx · EditGrowModal.tsx · PurchaseOrderImport.tsx

## Audit log

- **Pass 1 (factual):** every line cite above verified by direct read this session (worktree @ a2e509b). `git log -L` confirms body overflow origin (3e871cb). isVault readers = 2 (grep). -mx-6 inventory = 10 sites (grep, full list above). Sticky inventory = 11 sites (grep, full list above). Re-run after plan revisions: clean.
- **Pass 2 (concerns hunt)** — categories: state transitions (none — pure layout/copy), compound gates (the -mx-6/isVault/sticky-offset table above), mobile-vs-desktop (px-2 applies at all breakpoints per P9 one-commit rule; desktop polish pass deferred per P9), null/empty states (skeletons + empty states inherit page wrapper — expand fine), RLS/auth (none), cohesion-by-aggregation (all new values anchor existing tokens: px-2/pt-2 standard Tailwind steps, top-11 = existing header height, italic variety = §8 token, teal/emerald untouched), persona walk (Walter: sticky header restores persistent orientation he never had — biggest win; Maya: denser grid from px-2 = more content per screen; Sydney: one gutter/rhythm primitive across siblings; Aria/Sam: no new complexity, calmer skeletons that don't shift). Clean after revision (sticky-offset corrections folded in).
- **Pass 3 (sibling sweep):** all -mx-6 siblings enumerated; all sticky-top siblings enumerated; all four detail pages' back chips normalized together (not just the two Syd named); both PO entry modals (PhotoImport fixed in f5f80b8, PO Import here); e2e + unit greps clean (BLOCKING: none; ADJACENT: journal:675, getNavSection — logged above).
- **Pass 4 (lock hygiene):** VISION §8 chrome-control framing (back chips unframed — preserved), §8 variety stacked-italic (extended to modal subtitle per Syd's explicit ask — supersession named, not silent), §8 single-state tab-slot (Library skeleton renders the inert tab), emerald tokens untouched, FAB-form submit saga untouched, 2026-06-11 ships (pencil edit, photo import f5f80b8, form parity) untouched — verified no overlapping lines.

---

## Amendment — Finding 10: empty-hero picture-box treatment (Syd dogfood 2026-06-12, post-cd738d3)

**Scope (Syd, tightened twice):** the empty-state treatment INSIDE the picture box only. Card-level chrome (green border, sizing, padding) explicitly untouched. Canonical = Library's picture box: placeholder PNG fills the container on white, no grey inset box.

**Audit (all four gallery surfaces + list rows):**

| Surface | Empty picture-box today | Verdict |
|---|---|---|
| Library gallery ([SeedVaultView.tsx:1040](../../src/components/SeedVaultView.tsx)) | `PlantImage fill` fallback — PNG fills box, `bg-white` | **CANONICAL** |
| Garden grid ([GardenView.tsx:1152](../../src/components/GardenView.tsx)) | grey `bg-neutral-100` field + small white w-12 `PlantPlaceholderIcon` box centered | **FIX** — the grey-inset look Syd flagged (Tuberose card) |
| Packets gallery ([PacketVaultView.tsx:673](../../src/components/PacketVaultView.tsx)) | `bg-white` box + centered w-16 icon (white-on-white — container invisible) | OK — no grey-inset issue; icon-scale difference vs Library noted as cosmetic, out of tight scope |
| Packets list row (:784) | white-on-white w-10 | OK |
| Shed grid ([ShedView.tsx:503](../../src/components/ShedView.tsx)) | `/shed-sack.png` fills the box (`object-cover`); `ShedSupplyIcon` only on load-error | OK — fills-box pattern, content-icon asset per VISION §8 chrome/content split |
| Garden list row ([GardenView.tsx:1253](../../src/components/GardenView.tsx)) | `PlantPlaceholderIcon sm` exactly fills its w-10 thumb box | OK — no inset (icon == container size) |

**Fix:** GardenView grid empty branch → `<PlantImage imageUrl={null} alt="" fill variant="neutral" />` — reuses the exact component Library renders (NORTH_STAR "No duplicate paths"; calm-aesthetic cite: placeholder must not shout louder than the photo state it replaces). One file + import.

**Pass 1:** PlantImage fill fallback = `absolute inset-0 … rounded-xl bg-white` + PNG `object-contain p-1`; parent at :1148 is `relative` ✓; badges/selection overlays render after the branch, unchanged stacking ✓. **Pass 2:** photo-error path routes through `failedThumbUrls` → same empty branch ✓; block comment inside the ternary parens is valid JS ✓. **Pass 3:** gardenView.regression.test.ts asserts only the GroupTabs pill shape — untouched; no other test references the branch. **Pass 4:** VISION §8 plant-placeholder token (bg-white container, /plant-placeholder.png) is exactly what PlantImage implements ✓.
