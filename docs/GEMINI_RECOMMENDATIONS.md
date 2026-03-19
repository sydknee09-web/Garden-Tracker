# Voyager Sanctuary — Consolidated Recommendations

**Purpose:** Single reference for coding updates, gaps, outstanding questions, feature expansion, general recommendations, outstanding tasks, and polishing.  
**Source:** [GEMINI_APP_HANDOFF.md](GEMINI_APP_HANDOFF.md), [MASTER_PLAN.md](MASTER_PLAN.md), [HEALTH_AND_IMPROVEMENTS.md](HEALTH_AND_IMPROVEMENTS.md), [GAPS_AND_ASSUMPTIONS.md](GAPS_AND_ASSUMPTIONS.md), [ARCHITECT_MODE_AUDIT.md](ARCHITECT_MODE_AUDIT.md), [NEXT_STEPS.md](NEXT_STEPS.md), [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md).  
**Stance:** Cozy, ritual, Japandi. Gatekeepers (data safety and narrative) before heavy polish.

---

## 1. Coding updates

Concrete code-level changes. Prefer small, verifiable edits.

| Area | Change | File / location |
|------|--------|------------------|
| **Deprecated API** | Replace `withOpacity` with `withValues(alpha: …)`. | `lib/features/sanctuary/sanctuary_screen.dart` line 294: `glowColor.withOpacity(pulseValue)` → `glowColor.withValues(alpha: pulseValue)`. |
| **Unused imports** | Remove unused imports to clear analyzer warnings. | `lib/bootstrap.dart` (e.g. `demo_mode_provider` if unused); `lib/features/auth/auth_screen.dart` (`go_router`, `app.dart` if unused). Re-run `flutter analyze lib/` and fix any reported unused imports/locals. |
| **Narrow invalidation** | After node-level edits, invalidate only the affected mountain. | Already adopted: `invalidateAfterNodeMutation` / `invalidateAfterBurn` in `lib/providers/narrow_invalidation.dart` are used from `edit_flow_overlay.dart`, `mountain_detail_screen.dart`, `sanctuary_screen.dart`, `climb_flow_overlay.dart`. Ensure any new node mutation (e.g. inline title save) uses `invalidateAfterNodeMutation(ref, mountainId)` and does **not** invalidate `mountainListProvider` unless the operation is peak-level (create/rename/archive/restore). |
| **Sound check before play** | Every audio play path must respect `soundEnabledProvider`. | **Already guarded:** `lib/features/entrance/entrance_screen.dart` (app open), `lib/features/scroll_map/scroll_map_screen.dart` (scroll open), `lib/app.dart` (refine mode), `lib/features/sanctuary/sanctuary_screen.dart` (stone drop), `lib/features/management/guidance_storybook_overlay.dart` (weight). **Verify:** Any mallet strike, burn moment, or Whetstone sound (e.g. in climb wizard or Hearth) checks `ref.read(soundEnabledProvider)` before calling `play()`. Add a single-line guard wherever a new sound is added. |
| **Display name usage** | Intro and management must use `profile.display_name` when set; handle skip/empty. | **Intro:** `lib/features/onboarding/elias_intro_overlay.dart` — Beats 3 & 5 already use `profile?.displayName?.trim()` (lines 319–331). **Management:** `lib/features/management/management_menu_sheet.dart` uses `EliasDialogue.managementGreeting(ref.watch(profileProvider).valueOrNull?.displayName)`. **Sanctuary greeting:** `lib/features/sanctuary/sanctuary_screen.dart` uses `EliasDialogue.sanctuaryPeriodGreeting(…, displayName)`. Ensure skip/empty yields generic “traveler” or equivalent in `lib/core/content/elias_dialogue.dart` (e.g. `managementGreeting`, `sanctuaryPeriodGreeting`). |
| **Dead code / analyzer** | Remove unused elements and fix optional-param warnings. | Per HEALTH_AND_IMPROVEMENTS §2: `gradientColors` (elias_intro_overlay), `bubbleSpacing` (whetstone_choice_overlay); optional params in climb_flow. Run `flutter analyze lib/` and address remaining warnings (unnecessary const, etc.). |

---

## 2. Gaps to address

Missing coverage, edge cases, and technical debt to close before or soon after release.

| Gap | Detail | Action |
|-----|--------|--------|
| **Satchel untitled** | Unnamed pebbles can show as blank or confusing. | When touching Satchel UI: show "(untitled)" or "New pebble" when `node.title` is empty. See [BUGS_DEFERRED_TO_PHASE.md](BUGS_DEFERRED_TO_PHASE.md); fix when doing Satchel polish. |
| **Demo schema** | Demo mode must support new wizard/peak fields. | Ensure `DemoStorage` / `DemoMountainRepository` / `DemoNodeRepository` support `intent_statement`, `layout_type`, `appearance_style`. Add to checklist when changing wizard or peak creation. `lib/data/demo/demo_profile_repository.dart` already supports `displayName`. |
| **NULL intent / layout** | Existing peaks may have NULL `intent_statement` or `layout_type`. | Bones view: show intent as "(Not set)" or empty, editable. Default `layout_type` to `climb` in reads and in UI. Document in CONVENTIONS. |
| **Realtime cleanup** | Mountain and node Realtime channels should be disposed on logout or long idle. | Ensure subscriptions in `node_repository.dart` / mountain repository are cancelled when user signs out or app backgrounds to avoid leaks and battery drain. |
| **RPC fallback logging** | Progress bar at 0% can be migration vs network. | In catch blocks for progress RPCs, use `debugPrint` to distinguish migration-not-applied from network timeout (see GAPS_AND_ASSUMPTIONS §18). |
| **Integration tests vs 6-step wizard** | Synthetic user tests assume older flows. | Update `integration_test/synthetic_users/synthetic_user_test.dart` to use New Journey (Elias or Map FAB), 6-step wizard, and dynamic 1–10 markers when changing creation flow. |

---

## 3. Answers to outstanding questions

Recommended resolution for each open question from the handoff (§4).

| Question | Recommendation |
|----------|-----------------|
| **Elias tap: bubble + sheet (A/B/C)?** | **B or C.** Current: tap opens management sheet; bubble was removed on open to avoid clutter. Prefer **B** (no message when opening sheet) for consistency. **C** (message on sheet close) is an alternative if you want Elias to “respond to their choice.” Low priority; test and pick one. |
| **Display name** | Ensure intro Beats 3 & 5 and management use `profile.display_name`; handle skip/empty with a generic fallback (“traveler”). Code already uses `displayName` in intro, management, and Sanctuary greeting. **Verify** on device: set/clear/skip display name and confirm no break and correct personalization. Demo: `DemoProfileRepository` already supports `display_name`. |
| **Shard completion** | When the last shard under a parent completes, parent completion state must update (migration `20250320000000`). **Verify on device:** complete all leaves under a boulder → parent shows complete. Add to regression or TEST_STRATEGY if edge cases appear. **Gatekeeper.** |
| **Sound toggle** | All playback must respect `soundEnabledProvider`: Hearth (stone drop, any ambient sizzle if added), mallet strike, burn moment, Whetstone, app/scroll open. When user turns sound off, app should be **totally silent**. Audit every `play()` / `AudioPlayer` usage; add `if (!ref.read(soundEnabledProvider)) return;` before play. Persists via `sound_settings_provider`. Manual test before release. |
| **Forest Threshold** | Cold start: dense forest image fades to reveal Sanctuary (no spinner). Animation speed linked to `has_seen_elias_intro`: slower first time, quicker for returning users. Implement in `lib/bootstrap.dart` / entry; see ELIAS_INTRODUCTION_SPEC Beat 1. |
| **Offline** | Centralize “no connection” copy and retry behavior. Use the same pattern on Scroll, Satchel, and Whetstone. Document in README/SUPABASE_SETUP. |
| **Semantics** | Use `ExcludeSemantics` for decorative sparks (e.g. `HearthSparkPainter`). Add Semantics labels for Pack (e.g. “Pack N pebbles into your satchel”), Burn drop zone, New Journey, Hammer, Whetstone tile so screen readers get clear actions. Visible button text stays “Place Pebble”; semantic label can be “Add pebble to [marker name].” |
| **Loading** | Standardize loading UI: “Waiting” / dimmed `HearthSparkPainter` (e.g. `sparkTime × 0.3`, dimmed) on Scroll, Satchel, Whetstone, Archive. Same skeleton or spinner style (theme colors); avoid raw `CircularProgressIndicator` without wrap. |

---

## 4. Feature expansion recommendations

Prioritized feature ideas. Gatekeepers and high-value items first; then polish and “nice-to-have.”

| Priority | Feature | Description |
|----------|---------|-------------|
| **P0 (gatekeepers)** | Display name verification | Already in §3; must be signed off before release. |
| **P0** | Shard completion verification | Already in §3; must be signed off before release. |
| **High** | **Branch Removal** | Long-press on Marker (boulder) → “Move to General” (Miscellaneous at bottom of same peak) or “Scatter” (hard delete with Elias confirmation). Per MASTER_LEDGER_ARCHITECTURE_OVERHAUL §6. Next step if building before Ship and Learn (NEXT_STEPS Option B). |
| **High** | **Promote to Marker** | Promote pebble to marker (same peak). Phase 2; not MVP. |
| **Medium** | **Pebble logic UI** | DB has `pebble_logic` (default `freeform`); add toggle UI in Phase 2 for sequential vs freeform within a pebble. |
| **Medium** | **Survey layout (Island/Constellation)** | Phase 1: tree for both Climb and Survey. Phase 2: Island/Constellation visual for Survey. |
| **Medium** | **Satchel pack animation** | Stones “fly” from Map/markers into Satchel on Pack; 500ms arc, 150ms stagger. See SATCHEL_PACK_ANIMATION_SPEC. |
| **Medium** | **Elias idle** | Breathing or blink when Elias is on screen for a few seconds; use `assets/elias/elias_idle` when available (Phase 12). |
| **Polish** | Marker templates | Step 4 “Use template” (e.g. Research/Plan/Execute/Review); already has 1/2; add variant if needed. |
| **Polish** | Habit milestones | One-time Elias line or toast at 7, 30, 100 days for Whetstone habits. |
| **Polish** | Elias 7+ days untouched | “The weeds are tall on that northern peak…” when mountain has no burns for 7+ days; wire to `MountainMomentum.isUntouched`. |

---

## 5. General app recommendations

UX, performance, store/release, accessibility, consistency.

| Area | Recommendation |
|------|-----------------|
| **UX** | Empty states: one clear next action per screen (Scroll → New Journey; Satchel → Pack or Map; Whetstone → Add habit; Archive → Restore CTA). Consider pull-to-refresh on Scroll and Satchel. |
| **Performance** | Profile on mid-range device; confirm 60fps for Hearth sparks, Satchel animations, scroll. If &lt;55fps after pack animation (Item 30), do narrow invalidation and reduce particle/anim complexity. Asset precache for new heavy assets (Elias idle, parallax). |
| **Store / release** | Store listing: short/long description, v1.0.0 notes in STORE_LISTING.md. Data Safety/Privacy in DATA_SAFETY_AND_PRIVACY.md; ToS in LEGAL.md. App icons and splash per platform; screenshots and published Privacy/ToS URLs before submission. See TESTING_CHECKLIST Release path. |
| **Accessibility** | Semantics (§3); font scaling via `MediaQuery.textScalerOf(context)`; contrast and focus order for keyboard/switch users; ember/gold on charcoal meets WCAG where it’s the primary action. |
| **Consistency** | Design tokens: nav row spacing 12px, min touch target 44×44, secondary font 12 on mobile, primary button min width 100px. Use whetPaper/whetLine/whetInk consistently (Edit overlay, management, wizard). Night-shift: candlelightTint on Whetstone and Refine in night period (already done). |
| **Dependencies** | Run `flutter pub outdated`; plan upgrade pass for go_router, riverpod, flutter_slidable within compatibility bounds; test after upgrades. |
| **E2E** | Add integration tests for Auth → Sanctuary, Map + Architect (boulder add), Satchel Pack → Hearth burn when capacity allows. |
| **Deep link** | Support `voyagersanctuary://` for password reset so users land in app after reset; document in README and AUTH_PASSWORD_RESET. |

---

## 6. Outstanding tasks

Ordered list: gatekeepers first, then high-value, then polish. Data safety and narrative before heavy polish.

1. **Display name** — Verify Elias intro (Beats 3 & 5) and management/Sanctuary use `profile.display_name`; skip/empty handled; demo supports it. Document in TESTING_CHECKLIST or RELEASE_CANDIDATE_SCRIPT.
2. **Shard completion** — Verify on device: last leaf under a boulder completes → parent completion updates. Add to regression if needed.
3. **RLS verify** — Run two-account test per RLS_VERIFICATION.md; document result in TESTING_CHECKLIST row 5.
4. **Satchel verify** — Fresh UID → open Satchel → 6 empty slots; Pack shows candidates or “No tasks waiting.” Document in TESTING_CHECKLIST row 3b.
5. **First Blockage** — Confirm migration `20250320000004_first_blockage_refactor.sql` is applied in target environment so nested Climb boulders don’t leave users stuck.
6. **Error boundaries** — Confirm SanctuaryErrorWidget and ErrorWidget.builder catch red screens and offer themed Retry.
7. **Sound toggle** — Audit all play paths; manual test: sound off → no playback anywhere (including Hearth ambient if present).
8. **Offline messaging** — Centralize “no connection” copy and retry on Scroll, Satchel, Whetstone.
9. **Realtime cleanup** — Dispose Realtime channels on logout/background.
10. **Smoke tests** — Run `integration_test/synthetic_users/synthetic_user_test.dart` before any release; keep app installed for manual QA when needed.
11. **Loading consistency** — Apply Waiting/dimmed HearthSparkPainter pattern to Scroll, Satchel, Whetstone, Archive.
12. **Semantics** — ExcludeSemantics for sparks; Pack/Burn/New Journey/Hammer/Whetstone labels for screen readers.
13. **withOpacity fix** — Replace remaining `withOpacity` in sanctuary_screen.dart (line 294) with `withValues(alpha: …)`.
14. **Deferred bugs** — When touching related code, revisit BUGS_DEFERRED_TO_PHASE.md and fix or close items (e.g. Satchel untitled).
15. **Docs sync** — After large features, update ARCHITECTURE, CONVENTIONS, MASTER_PLAN.
16. **Mallet integration test** — Add test for Map → Architect → mallet drop (boulder/pebble creation).
17. **Release path** — Full TESTING_CHECKLIST on physical device; 60fps check; app icons/splash; store assets; build appbundle/ipa; TestFlight and Google Play Internal.

---

## 7. Polishing

Visual/UX polish. Apply when touching related code; gatekeepers first.

| Polish | Location / note |
|--------|------------------|
| **Design tokens** | Formalize and document: nav row spacing 12px, min touch 44×44, secondary font 12, primary button min width 100px. See VOYAGER_SANCTUARY_UI_AUDIT §8. |
| **Contextual haptics** | Light for pebble complete, medium for last of landmark, heavy for last of mountain/burn. |
| **Copy** | Elias: short sentences, metaphor, ~80 chars for bubbles (ELIAS_VOICE_GUIDE). Step descriptions: Step 4 explain phase/marker; Step 5 “Tap a marker to add pebbles”; Identity “This name appears on your map.” |
| **Bubble on tap only** | Elias speech bubble only after user tap (and after closing a popup), not when opening overlays. |
| **Elias 7+ days** | “The weeds are tall on that northern peak…” when mountain untouched 7+ days; wire to MountainMomentum.isUntouched. |
| **Step descriptions** | Already done per HEALTH_AND_IMPROVEMENTS; keep when adding new steps. |
| **Deferred bugs** | When touching Satchel, Edit overlay, or wizard: fix “(untitled)” for unnamed pebbles and any other BUGS_DEFERRED_TO_PHASE items in that area. |
| **Wizard nav** | Shared _WizardNavRow and Sanctuary Lexicon (.cursor/rules/sanctuary-lexicon.mdc) are done; preserve and reuse. |
| **Return to Sanctuary** | FittedBox/minWidth so label doesn’t wrap (“Sanctuar-y”); minWidth ~120px or shorter label if needed. |
| **Button labels** | Fixed short labels in wizard (“Next Marker”, “Pack Journey”, “Place & Next”); no random EliasDialogue strings as button text. |

---

**End of GEMINI_RECOMMENDATIONS.**
