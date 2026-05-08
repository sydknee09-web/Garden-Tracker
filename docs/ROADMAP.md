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

**As of 2026-05-08 — end of Phase 1 (Strategy / Vision).**

🟢 *No active build work right now.* Phase 1 just closed; ROADMAP.md and CLAUDE.md just shipped to set up the structure for the next session.

**Recommended next session focus:** 🟡 **Calendar fatigue batch** (Option A from prior chat). Has a clean-pass plan from a prior session — ready to execute. See §3 for details.

If user wants to start with something else: see §3 for ranked alternatives.

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

### 3.1 🟡 Calendar fatigue batch — READY TO EXECUTE

**Status:** Clean-pass plan exists from prior session. Awaits user greenlight + plan-audit refresh against VISION.md.

**Scope (3 changes bundled):**
1. Day header visual treatment — semibold text + subtle background tint ("A+B lightly combined")
2. Consolidation of repeated overdue rows — group by `(task_title, plant_profile_id, grow_instance_id)`, summary row with count + oldest date, expandable to individual dates
3. Bulk action on consolidated row — individual checkboxes per date + "Select all" checkbox at top of expanded view + undo toast for bulk action

**Why first:** Real fatigue relief on the page user uses most. Plan was already greenlit; just need quick alignment check against VISION.md before executing.

**Effort:** M (estimated). Consolidation logic adds complexity.

**Dependencies:** None. Compatible with current data model.

**Source:** Calendar discussion in prior session. See VISION.md §11 (open decisions / Calendar task fatigue).

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

- **2026-05-08 `e28d5df`** — `docs(claude): add CLAUDE.md with project lead behaviors required` — orients fresh Claude sessions, codifies project-lead obligations and user communication patterns.
- **2026-05-08 `bee1dc7`** — `docs(vision): commit Phase 1 design phase to VISION.md` — comprehensive Phase 1 close.
- **2026-05-08 `0db8cd8`** — `feat(transitions): FAB transition standard + VISION.md as source of truth`.
- **2026-05-08 `7d3585a`** — `revert: U18 calendar header changes (overstepped without asking)`.
- **2026-05-08 `4536897`** — `fix(visual): batch 1 — three quick visual fixes (U4, U5, U18)` (U18 part later reverted).
- **2026-05-07 `c7e1c44`** — `fix(visual): use bg-white on placeholder container so PNG blends seamlessly (U10 v3)`.
- **2026-05-07 `e54980e`** — `fix(visual): use plant-placeholder.png as the real plant placeholder (U10 v2)`.
- **2026-05-07 `13146cc`** — U14 card spacing.
- **2026-05-07 `cba80a8`** — U10 v1 SeedlingIcon design (later replaced).
- **2026-05-07 `36bb44c`** — U2 follow-up iOS-safe scroll-lock.

---

## 6. Decision log

Chronological log of key decisions made during design and build. New decisions append here. *Provides historical context — different from VISION.md (which is current state).*

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
