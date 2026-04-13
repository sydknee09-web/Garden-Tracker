# Health Check & Improvement Recommendations

**Derived from:** [MASTER_PLAN.md](MASTER_PLAN.md)

**Date:** March 2026  
**Scope:** Post–master-plan cleanup, analyzer health, and prioritized improvements.

**Recently completed (March 2026):** First Blockage RPC (1), Error boundaries (4), RLS/Satchel doc steps (2, 3), Step 5 keyboard retention (6), Elias typewriter (7), letter-spacing on THE MAP / YOUR SATCHEL (9), step descriptions (13), night-shift on Whetstone/Refine (27). **Later pass:** Semantics (21) ExcludeSemantics + Pack label; Loading (33) Waiting pulse on Satchel; Map back button (canPop/go to Sanctuary) and top roller IgnorePointer; New Journey keyboard (top-align scroll + viewInsets); VALIDITY_FILTER_RPC_SPEC doc sync. See [POST_V1_ROADMAP](POST_V1_ROADMAP.md) and [TESTING_CHECKLIST](TESTING_CHECKLIST.md). **Full gaps, concerns, questions, and polish:** § 9 below. **Refinement Strategy (Accountant vs Visionary balance):** § 10. **Item 41 (Wizard Nav Row) + Sanctuary Lexicon:** Done — shared `_WizardNavRow`, "Previous Step" / "Stow the Map" / "Roll Scroll", no wrap; [.cursor/rules/sanctuary-lexicon.mdc](../.cursor/rules/sanctuary-lexicon.mdc) active.

---

## 1. Dead Code Cleanup (Done)

- **Elias silhouette** — Removed `// ignore: dead_code, dead_null_aware_expression` in `frameBuilder`; simplified to `return child` when `frame != null` (child is non-null there). No other dead code or unused declarations were reported by `flutter analyze lib/`.

---

## 2. Health Check Summary

| Check | Result |
|-------|--------|
| `flutter analyze lib/` | **0 errors.** 11 warnings/infos (unused imports, unused locals, 1 deprecated withOpacity, climb_flow optional params, unnecessary const). See [HEALTH_AUDIT_RUNBOOK.md](HEALTH_AUDIT_RUNBOOK.md) for full audit. |
| Unused imports | bootstrap.dart (demo_mode_provider), auth_screen.dart (go_router, app.dart) |
| Unused elements | gradientColors (elias_intro_overlay), bubbleSpacing (whetstone_choice_overlay); climb_flow optional params |
| Deprecated API | sanctuary_screen.dart:292 withOpacity → use .withValues() when cleaning |

**Command to re-run:** `flutter analyze lib/`. **Recurring audits:** [HEALTH_AUDIT_RUNBOOK.md](HEALTH_AUDIT_RUNBOOK.md).

---

## 3. Twenty Recommendations to Improve the App

### Reliability & Data

1. **First Blockage RPC** — **Done.** Implemented in migration `20250320000004_first_blockage_refactor.sql` (Highest Incomplete Ancestor in `get_packable_candidates` for Climb so nested boulders (Office > Desk > Drawers) don’t leave users stuck. See [VALIDITY_FILTER_RPC_SPEC](VALIDITY_FILTER_RPC_SPEC.md) and [TEST_STRATEGY](TEST_STRATEGY.md).

2. **RLS verification** — Process in place: run two-account tests per [RLS_VERIFICATION](RLS_VERIFICATION.md); document result in [TESTING_CHECKLIST](TESTING_CHECKLIST.md) First Five (row 5). Manual step before release.

3. **Satchel new-user verification** — Process in place: manual test (fresh UID → 6 empty slots → Pack); document in TESTING_CHECKLIST row 3b or [TEST_STRATEGY](TEST_STRATEGY.md).

4. **Error boundaries** — **Done.** [SanctuaryErrorWidget](../lib/widgets/sanctuary_error_widget.dart) + `ErrorWidget.builder` in main.dart; themed (e.g. `ErrorWidget.builder`) that shows a friendly “Something went wrong” and a Retry action instead of a red screen.

5. **Offline / network messaging** — Centralize “no connection” copy and retry behavior; ensure Scroll, Satchel, and Whetstone use the same pattern (see README/SUPABASE_SETUP for network failure docs).

### UX & Polish

6. **Step 5 keyboard retention** — Keep focus (and keyboard open) when tapping “Plant Pebble” / “Add another” so users can chain pebble names without re-tapping the field.

7. **Elias typewriter (wizard)** — **Done.** [TypewriterText](../lib/widgets/typewriter_text.dart) used for all Elias lines in New Journey wizard; ~1200 ms reveal with letter-spacing.

8. **Speech bubble on tap only** — Ensure Elias speech bubble appears only after user tap (and after closing a popup), not automatically when opening overlays; reduces noise.

9. **Letter-spacing animation** — Serif headers (e.g. “THE MAP”, “YOUR SATCHEL”): animate letter-spacing from 0 to ~1.5 over ~800 ms on screen entry for a more refined feel.

10. **Contextual haptics** — Differentiate feedback: light for pebble complete, medium for last of landmark, heavy for last of mountain (or burn).

### Content & Onboarding

11. **Management greeting pool** — Already implemented; consider 1–2 more rotating lines to keep “What would you like to do?” feeling fresh.

12. **Elias 7+ days untouched** — Show “The weeds are tall on that northern peak…” (or similar) when a mountain has had no burns for 7+ days; wire to `MountainMomentum.isUntouched` where the detail or map is shown.

13. **Step descriptions** — Add short explanatory copy for wizard steps (e.g. Step 4: what a phase/marker is; Step 5: “Tap a marker to add pebbles”; Identity: “This name appears on your map”).

14. **Marker templates (Step 4)** — Optional “Use template” (e.g. Research / Plan / Execute / Review) to pre-fill landmark names and reduce blank-slate friction.

15. **Habit milestones** — One-time Elias line or toast at 7, 30, and 100 days for a Whetstone habit to reinforce streaks.

### Performance & Tech

16. **Asset precaching** — Already done for Elias and Hearth; ensure any new heavy assets (e.g. Phase 12 idle, parallax) are precached on first frame.

17. **Narrow invalidation** — Where possible, invalidate only the affected mountain’s node list (e.g. after `_saveTitle`) instead of global node invalidation to cut unnecessary rebuilds.

18. **Dependency updates** — Run `flutter pub outdated` and plan a pass to update packages within compatibility bounds; test after upgrades (e.g. go_router, riverpod, flutter_slidable).

19. **E2E coverage** — Add integration tests for Auth → Sanctuary, Map + Architect (boulder add), and Satchel Pack → Hearth burn to protect the core loop (see TESTING_CHECKLIST “Worth adding later”).

20. **Deep link for password reset** — Support `voyagersanctuary://` (or app scheme) for “forgot password” links so users land back in the app after reset; document in README.

---

## 4. Priority Overview

| Priority | Items |
|----------|--------|
| **Before release (gatekeepers)** | 1 (First Blockage), 2 (RLS), 3 (Satchel verify), 4 (Error boundary), **51** (Display name), **55** (Shard completion) |
| **High value** | 5 (Offline messaging), 6 (Keyboard), 7 (Typewriter), 8 (Bubble on tap) |
| **Polish** | 9–11 (Animations, haptics, greetings), 12–15 (Elias/momentum, descriptions, templates, milestones) |
| **Tech debt** | 16–18 (Precache, invalidation, deps), 19–20 (E2E, deep link) |

**Gatekeeper rationale:** 1–4 secure data and safety. **51** (Display name) secures the narrative soul—Elias must know who he’s talking to or the Sanctuary feels like a generic template. **55** (Shard completion) is the most critical logic item left: without it, users feel a "UI lag" where their effort isn’t immediately reflected in the parent’s progress. Narrative and mechanical logic aligned before the first user arrives.

### Execution strategy

Items 1–4, 51, and 55 are **gatekeepers**: do not start Accessibility (21) or Aesthetics (27) until First Blockage (1), RLS Verification (2), Display name (51), and Shard completion (55) are signed off. Execution order, Cursor clusters (Tactile Keyboard, Visual Sophistication), high-impact notes, performance/Revert Protocol, and the Plan of Attack are in **[POST_V1_ROADMAP](POST_V1_ROADMAP.md)**. That doc turns this list into a flight manual Cursor can follow without losing the Sanctuary soul or breaking the data layer.

---

## 5. Remaining Recommendations (Expanded)

Additional improvements beyond the top 20, grouped by area.

### Accessibility

21. **Semantics and screen readers** — Add `Semantics` labels to key actions (Pack, Burn, New Journey, Hammer, Whetstone tile) and to Elias speech bubbles so TalkBack/VoiceOver users can navigate and understand state.

22. **Font scaling** — Ensure all text respects `MediaQuery.textScalerOf(context)` or `textScaleFactor` so system font-size settings don’t break layouts (especially wizard steps and Satchel rows).

23. **Contrast and focus** — Verify focus order and visible focus indicators for keyboard and switch users; ensure ember/gold on charcoal meets WCAG contrast where it’s the primary action.

### Store & Release

24. **Store listing assets** — Short/long description and v1.0.0 release note in [STORE_LISTING.md](STORE_LISTING.md). Data Safety / Privacy answers and Privacy Policy draft in [DATA_SAFETY_AND_PRIVACY.md](DATA_SAFETY_AND_PRIVACY.md). Terms of Service and hosting notes in [LEGAL.md](LEGAL.md). Prepare screenshots (phone + tablet if applicable) and publish Privacy Policy and ToS URLs before Google Play and App Store submission (see [TESTING_CHECKLIST](TESTING_CHECKLIST.md) Release path).

25. **App icons and splash** — Finalize app icon (all densities) and splash screen per platform guidelines; reference [ASSET_MANIFEST](ASSET_MANIFEST.md) and [CONVENTIONS](CONVENTIONS.md) for asset placement.

26. **60fps on mid-range** — Profile on a mid-range device; confirm Hearth sparks, Satchel slot animations, and scroll/list scrolling hold 60fps; reduce particle count or animation complexity if needed.

### Aesthetic & Phase 12 (Optional)

27. **Night-shift aesthetics** — In night period, apply a subtle amber tint to Whetstone overlay and Refine (parchment) surfaces so the app feels consistent with “Blue Hour” and 4:00 AM Hearth ritual (see MASTER_PLAN Part D § 4.3).

28. **Design tokens formalized** — Document and reuse: nav row spacing (e.g. 12px), min touch target (44×44), secondary font size on mobile (12), primary button min width (100px). See [VOYAGER_SANCTUARY_UI_AUDIT](VOYAGER_SANCTUARY_UI_AUDIT.md) Design tokens.

29. **Elias idle (Phase 12)** — Add breathing/blink or subtle motion when Elias is on screen for a few seconds; use `assets/elias/elias_idle` when available (see ASSET_MANIFEST Phase 12).

30. **Satchel pack animation** — Stones “fly” from Map/markers into Satchel on Pack, per [SATCHEL_PACK_ANIMATION_SPEC](SATCHEL_PACK_ANIMATION_SPEC.md); 500ms arc, stagger 150ms.

31. **Hearth burn/shatter tuning** — Fine-tune burn celebration (sound, particle burst, Elias line) and any stone-shatter feedback so they feel satisfying without being noisy.

32. **Parallax or particles** — Optional background parallax or ambient particles for Sanctuary/entrance to deepen the “living world” feel (Phase 12; asset checklist in ASSET_MANIFEST).

### Consistency & Empty States

33. **Empty state audit** — Ensure every main screen has one clear next action: Scroll → “New Journey”; Satchel → Pack or go to Map; Whetstone → “Add habit”; Archive → “No archived peaks” + Restore CTA. Reuse the same pattern (illustration or icon + one line + one button).

34. **Pull-to-refresh** — Consider pull-to-refresh on Scroll (mountains list) and Satchel so users can force a sync without leaving the screen.

35. **Loading consistency** — Use the same skeleton or spinner style (theme colors, no raw `CircularProgressIndicator` without wrap) on Scroll, Satchel, Whetstone, and Archive.

### Testing & Docs

36. **Mallet integration test** — Add an integration test that opens Map, enables Architect, and performs a mallet drop (boulder or pebble creation) to protect the flow; see TESTING_CHECKLIST “Mallet integration test.”

37. **Deferred bugs** — Revisit [BUGS_DEFERRED_TO_PHASE](BUGS_DEFERRED_TO_PHASE.md); fix or close each row when the relevant feature is touched (e.g. “(untitled) for unnamed pebbles” when doing Satchel polish).

38. **Docs in sync** — After large features, update [ARCHITECTURE](ARCHITECTURE.md), [CONVENTIONS](CONVENTIONS.md), and [MASTER_PLAN](MASTER_PLAN.md) so new screens, providers, and patterns are documented.

### Optional / Later

39. **Crash reporting** — If you add a service (e.g. Sentry, Firebase Crashlytics), wire uncaught errors and Flutter framework errors so release builds report crashes; keep PII and user content out of reports.

40. **Internationalization** — If you ever target another locale, introduce `flutter_localizations` and extract all user-facing strings (Elias dialogue, buttons, errors) into ARB or a single source of truth; Georgia and tone can remain, with translated content.

---

## 6. Quick Reference — All Recommendations by Category

| # | Category | One-line summary |
|---|----------|------------------|
| 1–5 | Reliability & data | First Blockage RPC, RLS verify, Satchel verify, error boundary, offline messaging |
| 6–10 | UX & polish | Step 5 keyboard, typewriter Elias, bubble on tap, letter-spacing animation, contextual haptics |
| 11–15 | Content & onboarding | Greeting pool, Elias 7+ days, step descriptions, marker templates, habit milestones |
| 16–20 | Performance & tech | Precaching, narrow invalidation, dependency updates, E2E, deep link |
| 21–23 | Accessibility | Semantics, font scaling, contrast/focus |
| 24–26 | Store & release | Store assets, icons/splash, 60fps |
| 27–32 | Aesthetic & Phase 12 | Night-shift, design tokens, Elias idle, pack animation, hearth tuning, parallax |
| 33–35 | Consistency | Empty states, pull-to-refresh, loading |
| 36–38 | Testing & docs | Mallet test, deferred bugs, docs in sync |
| 39–40 | Optional | Crash reporting, i18n |
| **41–50** | **§ 9** | Wizard nav row, Step 4 spacing, button labels, Return wrap, design tokens, step copy, Branch Removal, smoke tests, docs sync, Mallet test |
| **51–55** | **§ 9** | Display name (51), sound toggle (52), Whetstone overlay (53), streak/grace-day (54), shard completion (55). **51 & 55** = gatekeepers (§ 4 Before release); **52 & 54** = Deep polish / verification. |

**For a full list of gaps, concerns, open questions, new recommendations, expansions, and polish,** see **§ 9. Gaps, Concerns, Questions, Recommendations, Expansions & Polish.**

---

## 7. Re-run Health Check

```bash
cd voyager_sanctuary
flutter analyze lib/
```

Expect: **No issues found.**

---

## 8. Post–implementation audit (March 2026)

*After completing First Blockage RPC, Safety pass (error boundaries, RLS/Satchel docs), and Vibe pass (Cluster A + B).*

### Completed and verified

- **1** First Blockage RPC — Migration `20250320000004_first_blockage_refactor.sql` applied; Gatekeeper (depth-first first-incomplete) for Climb. Survey unchanged.
- **2, 3** RLS and Satchel new-user — Process and checklist rows (5, 3b) in place; manual run and sign-off before release.
- **4** Error boundaries — `SanctuaryErrorWidget` + `ErrorWidget.builder`; Retry restarts app.
- **6** Step 5 keyboard retention — Focus retained after “Plant Pebble” and “Plant & Next.”
- **7** Elias typewriter — `TypewriterText` on all wizard Elias lines; 1200 ms reveal.
- **9** Letter-spacing — “THE MAP” and “YOUR SATCHEL” animate 0 → 1.5 over 800 ms.
- **13** Step descriptions — Helper copy on Steps 1–5 (Intent, Identity, Logic, Markers, Placing stones).
- **27** Night-shift — Whetstone and Refine use `candlelightTint` when `ScenePeriod.night`.

### Inconsistencies and follow-ups

| Area | Finding | Recommendation |
|------|---------|----------------|
| **Semantics (21)** | Pack/Burn and decorative sparks not yet fully aligned with POST_V1_ROADMAP “Ghost in the Machine” (ExcludeSemantics for sparks; stateful label for Pack). | Before Accessibility pass: add ExcludeSemantics for HearthSparkPainter and Semantics label for Pack (e.g. “Pack N pebbles into your satchel”). |
| **Loading (33)** | “Waiting” state / dimmed HearthSparkPainter not yet standardized on Scroll, Satchel, Whetstone, Archive. | When touching loading UIs, use dimmed painter + slower `sparkTime` per POST_V1_ROADMAP § 4.3. |
| **Performance** | Item 30 (Satchel pack animation) not implemented; 60fps / Revert Protocol applies after it lands. | After implementing Item 30: run 60fps check on mid-range device; if &lt;55fps, do Narrow Invalidation (17) before tuning animation. |
| **Docs** | VALIDITY_FILTER_RPC_SPEC — was "Implementation deferred". | **Done.** Spec now states "Implemented" and "Resolved by First Blockage". Keep in sync when adding or changing RPCs. |

### Feature / improvement suggestions

- **Offline (5):** Centralize “no connection” copy and retry; same pattern on Scroll, Satchel, Whetstone.
- **Speech bubble (8):** Ensure Elias bubble only on tap (not auto when opening overlays) to reduce noise.
- **Contextual haptics (10):** Light/medium/heavy for pebble complete, last of landmark, last of mountain (or burn).
- **Elias 7+ days (12):** Surface “weeds are tall…” when mountain untouched 7+ days; wire to `MountainMomentum.isUntouched`.
- **Marker templates (14):** Step 4 already has “Use template 1/2”; consider one more variant if needed.
- **Dependencies (18):** Run `flutter pub outdated`; plan upgrade pass (go_router, riverpod, flutter_slidable) with tests.
- **E2E (19):** Add Auth → Sanctuary, Map + Architect, Satchel Pack → Hearth to integration_test when capacity allows.

---

## 9. Gaps, Concerns, Questions, Recommendations, Expansions & Polish

*Consolidated from GAPS_AND_ASSUMPTIONS, BUGS_DEFERRED_TO_PHASE, VOYAGER_SANCTUARY_UI_AUDIT, AUTH_PASSWORD_RESET, NEXT_STEPS, MASTER_PLAN, and codebase review. Use this section to prioritize future work and avoid re-solving closed decisions.*

---

### 9.1 Gaps (missing coverage, edge cases)

| Gap | Source | Recommendation / question |
|-----|--------|---------------------------|
| **Map back button when stack is flat** | User report | **Addressed:** Back uses `canPop()` then `context.go(AppRoutes.sanctuary)` so it always works. Top scroll roller wrapped in `IgnorePointer` so it never steals touches. |
| **New Journey keyboard pushes menu off-screen** | User report | **Addressed:** Climb overlay uses top-aligned scroll, `viewInsets` padding on scroll content, `keyboardDismissBehavior: onDrag`. |
| **Satchel (untitled) for unnamed pebbles** | BUGS_DEFERRED_TO_PHASE | When touching Satchel polish: show "(untitled)" or placeholder only where node title is empty; consider "New pebble" fallback in display. |
| **Demo mode and new schema** | GAPS_AND_ASSUMPTIONS §10 | Ensure DemoStorage / DemoMountainRepository / DemoNodeRepository support `intent_statement`, `layout_type`, `appearance_style`; add to checklist when changing wizard or peaks. |
| **Existing peaks with NULL intent/layout** | GAPS_AND_ASSUMPTIONS §11 | Bones: show intent as "(Not set)" or empty, editable; default `layout_type` to `climb` in reads. Document in CONVENTIONS. |
| **Integration tests vs 6-step wizard** | GAPS_AND_ASSUMPTIONS §12 | Update synthetic_user_test to use New Journey (Elias or Map FAB), 6-step wizard, dynamic 1–10 markers when changing creation flow. |
| **Promote to Marker (same peak) / Demote** | GAPS_AND_ASSUMPTIONS §14b–c | Phase 2. Not required for MVP. |
| **Pebble logic UI** | GAPS_AND_ASSUMPTIONS §14d | DB stores `pebble_logic` (default `freeform`); toggle UI in Phase 2. |
| **Survey Island/Constellation layout** | GAPS_AND_ASSUMPTIONS §9 | Phase 1: tree for both Climb and Survey. Phase 2: Island/Constellation for Survey. |
| **Order_index on create** | GAPS_AND_ASSUMPTIONS §18 | Stay with `0` + `created_at` until "Drag to Reorder" ships; then `max(siblings) + 1`. |
| **Forest Threshold** | MASTER_PLAN | Cold start: dense forest image fades to reveal Sanctuary. Link animation speed to `has_seen_elias_intro` (slower first time). See ELIAS_INTRODUCTION_SPEC Beat 1, bootstrap. |
| **Elias tap: bubble + sheet together** | GAPS_AND_ASSUMPTIONS §8 | Current: tap opens management sheet; bubble was removed on open to avoid tray re-animate. Option C (message on sheet close) possible later. |
| **Display name (Elias personalization)** | Migration 20250320000005, ELIAS_INTRODUCTION_SPEC | Intro Beats 3 & 5 and management dialogue should use `profile.display_name` when set; handle skip/empty gracefully (generic "traveler" or omit name). Demo mode: ensure DemoProfileRepository supports `display_name` if intro runs in demo. |
| **Shard completion propagation** | Migration 20250320000000 | When the last pebble in a shard completes, trigger updates parent completion state. Verify on device: complete all leaves under a boulder → parent shows complete; document in TEST_STRATEGY if edge cases appear. |

---

### 9.2 Concerns (security, performance, maintainability)

| Concern | Detail | Recommendation |
|---------|--------|----------------|
| **RLS** | Two-account isolation must be verified before release. | Run [RLS_VERIFICATION](RLS_VERIFICATION.md); document in TESTING_CHECKLIST row 5. |
| **Fresh-UID satchel** | New user must see 6 empty slots; Pack must show candidates or "No tasks waiting." | Manual test 3b; document in TESTING_CHECKLIST. |
| **Narrow invalidation** | Global node/mountain invalidation after single-node edits causes unnecessary rebuilds. | Item 17: invalidate only affected mountain's node list (e.g. after `_saveTitle`). |
| **60fps on mid-range** | Hearth sparks, Satchel animations, scroll/list can drop frames. | Item 26: profile on mid-range device; Revert Protocol (POST_V1_ROADMAP §5) if &lt;55fps after Item 30. |
| **Dependency drift** | `flutter pub outdated` shows many packages behind. | Item 18: plan upgrade pass (go_router, riverpod, flutter_slidable, etc.) with tests. |
| **RPC fallback logging** | Distinguish migration-not-applied from network timeout when progress stays 0%. | GAPS_AND_ASSUMPTIONS §18: `debugPrint` in catch blocks. |
| **Sound toggle** | `soundEnabledProvider` persists to SharedPreferences; all playback paths must respect it. | Verify Hearth (including any ambient sizzle), mallet strike, burn, Whetstone, and app_open/scroll_open check provider before playing. When the user wants silence, the app should provide **total stillness**—no Hearth ambient left on. Add to TESTING_CHECKLIST if manual pass needed. |
| **Realtime cleanup** | Mountain and node repositories use Realtime; on logout or long idle, channels should be disposed. | Subscription leaks are silent killers of mobile performance and battery. Ensure channels are disposed when user signs out or app backgrounds; existing "Realtime unavailable" fallback is correct for transient failures. |
| **Crash reporting** | No service yet. | Item 39: if adding Sentry/Crashlytics, wire uncaught errors; keep PII/user content out. |

---

### 9.3 Open questions

| Question | Context | Options / note |
|----------|---------|-----------------|
| **"Place" accessibility** | Sanctuary metaphor may need clarification for screen readers. | GAPS_AND_ASSUMPTIONS §13: add Semantics e.g. `label: 'Add pebble to [marker name]'`; visible button stays "Place Pebble". |
| **Elias overlap with inputs** | On small screens, Elias hit area could overlap parchment card. | VOYAGER_SANCTUARY_UI_AUDIT §5.1: ensure `IgnorePointer` or position so Elias never overlaps card at 320px min width. |
| **Return vs Back label** | "Back" vs "Return to Sanctuary" can confuse. | Consider renaming "Back" → "Previous Step" when `onBack != null`; keep "Return to Sanctuary" as escape. |
| **Forgot password in app** | AUTH_PASSWORD_RESET: "when we add it". | Add "Forgot password?" on Auth screen; use Supabase recovery; document Site URL / Redirect URLs (e.g. `voyagersanctuary://`). |
| **Deep link from reset** | Optional: open app from reset link. | app_links + `recoverSession(uri)` when opened from `voyagersanctuary://`; Item 20. |

---

### 9.4 New / expanded recommendations

**Deep polish / verification (52, 54):** Sound toggle (52) and streak/grace-day (54) live here as essential verification items—they support trust and ritual but are less about the core narrative flow than the gatekeepers Display name (51) and Shard completion (55) (§ 4).

| # | Area | Recommendation |
|---|------|----------------|
| 41 | **Wizard nav row** | Extract shared `_WizardNavRow` (Back \| Return \| Primary) for all steps; consistent `Flexible`/`Expanded`, spacing 12px; LayoutBuilder for width &lt;320 to stack vertically. |
| 42 | **Step 4 spacing** | Increase vertical padding (24→32–40px) between Add/Remove and Continue; optional Divider between list management and primary nav. |
| 43 | **Button labels (wizard)** | Use fixed short labels for buttons: "Next Marker", "Pack Journey", "Place & Next"; do not use `EliasDialogue` random strings as button text (layout instability). |
| 44 | **Return to Sanctuary wrap** | Ensure FittedBox/minWidth so label does not wrap as "Sanctuar-y"; minWidth ~120px or shorter context label ("Sanctuary" / "Back to Camp"). |
| 45 | **Design tokens** | Formalize: nav row spacing 12px; min touch target 44×44; secondary font 12 on mobile; primary button min width 100px. See VOYAGER_SANCTUARY_UI_AUDIT §8. |
| 46 | **Step description copy** | Step 4: explain what a phase/marker is (e.g. "Name the waypoints on your path—e.g. Research, Plan, Execute."). Step 5: "Tap a marker to add pebbles. Add several per marker, or move to the next." Identity: "This name appears on your map. Keep it short and memorable." |
| 47 | **Branch Removal** | Long-press on Marker → "Move to General" or "Scatter" per MASTER_LEDGER_ARCHITECTURE_OVERHAUL §6; Elias confirmation for Scatter. |
| 48 | **Smoke tests before release** | Run synthetic_user_test on device before any release; keep app installed after with `flutter install --debug` if not using test cleanup. |
| 49 | **Docs after large features** | Update ARCHITECTURE, CONVENTIONS, MASTER_PLAN when adding screens, providers, or patterns. Item 38. |
| 50 | **Mallet integration test** | Protect Map + Architect + mallet drop (boulder/pebble creation) in integration_test. TESTING_CHECKLIST "Mallet integration test." |
| 51 | **Display name verification** | Elias intro (Beats 3 & 5) and personalised dialogue use `profile.display_name` when set; skip/empty handled without break. Demo profiles support `display_name` if intro runs in demo. See ELIAS_INTRODUCTION_SPEC, migration 20250320000005. |
| 52 | **Sound toggle verification** | **Deep polish / verification.** Settings sound on/off respected app-wide (Hearth, mallet, burn, Whetstone, entrance), including any Hearth ambient sizzle—total stillness when user wants silence. Persists via `sound_settings_provider`. Manual test before release. |
| 53 | **Whetstone choice overlay polish** | Per [WHETSTONE_CHOICE_OVERLAY_SPEC](WHETSTONE_CHOICE_OVERLAY_SPEC.md): bubble tail anchored to icon (GlobalKey + post-frame layout); Sharpen Habits only (Refine on Map); idle auto-close after 30s with Elias parting line; empty-Satchel path (suggest Map first). |
| 54 | **Streak and grace-day verification** | **Deep polish / verification.** Midnight (4:00 AM Sanctuary boundary) rollover and grace-day (freeze) logic per [GRACE_DAY_STREAK_SPEC](GRACE_DAY_STREAK_SPEC.md). Essential but less about core narrative flow. Verify on device; document in TEST_STRATEGY or TESTING_CHECKLIST. |
| 55 | **Shard completion trigger** | When last pebble in a shard completes, parent completion state updates (migration 20250320000000). Verify boulder/shard completion propagates; add to regression suite if needed. *(Gatekeeper: § 4 Before release.)* |

---

### 9.5 Expansions (more detail on existing items)

| Item | Expansion |
|------|-----------|
| **5 Offline** | Single copy for "no connection" and retry; same pattern on Scroll, Satchel, Whetstone; document in README/SUPABASE_SETUP. |
| **8 Speech bubble** | Elias bubble only after user tap (and after closing a popup), not when opening overlays; reduces noise. |
| **12 Elias 7+ days** | Show "The weeds are tall on that northern peak…" (or similar) when mountain has no burns 7+ days; wire to `MountainMomentum.isUntouched` where detail or map is shown. |
| **14 Marker templates** | Step 4 has "Use template 1/2"; consider one more variant if needed. |
| **20 Deep link** | Support `voyagersanctuary://` for password reset so users land in app after reset; AUTH_PASSWORD_RESET + app_links + recoverSession. |
| **21 Semantics** | ExcludeSemantics for sparks and Pack label done; add for Burn drop zone, New Journey, Hammer, Whetstone tile when doing full Accessibility pass. |
| **33 Loading** | Satchel has Waiting pulse (sparkTime × 0.3, dimmed); add same pattern to Scroll, Whetstone, Archive when touching those screens. |
| **35 Loading consistency** | Same skeleton or spinner style (theme colors) on Scroll, Satchel, Whetstone, Archive; avoid raw CircularProgressIndicator without wrap. |

---

### 9.6 Polish (small UX, copy, layout)

| Polish | Location | Action |
|--------|----------|--------|
| **Plant & Next** | climb_flow_overlay `_NamePebbleCard` | Already shortened to "Place & Next"; ensure Flexible so no overflow on ~360px. |
| **Pack / Next button labels** | Step 5 `_LandmarkChipsCard` | Fixed "Next $markerLabel" / "Finish"; no Elias random strings in buttons. |
| **Appearance helper** | Step 2 | Add: "Choose a color theme for this peak on the map." |
| **Compass vs Return** | Wizard | Keep both; compass = quick escape, Return = explicit. Ensure Return button does not wrap (see 9.4 #44). |
| **Elias voice** | New dialogue | Use [ELIAS_VOICE_GUIDE](ELIAS_VOICE_GUIDE.md): short sentences, metaphor, ~80 chars for bubbles, vocabulary (stones, path, Hearth). |
| **Pull-to-refresh** | Scroll, Satchel | Consider for force-sync without leaving screen. Item 34. |
| **Empty state pattern** | All main screens | One clear next action: Scroll → New Journey; Satchel → Pack or Map; Whetstone → Add habit; Archive → Restore CTA. Item 33. |
| **Save vs Skip** | Dialogs | Prefer "Cancel" + "Save"; allow empty name where intended. MASTER_PLAN Part F. |
| **Climb user instruction** | Until First Blockage | "Keep your main projects in the top-level Boulders to see them on the map." GAPS_AND_ASSUMPTIONS §18. |

---

### 9.7 Quick index — new numbers 41–55

| # | One-line |
|---|----------|
| 41 | Wizard nav row shared widget |
| 42 | Step 4 Add/Remove vs Continue spacing |
| 43 | Fixed short button labels in wizard |
| 44 | Return to Sanctuary wrap / minWidth |
| 45 | Design tokens formalized |
| 46 | Step description copy improvements |
| 47 | Branch Removal (Move to General / Scatter) |
| 48 | Smoke tests before release |
| 49 | Docs sync after large features |
| 50 | Mallet integration test |
| 51 | Display name verification (Elias intro & dialogue) |
| 52 | Sound toggle verification app-wide |
| 53 | Whetstone choice overlay (Sharpen Habits only; bubble tail, idle close, empty-Satchel) |
| 54 | Streak and grace-day verification (4:00 AM, freeze) |
| 55 | Shard completion trigger verification |

---

## 10. Refinement Strategy (Accountant vs Visionary)

*Synthesized from the 40+ recommendations and § 9. Keeps reliability (Accountant) and immersion (Visionary) in balance.*

### 10.1 Top 5 Immediate Action Items (Gatekeepers)

Do not proceed to aesthetic polish until these are signed off:

| # | Item | Action |
|---|------|--------|
| 1 | **First Blockage RPC** | Verify migration `20250320000004_first_blockage_refactor.sql` in production so users never get stuck on nested boulders. |
| 2 | **RLS & multi-user isolation** | Perform the two-account manual test; data silos are the single most important security step before release. |
| 41–44 | **Sanctuary Lexicon + wizard nav** | **Done.** Wizard nav row refactor (Item 41): shared `_WizardNavRow`, "Previous Step" / "Stow the Map" / "Roll Scroll", no text wrap. Lexicon enforced via [.cursor/rules/sanctuary-lexicon.mdc](.cursor/rules/sanctuary-lexicon.mdc). |
| 4 | **Error boundaries** | Confirm SanctuaryErrorWidget catches red screens and provides a themed Retry path that doesn't break immersion. |
| 6 | **Keyboard & focus flow** | Verify Step 5 (Placing stones) retains keyboard focus so the Accountant can enter data quickly without re-tapping the field. |

### 10.2 Visual & interaction sophistication (Cluster A)

- **Item 28 (Tactile buttons):** Apply "Carved Material" rule — inner shadows for depth, "Hearth Glow" (orange outer glow) for selected states. See VOYAGER_SANCTUARY_UI_AUDIT.
- **Item 9 (Letter-spacing):** Animate "THE MAP" and "YOUR SATCHEL" headers on entry (done).
- **Item 27 (Night-shift):** Ensure candlelightTint applies to Whetstone and Refine during night hours (4:00 AM Hearth ritual) (done).

### 10.3 Sanctuary Lexicon enforcement

The Cursor rule [.cursor/rules/sanctuary-lexicon.mdc](.cursor/rules/sanctuary-lexicon.mdc) is active. Use prescribed terms; avoid forbidden.

| Context | Forbidden | Prescribed |
|--------|-----------|------------|
| The Archive | Return to Earth / Archive | Chronicle / Stone Ledger |
| Task creation | Place / Set / Task | Set / Carve / Pebble |
| Navigation | Back / Home | Stow the Map / Roll Scroll |
| Completion | Done / Finish | Burn / Extinguish |

### 10.4 Technical debt & safety (Cluster B)

- **Item 17 (Narrow invalidation):** **Done.** [narrow_invalidation.dart](../lib/providers/narrow_invalidation.dart) defines `invalidateAfterNodeMutation(ref, mountainId)` and `invalidateAfterBurn(ref, mountainId)`. All node mutations (edit overlay, mallet, wizard, burn) use these so only the affected mountain's node list and progress rebuild.
- **Item 16 (Asset precaching):** Ensure Elias idle and parallax assets are cached to prevent stutter on first reveal.
- **Item 18 (Dependency update):** Run `flutter pub outdated`; target stable go_router and riverpod as release nears.
