# Product Audit — 2026-05-07

**Source:** Live user feedback session 2026-05-07. User has been testing the app for months and surfaced friction points across Home, Vault, Garden, Calendar, Journal, and import flows.

**Companion docs:**
- [IMPORT_FLOW_AUDIT.md](IMPORT_FLOW_AUDIT.md) — focused friction audit of import paths
- [BUGS.md](BUGS.md) — concrete reported bugs (specific reproductions)
- [FEEDBACK_AND_FEATURE_NOTES.md](FEEDBACK_AND_FEATURE_NOTES.md) — locked product principles
- [PROJECT_STATUS.md](PROJECT_STATUS.md) — phase status, locked decisions, open decisions

**Read this when:** planning UX work bigger than a single fix. This doc captures the *systemic* gaps. For one-off bugs see BUGS.md.

---

## Executive summary

Live user feedback surfaced ~30 distinct friction points across the app. When lifted to pattern level, they cluster into **9 cross-cutting issues** and **10 workstreams**.

The single highest-leverage piece of product work is **building out the grow-instance hub** (workstream #10): it resolves per-specimen care, receipt retention, photo timelines, and the long-running "plant profile vs growing plant" conceptual confusion in one project.

Many reported issues are **systemic, not local** — for example, the modal scroll-lock bug almost certainly affects more than just the FAB submenu, and the truncation-clipping issue isn't unique to one card type. Treating these as system-level fixes (one design pass on icons, one CSS rule on text overflow, one modal primitive on focus management) yields multiple wins per project.

**Guiding meta-principle that emerged from the session:** *Hide complexity until the data scale justifies it.* Several features (Gallery view, multiple import methods, elaborate review-import logic) were designed for data-rich state but feel cluttered at the user's current data scale. Conditional UI (show advanced views only when warranted) is a recurring theme.

---

## Cross-cutting patterns

Ordered roughly by leverage. Each pattern is supported by multiple reports and implies gaps the user did not explicitly mention.

### Pattern 1 — Variety vs specimen: the structural confusion

**The biggest pattern.** The data model has two distinct entities: `plant_profiles` (variety / encyclopedia, one per user per variety) and `grow_instances` (specific plantings, multiple per profile). The UI/UX consistently collapses or confuses them.

**Reported instances:**
- Care assignment lives only at variety level. User has 3 mango trees, one with black spot needing copper protocol — no way to assign care to *just that* mango.
- Add Plant terminology drift: "Permanent / Seasonal" (variety-flavored) vs "Active Garden / My Plants" (specimen-flavored) for the same dichotomy.
- Tap on a plant pill from a journal entry navigates to `/vault/[id]?tab=journal` (variety journal feed) — losing the specific batch context.
- Grow instance modal is purely informational (Age, Status, Next milestone, Location) — the **specimen hub is underbuilt**.
- Receipts have nowhere to attach (specimen would be the right place; today they're discarded after extraction).

**Implied gaps not raised:**
- Specimen-level tags ("infected with black spot," "drought-stressed") have no home.
- Companion-planting data is at variety level; specimen has no notion of "planted next to my basil."
- Status timeline (sown → germinated → transplanted → harvesting → ended) lives on the specimen but isn't visualized.
- Multiple harvests across years from one tree have no aggregation point.

**Why it matters:** Building the specimen hub (workstream #10) resolves a half-dozen separate friction points at once. It is the **hinge project** for the next product phase.

---

### Pattern 2 — Visual cohesion is uneven despite a styleDictionary

`src/lib/styleDictionary.tsx` exists with `ICON_MAP` and stroke conventions, but production visual quality is inconsistent.

**Reported instances:**
- FAB main menu icons styled differently from submenu icons.
- Choose screens still use emoji (🌐, 🧾, 📷) instead of `ICON_MAP`.
- Quick Log button icon ("bag-top") doesn't communicate its purpose; reads ambiguous at small sizes.
- Seedling placeholder for missing hero images is "ugly as fuck" (user's words) and shows up across profile hero, grid cards, and review-import fallback.
- Highlight border around a selected/active card looks visually off.

**Implied gaps not raised but likely affected:**
- Status badges (`in_stock`, `growing`, `harvested`, `dead`) probably use raw colors not design-token classes.
- Loading skeletons may differ in shape/treatment across pages.
- View-mode icons on Journal (Table / Gallery / Timeline) — likely not aligned with ICON_MAP.
- Selection / hover / active states across cards probably aren't standardized.

**Implication:** A single **design system pass** — icons + placeholders + selection states + status badges + loading skeletons audited and replaced as one project — yields ~20 wins for the price of one design+implementation cycle. Resists the temptation to fix each as it surfaces.

---

### Pattern 3 — Empty / sparse-data states are an afterthought

Pages are designed for data-rich state. New users (or sparsely-populated sections) face opaque or unhelpful UI.

**Reported instances:**
- Quick Start onboarding doesn't track per-step completion (still tells user to set zone after they've set it).
- Journal page has no purpose statement — new users see plant cards with "X entries" and no idea what an entry *is*.
- Gallery view (Journal) is empty/sparse without a critical mass of photos — feature isn't earning its keep at current scale.
- "General" card on Journal (catches entries with no plant attached) is unexplained.
- Home page bottom-half (Shopping list, At a glance) lacks visual hierarchy when sparse.

**Implied gaps not raised:**
- New user opening **Vault** for the first time → blank grid, no "let's get you started" guide.
- **Garden** with no active plantings or permanent plants → blank tabs, no orientation.
- **Calendar** with no tasks → empty month view, no "tasks will appear here once you set up plants."
- **Newly-created plant profile** with zero packets / plantings / journal entries → does the profile page degrade gracefully?
- **Shed** when empty → likely the same.

**Implication:** Every primary surface needs **two states**: data-rich and data-sparse. The Sanctuary 3-step Quick Start solves *part* of this; per-page empty states solve the rest. This is a project, not a tweak.

---

### Pattern 4 — Modal layering / focus management probably broken everywhere

User reported FAB sub-modal lets the parent menu remain visible and interactable (can scroll/toggle background). That's a z-index + body-scroll-lock issue that almost certainly **isn't unique to FAB**.

**Implied gaps not raised but likely affected:**
- AddPlantModal — does it scroll-lock the background?
- EditPacketModal, QuickLog modal, EditJournalModal — same question.
- ImageCropModal — same.
- Confirm dialogs (delete, archive) — same.
- Grow instance modal on Garden — same.

**Implication:** Audit the **modal/sheet primitive** (likely a shared component) once. Fix scroll-lock, backdrop interactivity, focus trap, and `aria-modal="true"` globally. One fix, app-wide payoff.

---

### Pattern 5 — Synchronous waits for deferrable work

Async operations that should run in the background block the user's critical path.

**Reported instances:**
- Hero photo finding during import is slow (every photo / link import waits on `find-hero-photo` before reaching review).
- AI autofill is load-bearing for data quality but runs synchronously on user trigger.
- Home page staggers on load (top half then bottom half).

**Implied gaps not raised:**
- Background `enrichProfileFromName` after manual seed add — runs silently, no progress visible.
- Care suggestion generation — likely synchronous.
- Photo compression on upload — likely blocks save.
- Multi-pass import is sequential; could parallelize.
- Magic Fill on Care tab — likely synchronous.

**Implication:** A pattern shift — **defer everything that doesn't need to be on the critical path**. User adds a seed → seed appears in vault immediately. AI fills in details in background with a small "filling in details…" indicator. Save can complete before AI finishes. Architectural; compounds wins across many features. The user's specific suggestion ("use my photo first, defer hero search to review") is one expression of this principle.

---

### Pattern 6 — Multiple paths to same outcome with subtle drift

Several actions have 2–3 entry points, each with slightly different behavior, and no documented "primary path" doctrine.

**Reported instances:**
- "+Entry" button on Journal page AND FAB → Add journal AND Quick Log button on profile (3 paths).
- AddPlantModal Permanent/Seasonal toggle redundant when already chosen via FAB sub-screen.

**Implied gaps not raised:**
- Add to shopping list: from Home, from Shopping List page, from plant profile (3 paths) — likely with subtly different defaults or post-success destinations.
- Add task: from FAB, from Calendar `?openTask=1`, from specific contexts.
- Edit a profile: multiple entry points likely.

**Implication:** A short ADR — *"every action has one canonical path; secondary paths are explicitly shortcuts that share behavior with the canonical path"* — and an audit verifying each canonical/shortcut pair actually behaves the same. Hygiene work, not a feature.

---

### Pattern 7 — Truncation / overflow handling per-component, not per-system

**Reported instances:**
- Journal page header truncates to "Jou..." on small screens.
- Active Garden gallery cards clip text from the **left** ("rtichoke", "umber", "mato") — wrong direction.
- Vault Plant Profile cards handle long names correctly.

**Implied gaps not raised:**
- Likely the same issue on **Shed cards** when supply names are long.
- Plant profile tab labels might truncate inconsistently.
- Filter chip text may overflow when many filters active.
- Plant pills on journal entries with very long variety names may behave oddly.

**Implication:** Pick one truncation rule (right-side ellipsis, max 1–2 lines, then word-break for very long) and propagate. A single CSS utility class enforced across all card text + a Tailwind preset.

---

### Pattern 8 — Recurrence model is too simple

The Calendar and care_schedules likely share a recurrence model that supports only "every N days, forever."

**Reported instances:**
- Bounded recurrence missing — copper-application protocol "daily for 7 days" not expressible.
- No chain-snooze — slipping the first occurrence requires editing all 7.
- 36 overdue tasks visible (consequence: tasks accumulate).

**Implied gaps not raised:**
- Care schedules likely have the same model — same problems will surface there if they haven't already.
- Seasonal recurrence ("water more in summer") not modeled.
- Skip patterns ("water every other day, but not on rainy days") not modeled.
- Conditional recurrence ("apply copper, recheck after 7 days, restart if symptoms persist") not modeled.
- Schedule modification when a plant's status changes (e.g., dormant) — does the schedule keep firing?

**Implication:** Phase 9 calendar refactor needs to be designed alongside care_schedules. Both probably need a richer recurrence representation (end conditions, chain-aware reschedule, conditional rules). Worth one consolidated design pass before either is coded.

---

### Pattern 9 — Data hygiene → AI compensation → trust erosion

Tier 0 (curated database from vendor scrape) has dirty data. Users reach for Tier 2 (AI autofill) to compensate. Over time, AI is sometimes wrong, eroding user trust.

**Reported instances:**
- Plant name dropdown shows malformed entries ("andres" with apostrophes, variety-shaped strings in plant_type field).
- AI autofill is load-bearing for data quality.
- Original architectural intent (vendor data > AI fallback) is functionally inverted.

**Implied gaps not raised:**
- Companion-planting data may have similar dirty-scrape problems.
- Days-to-maturity may be inconsistent across vendors.
- Scientific names may be inconsistent (partly known — there is a `fix-scientific-display-names` route).
- Tags polluted ("Heirloom" / "heirloom" / "Heirloom Variety" all distinct).

**Implication:** A one-time data-quality remediation isn't enough — there needs to be **ongoing** data hygiene. AI-assisted dedup/cleanup as a developer tool, plus a "report bad data" affordance for users so issues get flagged. Otherwise drift returns.

---

## Workstreams (and which patterns they address)

| # | Workstream | Patterns addressed | Size | Status |
|---|------------|--------------------|------|--------|
| 1 | Import flow UX polish | 4, 5, 6, 7 | Medium | Audit done, see [IMPORT_FLOW_AUDIT.md](IMPORT_FLOW_AUDIT.md) |
| 2 | AI autofill discoverability + reliability | 5, 9 | Medium | Open |
| 3 | Data quality remediation | 9 | Medium-Large | Open |
| 4 | Source-image / receipt retention | 1, 5 | Medium | Open (subsumed partially by #10) |
| 5 | New-user discoverability / onboarding | 3 | Medium | Sanctuary 3-step done; per-page empty states open |
| 6 | UX coherence (terminology + flow consistency) | 6, 7 | Medium | Open |
| 7 | Visual quality / design system pass | 2 | Medium-Large | Open |
| 8 | Per-specimen care | 1, 8 | Large (schema + UI + propagation) | Open |
| 9 | Calendar recurrence model | 8 | Large | Open (Phase 9 in roadmap) |
| 10 | **Grow instance hub buildout** | 1, plus subsumes parts of 4 + 8 | Large | Open — **highest leverage** |

---

## Things not mentioned but worth checking

User feedback was rich but didn't cover everything. These are areas to verify deliberately when next testing:

1. **Search behavior across pages.** Vault and Garden have search; Journal and Calendar likely don't. Inconsistent.
2. **Notifications / external reminders.** If tasks aren't pinged outside the app, "36 overdue" is silent until app open.
3. **Settings discoverability.** Resources (zone charts, planting guides) live in Settings → Resources. New users won't find them unless told.
4. **Multi-user / household.** If household sharing is enabled, do shared records render correctly? Permission errors?
5. **Offline mode UX.** Track A shipped offline write queue. Has airplane-mode been tested? Does OfflineIndicator surface usefully?
6. **Data export.** Settings → Data export exists. Has it been tested with current data volume?
7. **Photo upload speed.** Slow networks → photo upload could be its own progress story.
8. **Profile page degradation when sparse.** Newly-created profile with zero packets / plantings / journal — graceful or broken?
9. **Tab persistence on navigation.** Tap into a profile tab, navigate away, come back — does the tab persist? Phase 8 audit had unverified items here.
10. **Timezone correctness.** Tasks and journal entries have dates. If user travels or DST changes, do dates shift unexpectedly? `calendarDate.ts` exists but worth a once-over.

---

## Meta-principle

**Hide complexity until the data scale justifies it.**

Several features assume rich data and feel cluttered or empty without it. Examples reported and implied:
- Gallery view on Journal — useless without ~10+ photos.
- Multiple import methods on the choose screen — overwhelming when user always picks the same one.
- Review-import page complexity — heavy for the common case of importing 1–2 items.
- Three view-mode icons on Journal — two are arguably enough at current scale.

Conditional UI patterns to consider going forward:
- **Hide a view mode** until N items exist.
- **Default to most-used method** based on user history (per-user, per-add-type).
- **Show advanced features** only after user has done basics (progressive disclosure).
- **Adapt page density** based on data volume.

This isn't a workstream — it's a guiding principle for prioritization decisions.

---

## Recommended sequencing

Three orienting principles for the next 1–3 months of product work:

### 1. Resolve the structural confusion first

**Workstream #10 (grow instance hub) is the highest-leverage single project.** Building it well unlocks: per-specimen care (#8), receipt retention (#4), photo timelines, status timelines, harvest analytics, plant-pill-with-specimen-context, and resolves Pattern 1 conceptually. Expect 2–4 weeks depending on scope.

### 2. Then a design system pass

Once the grow-instance hub exists, do **workstream #7** (visual quality / design system pass): unify icons, placeholders, selection states, status badges, loading skeletons. One project, ~20 wins. Expect 1–2 weeks.

### 3. Then UX coherence + empty states

**Workstream #5 (empty states) and workstream #6 (UX coherence)** can be done in parallel or sequentially. Both compound the value of #10 + #7. Expect 1 week each.

### Quick wins to slot in alongside

- Bounded-recurrence + chain-snooze (#9) — your copper protocol case justifies this.
- Hero photo deferral during import (Pattern 5 expression) — significant import speed win.
- Modal scroll-lock global fix (Pattern 4) — single hunt-and-fix, ~half-day.
- Single design tweak: icon labels on view-mode toggles — ~1 hour.

### Not on the critical path

- **Workstream #3 (data quality remediation)** is important but not blocking. Schedule when there's appetite. Could pair with a "report bad data" feature so future drift gets flagged.
- **Calendar Phase 9 full refactor** beyond bounded recurrence + chain-snooze — large project, defer.
- **Framework upgrade (Next 14 → 16)** — already an open decision; defer until forced.

---

*Last updated: 2026-05-07*
