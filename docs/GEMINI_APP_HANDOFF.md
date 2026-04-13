# Voyager Sanctuary — Full App Handoff for Gemini

**Purpose:** One-stop context for producing a consolidated list of coding updates, gaps, answers to outstanding questions, feature recommendations, general recommendations, outstanding tasks, and polishing.  
**Stack:** Flutter 3.x, Dart 3, Supabase (Auth, DB with LTREE), Riverpod. Mobile-first (iOS + Android).  
**Aesthetic:** Japandi / Studio Ghibli–esque. Cozy, ritual-over-task-list. Elias as guide. Palette: whetPaper, whetInk, whetLine, ember, parchment, charcoal.

---

## 1. App structure (lib/)

- **app.dart** — GoRouter, auth redirect, profile gate, routes (entrance, auth, profileGate, intro, sanctuary, scroll, satchel, archive, settings, etc.).
- **features/** — auth, entrance, intro (Elias intro overlay, profile gate), onboarding (whetstone intro), scroll_map (Scroll map, Mountain Detail, ClimbFlowOverlay, EditFlowOverlay), satchel, sanctuary (hearth, tray, Elias tap, home intro), management (menu sheet, settings, archive, guidance), whetstone.
- **core/** — constants (app_colors, elias_typography), content (elias_dialogue), config (supabase_config, demo_mode), enums (node_type, day_period), state, utils.
- **data/** — models (node, mountain, profile, satchel_slot, etc.), repositories (Supabase + demo implementations), supabase_service, supabase_cache.
- **providers/** — auth, profile, satchel, mountain, node, climb_flow, time_of_day, hearth_fuel, burn_streak, elias, first_run, etc.
- **widgets/** — elias_silhouette, typewriter_text, sanctuary_background, hearth_spark_painter, sanctuary_error_widget.

**Entry flow:** Auth (if not signed in) → Profile gate (hasSeenEliasIntro?) → Intro (5-beat + New Journey wizard + Whetstone) or Sanctuary. Map = Scroll (peak cards) → tap peak → Mountain Detail (Architect mode, boulders/pebbles, Edit overlay). Satchel: 6 slots, Pack from peaks, burn in Sanctuary hearth.

---

## 2. Key docs (summaries)

### MASTER_PLAN.md
- Phases 0–14; Implementation P0–P2; Refine & Polish; Logic & Leaf (Climb/Survey, validity filter RPC, leaf-only packing, rune = packable = burnable). First Blockage RPC done. Forest Threshold (cold start), display name, shard completion propagation. Related: VALIDITY_FILTER_RPC_SPEC, ELIAS_INTRODUCTION_SPEC, NAVIGATION_MAP, PRE_FLIGHT_ARCHITECTURE_SPEC.

### HEALTH_AND_IMPROVEMENTS.md
- **Top 20 recommendations:** 1–5 Reliability (First Blockage done, RLS/Satchel verify, error boundary done, offline messaging); 6–10 UX (Step 5 keyboard done, typewriter done, bubble on tap, letter-spacing done, contextual haptics); 11–15 Content (greeting pool, Elias 7+ days untouched, step descriptions done, marker templates, habit milestones); 16–20 Tech (precache, narrow invalidation, deps, E2E, deep link). **21–40:** Semantics, font scaling, contrast; store listing, icons/splash, 60fps; night-shift done, design tokens, Elias idle, pack animation, hearth tuning; empty states, pull-to-refresh, loading; Mallet integration test, deferred bugs, docs sync; crash reporting, i18n. **Gatekeepers before release:** Display name (51), Shard completion (55); also RLS verify, Satchel verify. **§ 9:** Gaps (Map back button addressed, New Journey keyboard addressed, Satchel untitled, demo schema, NULL intent/layout, integration tests, Branch Removal Phase 2, pebble logic UI, Survey layout Phase 2, order_index, Forest Threshold, Elias tap bubble+sheet, Display name, Shard completion). Concerns: RLS, fresh-UID satchel, narrow invalidation, 60fps, dependency drift, RPC fallback logging, sound toggle, Realtime cleanup.

### GAPS_AND_ASSUMPTIONS.md
- Scenario coverage locked (Bones view, archive, delete, layout_type climb/survey). Promote + 3-peak cap, shards move with, Miscellaneous region, Bones tap title, Step 4 labels, intent 1000 cap. **Open:** Elias tap dialogue + sheet (Options A/B/C; low priority). Demo + new schema; existing peaks NULL intent/layout; integration tests vs 6-step wizard; Branch Removal / Demote Phase 2; pebble logic UI Phase 2; Survey Island/Constellation Phase 2; order_index; Forest Threshold; Display name; Shard completion propagation.

### ARCHITECT_MODE_AUDIT.md
- Architect mode on Mountain Detail: toggle stays on until user taps ARCHITECT ✕ (fixed). Edit overlay: visibility (max height 80%, scroll, bottom padding with viewInsets + paddingOf) and codification (whetInk palette, 200ms stagger for actions) implemented. Optional: bottom-sheet variant later.

### NEXT_STEPS.md
- Option A: Ship and Learn 1–2 weeks. Option B: Build Branch Removal next. Smoke tests before release.

### TESTING_CHECKLIST.md
- First Five (Auth, Scroll, Satchel, Sanctuary, RLS). Onboarding verification. Scroll/Satchel/Whetstone/Archive manual steps. Release path.

---

## 3. Recent completed work (session + shipped to testers)

- Intro typewriter tap-to-skip (no glitch). Step 5 single Stow/Pack buttons. Plot New Path single Stow, cream nav row. Elias tap reliability (80px min target), management menu cream/scroll. Satchel: stone icon per row, filled-first order, warm empty row color. Sanctuary: stones always visible; locked stone limited drag + snap-back + Elias markDoneToDrop; hearth only accepts readyToBurn, trim nodeId, reject when burn in progress. Architect stays on until explicit exit. Mountain Detail safe bottom padding. EditFlowOverlay: max height 80%, scroll, bottom padding, whetPaper/whetInk, 200ms stagger for actions.
- **Elias dialogue audit (shipped):** task→stone rewrites; saveFailed() / peakJournalArrival() added and wired (climb_flow, edit_flow, mountain_detail_screen); return-after-idle line, empty-satchel Map nudge; Edit Flow preferred lines (Option B); optional variants for onTap, afterBurn, coldHearth. ELIAS_DIALOGUE_REFERENCE.md catalogue synced.
- **Build / code:** withOpacity→withValues (sanctuary_screen); removed unused imports (bootstrap, auth_screen) and dead code (elias_intro gradientColors, whetstone bubbleSpacing used).
- **Firebase:** firebase.json and android/app/google-services.json committed; v0.1.1+15 distributed to testers via Firebase App Distribution (group: testers).
- **Docs:** BUILD_GUIDANCE.md, GEMINI_APP_HANDOFF.md, GEMINI_RECOMMENDATIONS.md, Elias audit handoff + ELIAS_DIALOGUE_AUDIT_RECOMMENDATIONS.md, ELIAS_DIALOGUE_REFERENCE.md.

---

## 4. Outstanding questions (from docs)

- Elias tap: show bubble + sheet together (A), or no message when opening sheet (B), or message on sheet close (C)? Current: tap opens sheet; bubble was removed on open.
- Display name: ensure intro Beats 3 & 5 and management use profile.display_name; handle skip/empty.
- Shard completion: when last shard completes, parent completion state must update; verify on device.
- Sound toggle: all playback (hearth, mallet, burn, whetstone, app/scroll open) must respect soundEnabledProvider.
- Forest Threshold: cold start forest image fade; speed linked to has_seen_elias_intro.
- Offline: centralize “no connection” copy and retry on Scroll, Satchel, Whetstone.
- Semantics: ExcludeSemantics for sparks; Pack/Burn labels for screen readers.
- Loading (33): standardize “Waiting” / dimmed HearthSparkPainter on Scroll, Satchel, Whetstone, Archive.

---

## 5. Request for Gemini

Produce **one consolidated markdown document** with these sections (each as a list or table where useful):

1. **Coding updates** — Concrete code-level changes (e.g. remove unused imports, withOpacity→withValues, narrow invalidation after node edit, sound check before every play, display_name in intro/management).
2. **Gaps to address** — Missing coverage, edge cases (Satchel untitled, demo schema for new fields, NULL intent/layout, Realtime cleanup on logout, RPC fallback logging).
3. **Answers to outstanding questions** — Direct answers or recommended resolution for each open question in § 4 above (Elias tap A/B/C, display name, shard completion, sound toggle, Forest Threshold, offline, Semantics, Loading).
4. **Feature expansion recommendations** — Prioritized feature ideas (Branch Removal, Promote to Marker, pebble logic UI, Survey Island layout, Satchel pack animation, Elias idle, habit milestones, marker templates, etc.).
5. **General app recommendations** — UX, performance, store/release, accessibility, consistency (empty states, pull-to-refresh, 60fps, store listing, icons/splash).
6. **Outstanding tasks** — Ordered task list the team can execute (gatekeepers first: Display name, Shard completion, RLS verify, Satchel verify; then high-value then polish).
7. **Polishing** — Visual/UX polish (design tokens, letter-spacing where missing, contextual haptics, bubble on tap only, Elias 7+ days copy, step descriptions already done, deferred bugs list when touching related code).

8. **Release-readiness / gatekeeper checklist** — Concrete verification steps the team can run (on device or in code) for: (a) Display name — exact steps to verify intro Beats 3 & 5, management, Sanctuary use profile.display_name and skip/empty → “traveler”; (b) Shard completion — exact steps to verify last leaf under a boulder completes → parent updates; (c) RLS — reference to RLS_VERIFICATION.md and what to document in TESTING_CHECKLIST; (d) Satchel verify — fresh UID steps and what to document. Format as a short checklist (e.g. “□ Step 1: … □ Step 2: …”) so it can be printed or pasted into TESTING_CHECKLIST.

Prefer **actionable, specific items** with file or area references where possible. Preserve the app’s “cozy, ritual, Japandi” stance and gatekeeper order (data safety and narrative before heavy polish). **We are in build mode:** prioritize a clear “do next” order and concrete gatekeeper checks so the team can execute toward release.
