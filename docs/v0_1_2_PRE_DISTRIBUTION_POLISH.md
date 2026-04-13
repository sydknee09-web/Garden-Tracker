# v0.1.2 PRE-DISTRIBUTION POLISH

**Build after polish:** `0.1.2+19`  
**Goal:** Ship confident to testers (dialogue tone, grace UX, journal clarity).

---

## Completed in repo (March 2026)

### TASK 1: Dialogue tone pass
- [x] Reviewed / tuned v0.1.2 pools in `lib/core/content/elias_dialogue.dart`
- [x] Added third line per period in `timeOfDayGreeting` (stoic, metaphor-led)
- [x] `milestoneBurnStreak7` — less “wellness,” more hearth / discipline
- [x] `firstHabitCompleteMilestone` — removed trailing “Well done.”
- [x] `EliasBurnReflections._starredBurn` — removed “Well done.” phrasing
- [x] `burnStreakGraceTooltip` — copy for Sanctuary tooltip

### TASK 2: Grace day explanation (Option A)
- [x] `Tooltip` on Sanctuary streak chip (`_BurnStreakBanner`) with `EliasDialogue.burnStreakGraceTooltip`
- [x] Small `info_outline` affordance beside flame + long-press / hover shows full text

### TASK 3: Journal UX optional
- [x] `climb_flow_overlay.dart` — “(optional)” label + clearer hints on both reflection dialogs
- [x] Pack journey dialog: **Close** → **Skip** (same behavior, clearer skip path)

### Extra (distribution)
- [x] Burn undo + habit-complete undo SnackBars: **4 seconds** (was 3)

---

## Final checks (run locally)

```bash
flutter analyze
flutter test
flutter build apk --release
```

---

## Firebase App Distribution

Upload **`build/app/outputs/flutter-apk/app-release.apk`** via Firebase Console or your `deploy.ps1` / CI.  
*(Credentials and upload must be done on your machine — not automatable from the IDE.)*

---

## Tester guidance

Share `docs/TESTING_CHECKLIST.md` and note:
- Long-press / hover streak chip for **grace / 4 AM** explanation
- Reflection prompts are **optional** (Skip always available; barrier dismiss on “why peak” flow)

---

## v0.1.3 candidates (from feedback)

| Feedback | Action |
|----------|--------|
| Dialogue repetition | Expand pools |
| 4 AM still confusing | Elias line on first freeze, or rolling 24h |
| Journal feels like chore | Simplify or remove |
| Undo still too fast | 5s SnackBar |
| Habit haptic subtle | `mediumImpact` |
