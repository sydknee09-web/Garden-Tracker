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
- **Calendar task fatigue approach** (deferred 2026-05-08). Today/Week default, group-by-day, collapse-completed, lazy-load. Multiple sub-decisions parked from a prior plan-audit.
- **Cross-view consistency: Vault grid / Garden gallery / My Plants list** (deferred 2026-05-07).
- **Too many places to edit a plant's image** (in `BACKLOG.md`, deferred 2026-05-07).
- **FAB icon style consistency** (raised 2026-05-08). Awaiting decision on canonical stroke weight; whether FAB main matches submenu icons.
- **Save / Cancel button consistency** (raised 2026-05-08). Stacked vs side-by-side; `bg-emerald` vs `bg-emerald-600`.
- **Calendar task row primitive — "bubbles vs. list"** (raised 2026-05-08). User flagged that `CalendarTaskRow` reads as cards/bubbles (rounded-xl + white bg + emerald border + drop shadow) rather than as list items, and that this contributes to density-fatigue on the calendar page. *Resolution direction (2026-05-08): mobile gets swipe gestures (left=complete, right=snooze) and inline buttons hide; desktop keeps inline buttons. Plan-audit clean; awaiting build greenlight.*
- **Modal/menu placement on desktop** (raised 2026-05-08). User flagged that the FAB Add menu (and likely other phone-style modals: NewTaskModal, QuickLogModal, snooze sheet, batch reschedule sheet, batch delete sheet) renders as a centered floating card at fixed widths on desktop, which feels wrong on a wide screen — it's a phone bottom-sheet pattern bleeding into desktop. *My recommendation: per Principle 9 (mobile-first with desktop responsive), audit all phone-style modals; on `lg:` screens they should either anchor near their trigger (popover-style) for the FAB menu, OR cap width and add proper desktop framing (centered modal with backdrop) for full-screen sheets. Separate batch from calendar swipe work — different components, different decisions.*
- **Sister's additional feedback** (pending). Will fold in when received.

---

## 12. Recent signals (rolling log)

Last several pieces of feedback from the user, in case any didn't make it into the right section above. Acts as a safety net. Most recent at the top.

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
