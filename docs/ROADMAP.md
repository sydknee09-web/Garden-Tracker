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

**As of 2026-05-10 — Calendar consolidated-row apply-all shipped, awaiting prod verification.**

🟢 **Just shipped (`f77507a`, on `main`, Vercel deploying):** Consolidated overdue rows now show inline `[Snooze][Done][Chevron]` on desktop — same button order as singleton rows, chevron tacked on at the end. Mobile gets swipe-left=complete-all, swipe-right=snooze-all via a new shared `useRowSwipe` hook (consumed by both `CalendarTaskRow` and a new `ConsolidatedOverdueHeader` component). Both actions confirm before applying (per "Option B" decision — see §6). Single toast per bulk action. Cohesion top-to-bottom on the row primitive's right-side actions.

**Awaiting from user — prod verification on phone + desktop:**
- **Desktop:** consolidated overdue row shows `[Snooze][Done][Chevron]`; tap Done → "Mark all N as done?" confirm; tap Snooze → sheet with Tomorrow / In 3 days / Next week chips + date picker
- **Mobile:** swipe-left on consolidated row → done-confirm; swipe-right → snooze sheet; chevron stays visible
- **Preserved (regressions to watch for):** singleton row swipe + inline buttons, chevron expand, "Select all" inside expanded group, long-press multi-select, transplant→harvest cascade on bulk snooze
- **Also still in scope from 2026-05-08 batch (`cea21e0`):** singleton row swipe pattern feel — gesture discoverability, vertical-scroll non-interference, long-press alongside swipe

**Likely next session focus, depending on prod verification:**
- If both batches land well → 🔵 **Phase 4 + 5 desktop layout pass** (parked in VISION.md §11): two-column layout (calendar left ~600-700px, tasks right), left sidebar nav on `lg:` breakpoint, modal/menu desktop placement — entangled work, designed as one coherent pass rather than fixed ad-hoc.
- If consolidated-row apply-all needs tuning (confirmation wording, sheet polish, swipe feel on the new row) → quick polish batch.
- After that, FAB icon-style consistency (§3.2) remains queued.

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

### 3.2 🔵 FAB consistency batch

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

### 3.3 🟣 Beds-as-first-class implementation (Phase 3 IA work)

**Status:** Vision-level decision locked (VISION.md §8). Implementation requires Phase 3 IA session before build.

**Scope:**
- Phase 3 design: data model for `bed` entity, migration plan for existing location strings, page design for bed detail page, plan for updating dependent surfaces
- After Phase 3 design lands: build (M-sized engineering work)

**Why third:** Foundation for many other things — soft-blocks the lifecycle batch tracking (3.4), unblocks soil testing (🕐), unblocks future bed layout (🕐), provides destinations for batch-split workflows.

**Effort:** Phase 3 design (~30-60 min session) + M-sized build (split data model, migration, UI updates).

**Dependencies:** Phase 3 IA design must come first.

**Source:** VISION.md §8 (beds-as-first-class), §11 (Phase 3 deferred items).

---

### 3.4 🟣 Lifecycle / batch-tracking improvements (Failure Mode #1)

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

**Dependencies:** Beds-as-first-class (3.3) recommended first; possibly Phase 5 page goals for the seed-starting flow.

**Source:** VISION.md §6 (Failure Mode #1), §5 (Lifecycle paths).

---

### 3.5 🟣 Plant profile depth (Failure Mode #2)

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

### 3.6 🟣 Cross-view cohesion / disorientation (Failure Mode #4)

**Status:** Spans multiple surfaces. Partially addressed by 3.2 cross-view consistency batch. Larger work pending.

**Scope:**
- Audit visual language across surfaces (typography, button treatments, card patterns, terminology)
- Audit IA — clear paths between Plant Profile ↔ Growing Instance ↔ Tasks ↔ Journal ↔ Harvest
- Resolve mental-model mismatches (e.g. "where is the plant's history?")

**Why sixth:** This is mostly "fix as we go" rather than one big project. The 3.2 batch addresses surface inconsistency; the IA work is partly addressed by 3.3 + Phase 4 navigation; mental-model fixes will surface as Phase 5 page goals get defined.

**Effort:** Distributed across many sessions.

**Dependencies:** Phase 4 (navigation), Phase 5 (page goals), Phase 6 (design system) all contribute.

**Source:** VISION.md §6 (Failure Mode #4).

---

### 3.7 🟣 Micro-climate triggers (Failure Mode #3)

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
- **Cross-view consistency** between Vault grid / Garden gallery / My Plants list (covered partly by §3.2).
- **Too many places to edit a plant's image** (in `BACKLOG.md`). Audit + consolidate.
- **Sister's additional feedback** — pending. User said she'd get more.
- **Plant database moderation philosophy** — Phase 3 deferred. Concern about user pollution / inappropriate entries. Hybrid (curated canonical + private user extensions + suggestion queue) recommended.
- **Growing instance representation detail** — Phase 3. Now that beds are first-class, the exact relationship needs design.

---

## 5. Recently shipped (last ~10)

Most recent first. For full history, use `git log`.

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
