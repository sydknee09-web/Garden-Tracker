---
name: Voyager combined plan
overview: Combined plan merging (1) Elias presentation model and doc alignment, (2) Whetstone Satchel single action (Sharpen Habits only), (3) Whetstone intro default vs choose-for-me, and (4) Intro sanctuary background and Elias variation. Single execution order for code, docs, and conventions.
todos: []
isProject: false
---

# Voyager Sanctuary — Combined Plan

**Sources merged:** Elias presentation and doc alignment; Whetstone Satchel single action; Whetstone intro default vs choose-for-me; Intro sanctuary background (5f222568).

---

## Part A — Elias Presentation and Doc Alignment

### A.1 Unified Elias Presentation Model

**Deliverable:** New [docs/ELIAS_PRESENTATION.md](ELIAS_PRESENTATION.md).

- **Purpose:** Single source of truth for when to use each Elias visual treatment; eliminates UI whiplash when adding new dialogue contexts.
- **Reference:** Link to [ELIAS_DIALOGUE_REFERENCE.md](ELIAS_DIALOGUE_REFERENCE.md) for content; this doc governs *visual treatment* only.

**Table:**

| Mode | Visual Style | Context |
|------|--------------|---------|
| **Cinematic** | Plain typewriter text on gradient | 5-Beat Intro, Lore beats |
| **Modal** | `_EliasParchmentDialog` (centered) | Post-wizard / Whetstone confirmations |
| **Character Bubble** | Speech bubble with tail to Elias | Sanctuary tapping (general interaction) |
| **Targeted Bubble** | Parchment bubble with tail to UI element | Whetstone / Satchel control callouts (Sharpen Habits only) |

**Additional in ELIAS_PRESENTATION.md:** "When adding new dialogue" rule (choose one of four modes by context); code refs (`elias_intro_overlay.dart`, `sanctuary_screen.dart` `_SpeechBubble`, `whetstone_choice_overlay.dart`); note that Whetstone *intro* setup uses inline prompt text in the bottom sheet, not a separate bubble.

**Cross-link:** In [CONVENTIONS.md](CONVENTIONS.md) add: "Elias dialogue presentation: see [ELIAS_PRESENTATION.md](ELIAS_PRESENTATION.md) for which visual mode to use (Cinematic, Modal, Character Bubble, Targeted Bubble)."

### A.2 Naming and Status — Intro

- Replace **IntroSequenceScene** / **elias_introduction_overlay.dart** with **EliasIntroOverlay** / **elias_intro_overlay.dart** in: ELIAS_INTRODUCTION_SPEC, ELIAS_DIALOGUE_REFERENCE, BUILD_ALIGNMENT_PLAN, PROJECT_PLAN_REFINE_AND_POLISH, CURSOR_REFINE_AND_POLISH_PROMPT, Completed/PROJECT_PLAN_REFINE_AND_POLISH.
- **BUILD_ALIGNMENT_PLAN:** Remove "Intro screen | Placeholder only". Add **Intro flow** | Done (5-beat, typewriter, name, wizard, Whetstone setup, has_seen_elias_intro); **Intro visuals** | Partial/Deferred (Forest Threshold, pose variants, parallax). Phase C: C.1 → EliasIntroOverlay; mark C.1–C.5 Done; C.6–C.7 pending.
- **Forest Threshold vs intro background:** **Forest Threshold** = the cold start ("The Curtain") — dense forest image that fades before the intro. **D.1 sanctuary background** = the time-of-day "Stage" (The Setting) behind Elias during the intro. Keep the distinction explicit in docs.

### A.3 Whetstone Intro — Inline prompt (not bubble)

- **PROJECT_PLAN_REFINE_AND_POLISH** (and Completed): Change "speech bubbles" / "speech bubble" for Whetstone setup to **inline prompt text in the bottom sheet** (e.g. "What small ritual keeps you steady?"); prompt at top of Whetstone intro sheet. Optional: "(used as inline prompt in sheet, not a separate bubble)" on copy bullet.

### A.4 Master Plan Hierarchy

- **CONVENTIONS.md:** Add subsection **Plan document hierarchy**: Canonical = MASTER_PLAN.md; Derived views = BUILD_ALIGNMENT_PLAN, HEALTH_AND_IMPROVEMENTS, PROJECT_PLAN_REFINE_AND_POLISH (must stay consistent; MASTER_PLAN wins).
- **MASTER_PLAN.md:** Add at top: "**Doc hierarchy:** This plan is canonical. BUILD_ALIGNMENT_PLAN, HEALTH_AND_IMPROVEMENTS, and PROJECT_PLAN_REFINE_AND_POLISH are derived views; see CONVENTIONS § Plan document hierarchy."
- **Optional:** Add "**Derived from:** MASTER_PLAN.md" in BUILD_ALIGNMENT_PLAN, HEALTH_AND_IMPROVEMENTS, PROJECT_PLAN_REFINE_AND_POLISH.

---

## Part B — Whetstone Satchel Single Action (Sharpen Habits Only)

**Rule:** Whetstone in Satchel has **one** action: **Sharpen Habits**. Refine Path (Edit flow) is on the Map (Scroll / Peak Detail).

### B.1 Code

- **whetstone_choice_overlay.dart:** Remove "Refine path" button and all `onRefinePath`; keep Elias + bubble, "Sharpen Habits" (→ `/whetstone`), "Close". Remove `onRefinePath` from `_PopContent` and from the callback passed from the overlay. Update file header: overlay offers only Sharpen Habits; Refine/Edit from Map (Peak Detail). No `refineModeProvider` / `node_provider` in this file.
- **satchel_screen.dart:** Remove `ref.read(refineModeProvider.notifier).state = false` if only used for Refine-via-Satchel; otherwise keep. No other changes.
- **node_provider.dart / app.dart:** Keep `refineModeProvider` in the codebase. Mark as **Deprecated/Unused** in code comments: no longer triggered by Satchel; retained to support future "Global Refine" features. Leave `ref.listen(refineModeProvider, ...)` in app.dart as-is.

### B.2 Docs — Satchel Whetstone = Sharpen Habits only

Update all references to "two choices" or "Refine Path" in Satchel Whetstone to **Sharpen Habits only; Refine on Map.**

| Doc | Change |
|-----|--------|
| WHETSTONE_CHOICE_OVERLAY_SPEC | Choice = one path: Sharpen Habits. Empty Satchel: suggest Map to refine or add stone. Checklist: only Sharpen Habits → `/whetstone`. |
| ELIAS_DIALOGUE_REFERENCE | Satchel Whetstone: "Single choice: Sharpen Habits." Note `whetstone_refine_nudge` for Map/Refine only if needed. |
| NAVIGATION_MAP | Whetstone tile: Sharpen Habits only; Refine/Edit on Map (Peak Detail, tap node). |
| BUILD_ALIGNMENT_PLAN | C.7: Sharpen Habits only. |
| MASTER_PLAN | 5.1, Build Out 8: Sharpen Habits only; Refine on Map. |
| PROJECT_PLAN_REFINE_AND_POLISH | Sharpen Habits only; Refine from Map. |
| FEATURE_RECOMMENDATIONS_GAMIFIED_EXPERIENCE | §3.5: Sharpen Habits; Refine Path on Scroll/Map. |
| HEALTH_AND_IMPROVEMENTS | Item 53: Sharpen Habits only; Refine on Map. |
| FEATURES_EXPANSION_DOC | §10: one choice (Sharpen Habits); Refine from Map. |
| ASSET_INVENTORY | "Daily habits (Sharpen Habits)." |
| Completed/PROJECT_PLAN_REFINE_AND_POLISH | Same. |
| Completed/PHASE_1_IMPLEMENTATION_PLAN | Refine entry from Map (Peak Detail, tap node to Edit). |
| Completed/PHASE_2_IMPLEMENTATION_PLAN | Whetstone overlay: Sharpen Habits only. |

### B.3 Dialogue / testing

- Keep `whetstoneEntry()`, `whetstone_habit_nudge()`. `whetstoneRefineNudge()` stays for Map/Refine or mark "Map/Refine flow only" in ELIAS_DIALOGUE_REFERENCE.
- Integration test: whetstone_journey taps "Sharpen Habits"; remove any "Refine path" expectation. Manual: overlay one action + Close; Map → Peak Detail → tap node → Edit works.

### B.4 ELIAS_PRESENTATION.md

When created (Part A.1), add under Targeted Bubble: Whetstone (Satchel) = Sharpen Habits only; Refine/Edit is on the Map.

---

## Part C — Whetstone Intro Default vs Choose-for-Me

**Intended behavior:** Default = user input (no pre-fill). Starter habits only when user taps "Let Elias pick for me."

**Current implementation:** whetstone_intro_setup_sheet.dart already correct: `initState()` one empty controller; `_onContinue()` reads fields only; `_letEliasPick()` fills from `WhetstoneRepository.starterHabits` when user taps the button.

**Optional:** Add a one-line comment in the state class: *"Habits default to user input; starter habits are only applied when the user taps 'Let Elias pick for me'."* No logic changes.

---

## Part D — Intro Sanctuary Background and Elias Variation

### D.1 Show sanctuary background behind Elias on intro

**Problem:** First-run intro shows only a dark green gradient; users expect the same time-of-day sanctuary background as the main Sanctuary screen.

**Approach:**

1. **Extract shared sanctuary background**
   - **New:** `lib/widgets/sanctuary_background.dart` — time-of-day blend, asset paths (`sunrise.jfif`, `midday.jfif`, `dusk.jfif`, `night.jfif`), gradient fallback. `ConsumerWidget` watching `currentTimeForBackgroundProvider`. Move from sanctuary_screen.dart: `_Background`, `_GradientFallback`, `_backgroundOpacitiesFor`, `_backgroundAssetFor`, `_fallbackGradientFor` → rename to `SanctuaryBackground`.
   - **Sanctuary screen:** Replace `_Background()` with `SanctuaryBackground()`; remove in-file background helpers.
2. **Use in intro overlay**
   - elias_intro_overlay.dart: `Stack` — layer 1 wrap `SanctuaryBackground()` in **RepaintBoundary** (full-screen), layer 2 existing gradient `Container` at reduced opacity (e.g. 0.3–0.5) or drop gradient if assets have enough contrast, layer 3 existing SafeArea + content. RepaintBoundary prevents expensive background repaints during typewriter animations.
3. **Entrance screen:** Update entrance_screen.dart to use `SanctuaryBackground`; remove local `_DayPeriodBackground` and `_backgroundAssetFor` so the environment has a single source of truth.
4. **Assets:** Same `assets/backgrounds/` paths as sanctuary; no new routes.

### D.2 Vary Elias in the intro (pose / closer-up)

**Goal:** Break "same same" feel; use talking-face/closer-up or expressive pose variants on 2–3 steps.

**Approach:**

1. **EliasWidget pose override** — elias_silhouette.dart: add optional `assetPathOverride` (or `EliasPose?`). When set, use that asset; fall back to `period.eliasAssetPath` on error.
2. **Map steps to pose/size** — In elias_intro_overlay.dart: **Beat 2 (name prompt):** welcoming or period pose. **Beat 3 (name confirmation):** use `elias_explaining_gesture` to pair with the "lighten the load" dialogue. Beats 1, 4–5: period or `elias_welcoming` / `elias_guide_pose`; Beat 5 optionally larger size (e.g. 140×196). Tune exact mapping.
3. **The Anchor Rule** — When scaling Elias (1.3–1.5×), ensure the baseline (feet) remains stable at the bottom of the viewport or use a subtle bottom-fade so a scaled-up torso does not look like a floating sticker.
4. **Assets:** Optional in `assets/elias/` (e.g. `elias_explaining_gesture.png`, `elias_guide_pose.png`, `elias_welcoming.png`); fallback to period pose if missing.

### D.3 Copy and UX polish (intro)

- **Intro beat 1:** elias_dialogue.dart — add line break after ellipsis, remove "but": `'...\nthe mountains never forget...'`. Sync ELIAS_INTRODUCTION_SPEC, ELIAS_DIALOGUE_REFERENCE, elias_voice_guide.yaml.
- **Intro beat 2:** Revise `introBeat2` (shorter/warmer or from ELIAS_INTRO_OPTIONS); update same docs.
- **Name confirmation:** Rephrase so "lighter" = load/burden, not name: e.g. "lighten the load" or "carry a little less"; sync ELIAS_INTRODUCTION_SPEC, ELIAS_NAME_CAPTURE_RECOMMENDATIONS.
- **Stagger name prompt:** Dialogue first, then after ~800–1500 ms fade/slide in TextField + Continue (already has `_showNameInput` + timer in elias_intro_overlay; verify delay and AnimatedOpacity/AnimatedSlide).
- **Keyboard covers name field:** Wrap intro in `Scaffold` with `resizeToAvoidBottomInset: true`; on name-prompt step wrap content in `SingleChildScrollView` with bottom padding `MediaQuery.viewInsetsOf(context).bottom + 24` so field stays above keyboard. Ensure **Elias (face and shoulders) remains visible** above the keyboard so the "human touch" connection is maintained during name entry. File: elias_intro_overlay.dart.
- **Intro dialogue underline:** Remove or soften yellow/sage underline on intro text and "Tap to continue" (remove `decoration`/`decorationColor` or use muted color).

### D.4 Foundation (dialogue card + docs) — High-Value Optional

- **Shared dialogue component:** Extract **EliasDialogueCard** (or reuse pattern) in e.g. `lib/widgets/elias_dialogue_card.dart` — whetPaper, whetLine, shadow, EliasTypography, optional tail. Migrate Sanctuary, intro dialog, entrance, climb/whetstone where it's just a message. **Scope:** Significant refactor. If momentum is high after background/pose fixes, do it; if the intro feels solid without it, defer to Post-V1 Polish.
- **Docs:** Dialogue presentation section (in ELIAS_PRESENTATION or ELIAS_UI_PATTERNS): (a) Legibility rule — dialogue on dedicated surface, never bare light text on art; (b) Standard component / tokens; (c) Link to shared widget and AppColors.

### D.5 Optional polish (intro)

- Light gradient overlay on intro if sanctuary images are dark (for text readability).
- Dialogue font 16–18pt if revisiting legibility.
- Hearth beat: optional warmer glow on Beat 5; defer if scope tight.
- Entrance speech readability: already done (speech-bubble-style container per plan).

---

## Part E — Refinements and Structural Gaps

### E.1 Background and performance (D.1 extension)

- **Entrance screen source of truth:** entrance_screen.dart will be updated to use the new `SanctuaryBackground` widget, removing its local `_DayPeriodBackground` logic so the environment has a single source of truth.
- **Performance:** In the EliasIntroOverlay `Stack`, `SanctuaryBackground()` must be wrapped in a **RepaintBoundary** to prevent the background from expensive repaints during typewriter text animations.

### E.2 Elias pose and proportions (D.2 extension)

- **Step-specific poses:** **Beat 2 (name prompt):** Use welcoming or period pose. **Beat 3 (name confirmation):** Use `elias_explaining_gesture` to pair with the "lighten the load" dialogue.
- **The Anchor Rule:** When scaling Elias (1.3–1.5×), the widget must ensure the baseline (feet) remains stable at the bottom of the viewport or use a subtle bottom-fade to prevent a "floating torso" look.
- **Keyboard visibility:** The SingleChildScrollView implementation must ensure Elias's face and shoulders remain visible above the keyboard height to maintain the "human touch" during name entry.

### E.3 Architecture and state (B.1 and doc extension)

- **refineModeProvider status:** Since "Refine Path" is removed from the Satchel in favor of the Map/Peak Detail edit flow, `refineModeProvider` will be marked **Deprecated/Unused** in code comments. Keep it in the codebase to support future "Global Refine" features; it will not be triggered by the Satchel.
- **Plan location:** The Voyager Combined Plan will be moved to voyager_sanctuary/docs/voyager_combined_plan.md to sit alongside the canonical documentation tree.

### E.4 Doc update order

- **Step 4:** Naming only — replace IntroSequenceScene / elias_introduction_overlay in the six listed docs; no logic or table changes.
- **Step 7:** Logic and table changes — all B.2 (and other table) doc updates so a naming pass does not obscure spec/logic edits.

---

## Execution order

1. **Create** ELIAS_PRESENTATION.md (A.1 + B.4 note).
2. **Update** CONVENTIONS.md (Elias presentation link + Plan document hierarchy, A.4).
3. **Update** MASTER_PLAN.md (doc hierarchy line, A.4).
4. **Naming only (A.2):** IntroSequenceScene → EliasIntroOverlay, elias_introduction_overlay → elias_intro_overlay in the six docs only. No logic or table changes in this step.
5. **Update** BUILD_ALIGNMENT_PLAN (intro rows, Phase C, C.7 Sharpen Habits only, optional Derived from) (A.2, B.2).
6. **Update** PROJECT_PLAN_REFINE_AND_POLISH and Completed (Whetstone inline prompt, Sharpen Habits only) (A.3, B.2).
7. **Update remaining docs (logic/table changes):** ELIAS_INTRODUCTION_SPEC, ELIAS_DIALOGUE_REFERENCE, NAVIGATION_MAP, FEATURE_RECOMMENDATIONS, HEALTH_AND_IMPROVEMENTS, FEATURES_EXPANSION_DOC, ASSET_INVENTORY, Completed/PHASE_1, Completed/PHASE_2, CURSOR_REFINE_AND_POLISH_PROMPT per tables in B.2 and elsewhere.
8. **Code (B.1, E.3):** whetstone_choice_overlay.dart (remove Refine path, onRefinePath); satchel_screen.dart (refineMode reset if applicable); node_provider.dart (mark refineModeProvider Deprecated/Unused in comments).
9. **Intro background (D.1, E.1):** Create `lib/widgets/sanctuary_background.dart`; move background logic from sanctuary_screen.dart; use `RepaintBoundary(child: SanctuaryBackground())` in elias_intro_overlay.dart; update entrance_screen.dart to use SanctuaryBackground and remove local background logic.
10. **Elias variation (D.2, E.2):** Add optional pose/asset override to elias_silhouette.dart; in elias_intro_overlay.dart use step-specific poses (Beat 2 welcoming/period, Beat 3 explaining_gesture) and anchor rule when scaling; ensure Elias visible above keyboard on name step.
11. **Intro copy and UX (D.3):** Beat 1 (line break, remove "but"); Beat 2 (revise); name confirmation ("lighten the load"); verify name-prompt stagger; Scaffold + SingleChildScrollView + viewInsets + Elias visible; remove or soften intro underline.
12. **Optional:** Comment in whetstone_intro_setup_sheet.dart (C); "Derived from" in HEALTH_AND_IMPROVEMENTS / CURSOR_REFINE_AND_POLISH_PROMPT (A.4); shared EliasDialogueCard (D.4 — High-Value Optional, defer to Post-V1 Polish if intro feels solid); intro optional polish (D.5).
13. **Plan location (E.3):** Move this combined plan to voyager_sanctuary/docs/voyager_combined_plan.md.
