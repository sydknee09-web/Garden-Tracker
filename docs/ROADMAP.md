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

**As of 2026-05-16 (sleepy-vaughan-25de4f chat — still open) — Two tree-data feature asks (chill hours + rootstock tracking) parked to chunk 3.6 + §4 per PM rule. Both scope-✅ but off-current-chunks; user chose park rather than priority shift. Rootstock entry migrated from legacy `FEEDBACK_AND_FEATURE_NOTES.md:67` to canonical capture (kills one §3.10 D1 dual-capture instance). Doc-only ship this turn. U24 Phase B still awaiting user phone retry (this chat's named purpose). Parallel onboarding-for-testers chat may bundle tree-fields if testers grow trees — decision input handed there. Next session focus unchanged otherwise.**

---

**Earlier 2026-05-14 (latest — U24 Phase A ship chat + cohesion rule lock) — U24 Phase A code fix shipped (`7207164` → origin/main, Vercel auto-deploying). Three bulk/archive handlers patched to surface Supabase errors instead of silent failure. 4 sibling bulk-handler error toasts updated to friendly+refresh wording for cohesion. New regression test file at [src/app/garden/activeGardenBulkEnd.regression.test.ts](src/app/garden/activeGardenBulkEnd.regression.test.ts); tests 387 → 401. Mid-build, user raised a procedural concern: "engineering" decisions (toast color, animation tech, threshold value, log-string format) that aggregate into product-level cohesion drift get classified as decide-silently at planning time. Rule codified into CLAUDE.md as a dedicated Pass 2 subcategory ("Cohesion-by-aggregation / micro-aesthetic") + cross-reference from RULES CARD #4. Doc batch this chat: CLAUDE.md, VISION §12, ROADMAP §1/§5/§6, BUGS U24 — captures the ship + rule lock. **Next session focus:** Phase B (when user retries her 7 stuck plants with the instrumented build live; debug log page captures `ActiveGardenView.handleBulkEndBatch: update failed` console output). Plus: user is starting a parallel chat NOW for onboarding-for-testers (new testers being added) — that chat handoff prepared in this session. This chat stays open per user direction; she may continue here later.**

---

**Earlier 2026-05-14 (U24 diagnosis chat) — strict bug U24 (ended plants still showing in Active Garden) diagnosed via 2 Explore passes + direct code-read + 3 user-clarification AskUserQuestions. Root cause: silent-failure pattern in bulk-end handler at [ActiveGardenView.tsx:749-773](src/components/ActiveGardenView.tsx:749). Line 757 discards Supabase's `{data, error}` from `.update()`, leading to deceptive "Ended N plantings" toast regardless of write outcome. All 6 end-plant code paths mapped; user-confirmed flow = path #2 (bulk-end), personal view + own plants (rules out RLS). Fix path scoped Phase A (S-size: add error check + `.select('id')` row-count check at line 757 + audit 5 sibling paths) → Phase B (user retries with instrumented build, surfaced error names underlying cause, targeted fix or close as transient). Doc batch this chat: BUGS.md U24 updated with diagnosis + 6-path map + ruled-out causes; ROADMAP §1 + §6; VISION §11 (HarvestModal end-state realization parked as separate UX↔data gap discovered this chat) + §12 entry. No code touched. Diagnosis plan at `C:\Users\marsh\.claude\plans\three-things-to-handle-iterative-peach.md`. **Next session focus:** Phase A fix chat (S-size code change + 1 new unit test + Preview MCP visual check). Other open decisions awaiting user input unchanged from prior close-out — chunk 3.9 #5/#7/#8 + new #9/#10, §3.10 R6-R8 + D1/D2, journal flicker repro from `7482c59`, phone-verify `3de1c2c`, HarvestModal end-state realization (parked aesthetic decision: auto-end checkbox vs. prompt-after-save).

---

**Earlier 2026-05-14 (end-of-session of prior chat) — short doc-hygiene chat closing 2 gaps from the prior 2026-05-13 close-out + capturing fresh 2026-05-13 calendar-testing feedback. Single doc-only commit `2cc313a` to `origin/main`. Captured: (1) CLAUDE.md push-tiers section — push-classifier caveat (auto-mode classifier gates main pushes regardless of file type; reply with concrete tokens like `push`, not letter codes); (2) VISION §12 — new 2026-05-13 entry covering R1-R5 ship (`884cf9d` + `4b333ea`) with R3 audit-rec variance + R5 §11 brush handling + audit-pass framing correction (`60d0836`); (3) VISION §12 — new 2026-05-13 entry capturing the calendar feedback signal; (4) ROADMAP §3.9 — added items #9 (swipe-to-complete should require checkmark confirm, refining `cea21e0` / `f77507a`) + #10 (restructure task cards: TO_DO / plant-variety / conditional date) both labeled `(new 2026-05-13)` to disambiguate from §4's parenthetical `(2026-05-12 #N)` references to the original 12-item batch's parked items. Audit terminated clean at Pass 2 (pass-type 2) — Pass 1 clean first run, Pass 2 surfaced numbering finding → plan revised → re-passed clean on as-written-now plan. **Next session focus:** unchanged set of decisions awaiting user input — chunk 3.9 #5/#7/#8 + new #9/#10, §3.10 R6-R8 + D1/D2, journal flicker repro from `7482c59`, phone-verify `3de1c2c` (sidecar to ongoing calendar testing). User is switching to a fresh chat — new chat will open with Phase declarations + UserPromptSubmit hook active.**

### Just shipped this session

🟢 **`2cc313a` (Doc batch — close prior-chat gaps + capture new calendar feedback)** — Three doc-only captures: (1) **CLAUDE.md push-tiers** — new `Push-classifier caveat (locked 2026-05-13)` paragraph naming the auto-mode classifier behavior that gates every main push regardless of file type; convention locked to "Reply `push`" concrete-phrasing not letter codes ("A/B"). Extends the doc-only tier rule, doesn't contradict it. (2) **VISION §12** — two new 2026-05-13 bullets at top: first covers R1-R5 ship (`884cf9d` + `4b333ea`) with R3 audit-rec variance preserved + R5 §11 brush handling + audit-pass framing correction (`60d0836`); second captures 2026-05-13 calendar testing feedback as "table for later" (Item A swipe-to-complete confirm refinement; Item B task card structure proposal). (3) **ROADMAP §3.9** — added items #9 (swipe-confirm) + #10 (task card restructure) with `(new 2026-05-13)` label suffix to disambiguate from §4's `(2026-05-12 #N)` parenthetical labels referencing original-batch parked items. Cross-refs to `cea21e0`, `f77507a`, VISION §11 row-primitive parked decision, BUGS U13 hierarchy pattern. Plus inline fix to §3.9 count line (was "(7 items)", listed 1-8, now "(10 items)" listing 1-10) — amendment caught + re-passed clean. 3 files, +8/-4. 387/387 tests pass. Audit looped to termination at Pass 2 of pass-type 2 (min 2 pass-types met; no Pass 3 trigger).

🟢 **`3de1c2c` (Chunk 3.9 #2 + #4 batch)** — Two coordinated XS visual fixes per WORKFLOW §"Batching small fixes." **(1) #2 Calendar month-nav arrows:** added `hidden xl:flex` to both `← →` buttons in `src/app/calendar/page.tsx:976+985`. Arrows now hide below `xl:1280px` (phone + iPad-landscape); desktop keeps arrows. Phone/iPad nav stays via existing horizontal swipe gesture on the wrapping div. Matches B1 + B2 breakpoint family. **(2) #4 Garden card "Add journal entry" trigger icon:** swapped `JournalCareHands` → `Edit` (pen with motion) in 2 sites in `src/components/ActiveGardenView.tsx` (lines 1094, 1242). Resolves visual duplication where the trigger button shared its icon with the `care` entry-type marker on journal entries via [journal/page.tsx:230]. Scope A locked: trigger only; `JournalCareHands` stays in ICON_MAP and continues to mark `care` entries on display. **Mis-triage caught:** ROADMAP §3.9 #4 was originally captured as "Bag (shopping list) icon swap" in the mobile header — actual scope all along was the Garden trigger duplicate. 2 files, 4 line-edits. 387/387 tests; clean build. Pre-push Preview MCP check attempted at 412×915; dev server env-blocked in worktree (no .env.local) → skipped per rule `aad2e56`'s documented condition (functionally auth-blocked equivalent). 3-pass plan-audit terminated clean.

🟢 **`6d76c20` (Calendar expand-all toggle — chunk 3.9 #1)** — Chevron button next to "Upcoming Tasks" header toggles every collapsed section open/closed in one motion. 200ms ease-out arrow rotation per VISION §8 transition standard. Smooth content height animation via `grid-template-rows 0fr → 1fr` (no JS height measurement; arbitrary content height). Applies to both master and per-section toggles for consistency. Master state derived from existing `expandedDateGroups` Set; no new state shape. Hidden when no sections have content. Built on `a7dadb7` default-collapse. 1 file, +46 -4 lines. Pre-push mobile-viewport check skipped (auth-blocked per the rule's skip condition).

🟢 **`79836f4` (FAB UX fix batch — U22+U23)** — Two fixes to the Universal Add Menu: (1) Android back button now closes the menu via `useModalBackClose` wired on Home/Garden/Journal/Calendar (Vault already correct). Skip-pop infrastructure was already half-built in 4 files; this completes the wire-up. (2) Menu container switched from absolute-center (`top-1/2 -translate-y-1/2 max-h-[85vh]`) to flex-wrapper with `max-h-[85svh]` — fixes Chrome Android cutoff where 2 of 5 options + Cancel were hidden behind OS nav bar. 5 files, +10 -1 lines.

🟢 **`fb67e10` (U21 fix)** — hides webkit native search cancel button on journal search input via `[&::-webkit-search-cancel-button]:appearance-none` Tailwind arbitrary variant. Removes the Android Chrome / desktop Chrome duplicate X (grey custom + blue native → grey custom only). iOS Safari unchanged (no native button rendered there). 1-line CSS, 387/387 tests, clean build.

🟢 **`ed5441c` (Debug log page)** — `/settings/developer/debug-log` captures last 50 console.log/warn/error messages this session; Copy-all button writes to clipboard so user can paste captured output into bug reports without screenshots. Tooling, not user-facing. Plus temp `console.log` instrumentation in journal page for flicker-bug investigation (to be removed after diagnosis).

🟢 **`7482c59` (Journal search)** — search field on journal page, multi-token AND across note + type + plant name + variety + date, all three view modes. **Remaining follow-up:** journal page flicker / FAB cutoff (under investigation via the debug log). U21 follow-up shipped above in `fb67e10`.

### Verified clean

🟢 **`a7dadb7` (Calendar default-collapse)** — both phone screenshots from user (2026-05-12) show "Overdue (42 tasks)" / "Overdue (41 tasks)" collapsed at top with Upcoming Tasks expanded below. Confirmed working.

### Still TBD verification

- **`3de1c2c` chunk 3.9 #2 + #4** (calendar arrows hide on phone, garden card trigger icon swap) — needs phone verification: open Calendar, confirm no arrows beside month label; swipe still works; open Garden gallery + list, confirm pen icon (not cupped hands) on each plant card's "Add journal entry" button
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

**Open task awaiting user action:** Reproduce the journal flicker bug from `7482c59` ship on phone, capture via Settings → Developer → Debug Log → Copy all, paste output into the new chat. Then Claude diagnoses + ships flicker fix.

**Other open items (not blocking the debug step):**
- **U12** (two "+Entry" paths on journal) — awaiting user decision since 2026-05-07
- **Settings page search bar** — 🟣 parked per PM rule
- **App-wide icon density** — still parked, VISION §11
- **B3 (FAB → popover)** — still queued in chunk 3.2

**Optional setup at session start:**
- Read `docs/CLAUDE_CODE_SETUP.md` and (if you want stronger enforcement) enable the `UserPromptSubmit` hook by creating `.claude/settings.json` at the main repo root.

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
- **Tree-specific data fields (raised 2026-05-16):** chill hours (variety-level on `plant_profiles`) + rootstock (instance-level on `grow_instances`). See §4 parked entries for full context. Both fit "deeper growing data" sub-scope. Attachment-point split (variety vs instance) is a Phase 3 IA decision input — variety data describes the cultivar; rootstock describes the specific specimen and what it's grafted onto.

**Why fifth:** Real user pain (sister specifically), but needs Phase 5 page goals work to scope properly.

**Effort:** M (after Phase 5 design).

**Dependencies:** Phase 5 page goals work for the plant profile page. Phase 3 IA work for attachment-point decisions (which fields belong on `plant_profiles` vs `grow_instances`).

**Source:** VISION.md §6 (Failure Mode #2). Tree-data sub-items raised by user 2026-05-16.

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

**Status:** Triaged from user feedback batch 2026-05-12 (items 1-8) + 2026-05-13 calendar testing additions (items 9-10). **Shipped:** 1 (`6d76c20`), 2 (`3de1c2c`), 4 (`3de1c2c`), 6 (`7482c59`). **Parked to §4:** 3 (garden card spacing). **Needs user input before plan-audit:** 5 (journal gallery card format = U13), 7 (plant profile no-AI-data fallback), 8 (two +Entry paths = U12), 9 (swipe-confirm interaction model), 10 (task card structure). Will continue shipping in plan-audit-build cycles as each aesthetic decision lands.

**Scope (10 items: 1-8 from 2026-05-12 batch + 9-10 from 2026-05-13 calendar-testing additions):**

1. **Calendar "Upcoming Tasks" master expand-all / collapse-all toggle.** ✅ **SHIPPED 2026-05-12 (`6d76c20`).** Chevron button next to "Upcoming Tasks" header (only when no date selected and at least one section has content). Tap → all sections expand + arrow rotates 180° (200ms ease-out, per VISION §8). Tap again → all collapse + arrow rotates back. Smooth content height animation on per-section expand/collapse via `grid-template-rows 0fr → 1fr` technique (no JS measurement). Applies to both master and per-section toggles for consistency. Awaiting user prod verification.
2. **Phone calendar month-nav arrows.** ✅ **SHIPPED 2026-05-12 (`3de1c2c`).** `← May 2026 →` arrows now hide below `xl:1280px` (phone + iPad-landscape) via `hidden xl:flex` Tailwind classes on both buttons in `src/app/calendar/page.tsx:976+985`. Desktop ≥1280px keeps arrows. Phone/iPad nav stays via existing swipe gesture on the wrapping div. Matches B1 + B2 breakpoint family. Awaiting user phone verification.
3. **Garden card spacing.** 🟡 **PARKED 2026-05-12 → see §4 Parked.** User identified empty space below short plant names during 2026-05-12 decision session. Root cause diagnosed: `min-h-[1.75rem]` on h3 in `ActiveGardenView.tsx:1075` reserves 28px for 2-line names — 14px visible gap when name is 1 line. 3 fix options surfaced (remove min-h / reduce to `min-h-[1rem]` / move space via `justify-end`) — user opted to think through the alignment-vs-tightness trade-off in its own batch rather than bundle with #2 + #4. Full options + trade-offs preserved in §4.
4. **Garden card "Add journal entry" trigger icon swap.** ✅ **SHIPPED 2026-05-12 (`3de1c2c`).** *Originally mis-triaged 2026-05-12 as "Bag (shopping list) icon swap" referring to the mobile header — actual scope all along was the Garden plant card trigger button.* `JournalCareHands` was rendered both as the trigger icon (on every Garden plant card in gallery + list views) AND as the `care` entry-type marker on journal entries ([journal/page.tsx:230](src/app/journal/page.tsx:230)). Result: trigger button visually duplicated one of the entry-types it produces. Swapped to `ICON_MAP.Edit` (pen with motion) in 2 sites in `src/components/ActiveGardenView.tsx` (lines 1094, 1242). **Scope A locked:** trigger only; `JournalCareHands` stays in ICON_MAP and continues to mark `care` entries on display. Scope B (also retag `care` marker) and Scope C (full entry-type vocabulary audit) deferred — the secondary cohesion question (Harvest basket + JournalCareHands cupped curve reading as same family) noted for future Phase 6 design-system pass. Awaiting user phone verification.
5. **Journal gallery card format.** **= BUGS.md U13 (pre-existing, re-flagged 2026-05-12).** User wants structured layout: clear header w/ relevant info (date + type) + description body + variety/location tags. Currently variety pill is mingled with description visually. Effort: S/M (~1-2h per U13). **Aesthetic discussion:** confirm structure — `[date | type icon+label]` header, description below, variety + location pills at bottom? Or different shape?
6. **Journal search.** ✅ **SHIPPED 2026-05-12 (`7482c59`).** Search input above view-toggle row in journal sticky header. Multi-token AND across note, entry_type (underscores stripped), plant name + variety, formatted date. All three view modes (table/gallery/timeline). Awaiting user prod verification. **Follow-up bugs from ship (BUGS.md):** U21 (two clear-X buttons on Android Chrome) ✅ **Fixed 2026-05-12 (`fb67e10`)** — webkit native cancel button hidden via Tailwind arbitrary variant.
7. **Plant profile no-AI-data fallback.** When AI returns no data for a plant profile section, the section should show a graceful empty state rather than nothing/broken UI. Effort: S. **Needs:** look at current behavior to see what happens today, then aesthetic decision on empty-state copy (retry button? "No info yet" + add-manually CTA? Encyclopedia stub?).
8. **Two "+Entry" paths on journal page = BUGS.md U12 (pre-existing, re-flagged 2026-05-12).** User re-surfaced after `7482c59` ship. UX coherence decision: keep both with differentiation, or remove one. Effort: Decision + ~30 min. Surfaced 2026-05-07; user has not yet made the call.
9. **Swipe-to-complete should require checkmark confirmation, not autocomplete on swipe (new 2026-05-13).** Refines `cea21e0` (2026-05-08 singleton row swipe) and `f77507a` (2026-05-10 consolidated row swipe) shipped behavior — both currently autocommit past 100px threshold + 8px direction lock. User flagged 2026-05-13 during calendar testing: "user has to hit check mark so it doesnt autocheck as complete for accidental swipe." VISION §11 swipe-batch resolution direction (2026-05-08) named "left=complete, right=snooze" but didn't specify confirm-vs-autocommit interaction model — refinement of locked behavior, not contradiction. **Aesthetic — needs user input on interaction model:** swipe reveals checkmark (user taps to confirm)? swipe-then-confirm-via-modal? rubber-band-back if no checkmark tap within N seconds? Cross-ref: VISION §11 swipe-batch parked-resolution; BUGS U13 sister concern (hierarchy on cards). Effort: S/M (touches `useRowSwipe` hook + `CalendarTaskRow` + `ConsolidatedOverdueHeader` + swipe test cases in 387/387 suite).
10. **Restructure calendar task cards — primary TO_DO line, plant/variety secondary, conditional date (new 2026-05-13).** User flagged 2026-05-13 during calendar testing: "lets structure the tasks cards more clearly. TO_DO task, plant/variety. we may want to remove date on the card, unless its in the overdue section(?)" Related to VISION §11 "Calendar task row primitive — bubbles vs. list" (parked 2026-05-08; same surface, internal-structure variant of the same density/clarity concern) AND BUGS U13 "Journal entry cards — visual hierarchy poor" (re-flagged 2026-05-12; same hierarchy pattern, now echoed for Calendar tasks). **Aesthetic — needs structure proposal + per-element treatment input:** primary line wording (TO_DO verb only? "Water Tomato — Sungold"?); plant/variety placement (secondary line? pill on first line?); date conditional rule (hide except in Overdue? hide except for tasks >7 days out? always show but demote visually?). Cross-ref: VISION §11 row-primitive parked decision; BUGS U13 hierarchy pattern; sister to #9 (both shape the Calendar task row primitive). Effort: M (touches `CalendarTaskRow` markup + likely day-section grouping logic).

**Dependencies:**
- Item 1 depends on `a7dadb7` (already shipped). No blockers.
- Item 6 (Journal search) — read existing journal page to find where search input fits; likely no schema change.
- Item 7 — read existing AI-data flow on profile page to understand current state.
- Aesthetic items (2, 3, 4, 5) blocked on user input only.

**Verification strategy:** standard plan-audit-build per item or grouped (3-5 batch per WORKFLOW.md). User prod-verifies on phone after each ship.

**Source:** User feedback batch 2026-05-12. See VISION.md §12 for verbatim signal.

---

### 3.10 🔵 Doc hygiene cleanup — 2026-05-12 audit findings

**Status:** Triaged from user-delivered audit pasted 2026-05-12 (separate audit pass, possibly run in another session). All findings cross-referenced against existing ROADMAP/VISION/BUGS captures — most are new. **R1-R5 strict drift batch shipped 2026-05-13** as a single doc-only commit; R6-R8 structural items still need scope decisions; D1/D2 need user input.

**Strict fixes — ✅ shipped 2026-05-13 (no aesthetic decisions, single doc commit):**

- **R1** — `CLAUDE.md` line 81: test count `329/329` → `387/387`. Verified via `npm run test:run` 2026-05-12. ✅ **Shipped 2026-05-13**
- **R2** — `docs/WORKFLOW.md` line 3: "Seed Vault" → "Garden Tracker" (rename happened pre-VISION-v4); bump stamp to 2026-05-12. ✅ **Shipped 2026-05-13**
- **R3** — `docs/BUGS.md`: U1 ("Set up your zone" widget) + U3 (variety dropdown alphabetical) are silently fixed in code. Move to "Resolved (Closed)" with verification notes. Verified: no zone widget in `src/app/page.tsx`; `src/components/QuickAddSeed.tsx:213` uses `localeCompare` for variety sort. ✅ **Shipped 2026-05-13** (variance from audit: applied inline `✅ Fixed (verified date)` annotations on U1/U3 rows in-place, matching the in-file U21-U23 convention rather than physically moving rows to the Resolved table).
- **R4** — `docs/BUGS.md` stamp: "Last updated: 2026-05-07" → 2026-05-12 (file contains U21-U23 from this week). ✅ **Shipped 2026-05-13**
- **R5** — `docs/VISION.md` §11 icon density: "~25+ icons" → "42 icons" (actual count in `ICON_MAP`). Recommendation direction unchanged. ✅ **Shipped 2026-05-13** (factual count only — decision substance preserved verbatim, see §6 2026-05-13 lock-hygiene note).

**Structural fixes — 🔵 needs scoping (user input on shape):**

- **R6** — `docs/PROJECT_STATUS.md` is pre-VISION-v4 (claims "Seed Vault" identity, Phase 0-9 taxonomy, 329 tests, stamped 2026-04-06) but cited as canonical by `WORKFLOW.md:215` + `BACKLOG.md:7`. **Decision needed:** banner at top "ARCHIVED"? rename `PROJECT_STATUS.archive.md`? move to `docs/archive/`? Update the 2 citations to point at ROADMAP.md regardless.
- **R7** — `docs/WORKFLOW.md` missing 5 procedural rules locked 2026-05-11/12 (Plan-audit 3-pass, Pre-push visual check, Feedback-batch triage Step 0, PM/feature-creep, Roadmap maintenance). All in CLAUDE.md but absent from WORKFLOW.md. **Decision needed:** thin pointer (one-line refs to CLAUDE.md sections) vs full duplication (single source ambiguity risk). Recommend pointer approach.
- **R8** — `docs/BACKLOG.md:7` references `.cursor/plans/remaining_steps_roadmap.plan.md` (pre-Claude-Code Cursor IDE era, incompatible Phase taxonomy). Remove citation.

**Future / parked — 🟣 in §4:**

- **D1** — ~30 legacy docs in `docs/` folder (AI_FLOWS.md, AI_PROCESS_AUDIT.md, FULL_APP_AUDIT.md, AUDIT-2025-02.md, etc.) of unclear provenance — none referenced by canonical docs but sit alongside them. **Recommended approach:** bulk-move pre-VISION-v4 docs to `docs/archive/` so `docs/` shows only active+canonical. Full content audit is correct long-term but high cost — defer.
- **D2** — `.claude/settings.json` doesn't exist at repo root despite `docs/CLAUDE_CODE_SETUP.md` describing the optional `UserPromptSubmit` hook for the rules-card injection. User-optional; surface whether to enable.

**Cross-reference / low-risk:**

- BUGS.md timestamp stale (covered by R4).
- ROADMAP §1 says "Journal flicker bug repro still pending" — confirm whether still next action.
- VISION §11 Calendar task fatigue parking framing could tighten now that chunk 3.9 #1 (expand-all toggle) shipped (`6d76c20`).

**Effort:** R1-R5 are 5 doc edits (~20 min total). R6-R8 + D1 need user decisions before execution.

**Source:** User-delivered audit document 2026-05-12. Full audit preserved in this session's transcript for reference.

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

- **Garden card spacing (chunk 3.9 #3, parked 2026-05-12)** — User flagged empty space below short plant names. Root cause: `min-h-[1.75rem]` on the h3 at [ActiveGardenView.tsx:1075](src/components/ActiveGardenView.tsx:1075) reserves 28px for 2-line names → 14px gap visible when name is 1 line. The min-h is there to align the "Sown..." date at the same y-coordinate across cards in a grid row (so name slot is uniform regardless of 1 vs 2 lines). Three fix options surfaced during 2026-05-12 discussion:
  - **Option 1 — Remove `min-h-[1.75rem]` entirely.** Short names tighten; date sits directly under name. Trade-off: dates won't align across cards in a grid row when name lengths differ.
  - **Option 2 — Reduce to `min-h-[1rem]` (16px).** Compromise. ~2px gap remains for short names; partial date alignment preserved.
  - **Option 3 — Add `justify-end` (or `justify-center`) to the text section wrapper at line 1074.** Keep min-h, push name+date toward the button row. Empty space moves to TOP under image (reads as padding). Date alignment preserved. Side effect: names sit at varying vertical positions within cards.
  - User opted to defer the alignment-vs-tightness call rather than batch it with #2 + #4. Re-surface when ready to choose; trade-offs are already mapped.
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
- **Chill hours on plant profiles (2026-05-16, sub-item of §3.6)** — User raised 2026-05-16: "i need chill hours added to our profiles for trees." Adds a variety-level field on `plant_profiles` for required chill hours (e.g. "Snow Queen nectarine = 200-300 hrs"). Used by gardener to match variety against local zone's average chill accumulation. Effort: S-M (1 schema migration + UI on Vault profile + display logic). Likely also wants integration with micro-climate triggers (Failure Mode #3) eventually for "this variety won't perform at your location" alerts — but that's a later extension. **Dependencies:** Phase 3 IA decision on schema (likely straightforward — variety-level data fits `plant_profiles`); Phase 5 page goals for where on profile UI it sits. **Cross-ref:** chunk 3.6 sub-item; sister's feedback (VISION §11 parked) may reinforce this when received; relates to Failure Mode #2 (profile shallow for growing).
- **Rootstock tracking on grow instances (2026-05-16, sub-item of §3.6)** — User raised 2026-05-16: "i want to be able to track rootstocks for trees." Adds an instance-level field on `grow_instances` for rootstock identifier (e.g. "M27 dwarf apple rootstock"). Specific to grafted fruit trees; rootstock determines size, vigor, hardiness, disease resistance independent of the scion variety. **Pre-existing capture migrated from `docs/FEEDBACK_AND_FEATURE_NOTES.md:67`** (legacy pre-VISION-v4 doc, see §3.10 D1 archive question) where the prior recommendation was: workaround via variety/name line OR growing notes for now; first-class fields later. User's 2026-05-16 ask promotes "later" to "park canonically." Effort: S (1 optional field on `grow_instances` migration + UI on Grow Instance Modal + Vault Plantings handler). **Dependencies:** Phase 3 IA decision on `grow_instances` schema extensibility — connects to beds-as-first-class architectural work since both extend the grow-instance schema. Likely bundled with that Phase 3 build. **Cross-ref:** chunk 3.6 sub-item; legacy doc at FEEDBACK_AND_FEATURE_NOTES.md:67 should be marked superseded.

---

## 5. Recently shipped (last ~10)

Most recent first. For full history, use `git log`.

- **2026-05-14 `7207164`** — `fix(u24): surface bulk-end handler errors instead of silent failure` — U24 Phase A code fix. Three handlers patched: [ActiveGardenView.handleBulkEndBatch line 757](src/components/ActiveGardenView.tsx:757) — `{data, error}` destructure from direct supabase `.update().eq().eq().select("id")` + zero-row-match check (`error || !data || data.length === 0`) + loop-with-hadError + skip `revertProfileStatusIfNoActiveGrows` on error; [MyPlantsView.handleBulkEndBatch line 486](src/components/MyPlantsView.tsx:486) — `{error}` destructure from `updateWithOfflineQueue` (wrapper doesn't return data, no row-count available) + same loop pattern; [GrowInstanceModal.handleArchive line 414](src/components/GrowInstanceModal.tsx:414) — added err else-branch via `showErrorToast` + `useToast` destructure update on line 157. Sibling cohesion: 4 existing bulk-handler error toasts updated to friendly+refresh wording per user's ask ([ActiveGardenView:713](src/components/ActiveGardenView.tsx:713) handleBulkDelete + [:737](src/components/ActiveGardenView.tsx:737) moveSelectedToPermanentPlants; [MyPlantsView:468](src/components/MyPlantsView.tsx:468) handleBulkDelete; [src/app/garden/page.tsx:527](src/app/garden/page.tsx:527) handleMoveToGrowingGarden). 3 sibling end-paths confirmed already-clean (no edits needed): [ActiveGardenView single-end:639](src/components/ActiveGardenView.tsx:639), [MyPlantsView single-end:389](src/components/MyPlantsView.tsx:389), [useVaultPlantingsHandlers:76](src/app/vault/[id]/useVaultPlantingsHandlers.ts:76) — path corrected from diagnosis plan's `src/hooks/` to actual `src/app/vault/[id]/`. New regression file `src/app/garden/activeGardenBulkEnd.regression.test.ts` (14 it-blocks across 4 describe groups; positive assertions on new fix-shape strings + negative assertions on 4 old sibling strings to prevent revert). 387 → 401 tests pass. Clean build. Preview MCP env-blocked per documented skip condition. **Console.error format standardized via commit amend mid-build** after user flagged cohesion-by-aggregation concern: new calls use `<Component>.<method>: <description>` colon-notation matching existing helpers ([cascadeOnGrowEnd.ts:18](src/lib/cascadeOnGrowEnd.ts:18) `softDeleteTasksForGrowInstance: unexpected error`; [revertProfileStatus.ts:57](src/lib/revertProfileStatus.ts:57) same shape) instead of `[handlerName]` bracket-notation initial draft. Plan file at `C:\Users\marsh\.claude\plans\all-three-recommended-options-wild-meadow.md`. 3-pass plan-audit + Amendment 1 (sibling cohesion) re-audit + Amendment 2 (cohesion-by-aggregation re-audit on console.error format) all terminated clean.
- **2026-05-14 `2cc313a`** — `docs: 2026-05-13 calendar feedback + push-classifier caveat + R1-R5 VISION §12 entry` — short doc-hygiene batch closing two gaps from the prior 2026-05-13 close-out + capturing fresh 2026-05-13 calendar-testing feedback. **CLAUDE.md push-tiers:** new `Push-classifier caveat (locked 2026-05-13)` paragraph after the existing tier rules, naming the auto-mode classifier behavior that gates every `git push origin main` regardless of file type. Observed during `884cf9d` doc-only push: 3 denials with letter-coded reply prompts ("Reply `A`" / "Reply `B`") before a bare `push` landed. Convention locked: when surfacing the gate to the user, frame the reply concretely ("Reply `push` to proceed") not as letter codes. Caveat extends the doc-only tier rule; doesn't contradict it. **VISION §12:** two new 2026-05-13 bullets at top of the rolling log. First covers `884cf9d`+`4b333ea` R1-R5 ship with R3 audit-rec variance documented (`✅ Fixed (verified date)` inline annotations vs. moving rows to Resolved (Closed) — preserves U-number anchoring + matches in-file U21-U23 convention), R5 §11 brush handling (factual count only — decision substance preserved verbatim), and audit-pass framing correction (`60d0836`'s lock: min-pass counts are FLOORS not CAPS; audits loop until clean). Second bullet captures 2026-05-13 calendar testing feedback as "table for later": (A) swipe-to-complete should require checkmark confirmation, refines `cea21e0`/`f77507a` autocommit-on-threshold behavior; VISION §11 swipe-batch parked-resolution direction didn't specify confirm-vs-autocommit so this is refinement, not contradiction. (B) Restructure calendar task cards — TO_DO task verb primary line, plant/variety secondary, remove date except in Overdue section; related to VISION §11 "bubbles vs. list" row-primitive parked decision + BUGS U13 hierarchy pattern. **ROADMAP §3.9:** added items #9 (new 2026-05-13) for swipe-confirm interaction model + #10 (new 2026-05-13) for task card restructure. `(new 2026-05-13)` label suffix disambiguates from §4's `(2026-05-12 #9)`/`#10` parenthetical labels referencing the original 12-item 2026-05-12 batch's parked items (gallery-vs-table / growing-indicator-tags). Both items 🔵 current build, aesthetic-flagged. Cross-refs explicit. Plus pre-existing drift fix to §3.9 chunk intro (count was "(7 items)" but listed 1-8; now "(10 items: 1-8 from 2026-05-12 batch + 9-10 from 2026-05-13 calendar-testing additions)") + Status line refreshed to mark shipped/parked/needs-input states accurately. 3 files, +8/-4. 387/387 tests pass (sanity — no code touched); `git diff --stat origin/main` confirms doc-only. Audit looped to termination at Pass 2 of pass-type 2 (Pass 1 clean first run; Pass 2 surfaced numbering finding → plan revised → re-passed clean on as-written-now plan). Min 2 pass-types met. No Pass 3 trigger. Inline §3.9 count-line amendment caught + re-passed clean.
- **2026-05-13 `884cf9d`** — `docs: §3.10 R1-R5 strict drift batch + §1 stamp refresh` — closes the five strict drift items from the 2026-05-12 user-delivered doc audit. **R1** `CLAUDE.md:81` test count `329/329` → `387/387`. **R2** `docs/WORKFLOW.md:3` "Seed Vault" → "Garden Tracker" + stamp 2026-05-12. **R3** `docs/BUGS.md` U1+U3 marked ✅ Fixed inline (variance from audit's "move to Resolved" rec — followed in-file U21-U23 inline-annotation convention to keep U-numbers anchored; less structural churn). **R4** `docs/BUGS.md` stamp 2026-05-07 → 2026-05-12. **R5** `docs/VISION.md` §11 icon count `~25+` → `42` (counted manually from `ICON_MAP` keys in `src/lib/styleDictionary.tsx:484-526`; only factual count edited, decision substance — stroke 1.2 canonical, counter stroke 2.0, parked status — untouched). **§1 stamp refresh:** prior "both LOCAL, push pending" stale after `5c9cdf9` push; refreshed to current state. **§3.10 inline status:** R1-R5 marked ✅ Shipped 2026-05-13. Doc-only commit per WORKFLOW §8 push tier — no code, no tests, no aesthetic decisions. 5 files, +15/-15. 3-pass plan-audit clean (Factual / Semantic+edge / Lock hygiene — 3 passes triggered because R5 brushes §11 parked decisions).
- **2026-05-12 `3de1c2c`** — `feat(ui): chunk 3.9 #2 + #4 — hide calendar arrows on phone, swap garden trigger icon` — bundled XS visual batch (per WORKFLOW §"Batching small fixes") addressing two items from the 2026-05-12 chunk 3.9 set. **#2 calendar arrows:** added `hidden xl:flex` to both `← →` month-nav buttons in `src/app/calendar/page.tsx:976+985`. Below `xl:1280px` (phone + iPad-landscape), arrows hide; horizontal swipe gesture on the wrapping div at line 957 continues to navigate months via `prevMonth()` / `nextMonth()`. Desktop ≥1280px keeps arrows since no touch events fire there. Matches the B1 + B2 breakpoint family locked 2026-05-11. **#4 garden trigger icon:** swapped `ICON_MAP.JournalCareHands` → `ICON_MAP.Edit` (pen with motion) in 2 sites of `src/components/ActiveGardenView.tsx` (lines 1094 + 1242). Resolves visual duplication where the trigger button shared its icon with the `care` entry-type marker rendered on journal entries via [journal/page.tsx:230]. Scope A locked: trigger only; `JournalCareHands` stays in ICON_MAP for `care` display. **Mis-triage corrected:** ROADMAP §3.9 #4 was originally captured as "Bag (shopping list) icon swap" in the mobile header — actual scope all along was the Garden trigger duplicate. 2 files, 4 line-edits. 387/387 tests; clean build. Pre-push Preview MCP check attempted at 412×915; dev server env-blocked in worktree (no .env.local) → skipped per rule `aad2e56`'s documented condition (functionally equivalent to auth-blocked surfaces). 3-pass plan-audit terminated clean. Plan file at `C:\Users\marsh\.claude\plans\startinga-a-new-session-proud-orbit.md`.
- **2026-05-12 `6d76c20`** — `feat(calendar): expand-all/collapse-all toggle for Upcoming Tasks (chunk 3.9 #1)` — first item shipped from the 2026-05-12 chunk 3.9 batch (after journal-search #6). Chevron button rendered in the "Upcoming Tasks" header when no date is selected and at least one section has content. State derived from existing `expandedDateGroups` Set + new `allDateKeys` memo + `handleToggleAll` callback. 200ms ease-out arrow rotation. Smooth content height animation via `grid-template-rows 0fr → 1fr` transition wrapped around both overdue and per-date section content — replaces conditional `{isExpanded && ...}` rendering with always-rendered wrapper. Initial render at default-collapsed doesn't animate (CSS transitions skip first paint). One file, +46 -4 lines. 387/387 tests; clean build after fixing `ICON_MAP` import miss (caught by build, not by plan-audit — surfaced new "Pass 1 factual" rule in CLAUDE.md). Pre-push Preview MCP visual check ran per new rule `aad2e56` but skipped per its documented "auth-blocked" condition.
- **2026-05-12 `79836f4`** — `feat(fab): Android back closes Universal Add Menu + fix viewport cutoff (U22, U23)` — bundled FAB UX fix batch addressing two user reports (2026-05-12). **F1 (U22):** wired `useModalBackClose(addMenuOpen, closeMenu, skipPopOnNavigateRef)` on Home, Garden, Journal, Calendar. Research surfaced that `skipPopOnNavigateRef` was already declared and SET in 28+ nav handlers across these 4 files, but no `useModalBackClose` was reading it — half-built infrastructure from a prior session. This fix is the missing wire-up. Vault unchanged (correct via `anyModalOpen` umbrella). Trade-off: hitting Android back on the add-plant sub-screen closes the whole FAB (not per-level Android idiom), but matches the user's explicit "close FAB" framing; in-menu Back arrow at line 160 still provides per-level navigation. **F2 (U23):** changed `UniversalAddMenu` container from `fixed top-1/2 -translate-y-1/2 max-h-[85vh]` to flex-wrapper with `max-h-[85svh]`. Root cause: Chrome Android `100vh` includes the URL-bar-collapsed idealized viewport, so the centered card spilled below the visible area — 2 of 5 menu options + Cancel hidden behind OS nav bar. `svh` always excludes browser chrome; flex centering uses the real available space and eliminates transform-stack conflict with `animate-fab-menu-enter`. Backdrop click preserved via `pointer-events-none` on flex wrapper. 5 files, +10 -1 lines. 387/387 tests; clean build. 5-pass plan-audit terminated clean.
- **2026-05-12 `fb67e10`** — `fix(journal): hide native search cancel button to remove Android Chrome duplicate X (U21)` — closes the only outstanding follow-up bug from the `7482c59` journal-search ship. The custom React clear-X added for iOS Safari (which doesn't render the native button) was rendering alongside the Android Chrome / desktop Chrome native blue X. Added `[&::-webkit-search-cancel-button]:appearance-none` Tailwind arbitrary variant to the search input's `className`. App-wide audit confirmed 6 other `type="search"` inputs (garden, vault, vault/shed, vault/packet, ShedView, settings/developer) rely on native-only and have no manual clear-X duplicate — scope locked at journal. 1 file, 1 line. 387/387 tests pass; clean build (no new warnings on journal page). 4-pass plan-audit terminated clean. iOS Safari path verified unchanged in code (native button doesn't exist there).
- **2026-05-12 `ed5441c`** — `feat(settings): debug log page under developer settings + journal page instrumentation` — adds `/settings/developer/debug-log`, a page that captures the last 50 console.log/warn/error messages app-wide this session and offers Copy/Clear/Refresh buttons. Built specifically so the user can paste captured debug output into bug-report conversations without screenshots. Buffer is in sessionStorage (gone on app close). Plus 1 temp `console.log` block on every journal page render (state snapshot for flicker-bug investigation; to be removed after diagnosis + fix). New files: `src/lib/debugLogBuffer.ts`, `src/lib/debugLogBuffer.test.ts`, `src/components/DebugLogInit.tsx`, `src/app/settings/developer/debug-log/page.tsx`. Wired in `src/app/layout.tsx` + `src/app/settings/developer/page.tsx` + `src/app/journal/page.tsx`. 387/387 tests; clean build. 3-pass plan-audit clean. Tooling, not a user-facing feature — bounded scope on purpose.
- **2026-05-12 `7482c59`** — `feat(journal): add search input that filters entries across all view modes` — first ship from 2026-05-12 batch (chunk 3.9 item #6). Search field above view-toggle row in journal sticky header; matches Vault/Garden visual pattern. Multi-token AND match across note, entry_type (with underscores stripped → "cold stratify" matches `cold_stratify`), plant name + variety, and formatted date. Filters apply uniformly to all three view modes (table/gallery/timeline) and persist across view switches. Pure filter function in `src/lib/journalSearch.ts` w/ 8 vitest cases; component wiring in `src/app/journal/page.tsx`. No URL state, no debounce (matches Vault). 378/378 tests pass; clean build (no new warnings on journal page). 3-pass plan-audit + 2-pass self-audit, all clean.
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

### 2026-05-16

- **Tree-data feature asks parked to chunk 3.6 + §4 (chill hours + rootstock tracking).** User raised 2026-05-16: *"i need chill hours added to our profiles for trees. and i want to be able to track rootstocks for trees."* Step 0 search: chill hours = net-new; rootstock = pre-captured at `docs/FEEDBACK_AND_FEATURE_NOTES.md:67` (legacy pre-VISION-v4 doc with workaround pattern + "first-class later" note). PM triage: both scope-✅ per VISION §6 Theme 2 / chunk 3.6 BUT off-current-chunks (U24 Phase B + parallel onboarding chat + chunk 3.2 B3-B5 + chunk 3.9 #5/#7/#8/#9/#10 + §3.10 doc-hygiene). User chose park-to-3.6. **Locked attachment-point distinction:** chill hours = variety-level on `plant_profiles` (cultivar property: "Snow Queen nectarine = 200-300 hrs"); rootstock = instance-level on `grow_instances` (specimen property: "this apple was grafted onto M27 dwarf rootstock"). Distinction matters for Phase 3 IA work — the same field can't sit at both layers without a duplication question. Chill hours likely needs eventual micro-climate-triggers (Failure Mode #3) integration for "this variety won't perform at your location" alerts. Rootstock likely bundles with beds-as-first-class Phase 3 build (both extend `grow_instances` schema). Rootstock entry migrated from legacy doc; legacy entry marked SUPERSEDED 2026-05-16 to prevent dual-capture drift. Doc-only ship.

### 2026-05-14

- **U24 Phase A shipped (`7207164`).** Silent-failure pattern in bulk-end handlers fixed across 3 handlers per the diagnosis plan. Loop-with-hadError pattern mirrors existing sibling handlers in the same files (ActiveGardenView handleBulkDelete + moveSelectedToPermanentPlants; MyPlantsView handleBulkDelete) so the fix doesn't introduce a new control-flow shape. `.select("id")` row-count check at the direct-supabase site catches the `{error: null, data: []}` zero-row-match edge case. `console.error` instrumentation captured by the debug log page for Phase B retry. `showErrorToast` reused in GrowInstanceModal via existing `useToast` hook. Three sibling end-paths confirmed already-clean (no edits). One path-correction recorded in plan vs. diagnosis: `useVaultPlantingsHandlers` lives at `src/app/vault/[id]/`, not `src/hooks/`. Phase B awaits user retry on her 7 stuck plants with instrumented build live; debug-log page captures `ActiveGardenView.handleBulkEndBatch: update failed` console output for diagnosis.

- **Cohesion-by-aggregation rule locked into CLAUDE.md plan-audit standard.** User raised the concern mid-build: *"i request a feature and it gets implemented but you fill in gaps without thinking it fully through... You ask for X. Claude scopes X. Claude also makes a bunch of smaller decisions to actually implement X — what the swipe threshold is, whether swipe autocommits or confirms, what the row primitive shape is, what padding the day header uses... Each of those individual choices feels like an implementation detail at planning time, so Claude classifies it as 'engineering, decide silently' rather than 'aesthetic, ask first.' Then they aggregate — and a month later you look at the Calendar and feel that nothing reads right."* Existing CLAUDE.md had the spirit (RULES CARD #4 + VISION §4 principle 2 + anti-patterns) but no sharp rule for the "engineering-disguised-aesthetic that aggregates" failure mode. **Rule codified** as a dedicated Pass 2 subcategory in the plan-audit standard, plus a cross-reference clause appended to RULES CARD #4. Concrete enumerated categories (toast color, animation tech, threshold value, log-string format, padding token, icon weight, row-primitive shape, transition timing, copy frame, empty-state copy). Two-branch resolution at audit time: (a) cite existing pattern as anchor by path, or (b) ask. Failure-mode signal explicitly named: "Small enough to feel like engineering." **Specific drift this rule caught in U24 Phase A pre-push:** `console.error` format `[scope] description` (new) vs. `scope: description` (existing helpers) — fixed via commit amend BEFORE push to origin/main. Also surfaced F-cohesion-1 (toast color variance between `setQuickToast`-emerald and `showErrorToast`-amber across components) as pre-existing drift not introduced by this diff — parked for future VISION §11 cohesion pass.

- **U24 diagnosed — silent-failure pattern in bulk-end handler.** Strict bug U24 ("ended 7 plants still appear in Active Garden", reported 2026-05-13). Diagnostic chat via 2 Explore passes (1: trace read+write paths from `ActiveGardenView`; 2: find all 6 end-plant code paths) + direct code-read verification of the linchpin findings + 3 user-clarification asks (hard-refresh test, flow used, view mode). **Root cause:** bulk-end handler at [ActiveGardenView.tsx:749-773](src/components/ActiveGardenView.tsx:749). Line 757 — `await supabase.from("grow_instances").update({...}).eq("id", batch.id).eq("user_id", batchUserId)` — discards the `{data, error}` result. Whatever error Supabase returns (RLS edge, CHECK violation, network, trigger), the code continues to toast `Ended N plantings`, exit bulk mode, and `load()` (which refetches unchanged rows). User sees deceptive success + plants reappear. **All 6 end-plant code paths mapped** with mutation payloads + file:line: paths 1+3+5+6 use varied wrappers (`updateWithOfflineQueue` and direct Supabase); paths 2+4 are direct Supabase bulk-ends with error-discarded pattern. Every path writes BOTH `status` AND `ended_at` (rules out original triage causes a/b/d). **User-confirmed context** ruled out additional causes: persistent across pull-to-refresh + full app close+reopen (rules out cache/state cause c); flow used = long-press → FAB → End batch → confirm (= path #2); personal view + own plants (rules out RLS cause e). Remaining underlying-error candidates (i-iv) require instrumentation to diagnose. **Fix path scoped Phase A + Phase B:** Phase A (S-size, ships first) = add `const {error}` check + `.select('id')` row-count check at line 757 + audit 5 sibling paths for same gap + 1 new unit test on error path + Preview MCP screenshot. Phase B (depends on A) = user retries on her 7 stuck plants with instrumented build, surfaced error names the underlying cause, ship targeted fix or close as transient. Manual cleanup for the 7 stuck plants surfaces as Phase 5 ask (retry after A, OR one-off SQL update). Plan at `C:\Users\marsh\.claude\plans\three-things-to-handle-iterative-peach.md` retains both amendment rounds + 3-pass audit log. **Two amendments declared mid-chat:** (1) original recommended cause (Harvest-flow gap) disproven by user — re-audit triggered, plan revised; (2) family-view-RLS hypothesis disproven — re-audit triggered, plan revised. Audit terminated clean at Pass 3 on revised plan after both loops. Doc-only ship.

- **HarvestModal end-state realization parked as separate UX↔data gap.** Discovered mid-U24-diagnosis: [HarvestModal.tsx:99-110](src/components/HarvestModal.tsx:99) inserts a `journal_entries` row with `entry_type: 'harvest'` but does NOT mutate the `grow_instances` row. Per VISION §5 end-states, "Harvested out — ran its full course, retired (annual)" is supposed to be an end-state. Current code doesn't realize the end-state in data; only in journal. Not the cause of U24 (user confirmed she used bulk-end flow, not harvest), but is a real UX↔data gap surfaced this chat and worth fixing eventually. **Routed to VISION §11 parked items** (needs aesthetic decision: UX model A "auto-end checkbox on Harvest modal" vs model B "prompt after harvest log saves"). Should respect `is_permanent_planting` (perennial harvest = ongoing, not an end-state).

- **Plan-audit Pass 2 reframed as "Concerns / gaps / inconsistencies hunt."** User flagged 2026-05-13 mid-close-out that this chat's Pass 2 had run light — scoped to numbering / cross-refs / classifier-caveat consistency, not actively hunting for what could go wrong. Quote: *"do you not do a concerns, gaps, and inconsistencies pass? is it just wording audit? i want our audits to be relatively thorough so we are catching concerns and bugs before we implement any coding."* Diagnosis: CLAUDE.md Pass 2 description used code-shaped category names ("race conditions, async ordering, double-fire") which made the doc-batch Pass 2 unconsciously dial down to wording-check shape. **Fix locked:** (1) Renamed Pass 2 from "Semantic + edge" to "Concerns / gaps / inconsistencies hunt" in CLAUDE.md plan-audit standard. (2) Added explicit category lists per batch shape — code batch (state transitions, race conditions, async ordering, null/empty/many, missing query filters, error handling, missing imports/side effects, optimistic-UI vs refetch mismatch, RLS/auth assumptions, mobile-vs-desktop split, test coverage gaps) vs doc batch (internal contradictions, stale framing, broken cross-refs, missing destination routing, numbering/placement collisions, hierarchy gaps, dating/stamp drift). (3) Required "state hunt categories out loud before running Pass 2." Skipping the category-naming = the audit ran light. (4) Code ships specifically run more thoroughly than doc batches — production regression cost is higher than doc-drift fix cost. Saved to memory at [audit_pass2_is_concerns_hunt.md](C:\Users\marsh\.claude\projects\C--Users-marsh-OneDrive-Documents-Garden-Tracker\memory\audit_pass2_is_concerns_hunt.md) as a sister rule to `audit_passes_are_floor.md`. Doc-only ship.

- **U24 captured in BUGS.md — ended plants still showing in Active Garden.** Reported 2026-05-13 mid-close-out by user testing calendar / garden. Stamp refreshed to 2026-05-13. Step 0 search confirmed not previously captured (grepped BUGS.md / ROADMAP §3+§4 / VISION §11 / BACKLOG.md). Diagnosis deferred to next chat — read the Active Garden query path in `ActiveGardenView.tsx` + parent `garden/page.tsx`, trace where `grow_instances` are fetched + filtered. Five possible causes enumerated (not exhaustive): missing `ended_at IS NULL` filter; `status` mismatch with endPlant flow; optimistic UI; `deleted_at` vs `ended_at` conflation; household-scope mismatch. Doc-only ship.

- **Push-classifier caveat locked into CLAUDE.md push-tiers section.** During the 2026-05-13 `884cf9d` doc-only push, the auto-mode classifier (which gates every `git push origin main` regardless of file type) prompted 3 times with letter-coded reply options ("Reply `A`" / "Reply `B`") before a bare `push` landed it. The doc-only push tier rule says no per-push greenlight is needed — but the classifier may still surface a permission gate at runtime, separate from the rule. Caveat captured: extends the doc-only tier (doesn't contradict it); convention locked for future asks — frame reply concretely ("Reply `push` to proceed") so user can paste one word back, not letter codes. Doc-only ship `2cc313a`.

- **2026-05-13 calendar-testing feedback captured as ROADMAP §3.9 #9 + #10 (new 2026-05-13).** User dropped two new items while testing calendar functionality, explicitly framed as "table for later." Step 0 search: NOT directly captured but related to VISION §11 row-primitive parked decision + BUGS U13 hierarchy pattern. Both bucketed 🔵 current build, aesthetic-flagged. **#9 swipe-to-complete checkmark confirmation:** refines `cea21e0` (singleton row swipe ship 2026-05-08) + `f77507a` (consolidated row swipe ship 2026-05-10), both currently autocommit past 100px threshold + 8px direction lock. VISION §11 swipe-batch resolution direction (2026-05-08) named "left=complete, right=snooze" but didn't specify confirm-vs-autocommit — refinement of locked behavior, not contradiction. Needs user input on interaction model (reveal-checkmark? swipe-then-confirm? rubber-band-back?). **#10 restructure calendar task cards:** primary line = TO_DO verb, secondary = plant/variety, remove date except in Overdue section. Related to VISION §11 "Calendar task row primitive — bubbles vs. list" + BUGS U13 hierarchy pattern. Needs structure proposal + per-element treatment input. Numbering disambiguation: `(new 2026-05-13)` label suffix added because §4's parenthetical `(2026-05-12 #9)` / `#10` references the original 12-item 2026-05-12 batch's parked items (gallery-vs-table / growing-indicator-tags), NOT chunk 3.9 numbering — explicit suffix prevents future confusion. Doc-only ship `2cc313a`.

- **§3.9 pre-existing drift fix shipped inline.** Chunk 3.9 intro line said `**Scope (7 items):**` but listed items 1-8 (drift introduced when #8 was added). Adjacent to today's new #9 + #10 additions; fixed inline rather than leaving more broken. Updated to `**Scope (10 items: 1-8 from 2026-05-12 batch + 9-10 from 2026-05-13 calendar-testing additions):**`. Status line also refreshed to mark accurate shipped/parked/needs-input states for each item. Doc-only ship `2cc313a`. Amendment declared mid-execute + re-audited per Phase 3 amendment protocol; Pass 2 returned clean on as-written-now plan.

### 2026-05-13

- **Four minor rule items locked end-of-session.** After the rules-list provide and "are we clean" check-in, Claude flagged 4 minor items that could still be addressed; user chose to walk all 4 in this chat (per "finish in this chat" direction). All shipped: **(1) Dogfood-findings status tagging** — bucket (c) findings must be tagged just-captured / propose-rule-now / file-as-parked / file-as-bug-feature at close. Prevents finding accumulation without destination. Added to Phase 5 close-out. **(2) Capture-doc boundaries** — new top-level subsection with a reference table mapping signal-type → destination doc (VISION §9/§6/§10/§11, CLAUDE.md user-comms, ROADMAP §1/§3/§5/§6, BUGS.md, BACKLOG.md). Codifies implicit routing practice. **(3) Phase 1 trivial-Q&A short form** — 2-line declaration format added after the expanded 7-line format, with criteria for when to use which (fact-lookup/explanation/clarification + no edits + no decision). Prevents the heavy form from being skipped entirely on trivial chats. **(4) CLAUDE.md-contradiction rule** — central rule parallel to VISION.md contradiction rule, placed near "A note on session continuity." When user direction contradicts a locked CLAUDE.md rule: flag explicitly, surface trade-off, respect override if reaffirmed, amend CLAUDE.md if change is durable. No silent compliance.

- **Plan-audit cap-misreading fix locked.** User flagged 2026-05-13 (end-of-session) that "minimum 2 audit passes, 3 for state-touching" wording can be misread as a CAP on total pass-runs when intent is REQUIRED pass-TYPES. User: *"why are our audits limited to 3? i want it to continue until clean or immaterial pass."* Fix: Plan-audit standard paragraph rewritten to make explicit that 2/3 refers to pass-TYPES (Factual / Semantic+edge / Lock hygiene) required, NOT to total pass-runs. Each required pass-type runs iteratively per the iterative-loop + strict-clean-pass clauses — find concerns → revise plan → re-run THAT pass-type → loop until clean or immaterial. No cap on total pass-runs. Phase 1 protocol audit-reference line also tightened to match. Loop intent was always there (iterative-loop clarification, strict-clean-pass clause both said "loop until clean") but the "minimum 2/3" wording created surface ambiguity that contradicted the loop intent.

- **Four voyager_sanctuary adoptions locked into CLAUDE.md.** User shared the voyager_sanctuary project's rules card 2026-05-13 and asked which to adopt. Triaged 13 rules → 5 already aligned, 3 skipped (push-tier cue-drop, plan-required threshold, verbatim scope-creep template — all project-specific to voyager), 4 strong adoptions shipped, 1 modest mentioned but not yet asked. Adoptions: **(1) Strict clean-pass clause** added to Plan-audit standard's iterative-loop — "fixed inline + declared clean" doesn't satisfy the gate; pass must be re-run on revised plan from the top. **(2) Capability honesty subsection** added as new top-level CLAUDE.md section near Pre-push visual verification — Claude doesn't offer capabilities it doesn't have (no pulling mobile logs / no real-Android verify / no prod state access without WebFetch + URL). Examples tailored to GT (mobile-only PWA, Vercel deploy, debug log page workflow). **(3) Phase 1 declaration format expanded** — now includes In-scope / Out-of-scope / Success criteria fields (XS chats can use 1-liners or "n/a — Q&A only"). Explicit Out-of-scope is the counter-creep guard. **(4) 3-buckets + 2-shapes** Phase 5 close-out structure adopted alongside Rules A/B/C — every close enumerates Parked items / Deferred audits / Dogfood findings (empty bucket → "none this chat" explicitly); close-out picks Handoff shape (new chat) or In-place shape (sub-purpose mid-chat). Doc-only ship.

- **Rule C — Recommended option marker on every AskUserQuestion locked.** Every `AskUserQuestion` must mark Claude's recommended option first with `(Recommended)` appended. Applies to all `AskUserQuestion`s in chat, not just close-out. Placed in Phase 5 alongside Rules A + B. Reinforces RULES CARD #4 "Don't decide silently." User flagged inconsistency: some prior asks had the marker, others didn't.

- **Plan-audit iterative-loop language locked.** Plan-audit standard now explicitly says: audit is iterative, not one-shot; each pass that surfaces concerns triggers plan revision + re-audit of revised plan; loop runs until pass returns clean (no findings or only immaterial). Treats "minimum 2 audit passes" as the FLOOR per audit cycle, not the ceiling for total passes. Closes ambiguity that existed since 2026-05-12 plan-audit standard lock.

- **Chat Lifecycle Protocol Phase 5 amended — Rules A + B (close-out cleanliness) locked.** User flagged 2026-05-13 (same session as protocol-lock) that the just-shipped close-out was failing on the very loose-ends problem the protocol was meant to fix: three dangling recommendations from my handoff (merge strategy, UserPromptSubmit hook, next-chat purpose) described as text-mentions ("your call", "your option") rather than asked explicitly. User: *"i typically just copy/paste the handoff doc and move on at that point so i want it to clean up and tie out any loose ends."* **Rule A — Explicit-approval asks on recommendations:** any non-auto-shipped recommendation Claude surfaces must be converted to an explicit AskUserQuestion at close-out, with rule/option content **self-contained in the question text** (not just referenced by name). **Rule B — Tie-out-loose-ends gate:** Phase 5 doesn't complete until every loose end is either asked-with-answer OR queued in next-chat handoff with a clear ask attached. Vague directional language doesn't satisfy the gate. Both rules added directly inside the Phase 5 section of CLAUDE.md (alongside the uncovered-work register). Drift this session that motivated the self-contained-question-text addendum: my first AskUserQuestion referenced "Rule A" / "Rule B" by name without embedding the rule text in the question — user couldn't see the rules from the question UI view (different from chat scrollback). Now part of Rule A.

- **Chat Lifecycle Protocol locked.** Single 5-phase protocol added to CLAUDE.md stitching kickoff → plan readiness → execute (amendment = re-audit) → verification (definition-of-done) → close (uncovered-work register clean). Lowers plan-audit threshold from "non-trivial work" to every chat purpose; XS purposes get a 3-line plan + ~60-90s audit. Closes all four drift shapes the user named (purpose / plan-amendment / premature-done / lost-thread close-out). RULES CARD #3 reworded to point at new section. **Compliance-enforcement layer:** "Phase declarations" subsection requires Claude to output the active phase in text at three trigger points — chat open (3-line block), every phase transition (1-line), every plan amendment (1-line). Missing or wrong declaration = visibly skipped phase, catchable by user in seconds. Replaces the "user has to keep reminding Claude of the rules" failure mode with self-narration the user can verify pass-by-pass. Recovery clause: when the user does have to remind, Claude acknowledges briefly, declares the missed phase, executes the gate, moves on (no defensive apology). Override clause: trivial Q&A exempt from declarations; anything touching code/docs/commits/pushes must declare. Plan file at `.claude/plans/okay-im-running-into-delegated-boole.md` retains full 2-round audit trail (10 findings resolved across both rounds). Doc-only ship, no code touched.
- **§3.10 R1-R5 doc-drift batch shipped (`884cf9d`).** Single doc-only commit closing the five strict drift items the user-delivered audit flagged 2026-05-12. **Pattern variance:** BUGS.md U1+U3 closures used inline `✅ Fixed (verified date)` annotations matching U21-U23's in-file convention, rather than the audit's "move to Resolved (Closed)" recommendation. Reason: less structural churn, U-numbers stay anchored for historical reference, matches already-shipped pattern. Surface for any future audit that re-suggests the "move" approach.
- **R5 lock-hygiene note.** VISION §11 icon-density entry — only the factual count was edited (`~25+` → `42`, manually counted in `ICON_MAP` at `src/lib/styleDictionary.tsx:484-526`); the parked-decision substance (stroke 1.2 canonical recommended; `styleDictionary.tsx` as larger library; counter stroke 2.0; parked awaiting user) is untouched. No silent overstep on a parked decision. 3-pass plan-audit triggered Pass 3 specifically to gate this brush.
- **§5/§6 ROADMAP entries split into follow-up log commit.** Rather than including the §5 Recently-shipped + §6 Decision-log entries in the R1-R5 ship commit (which would have required a `<this commit>` placeholder for its own hash), split into a follow-up `docs:` log commit so the §5 entry can reference `884cf9d` directly. Mirrors the `3de1c2c` ship + `c744c8b` log pattern from 2026-05-12.

### 2026-05-12

- **User-delivered doc audit received and triaged into §3.10.** External audit (possibly run in another Claude session) flagged 7 🔴 strict drift items (test count 329 vs 387, WORKFLOW.md "Seed Vault" stale name, BUGS U1+U3 silently fixed, BUGS+VISION stale stamps, icon count ~25+ vs 42), 3 🟠 structural items (PROJECT_STATUS.md canonical-vs-archived ambiguity, WORKFLOW.md missing 5 procedural rules from 2026-05-11/12, BACKLOG.md `.cursor/plans/` ref), and 2 🟣 future items (~30 legacy docs disposition, optional `.claude/settings.json` setup). All cross-referenced — most are new captures. Strict fixes (R1-R5) ready to ship as one doc commit in next session; structural fixes (R6-R8) + future (D1-D2) need scoping decisions. Audit document itself is preserved in this session's transcript.
- **Chunk 3.9 #2 + #4 batch shipped (`3de1c2c`).** Two XS fixes bundled per WORKFLOW §"Batching small fixes." **#2 calendar arrows:** hidden below `xl:1280px` via `hidden xl:flex` matching B1/B2 family. Alternative breakpoints considered: `lg:1024px` (would split iPad-landscape inconsistently with the rest of the desktop pass), always-hidden (would require keyboard-arrow nav on desktop — out of scope). `xl:` won on cohesion grounds. **#4 garden trigger icon:** swapped to `ICON_MAP.Edit` (pen with motion). Alternatives `Journal` (lined paper), `Pencil`, and a new composite `Journal+Plus` overlay were considered; `Edit` won on (a) zero new icon work (already in styleDictionary), (b) strongest "log/write" semantic, (c) visually distinct from all 10 entry-type markers (no basket curve, no leaf, no droplet). Scope A locked over Scope B (also retag the `care` marker) and Scope C (full entry-type vocabulary audit) — user opted for minimal scope. The secondary cohesion question (Harvest basket + JournalCareHands cupped curve reading as same family within the entry-type set) is now visible and noted for future Phase 6 design-system pass.
- **ROADMAP §3.9 #3 (garden card spacing) parked for future batch.** User identified the empty-space-below-short-names issue, Claude diagnosed `min-h-[1.75rem]` on the h3 at `ActiveGardenView.tsx:1075` as the root cause, and 3 fix options were surfaced with trade-offs (remove min-h / reduce / move space via justify-end). User opted to think through the alignment-vs-tightness trade-off in its own batch rather than bundle with #2+#4. Parked entry in §4 preserves the full diagnosis + options so future-Claude doesn't re-discover them.
- **ROADMAP §3.9 #4 mis-triage learning.** During the 2026-05-12 12-item batch triage, the user's "bag icon" feedback was assumed to be the shopping-list icon in the mobile header. Actual surface was `JournalCareHands` on Garden plant cards (at small sizes the cupped-hands silhouette reads as a basket/bag). Mismatch surfaced when planning chunk 3.9 #4 — Claude initially walked through shopping-list icon candidates (cart/basket/checklist/clipboard); user corrected to the garden trigger surface. Reinforcement of the existing "search existing captures FIRST + clarify ambiguous items before locking triage" rule — when a vague visual cue ("bag") could plausibly map to multiple surfaces, ask user to clarify the surface during triage. Captured here for decision-log visibility, not in CLAUDE.md (rule already exists).
- **Calendar expand-all toggle shipped (`6d76c20`, chunk 3.9 #1).** First chunk-3.9 build item shipped after journal-search. Master state derived from existing `expandedDateGroups` Set (no new state shape). `allDateKeys` memo lists "overdue" (if any tasks) + every date in `byDate` + today if it has completed-only. Button hidden when `allDateKeys.length === 0`. Smooth content animation via `grid-template-rows: 0fr ↔ 1fr` transition — chosen over `max-height` hack (which requires arbitrary upper bound) because content height varies wildly per section. Animation applies to both master and per-section toggles for consistency — would have created jarring inconsistency to animate only one. Initial render at default-collapsed doesn't animate (CSS transitions skip first paint), so the page-load behavior from `a7dadb7` is unchanged. Pre-push mobile-viewport check via Preview MCP attempted per rule `aad2e56` but Calendar is behind `AuthGuard` → redirect loop → skipped per the rule's documented "auth-blocked" condition. Build error during execution (`ICON_MAP is not defined`) was caught by `npm run build` and fixed before push; surfaced the new plan-audit standard's Pass 1 factual rubric (`eea6a84`).
- **Plan-audit standard locked (`eea6a84`).** Three-pass taxonomy with concrete content per pass (Factual / Semantic+edge / Lock hygiene). Min 2 passes baseline; 3 passes for contexts / nav / locked-decision changes. Plan file required at ≥3 files or state-machine changes. Explore agent at >5 files. Mid-session scope additions need fresh Pass 1+2+3. User explicitly flagged this as the pattern she most often re-enforces; codifying the rubric removes ambiguity in "loop until clean."
- **Pre-push visual verification rule locked (`aad2e56`).** Preview MCP mobile-viewport check required on visual ships (`.tsx`/`.css` diffs). Honest about what it catches (general layout, console errors, overflow) vs what it doesn't (Android Chrome 100vh quirk, webkit pseudos, hardware back). Skip conditions documented (auth-blocked, cold start >60s, pure logic).
- **FAB UX fix batch shipped (`79836f4`, U22 + U23).** Two user-reported fixes bundled per WORKFLOW.md "3-5 small fixes" cadence and shared surface (FAB). **U22 — Android back closes FAB:** wired `useModalBackClose` on 4 pages where `skipPopOnNavigateRef` was orphaned (already declared and set on 28+ nav handlers but never read by a hook). Discovery: a prior session built half the infrastructure; this fix completed it. Vault unchanged (correct via umbrella pattern). **U23 — FAB viewport cutoff:** root cause was `top-1/2 -translate-y-1/2 max-h-[85vh]` on Chrome Android where `100vh` reflects the idealized URL-bar-collapsed viewport, not visible space. Switched to flex-wrapper + `max-h-[85svh]`. Animation/backdrop preserved. Trade-off recorded: Android back on add-plant sub-screen closes the whole FAB rather than going up one level — matches user's explicit "close FAB" ask; in-menu Back button still works for sub-level nav. Rejected alternative: putting `useModalBackClose` inside `UniversalAddMenu` itself — would double-pushState on Vault (umbrella pattern already covers `addMenuOpen`) and violate the existing regression-test rule "child must not duplicate parent's back-close" (`calendarBatchSelect.regression.test.ts:202-204`). 5-pass plan-audit terminated clean.
- **U21 fix shipped (`fb67e10`).** Only follow-up bug from `7482c59` journal-search ship now closed. CSS-only suppression via `[&::-webkit-search-cancel-button]:appearance-none` Tailwind arbitrary variant. Rejected alternatives: switching to `type="text"` (loses search semantics + history dropdown + mobile keyboard "Search" key) and removing the custom X (regresses iOS Safari which doesn't render the native button). Scope locked at journal (1 file, 1 line) after app-wide audit of 7 `type="search"` inputs confirmed only journal had a manual clear-X duplicate. Pattern documented inline; no shared utility extracted per "don't add abstractions beyond what the task requires." 4-pass plan-audit terminated clean.
- **CLAUDE.md restructure: top-of-doc Rules Card added.** Multiple drift events this session signaled that load-bearing rules were buried inside ~400 lines of CLAUDE.md and being missed during turn-by-turn responses. Added a 🪪 RULES CARD section at the top of CLAUDE.md as the first thing future-Claude reads each session. 8 bullets covering: required reading, feedback-batch Step 0 search, plan-audit-build cadence, aesthetic decisions, PM/feature-creep enforcement, push tiers, end-with-where-we-are, session-switch signals. Card links to detail sections below for "why" and "how." Plus: created `docs/CLAUDE_CODE_SETUP.md` with paste-ready `.claude/settings.json` snippet for an optional `UserPromptSubmit` hook that injects the rules card into every prompt — user-owned, user-enables. Structural fix for the "Claude keeps drifting from rules I locked yesterday" problem the user flagged in this session.
- **Debug log page shipped (`ed5441c`).** Built specifically so user can copy-paste captured console output into bug-report conversations (no screenshots of tiny phone text). Scope: 50-entry rolling buffer in sessionStorage, captures log/warn/error, page UI with Copy/Refresh/Clear. Explicitly DEVELOPER TOOLING, not user-facing feature — bounded scope (no filters, no persistence across reload, no network/render-warning capture, no enable-disable UI). Reusable for future bug-debugging. Per the PM/feature-creep rule the user locked earlier today: this was initially push-back'd as feature creep, then re-evaluated because (a) tooling for the build process ≠ user-facing product feature, (b) user pushed back on push-back with clear use-case (copy-paste workflow), (c) scope guardrails kept it bounded.
- **New procedural rule locked: PM enforcement on feature creep / off-track requests.** User explicitly framed Claude as "project manager and coder" and asked for enforcement when requests pull project off-track. Captured in CLAUDE.md "Feature creep enforcement" subsection. Behavior: push back plainly, propose deferral, surface scope, then respect override if user wants it anyway after hearing cost. Reinforces existing "Push back when needed" project-lead obligation.
- **Journal search shipped (`7482c59`).** First item shipped from chunk 3.9 (2026-05-12 batch). Search field above view-toggle row matching Vault/Garden pattern. Multi-token AND, fields: note, entry_type (underscore-stripped), plant_name + display_names, formatted date. All three view modes. Pure filter function in `src/lib/journalSearch.ts` (testable without React). 8 new vitest cases (378/378). 3-pass plan-audit + 2-pass self-audit, both clean.
- **Decision: multi-token AND match.** "tomato 4/21" only matches entries with BOTH "tomato" AND "4/21" somewhere in searchable fields. Conventional for filter-as-you-type search.
- **Decision: no derived-action-label in search haystack.** Could include "Planted"/"Harvest"/"Care" labels derived from `getActionFromNote`, but it'd duplicate that logic in the search helper. Instead, the raw `entry_type` (with underscores → spaces) is in the haystack, and most notes contain the action verb naturally. Edge case: entry with null note and entry_type "planting" won't match query "planted" (substring miss). Acceptable for v1; refine if user reports.
- **Decision: no clear-X button matches Vault... no wait, added clear-X.** Vault doesn't have a manual clear-X (relies on browser native for type="search"). Journal adds a manual clear-X for consistent UX on iOS Safari (where native clear doesn't appear). Minor deviation from Vault; can backport later if cross-app consistency matters more.
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
