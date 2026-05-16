# Alignment Audit — 2026-05-16

> A skim-readable snapshot of what Garden Tracker is, what it's not, where it is right now, and what needs your input. Written for review at the start of a session so future you (and future me) can re-orient in 5–10 minutes. Source-of-truth docs are VISION.md, ROADMAP.md, BUGS.md, BACKLOG.md — this report synthesizes; it does not introduce new facts.

---

## 1. 30-second pitch (in my voice)

Garden Tracker is a home garden management app — for me, my household, and a small invite-only circle of fellow gardeners. It tracks every seed, plant, supply, and bed through its full lifecycle so I can answer "what worked last year" or "is this variety worth growing again" without digging through notes. Beginners through experts use the same app; complexity unfolds with the data, not with a skill toggle. Phone in the garden, desktop at the kitchen table. Never public, never strangers. The point is a personal record that compounds year over year.

---

## 2. The felt promise (outcomes, not features)

- A garden record that gets more valuable the longer I use it — not a fresh slate every season.
- Confidence about timing — what to plant when, in my specific microclimate, not a generic zone average.
- One place that holds my seed inventory, my plant history, my care schedule, and my supplies — so I don't keep four separate systems in my head.
- Cohesion — the app reads as one product across surfaces, not a collection of pages.
- Sharing with my sister and my circle without ever exposing the data publicly.

---

## 3. Scope at a glance

| Feature | Status | One-line why |
|---|---|---|
| Cross-account trading within trusted circle (with history) | ✅ | Core sharing model; both inventories update |
| Beds as first-class entity | ✅ (foundational) | Phase 3 build; unblocks soil-testing + layout |
| Micro-climate triggers | ✅ | Hyperlocal alerts; defeats untrusted-timing failure mode |
| Cost-driven freemium | ✅ (principle) | Free where cost is fixed; paid where cost scales |
| Pest / illness ID + treatment | 🕐 | High-value differentiator; likely paid tier |
| Garden bed layout / spatial design | 🕐 | After beds-as-first-class lands |
| Encyclopedia entries integrated with data | 🕐 | Pest / variety / condition reference surfaced contextually |
| Soil test result tracking | 🕐 | Pairs with beds-as-first-class |
| Plant ID camera | 🕐 | Only if better than PictureThis / Google Lens |
| Public marketplace / strangers | ❌ | Foundational "no public" boundary |
| Paid transactions inside the app | ❌ | Money / payments not for Garden Tracker |
| Recipes / meal planning | ❌ | Cooking domain; lives elsewhere |
| Direct hardware brand integration | ❌ | Endless; generic CSV / webhook 🕐 instead |

---

## 4. What this app explicitly is NOT

- **Not public.** No strangers, no marketplace, no public feed. Invite-only forever.
- **Not a recipe / cooking app.** Harvest data, yes — what to make with it, no.
- **Not a payment platform.** Trades within the circle are tracked; money doesn't change hands inside Garden Tracker.
- **Not a content site.** No blog articles, no static encyclopedia inside the app today.

**Four failure modes the build is actively defeating** (VISION §6):
- Lifecycle / batch-tracking gaps (seedlings ≠ established plants; batches need their own status, germination rate, split / cull / transfer flows).
- Plant profile shallow for growing (ID + description today; missing establishment-vs-regular care, deeper growing data).
- Micro-climate timing untrusted (ZIP-code data is too coarse for Vista's coastal/inland/frost-pocket reality).
- Disorientation — "user gets lost" — driven by inconsistent visual language + unclear IA + mental-model mismatch between profiles and growing history.

---

## 5. App-state map (major screens + each screen's primary job)

- **Home** — context-aware surfacing (December: seed inventory + planning; March-April: seed starting; etc.). Empty-by-default for new users; that IS the onboarding.
- **Vault** — Plant Profiles (3-up grid) + Packets + Shed (inventory hub for supplies + application schedule + low-stock detection).
- **Garden** — Active Garden (currently growing, gallery + list) + My Plants (permanent plantings). Macro view of what's alive right now.
- **Calendar** — month grid (primary check-in) on top + task list below. Tasks live here and get completed here; not a passive view.
- **Journal** — entry-log with table / gallery / timeline views. Searchable across notes + types + plants + dates. Where the year-over-year memory plane lives.
- **Settings** — zone, household, sync, developer debug log.
- **Universal Add (FAB)** — anywhere, any time → modals for Plant / Seed / Task / Journal entry / Quick Log / Shopping list add.

---

## 6. Navigation flow (top-level, no edge cases)

- **Mobile**: bottom nav has 5 primary tabs (Home / Garden / Calendar / Vault / Journal). FAB floats over every page.
- **Desktop (≥1280px)**: left sidebar replaces bottom nav, same 5 primary tabs + footer utilities (Shopping list / Help / Settings / Feedback). Slim top header keeps sync indicator + page title + household toggle. FAB stays viewport-anchored.
- **Universal add** flows: FAB → submenu (Add Plant / Add Seed / Add Task / Add Journal / Quick Log) → target modal.
- **Deep links**: Vault plant profile ↔ Active Garden via `?grow=` URL param (highlights specific batch).
- **Hardware back (Android)**: closes the FAB menu / open modal; falls back to nav-back.

---

## 7. Roadmap shape

**In-flight now (🟢):**
- **Chunk 3.2 — Desktop Layout Pass.** B1 (sidebar) + B2 (Calendar two-column) shipped 2026-05-11. B3 (FAB → popover desktop), B4 (modals/sheets desktop treatment), B5 (per-page audit) queued.
- **Chunk 3.9 — 2026-05-12 feedback batch (10 items).** 4 shipped (#1 expand-all, #2 calendar arrows, #4 garden trigger icon, #6 journal search). 1 parked (#3 garden card spacing). 5 awaiting user input (#5 journal card format, #7 no-AI-data fallback, #8 two +Entry paths, #9 swipe-confirm model, #10 task card structure).
- **Chunk 3.10 — Doc hygiene cleanup.** R1-R5 strict drift shipped 2026-05-13. R6-R8 + R9 (migration naming) + D1/D2 still need scoping.

**Next 2–3 chats (PM recommendation, per the alignment audit):**
- **Chat A** — aesthetic-decision sweep (9 SURFACE items walked one at a time; unblocks most in-flight chunks).
- **Chat B** — build the unblocked items in batched commits.
- **Chat C** — resume Chunk 3.2 B3 (FAB → popover desktop).

**Parked (🟣 / 🕐, biggest movers):**
- Beds-as-first-class implementation (Phase 3 IA gate).
- Lifecycle / batch tracking (depends on beds).
- Plant profile depth (Phase 5 page goals gate; plus tree-data sub-items — chill hours + rootstock — parked 2026-05-16).
- Cross-view cohesion (distributed across multiple chunks).
- Micro-climate triggers (large feature; post-MVP).
- App-wide icon density / canonical stroke weight (8 days parked).
- HarvestModal end-state realization (parked 2026-05-14).
- Vault profile "Add journal entry" cross-surface aria-label cohesion (3 sites, parked 2026-05-16).
- AGENTS.md doc-architecture split (parked 2026-05-16; own chat purpose deserved).

**Recently done (last ~7 days):**
- U24 closed end-to-end (Phase A code fix `7207164` + Phase B prod-DDL apply 2026-05-16).
- U25 closed on Garden tabs (`11eaf37` 2026-05-16; Vault sites parked).
- Chunk 3.9 #1, #2, #4, #6 shipped.
- Calendar default-collapse (`a7dadb7`) + expand-all toggle (`6d76c20`).
- Desktop sidebar (`e61ffdc`) + Calendar two-column (`8624c8d`).
- CLAUDE.md amendments: Chat Lifecycle Protocol, Plan-audit standard, Pass 3 sibling sweep, Role lock, Capability honesty, 6-condition handoff readiness gate.

---

## 8. Drift / gap callouts — needs your input

- **9 SURFACE aesthetic decisions queued** — items parked between 9 days and 2 days. U12 (two +Entry paths), U13 / §3.9 #5 (journal card hierarchy), §3.9 #3 (garden card spacing — 3 options diagnosed), §3.9 #7 (no-AI-data fallback), §3.9 #9 (swipe-confirm interaction), §3.9 #10 (calendar task card structure), VISION §11 icon density (canonical stroke), VISION §11 Save/Cancel button consistency, VISION §11 HarvestModal end-state. **These are the rate-limiter — 4 chunks are blocked on user input across these items.**
- **3 missing destinations to capture:** journal page flicker bug from `7482c59` (floats in ROADMAP §1 as "open task," no U-entry in BUGS.md); migration audit RLS/RPC/triggers/indexes/storage gap (§6 notes "not investigated this turn," no destination); U24 root-cause-class investigation for other duplicate-timestamp-prefix migrations (hypothesized in §6, no destination).
- **2 VISION §11 entries have stale wording** — Calendar task fatigue (partially shipped by `a7dadb7` + chunk 3.9 #1) and Calendar task row primitive (swipe-gesture portion shipped via `cea21e0` + `f77507a`) — both still read as if fully parked.
- **BACKLOG.md stamp 9 days stale** and still references `.cursor/plans/remaining_steps_roadmap.plan.md` + `PROJECT_STATUS.md` (both pre-VISION-v4 artifacts queued in §3.10 R6/R8).
- **Chunk 3.2 desktop pass idle 5 days** — was named "next" after B2 ship but got displaced by chunks 3.9 + 3.10 + U24 + U25.
- **Two coalescence opportunities surfaced this audit** — icon / visual cohesion (FAB icons + icon density + §3.3 #1 stroke weight + U25 + BUGS Post-Launch #3 + new Vault aria-label sites = 6 sibling items) and card-primitive hierarchy (Calendar row primitive + §3.9 #5 journal card + §3.9 #10 task card + U13 + U14 = 5 sibling items). Each could be unblocked by a single canonical decision rather than per-item.
- **Sister's additional feedback** — pending since 2026-05-08; unclear if 2026-05-16 tree-data asks (chill hours + rootstock) came from her or from you directly.

---

*Compiled 2026-05-16 from VISION.md / ROADMAP.md / BUGS.md / BACKLOG.md. Re-run this audit any time the chat-load feels heavy or when several decisions have accumulated.*
