# Voyager Sanctuary — Consolidated Recommendations (Build Mode)

**Purpose:** Single reference for build-mode priorities: coding updates, gaps, outstanding questions, feature expansion, general recommendations, outstanding tasks, polishing, and a **release-readiness / gatekeeper checklist** with concrete verification steps.  
**Context:** App shipped to testers (Firebase App Distribution v0.1.1+15) with Elias dialogue audit, build fixes, and Firebase config committed. This doc reflects that state and provides a fresh prioritized “do next” order.  
**Source:** [GEMINI_APP_HANDOFF.md](GEMINI_APP_HANDOFF.md), [GEMINI_RECOMMENDATIONS.md](GEMINI_RECOMMENDATIONS.md), [BUILD_GUIDANCE.md](BUILD_GUIDANCE.md), [MASTER_PLAN.md](MASTER_PLAN.md), [HEALTH_AND_IMPROVEMENTS.md](HEALTH_AND_IMPROVEMENTS.md), [GAPS_AND_ASSUMPTIONS.md](GAPS_AND_ASSUMPTIONS.md), [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md), [RLS_VERIFICATION.md](RLS_VERIFICATION.md).  
**Stance:** Cozy, ritual, Japandi. Gatekeepers (data safety and narrative) before heavy polish.

---

## 1. Coding updates

Concrete code-level changes. Items marked **Done** reflect recent shipped work (handoff §3); **Verify** items should be confirmed on next pass.

| Area | Change | File / location | Status |
|------|--------|------------------|--------|
| **Deprecated API** | Replace `withOpacity` with `withValues(alpha: …)`. | `lib/features/sanctuary/sanctuary_screen.dart` (glow/pulse). | **Done** (shipped) |
| **Unused imports** | Remove unused imports. | `lib/bootstrap.dart` (e.g. `demo_mode_provider`); `lib/features/auth/auth_screen.dart` (`go_router`, `app.dart`). | **Done** (shipped) |
| **Dead code** | Remove unused elements. | `elias_intro_overlay`: `gradientColors`, `isHearthBeat`; `whetstone_choice_overlay`: `bubbleSpacing` used in `totalContentHeight` or removed. | **Done** (shipped) |
| **Elias dialogue** | task→stone rewrites; saveFailed/peakJournalArrival; REFERENCE sync. | `lib/core/content/elias_dialogue.dart`; climb_flow, edit_flow, mountain_detail_screen; [ELIAS_DIALOGUE_REFERENCE.md](ELIAS_DIALOGUE_REFERENCE.md). | **Done** (shipped) |
| **Narrow invalidation** | After node-level edits, invalidate only the affected mountain. | `lib/providers/narrow_invalidation.dart` — used from edit_flow_overlay, mountain_detail_screen, sanctuary_screen, climb_flow_overlay. Any new node mutation (e.g. inline title save) must use `invalidateAfterNodeMutation(ref, mountainId)` and must **not** invalidate `mountainListProvider` unless peak-level. | Adopted; verify on new code |
| **Sound check before play** | Every audio play path must respect `soundEnabledProvider`. | Guarded: entrance_screen, scroll_map_screen, app.dart (refine), sanctuary_screen (stone drop), guidance_storybook_overlay. **Verify:** mallet strike, burn moment, Whetstone sound, any new `play()` — add `if (!ref.read(soundEnabledProvider)) return;` before play. | Verify |
| **Display name usage** | Intro Beats 3 & 5, management, Sanctuary use `profile.display_name`; skip/empty → “traveler”. | Intro: `elias_intro_overlay.dart` uses `profile?.displayName?.trim()` for Beats 3 & 5. Management: `management_menu_sheet.dart` uses `EliasDialogue.managementGreeting(… displayName)`. Sanctuary: `sanctuary_screen.dart` uses `EliasDialogue.sanctuaryPeriodGreeting(…, displayName)`. `elias_dialogue.dart`: `defaultTravelerName = 'traveler'`; `managementGreeting` / `sanctuaryPeriodGreeting` return generic when name is null/empty. | Verify on device (§8) |
| **Analyzer** | No remaining unused imports/locals, optional-param warnings. | Run `flutter analyze lib/` and fix any new warnings. | Re-run after changes |

---

## 2. Gaps to address

Missing coverage, edge cases, and technical debt to close before or soon after release.

| Gap | Detail | Action |
|-----|--------|--------|
| **Satchel untitled** | Unnamed pebbles can show blank or confusing. | When touching Satchel UI: show “(untitled)” or “New pebble” when `node.title` is empty. See BUGS_DEFERRED_TO_PHASE; fix when doing Satchel polish. |
| **Demo schema** | Demo mode must support new wizard/peak fields. | Ensure `DemoStorage` / `DemoMountainRepository` / `DemoNodeRepository` support `intent_statement`, `layout_type`, `appearance_style`. `lib/data/demo/demo_profile_repository.dart` already supports `displayName`. Add to checklist when changing wizard or peak creation. |
| **NULL intent / layout** | Existing peaks may have NULL `intent_statement` or `layout_type`. | Bones view: show intent as “(Not set)” or empty, editable. Default `layout_type` to `climb` in reads and UI. Document in CONVENTIONS. |
| **Realtime cleanup** | Mountain and node Realtime channels should be disposed on logout or long idle. | Ensure subscriptions in `node_repository.dart` / mountain repository are cancelled when user signs out or app backgrounds to avoid leaks and battery drain. |
| **RPC fallback logging** | Progress bar at 0% can be migration vs network. | In catch blocks for progress RPCs, use `debugPrint` to distinguish migration-not-applied from network timeout (GAPS_AND_ASSUMPTIONS §18). |
| **Integration tests vs 6-step wizard** | Synthetic user tests may assume older flows. | Update `integration_test/synthetic_users/synthetic_user_test.dart` to use New Journey (Elias or Map FAB), 6-step wizard, and dynamic 1–10 markers when changing creation flow. |

---

## 3. Answers to outstanding questions

Recommended resolution for each open question from the handoff (§4).

| Question | Recommendation |
|----------|----------------|
| **Elias tap: bubble + sheet (A/B/C)?** | **B or C.** Current: tap opens management sheet; bubble was removed on open. Prefer **B** (no message when opening sheet) for consistency. **C** (message on sheet close) is an alternative if Elias should “respond to their choice.” Low priority; test and pick one. |
| **Display name** | Intro Beats 3 & 5 and management/Sanctuary use `profile.display_name`; skip/empty yields “traveler” via `EliasDialogue.defaultTravelerName` and generic branches in `managementGreeting` / `sanctuaryPeriodGreeting`. **Verify on device:** set/clear/skip display name and confirm no break and correct personalization. Demo: `DemoProfileRepository` supports `display_name`. **Gatekeeper.** |
| **Shard completion** | When the last shard under a parent completes, parent completion state must update (migration `20250320000000`). **Verify on device:** complete all leaves under a boulder → parent shows complete. Add to regression if edge cases appear. **Gatekeeper.** |
| **Sound toggle** | All playback must respect `soundEnabledProvider`: Hearth (stone drop, any ambient), mallet strike, burn moment, Whetstone, app/scroll open. When sound is off, app should be **totally silent**. Audit every `play()` / `AudioPlayer` usage; add guard before play. Persists via `sound_settings_provider`. Manual test before release. |
| **Forest Threshold** | Cold start: dense forest image fades to reveal Sanctuary (no spinner). Animation speed linked to `has_seen_elias_intro`: slower first time, quicker for returning users. Implement in `lib/bootstrap.dart` / entry; see ELIAS_INTRODUCTION_SPEC Beat 1. |
| **Offline** | Centralize “no connection” copy and retry behavior. Use the same pattern on Scroll, Satchel, and Whetstone. Document in README/SUPABASE_SETUP. |
| **Semantics** | Use `ExcludeSemantics` for decorative sparks (e.g. `HearthSparkPainter`). Add Semantics labels for Pack (“Pack N pebbles into your satchel”), Burn drop zone, New Journey, Hammer, Whetstone tile so screen readers get clear actions. |
| **Loading** | Standardize loading UI: “Waiting” / dimmed `HearthSparkPainter` (e.g. `sparkTime × 0.3`) on Scroll, Satchel, Whetstone, Archive. Same skeleton or spinner style (theme colors); avoid raw `CircularProgressIndicator` without wrap. |

---

## 4. Feature expansion recommendations

Prioritized feature ideas. Gatekeepers and high-value first; then polish.

| Priority | Feature | Description |
|----------|---------|-------------|
| **P0 (gatekeepers)** | Display name verification | Signed off per §8 checklist before release. |
| **P0** | Shard completion verification | Signed off per §8 checklist before release. |
| **High** | **Branch Removal** | Long-press on Marker (boulder) → “Move to General” (Miscellaneous at bottom of same peak) or “Scatter” (hard delete with Elias confirmation). Per MASTER_LEDGER_ARCHITECTURE_OVERHAUL §6. Next step if building before Ship and Learn (NEXT_STEPS Option B). |
| **High** | **Promote to Marker** | Promote pebble to marker (same peak). Phase 2; not MVP. |
| **Medium** | **Pebble logic UI** | DB has `pebble_logic` (default `freeform`); add toggle UI in Phase 2 for sequential vs freeform within a pebble. |
| **Medium** | **Survey layout (Island/Constellation)** | Phase 1: tree for both Climb and Survey. Phase 2: Island/Constellation visual for Survey. |
| **Medium** | **Satchel pack animation** | Stones “fly” from Map/markers into Satchel on Pack; 500ms arc, 150ms stagger. See SATCHEL_PACK_ANIMATION_SPEC. |
| **Medium** | **Elias idle** | Breathing or blink when Elias is on screen for a few seconds; use `assets/elias/elias_idle` when available (Phase 12). |
| **Polish** | Marker templates | Step 4 “Use template” (e.g. Research/Plan/Execute/Review); add variant if needed. |
| **Polish** | Habit milestones | One-time Elias line or toast at 7, 30, 100 days for Whetstone habits. |
| **Polish** | Elias 7+ days untouched | “The weeds are tall on that northern peak…” when mountain has no burns for 7+ days; wire to `MountainMomentum.isUntouched`. |

---

## 5. General app recommendations

UX, performance, store/release, accessibility, consistency.

| Area | Recommendation |
|------|----------------|
| **UX** | Empty states: one clear next action per screen (Scroll → New Journey; Satchel → Pack or Map; Whetstone → Add habit; Archive → Restore CTA). Consider pull-to-refresh on Scroll and Satchel. |
| **Performance** | Profile on mid-range device; confirm 60fps for Hearth sparks, Satchel animations, scroll. If &lt;55fps after pack animation, use narrow invalidation and reduce particle/anim complexity. Asset precache for new heavy assets (Elias idle, parallax). |
| **Store / release** | Store listing: short/long description, v1.0.0 notes in STORE_LISTING.md. Data Safety/Privacy in DATA_SAFETY_AND_PRIVACY.md; ToS in LEGAL.md. App icons and splash per platform; screenshots and published Privacy/ToS URLs before submission. See TESTING_CHECKLIST Release path. |
| **Accessibility** | Semantics (§3); font scaling via `MediaQuery.textScalerOf(context)`; contrast and focus order for keyboard/switch users; ember/gold on charcoal meets WCAG where it’s the primary action. |
| **Consistency** | Design tokens: nav row spacing 12px, min touch target 44×44, secondary font 12 on mobile, primary button min width 100px. Use whetPaper/whetLine/whetInk consistently (Edit overlay, management, wizard). Night-shift: candlelightTint on Whetstone and Refine in night period (already done). |
| **Dependencies** | Run `flutter pub outdated`; plan upgrade pass for go_router, riverpod, flutter_slidable within compatibility bounds; test after upgrades. |
| **E2E** | Add integration tests for Auth → Sanctuary, Map + Architect (boulder add), Satchel Pack → Hearth burn when capacity allows. |
| **Deep link** | Support `voyagersanctuary://` for password reset so users land in app after reset; document in README and AUTH_PASSWORD_RESET. |

---

## 6. Outstanding tasks

Ordered: **gatekeepers first**, then high-value, then polish. Data safety and narrative before heavy polish.

1. **Display name** — Run §8 checklist (a). Verify intro Beats 3 & 5, management, Sanctuary use `profile.display_name`; skip/empty → “traveler”. Document in TESTING_CHECKLIST or RELEASE_CANDIDATE_SCRIPT.
2. **Shard completion** — Run §8 checklist (b). Verify on device: last leaf under a boulder completes → parent completion updates. Add to regression if needed.
3. **RLS verify** — Run §8 checklist (c). Two-account test per RLS_VERIFICATION.md; document result in TESTING_CHECKLIST row 5.
4. **Satchel verify** — Run §8 checklist (d). Fresh UID → open Satchel → 6 empty slots; Pack shows candidates or “No tasks waiting.” Document in TESTING_CHECKLIST row 3b.
5. **First Blockage** — Confirm migration `20250320000004_first_blockage_refactor.sql` is applied in target environment so nested Climb boulders don’t leave users stuck.
6. **Error boundaries** — Confirm SanctuaryErrorWidget and ErrorWidget.builder catch red screens and offer themed Retry.
7. **Sound toggle** — Audit all play paths; manual test: sound off → no playback anywhere (including Hearth ambient if present).
8. **Offline messaging** — Centralize “no connection” copy and retry on Scroll, Satchel, Whetstone.
9. **Realtime cleanup** — Dispose Realtime channels on logout/background.
10. **Smoke tests** — Run `integration_test/synthetic_users/synthetic_user_test.dart` before any release; keep app installed for manual QA when needed.
11. **Loading consistency** — Apply Waiting/dimmed HearthSparkPainter pattern to Scroll, Satchel, Whetstone, Archive.
12. **Semantics** — ExcludeSemantics for sparks; Pack/Burn/New Journey/Hammer/Whetstone labels for screen readers.
13. **Deferred bugs** — When touching related code, revisit BUGS_DEFERRED_TO_PHASE.md and fix or close items (e.g. Satchel untitled).
14. **Docs sync** — After large features, update ARCHITECTURE, CONVENTIONS, MASTER_PLAN.
15. **Mallet integration test** — Add test for Map → Architect → mallet drop (boulder/pebble creation).
16. **Release path** — Full TESTING_CHECKLIST on physical device; 60fps check; app icons/splash; store assets; build appbundle/ipa; TestFlight and Google Play Internal.

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

## 8. Release-readiness / gatekeeper checklist

Concrete verification steps for the four gatekeepers. Run on a **physical device** with a release-candidate or tester build (e.g. Firebase v0.1.1+15). Format: checkbox steps that can be pasted into [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md).

### (a) Display name

Elias must use the user’s display name in intro Beats 3 & 5, management greeting, and Sanctuary greeting; skip or empty must yield “traveler” (no crash, no blank).

- □ **Step 1:** New account or clear app data; go through Intro. At Beat 3 (name prompt), enter a name (e.g. “River”) and continue. Confirm Beat 5 uses that name (e.g. “River, the path ahead…”).  
- □ **Step 2:** Same run or new: at Beat 3, tap **Continue** without typing (skip). Confirm Beat 5 uses “traveler” or equivalent generic wording, and no crash.  
- □ **Step 3:** At Beat 3, enter only spaces and tap **Continue**. Confirm Beat 5 uses “traveler” or equivalent.  
- □ **Step 4:** After intro, open **Elias → Management** (tap Elias, management sheet). Confirm greeting uses the name you set (e.g. “River”) or “traveler” if skipped/empty.  
- □ **Step 5:** From Sanctuary home, confirm period greeting (e.g. “Good morning, River” or “Good morning, traveler”) uses profile display name or “traveler”.  
- □ **Step 6:** Go to **Settings** → change “What Elias calls you” to empty, save. Re-open Management and Sanctuary. Confirm “traveler” (or generic) is used.  
- □ **Document:** Record result in TESTING_CHECKLIST (e.g. First Five success log or a “Display name” row). Pass = all steps show correct personalization or “traveler” with no crash.

### (b) Shard completion

When the last leaf (shard) under a boulder is completed, the parent boulder’s completion state must update so the UI reflects “all done” for that marker.

- □ **Step 1:** On the Scroll, pick a mountain and open **Mountain Detail**. Ensure you have a boulder with at least two pebbles (or pebble + shards).  
- □ **Step 2:** Complete all but one pebble/shard under that boulder (tap to complete or use Satchel Done then burn). Confirm parent still shows incomplete (e.g. open circle or “in progress”).  
- □ **Step 3:** Complete the **last** pebble/shard under that boulder (e.g. last leaf under the boulder).  
- □ **Step 4:** Confirm the **parent boulder** now shows complete (e.g. checkmark, filled state) without needing to leave and re-enter the screen or pull-to-refresh.  
- □ **Step 5:** If the mountain uses Climb logic, confirm the **next** boulder (or next pebble) becomes available/unlocked as expected.  
- □ **Document:** Record result in TESTING_CHECKLIST (e.g. “Shard completion” row or First Five success log). Pass = last leaf complete → parent updates immediately (or after expected refresh).

### (c) RLS

Two accounts must not see each other’s data. Use [RLS_VERIFICATION.md](RLS_VERIFICATION.md) as the authoritative procedure.

- □ **Step 1:** Follow RLS_VERIFICATION.md **Steps 1–3**: Create and use Account A (create mountain, boulder, pebble; pack Satchel; add Whetstone habit). Note what you see.  
- □ **Step 2:** Sign out. Create or sign in as Account B. Confirm Scroll shows no mountains (or only B’s). Satchel shows empty slots (or only B’s). Whetstone shows no habits/completions from A.  
- □ **Step 3:** (Optional but recommended) Run **Poison-record test** (RLS_VERIFICATION.md §4): insert a row in `mountains` with User B’s UUID, sign in as User A, confirm User A does **not** see “Poison Peak (User B)”. Clean up the poison row.  
- □ **Document:** In TESTING_CHECKLIST **row 5** (RLS), fill **Pass** or **Fail** and date. Reference: “Per RLS_VERIFICATION.md; poison test [done/omitted].”

### (d) Satchel verify

Fresh UID must see 6 empty slots; Pack must show candidates or “No tasks waiting.” Confirms placement logic and no blank/error for new users.

- □ **Step 1:** Use a **fresh account** (new sign-up) or a test account that has never opened Satchel. Do **not** use an account that already has mountains/pebbles unless you first clear satchel_slots in DB for that user.  
- □ **Step 2:** Open the **Satchel** tab/screen immediately after reaching Sanctuary (or after intro).  
- □ **Step 3:** Confirm **6 empty slots** are visible (no blank screen, no crash, no “loading” hang).  
- □ **Step 4:** Tap **Pack**. If the account has no incomplete pebbles on any mountain, confirm message “No tasks waiting” (or equivalent). If there are packable candidates, confirm they fill empty slots in order (filled-first, stone icon per row).  
- □ **Step 5:** Confirm Pack behavior: when slots are full, “Your satchel is full”; when there are candidates, they fill; when none, friendly empty state.  
- □ **Document:** In TESTING_CHECKLIST **row 3b** (Fresh-UID Satchel setup), fill **Pass** or **Fail**, date, and device/build. Pass = 6 empty slots + correct Pack behavior.

---

**End of GEMINI_RECOMMENDATIONS_BUILD. Use §8 as the gatekeeper checklist before release; §§1–7 for coding, gaps, and “do next” order.**
