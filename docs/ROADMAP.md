# Garden Tracker — Roadmap

> **Purpose:** Single source of truth for *where we are* and *what's next*. Updated at the end of every session by Claude. Read this at session start (after CLAUDE.md and VISION.md) to know exactly where to pick up.
>
> **Conventions:**
> - 🟢 Active / in progress
> - 🟡 Planned, ready to execute (clean-pass plan exists, awaits user greenlight to build)
> - 🔵 Designed but not yet planned (decisions made; needs plan-audit before build)
> - 🟣 Awaiting design / Phase 2-7 work
> - ⏸️ Parked — blocked or deferred (with WHY noted)
> - ✅ Shipped

---

## 1. Current focus

**As of 2026-05-12 — `a7dadb7` verified clean from phone screenshots; 4 commits still need prod verification (desktop + phone swipe); new feedback batch from user landed (12 items triaged).**

### Verified clean

🟢 **`a7dadb7` (Calendar default-collapse)** — both phone screenshots from user (2026-05-12) show "Overdue (42 tasks)" / "Overdue (41 tasks)" collapsed at top with Upcoming Tasks expanded below. Confirmed working.

### Still TBD verification

- **`8624c8d` B2** (desktop ≥1280px two-column) — user hasn't been on desktop browser yet
- **`e61ffdc` B1** (desktop ≥1280px sidebar) — user hasn't been on desktop browser yet
- **`cea21e0` phone swipe** (singleton row swipe-left=complete / swipe-right=snooze) — gesture, not visible in static screenshot
- **`f77507a` phone swipe** (consolidated row swipe-to-confirm) — also needs precondition: repeat overdue group present

### New feedback batch (2026-05-12) — triaged

**🔵 Current build (chunk 3.9 — see §3.9):**
1. Calendar "Upcoming Tasks" master expand-all / collapse-all toggle w/ smooth arrow swap + smooth content animation
2. Phone calendar month-nav arrows redundant w/ swipe — hide on phone, keep desktop *(aesthetic — needs user input)*
3. Garden card spacing fix *(aesthetic — user needs to point at what feels off)*
4. Bag (shopping list) icon swap *(aesthetic — needs user pick from options)*
5. Journal gallery card format: structured header + description + variety/location tags *(aesthetic — discuss structure)*
6. Journal search
7. Plant profile section — no-AI-data fallback *(needs current-behavior look + empty-state copy decision)*

**🟣 Future (added to §4 parked):**
- Welcome instructions — ⚠️ conflicts with VISION §10 "empty-by-default IS the onboarding"; needs clarification before triage (#8)
- Gallery vs table view purposes — Phase 5 page-goals discussion (#9)
- Journal growing-indicator tags (flowering, first leaves, etc.) — Phase 3 IA tag schema (#10)
- Vault filter by flower color / perennial / fruit-vs-veggie — Phase 3 IA plant metadata (#11)
- Harvest calculator (season stats, weights, first/last logged) — memory plane / Failure Mode #2; aligns w/ chunk 3.6 plant profile depth (#12)

### Next session focus

- **Awaiting user choice** on which 🔵 current-build item to start (likely #6 Journal search as least controversial, or #4 Bag icon as fastest)
- **B3 (FAB → popover)** still queued after Phase 4+5 desktop verification completes (chunk 3.2)
- **Icon density decision** (parked VISION §11) still parked

See §3 for the full ranked queue.

---

## 2. Design phase status

The full design framework — what was outlined as "what a design phase usually covers."

| Phase | What it answers | Status |
|---|---|---|
| **Phase 1 — Strategy / Vision** | Who is this for, why does it exist, what's it for | ✅ Closed 2026-05-08. Vision statement v4 locked. See VISION.md. |
| **Phase 2 — Jobs-to-be-done** | What is the user trying to accomplish per surface | 🟣 Pending. ~30-60 min focused session. Best done before designing new pages from scratch. |
| **Phase 3 — Information Architecture** | Data model, entity relationships, mental model | 🟣 Pending. **Required before:** beds-as-first-class implementation, lifecycle batch tracking work, plant database moderation. |
| **Phase 4 — Navigation & sitemap** | Top sections, paths between them, audit current navigation | 🟣 Pending. |
| **Phase 5 — Page goals & flows** | Per-page purpose statements, primary actions | 🟣 Pending. **Best for:** redesigning pages that the user has flagged as confusing (plant profile, home page, etc.) |
| **Phase 6 — Design system completion** | Typography, spacing, button hierarchy, modal patterns, component conventions | 🟣 Pending. Some tokens already in VISION.md §8. |
| **Phase 7 — Edge cases & accessibility** | Empty states, errors, offline, screen readers, mobile vs desktop | 🟣 Pending. |

**Important:** We don't have to do all phases sequentially before building. We pick up a phase when the build work surfaces a question that phase needs to answer.

---

## 3. Build chunks (epics)

Major work items, ranked by recommended order. Each has a status, brief scope, and dependencies.

### 3.1 ✅ Calendar fatigue batch — SHIPPED 2026-05-08

**Status:** Built, tested (340/340), pushed to `main` (commit `2697f04`), Vercel deployed. Awaiting user prod-verification.

**What shipped:**
1. **Day header visual treatment** — per-date headers now `text-sm font-semibold text-black/85` + `bg-emerald-50/40` tint. Reads as section dividers without competing with content.
2. **Overdue consolidation** — repeated overdue tasks (e.g. daily copper fungicide × 14 days) collapse into a single summary row showing `{count} overdue · oldest {date}` with chevron-expand. Group key = `(title, plant_profile_id, grow_instance_id, user_id)`. Singletons render flat (no fake nesting). Group key includes `user_id` so household members' identical tasks don't merge in family view.
3. **"Select all in group" button** on consolidated rows — reuses existing long-press batch-select flow (selectMode + selectedIds + batchMenuOpen). No parallel checkbox UI introduced.

**Plus (folded in):** calendar grid adjacent-month pad cells switch from `bg-black/[0.02]` to `bg-neutral-100` for clean "not part of this month" cue.

**Deferred from original plan:** Undo toast on bulk action. New UI pattern; deserves its own decision in a future design-system pass.

**Captured signals:** Row primitive ("bubbles vs. list") flagged by user → parked in VISION.md §11. Re-evaluate after prod verification.

**Source:** VISION.md §7 (Calendar surface), §11 (Calendar task fatigue parked decision).

---

### 3.2 🟢 Phase 4 + 5 Desktop Layout Pass

**Status:** Active. Milestone B1 shipped 2026-05-11 (`e61ffdc`); B2–B5 queued.

**Frame:** Bundles three entangled VISION.md §11 items as one coherent pass because they share architecture (sidebar width → main column width → right column → modal anchoring):
1. Desktop calendar oversized + empty horizontal space
2. Bottom nav feels mobile-y on desktop
3. Phone-style modals/sheets centered on wide screens

**Locked decisions (A1–A7 + S1–S5, 2026-05-11):**
- Breakpoint: **`xl:` (1280px)** — iPad-landscape stays on mobile-style layout.
- Sidebar appears on **every page** in this pass; right-column treatment is **Calendar-only**. Other pages stay single-column main until Phase 5 designs their layouts.
- Sidebar: 240px expanded ↔ 64px collapsed, chevron toggle at top-right, state persisted to localStorage. Active state = emerald left-edge accent bar + `bg-emerald-50` tint. Icons identical to BottomNav (reuse via new shared `navItems.tsx` module). Small "Garden Tracker" wordmark in emerald-700 at top.
- Top header at `xl:`: slim — keeps cloud-sync, page title, household toggle. Shopping list / Help / Settings / Feedback move to sidebar footer.
- FAB stays viewport-anchored (no offset by sidebar). FAB → popover treatment is B3.
- Modals on desktop: B4 will convert phone bottom-sheets to centered modals with backdrop (capped width).

**Milestone breakdown:**

| # | Milestone | Scope | Status | Effort |
|---|---|---|---|---|
| **B1** | App shell + sidebar nav at `xl:` | New `Sidebar.tsx` + shared `navItems.tsx`; `AuthGuard.tsx` wraps shell in `xl:flex` w/ sidebar; `BottomNav.tsx` gains `xl:hidden`. | ✅ Shipped 2026-05-11 (`e61ffdc`) | M |
| **B2** | Calendar two-column | Calendar page wraps grid + task list in `xl:flex xl:gap-6` two-column layout. Left col 640px sticky at `top-12`; right col `xl:flex-1 xl:max-w-[720px]`. Mobile unchanged. | ✅ Shipped 2026-05-11 (`8624c8d`) | S |
| **B3** | FAB menu → popover at `xl:` | FAB add menu becomes anchored popover at `xl:` (not centered card). Mobile unchanged. | 🟡 Next (after B2 prod verification) | S |
| **B4** | Modals/sheets desktop treatment | NewTaskModal, QuickLogModal, snooze sheet, batch sheets get `xl:` centered-modal-with-backdrop variant. Width cap. Mobile = unchanged. New design-token sanity check needed (backdrop opacity, modal rounding, matches FAB transition language). | 🔵 | M |
| **B5** | Polish + cross-page audit | Walk all five pages at `xl:`; flag hardcoded `max-w-*` containers that read off-center in the sidebar-offset main column; capture Phase 5 questions for other pages' eventual right-column content. | 🔵 | S |

**Risks tracked:**
- Sidebar at `xl:` only — if iPad-landscape users want it, easy follow-up to lower the breakpoint.
- Right column on Calendar reuses the existing dense task list; density-fatigue may resurface in the narrower column. Follow-up if so (VISION.md §11 row-primitive park is the candidate fix).
- Modal centered-with-backdrop at `xl:` is a new pattern in this codebase — B4 will need a quick design-token decision before build.

**Out of scope (don't expand):**
- Phase 5 page-goals work for Home / Vault / Garden / Journal right-column content.
- Beds-as-first-class (Phase 3) — see §3.4.
- Floating-months grid with fade-slide transitions — confirmed ornamental for a utility app; rejected.

**Source:** VISION.md §11 (parked desktop layout, FAB modal placement), §12 (recent signals 2026-05-08 + 2026-05-11).

---

### 3.3 🔵 FAB consistency batch

**Status:** Decisions surfaced from prior session, awaits user input on canonical choices, then plan-audit-build.

**Scope (3 changes bundled):**
1. FAB main button vs. submenu icon style consistency — canonical stroke weight; whether FAB main is intentionally heavier or matches submenu
2. Save/Cancel button consistency across modals — NewTaskModal stacked vs. QuickLogModal side-by-side; pick one canonical (default rec: side-by-side, Cancel-left, Save-right, `bg-emerald` brand token)
3. Cross-view consistency — Vault Plant Profiles grid / Garden Active Garden gallery / Garden My Plants list — which is canonical, what should match

**Why second:** Builds momentum on cohesion (Failure Mode #4) without major scope.

**Effort:** S. Each item is small.

**Dependencies:** User decisions on each choice.

**Source:** VISION.md §11 (open decisions).

---

### 3.4 🟣 Beds-as-first-class implementation (Phase 3 IA work)

**Status:** Vision-level decision locked (VISION.md §8). Implementation requires Phase 3 IA session before build.

**Scope:**
- Phase 3 design: data model for `bed` entity, migration plan for existing location strings, page design for bed detail page, plan for updating dependent surfaces
- After Phase 3 design lands: build (M-sized engineering work)

**Why third:** Foundation for many other things — soft-blocks the lifecycle batch tracking (3.5), unblocks soil testing (🕐), unblocks future bed layout (🕐), provides destinations for batch-split workflows.

**Effort:** Phase 3 design (~30-60 min session) + M-sized build (split data model, migration, UI updates).

**Dependencies:** Phase 3 IA design must come first.

**Source:** VISION.md §8 (beds-as-first-class), §11 (Phase 3 deferred items).

---

### 3.5 🟣 Lifecycle / batch-tracking improvements (Failure Mode #1)

**Status:** Major theme. Multiple connected workflows. Needs Phase 3 IA work first (beds), possibly Phase 5 page goals work for the seed-starting flow.

**Scope (multi-part):**
- Growing-batch concept (status, germination rate, batch operations)
- Up-potting workflow (transition tray → individual pots)
- Splitting batch to multiple destinations (3 to bed A, 2 to bed B, etc.)
- Easy cull / kill workflow
- Transfer / give away / trade between users (within trusted circle, with full history)
- Re-finding plants from a 6-week-old batch when ready to harvest

**Why fourth:** Closes the biggest single failure mode. But scope is large; likely multiple commits and sessions.

**Effort:** L. Probably broken into smaller chunks during planning.

**Dependencies:** Beds-as-first-class (3.4) recommended first; possibly Phase 5 page goals for the seed-starting flow.

**Source:** VISION.md §6 (Failure Mode #1), §5 (Lifecycle paths).

---

### 3.6 🟣 Plant profile depth (Failure Mode #2)

**Status:** Surfaced as a failure mode but specific design work pending.

**Scope:**
- Establishment care vs. regular care templates (currently set up manually each time)
- Deeper growing data on profile page (pending more sister feedback)
- Profile-to-history connection clarity (the "where do I see growing history" disorientation)

**Why fifth:** Real user pain (sister specifically), but needs Phase 5 page goals work to scope properly.

**Effort:** M (after Phase 5 design).

**Dependencies:** Phase 5 page goals work for the plant profile page.

**Source:** VISION.md §6 (Failure Mode #2).

---

### 3.7 🟣 Cross-view cohesion / disorientation (Failure Mode #4)

**Status:** Spans multiple surfaces. Partially addressed by 3.3 cross-view consistency batch. Larger work pending.

**Scope:**
- Audit visual language across surfaces (typography, button treatments, card patterns, terminology)
- Audit IA — clear paths between Plant Profile ↔ Growing Instance ↔ Tasks ↔ Journal ↔ Harvest
- Resolve mental-model mismatches (e.g. "where is the plant's history?")

**Why sixth:** This is mostly "fix as we go" rather than one big project. The 3.3 batch addresses surface inconsistency; the IA work is partly addressed by 3.4 + Phase 4 navigation; mental-model fixes will surface as Phase 5 page goals get defined.

**Effort:** Distributed across many sessions.

**Dependencies:** Phase 4 (navigation), Phase 5 (page goals), Phase 6 (design system) all contribute.

**Source:** VISION.md §6 (Failure Mode #4).

---

### 3.8 🟣 Micro-climate triggers (Failure Mode #3)

**Status:** ✅ in scope per VISION.md §9, but requires new infrastructure. Major feature work.

**Scope:**
- User location capture (zip code, hardiness zone, possibly geo)
- Weather data integration (Open-Meteo or similar, free tier)
- Frost-date data + zone-based recommendations
- Weather alert system (alerts not currently built)
- User observation layering for personalized microclimate over time

**Why seventh:** Foundational for fixing sister's "untrusted timing" complaint, but a big lift. Build only after lifecycle and profile gaps are addressed (those have higher daily impact today).

**Effort:** L. Multi-commit feature.

**Dependencies:** Alerts/notifications infrastructure (also not built yet).

**Source:** VISION.md §6 (Failure Mode #3), §9 (micro-climate triggers ✅).

---

### 3.9 🔵 Bug/feedback batch — 2026-05-12

**Status:** Triaged from user feedback batch 2026-05-12. Items 1, 6, 7 ready to plan-audit; items 2, 3, 4, 5, 7 need aesthetic decisions from user first. Will likely ship in 2-3 plan-audit-build cycles rather than a single batch, since the items vary in shape (animation feature vs icon swap vs empty-state copy).

**Scope (7 items):**

1. **Calendar "Upcoming Tasks" master expand-all / collapse-all toggle.** Direct follow-on to shipped `a7dadb7` default-collapse. Add a chevron-down icon next to the "Upcoming Tasks" header that, when tapped, expands every collapsed day section (today + overdue + future days) in one motion. Once expanded, swaps to a chevron-up that collapses all. Smooth arrow rotation + smooth content height animation between states. Effort: S. **Aesthetic touch:** animation timing + easing — propose 200ms ease-out (matches existing transition language in VISION §8) but confirm with user.
2. **Phone calendar month-nav arrows.** `← May 2026 →` arrows at top of grid are redundant w/ swipe gesture on phone. User asked to remove them on phone (keep desktop). Effort: XS. **Aesthetic decision:** does user want `lg:hidden` (phone-only hide), or hide on phone AND desktop, or keep both? Discoverability vs density tradeoff. Need user input.
3. **Garden card spacing.** User flagged spacing looks "weird" on garden gallery cards (perennial badge + image + name + planted-date + "1 journal" pill). Effort: XS. **Aesthetic discussion:** user needs to point at what specifically feels off (intra-card padding? grid gap? pill positioning? card height?).
4. **Bag (shopping list) icon swap.** User dislikes current bag icon in header. Effort: XS. **Aesthetic decision:** user pick from options (shopping cart, basket, checklist, list-with-check). Will sketch 2-3 candidates.
5. **Journal gallery card format.** User wants structured layout: clear header w/ relevant info (date + type) + description body + variety/location tags. Currently variety pill is mingled with description visually. Effort: S. **Aesthetic discussion:** confirm structure — `[date | type icon+label]` header, description below, variety + location pills at bottom? Or different shape?
6. **Journal search.** Add search input to journal page. Effort: S. **Scope decision:** which fields are searched? Description only, or also variety/location/type/date? Recommend: full-text across description + variety + location, with type filter as separate control (already exists per "Filter" button in screenshot — verify).
7. **Plant profile no-AI-data fallback.** When AI returns no data for a plant profile section, the section should show a graceful empty state rather than nothing/broken UI. Effort: S. **Needs:** look at current behavior to see what happens today, then aesthetic decision on empty-state copy (retry button? "No info yet" + add-manually CTA? Encyclopedia stub?).

**Why current-build priority:** Items 1, 6, 7 are user-flagged gaps in shipped features. Items 2, 3, 4, 5 are aesthetic polish in active surfaces. None are blocked by Phase 3/4/5 design work.

**Dependencies:**
- Item 1 depends on `a7dadb7` (already shipped). No blockers.
- Item 6 (Journal search) — read existing journal page to find where search input fits; likely no schema change.
- Item 7 — read existing AI-data flow on profile page to understand current state.
- Aesthetic items (2, 3, 4, 5) blocked on user input only.

**Verification strategy:** standard plan-audit-build per item or grouped (3-5 batch per WORKFLOW.md). User prod-verifies on phone after each ship.

**Source:** User feedback batch 2026-05-12. See VISION.md §12 for verbatim signal.

---

### Later (🕐 long-term aspirational, in priority-ish order)

- **Pest / illness ID camera + Q&A + treatment recs.** Likely paid tier. Differentiator.
- **Soil test result tracking.** Pairs with beds-as-first-class.
- **Garden bed layout / spatial design.** After beds-as-first-class lands.
- **Encyclopedia entries integrated with data.** Pest/variety/condition reference, surfaced contextually.
- **Engagement / push content.** Articles, seasonal guides. Off-season retention.
- **Contextual tips on relevant screens.** Inline micro-tips.
- **Plant ID camera.** Only if accuracy is meaningfully better than existing tools.
- **Generic data import (CSV / webhooks).** For users with hardware sensors.

See VISION.md §9 for full status of each.

---

## 4. Parked / blocked items

Items deferred with the reason for the parking. Re-surface when conditions change.

- **Calendar task fatigue (broader than the batch in §3.1)** — Today/Week default window, lazy-load older completions, and other approaches beyond what's in the batch. Parked until the §3.1 batch ships and we see how it feels.
- **Cross-view consistency** between Vault grid / Garden gallery / My Plants list (covered partly by §3.3 FAB consistency batch).
- **Too many places to edit a plant's image** (in `BACKLOG.md`). Audit + consolidate.
- **Sister's additional feedback** — pending. User said she'd get more.
- **Plant database moderation philosophy** — Phase 3 deferred. Concern about user pollution / inappropriate entries. Hybrid (curated canonical + private user extensions + suggestion queue) recommended.
- **Growing instance representation detail** — Phase 3. Now that beds are first-class, the exact relationship needs design.
- **Welcome instructions (2026-05-12 #8)** — User clarified 2026-05-12: "practically nonexistent. that'll be a whole work chunk at the end." So this is its own future chunk, sized as a major build-out, planned for late in the roadmap (after Phase 3/4/5 design + core lifecycle/profile/cohesion work). **Does not conflict** with VISION §10 empty-by-default — welcome instructions are an additive guidance layer (copy, tooltips, first-run walkthrough) ON TOP OF the empty-by-default state, not a replacement for it. Will be promoted to a chunk in §3 when scoping begins.
- **Gallery vs table view purposes (2026-05-12 #9)** — User asked "discuss purposes of gallery vs table view." Phase 5 page-goals work. Belongs in design-phase session when we pick up Phase 5.
- **Journal growing-indicator tags (2026-05-12 #10)** — Tag a journal entry with growing milestones (flowering, first leaves, lost leaves, fruit set, etc.) so user can search/filter to see historical patterns year-over-year. Phase 3 IA work (needs tag schema design). Aligns with VISION memory plane / "what works for me" library. M-sized feature after Phase 3 lands.
- **Vault filter by flower color / perennial vs annual / fruit vs veggie (2026-05-12 #11)** — Improve vault search w/ plant-metadata filters. Phase 3 IA work (needs metadata schema on plant profiles). M-sized feature after Phase 3 lands.
- **Harvest calculator (2026-05-12 #12)** — Per-plant report: total weight harvested, first/last log dates in a growing season, derived stats. Memory plane work; aligns w/ Failure Mode #2 (profile depth) and §3.6 plant profile depth chunk. M-sized after profile work is scoped.

---

## 5. Recently shipped (last ~10)

Most recent first. For full history, use `git log`.

- **2026-05-11 `a7dadb7`** — `feat(calendar): collapse Overdue section by default on load` — single-line removal from the Calendar init effect (line 653: `if (overdueTasks.length > 0) next.add("overdue");`). Overdue now reads "Overdue (N tasks) · Show" on page load (collapsed); today still auto-expands; all other days remain collapsed (existing behavior). Tap-grid-day still switches to single-day mode (preserved). Count badges on collapsed headers were already in the code — they now do the at-a-glance work without spilling rows. Partially unparks VISION §11 "Calendar task fatigue approach" — default-window / collapse-by-default sub-rule locked. -1 LOC. 3-pass plan-audit clean; 370/370 tests pass.
- **2026-05-11 `8624c8d`** — `feat(calendar): two-column layout at xl:1280px (B2 of Phase 4+5)` — Calendar page wraps in a two-column flex layout at `xl:` (≥1280px). Left column: month nav + Plantable widget + calendar grid, locked at 640px wide and sticky at `top-12` so the grid stays visible while the right column scrolls. Right column: task list, `xl:flex-1` with `max-w-[720px]` cap. Below `xl:1280` (phone + iPad-landscape): byte-identical to before. Single-file change to `src/app/calendar/page.tsx` (+9/-2). Sub-decisions D1 (sticky) / D2 (max-w-720) / D3 (gap-6) / D4 (640px) locked from plan-audit. Risk flagged for prod check: at exactly 1280px viewport with sidebar expanded, right col ~328px (narrower than mobile); mitigation path is `xl:w-[600px] 2xl:w-[640px]` if cramped. 370/370 tests. B3 (FAB popover) queued next.
- **2026-05-11 `e61ffdc`** — `feat(shell): desktop sidebar nav at xl:1280px (B1 of Phase 4+5)` — first milestone of the desktop layout pass. At `xl:` (≥1280px), bottom nav hides and a left sidebar appears (240px ↔ 64px collapsible, persisted to localStorage). Five primary nav items reused from BottomNav for cohesion via new shared `navItems.tsx` module. Slim top header at `xl:` keeps cloud-sync + page title + household toggle; shopping list / help / settings / feedback moved to sidebar footer. Below `xl:1280` (phone + iPad-landscape): zero visual change. 370/370 tests. New files: `Sidebar.tsx`, `navItems.tsx`. Modified: `AuthGuard.tsx`, `BottomNav.tsx`. B2 (calendar two-column) queued.
- **2026-05-10 `f77507a`** — `feat(calendar): inline Snooze/Done + apply-all on consolidated overdue rows` — cohesion fix on consolidated overdue group rows. Right side now `[Snooze][Done][Chevron]` on desktop (matches singleton-row button order); mobile swipe-left=complete-all, swipe-right=snooze-all. Bulk actions route through confirmation sheets ("Mark all N as done?" + "Snooze all N tasks"). Swipe logic extracted into reusable `useRowSwipe` hook consumed by both `CalendarTaskRow` and new `ConsolidatedOverdueHeader` component. Transplant→harvest cascade preserved per-task in bulk snooze. Single toast per bulk action. New `groupAction` state kept separate from `selectMode` flow so long-press multi-select stays intact. 370/370 tests (21 new for hook + consolidated header + sheets).
- **2026-05-08 `cea21e0`** — `feat(calendar): swipe-to-act on mobile, inline buttons on desktop (Principle 9)` — first worked example of new operating principle. Mobile swipe-left=complete, swipe-right=snooze; inline buttons hidden via `hidden lg:flex`. Desktop unchanged. Native touch listeners (passive:false), 100px threshold, 8px direction lock. Long-press multi-select preserved. 349/349 tests (9 new swipe assertions).
- **2026-05-08 `0ceb4a0`** — `docs(vision): lock Principle 9 (mobile-first with desktop responsiveness in every commit) + log open desktop issues` — operating principle 9 locked; modal/menu desktop placement logged for separate batch.
- **2026-05-08 `dbaed5f`** — `fix(calendar): hide 'Select all' until consolidated group is expanded` — vertical scan rhythm fix; consolidated row now visually identical in shape to a normal task row (title + count + chevron).
- **2026-05-08 `295635d`** — `fix(calendar): adjacent-month pad cells no longer match selectedDate when both are null` — strict bug exposed by `bg-neutral-100` change; null guard on `isSelected` calc.
- **2026-05-08 `2697f04`** — `feat(calendar): fatigue batch — overdue consolidation, day-header treatment, adjacent-month muting` — three coordinated changes addressing calendar reading fatigue. Repeated overdue tasks collapse to a summary row with expand-on-tap. Per-date headers gain semibold + faint emerald tint. Adjacent-month grid cells switch from near-invisible `bg-black/[0.02]` to `bg-neutral-100`. Reuses existing long-press batch-select for "Select all in group" — no parallel UI. 340/340 tests.
- **2026-05-08 (session close)** — Session transition management framework added to CLAUDE.md (when-to-switch signals, close-out protocol).
- **2026-05-08 `43871a9`** — `docs(framework): add ROADMAP.md + capture user communication patterns in CLAUDE.md`.
- **2026-05-08 `e28d5df`** — `docs(claude): add CLAUDE.md with project lead behaviors required` — orients fresh Claude sessions.
- **2026-05-08 `bee1dc7`** — `docs(vision): commit Phase 1 design phase to VISION.md` — comprehensive Phase 1 close.
- **2026-05-08 `0db8cd8`** — `feat(transitions): FAB transition standard + VISION.md as source of truth`.
- **2026-05-08 `7d3585a`** — `revert: U18 calendar header changes (overstepped without asking)`.
- **2026-05-08 `4536897`** — `fix(visual): batch 1 — three quick visual fixes (U4, U5, U18)` (U18 part later reverted).
- **2026-05-07 `c7e1c44`** — `fix(visual): use bg-white on placeholder container so PNG blends seamlessly (U10 v3)`.
- **2026-05-07 `e54980e`** — `fix(visual): use plant-placeholder.png as the real plant placeholder (U10 v2)`.
- **2026-05-07 `13146cc`** — U14 card spacing.

---

## 6. Decision log

Chronological log of key decisions made during design and build. New decisions append here. *Provides historical context — different from VISION.md (which is current state).*

### 2026-05-12

- **`a7dadb7` verified clean in prod.** User's phone screenshots show "Overdue (42 tasks)" and "Overdue (41 tasks)" collapsed at top of Calendar with Upcoming Tasks expanded below. Default-collapse rule shipping confirmed.
- **New procedural rule locked: "Handling feedback batches."** When user drops a multi-item batch in one message, Claude owns triage into 🔵 current build / 🟣 future phase / ❌ outside scope. Triage gets presented in text (not bundled into a single AskUserQuestion), aesthetic items flagged separately for user input, conflicts with VISION.md surfaced for clarification, ROADMAP + VISION updated immediately, and a single closing question on where-to-start. Captured in CLAUDE.md.
- **New procedural rule locked: "Roadmap maintenance."** ROADMAP.md is a living doc — mark sections done as work progresses, amend chunks when info arrives, move items between buckets. Added a new step **3.5 Final ROADMAP review** to close-out protocol: between mid-session roadmap updates and retrospective scan, walk the full roadmap one more time to catch drift. Captured in CLAUDE.md.
- **Feedback batch 2026-05-12 (12 items) triaged.** 7 items 🔵 current build (new chunk 3.9): Calendar expand-all toggle, phone month-arrow redundancy, garden card spacing, bag icon swap, journal card format, journal search, profile no-AI-data fallback. 5 items 🟣 future / parked: welcome instructions (⚠️ VISION conflict, needs clarification), gallery-vs-table-view discussion (Phase 5), journal growing-indicator tags (Phase 3 IA), vault metadata filters (Phase 3 IA), harvest calculator (memory plane / Failure Mode #2). Each parked item logged in §4 with bucket reasoning.
- **No double-park.** Items 9-12 in the parked list reference existing chunks (Phase 3 IA, Phase 5 page goals, §3.6 plant profile depth) rather than creating duplicate parked entries.

### 2026-05-11

- **Calendar default-collapse rules shipped (`a7dadb7`).** Overdue section now collapsed on Calendar load. Today still auto-expands. Other days remain collapsed (unchanged). Tap-grid-day still switches to single-day mode (preserved). Single-line removal (`if (overdueTasks.length > 0) next.add("overdue");`) from the init effect in `src/app/calendar/page.tsx`. 3-pass plan-audit was clean (Pass 1 flagged a pre-existing race condition involving the separate `completedTasksForMonth` fetch; documented as known follow-up, not in scope per "no while-I'm-at-it scope creep"). -1 LOC, 370/370 tests, clean build.
- **Default-collapse rule set locked (overdue=collapsed, today=open, others=collapsed; tap-grid-day preserves single-day mode; count badges on collapsed headers).** Future-days default was the swing decision: locked as **collapsed** because task fatigue is the failure mode being solved (VISION §6, §11) and count badges already preserve at-a-glance scan.
- **AskUserQuestion bundling pattern caught and corrected.** When introducing a multi-item rule set for the first time, do NOT offer a single "Lock it all (Recommended)" AskUserQuestion — user picks Recommended efficiently but skips per-item digest, which surfaces later as "what do you think?" + interrupts to ExitPlanMode. Either (a) discuss verbally and let her engage per piece, then bundle-lock once she's clearly seen each; or (b) ask separately per sub-decision. Captured in CLAUDE.md and VISION §12.
- **Sidebar icon density flagged (parked widening of FAB icon consistency).** User saw the issue in B1's sidebar: primary nav (24×24 @ 2.0), Shopping list (20×20 @ 1.2), Settings/Feedback (20×20 @ 2.0), Help (text glyph `?`) — four different rendering systems in one component. Same parked decision as VISION §11 "FAB icon style consistency" from 2026-05-08, widened to "App-wide icon density / canonical stroke weight." Awaiting user decision on canonical: stroke 1.2 (recommended — `styleDictionary.tsx` is the larger of the two libraries) or stroke 2.0.

### 2026-05-11 (earlier)

- **Phase 4+5 Desktop Layout Pass — B2 shipped (`8624c8d`).** Second milestone: Calendar page two-column layout at `xl:1280px`. Wrapped existing return in `xl:flex xl:gap-6 xl:items-start` with two child wrapper divs (left 640px sticky + right `flex-1 max-w-[720px]`). Mobile byte-identical. Single-file mechanical wrap of `src/app/calendar/page.tsx` (+9/-2).
- **Sub-decisions locked for B2 (D1–D4):** D1 = sticky left column on desktop (so grid stays visible while task list scrolls — reinforces "primary check-in surface" role from VISION §7). D2 = right-column `max-w-[720px]` (comfortable row line length at 1920+; whitespace to the right is parked space for Phase 5). D3 = `gap-6` (24px, matches existing card-level spacing). D4 = keep 640px left column per A1–A7 / ROADMAP §3.2 (each day cell ~88px).
- **B2 plan-audit ran 4 passes before clean.** Pass 2 surfaced three real misses: (a) worst-case viewport squeeze at 1280px + expanded sidebar → right col ~328px (narrower than mobile); (b) sticky-position smoothness analysis was hand-wavy until math added (header 44 + `pt-2` 8 = 52px natural vs `top-12` = 48px sticky → smooth 4px scroll-then-stick, no jump); (c) loading-state behavior in the empty right col wasn't documented. Pass 3 caught a wording error in Risk 4. Pass 4 clean. Mitigation for Risk 4 parked as fast-follow if prod testing shows cramping at 1280px viewport.
- **Process correction reinforced from session start.** Initial audit attempt stopped at one pass; user flagged that WORKFLOW.md requires looping until findings are clean or immaterial. Re-ran with full discipline. Captured behaviorally — multi-pass audit is the default, not an option.
- **Phase 4+5 Desktop Layout Pass — B1 shipped (`e61ffdc`).** First milestone of the pass: app shell + sidebar nav at `xl:1280px`. Bottom nav hides, left sidebar appears (240px ↔ 64px collapsible, state persisted to localStorage). Five primary nav items reused from BottomNav. New shared `navItems.tsx` module. Top header simplified at `xl:`.
- **Breakpoint locked at `xl:` (1280px), not `lg:` (1024px).** Reason: iPad-landscape stays on mobile-style layout — a sidebar at iPad widths would feel cramped, and the existing app already uses `lg:` for the swipe/inline split (different concern, can coexist).
- **Scope decision: this pass touches every page (sidebar everywhere), but right-column layout is Calendar-only.** Other pages stay single-column main column until Phase 5 designs them. Keeps B1 bounded.
- **Sidebar shape locked (A2 + S1–S5):** 240px expanded / 64px collapsed, chevron toggle at top-right, state persisted to localStorage, active state = emerald left-edge accent bar + `bg-emerald-50` tint, icons identical to BottomNav (DRY via new shared module), small "Garden Tracker" wordmark at top, "Shopping list / Help / Settings / Feedback" live in sidebar footer (utilities, not sections).
- **Top header at `xl:` simplifies, doesn't disappear.** Cloud-sync + page title + household toggle stay; everything else moves to sidebar. Header items get `xl:hidden`; sidebar surfaces them on desktop.
- **FAB stays viewport-anchored at `xl:`.** Doesn't offset for sidebar. FAB → popover treatment is a separate concern (milestone B3).
- **Milestone breakdown for the pass (B1–B5).** Insert as ROADMAP §3.2 (renumbering 3.2 → 3.3, 3.3 → 3.4, etc.). B2 = Calendar two-column, B3 = FAB popover, B4 = modals/sheets centered-with-backdrop, B5 = per-page audit pass.
- **Communication pattern observed and captured in CLAUDE.md:** "I am ok with your recommendations" + explicit-starting-point naming (e.g. "A1 and A7") = **blanket trust-transfer on the batch of recommendations**, not a partial accept. Treat the full slate as locked; start where named; revisit individual items only on later redirect. Reduces friction without being silent on aesthetic decisions.

### 2026-05-10

- **Calendar consolidated-row apply-all shipped (`f77507a`).** User flagged a cohesion gap: singleton overdue rows had inline `[Snooze][Done]`, consolidated rows had only a chevron. Same row primitive should read the same top-to-bottom. Resolved by adding apply-all actions to consolidated rows.
- **Layout decision: `[Snooze][Done][Chevron]` on the right.** Preserves singleton-row button positions; chevron tacked on at the end. Two ways to expand (title-body button + chevron button), both `aria-expanded`. Recommended over `[Chevron][Snooze][Done]` to keep button order identical to singleton rows for vertical scan rhythm.
- **Safety decision: confirmation step (Option B over A).** Apply-all actions confirm before applying — "Mark all N as done?" sheet for complete-all; "Snooze all N tasks" sheet (Tomorrow / In 3 days / Next week chips + date picker) for snooze-all. Singletons stay no-confirm (single-tap speed retained); confirmation differentiates "applying to a group" from "applying to one" and matches the existing long-press batch-select pattern. Compensates for parked undo-toast.
- **Swipe primitive extraction: `useRowSwipe` hook.** Swipe gesture logic moved from inline `CalendarTaskRow` useEffect into a reusable hook (`{ enabled, onSwipeLeft, onSwipeRight } → { rowRef, swipeOffsetX, isSwiping }`). Consumed by both `CalendarTaskRow` and new `ConsolidatedOverdueHeader`. Mobile swipe parity on consolidated rows (Principle 9) ships in the same commit as the desktop button cluster.
- **State separation: `groupAction` kept distinct from `selectMode`/`selectedIds`/`batchActionOpen`.** Two parallel "bulk action" patterns now coexist: long-press multi-select (for arbitrary task selection across the page) and consolidated-row apply-all (for a pre-defined group). Different intents; both stay around.
- **Bulk handler patterns mirror existing batch flows.** `handleCompleteAllInGroup` and `handleSnoozeAllInGroup` follow the optimistic-UI + Promise.all + single-debounced-refetch pattern from `handleBatchReschedule`. Single toast on bulk completion ("N tasks completed") rather than per-task. Transplant→harvest cascade preserved per-task inside the bulk snooze handler.
- **Row primitive ("bubbles vs. list") remains parked.** The cohesion-of-actions issue is resolved by this ship, but the underlying `rounded-xl + white bg + emerald border + drop shadow` styling question is a separate concern still parked in VISION.md §11. Re-evaluate after this batch + the 2026-05-08 swipe batch both have prod time.
- **Process correction reinforced.** "yes build" is a contract that follows a complete plan-audit; sub-decisions surfaced during the build also get plan-audit treatment when reasonable people could disagree on the solution. (User explicit reminder this session.)

### 2026-05-08

- **Vision statement v4 locked.** Multi-tenant home garden management app. Memory + active management planes. Four roles. Multi-circle private sharing. Cost-driven freemium.
- **Audience layers locked:** self / household / trusted circle (incl. clubs). Invite-only forever. Never public.
- **Skill spectrum:** disclosure-by-data, no skill toggle.
- **Beds become a first-class entity** — implementation deferred to Phase 3.
- **Three lifecycle paths** named: seed (primary depth), established (acquired), division (lighter weight).
- **Four failure modes** named: lifecycle gaps, shallow profiles, untrusted timing, disorientation.
- **Cross-account exchange:** Level 3 (trade with history) ✅; Level 4 (paid) ❌; Level 5 (public) ❌.
- **Recipes / meal planning** ❌ Not ever (out of domain).
- **Direct hardware integration** ❌ Not ever; generic data import 🕐.
- **Micro-climate triggers** ✅ — anchored to user's actual garden, not zone-level.
- **Cost-driven freemium** locked: features with fixed cost free; features with variable cost (AI, beyond-limits, multi-circle) paid.
- **Plant database moderation** — concern raised, Phase 3 problem; recommended hybrid model.
- **Project documentation:** VISION.md (canonical truth), CLAUDE.md (Claude orientation + project-lead behaviors), WORKFLOW.md (process), ROADMAP.md (this file — where we are / what's next).
- **Project-lead behaviors codified** in CLAUDE.md after user flagged Claude was acting as smart respondent rather than lead.
- **User communication patterns captured** in CLAUDE.md for future Claude sessions.
- **Session transition management framework** added to CLAUDE.md — defines when Claude should proactively suggest switching chats and the close-out protocol to run when switching. Goal: chat-to-chat handoffs are smooth without the user tracking chat length.
- **Calendar fatigue batch shipped (build chunk 3.1).** Overdue consolidation key: `(title, plant_profile_id, grow_instance_id, user_id)` — `user_id` in key prevents household-member task merging. Singletons render flat (no fake nesting). "Select all in group" reuses existing long-press batch-select rather than introducing parallel checkbox UI. Per-date header tint = `bg-emerald-50/40` mirrors Overdue's amber pattern. Adjacent-month cells = `bg-neutral-100` (Option A) for unambiguous "not part of month" cue. Undo toast deferred to future design-system pass.
- **Row primitive ("bubbles vs. list") parked** in VISION.md §11 — re-evaluate after Calendar fatigue batch deploys; consolidation may resolve reading problem before we touch the row primitive. Recommended approach if needed: drop shadow + replace card border with bottom-divider + drop rounding + keep snooze/complete actions inline. Pure checkboxes go too far (lose action affordances + category color signal).

### 2026-05-07

- **Plant placeholder is `/public/plant-placeholder.png`** (three-leaf PNG).
- **Placeholder container background is `bg-white`** — matches PNG, no seam.
- **FAB transition standard** locked: fade-scale (open/close), horizontal-slide (submenu), slide-up (target modal). 200ms in / 150ms out.
- **Don't make aesthetic decisions without asking** rule added to WORKFLOW.md.
- **Batch small fixes 3-5 at a time** rule added to WORKFLOW.md.
- **Plan-audit-build for non-trivial work** rule added to WORKFLOW.md.

---

## 7. How to update this file

At the end of any session that includes meaningful work:

1. Update **§1 Current focus** — what's the next session's starting point.
2. Update **§3 Build chunks** if any item changed status (🔵 → 🟡 → 🟢 → ✅).
3. Add to **§5 Recently shipped** any new commits, with hash and brief description.
4. Add to **§6 Decision log** any locked-in decisions made this session.
5. Update **§4 Parked items** if anything got newly parked or unparked.

If a session does NOT touch the roadmap meaningfully (small bug fix only), at minimum update §5 (recently shipped).
