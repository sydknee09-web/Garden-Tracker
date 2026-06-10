# Garden Tracker — North Star Principles

> **Read this file alongside VISION.md at the start of every session.** It consolidates the small set of cross-cutting product principles that every plan, brief, and design decision is tested against. These are the *why* behind the conventions in VISION.md §8 and the decision-log locks in ROADMAP.md §6.
>
> **Authority:** subordinate to VISION.md for product scope; this file states the durable principle-set that the VISION conventions and ROADMAP locks repeatedly cite by name. When a convention says "NORTH_STAR cite: …", this is the file it points to.
>
> **GT-only.** Voyager has its own register; none of this applies there.

---

## Why this file exists

These principles were, until 2026-06-10, scattered: cited by name in `ROADMAP.md §6` decision-log entries (casing, empty-cell, icon-style, chrome-control locks all cite "No duplicate paths" + "Take mental load OFF the user") and stated as the "North star" in `FEEDBACK_AND_FEATURE_NOTES.md` for the plant profile — but with no single canonical home. Every new brief or plan that needed to ground a cohesion decision had to re-derive the principle-set from dated entries. Consolidating them here stops that re-tripping: a plan can cite `NORTH_STAR.md §"No duplicate paths"` directly.

---

## 1. No duplicate paths

**The principle.** The same content, reached two different ways, should not be presented through two different architectural treatments. One concept → one canonical surface and shape. Consistency of *path* and *primitive* across sibling surfaces **is** the cohesion expression — it's what makes the app feel like one product rather than a collection of pages (VISION §4 Operating Principle 7).

**What it governs.**
- **Detail surfaces** should share one architectural pattern. A growing instance reachable as a modal from one entry point and as a page from another is the violation; every entry point should land on the same real page. (Sprint 3 thesis — the instance was the lone detail surface still on a modal pattern while Library / Packet / Shed were real pages.)
- **UI primitives** (row shape, card shape, sub-tab shape, swipe threshold, action-pill chrome, back-chevron framing) should match across siblings. The casing split, empty-cell "—", icon chrome-vs-content split, and chrome-control framing conventions (all in VISION §8) are this principle expressed at the token level.
- **Encyclopedia mission.** The app is meant to be a reliable "what works for me" library (VISION §1). Duplicate paths to the same data erode that reliability — the user can't trust that "the plant's page" is *the* place.

**At audit time, ask:** *Does this introduce a second way to reach or render content that already has a canonical surface/primitive? If so, collapse to the existing one.* This is the proactive sibling-sweep (CLAUDE.md Pass 3) stated as a product principle.

---

## 2. Take mental load OFF the user

**The principle.** Every design choice should lower the user's cognitive load, not add to it. The user's own word for the failure this defeats is **"lost"** (VISION §6 Theme 4). When something can be inferred, defaulted, or made to follow what the user was already doing, the app should do that work instead of making the user carry it.

**What it governs.**
- **Real routes over custom affordances.** A real page gives working browser/hardware back (critical for Walter, iPad-primary), deep-linkable + shareable URLs, and natural history — all lower-load than a modal with a bespoke back button and no address.
- **Follow what the user was actually doing.** Swipe/prev-next on a detail surface should traverse the *filtered + sorted list the user was just browsing* (the shared `swipeOrder.ts` sessionStorage snapshot), not a separate re-query. The user shouldn't have to rebuild context the app already had.
- **Quiet chrome.** Chrome that stays calm and consistent (flat monotone icons, predictable framing) doesn't compete for attention across a long session; content moments are where emphasis belongs (VISION §8 icon-style split).
- **Fatigue is the enemy** (VISION §4 Operating Principle 6). When the user is overwhelmed by data volume, the answer is presentation — grouping, default windows, lazy loading — never removing features.

**At audit time, ask:** *Does this make the user remember, re-derive, or re-navigate something the app could carry for them? If so, carry it.*

---

## 3. Information-hub framing

**The principle** (from `FEEDBACK_AND_FEATURE_NOTES.md`). A detail surface — the plant profile, and equally the growing-instance page — is an **information hub for one thing**, not a menu or a junction that flings the user elsewhere. On the hub the user should be able to:

- **Learn** about the thing (identity, care, packets / source as relevant).
- **See an overview** of its state.
- **See history** — what they've done (journal, key events).
- **See what's next** — upcoming care / tasks, so it doesn't get "lost."
- **Enter data with fewer steps** — avoid chains like profile → tab → affordance → another tab → scroll → FAB.

**Directional implications.**
- Prefer **in-context** patterns: inline sections, scoped modals/sheets, **one primary path** to "log something."
- Activity (journal, care, tasks) should feel like part of the **same hub**, not "go somewhere else" as the default.
- The growing-instance page embodies this directly: its 4 tabs (Overview / Journal / Care / Task History) are the Learn / Overview / History / What's-next of one planting. Giving it a real address (Sprint 3) keeps the hub intact while making it reachable, back-navigable, and shareable.

**At audit time, ask:** *Does this make the surface a richer hub for its one subject, or does it turn the surface into a junction that sends the user away?*

---

## How the principles relate

- **No duplicate paths** is about *sameness across siblings* (cohesion).
- **Take mental load off the user** is about *lowering cost per interaction* (clarity).
- **Information-hub framing** is about *depth on a single subject* (the surface earns its place).

They reinforce each other: a single canonical hub (no duplicate paths) that follows what the user was doing (low mental load) and answers Learn / Overview / History / What's-next in place (hub framing) is the target shape for every detail surface in the app.

---

*Last updated: 2026-06-10 — Created during Sprint 3 (instance detail-page conversion) per the design plan-doc's doc-hygiene recommendation. Consolidates principles previously cited-by-name across ROADMAP §6 decision-log entries (casing / empty-cell / icon-style / chrome-control locks) and stated as the "North star" in FEEDBACK_AND_FEATURE_NOTES.md. No new principles invented — this is a consolidation so future briefs/plans cite one canonical home instead of re-deriving from dated entries.*
