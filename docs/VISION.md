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
- **Built for public distribution via app store** (PWA-first, native wrappers TBD); cost-driven freemium per Operating Principles. *Locked 2026-05-17.*

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

Garden Tracker is a **multi-tenant gardening management product** for home gardeners, built by a non-developer with help from Claude. **Intended for public release / app-store distribution to home gardeners across the full skill range** (*locked 2026-05-17*). The user is the product visionary; Claude is the build partner.

**Tone:** Calm, polished, useful. Not flashy. Not clinical. The app should feel like it respects the user's attention and time.

**Audience model — three layers:**

1. **Self.** The core user. Personal seed inventory, plant management, daily use.
2. **Household.** People who share a single account / live together and tend the same garden. Full read+write sharing. (Currently the "Family" view.) **Acts as shared identity by default** (*locked 2026-05-17*); per-person attribution is recorded for actions but hidden from UI by default. An opt-in filter view surfaces "who did what" when coordination needs it. Light push notifications for household coordination ("BF watered tomatoes 2hr ago") are opt-in, off by default.
3. **Trusted circle.** Real-life family and friends who garden their own plots and want cross-visibility for swapping seeds, coordinating, etc. Invite-only / known people. Can scale to organized groups (e.g. gardening clubs) — same principle, larger group. **Boundary stays at people you've personally invited; never public.**

   **Internal structure** (*locked 2026-05-17*): Trusted circle is a collection of **groups**, each with a **mode**:
   - **Browse-mode groups** (intimate, low-N — e.g. "Friends & Family"): members see each others' opted-in categories; long-press item → request to owner; per-category privacy opt-in (default = nothing shared).
   - **Board-mode groups** (less intimate, higher-N — e.g. gardening clubs): members post asks ("looking for X") or offers ("have Y") to a shared feed; nothing exposed by default; per-post opt-in.
   - **Default "Friends & Family" group** (browse-mode) auto-created when user adds first circle member. Power users create additional groups as needed.
   - **Multi-group membership:** a person can be in multiple groups across modes (e.g. sister in "Family" browse + "Vista Gardeners" board).
   - **Sharing data model:** communication + transfer-at-time (NOT pre-marked "shareable" state). Browse → request → owner approves → Level 3 trade flow. Board → claim → Level 3 trade flow. No lifecycle-state management of share-ability.

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
9. **Build mobile-first with desktop responsiveness in every commit.** *Locked 2026-05-08; narrowed 2026-05-17 for Walter persona.* Mobile-first per the original operating principle (§1), but desktop responsiveness is built in *the same commit*, not deferred to a later "desktop pass." Use Tailwind responsive utilities (`md:` / `lg:` etc.) to handle device differences inline. The user only test-loops on phone, so phone is where UX gets evaluated; desktop gets the structural bones from day one and a focused visual-polish pass once mobile UX is mature. Why: avoids accumulating debt where mobile-only patterns lock us out of clean desktop behavior. Worked example: row quick actions = swipe on phone-portrait, inline buttons on iPad-portrait+ AND desktop alongside swipe (one commit, all surfaces handled; `md:` breakpoint anchored on Vault/Shed prev-next nav arrows). **Persona-accessibility refinement 2026-05-17:** Walter persona (iPad-primary, swipe-excluded) was added after this principle's original lock. Reconciliation: phone-portrait stays swipe-first by Principle spirit; iPad-portrait+ shows visible buttons by Walter persona requirement. Both coexist (button `e.stopPropagation()` prevents swipe conflict).

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

### Vault (Library, Packets, Shed)
- **Plant placeholder asset:** `/public/plant-placeholder.png` (the three-leaf PNG). Canonical placeholder; not the SeedlingIcon component.
- **Placeholder container background:** `bg-white`. Matches the PNG's white background — no visible seam.
- **Vault grid card layout:** 3 cards per row on mobile/tablet (`<lg`). On desktop (`lg:`+) the Library grid auto-fills ~200px tiles (`grid-cols-[repeat(auto-fill,minmax(200px,1fr))]`) so wide viewports show more inventory per row instead of 3 oversized cards — cards stay ~200px at every desktop width (never huge on ultrawide, never below 200px). *(Finding 6, Syd dogfood 2026-06-01; Library-only pre-ship — Packets/Shed/Garden peers still 3-col, reconciled in the broader Desktop Responsive Audit per the cross-view question below.)*

**Shed (inventory hub):**
- Track current supply inventory (what you have, in what quantity)
- Track application schedule per supply (when last applied, when next due, by plant or by bed)
- Surface upcoming applications in the active task queue so nothing is missed
- Detect when supplies are running low / depleted (running-out threshold)
- Connect to the shopping list automatically when something runs out

**Open question (parked 2026-05-07):** Cross-view consistency between Vault Library grid, Garden Active Garden gallery, Garden My Plants list. User flagged that names are legible across all three but layout/format/text style differ.

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
- ~~**Save / Cancel button consistency across modals.**~~ ✅ **CLOSED 2026-05-26** via FAB-form submit pattern standardization saga (commits `fc1463d` → `ba9319f`). Locked: 3-section flex-col shell (header + body + fixed-bar footer), Cancel-left + Save-right side-by-side per AddPlantModal template, Save token `bg-emerald-600 hover:bg-emerald-700` (= #059669), Cancel token `border-teal-gus/40 text-teal-gus hover:bg-teal-gus/10`, footer separator `border-t border-neutral-200`, disable-until-required-fields-filled active on every form. Single-button footers (choose-step / Done states) use `w-full` Cancel matching the menu's main-screen anchor. See ROADMAP §6 2026-05-26 entry.

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
- *Superseded 2026-05-27 — see "Emerald primary-emphasis token split" subsection below for the locked emerald-500/emerald-600 semantic split. Actual codebase canonical for CTAs settled on `bg-emerald-600` (Tailwind direct) via the FAB-form submit saga (locked 2026-05-26); the brand-token aspiration above remains academic.*

### Field treatments — dropdown vs free-text

**Locked 2026-05-24.** Two field treatments signal two interaction patterns:

- **Gray-filled fields** (`bg-neutral-50` / `bg-black/[0.02]` or similar light gray fill) = **dropdown affordance** (preset options, predefined list, picker UX). Tapping opens a list of choices.
- **White outline fields** (`bg-white` with `border border-black/10`) = **free-text input.** User types whatever they want.

Don't accidentally unify them — the visual distinction is doing semantic work. When you add a new field, pick the treatment that matches the interaction.

User signal verbatim (2026-05-24): gray-fill = dropdown affordance (preset options); white outline = free-text input. Two field treatments signaling two interaction patterns.

*See "Casing (headers + buttons vs body)" subsection below for header/button vs body-copy convention.*

### Form-level error treatment

**Locked 2026-05-26.** Form-level errors (both validation messages like "Title is required." AND save-failure messages from `formatAddFlowError()`) render via the shared [`FormError`](../src/components/FormError.tsx) component.

**Visual contract:**
- `italic` (semantic: error / blocker, distinct from regular copy)
- `text-red-600` (error semantic — NOT yellow/amber, which read as warning, not blocker)
- `text-sm font-medium`
- Small warning-icon prefix (`ICON_MAP.Warning`, sized 16×16, color inherits via `currentColor`)
- `role="alert"` for screen reader semantics
- Placement: **bottom of form**, NOT inline-by-field (the user has typically scrolled past the field by the time the error fires; inline-by-field errors would be missed). Locked 2026-05-26.

**When to use:** any FAB-tree or user-data-entry form that displays a blocking error message at form-submission time. Both validation errors and save/insert failures use the same component — same render slot, same treatment. [`addFlowError.ts`](../src/lib/addFlowError.ts) handles the message text split (save-failure formatting vs validation literal); `FormError` handles the visual.

**Sites using it (initial roll-out 2026-05-26):** NewTaskModal, QuickAddSeed (×2 paths), AddPlantModal, QuickAddSupply, EditJournalModal (submitError only — webcamError remains a field-level inline error, different shape).

**Out-of-scope follow-ups** (logged 2026-05-26 for future polish pass): auth pages (login/signup/reset-password/update-password), AddPlantManualModal, AddItemModal, FeedbackModal, InviteMemberModal, BatchAddSeed/Supply.

### Info-note treatment (commentary / aside copy)

**Locked 2026-05-27.** When a UI surface needs to render a non-error, non-warning explanatory aside — commentary about *why* a section's data is sparse, *what* alternative path applies, or any "by the way" copy that supports but doesn't dominate the main content — render as `text-sm text-neutral-600 italic` (sentence case per §8 casing rule).

**Visual contract:**
- `text-sm` (matches body register; doesn't compete with headers)
- `text-neutral-600` (one step lighter than primary body `text-neutral-700/900` to signal "aside")
- `italic` (semantic: commentary / aside, distinct from primary copy)
- No background fill, no border, no icon — keep the visual weight low
- Sentence case (per §8 — body copy rule)

**Distinct from:**
- **Form errors** (`italic text-red-600 font-medium` + warning icon, see Form-level error treatment above) — info-notes are NOT errors; tone is calm explanation, not blocker.
- **Helper text under inputs** (`text-xs text-neutral-500`) — info-notes are wider in scope (whole-section aside, not field hint) and use the larger `text-sm` register.
- **Empty-state body** (full-sentence 3-part frame) — info-notes appear ALONGSIDE existing content; empty-states REPLACE missing content.

**When to use:** explain why a section reads as it does (e.g., contextual caveats about seed propagation when seed rows are empty), one-line commentary on a card's contents, "by the way" framing. Render at the top of the section body or as a footer below populated content — placement depends on whether the note explains the section or comments on it.

**Sites using it (initial roll-out 2026-05-27):** VaultProfileAboutTab `Propagate / Save Seeds` card body + `How to Grow` card footer (both render `profile.seed_propagation_context` when populated and seed-related rows are empty).

**Why this rule exists.** The Propagate / Save Seeds ship 2026-05-27 needed a contextual aside for plants that don't grow from seed (succulents, grafted fruit trees, sterile hybrids) — explaining why the seed rows show "—". No existing primitive matched: FormError reads as blocker, helper-text is too small, empty-state replaces content rather than commenting on it. Italic body register lands the "aside / commentary" semantic without inventing a callout box that would compete for attention on dense profile cards. All 5 personas pass: Maya (power user) reads as expected aside register; Sydney (cohesion) sees the new primitive nest cleanly within existing body-copy treatments; Walter (iPad-primary) reads italic-body as standard "note" convention from iOS / web typography; Aria + Sam see less visual weight than a callout would add to their already-busy first-profile views.

**GT-only.** Voyager has its own visual register; this convention does NOT apply there.

### Casing (headers + buttons vs body)

**Locked 2026-05-27** — reverses part of the implicit "all-sentence-case" cohesion bar that operated 2026-05-24 → 2026-05-27 (recorded only in ROADMAP §6 dated entries: 2026-05-24 `006dd69` Item 2 + Q4 widen + 2026-05-25 `a78dbd6` 22-edit sweep). Promotes the rule from previously-only-ROADMAP-dated entries into a durable VISION.md design token, closing the doc-architecture gap flagged via authority-precedence audit.

GT uses an **industry-standard casing split**, parallel to Apple HIG / Material Design / iOS Settings:

- **Headers + buttons = Title Case (AP-style).** Examples: `Confirm Planting`, `Add Plant`, `Delete Batch`, `From Vault`, `Add Entry`, `Save Changes`, `Photo Import` (modal h2), `Extract & Review`, `Save to Vault`, `Add to Shed`, `When to Plant (by Zone)`, `Continue to Import Review`, `Overwrite with AI?`, `Save for Later`, `At a Glance`.
- **Descriptions / paragraphs / inline body copy = sentence case.** Examples: `Confirm your planting from this seed packet`, `Delete batch from your collection`, `Take or upload photos of product labels`, `Where did you get this seed?`.

**Decision criterion (at audit time, one question):** *Is the user expected to TAP it (button) or READ it as a label/title (header)? → Title Case. Is it explanatory copy supporting the UI? → sentence case.*

**AP-style Title Case mechanic (the locked rule):**

- **Capitalize:** nouns, verbs (including `is`, `are`, `be`), adjectives, adverbs, pronouns; **first** and **last** word ALWAYS capitalized regardless of part of speech
- **Lowercase mid-string:** articles (`a`, `an`, `the`); short conjunctions (`and`, `but`, `or`, `nor`, `for`, `yet`, `so`); prepositions ≤4 letters (`in`, `on`, `to`, `of`, `by`, `at`, `for`, `with`, `from`, `into`, `onto`, `over`, `up`)
- **Capitalize prepositions 5+ letters** (`After`, `Across`, `Through`, `Behind`, `Without`)
- **Compound verbs** capitalize the particle (`Sign Up`, `Log Out`, `Set Up` — particle is adverb, not preposition)
- **Hyphenated open-class words** capitalize both parts (`Re-Extract`, `Set-Up`); lowercase second part only when it's an article/preposition (`Add-on`)
- **Acronyms / proper nouns** stay as-is (`AI Fill`, `URL Import`, `Active Garden`, `My Plants`, `Friends & Family`)

**Surface-level taxonomy** (each row gets exactly one classification):

| Surface | Classification | Examples |
|---|---|---|
| Page h1 / hero title | **Title Case** | `Photo Import` · `Shopping List` · `Help` |
| Modal h2 / dialog title | **Title Case** | `Add Plant` · `Edit Packet` · `Delete Plant Profile?` |
| Section h2 / sub-header | **Title Case** | `Adding Things` · `When to Plant (by Zone)` · `At a Glance` |
| Sidebar settings sub-header (uppercase tracking) | **Title Case** | `Safe Tools` · `Danger Zone` (preserved as ALL-CAPS via `uppercase` utility; Title Case under-the-hood) |
| Tab labels | **Title Case** | `Library` · `Packets` · `Shed` |
| Button labels (submit + secondary CTA) | **Title Case** | `Save` · `Cancel` · `Add Plant` · `Confirm Planting` · `Save Changes` · `Save to Vault` |
| Chip / option labels in choosers | **Title Case** | `Manual Entry` · `Photo Import` · `Link Import` · `Purchase Order` |
| Settings menu row labels | **Title Case** | `Vendor Ratings` · `Photo Imports` · `Cache` |
| Empty-state titles | **Title Case** | `No Plants Yet` · `Your Library Starts Here` |
| Empty-state body | **sentence case** | `Add a plant to get started.` · `Long-living plants you keep year after year live here.` |
| Helper text / placeholder / inline body | **sentence case** | `Take or upload photos of product labels` · `Optional` · `Where did you get this seed?` |
| Field labels above inputs | **sentence case** | `Plant name` · `Variety / cultivar` · `Vendor / nursery` (already lowercased 2026-05-25 `a78dbd6` — preserved) |
| ARIA labels matching visible field labels | **sentence case** | Match the visible label's case verbatim |
| Toast messages | **sentence case** | `Plant saved.` · `Couldn't save changes — please refresh and try again.` |
| Day-rotating prompts / longer copy | **sentence case** | (Journal day-rotating prompts at [journal/page.tsx:639-650](src/app/journal/page.tsx:639) — kept verbatim) |
| Volume pills / single-word enum tokens | **sentence case (enum-token style)** | `Full` / `Partial` / `Low` / `Empty` · `Pot up` / `Plant out` / `Cold stratify` · `Fertilizer` / `Pesticide` / `Other` — preserved per 2026-05-25 `a78dbd6` enum-token rule |

**Proper-noun preservations** (stay Title Case regardless of position — page-level labels or canonical noun phrases):

- `Active Garden`, `My Plants`, `Library` (renamed from `Plant Profiles` 2026-05-27), `Seed Vault`, `Shed` — page/tab labels per ROADMAP 2026-05-24 `006dd69` Item 2 lock
- `Plant This Month` (renamed from `Plantable` per ROADMAP 2026-05-25 `b669a2a`) — Title Case applies now
- `Friends & Family`, `Vista Gardeners` — group names
- `Vault`, `Garden`, `Calendar`, `Journal`, `Home`, `Settings`, `Help`, `Shopping List` — primary nav labels (already Title; no change)

**GT-only.** Voyager has its own voice (parchment register + in-world vocabulary); this split rule does NOT apply there.

**Why this rule exists.** The 2026-05-24 all-sentence-case lock was an overcorrection from prior Title-Case-everywhere drift. The right balance is the industry split: Title Case for things you tap or scan as a label; sentence case for things you read as prose. Two failure modes named: (a) Title-Case-everywhere reads as marketing-shouty for body copy ("Take Or Upload Photos Of Product Labels" — wrong); (b) sentence-case-everywhere reads as careless for headers and buttons ("Add plant" feels half-finished where every shipped iOS app says "Add Plant"). Industry-standard split avoids both. Persona walk: Maya (power user, scans labels) reads Title Case as expected; Sydney reads as cohesive; Walter (iPad-primary) reads as standard-iOS-app expectations met; Aria + Sam read empty-state title-vs-body case differential as a clear info hierarchy. All 5 personas pass.

### Empty-cell display convention

**Locked 2026-05-27.** Empty data cells across GT display as **em dash "—"** (single character, U+2014). The convention applies to any data field in a profile / table / detail view that has no value AND where there's no semantic distinction between "missing," "user didn't enter," or "doesn't apply."

**The rule (two branches):**

- **Use "—" for:** unambiguous "no data" cells. Examples: Vault profile About → Germination · Days to Maturity · Spacing · Light · Water · Soil type — all show "—" when no value exists. Plant cards → optional metadata fields. Any data row where the field is structurally present but has no current value.
- **Preserve semantic strings for:** fields where the displayed value carries meaning the user needs to read.
  - `"None"` = user deliberately chose none (e.g., a setting they toggled off)
  - `"N/A"` = column doesn't apply to this row by design (e.g., germination time on an established-plant lifecycle path)
  - `"Unknown"` = we tried to infer the value but couldn't determine it (a known-unknown distinct from never-entered)
  Don't collapse semantic meaning into the empty-state symbol.

**Decision criterion at audit time (one question):** *Does this field's absence carry meaning that the user needs to read?*

- No (just "no data here") → **"—"**
- Yes (user choice / structural distinction / known-unknown) → **preserve the explicit string**

**Not for:**

- **Loading states** — use spinners or skeleton primitives, not "—"
- **Disabled states** — use opacity / muted color / pointer-events-none, not "—"
- **Form placeholder text** — placeholders are input prompts ("e.g., 75-85 days"), not empty-state indicators
- **Empty-state body copy** — full sentences per the 3-part empty-state frame (purpose-describing title / plain next-step body / verb-led CTA), see §3.12 #5 ship `9bad88f`

**Rationale.** Industry-standard typography for missing data in tables and structured data displays (Apple Numbers, Google Sheets, financial dashboards, iOS Settings). Single character avoids the visual weight of `"--"` (which reads as a strikethrough or dashes-as-separator) and the verbal weight of `"N/A"` / `"None"` / `"Unknown"` (which all imply more meaning than the absence actually carries). Em dash is the typographic standard, not en dash ("–", U+2013) or hyphen-minus ("-", U+002D) — use the U+2014 character.

**Persona walk.** All 5 personas pass: Maya (power user) reads "—" as standard table convention without parsing; Sydney sees cohesion across profile views (consistent symbol means consistent meaning); Walter (iPad-primary) reads "—" as universally-recognized "no value" without learning a per-app vocabulary; Aria + Sam (low-data new-user states) see less visual noise than "--" / "N/A" / "None" — empty fields visually recede instead of competing for attention with populated ones.

**GT-only.** Voyager has its own voice; this convention does NOT apply there unless surfaced separately.

### Icon style — chrome vs content split

**Locked 2026-05-27.** Garden Tracker uses an **industry-standard split** between UI chrome and content, parallel to Apple HIG (SF Symbols system across native iOS) and Material Design (icon families separated by role).

**The rule (two branches):**

- **Chrome icons** — UI structure that recurs constantly across the app: FAB chips, nav bars (sidebar + bottom), settings gears, tab icons, form-field icons, list-row affordances (chevrons, kebabs, swipe-action icons), modal close-X, header utility icons. These use a **flat, monochromatic line style** (single stroke weight, single color via `currentColor`, no fill, no illustration detail). Calm + clear + non-competing. Chrome icons are *persistent* across the app and must not pull attention from content.
- **Content icons** — emphasis on specific things the user is actively engaging with: achievement badges, plant-category markers, milestone markers (first sprout / first harvest / 1-year anniversary), journal milestones, seasonal markers, celebratory moments (seedling celebration), illustrated empty-state hero art. These can be **illustrated, colored, or emoji-style**. They are *moments*, not chrome — they invite attention because they ARE the content.

**Decision criterion at audit time (one question):** *Is this icon UI structure (recurring + present across the app + supports the user finding/tapping something) or content (specific + attention-worthy + the thing the user is engaging with)?*

- Chrome → **flat, monochromatic line style**
- Content → **illustrated / colored / emoji-style OK**

**Why this rule exists.** Industry-standard split (Apple HIG SF Symbols system, Material Design icon families). Mixing styles intentionally **by role** is correct; mixing styles randomly within a single role is drift. Chrome that competes for attention exhausts the user across a long session; content that stays as flat chrome reads as bureaucratic and misses the emotional beat the moment is supposed to land.

**How to apply when introducing a new icon.** Ask the criterion question first; pick the bucket; then pick the specific icon within that bucket per the existing chrome library (Lucide-via-`styleDictionary.tsx`) or commission new illustrated artwork for content moments.

**Worked example — FAB Add plant icon (queued semantic-fix swap).** The current FAB "Add plant" icon visually reads as a seed rather than a plant. Per this convention: the icon is **chrome** (it's the FAB's primary chip, persistent + recurring + UI structure), so the fix stays **flat monotone** — we just need a better-shaped plant icon from the existing Lucide library, NOT a switch to illustrated / colored / emoji-style. This is exactly the rule applying: chrome category locked, semantic shape fixed within the chrome style. *Same shape as 2026-05-12 chunk 3.9 #4 (Garden card "Add journal entry" trigger icon swap, `3de1c2c`) — flat icon swap within the chrome lane to fix semantic mismatch, style unchanged.*

**Relationship to §11 "App-wide icon density" parked decision.** The §11 parked entry (raised 2026-05-08 / widened 2026-05-11) asks which canonical stroke weight + size the **chrome** lane should standardize on (stroke 1.2 from `styleDictionary.tsx` vs stroke 2.0 from `navItems.tsx`). This convention sits **above** that question: §11 settles **unification within the chrome lane**; this convention sets **the chrome-vs-content category split itself**. Both are needed, neither closes the other. When §11 unlocks, its outcome applies to the chrome lane defined here; content icons remain unaffected (illustrated artwork doesn't have a stroke weight).

**Persona walk.** All 5 personas pass. Maya (power user, scans labels) reads chrome that stays calm — doesn't compete with content she's actively engaging with. Sydney (cohesion) sees industry-standard split as the cohesive feel she expects from polished apps. Walter (iPad-primary, standard-iOS-app expectations) reads flat monotone chrome as the SF Symbols convention; illustrated content icons read as moments worth lingering on. Aria (urban houseplant, low-data) sees chrome stay calm — never overwhelmed by FAB / nav even on a Day-1 surface. Sam (beginner, Day 1) experiences chrome that doesn't shout for attention, so the content moments (first sprout, first harvest) actually land emotionally when they appear.

**GT-only.** Voyager has its own visual register (parchment + in-world illustrated artwork); this convention does NOT apply there.

### Chrome control framing — sub-conventions

**Locked 2026-05-27.** GT chrome controls come in two distinct flavors with different framing conventions. Establishes a sub-rule WITHIN the chrome lane of the icon-style chrome-vs-content split (see preceding subsection): which chrome controls wear a frame, which read as inline affordances.

**The rule (two branches):**

- **Chevron navigation (prev/next, breadcrumb-style, section toggles) → UNFRAMED.** Use Lucide `ChevronLeft` / `ChevronRight` at `w-3` to `w-5` proportional to surrounding text; no square frame, no border, no fill; 44×44 invisible tap padding via flex centering for accessibility. Examples: Calendar month prev/next (locked via `b339f56` 2026-05-27 — `polish(calendar): drop square frame on month-nav arrows — icon-only chevrons`), breadcrumb chevrons, list-row navigation chevrons. **Exception:** framed chevrons (`rounded-full bg-white/90 border w-6 h-6`) are reserved for photo-overlay nav contexts where chrome aids legibility over a photo (Vault profile prev/next, Shed product prev/next).
- **Toggle chrome controls (view-switcher, mode-switcher) → FRAMED.** Use the pill toggle pattern: `rounded-xl border border-black/10 bg-white` (or matching theme tokens); icon-only inside, with optional border between toggle states; sits in toolbar positions, often alongside search/filter affordances. Examples: Library tab grid/list toggle (existing); Seed Packets tab grid/list toggle (locked via `fc338c2` 2026-05-27 — `polish(vault): Packets list↔grid toggle + Library photo-card active outline parity`).

**Decision criterion at audit time (one question):** *Does this chrome control represent STATE (a sticky mode the user is currently in) or ACTION (a transient trigger to go somewhere or do something)?*

- STATE → **framed** (the frame visually communicates "this is a stateful control; you are HERE")
- ACTION → **unframed** (reads as inline affordance; doesn't compete for attention)

**Why this rule exists.** Same chrome-vs-content semantic from the preceding icon-style convention, applied at the *control* level rather than the icon level. Chrome that holds state needs visual weight to signal stickiness; chrome that triggers transient navigation reads cleanest as bare inline glyphs. Mixing the two randomly produces a control vocabulary the user can't pattern-match against — exactly the cohesion-by-aggregation failure mode named in CLAUDE.md Pass 2.

**Relationship to preceding "Icon style — chrome vs content split" subsection.** Icon-style sets the *visual treatment* of icons (flat monotone vs illustrated); this convention sets the *framing* of chrome controls (frame vs no-frame). Both rules apply to chrome icons inside chevron and toggle controls: the icons stay flat monotone per icon-style, AND the controls follow the framing rule here. Orthogonal axes, both must be satisfied.

**Relationship to §11 "App-wide icon density" parked decision.** §11 asks which canonical stroke weight the chrome lane should standardize on; this convention is independent of that question (framing ≠ stroke weight). Both can lock independently. When §11 unlocks, its outcome applies to the icons inside both unframed chevrons and framed toggles.

**Persona walk.** All 5 personas pass. Maya (power user, scans labels) reads the framed/unframed split as expected stateful-vs-action distinction without parsing. Sydney (cohesion) sees the split as the cohesive feel she expects from polished apps where chrome behaves predictably. Walter (iPad-primary, standard-iOS-app expectations) reads bare-chevron prev/next as the universal navigation convention; framed view-toggle pills as the universal mode-switcher convention. Aria + Sam (low-data new-user states) see less visual noise on prev/next chevrons (unframed) — chrome stays calm; only stateful toggles announce themselves with a frame.

**GT-only.** Voyager has its own visual register; this convention does NOT apply there.

### Single-state tab-slot for cross-surface cohesion

**Locked 2026-06-01 (Sprint 5 cont Ship 2b).** When a surface has only ONE view but its sibling surfaces render a top-of-page tab-toggle row, the single-state surface STILL renders the tab-toggle slot (one inert tab) so the spatial layout reads consistently across siblings.

**The rule:** if surface A (single-view) sits in the same family as surfaces B/C that show a tab-toggle row in the top-of-page slot, A renders a one-tab version of that same toggle primitive rather than omitting the row. The lone tab is always-selected (`aria-selected={true}`), styled with the active token (`bg-white text-emerald-700 shadow-sm` inside the `inline-flex rounded-xl p-1 bg-neutral-100` pill), and its tap is a no-op (the user is already on the only view).

**Worked example.** Library (`/plants`) shows one "Library" tab; Garden shows "All" + user groups (`GroupTabs`); Vault shows "Packets" + "Shed" (`VaultPageContent` switcher). All three render the identical pill primitive in the same slot, so moving between the three inventory surfaces feels continuous instead of each having a different header shape.

**Decision criterion at audit time:** *Does this surface belong to a family where peers render a tab-toggle row? If yes and this surface has a single view → still render the one-tab slot. If the surface is standalone (no tab-bearing peers) → no slot needed.*

**Why this rule exists.** Syd dogfood 2026-05-30: Library had no top tab/menu element while Garden + Vault did, making the three inventory surfaces feel like different page templates. The lone tab costs one inert control and buys cross-surface spatial continuity — the same cohesion-by-aggregation principle as the chrome-control-framing + emerald-token conventions, applied at the layout-slot level.

**Persona walk.** All 5 pass. Maya/Sydney — the three inventory surfaces now share one header rhythm (cohesion). Walter — consistent layout reduces re-orientation cost between surfaces; the lone tab reads as "you're in Library", same as tapping the tab you're already on (no dead-tap confusion). Aria/Sam — no added complexity; one calm always-on label, not an interactive maze.

**GT-only.** Voyager has its own visual register; this convention does NOT apply there.

### Emerald primary-emphasis token split

**Locked 2026-05-27.** Semantically distinct affordances use semantically distinct emerald shades, parallel to the chrome-vs-content split (icon-style, chrome-control framing) — same principle applied to the color-token layer of primary-emphasis surfaces.

**The rule (two branches):**

- **`bg-emerald-500 text-white` = STATE / SELECTION.** Tab nav active state, selection pills, "you are here" indicators, batch-selection checkbox fill, toggle-switch checked state. The lighter shade signals current-state, not action.
- **`bg-emerald-600 hover:bg-emerald-700 text-white` = CTA / SUBMIT.** Save buttons, primary form submits, "do this action" CTAs, "Go to X" navigation triggers, primary call-to-action in empty-state cards. Canonicalized in the FAB-form submit saga (locked 2026-05-26 across [`fc1463d` → `ba9319f`](https://github.com/sydknee09-web/Garden-Tracker)); 41+ files use this pattern app-wide.

**Decision criterion at audit time (one question):** *Is the user expected to TAP to perform an ACTION (button, CTA, submit)? → `bg-emerald-600`. Is the element communicating a STATE (selected, active, current)? → `bg-emerald-500`.*

**Why the split.** The 1-step shade difference is barely perceptible side-by-side, but it carries semantic meaning when the eye scans the page: current-state surfaces should not read as call-to-action surfaces. Same chrome-vs-content principle as the icon-style + chrome-control-framing rules — distinct roles deserve distinct tokens within a unified family.

**Sites using the split (audited 2026-05-27):**

- **State / selection (`bg-emerald-500`):** [schedule/page.tsx:74](src/app/schedule/page.tsx:74) (tab nav active), [MonthlyPulseView.tsx:53](src/components/schedule/MonthlyPulseView.tsx:53) (selected month pill), [calendar/page.tsx:2473](src/app/calendar/page.tsx:2473) (batch-selection checkbox), [FeedbackModal.tsx:378](src/components/FeedbackModal.tsx:378) + [SettingsSuccessSoundToggle.tsx:39](src/components/SettingsSuccessSoundToggle.tsx:39) + [NewTaskModal.tsx:336](src/components/NewTaskModal.tsx:336) (toggle-switch checked state).
- **CTA / submit (`bg-emerald-600 hover:bg-emerald-700`):** [ActiveGardenView.tsx:991](src/components/ActiveGardenView.tsx:991) + [1010](src/components/ActiveGardenView.tsx:1010) (empty-state CTAs), [NoMatchCard.tsx:30](src/components/NoMatchCard.tsx:30) (primary CTA), [vault/review-import/page.tsx:1247](src/app/vault/review-import/page.tsx:1247) ("Find Hero Photos" CTA), plus 40+ existing canonical sites (Save buttons across AddPlantModal / EditPacketModal / BatchAddSeed / BatchAddSupply / FeedbackModal / etc.; "Add" CTAs in CareScheduleManager + EmptyStateCard; error-recovery CTAs in ErrorBoundary + global-error / route-error fallbacks).

**Not covered by the split:** semantic non-CTA usages of `bg-emerald-500` stay as-is — progress-bar fills, full-screen success-flash overlays (`bg-emerald-500/90`), color-legend swatches in Schedule views (`AnnualRoadmapView` direct/outdoor color), small status indicator dots, column-resize-handle active states, calendar entry-type color helper. These are NOT primary-emphasis affordances; they're semantic color usage where the shade is the meaning.

**Persona walk.** All 5 personas pass. Maya (power user, scans labels) sees the action/state split as the expected industry-standard tonal distinction. Sydney (cohesion-driver) sees primary-emphasis surfaces now obey one rule across the app instead of drifting per-component. Walter (iPad-primary, standard-iOS-app expectations) reads the slightly-deeper CTA shade as the universal Apple HIG "filled prominent button" convention; state surfaces read as the lighter "selected segment" convention. Aria + Sam (low-data new-user states) see action buttons in empty-state cards (the primary affordance pushing them toward first plant / first seed) carry the slightly-stronger visual weight that signals "tap me" — without the surface being shouty.

**Why this rule exists.** Surfaced during the cohesion polish bundle (`4c92e68` 2026-05-27) as a Pass 3 sibling-sweep finding: 7+ primary-emphasis sites used `bg-emerald-500` while the FAB-form submit saga had already canonicalized `bg-emerald-600` as Save-button-and-CTA across 41+ files. Two possible directions: (a) unify all primary-emphasis surfaces to one shade (loses the state/CTA semantic distinction), or (b) preserve the distinction by classifying each site as STATE or CTA and applying the matching shade. Syd locked direction (b) per Rule A ask + plain-English close-out 2026-05-27 — distinction carries semantic value worth preserving; 4 CTA sites flipped to canonical emerald-600 in the same ship that locked this sub-rule. The remaining state/selection sites (tab nav + pills + toggles + selection checkboxes) stay at emerald-500 by design.

**GT-only.** Voyager has its own visual register; this convention does NOT apply there.

### Button-system hierarchy (primary / secondary / tertiary / destructive)

**Locked 2026-06-01 (Sprint 5 cont Ship 5 — Finding 28).** Every button in GT belongs to one of four tiers. The tier sets visual weight; weight communicates which action the user is meant to reach for first. Parallel to Apple HIG (filled prominent / tinted / plain) + Material Design (filled / outlined / text).

**The four tiers:**

- **Primary** — the form's submit / main CTA. Solid `bg-emerald-600 hover:bg-emerald-700 text-white`, larger, sits in the sticky-bottom footer. One per surface. Canonical across 41+ files via the FAB-form submit saga (locked 2026-05-26, `fc1463d`→`ba9319f`). The primary CTA must be the **most prominent** control on the surface — nothing mid-form may out-weigh it.
- **Secondary** — alternate source, cancel, dismiss, or any "do this other thing" that isn't the main commit. **Outlined pill, green text:** `border border-teal-gus/40 text-teal-gus font-medium hover:bg-teal-gus/10` (teal-gus = `#2A9D8F`). Smaller weight than primary (outline vs fill carries the hierarchy; tap targets stay ≥44px for accessibility). Matches the locked Cancel button token — Cancel, alt-source photo buttons (`Take Photo` / `From Gallery`), and other dismiss/alt actions all share this one treatment.
- **Tertiary** — low-emphasis inline action. Text-only, minimal weight: e.g. `text-sm font-medium text-emerald-600 hover:text-emerald-700` (no border, no fill). For secondary-to-the-secondary actions (`Crop scraped image`, inline `+ Add packet` affordances).
- **Destructive** — delete / remove / irreversible. Outlined OR solid **red** pill, never green. (e.g. `border border-red-600 text-red-600 hover:bg-red-50` outlined, or `bg-red-600 hover:bg-red-700 text-white` solid for high-stakes confirm.)

**Decision criterion at audit time (one question):** *Is this the surface's main commit (primary), an alternate/cancel/dismiss action (secondary), a low-emphasis inline link (tertiary), or a delete/remove (destructive)? Pick the tier; apply its token.* If two buttons sit side-by-side as equal alternatives (e.g. `Take Photo` + `From Gallery`), they share the SAME tier and SAME treatment — never one solid + one outlined.

**Why this rule exists.** Syd dogfood Finding 28 (locked 2026-06-01): the Add Supply form rendered `From Gallery` as a large solid-green button — visually heavier than the actual `Add Supply` submit CTA — while its paired `Take Photo` button was outlined with BLACK text and the footer `Cancel` was outlined with GREEN text. Three drifts in one form: (a) a mid-form alt-source button out-weighing the primary submit, (b) two equal alt-source buttons with mismatched treatments, (c) inconsistent secondary text color. The tier system names which weight each action gets so the eye always lands on the real CTA first, and equal alternatives read as equal. Same cohesion-by-aggregation principle as the emerald-token-split + chrome-control-framing conventions — a per-button decision becomes a per-tier framework lock.

**Sweep at lock time (2026-06-01):** all `Take Photo` / `From Gallery` photo-source pairs across 12 add/edit form surfaces (QuickAddSupply, AddPlantModal, HarvestModal, QuickLogModal, EditJournalModal, BatchLogSheet, BatchAddSupply, garden inline quick-add, vault/[id] hero, vault/review-import, shed/review-import, vault/shed/[id]) normalized to the secondary teal token. Footer Save/Cancel already compliant (FAB-form saga). `Capture` (webcam-commit) stays primary — it's the commit action of the webcam sub-flow, not an alt-source.

**Persona walk.** All 5 personas pass. Maya (power user, scans for the action) — the real submit CTA is now always the heaviest control; no false-primary mid-form. Sydney (cohesion-driver + reporter) — sees the exact drift she flagged close; alt-source pairs match. Walter (iPad-primary, tap targets) — secondary buttons keep ≥44px targets; outline-vs-fill is the only thing that changed, discoverability intact. Aria + Sam (low-data, first forms) — calmer forms where one green-filled button (the submit) signals "this is the finish line," outlined greens signal "optional side paths."

**GT-only.** Voyager has its own visual register; this convention does NOT apply there.

### Default sort by use case (discovery vs lookup)

**Locked 2026-05-28.** Inventory surfaces split into two semantic categories. Default sort follows the user's mental model for that category — discovery surfaces surface fresh signal, lookup surfaces enable name-based finding.

**The rule (two branches):**

- **Discovery surfaces** = sort by **most-recent first**. Library / Active Garden / My Plants. User intent: *"what's new / what did I just add / what am I monitoring."* Recent-first surfaces the freshest signal at the top — the just-added variety, the just-planted batch, the plant whose photo I just logged.
- **Lookup surfaces** = sort by **alphabetical by item name**. Packets / Shed. User intent: *"I want to find a specific thing fast."* Alphabetical lookup wins over recent-first because the user knows what they want and the catalog has enough items that scrolling-by-recency isn't a viable find path.

**Decision criterion at audit time (one question):** *Is the user BROWSING for what's new (discovery), or LOOKING UP a specific item (lookup)? Discovery → most-recent. Lookup → alphabetical.*

**Behavior on lookup surfaces with OOS-equivalent concept:** when sorted alphabetically, push OOS/out-of-stock rows to the bottom (regardless of asc/desc direction). Semantically: alphabetical reads as "show me actionable items by name first." Currently applies to Packets (`is_archived || qty_status <= 0` rows). Shed has no OOS-equivalent — supply_profiles has no stock column; alphabetical default with no OOS-bottom handling.

**Sites using the framework (audited 2026-05-28):**

- **Discovery (most-recent first):** [garden/page.tsx:113](src/app/garden/page.tsx:113) (Active Garden, `sown_date desc`), [garden/page.tsx:121](src/app/garden/page.tsx:121) (My Plants, `name asc` — see note below), [VaultPageContent.tsx:225](src/app/vault/VaultPageContent.tsx:225) (Library, parent default `name asc` — see note below).
- **Lookup (alphabetical):** [PacketVaultView.tsx:73-74](src/components/PacketVaultView.tsx:73) (Packets, `variety asc` + OOS-bottom), [VaultPacketWing.tsx:211-212](src/app/vault/components/VaultPacketWing.tsx:211) (Packets embedded wrapper, `variety asc`), [VaultShedWing.tsx:162-163](src/app/vault/components/VaultShedWing.tsx:162) (Shed embedded wrapper, `name asc`), [ShedView.tsx:125-126](src/components/ShedView.tsx:125) (Shed standalone, `name asc`).

**Note on Library + My Plants discovery defaults.** Both currently default to alphabetical (`name asc`) in code, predating this framework. Per Syd's lock 2026-05-28, this is technically a discovery surface that *should* be most-recent default. Currently parked — flagging the gap to revisit alongside future Library/My Plants polish; the framework is the source of truth even when current state hasn't caught up.

**Persona walk.** All 5 personas pass. Maya (power user, many items) sees lookup surfaces resolve fast via alphabetical scan + OOS-bottom hides spent packets. Sydney (cohesion-driver, the originator) sees inventory surfaces obey one rule per category instead of drifting per-surface. Walter (familiar-pattern preference, iOS standard) sees alphabetical = Contacts / Music / Notes default = expected. Aria (sparse data, houseplants only) sees the framework apply but with little visible impact at her data scale. Sam (first-time, ~0-3 items per surface) sees no visible impact at small N; framework activates as collection grows.

**Why this rule exists.** Surfaced during the Inventory polish bundle (Item 2) 2026-05-28. Original Item 2 brief framed only Packets default-sort; Syd articulated the broader framework mid-build as the lookup-surface lock and extended Item 2 to include Shed by the same logic. The framework names what was already implicit in each surface's design intent — codifying it as a VISION §8 sub-rule means future inventory surfaces (new lookup catalogs, new discovery feeds) inherit the default sort decision instead of re-asking it per-surface. Pairs with VISION §8 chrome-vs-content + emerald-token-split convention pattern: a per-surface decision becomes a per-category decision becomes a one-time framework lock.

**GT-only.** Voyager has its own surface taxonomy; this convention does NOT apply there.

### Variety presentation — stacked italic

**Locked 2026-05-30** — reverses the prior implicit inline `Name (Variety)` parens-wrapped pattern that operated across inventory list surfaces.

On gallery cards + list rows across ALL inventory surfaces (Library/Plants, Packets, Garden), variety renders as a **separate stacked line beneath the plant name, italic, with no parentheses**.

**The rule (two branches):**

- Plant name on its own line (existing register: bold gallery h3, semibold list-row)
- Variety on the next line — italic, no parens, muted color register
- Conditional render: variety line only appears when `variety_name?.trim()` is truthy

**Decision criterion at audit time (one question):** *Does this surface render a LIST of named-with-variation items (multiple plants, multiple packets, multiple batches stacked vertically)? → stack the variety line under the name, italic, no parens.*

**Tokens:**

- **Gallery cards:** variety = `block font-normal italic text-black/60 truncate text-center w-full` (extends the existing gallery card variety register from `2e9df79` — drops parens + ensures stacked)
- **List rows + desktop table:** variety = `block text-sm font-normal italic text-neutral-600 truncate` (anchors VISION §8 info-note primitive `text-sm text-neutral-600 italic`)

**Example:**

```
Tomato                    ← name (bold gallery / semibold row, no change)
Cherokee Purple           ← variety (italic, no parens, muted, on own line)
```

NOT this (prior pattern, now reversed):

```
Tomato (Cherokee Purple)  ← inline with parens (rejected — see rationale)
```

**Not for:** title tooltips, aria-labels, toasts, modal body copy, single-item profile headers. Those stay inline `Name (Variety)` via `formatBatchDisplayName` or equivalent string concat — they are body-copy-equivalent single-line text where parenthetical reads naturally and there's no skimming axis to preserve.

**Why this rule exists.** Syd verbatim 2026-05-30: *"I like the variety under plant type because it's easier to skim and read. These pages get incredibly long so being able to easily skim the variety OR the name was nice."*

The principle: **independent skimmability of two axes.** Inventory lists grow long (a mature gardener accumulates dozens of plant types, hundreds of packets across years). Users need to scan by EITHER the plant-type name OR the variety without parens visually merging them into a single hybrid token. Inline `Name (Variety)` forces the eye to parse the whole compound string left-to-right on every row; stacked-with-distinct-register lets the eye sweep down either column independently — the bold left-aligned names form one scannable axis, the italic muted varieties form a second.

Italic + muted register signals "structurally distinct but subordinate axis" — botanist convention (`Solanum lycopersicum / 'Cherokee Purple'`), iOS Contacts (first-name + last-name stacked), Apple Music (song / artist stacked), iOS Settings sub-rows. The visual vocabulary is universally recognized.

**Generalizes beyond the 4 surfaces audited at lock time.** Any future list surface rendering named-with-variation items inherits this rule — don't re-derive the decision per surface. Single-item profile views (where there's only one row visible at a time and no skimming axis exists) are exempt; they can render inline `Name (Variety)` as body copy.

**Supersedes:** ROADMAP §6 2026-05-27 "Variety presentation standardization across list views" chapter (Sprint 5 SHOULD #19 — was inline parens-wrapped standardization, marked VERIFIED CLOSED 2026-05-30 in polish bundle `332f0d6`). Stack-italic-no-parens is the new canonical; reversal is acknowledged + transparent per CLAUDE.md authority-precedence — not silent drift. Prior ship work landed the inline-uniform pattern as intermediate state; this amendment flips the target.

**Persona walk.** All 5 personas pass. Maya (power user, many varieties on many plant types, lookup-heavy on Packets) — independent skimmability is the core win; she scans names OR varieties down the column without parsing compound tokens. Sydney (cohesion-driver, the reverser) — sees the lock land verbatim from her signal. Walter (iPad-primary, plain-language) — italic muted register reads as universal iOS "secondary detail" convention (Contacts / Notes / Settings); slightly taller rows aid tap targets. Aria (urban houseplant, low variety usage) — most of her plants have no variety field, so cards/rows render single-line as before — cleaner empty register without parens visual scaffolding. Sam (first-time, ~0-3 items) — no impact at empty-state scale; framework activates as her library grows.

**GT-only.** Voyager has its own conventions; this rule does NOT apply there.

### Profile-tab contextual add actions

**Locked 2026-05-30.** On a plant profile page ([vault/[id]](src/app/vault/[id]/page.tsx)), each tab's primary "Add X" CTA creates an entity of that tab's thing-type, pre-filled with the current profile as context. The handler is always the canonical create-X flow with the profile pre-selected — never a different create-Y flow even when current state suggests Y is a prerequisite. Prerequisite guardrails (e.g. "you need a packet first") live INSIDE the create-X flow, never in the entry handler.

**The rule (one branch per tab):**

- **Packets tab** → "Add packet" / "+ Add another packet" → [`AddPlantManualModal`](src/components/AddPlantManualModal.tsx) w/ `profileId` + `profileOwnerId`. Inserts into `seed_packets` with `plant_profile_id` pre-set.
- **Plantings tab** ("Plants") → "Add Plant" / "Add a planting" → [`AddPlantModal`](src/components/AddPlantModal.tsx) w/ `profileId` + `profileDisplayName` + `defaultPlantType` (`'permanent' | 'seasonal'`). `addToExistingProfile=true` forces `mode="existing"` + skips From-Library picker, landing the user directly on planting details (date / location / photo / quantity / packet-select-if-any). Zero-packet seasonal mode handled via inline `+ Add packet` affordance inside the same modal (Sprint 4 MUST #5 ship).
- **Journal tab** → "Add journal" / "Add a journal entry" → [`QuickLogModal`](src/components/QuickLogModal.tsx) w/ `preSelectedProfileId`.
- **Care tab** → no top-level "Add X" CTA. Add affordances live inside [`CareScheduleManager`](src/components/CareScheduleManager.tsx) per the Phase C internal-manager lock (Sprint 2-3).
- **About tab** → no add action. Read-only profile content.

**Decision criterion at audit time (one question):** *Does this tab's "Add X" handler open the canonical create-X flow with profile pre-filled, or does it route through a different create-Y flow because of current state? If the latter — wrong handler. Fix it.*

**Future tabs apply the same rule.** Adding a new profile tab (Care tab top-level affordance once it gets one, or any future tab)? The tab's add-action creates the tab's thing-type with profile pre-filled. Don't bounce through a sibling tab's flow.

**Persona walk.** All 5 personas pass. Maya (power user with many packets) gets the same `AddPlantModal` flow she's used to from other surfaces. Sydney (cohesion-driver + the reporter) sees the bug she flagged close — "Add Plant" no longer opens the seed-packet form. Walter (iPad-primary, plain-language) sees one modal per action — no surprising routings between create-X and create-Y forms. Aria (houseplant urban, `isPermanent=true` profiles) opens `AddPlantModal` in permanent mode — no packet UI surfaces. Sam (first-time, profile with zero packets) opens `AddPlantModal` seasonal, sees the inline `+ Add packet` affordance and graceful path forward — no dead end, no relabeled-form confusion.

**Why this rule exists.** Sprint 5 MUST #9 (locked 2026-05-30, [gt_v1_scope §2.1 row #9](.claude/plans/gt_v1_scope.md)): Plants tab "Add Plant" routed to the `AddPlantManualModal` ("Add Seed Packet" form) when zero non-empty packets existed — violating the rule. Branch A of `handlePlantAgain` dropped; modal selection now flows through the one canonical handler. Codifies the existing pattern that Packets / Journal / Plantings-with-packets tabs already followed; the unique violator was the zero-packet short-circuit on Plantings. Pattern lock means future profile tabs inherit the rule instead of re-deriving it.

**GT-only.** Voyager has its own profile taxonomy; this convention does NOT apply there.

### Complete-task affordance — responsive primitive lock (2026-06-01)

**Locked 2026-06-01** (Syd dogfood). A **single shared primitive** renders the complete affordance for every task/item-complete surface — so the interaction reads identically app-wide instead of each surface re-inventing it (cohesion-by-aggregation). Anchor: **Calendar's task row is the canonical reference.**

**The contract:**
- **Mobile (phone-portrait): swipe-LEFT to complete.** Reveals an emerald check; commits past 100px. Native iOS/Android row-action convention.
- **Desktop / iPad-portrait+ (`md:`+): checkmark button to complete.** Mouse-friendly; 44×44 tap target. Per Principle 9 (Walter persona, swipe-excluded): phone is swipe-only, `md:`+ shows the visible button alongside swipe.
- **Same underlying complete action; the viewport dictates the interaction mode** — not two different behaviors.

**Implementation (the shared pieces):**
- [`useRowSwipe`](../src/hooks/useRowSwipe.ts) — the swipe engine (custom touch listeners, no library; threshold 100px, direction-locks at 8px so vertical scroll isn't hijacked). Extracted 2026-06-01 from `calendar/page.tsx`.
- [`SwipeCompleteRow`](../src/components/SwipeCompleteRow.tsx) — wraps a row: emerald-check reveal + `translateX` slide + an optional amber snooze reveal when `onSnooze` is passed (Calendar's bidirectional config).
- [`RowCompleteButton`](../src/components/RowCompleteButton.tsx) — the `hidden md:flex` emerald checkmark pill; byte-identical across surfaces.

**Applies to:** Home At-a-Glance, Home Shopping List, dedicated Shopping List page, Calendar tasks, and **any future task/item-complete surface** (classify it, then compose the primitive — don't rebuild).

**Secondary actions stay per-surface and are NOT part of the swipe contract unless reversible.** Calendar maps swipe-RIGHT → snooze (reversible). Shopping List's secondary action is **remove**, which has no undo — so it stays a persistent visible button, never a swipe (locked 2026-06-01, Q1 = A: swipe-to-delete on a no-undo action is a footgun; Calendar's reversible snooze is not a true parallel). At-a-Glance is complete-only (no Home snooze — separate feature scope; Q2 = A).

**Swipe-complete REQUIRES an undo safety net (locked 2026-06-01, Syd dogfood — follow-up to `9f2d2e0`).** An irreversible gesture (a stray left-swipe = data loss) must be recoverable. The complete action is **deferred-commit, not write-then-revert**: swipe → optimistic row removal + a snackbar "Marked as purchased/done · Undo" → the real DB write fires only when the 5s window closes (`UNDO_WINDOW_MS`). Tapping Undo cancels the pending write and restores the row — so undo never has to reverse a write (critical, because `completeTask` is an irreversible cascade: grow_instance + journal + packet decrement/archive + profile status + harvest task + care schedule). The undo window lives in the shared `useToast` snackbar (one surface app-wide), so every consumer of the primitive inherits it. Same principle as the reversible-secondary-actions clause above, extended to the *primary* complete action by making it recoverable rather than instant. **Applies to:** Home Shopping List, Home At-a-Glance, dedicated Shopping List page. **ADJACENT (not yet covered):** Calendar swipe-complete still commits immediately with no undo — parked for a follow-up bundle (BUGS.md U29).

**Persona walk.** Maya/Sydney/Aria get the same swipe parity they know from Calendar. Walter (iPad-primary, swipe-excluded) keeps the visible `md:` checkmark button. Sam's empty-states are untouched (primitive only renders on populated rows).

**GT-only.** Voyager has its own interaction register; this convention does NOT apply there.

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
| **Cross-account exchange — Level 3 (trade history records)** | ✅ | Trades within trusted circle update both inventories with full history; "transferred" end state in originating user's record. Two shapes (locked 2026-05-17): direct give (long-press inventory item → pick recipient from browse-mode group members → Journal entry) + broadcast offer (post to board-mode group → someone claims → Journal entry). |
| **Public social-media stream / community feed** | 🕐 | AAPTIVE-style community posts / Q&A / photo sharing. Parked 2026-05-17 — "revisit post-MVP if user pull emerges." Infrastructure cost (moderation, abuse, content review) ≈ second app; differentiator at risk per §2 framing. Door open but not built in MVP. |
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
- **No activity feed at any sharing layer** (locked 2026-05-17). Empty-by-default principle wins over engagement-feed pressure. Direct interactions (incoming requests, approvals, completed trades) push-notify; ambient activity is pull-only (user checks when they want); household coordination is opt-in. No Instagram-style scrolling activity feed anywhere in the app.

---

## 11. Open decisions / Phase 3 deferred items

Items deferred to a later session, with the WHY of deferral preserved.

### Phase 3 (Information Architecture)
- **Beds as first-class — implementation.** Data model, migration, page design.
- **Plant database moderation philosophy.** Per-user vs shared canonical vs hybrid (curated + user-extension + suggestion queue). Concern: pollution, inappropriate content, duplicates. *My recommended approach: hybrid (curated canonical + private user extensions + suggestion queue).*
- **Growing instance representation.** Now somewhat resolved by beds-as-first-class, but exact relationship (instance-belongs-to-bed; quantity per instance; etc.) needs detail design.

### Other parked items
- **Calendar task fatigue approach** (partially unparked 2026-05-11; remainder still deferred). **Locked & shipped 2026-05-11 (`a7dadb7`):** default-collapse rules on Calendar load — overdue=collapsed, today=open, all other days=collapsed. Count badges on collapsed headers preserve at-a-glance scan. Tap-grid-day still switches to existing single-day view (preserved, not eliminated). Still parked: group-by-day reflow beyond the current per-date sections, collapse-completed-today auto-hide, lazy-load older completions, Today/Week vs full-month default window.
- ~~**Cross-view consistency: Vault grid / Garden gallery / My Plants list**~~ ✅ **CLOSED 2026-05-28** (deferred 2026-05-07; partially closed 2026-05-27 with JournalView OOS note; fully closed via two complementary ships: list view consistency `c851b3d` 2026-05-27 + gallery card view standardization `fb5d9a0` 2026-05-28). **Update 2026-05-28:** All 5 inventory surfaces (Vault Library + Packets + Shed + Garden Active + Garden My Plants) now share canonical list+gallery patterns. List mode = condensed-row format from `c851b3d`. Gallery mode = canonical card from `fb5d9a0` (`rounded-lg bg-white shadow-card` + `px-1.5 pt-1.5` image-padding wrapper + `aspect-square rounded-xl` image + center-aligned text + top-LEFT owner-badge slot + top-RIGHT status-chip slot). Different per-surface data preserved (each card shows its useful metadata) per "same format, different data" principle. **Journal stays distinct** ([src/app/journal/page.tsx](src/app/journal/page.tsx)) in its own format register (action-log shape — grouped by entry/date/plant across 3 view modes: table mobile-card / timeline plant-gallery / grid Instagram-feed) by design — different mental model from the collection-list surfaces. Already shares design tokens with the unified list pattern (`rounded-xl border bg-white p-4 shadow-card card-interactive` on mobile-card mode at [journal/page.tsx:685+](src/app/journal/page.tsx:685)) so visual cohesion is preserved at the token level; shape divergence is intentional. See ROADMAP §6 2026-05-28 entry for full migration log.
- **Too many places to edit a plant's image** (in `BACKLOG.md`, deferred 2026-05-07).
- **App-wide icon density / canonical stroke weight** (raised 2026-05-08 as "FAB icon consistency"; widened 2026-05-11 after the same issue surfaced in the new sidebar nav). Two icon libraries collide in the app: `navItems.tsx` (24×24, stroke 2.0, 5 primary nav icons) vs `styleDictionary.tsx` (24×24, stroke 1.2, 42 icons used app-wide in FAB, modals, headers). Sidebar today renders four distinct rendering systems in one component: primary nav (24×24 @ 2.0), Shopping list (20×20 @ 1.2), Settings/Feedback (20×20 @ 2.0), Help (text glyph `?`, not an SVG at all). *Recommended direction: standardize on stroke 1.2 + render 24×24 + convert Help to SVG — because `styleDictionary.tsx` is the larger library, so picking 1.2 as canonical pulls the rest of the app toward sidebar (less rework long-term). Counter-option: stroke 2.0 canonical. Awaiting user decision on canonical stroke weight.*
- ~~**Save / Cancel button consistency**~~ ✅ **CLOSED 2026-05-26** (raised 2026-05-08, locked in FAB-form submit saga commits `fc1463d` → `ba9319f`). Final lock: side-by-side Cancel-left + Save-right + `bg-emerald-600 hover:bg-emerald-700` Save + `border-teal-gus/40 text-teal-gus` Cancel + `border-t border-neutral-200` separator + disable-until-valid on every form. AddPlantModal C1 deferral (asymmetric Manual entry path) closed in same saga via `embedded?: boolean` prop + new `add-plant-manual` screen in UniversalAddMenu. Companion ADJACENT findings parked for future cohesion pass: AddPlantManualModal (Vault Packets tab), HarvestModal, EditJournalModal, EditPacketModal, AddItemModal, FeedbackModal, InviteMemberModal — all non-FAB-tree edit/utility modals with similar submit-shape. See ROADMAP §6 2026-05-26 entry for full saga decision log.
- **Calendar task row primitive — "bubbles vs. list"** (raised 2026-05-08). User flagged that `CalendarTaskRow` reads as cards/bubbles (rounded-xl + white bg + emerald border + drop shadow) rather than as list items, and that this contributes to density-fatigue on the calendar page. *Resolution direction (2026-05-08): mobile gets swipe gestures (left=complete, right=snooze) and inline buttons hide; desktop keeps inline buttons. Plan-audit clean; awaiting build greenlight.* **Refined 2026-05-17 (`distracted-wilson-616865` chat, §3.12 theme #4 P0):** the "mobile-hides-buttons" rule narrowed from `lg:` to `md:` — phone-portrait still hides buttons (swipe-only); iPad-portrait+ now shows visible buttons alongside swipe per Walter persona accessibility. Bubbles-vs-list density question (the original parked direction) is still open separately.
- **Modal/menu placement on desktop — audit pass needed** (raised 2026-05-08; re-flagged with cutoff observation 2026-05-17). User flagged that the FAB Add menu (and likely other phone-style modals: NewTaskModal, QuickLogModal, snooze sheet, batch reschedule sheet, batch delete sheet) renders as a centered floating card at fixed widths on desktop, which feels wrong on a wide screen — it's a phone bottom-sheet pattern bleeding into desktop. *My recommendation: per Principle 9 (mobile-first with desktop responsive), audit all phone-style modals; on `lg:` screens they should either anchor near their trigger (popover-style) for the FAB menu, OR cap width and add proper desktop framing (centered modal with backdrop) for full-screen sheets.* **Re-flagged 2026-05-17 (ecstatic-rubin-5f30c8 chat close-out feedback):** User added cutoff observation + explicit request for audit pass — *"at some point, we need to do an audit of our menus. some of them are too low and get cut off on my screen."* This raises severity beyond aesthetic-only: cutoff = broken affordance on user's specific viewport. **Audit scope:** enumerate every modal/menu/sheet primitive in the app, capture its current rendering shape at user's desktop viewport, identify cutoffs + placement issues. Specific primitives to enumerate (non-exhaustive from 2026-05-08 list + grep): UniversalAddMenu (FAB; U23 fix `79836f4` addressed phone-cutoff via `max-h-[85svh]` but desktop placement still parked here); NewTaskModal; QuickLogModal; snooze sheet; batch reschedule sheet; batch delete sheet; HarvestModal; GrowInstanceModal; AddPlantModal; EditPacketModal; AddSeedSubmenu / sub-screens; Settings drawers; any `*Sheet.tsx` / `*Modal.tsx` component. **Bundle with chunk 3.2 B4 (modal/sheet desktop treatment)** if not earlier. Pairs naturally with B5 (per-page audit) — same surface inventory.
- **Desktop layout — calendar oversized + bottom nav feels mobile-y + empty horizontal space** (raised 2026-05-08; ACTIVE since 2026-05-10 with B1 + B2 shipped 2026-05-11). User flagged that on web browser: (a) the calendar grid is oversized for the viewport (~280px-wide cells on 1920px screens), (b) shrinking the calendar leaves a lot of empty horizontal space, (c) the bottom nav bar feels phone-y on desktop. **Active build pass** is the Phase 4+5 desktop layout pass — see ROADMAP §3.2. Breakpoint locked at **`xl:` (1280px)** so iPad-landscape stays on mobile-style; sidebar appears on every page in the pass, but two-column right-column treatment is **Calendar-only** for now (other pages stay single-column until Phase 5 designs their layouts). Milestones B1 (App shell + sidebar nav, `e61ffdc`) and B2 (Calendar two-column, `8624c8d`) shipped. B3 (FAB → popover), B4 (modal/sheet desktop treatment), B5 (per-page audit) queued. Sidebar shape locked: 240px expanded ↔ 64px collapsed, chevron toggle persists to localStorage; five primary nav items reused from BottomNav; Shopping list / Help / Settings / Feedback in sidebar footer (they're utilities, not sections); slim top header retains cloud-sync + page title + household toggle. Calendar two-column shape locked: left 640px sticky at `top-12`, gap-6 (24px), right `flex-1` capped at `max-w-[720px]`.
- **HarvestModal end-state realization** (raised 2026-05-14, discovered during U24 diagnosis; **re-framed 2026-05-28** by Phase A status enum collapse). [HarvestModal.tsx:99-110](src/components/HarvestModal.tsx:99) only inserts a `journal_entries` row with `entry_type: 'harvest'`; does NOT mutate the `grow_instances` row. Per VISION §5 end-states, "Harvested out — ran its full course, retired (annual)" is supposed to be a plant end-state. **Re-frame after 2026-05-28 Phase A (`grow_instances.status` collapsed to `growing | archived`):** the prior recommendation (auto-end checkbox writing `status: 'harvested'`) is now obsolete — `harvested` is no longer a valid enum value. New shape: if Harvest modal should offer an end-state, it would write `{status: 'archived', ended_at: now, end_reason: 'harvested'}` instead. But Phase A's locked semantics ("Growing = covers actively growing, producing fruit, dormant perennials") explicitly include post-harvest annuals as still Growing until the user manually Archives at season end. **Recommended direction (revised 2026-05-28):** *defer this parked entry indefinitely* — Phase A's manual-Archive model handles annual end-state realization via user action, not via auto-checkbox at harvest time. Original (A)/(B) options superseded. Revisit only if dogfood reveals users systematically forget to Archive annuals at season end.
- **Sister's additional feedback** (pending). Will fold in when received.
- **Sharing UX / purpose narrowing** (raised 2026-05-17, **resolved 2026-05-17 same day**). All 6 open-territory items (a)-(f) locked in dedicated chat (`competent-blackwell-5de2a2`). See ROADMAP §6 2026-05-17 entry for full decision log + reasoning. **Summary:** 3-layer audience model gains internal structure (Trusted circle = collection of browse-mode and board-mode groups, default "Friends & Family" browse group auto-created); sharing data model = communication + transfer-at-time (no pre-marked "shareable" state); per-category privacy opt-in; trade lifecycle = two shapes (direct-give from inventory cards + broadcast-offer from group board), both auto-log to Journal; notifications differentiated by interaction type (direct push / ambient pull / household opt-in / no activity feed); household attribution auto-recorded with default-hide + filter-on-demand; public boundary stays "never public" with 🕐 long-term post-MVP revisit. **Captured to:** §1 boundaries, §3 Layer 2 + Layer 3 expanded, §9 new public-stream 🕐 row, §10 new no-activity-feed don't-touch. **Companion locks same chat:** persona system (`docs/PERSONAS.md`) + app-store distribution context explicit.

- **AGENTS.md doc-architecture split** (raised 2026-05-16, from other-project skeleton checklist). Skeleton's other project uses `AGENTS.md` at repo root as the **single source of truth for locked decisions** — one line per lock — with `docs/` carrying the WHY, alternatives considered, voice/tone, and deeper rationale. Garden Tracker today has VISION.md doing both jobs: it's the locked-decisions register AND the deep rationale doc. The one-line register is increasingly buried 10 sections deep, and §11 alone has grown to ~15 entries that future-Claude has to scan in full to find a given lock. *Recommended direction (NOT yet decided):* migrate ~50+ one-line locks from VISION + ROADMAP §6 + CLAUDE.md into an AGENTS.md at repo root, keeping rationale-prose in the source docs with `(see AGENTS.md L-N#)` cross-refs. Roadmap stays as-is (current-state truths). *Why deferred:* touches every cross-ref in every doc; needs its own plan-audit cycle; capture-doc-boundaries table needs updates; worth a separate chat purpose, not a bolt-on. *Counter-case to consider:* the current "scattered locks across 3 docs" pattern works as long as the precedence rule (CLAUDE.md "Authority precedence," locked 2026-05-16) is followed — splitting may add doc-overhead without proportional clarity gain. Decision deferred to a future chat where the user has bandwidth to evaluate the trade-off.

---

## 12. Recent signals (rolling log)

Last several pieces of feedback from the user, in case any didn't make it into the right section above. Acts as a safety net. Most recent at the top.

- **2026-05-17 (latest):** **U25 ✅ verified clean on prod + 2 procedural rules locked + concurrent-chat collision caught + reconciled mid-Phase-3.** Chat purpose: phone-verify U25 (`11eaf37`) on prod, then triage 3 procedural / doc items from prior-chat handoff. **U25 verify outcome:** user phone-verified — My Plants list per-row "Add journal entry" pen icon (`ICON_MAP.Edit`) matches Active Garden gallery + list. Cross-surface cohesion within Garden tabs confirmed end-to-end; Vault profile sites remain parked per ROADMAP §4. **Concurrent-chat collision discovered pre-push (via `git diff origin/main`):** 4 commits landed on origin/main during this chat — `f620e37` frosty-wright-d437a7 shipped a comprehensive ROADMAP archive policy (§7: §1 ≤2 paragraphs, §5 ~10 entries, §6 ~14 days inline) + applied it. **My P2 "ROADMAP shortening park as §3.10 R10" entry was OBSOLETE** the moment the parallel chat landed — the archive policy is already shipped + applied with a better 3-cap rule than my single-cap R10 proposal. Plan amended mid-Phase-3 per Phase 3 amendment-re-audit clause: rebase via `git stash + git pull --rebase origin main + drop stash + surgical re-apply on rebased state` (no destructive operations; user explicitly chose this path via Rule A ask after hearing alternatives). P2 dropped; P1/P3/P4 preserved and re-applied on §1 ≤2 paragraph cap + §5 ~10 cap rules. **2 procedural rules shipped:** (P3) CLAUDE.md Phase 2 readiness gate gains 9th checklist item — `git fetch origin main` before amending CLAUDE.md / VISION.md / ROADMAP.md; catches concurrent-chat collisions earlier than rebase. **Ironically, the P3 rule I'm shipping would have caught this very collision** if it had been in place during my plan-mode draft. Strong real-time validation. (P4) Settings-layer fix for push-classifier authorization gap — added narrow `Bash(git push origin HEAD:main)` allowlist to `.claude/settings.json` `permissions.allow` + CLAUDE.md push-classifier caveat amended to note the bypass. Trade-off heard via Rule A: removes runtime backstop on this push form; rule enforcement moves to plan-mode + AskUserQuestion only. **Open verification (testable on this chat's doc + config push):** whether `permissions.allow` actually bypasses the auto-mode classifier. **Process maturity demonstrated end-to-end:** first ExitPlanMode rejected with "okay as long as audit passes" — pre-rebase audit re-run caught the §3.10 D1 stale finding. Post-rebase amendment was caught by `git diff origin/main` AFTER ExitPlanMode approval. The rule I just shipped (P3) is precisely the mechanism that would catch this BEFORE plan-mode entry next time. Plan file at `C:\Users\marsh\.claude\plans\new-chat-phone-verify-agile-conway.md` retains full audit trail + amendment block + rebase reconciliation log.

- **2026-05-16:** **CLAUDE.md amendment shipped (`3d9a8a7`) — incorporated 5 high-value framings from user's other-project skeleton + 1 new gap from 10-section checklist walk.** User signal verbatim: *"my other project process has been much smoother, it doesnt bug me as much and i feel like it stays on task/makes decisions more in line with the vision and i feel alot more clear on what we're working on/ that we're staying on task and are making good progress. i asked them what to give you and they gave a skeleton md doc."* Walk-through against a 10-section checklist (rules card / role lock / authority hierarchy / locked-decisions doc / search-before-respond / aesthetic exception / audit standard / push tiers / polish-phase triage / handoff protocol) showed 5 weak spots — 4 already addressed by the original plan (role lock, audit Pass 3, polish split, handoff gate), 1 new gap surfaced (authority doc-vs-doc precedence) and folded into the plan as A0. Shipped 9 amendment sites in `CLAUDE.md` + 1 entry in `VISION.md §11` + new memory entry `audit_pass3_is_sibling_sweep.md`. Skipped: "no shame UX" voice rule (project-specific to other project); conventional-commit prefix (needs separate user decision); 6 RULES CARD items already covered. Deferred: AGENTS.md doc-architecture split to a future chat purpose. **Dogfood test of the new audit pass on my own work:** 4-pass audit (factual / concerns / sibling / lock) on the amendment plan terminated clean across initial draft + 1 amendment round (A0 added post-checklist). Sibling-sweep eaten own dog food: A0 cross-refs the existing user-vs-doc precedence rule as its adjacent sibling. **Just-captured status:** effectiveness of the new framings will be visible across the next 2-3 chats — monitor whether RULES CARD scan + role-lock framing + sibling sweep reduce drift compared to recent baseline. Doc-only ship.

- **2026-05-16 (later):** **U24 closed end-to-end + migration audit run + U25 captured.** Phase B diagnostic chain played out as Phase A instrumentation predicted: user retried bulk-end with instrumented build, debug log captured 3× `PGRST204: Could not find the 'ended_at' column of 'grow_instances' in the schema cache`. Root cause = migration `20250207600000_grow_instances_archived_ended.sql` never applied to prod Supabase. User applied missing DDL via Dashboard SQL Editor (`ALTER TABLE grow_instances ADD COLUMN ended_at + widen status CHECK to 5 values`); re-tested bulk-end on phone → success. **U24 CLOSED.** Comprehensive migration audit followed: column-dump query across all public tables; only ONE additional gap found — `user_settings.onboarding_completed_at` from `20250330000000_user_settings_onboarding_complete.sql` — also applied via Dashboard. **Root cause of both gaps = duplicate migration timestamp prefix bug.** Two migration files share identical prefix `20250330000000` (`_journal_entry_type_prune.sql` and `_user_settings_onboarding_complete.sql`). Supabase migration ordering uses the prefix; when prefixes collide, ordering is undefined and one can be silently skipped by `supabase db push` or by Dashboard application order. Same root cause likely produced the original `ended_at` gap if a similar collision existed earlier in the migration timeline (not investigated). **Process fix proposed:** future migrations use unique `YYYYMMDDHHMMSS` timestamps (14 digits with actual time) not `YYYYMMDD000000` (8 digits + 6 zeros). Captured to ROADMAP §3.10 as new R-item. **U25 captured to BUGS:** during phone-verify of `3de1c2c` (chunk 3.9 #4 garden trigger icon swap), user reported Active Garden = pen icon ✅ but My Plants list = paper/notebook icon — cross-surface mismatch on the same "Add journal entry" action. Strict bug per VISION §4 principle 3 (objective inconsistency). Root cause: `3de1c2c` scoped to ActiveGardenView only; MyPlantsView wasn't named in scope. The cohesion-by-aggregation rule locked 2026-05-14 would have caught this in Pass 2 had it existed at ship time. Fix scoped: 2-line code change (import ICON_MAP + swap inline SVG to `<ICON_MAP.Edit />`) + regression test extension + Preview MCP. Deferred to follow-up chat. **Plan-audit + Phase A instrumentation validated end-to-end** — saved hours of "guess the cause" cycles. Doc-only ship this turn.

- **2026-05-16:** **Tree-data feature asks raised — chill hours + rootstock tracking.** User direction: *"i need chill hours added to our profiles for trees. and i want to be able to track rootstocks for trees."* Step 0 search found rootstock pre-captured in `docs/FEEDBACK_AND_FEATURE_NOTES.md:67` (legacy pre-VISION-v4 doc, §3.10 D1 archive candidate) with workaround pattern (variety line + growing notes) + "first-class later" note; chill hours net-new (no prior capture in BUGS / ROADMAP §3+§4 / VISION §11 / BACKLOG.md / CLAUDE.md or src/). Both items scope-✅ (VISION §6 Theme 2 plant profile depth + §3.6 chunk) but off-current-chunks. **PM triage outcome (user chose park-to-3.6):** added as sub-items in ROADMAP §3.6 scope list + §4 parked items with full context. Attachment-point split named: chill hours = variety-level on `plant_profiles`; rootstock = instance-level on `grow_instances` (Phase 3 IA decision input). Rootstock entry migrated from legacy `FEEDBACK_AND_FEATURE_NOTES.md` to canonical ROADMAP §4 capture; legacy entry marked SUPERSEDED 2026-05-16. Build deferred until current slate clears (U24 Phase B + parallel onboarding chat + chunk 3.2 B3-B5 + chunk 3.9 aesthetic items + §3.10 doc-hygiene) OR user greenlights as priority shift. Counter-context noted (not picked up): if testers grow trees, tree-field readiness could shape onboarding-for-testers chat's scope — left to that chat to decide if relevant. Doc-only ship.

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
