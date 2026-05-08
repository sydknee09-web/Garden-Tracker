# Garden Tracker — Vision & Design Source of Truth

> **Read this file at the start of every session.** It captures the user's vision, preferences, and decisions across chats so we build coherently from one session to the next. Updated continuously as we work.
>
> Conventions used in this doc:
> - **User signal (verbatim or paraphrased)** — preserves what the user actually said
> - *My recommendation* — Claude's input, clearly labeled, subject to user override
> - **Open question** — parked decisions waiting on user input

---

## 1. App identity

Garden Tracker is a personal garden management app. The user is building it as their **first software project ever** — they are not a software developer. They are the product visionary; Claude is the build partner.

**Tone:** Calm, polished, useful. Not flashy. Not clinical. The app should feel like it respects the user's attention and time.

**Primary user (single):** the person building it. Solo gardener tracking seeds, plant profiles, garden state, tasks, journal entries, harvests.

---

## 2. Operating principles

These govern every decision in this codebase.

1. **The user is the product visionary, not the engineer.** Their vision drives what gets built. Claude's recommendations are starting points, not specifications.
2. **Don't make aesthetic / UX decisions without asking.** Visual hierarchy, color choices, density tradeoffs, what to emphasize — all subjective. Claude proposes options; user picks.
3. **Strict bugs (truncation, broken behavior, objective inconsistency) are OK to fix without asking.** Anywhere reasonable people could disagree on the solution requires asking.
4. **Batch small fixes.** XS-S visual fixes go out 3-5 at a time per deploy, not one-by-one. (See `WORKFLOW.md`.)
5. **Task fatigue is the enemy.** When the user feels overwhelmed by data volume, the answer is presentation (default windows, grouping, lazy loading) — not removing features.
6. **Continuity matters.** This file exists so the user doesn't have to re-litigate decisions across chats. Claude updates it as we work.

---

## 3. By surface

### Home
*No specific signals captured yet.*

### Vault (Plant Profiles, Packets, Shed)
- **Plant placeholder asset:** `/public/plant-placeholder.png` (the three-leaf PNG illustration). This is the canonical placeholder; not the SeedlingIcon component.
- **Placeholder container background:** `bg-white`. Matches the PNG's white background so there's no visible seam.
- **Vault grid card layout:** 3 cards per row.

**Open question (parked 2026-05-07):** Cross-view consistency between Vault Plant Profiles grid, Garden Active Garden gallery, Garden My Plants list. User flagged that names are legible across all three but layout/format/text style differ. Decision pending: which view is canonical, what aspects need to match (card shape, text size, photo size, spacing), and whether grid views should match each other while list views match each other separately.

### Garden (Active Garden, My Plants)
- **Active Garden gallery cards:** Names should NOT clip from both sides (a `truncate` + center-aligned bug). Use `line-clamp-2` instead so longer names wrap to two lines.

### Calendar
**Vision:** The Calendar is the only place tasks live and get completed. It's where the user finds out what to do today/this week, and where work gets checked off. It's not a passive view — it's the page where work happens.

**Preserved decisions:**
- **Grid as primary check-in surface (2026-05-08).** The month grid at the top is the "do I have stuff today / coming up" overview. Don't compact, don't demote, don't reskin without asking.
- **Task list = the meat (2026-05-08).** Below the grid is the actual doing. Reducing the FEATURE set is not the answer; the problem is density / fatigue.
- **Plantable widget separation (2026-05-08).** Plantable is planning info, intentionally NOT mixed into tasks or the calendar grid. It's a popup. Preserve this separation.
- **Plantable visual treatment (2026-05-08).** Original (pre-U18) treatment: green-tinted card with green text. Don't reskin without asking.

*My recommendation (subject to override):* If we tackle task fatigue, default the task list below the grid to a smaller window (Today or This Week) with a "Show all" expand. Keep the feature set intact.

**Open question (parked 2026-05-08):** Task fatigue approach — default-to-today-or-this-week, group-by-day, collapse-completed, lazy-load older completions. Pick one when ready.

### Journal
*No specific signals captured yet.*

### FAB & Modals
**Vision:** The FAB ("+" button) is the universal entry point for adding things. Its menu and the modals it opens should feel snappy, polished, and consistent.

**Preserved decisions:**
- **Three transition languages (approved 2026-05-08).** See Section 4 — Design Tokens — Transitions.
- **No perceptible gap when transitioning from menu to target modal (2026-05-08).** The menu disappearing and the next surface appearing should overlap so the user never sees an empty screen.

**Open questions:**
- **FAB main button vs. submenu icon style consistency.** User reported icon weights differ. Decision pending: canonical stroke weight, whether FAB main is intentionally heavier (entry-point emphasis) or matches submenu (full consistency).
- **Save / Cancel button consistency across modals.** NewTaskModal uses stacked Save-on-top + Cancel-below; QuickLogModal uses side-by-side Cancel-left + Save-right. Decision pending: which is canonical. *My recommendation: side-by-side, Cancel-left, Save-right, using the `bg-emerald` brand token.*

### Forms (AddPlantModal, EditModal, NewTaskModal, QuickLogModal, etc.)
*No specific signals captured beyond modal button consistency above.*

---

## 4. Design tokens

These are the locked-in pieces. Reference before making changes; update only when the user explicitly changes a decision.

### Plant placeholder
- Asset: `/public/plant-placeholder.png` (three-leaf PNG)
- Container background: `bg-white`
- Container shape: `rounded-xl` with `overflow-hidden`
- Helper to detect placeholder URLs: recognizes both legacy `/seedling-icon.svg` and current `/plant-placeholder.png`. Used in `PlantImage.tsx`, `PlantPlaceholderIcon.tsx`, and 5+ other files.

### Transitions (FAB & modals)

The three transition languages, each with a meaning the user can subconsciously read:

| Move | Visual | Duration | Meaning |
|---|---|---|---|
| FAB → primary menu opens | Fade + scale up from FAB origin | **200ms in** | "This menu came from the button you tapped" |
| Primary menu close | Reverses (fade + scale toward FAB) | **150ms out** | Mirror of opening — exits run faster |
| Primary menu → in-place submenu (e.g. Add Plant) | Horizontal slide left (next screen comes in from right) | **200ms** | "Going deeper in the same flow" |
| Submenu → back to primary menu | Horizontal slide right (reverses forward) | **200ms** | "Going back" |
| Primary menu → target modal (Add Task, Add Journal, Add to Shed) | Menu fades out as new modal slides up from bottom (overlap) | **200ms total** | "New context — this is its own surface" |
| Target modal close | Slides down out of view | **150ms out** | Standard sheet dismissal — fast |

**Asymmetry pattern:** Entries 200ms, exits 150ms. Once a user dismisses something, faster exits feel respectful of their time.

**Implementation:** Pure CSS keyframes in `globals.css`. No new dependencies. Tune in one place if anything feels off.

### Colors / brand
- `bg-emerald` (brand emerald, defined in tailwind config) is the canonical primary action color. Not `bg-emerald-600` (Tailwind direct) — *recommendation pending user confirmation, but defaulting to brand token for consistency.*

---

## 5. Don't-touch list

Things the user has explicitly liked. Do not change without asking, even if Claude has a "better" idea.

- **Plantable banner color treatment** (green text on green-tinted card). Pre-U18 visual.
- **Calendar grid prominence** (the month grid as the primary check-in at the top of Calendar page).
- **Plantable widget separation from tasks/calendar grid** (it's a popup, deliberately not merged in).
- **Plant placeholder PNG** as the canonical placeholder image.
- **Active Garden gallery card** existence as a view (the bug was clipping, not the view itself).

---

## 6. Backlog of open decisions

Items deferred to a later session, with the WHY of deferral preserved.

- **Calendar task fatigue** (deferred 2026-05-08). User wants to tackle it later, not now. Approaches floated: Today/Week default window, group-by-day, collapse-completed, lazy-load. No approach picked yet.
- **Cross-view consistency: Vault grid / Garden gallery / My Plants list** (deferred 2026-05-07). User flagged the inconsistency; scope of "what should match" still being defined.
- **Too many places to edit a plant's image** (in `BACKLOG.md`, deferred 2026-05-07). Audit + consolidate the multiple photo-edit paths.
- **FAB icon style consistency** (raised 2026-05-08). Awaiting user decision on canonical stroke weight and whether FAB main button matches submenu icons or stays intentionally heavier.
- **Save/Cancel button consistency** (raised 2026-05-08). Awaiting user decision on stacked vs side-by-side layout, and `bg-emerald` vs `bg-emerald-600`.

---

## 7. Recent signals (rolling log)

Last several pieces of feedback from the user, in case any didn't make it into the right section above. Acts as a safety net. Most recent at the top.

- **2026-05-08:** Set up `VISION.md` to streamline build across chats. User wants a doc that tracks desires and goals so they don't have to re-request things.
- **2026-05-08:** Three FAB transition languages approved (fade-scale / horizontal-slide / slide-up). Duration: Claude to recommend (chose 200ms entries / 150ms exits, will tune based on testing).
- **2026-05-08:** "Next menu should pop up INSTANTLY. I do find with apps I like when there's smooth transitions" — wants snappy + polished. One standard for all FAB menus, consistent across the app.
- **2026-05-08:** FAB submenu transitions (Add to Shed / Add Task / Add Journal) currently have a perceptible gap. Add Plant correctly transitions in-place. Need consistency.
- **2026-05-08:** Save/Cancel buttons differ between Add Task and Add Journal modals.
- **2026-05-08:** FAB icon styles still inconsistent across menus.
- **2026-05-08:** User is not a software developer; this is their first build. Need partnership model: user provides vision, Claude assists with build + polish.
- **2026-05-08:** Calendar grid is the primary check-in (don't compact). Task list is the meat but currently overwhelming. Plantable widget is intentionally separate planning info.
- **2026-05-08:** Don't make aesthetic decisions without asking. "What is X" is a prompt to discuss, not a spec to fix.
- **2026-05-08:** U18 Calendar header changes were overstepping — reverted. Plantable color treatment liked as-is.
- **2026-05-07:** Placeholder PNG container background should be `bg-white` (matches PNG, no seam).
- **2026-05-07:** Plant placeholder is `/public/plant-placeholder.png` (the three-leaf illustration), not the SeedlingIcon. The unfortunate prior icon design was rejected.
- **2026-05-07:** "Too many places to edit image" — backlog item, separate from immediate work.
- **2026-05-07:** Batching policy: ship XS-S visual fixes 3-5 at a time, not one-by-one. Vercel build + verification cycle is too slow per fix.
