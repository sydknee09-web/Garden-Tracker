# Garden Tracker — Vision & Design Source of Truth

> **Read this file at the start of every session.** It captures the user's vision, preferences, and decisions across chats so we build coherently from one session to the next. Updated continuously as we work.
>
> Conventions used in this doc:
> - **User signal (verbatim or paraphrased)** — preserves what the user actually said
> - *My recommendation* — Claude's input, clearly labeled, subject to user override
> - **Open question** — parked decisions waiting on user input
> - ✅ active scope · 🕐 long-term aspirational · ❌ not ever · 🤷 don't know yet

---

## 1. Vision statement (v4 — locked 2026-05-08, Phase 1)

### Core
Garden Tracker is a comprehensive home garden management app that tracks every seed, plant, supply, and garden bed through its full lifecycle — building a reliable personal "what works for me" library, year over year, whether you're a beginning gardener or a pro. For you, your household, and your trusted circle of fellow gardeners.

### What it does
- **Memory plane** — deep inventory history, action history, variety evaluation, cross-season comparison
- **Active management plane** — tasks, growing-cycle monitoring, micro-climate-aware alerts, recurring care reminders, shopping list
- **Four roles in one app** — your personal database, your gardening encyclopedia, your in-context advisor, your inventory management hub

### Product scope (boundaries)
- Multi-tenant with private household and trusted-circle sharing — including gardening clubs
- Trades between circle members are tracked with full history; never public, no stranger marketplace
- For home gardeners across the full skill range; complexity unfolds with data, not skill level

### Operating principles
- Mobile-first responsive web (PWA) with first-class desktop
- Cost-driven freemium: AI features, beyond-limits usage, and multi-circle coordination are paid
- Cohesion is a quality bar — the app should feel like one product

---

## 2. Plain-language framing (alternate / elevator pitch)

For moments when someone asks "what's Garden Tracker?" in 30 seconds, or for future marketing copy. Not the canonical vision — a supplementary framing that highlights the differentiator.

> **A garden tracker that gets smarter with you.** Every seed you buy, every plant you grow, every pest you fight, every harvest you weigh becomes part of your personal "what works for me" library — a reliable record that compounds year over year. For home gardeners — beginner through expert — solo or with a trusted circle of household, friends, family, or gardening clubs. Phone in the garden, computer at the kitchen table. Invite-only, never public, never strangers.

The moat: *accumulated personal knowledge*. Year 5 in Garden Tracker is fundamentally more valuable than year 1, in a way most apps can't claim.

---

## 3. App identity

Garden Tracker is a **multi-tenant gardening management product** for home gardeners, built by a non-developer with help from Claude. The user is the product visionary; Claude is the build partner.

**Tone:** Calm, polished, useful. Not flashy. Not clinical. The app should feel like it respects the user's attention and time.

**Audience model — three layers:**

1. **Self.** The core user. Personal seed inventory, plant management, daily use.
2. **Household.** People who share a single account / live together and tend the same garden. Full read+write sharing. (Currently the "Family" view.)
3. **Trusted circle.** Real-life family and friends who garden their own plots and want cross-visibility for swapping seeds, coordinating, etc. Invite-only / known people. Can scale to organized groups (e.g. gardening clubs) — same principle, larger group. **Boundary stays at people you've personally invited; never public.**

**Three user modes (one user can be all three across time):**
- **Beginner** — needs to learn; the app's empty-by-default state acts as soft onboarding
- **Advanced** — needs management + memory; tracks depth across seasons
- **Spring planner** — anyone designing their seasonal garden

The app uses **disclosure-by-data**, not skill-mode toggles. A user with 0 plants sees a simple add-your-first-plant prompt; a user with 50 plants and 3 seasons sees harvest stats, recurring tasks, year-over-year comparisons. Features unfold as data unfolds.

---

## 4. Operating principles

These govern every decision in this codebase.

1. **The user is the product visionary, not the engineer.** Their vision drives what gets built. Claude's recommendations are starting points, not specifications.
2. **Don't make aesthetic / UX decisions without asking.** Visual hierarchy, color choices, density tradeoffs, what to emphasize — all subjective. Claude proposes options; user picks.
3. **Strict bugs are OK to fix without asking.** Truncation, broken behavior, objective inconsistency — anywhere there's a single correct answer. Anywhere reasonable people could disagree on the solution requires asking.
4. **Plan + audit before building** for any non-trivial work. Plan → audit (find issues) → resolve → clean pass → user greenlight → build. (See `WORKFLOW.md`.)
5. **Batch small fixes.** XS-S visual fixes go out 3-5 at a time per deploy, not one-by-one.
6. **Task fatigue is the enemy.** When the user feels overwhelmed by data volume, the answer is presentation (default windows, grouping, lazy loading) — not removing features.
7. **Cohesion as a quality bar.** The app should feel like one product, not a collection of pages. Cohesion is required, not optional.
8. **Continuity matters.** This file exists so the user doesn't have to re-litigate decisions across chats. Claude updates it as we work.
9. **Build mobile-first with desktop responsiveness in every commit.** *Locked 2026-05-08.* Mobile-first per the original operating principle (§1), but desktop responsiveness is built in *the same commit*, not deferred to a later "desktop pass." Use Tailwind responsive utilities (`lg:` etc.) to handle device differences inline. The user only test-loops on phone, so phone is where UX gets evaluated; desktop gets the structural bones from day one and a focused visual-polish pass once mobile UX is mature. Why: avoids accumulating debt where mobile-only patterns lock us out of clean desktop behavior. Worked example: row quick actions = swipe on mobile, inline buttons on desktop (one commit, both surfaces handled).

---

## 5. Lifecycle paths

Garden Tracker treats different ways a plant enters your garden as distinct lifecycles, each with its own stages, metrics, and UI:

- **Growing from seed (primary depth)** — full journey: seed packet → sown → germinated → seedling → up-potted → planted out (with branching: a single batch can split across multiple beds, be partly gifted, partly culled) → grown → harvested → evaluated. Includes germination rate, batch operations, full end-state recording.

- **Established plants (acquired ready-to-plant)** — purchased, gifted, dug up. Tracks acquisition → establishment care (distinct from regular care, time-bounded) → regular care → grown → harvested → evaluated.

- **Division / propagation (lighter weight)** — cutting or division from an existing plant, rooted, then planted out. Treated as a special acquisition source rather than a full distinct lifecycle.

**The app should not force seed plants and acquired plants into the same lifecycle template.** Each path has its own depth and tracking needs.

**Plant end-states** (a growing instance can end in any of these):
- **Harvested out** — ran its full course, retired (annual)
- **Culled / died** — removed before natural end
- **Transferred** — gifted, swapped, sold (recorded with recipient + date, persists in originating user's history)
- **Still active** — currently growing
- **Dormant / overwintering** — paused, expected to resume

---

## 6. Failure modes to defeat

The app fails the user when these occur. Each is a roadmap signal — closing these gaps is what *delivers* on the vision.

### Theme 1 — Lifecycle / batch-tracking gaps
Today, seedlings fall into the same bucket as established plants. The vision needs a real *batch concept* with its own lifecycle. Specific gaps:
- Starting a batch (e.g. 10 tomato seeds sown 3/15) doesn't get its own status
- Germination rate tracking missing (# seeds started vs sprouted)
- Up-potting workflow gap (transition from tray to individual pots)
- Splitting & planting out (3 to bed A, 2 to bed B, 2 given to sister, 0 culled — fan-out from a batch)
- Easy "cull / kill" workflow
- Transfer / give away / trade across users (including between household and trusted circle)
- Re-finding a plant from a 6-week-old batch when it's ready to harvest

### Theme 2 — Plant profile shallow for growing
Profile page works for ID + description but not as a growing companion. Missing:
- Establishment care vs. regular care templates (today user manually sets each up)
- Deeper growing data than just metadata
- (More feedback pending from user's sister)

### Theme 3 — Micro-climate timing untrusted
User's sister: "doesn't feel that the app is reliable for what to plant when." ZIP-code or zone-level data is too coarse for Vista's microclimate reality (coastal vs inland, valleys vs hillsides, frost pockets vs heat islands within miles). **Foundational reliability issue.** Without trustworthy hyperlocal data, advisor mode can't deliver.

### Theme 4 — Disorientation ("user gets lost")
The user's actual word: *"lost."* Even when the data exists in the app, finding and traversing it is hard. Three structural causes:
1. **Inconsistent visual language across surfaces** — user can't pattern-match between pages
2. **Unclear information architecture** — related entities (Plant Profile ↔ Growing Instance ↔ Tasks ↔ Journal ↔ Harvest) exist in data but navigation paths aren't obvious
3. **Mental-model mismatch** — user thinks "show me my plant's history" but the profile is shallow; history lives elsewhere

The user should never feel lost. Cohesion (Operating principle 7) is the long-term answer.

---

## 7. By surface

### Home
**Vision (sketch):** Home page should be **context-aware**, surfacing what's relevant *right now* — not a fixed dashboard.
- December: seed inventory + planning
- March-April: seed starting + spring planting
- Summer: active management, harvest tasks
- Fall: harvest finishing, journal review
- Sick plant flagged: care plan visible
- Recently bought new plant: that plant's setup card surfaces

*Detailed page goals deferred to Phase 5.*

### Vault (Plant Profiles, Packets, Shed)
- **Plant placeholder asset:** `/public/plant-placeholder.png` (the three-leaf PNG). Canonical placeholder; not the SeedlingIcon component.
- **Placeholder container background:** `bg-white`. Matches the PNG's white background — no visible seam.
- **Vault grid card layout:** 3 cards per row.

**Shed (inventory hub):**
- Track current supply inventory (what you have, in what quantity)
- Track application schedule per supply (when last applied, when next due, by plant or by bed)
- Surface upcoming applications in the active task queue so nothing is missed
- Detect when supplies are running low / depleted (running-out threshold)
- Connect to the shopping list automatically when something runs out

**Open question (parked 2026-05-07):** Cross-view consistency between Vault Plant Profiles grid, Garden Active Garden gallery, Garden My Plants list. User flagged that names are legible across all three but layout/format/text style differ.

### Garden (Active Garden, My Plants)
- **Active Garden gallery cards:** Names should NOT clip from both sides (a `truncate` + center-aligned bug). Use `line-clamp-2` instead so longer names wrap to two lines.

### Calendar
**Vision:** The Calendar is the only place tasks live and get completed. It's where the user finds out what to do today/this week, and where work gets checked off. Not a passive view — it's where work happens.

**Preserved decisions:**
- **Grid as primary check-in surface (2026-05-08).** The month grid at the top is the "do I have stuff today / coming up" overview. Don't compact, don't demote, don't reskin without asking.
- **Task list = the meat (2026-05-08).** Below the grid is the actual doing. Reducing the FEATURE set is not the answer; the problem is density / fatigue.
- **Plantable widget separation (2026-05-08).** Plantable is planning info, intentionally NOT mixed into tasks or the calendar grid. It's a popup. Preserve this separation.
- **Plantable visual treatment (2026-05-08).** Original (pre-U18) treatment: green-tinted card with green text. Don't reskin without asking.

**Open question (parked 2026-05-08):** Task fatigue approach — default-to-today-or-this-week, group-by-day, collapse-completed, lazy-load older completions. Multiple sub-decisions also parked.

### Journal
*No specific signals captured yet beyond connection to action history.*

### Shopping list (active management plane)
Multi-purpose, multi-trigger:
- **Auto-populated** when supplies in the shed run low ("you're running low on neem oil — add to shopping list?")
- **Manually added** during spring planning ("I need 5 tomato varieties + bone meal + drip irrigation supplies")
- **Persistent across sessions** — survives between use; doesn't reset
- Could connect to vendor history ("you bought this from Seed Savers last time")
- Could feed into trusted-circle visibility ("your sister has tomato seeds in stock — does that satisfy your need?")

### FAB & Modals
**Vision:** The FAB ("+" button) is the universal entry point for adding things. Its menu and the modals it opens should feel snappy, polished, and consistent.

**Preserved decisions:**
- **Three transition languages (approved 2026-05-08).** See Section 8 — Design Tokens — Transitions.
- **No perceptible gap when transitioning from menu to target modal (2026-05-08).** The menu disappearing and the next surface appearing should overlap so the user never sees an empty screen.

**Open questions (parked):**
- **FAB main button vs. submenu icon style consistency.** User reported icon weights differ. Decision pending: canonical stroke weight; whether FAB main is intentionally heavier or matches submenu.
- **Save / Cancel button consistency across modals.** NewTaskModal uses stacked Save-on-top + Cancel-below; QuickLogModal uses side-by-side Cancel-left + Save-right. *My recommendation: side-by-side, Cancel-left, Save-right, using the `bg-emerald` brand token.*

---

## 8. Design tokens

Locked-in pieces. Reference before making changes; update only when the user explicitly changes a decision.

### Plant placeholder
- Asset: `/public/plant-placeholder.png` (three-leaf PNG)
- Container background: `bg-white`
- Container shape: `rounded-xl` with `overflow-hidden`
- Helper to detect placeholder URLs: recognizes both legacy `/seedling-icon.svg` and current `/plant-placeholder.png`. Used in `PlantImage.tsx`, `PlantPlaceholderIcon.tsx`, and 5+ other files.

### Transitions (FAB & modals)

Three transition languages, each conveying meaning:

| Move | Visual | Duration | Meaning |
|---|---|---|---|
| FAB → primary menu opens | Fade + scale up from FAB origin | **200ms in** | "This menu came from the button you tapped" |
| Primary menu close | Reverses (fade + scale toward FAB) | **150ms out** | Mirror — exits run faster |
| Primary menu → in-place submenu (e.g. Add Plant) | Horizontal slide left | **200ms** | "Going deeper in the same flow" |
| Submenu → back to primary menu | Horizontal slide right | **200ms** | "Going back" |
| Primary menu → target modal | Menu fades out as new modal slides up from bottom (overlap) | **200ms total** | "New context — its own surface" |
| Target modal close | Slides down out of view | **150ms out** | Standard sheet dismissal |

**Asymmetry pattern:** Entries 200ms, exits 150ms. Once a user dismisses, faster exits respect their time.

**Implementation:** Pure CSS keyframes in `globals.css`. No new dependencies.

### Colors / brand
- `bg-emerald` (brand emerald, defined in tailwind config) is the canonical primary action color. Not `bg-emerald-600` (Tailwind direct) — *recommendation pending user confirmation, defaulting to brand token for consistency.*

### Beds as first-class entity (architectural decision)
**Locked 2026-05-08.** Each garden bed is a distinct entity with its own profile, identity, and lifecycle. Growing instances belong to beds (one-to-many: a bed can hold multiple growing instances, including polyculture). Tasks, soil tests, photos, and history can attach at the bed level OR at the growing-instance level.

**Implementation deferred to Phase 3 (Information Architecture).** That phase will design data model, migration of existing location strings, bed detail page, and update of all dependent surfaces. Today, the vision-level commitment is what's locked.

**Cascading effects:**
- Soil testing per bed becomes natural
- Lifecycle workflows (split batch to 3 places) have destination entities
- Bed layout (long-term aspirational) has a clearer entry path

---

## 9. Scope categorizations

Three-tier scope:
- **✅ Active scope** — currently building, maintaining, or part of near roadmap
- **🕐 Long-term aspirational** — wanted eventually, sized appropriately, parked but not killed
- **❌ Not ever** — explicitly NOT going to be Garden Tracker; defines the boundary

| Feature | Status | Notes |
|---|---|---|
| **Cross-account exchange — public feed / strangers** | ❌ | The foundational "no public" boundary |
| **Cross-account exchange — Level 5 (public marketplace)** | ❌ | Strangers transacting |
| **Cross-account exchange — Level 4 (paid transactions in trusted circle)** | ❌ | Money/payments not for Garden Tracker |
| **Cross-account exchange — Level 3 (trade history records)** | ✅ | Trades within trusted circle update both inventories with full history; "transferred" end state in originating user's record |
| **Recipes / meal planning** | ❌ | Cooking domain; lives elsewhere |
| **In-app static content library / blog articles** | ❌ | Operationally heavy; external resources cover this |
| **Direct hardware brand integration** | ❌ | Brand-by-brand integration is endless |
| **Plant identification camera** ("what plant is this?") | 🕐 | User would value if accuracy were meaningfully better than existing tools (PictureThis, Google Lens). Not differentiating today. |
| **Pest / illness ID camera + Q&A + treatment recs** | 🕐 | High-value, integrates with care plans + shed inventory; differentiator. Likely paid tier when built. |
| **Soil test result tracking** | 🕐 | pH, NPK, etc. with trends. Where it lives depends on beds-as-entity (Phase 3). |
| **Garden bed layout / spatial design** | 🕐 | Significant scope; foundational entry path now exists via beds-as-first-class. |
| **Encyclopedia entries integrated with data** | 🕐 | Pest/variety/condition reference content surfaced contextually from user data |
| **Engagement / push content (articles, seasonal guides)** | 🕐 | OPTIONAL. Off-season retention + spoon-fed learning. Likely paid tier. |
| **Contextual tips on relevant screens** | 🕐 | Inline micro-tips (e.g. "tomatoes prefer well-drained soil") |
| **Generic data import (CSV / webhooks for sensor data)** | 🕐 | Lets users with hardware bring data in without building brand integrations |
| **Micro-climate triggers** (hyperlocal frost, heat, weather alerts) | ✅ | Anchored to user's actual garden, not ZIP-code regional. Foundational for fixing Failure Mode #3. |
| **Soil amendment applications** | ✅ | Already core via existing supply + action history |
| **Beds as first-class entity** | ✅ (foundational) | Implementation in Phase 3 |
| **Cost-driven freemium** | ✅ (principle) | Free where cost is fixed; paid where cost scales (AI, beyond-limits, multi-circle) |

---

## 10. Don't-touch list

Things the user has explicitly liked. Do not change without asking, even if Claude has a "better" idea.

- **Plantable banner color treatment** (green text on green-tinted card). Pre-U18 visual.
- **Calendar grid prominence** (the month grid as the primary check-in at the top of Calendar page).
- **Plantable widget separation from tasks/calendar grid** (it's a popup, deliberately not merged in).
- **Plant placeholder PNG** as the canonical placeholder image.
- **Active Garden gallery card** existence as a view (the bug was clipping, not the view itself).
- **Empty-by-default onboarding** — the app starts blank for new users; that IS the soft onboarding. Don't add notifications/tasks/state by default.

---

## 11. Open decisions / Phase 3 deferred items

Items deferred to a later session, with the WHY of deferral preserved.

### Phase 3 (Information Architecture)
- **Beds as first-class — implementation.** Data model, migration, page design.
- **Plant database moderation philosophy.** Per-user vs shared canonical vs hybrid (curated + user-extension + suggestion queue). Concern: pollution, inappropriate content, duplicates. *My recommended approach: hybrid (curated canonical + private user extensions + suggestion queue).*
- **Growing instance representation.** Now somewhat resolved by beds-as-first-class, but exact relationship (instance-belongs-to-bed; quantity per instance; etc.) needs detail design.

### Other parked items
- **Calendar task fatigue approach** (partially unparked 2026-05-11; remainder still deferred). **Locked & shipped 2026-05-11 (`a7dadb7`):** default-collapse rules on Calendar load — overdue=collapsed, today=open, all other days=collapsed. Count badges on collapsed headers preserve at-a-glance scan. Tap-grid-day still switches to existing single-day view (preserved, not eliminated). Still parked: group-by-day reflow beyond the current per-date sections, collapse-completed-today auto-hide, lazy-load older completions, Today/Week vs full-month default window.
- **Cross-view consistency: Vault grid / Garden gallery / My Plants list** (deferred 2026-05-07).
- **Too many places to edit a plant's image** (in `BACKLOG.md`, deferred 2026-05-07).
- **App-wide icon density / canonical stroke weight** (raised 2026-05-08 as "FAB icon consistency"; widened 2026-05-11 after the same issue surfaced in the new sidebar nav). Two icon libraries collide in the app: `navItems.tsx` (24×24, stroke 2.0, 5 primary nav icons) vs `styleDictionary.tsx` (24×24, stroke 1.2, 42 icons used app-wide in FAB, modals, headers). Sidebar today renders four distinct rendering systems in one component: primary nav (24×24 @ 2.0), Shopping list (20×20 @ 1.2), Settings/Feedback (20×20 @ 2.0), Help (text glyph `?`, not an SVG at all). *Recommended direction: standardize on stroke 1.2 + render 24×24 + convert Help to SVG — because `styleDictionary.tsx` is the larger library, so picking 1.2 as canonical pulls the rest of the app toward sidebar (less rework long-term). Counter-option: stroke 2.0 canonical. Awaiting user decision on canonical stroke weight.*
- **Save / Cancel button consistency** (raised 2026-05-08). Stacked vs side-by-side; `bg-emerald` vs `bg-emerald-600`.
- **Calendar task row primitive — "bubbles vs. list"** (raised 2026-05-08). User flagged that `CalendarTaskRow` reads as cards/bubbles (rounded-xl + white bg + emerald border + drop shadow) rather than as list items, and that this contributes to density-fatigue on the calendar page. *Resolution direction (2026-05-08): mobile gets swipe gestures (left=complete, right=snooze) and inline buttons hide; desktop keeps inline buttons. Plan-audit clean; awaiting build greenlight.*
- **Modal/menu placement on desktop** (raised 2026-05-08). User flagged that the FAB Add menu (and likely other phone-style modals: NewTaskModal, QuickLogModal, snooze sheet, batch reschedule sheet, batch delete sheet) renders as a centered floating card at fixed widths on desktop, which feels wrong on a wide screen — it's a phone bottom-sheet pattern bleeding into desktop. *My recommendation: per Principle 9 (mobile-first with desktop responsive), audit all phone-style modals; on `lg:` screens they should either anchor near their trigger (popover-style) for the FAB menu, OR cap width and add proper desktop framing (centered modal with backdrop) for full-screen sheets.*
- **Desktop layout — calendar oversized + bottom nav feels mobile-y + empty horizontal space** (raised 2026-05-08; ACTIVE since 2026-05-10 with B1 + B2 shipped 2026-05-11). User flagged that on web browser: (a) the calendar grid is oversized for the viewport (~280px-wide cells on 1920px screens), (b) shrinking the calendar leaves a lot of empty horizontal space, (c) the bottom nav bar feels phone-y on desktop. **Active build pass** is the Phase 4+5 desktop layout pass — see ROADMAP §3.2. Breakpoint locked at **`xl:` (1280px)** so iPad-landscape stays on mobile-style; sidebar appears on every page in the pass, but two-column right-column treatment is **Calendar-only** for now (other pages stay single-column until Phase 5 designs their layouts). Milestones B1 (App shell + sidebar nav, `e61ffdc`) and B2 (Calendar two-column, `8624c8d`) shipped. B3 (FAB → popover), B4 (modal/sheet desktop treatment), B5 (per-page audit) queued. Sidebar shape locked: 240px expanded ↔ 64px collapsed, chevron toggle persists to localStorage; five primary nav items reused from BottomNav; Shopping list / Help / Settings / Feedback in sidebar footer (they're utilities, not sections); slim top header retains cloud-sync + page title + household toggle. Calendar two-column shape locked: left 640px sticky at `top-12`, gap-6 (24px), right `flex-1` capped at `max-w-[720px]`.
- **HarvestModal end-state realization** (raised 2026-05-14, discovered during U24 diagnosis). [HarvestModal.tsx:99-110](src/components/HarvestModal.tsx:99) only inserts a `journal_entries` row with `entry_type: 'harvest'`; does NOT mutate the `grow_instances` row. Per VISION §5 end-states, "Harvested out — ran its full course, retired (annual)" is supposed to be a plant end-state; current code doesn't realize the end-state in data, only in journal. NOT the cause of U24 (user used bulk-end flow), but a real UX↔data gap. Needs aesthetic decision: **(A)** add a "this plant is finished" checkbox to the Harvest modal; if checked, also write `{status: 'harvested', ended_at: now, end_reason: 'harvested'}` to the grow_instance, OR **(B)** always show a follow-up "Is this plant finished, or still growing?" inline prompt after harvest log saves. Either model must respect `is_permanent_planting` (perennial harvest = ongoing, NOT an end-state offer). *Recommended direction: (A) auto-end checkbox — fewer modal hops; default-checked for annuals (`is_permanent_planting=false`), hidden for perennials.*
- **Sister's additional feedback** (pending). Will fold in when received.

---

## 12. Recent signals (rolling log)

Last several pieces of feedback from the user, in case any didn't make it into the right section above. Acts as a safety net. Most recent at the top.

- **2026-05-14:** **U24 Phase A shipped (`7207164`) + cohesion-by-aggregation rule locked.** Phase A code fix landed: silent-failure pattern in bulk-end handlers fixed across 3 handlers ([ActiveGardenView handleBulkEndBatch line 757](src/components/ActiveGardenView.tsx:757) — direct supabase with `{data, error}` destructure + `.select("id")` row-count check; [MyPlantsView handleBulkEndBatch line 486](src/components/MyPlantsView.tsx:486) — `updateWithOfflineQueue` destructure; [GrowInstanceModal handleArchive line 414](src/components/GrowInstanceModal.tsx:414) — added err else-branch via `showErrorToast`). Loop-with-hadError pattern matches existing siblings. Sibling cohesion: 4 existing bulk-handler error toasts ([ActiveGardenView lines 713 + 737](src/components/ActiveGardenView.tsx:713), [MyPlantsView line 468](src/components/MyPlantsView.tsx:468), [garden/page.tsx line 527](src/app/garden/page.tsx:527)) updated to friendly+refresh wording per user's explicit ask. 14 new regression test it-blocks (387 → 401). Preview MCP env-blocked per documented skip condition. **Cohesion-by-aggregation rule** captured mid-build after user flagged a pattern that the existing rules don't sharply name: small implementation decisions (toast color, animation technique, threshold value, log-string format, row primitive shape, padding token) get classified as "engineering, decide silently" at planning time but AGGREGATE into the product's read. User's verbatim framing: *"you ask for X. Claude scopes X. Claude also makes a bunch of smaller decisions to actually implement X... Each of those individual choices feels like an implementation detail at planning time... Then they aggregate — and a month later you look at the Calendar and feel that nothing reads right."* Rule codified in CLAUDE.md plan-audit standard Pass 2 as dedicated subcategory + cross-reference from RULES CARD #4. Two-branch resolution at audit time: (a) cite existing pattern as anchor by path, OR (b) ASK. Failure-mode signal explicitly named: "Small enough to feel like engineering." Specific drift this caught in U24 Phase A pre-push: console.error format `[scope] description` (new) vs. `scope: description` (existing in `cascadeOnGrowEnd.ts:18` + `revertProfileStatus.ts:57`) — fixed via commit amend before push.

- **2026-05-14:** **U24 diagnosed — silent-failure pattern in bulk-end handler line 757.** Strict-bug diagnosis chat. Read+write paths traced via 2 Explore passes + direct code-read of linchpin findings. Three user-clarification AskUserQuestions narrowed cause (hard-refresh ruled out cache/state; flow ruled out harvest; view mode ruled out RLS). **Root cause:** [ActiveGardenView.tsx:757](src/components/ActiveGardenView.tsx:757) discards `{data, error}` from `.update()`, so any error (RLS / CHECK / network / trigger) produces a deceptive "Ended N plantings" toast and `load()` refetches the unchanged rows. All 6 end-plant code paths mapped — every path writes `status` + `ended_at` correctly, BUT paths #2 (bulk-end) and likely #4 (My Plants bulk-end) share the error-discarded pattern that blocks diagnosis of underlying errors. Phase A fix (S-size: add error check + `.select('id')` row-count check at line 757 + audit 5 sibling end-paths + 1 new unit test) scoped for follow-up chat. Phase B (B depends on A): user retries with instrumented build; surfaced error names the underlying cause; ship targeted fix or close as transient. **Two mid-chat amendments declared + re-audited:** (1) original Harvest-flow hypothesis disproven by user — re-audit triggered; (2) family-view-RLS hypothesis disproven — re-audit triggered. Audit terminated clean at Pass 3 on revised plan. Pattern reinforced: AskUserQuestion-driven amendments are the right shape when an Explore agent's recommended cause is plausible but unverifiable from static analysis alone. **HarvestModal end-state realization** discovered mid-diagnosis as a separate UX↔data gap (not U24's cause) — VISION §5 lists "Harvested out" as a plant end-state but `HarvestModal.handleSave` only inserts a `journal_entries` row, never mutates the `grow_instance`. Parked at VISION §11 with recommended UX direction (auto-end checkbox, default-checked for annuals, hidden for perennials respecting `is_permanent_planting`). Diagnosis plan retained at `C:\Users\marsh\.claude\plans\three-things-to-handle-iterative-peach.md`. Doc-only ship.

- **2026-05-13:** **§3.10 R1-R5 strict drift batch shipped (`884cf9d` + `4b333ea`).** Five doc-drift items from the user-delivered 2026-05-12 audit closed in a single doc-only commit. R1 `CLAUDE.md:81` test count `329/329` → `387/387`. R2 `docs/WORKFLOW.md:3` "Seed Vault" → "Garden Tracker" + stamp 2026-05-12. R3 `docs/BUGS.md` U1+U3 marked ✅ Fixed inline. R4 `docs/BUGS.md` stamp 2026-05-07 → 2026-05-12. R5 `docs/VISION.md` §11 icon count `~25+` → `42`. **R3 audit-rec variance:** original audit recommendation was "move U1+U3 rows to the Resolved (Closed) table." Variance: applied inline `✅ Fixed (verified date)` annotations on U1/U3 rows in-place, matching the in-file U21-U23 convention rather than physically moving rows to the Resolved table. Variance preserves U-number anchoring + minimizes structural churn; decision logged in ROADMAP §6. **R5 §11 brush handling:** R5 edits the icon count inside the §11 parked icon-density entry. Per the plan-audit standard, touching §11 triggers Pass 3 (lock hygiene) — confirmed R5 is factual-only (count `~25+` → `42`); the decision substance (stroke 1.2 canonical, counter stroke 2.0, parked status) is preserved verbatim. Audit looped to termination at Pass 3 (min 3 required because R5 brushes §11). **Audit-pass framing correction (locked 2026-05-13, see `60d0836`):** the min-pass counts (2 baseline / 3 for triggers) are FLOORS not CAPS. Audits loop until clean — pass count is unbounded. Frame as "audit terminated at Pass N" not "ran N passes." Captured to memory as a feedback entry.
- **2026-05-13:** **Calendar testing feedback (table for later, 2 items).** User testing calendar functionality dropped two new UX items, explicitly framed as "table for later" — capture, don't act on. **(A) Swipe-to-complete should require checkmark confirmation, not autocomplete on swipe.** Refines `cea21e0`'s shipped behavior (currently autocommits past 100px threshold + 8px direction lock; same for `f77507a` consolidated rows). VISION §11 swipe-batch resolution direction named "left=complete, right=snooze" but didn't specify confirm-vs-autocommit. Refinement of locked behavior, not contradiction. Aesthetic — needs user input on interaction model (reveal-checkmark? swipe-then-confirm? rubber-band-back if no confirm?). **(B) Restructure task cards — TO_DO task line, plant/variety line, conditional date.** Primary line = TO_DO task verb, secondary = plant/variety, remove date from card except in Overdue section. Related to VISION §11 "Calendar task row primitive — bubbles vs. list" (parked 2026-05-08; same surface, internal-structure variant of the same density/clarity concern) AND BUGS U13 "Journal entry cards — visual hierarchy poor" (re-flagged 2026-05-12; same hierarchy pattern, now echoed for Calendar tasks). Aesthetic — needs structure proposal + per-element treatment input. Both items captured to ROADMAP §3.9 as #9 (new 2026-05-13) + #10 (new 2026-05-13).
- **2026-05-12:** **User-delivered doc audit received.** Audit pasted into the session (likely run in another Claude session) — structured triage of doc drift across CLAUDE.md, VISION.md, ROADMAP.md, WORKFLOW.md, BUGS.md, BACKLOG.md + ~30 legacy `docs/` files. Surfaced 7 strict drift items (test count stale, project rename incomplete in WORKFLOW.md, BUGS U1+U3 silently fixed, stale stamps, icon count off), 3 structural items (PROJECT_STATUS.md canonical-vs-archived, WORKFLOW.md missing 2026-05-11/12 rules, BACKLOG.md `.cursor/` ref), 2 future items. Triaged into ROADMAP §3.10. **Pattern locked: periodic drift audit.** Distinct from search-before-respond (Step 0 of feedback-batch triage). Periodic drift audit verifies existing entries still match reality — useful before major ships, every few weeks, or when user asks "where are we?" Captured to memory as a feedback entry for future sessions.
- **2026-05-12:** **Chunk 3.9 #2 + #4 batch shipped (`3de1c2c`).** Two XS visual fixes bundled per WORKFLOW §"Batching small fixes." **(1) #2 — Calendar `← →` month-nav arrows hide below `xl:1280px`** via `hidden xl:flex` on both buttons in `src/app/calendar/page.tsx:976+985`. Phone + iPad-landscape navigate via existing swipe gesture; desktop keeps arrows since no touch events fire. Matches the B1 + B2 breakpoint family locked 2026-05-11. **(2) #4 — Garden card "Add journal entry" trigger icon swapped `JournalCareHands` → `Edit`** in 2 sites of `src/components/ActiveGardenView.tsx` (lines 1094 + 1242). Resolves visual duplication where the trigger button shared its icon with the `care` entry-type marker on journal entries ([journal/page.tsx:230](src/app/journal/page.tsx:230)). **Diagnosis worth surfacing:** `JournalCareHands` (cupped hands + heart + sprout) renders at `w-5 h-5` (20px) where the cupped curve simplifies into a basket/bag silhouette — overlaps perceptually with `Harvest` (basket) icon in the same entry-type set. Scope A locked: just retag the trigger; leave the `care` marker untouched; defer the broader entry-type vocabulary cohesion question (Harvest basket + JournalCareHands cupped curve reading as same family) to a future Phase 6 design-system pass. **Mis-triage caught:** the original 2026-05-12 12-item batch captured this as "bag (shopping list) icon swap" referring to the mobile header — actual surface all along was the Garden plant card trigger. User flagged the surface mismatch during planning ("idk where youre getting it"); Claude pivoted, surfaced the duplication, then enumerated scenarios. Lesson reinforced: when a flagged item names a vague visual ("bag icon") that could plausibly map to multiple surfaces, clarify the surface during triage. **#3 garden card spacing parked:** user identified the empty-space-below-short-names issue, Claude diagnosed `min-h-[1.75rem]` on `ActiveGardenView.tsx:1075` reserving 28px for 2-line names (→ 14px visible gap at 1-line) and surfaced 3 fix options (remove min-h / reduce / move space via `justify-end`) — each with the alignment-vs-tightness trade-off. User opted to defer the call to a future batch rather than bundle with #2 + #4. Full options preserved in ROADMAP §4. 2 files, 4 line-edits. 387/387 tests; clean build. Pre-push Preview MCP attempted at 412×915 — dev server env-blocked in worktree (no .env.local) → skipped per rule `aad2e56`'s documented condition.
- **2026-05-12:** **Calendar expand-all toggle shipped (`6d76c20`, chunk 3.9 #1).** First build item from the 2026-05-12 batch after journal-search (#6). Chevron button next to "Upcoming Tasks" header (only when no date selected and content exists) toggles every section open/closed in one motion. 200ms ease-out arrow rotation. Smooth content height animation via `grid-template-rows 0fr ↔ 1fr` transition — applies to both master and per-section toggles for consistency. Built on `a7dadb7` default-collapse foundation.
- **2026-05-12:** **Two new procedural rules locked this session: pre-push visual verification (`aad2e56`) + plan-audit standard (`eea6a84`).** Pre-push visual verification: Preview MCP mobile-viewport sanity check required on visual ships, with honest limits documented (catches general layout / overflow / console errors; doesn't catch Android-Chrome-100vh quirk, webkit pseudos, hardware back). Plan-audit standard: 3-pass taxonomy (Factual / Semantic+edge / Lock hygiene); min 2 passes, 3 for contexts/nav/locked decisions; plan file required at ≥3 files or state-machine changes; mid-session scope additions need fresh passes. User identified plan-audit as the pattern she most often re-enforces — codifying removed the ambiguity in "loop until clean."
- **2026-05-12:** **FAB UX fix batch shipped (`79836f4`, U22 + U23).** Two user-reported items resolved in one commit: (U22) Android back button now closes the Universal Add Menu — the `useModalBackClose` hook was wired on Home, Garden, Journal, and Calendar (Vault was already correct). Surprising research finding: `skipPopOnNavigateRef` was already declared and set on 28+ nav handlers in those 4 files, but no `useModalBackClose` was reading it. Prior session built half the infrastructure and stopped; this commit completes it. (U23) FAB menu cut off by browser chrome / OS nav bar on phone — root cause was `top-1/2 -translate-y-1/2 max-h-[85vh]` rendering the menu centered on the *idealized* 100vh that includes URL-bar area. With 5 menu options + Cancel, 2 options + Cancel were hidden behind OS nav, compounding U22 (no easy dismiss). Switched to flex-wrapper + `max-h-[85svh]` so the small-viewport-height value reliably excludes browser chrome. Both fixes share the FAB surface; bundled per the batch-3-5-small-fixes rule. 5 files, +10 -1 lines. Plan-audit ran 5 passes (approach, F1 behavior, F2 layout/animation risk, test+build risk, clean). User feedback flow: she dropped the report mid-session while U21 was awaiting push; correct order was push U21 first (clean queue) then plan-audit the new bundle.
- **2026-05-12:** **U21 clear-X duplicate fix shipped (`fb67e10`).** Single follow-up bug from the `7482c59` journal-search ship: Android Chrome and desktop Chrome rendered both the custom React clear-X (added for iOS Safari which doesn't render the native button) and the browser-native `type="search"` cancel button, producing a grey-X-next-to-blue-X duplicate. Fixed with `[&::-webkit-search-cancel-button]:appearance-none` on the input's className — webkit-only pseudo-element, no-op on Firefox, preserves iOS Safari behavior, keeps `type="search"` semantics intact. 1-line CSS in `src/app/journal/page.tsx:550`. App-wide grep confirmed no other `type="search"` input has a manual clear-X (Vault/Garden/Shed/Settings all rely on native-only), so no batch needed. Plan-audit ran 4 passes (validated approach, scoped app-wide, verified zero test/build risk, clean pass).
- **2026-05-12:** **CLAUDE.md restructured: rules card at top.** User flagged "you need to constantly check our rules. or our rules page isnt clear enough" after multiple drift events this session. Structural response: added a top-of-doc 🪪 RULES CARD (8 bullets) so future-Claude scans load-bearing rules first instead of digging through ~400 lines of detail. Plus `docs/CLAUDE_CODE_SETUP.md` with paste-ready `UserPromptSubmit` hook config that injects the card into every prompt (optional, user-enabled). The drift this fixes: missing the search-existing-captures step, jumping to "strict bug fix" without triage, slow capture of new procedural rules.
- **2026-05-12:** **Debug log page shipped (`ed5441c`).** Tooling page under `/settings/developer/debug-log` so user can copy-paste captured console output (vs. screenshots of phone text). Initially push-back'd as feature creep per the PM rule; user pushed back on push-back; resolved that tooling for build process ≠ user-facing feature, with scope guardrails kept tight. Reusable for future debugging.
- **2026-05-12:** **PM/feature-creep enforcement rule locked.** User framed Claude as "project manager and coder" and asked for enforcement when requests pull project off-track. Captured in CLAUDE.md as a Project lead behaviors subsection. Now: when user (or anyone) asks for work not on current chunks, Claude evaluates → push back with parking proposal → respect override if user heard the cost and still wants it. Reinforces existing "Push back when needed" obligation with specific triage criteria.
- **2026-05-12:** **Drift caught: triage rule reinforced.** After `7482c59` shipped, user surfaced two follow-up items (two-X-buttons-on-search-bar; two "+Entry" paths on journal). Claude jumped straight to "fix the X bug (strict bug, OK without asking), ask about +Entry" — skipping the locked triage rule. User flagged: "should you be checking if its already in a future plan? why did you decide to address it now?" Truth: +Entry was already BUGS.md U12 (parked since 2026-05-07); the X-duplicate was a new bug introduced by today's ship; AND batch item #6 from earlier in the session (journal card format) was already BUGS.md U13 (missed in original triage too). Three pre-existing parked items got mis-triaged or jumped past. Structural fix landed in CLAUDE.md: "Step 0 — Search existing captures FIRST" added to "Handling feedback batches"; rule re-locked as size-agnostic (single-item feedback gets the same treatment). BUGS.md updated: U12 + U13 marked re-flagged 2026-05-12; new U21 added for the X duplicate. ROADMAP §3.9 items #5 + #6 + new #8 cross-reference U13/U21/U12 respectively.
- **2026-05-12:** **Journal search shipped (`7482c59`).** First ship from chunk 3.9 (2026-05-12 feedback batch). Search field on journal page above view-toggle row; matches Vault/Garden visual pattern. Multi-token AND filter across note + entry_type (underscores stripped) + plant_name + plant_display_names + formatted date. All three view modes (table/gallery/timeline). Pure filter function in `src/lib/journalSearch.ts` for testability. 8 new vitest cases (378/378). Clean build. Awaiting user prod verification on phone.
- **2026-05-12:** **`a7dadb7` verified clean in prod.** User's phone screenshots show "Overdue (42 tasks)" and "Overdue (41 tasks)" collapsed at top of Calendar with Upcoming Tasks expanded below. Default-collapse rule confirmed working.
- **2026-05-12:** **New procedural rules locked (2 rules).** (1) "Handling feedback batches" — Claude owns triage into 🔵 current / 🟣 future / ❌ outside. Triage gets presented in text, aesthetic items flagged separately for input, conflicts with VISION.md surfaced for clarification, ROADMAP + VISION updated immediately. (2) "Roadmap maintenance" — ROADMAP.md is a living doc; new step 3.5 "Final ROADMAP review" added to close-out protocol. Both rules captured in CLAUDE.md.
- **2026-05-12:** **Feedback batch (12 items).** User dropped 12 items + 4 phone screenshots (Journal, Garden, Calendar ×2). Triaged: 7 items into new chunk 3.9 current build (Calendar expand-all toggle [#1], phone month-nav arrow redundancy [#2], garden card spacing [#3 — `screenshot 2`], bag/shopping-list icon swap [#4], journal gallery card format [#5 — `screenshot 1`], journal search [#6], plant profile no-AI-data fallback [#7]); 5 items into §4 parked (welcome instructions [#8 — "whole work chunk at the end" per user clarification 2026-05-12; additive to empty-by-default, not conflicting], gallery-vs-table view discussion [#9 — Phase 5], journal growing-indicator tags [#10 — Phase 3 IA], vault metadata filters [#11 — Phase 3 IA], harvest calculator [#12 — memory plane / Failure Mode #2]). Detail in ROADMAP §3.9 and §4.
- **2026-05-12:** **User mental-model signal — "memory plane" features.** Items #10 (growing-indicator tags for searchable historical patterns) and #12 (harvest calculator with season stats) both surface the "what works for me library, year over year" idea (VISION §1). User is thinking in terms of *memory across seasons*, not just current-state management. Reinforces that memory plane work (variety eval, cross-season comparison) is core to the product, not a nice-to-have.
- **2026-05-11:** **Calendar default-collapse rules shipped (`a7dadb7`).** Overdue section now collapsed by default on Calendar load; today still auto-expands; other days remain collapsed (existing behavior). Tap-grid-day still switches to single-day mode (preserved). Count badges on collapsed headers ("Overdue (N tasks)", "Fri Nov 13 (3 items)") were already in the code — they now do the at-a-glance work without wall-of-text. -1 LOC change to `src/app/calendar/page.tsx` init effect. 3-pass plan-audit clean; 370/370 tests pass. Partially unparks VISION §11 "Calendar task fatigue approach" — default-collapse sub-rule locked.
- **2026-05-11:** **AskUserQuestion bundling pattern caught.** Claude framed the full Calendar-collapse rule set (overdue + today + future-days + tap-grid + count-badges) as a single "Lock it (Recommended)" AskUserQuestion. User picked "Yes, lock it" — but later interrupted the ExitPlanMode call and pasted Claude's own earlier prompt ("Tell me your call on future-days default") back with "what do you think?" prepended. Read: she greenlit the bundle without having individually digested each sub-rule, then wanted to back up and discuss future-days specifically. **Behavioral lesson:** when presenting a multi-item rule set for the first time, *don't* offer a single "Lock all" AskUserQuestion. Either (a) discuss verbally and let her engage with each piece, then offer a bundled lock once she's clearly seen each one; or (b) ask separately per sub-decision. Bundling looks efficient but skips the per-item digest she wants. Captured in CLAUDE.md.
- **2026-05-11:** **Sidebar icon density flagged (parked widening).** User noticed in the new B1 sidebar that primary nav icons, Shopping list, Settings/Feedback, and Help all render with different stroke weights / sizes / rendering systems (text-glyph for Help). Same parked decision as FAB icon consistency from 2026-05-08, now visible in two surfaces. Recommended canonical: stroke 1.2 + 24×24 + Help-as-SVG (because `styleDictionary.tsx` is the larger of the two icon libraries). Counter: stroke 2.0 canonical. **User parked the decision intentionally** for follow-up batch. See §11 "App-wide icon density."
- **2026-05-11:** **Phase 4+5 desktop layout pass — B2 (Calendar two-column) shipped (`8624c8d`).** Decisions locked across D1–D4: D1 sticky left column (grid stays visible while task list scrolls — reinforces "primary check-in surface" role); D2 right column `max-w-[720px]` (comfortable row line length on 1920+ screens; whitespace to the right is parked space for Phase 5 page-design work); D3 24px column gap (`gap-6`, consistent with existing card-level spacing); D4 keep 640px left column per A1–A7. Risk parked for prod check: at exactly 1280px viewport with sidebar expanded, right column ~328px (narrower than mobile); fast-follow mitigation = `xl:w-[600px] 2xl:w-[640px]` on left column if cramped.
- **2026-05-11:** **Multi-pass plan-audit discipline reinforced.** User caught Claude stopping after one audit pass. WORKFLOW.md requires looping until findings are clean or immaterial. The B2 plan ran 4 passes before clean — pass 2 surfaced three real misses (worst-case viewport squeeze quantification, sticky-position smoothness math, loading-state behavior in empty right column) that would have been missed otherwise. Behavioral lesson: multi-pass audit is the default cadence, not an optional extra. Captured in audit log inside the plan file for future reference.
- **2026-05-11:** **Phase 4+5 desktop layout pass — B1 (App shell + sidebar nav) shipped (`e61ffdc`).** Decisions locked across A1–A7 + S1–S5 batch: `xl:` (1280px) breakpoint chosen over `lg:` so iPad-landscape stays mobile-style; sidebar appears on every page in this pass; right-column treatment is Calendar-only (other pages keep single-column until Phase 5 designs them); sidebar = 240px expanded ↔ 64px collapsed with persistent state; primary nav icons reused from BottomNav for cohesion; Shopping list / Help / Settings / Feedback live in sidebar footer (utilities, not sections); slim top header at `xl:` retains cloud-sync + page title + household toggle. B2–B5 queued.
- **2026-05-11:** Communication pattern observed — "I am ok with your recommendations" + naming the explicit starting point (e.g. "A1 and A7") is **blanket trust-transfer on a batch of decisions**, not a partial accept. Treat as locked across the full slate; start where the user names; revisit individual items only if the user redirects later. Captured in CLAUDE.md.
- **2026-05-08:** Desktop calendar grid is oversized (~280px-wide cells on 1920px screens). Bottom nav feels mobile-y on desktop. Empty horizontal space if calendar is shrunk in isolation. *Recommended path: two-column layout (calendar left, tasks right) + left sidebar nav on `lg:`. Likely Phase 4 + Phase 5 trigger; entangled with FAB modal-placement issue.* See §11.
- **2026-05-08:** **Process correction logged.** Claude jumped from plan-audit to build on a "can we do X" reply that was direction confirmation, not explicit greenlight. User flagged. Going forward: explicit "yes, build" / "go" required between plan-audit and build; no shortcuts. If a reply is ambiguous, ask before building.
- **2026-05-08:** FAB Add menu (and likely other phone-style modals app-wide) renders as a centered floating card on desktop — phone bottom-sheet pattern doesn't translate. Logged for separate batch after calendar swipe. See §11.
- **2026-05-08:** Operating principle 9 locked: *Build mobile-first with desktop responsiveness in every commit.* User test-loops on phone but uses website too; deferring desktop creates debt cliff. Worked example: row quick actions = swipe on mobile, inline buttons on desktop (single commit, both surfaces).
- **2026-05-08:** Calendar adjacent-month grid cells (the leading/trailing pad days when month doesn't start on Sunday or end on Saturday) read as too similar to current-month days; user wants them visibly muted. Locked to `bg-neutral-100` (gray-100) for clean "not part of this month" cue.
- **2026-05-08:** Calendar `CalendarTaskRow` primitive reads as "bubbles/individual cards" rather than as a list — contributes to calendar-page density fatigue. User asked whether to switch to checkbox-style. *Parked to evaluate after Calendar fatigue batch deploys; consolidation + day-header treatment may resolve reading problem before we touch the row primitive.* See §11.
- **2026-05-08 (Phase 1 closed):** Vision statement v4 locked. Full audience model, three lifecycle paths, four failure modes, complete Q8 categorization, beds-as-first-class, micro-climate triggers, cost-driven freemium, encyclopedia + tips + content split into three modes, all captured in this commit.
- **2026-05-08:** Growing-from-seed lifecycle is meaningfully distinct from established-plant lifecycle. App shouldn't force them into the same template.
- **2026-05-08:** "Disorientation" / feeling lost is a real failure mode — bigger than just inconsistency. Cohesion is the antidote.
- **2026-05-08:** Cost-driven freemium accepted: features that cost the operator money go in paid tier; everything else stays free.
- **2026-05-08:** Plant database moderation needs discussion — concern about user pollution / inappropriate content. Phase 3 problem.
- **2026-05-08:** Beds become first-class entity. Foundational architectural decision. Implementation Phase 3.
- **2026-05-08:** Micro-climate triggers (not just regional weather). Anchored to user's actual garden — local stations + user observations + nearest-station fallback.
- **2026-05-08:** Cross-account exchange Level 3 locked (trades update both inventories with history); Level 4 (paid) ❌ never; Level 5 (public) ❌ never.
- **2026-05-08:** Three transition languages approved (fade-scale / horizontal-slide / slide-up). 200ms entries, 150ms exits.
- **2026-05-08:** "Next menu should pop up INSTANTLY" — wants snappy + polished. One standard for all FAB menus.
- **2026-05-08:** Calendar grid is primary check-in (don't compact). Task list is the meat but currently overwhelming. Plantable widget intentionally separate planning info.
- **2026-05-08:** Don't make aesthetic decisions without asking. "What is X" is a prompt to discuss, not a spec to fix.
- **2026-05-08:** U18 Calendar header changes were overstepping — reverted. Plantable color treatment liked as-is.
- **2026-05-08:** User is not a software developer; first build. Partnership model: user provides vision, Claude assists with build + polish.
- **2026-05-07:** Placeholder PNG container background should be `bg-white` (matches PNG, no seam).
- **2026-05-07:** Plant placeholder is `/public/plant-placeholder.png` (three-leaf illustration). Prior icon design rejected.
- **2026-05-07:** "Too many places to edit image" — backlog item.
- **2026-05-07:** Batching policy: ship XS-S visual fixes 3-5 at a time.
