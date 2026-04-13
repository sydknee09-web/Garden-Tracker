# Pre-Test Audit Report — Voyager Sanctuary

**Date:** 2026-03-19 (Cursor automated pass)  
**Scope:** `voyager_sanctuary/` — build, assets, routing, theme, audio, dialogue, repos, lint.

---

## 1. Build & Analysis

| Check | Status | Notes |
|-------|--------|--------|
| `flutter clean` + `flutter pub get` | ✅ | Completed; note: `.dart_tool` delete may warn if IDE locks files (non-blocking). |
| `flutter analyze` | ✅ | **No issues found** (after brace fixes post-`dart format`). |
| `flutter test` | ✅ | **55 tests passed** (`data_layer_test`, `provider_test`, `time_of_day_test`, `widget_test`). |
| Deprecated `showDialog` / `showModalBottomSheet` | ✅ | No `useRootNavigator: false` / legacy patterns flagged; standard Flutter 3 APIs in use. |

**Fixes applied during audit:** Wrong `Image.asset` paths for **mallet** (`assets/ui/mallet.png`) and **scroll rollers** (`assets/ui/scroll_*.png`); `dart format lib/` + **curly_braces_in_flow_control_structures** fixes in 6 files.

---

## 2. Asset Integrity

| Check | Status | Notes |
|-------|--------|--------|
| `pubspec.yaml` entries | ⚠️ | **43** unique asset paths (not 41); **no duplicates**. |
| All listed files exist on disk | ✅ | Verified via PowerShell `Test-Path` for each `pubspec` line. |
| Checklist vs repo | ⚠️ | **Differences from your 41-item list:** |
| | | • **No** `assets/satchel_background.png` — app uses **`assets/satchel/satchel_texture.png`** for Satchel backdrop. |
| | | • **No** `assets/images/wood_plank.png` in `pubspec` — **file missing** in workspace; `satchel_screen.dart` references it → **`errorBuilder` shows solid fallback** (OK functionally, add asset + pubspec for production polish). |
| | | • **Elias:** 18 entries under `assets/elias/` (intro pathway + 16 character sprites + `elias_cheering.png`). |
| | | • **Optional sounds:** `AppAudioService` references **`scroll_close.wav`/`.mp3`** — **not** in `pubspec`; try/catch falls back silently (OK). |
| | | • **`forest_threshold.png`** — referenced by `ForestThresholdWrapper` default; **not in pubspec**, file **missing** → `errorBuilder` → empty (OK). |

---

## 3. `Image.asset()` Error Handling

| Area | Status | Notes |
|------|--------|--------|
| `sanctuary_background.dart` | ✅ | `errorBuilder` → gradient fallback. |
| `satchel_screen.dart` | ✅ | Open/closed satchel, wood plank, stones, leather backdrop, strike UI — all have `errorBuilder` or parent handling. |
| `elias_silhouette.dart` | ✅ | `errorBuilder` → `_EliasPainter` silhouette. |
| Hearth frames | ✅ | `sanctuary_screen.dart` `_HearthImage` → `_HearthFallback`. |
| `forest_crossroads_welcome_screen.dart` | ✅ | `errorBuilder` → `Icon`. |
| `forest_threshold.dart` | ✅ | `errorBuilder` → `SizedBox.expand()`. |
| `climb_flow_overlay.dart` (mallet) | ✅ | `errorBuilder` → `Icon`. |
| `scroll_map_screen.dart` (rollers) | ✅ | `errorBuilder` → `SizedBox.shrink()`. |
| Other sanctuary/stone images | ✅ | Spot-checked — `errorBuilder` present. |

---

## 4. Routing & Navigation (`lib/app.dart`)

| Check | Status | Notes |
|-------|--------|--------|
| `AppRoutes` | ✅ | `/`, `/auth`, `/profile-gate`, `/forest-welcome`, `/intro`, `/sanctuary`, `/scroll`, `/satchel`, `/whetstone`, `/archive`, `/settings`, `/credits`. |
| User doc “/scroll-map” | ⚠️ | Canonical path is **`/scroll`** (Scroll Map). |
| Nested route | ✅ | `/scroll/:mountainId` → `MountainDetailScreen`. |
| Orphan routes | ✅ | `/intro` used from `ForestCrossroadsWelcomeScreen` (`postForest=1`). |
| GoRouter redirect | ✅ | Unauthenticated + protected → `/auth`; authenticated on `/auth` or `/` → `/profile-gate`. **First-run flow** is driven by **`ProfileGateScreen`** → `forestWelcome` vs `sanctuary` using `profile.hasSeenEliasIntro`, not solely by `AppRoutes` redirect. |
| Back button traps | ⚠️ | `IntroScreen` / `EliasIntroOverlay` use **`PopScope(canPop: false)`** during intro — intentional; fresh users cannot “back” out of intro without completing/skipping where allowed. |

---

## 5. First-Run Flags & Providers

| Check | Status | Notes |
|-------|--------|--------|
| `hasSeenForestCrossroadsWelcomeProvider` | ✅ | `first_run_provider.dart` |
| `hasSeenQuestStep1Provider` / `hasSeenQuestStep3Provider` | ✅ | Used in sanctuary quest bridge |
| `hasSeenSanctuaryHomeIntroProvider` | ✅ | **Still written** on intro completion; **does not drive UI** (overlay removed). |
| `firstRunProvider` (single gate) | ❌ | **No aggregate `firstRunProvider`** — logic split across `profile.hasSeenEliasIntro` + prefs keys (by design). |
| SharedPreferences | ✅ | Keys centralized in `first_run_provider.dart` for listed flags; other prefs may exist elsewhere (e.g. time-of-day). |

---

## 6. Button & Theme Consistency

| Check | Status | Notes |
|-------|--------|--------|
| `app_theme.dart` | ✅ | `FilledButton` / `ElevatedButton` ember pill, parchment label, Georgia; `TextButton` ember; `OutlinedButton` parchment + border; disabled → `emberMuted`. |
| Hardcoded overrides | ⚠️ | Some **`FilledButton.styleFrom(padding: …)`** only (theme merge). Occasional **dialog `TextButton`** with explicit `AppColors` on parchment — intentional contrast. |
| Material blue/red/green | ✅ | No primary `Colors.blue` / `Colors.green` / `Colors.red` for CTAs in audited paths. |

---

## 7. Typography

| Check | Status | Notes |
|-------|--------|--------|
| Georgia / theme | ✅ | `AppTheme` text themes + widespread `fontFamily: 'Georgia'`. |
| `elias_typography.dart` | ⚠️ | **Not imported everywhere** — many screens use inline `TextStyle(fontFamily: 'Georgia')`; acceptable but not DRY. |
| Typewriter | ✅ | Climb wizard uses `TypewriterText`; forest welcome uses typewriter-style reveal; intro overlay uses beat/step pacing (not always `TypewriterText` widget for every line — verify UX in device test). |

---

## 8. Color Palette

| Check | Status | Notes |
|-------|--------|--------|
| `AppColors` | ✅ | Charcoal, parchment, whetPaper/whetLine, ember/emberPressed/emberMuted, darkWalnut, etc. |
| Material primaries | ✅ | No bright Material button colors in theme. |

---

## 9. Audio (`lib/core/audio/app_audio_service.dart`)

| Check | Status | Notes |
|-------|--------|--------|
| Scroll open | ✅ | `.mp3` then `.wav`; `debugPrint` in `kDebugMode` on total failure. |
| Scroll close | ✅ | `.wav` then `.mp3`; same pattern. |
| User checklist (stone_drop, weight, celebration, whetstone, app_open) | ⚠️ | **Not all in this service** — much audio still uses **`audioplayers`** + `AssetSource` in feature files (e.g. sanctuary SFX). **No single `app_audio_service` constants file** for those. |
| Hardcoded paths | ⚠️ | Strings inline in `AppAudioService`; consider `AudioAssets` class for maintainability. |

---

## 10. Elias Dialogue (`elias_dialogue.dart`)

| Check | Status | Notes |
|-------|--------|--------|
| `_hammerPrompt`, `_afterHammerStrike`, `_streakFrozen`, `_onMovement` | ✅ | Present + public accessors. |
| `firstLandQuestStep1` / `firstLandQuestStep3` | ✅ | |
| Intro beats + post-mountain / post-whetstone | ✅ | |
| Placeholder copy | ✅ | No `TODO` / `Lorem` in audited pools (spot-check). |

---

## 11. Data Models

| Check | Status | Notes |
|-------|--------|--------|
| `mountain`, `node`, `profile`, `satchel_slot`, `whetstone_completion` | ✅ | Under `lib/data/models/`. |
| Demo parity | ⚠️ | Demo storage mirrors shapes; full field-by-field parity not re-audited line-by-line in this pass. |

---

## 12. Repositories & Services

| Check | Status | Notes |
|-------|--------|--------|
| Supabase repos | ✅ | `mountain`, `node`, `profile`, `satchel`, `whetstone` repositories present. |
| Demo repos | ✅ | `demo_*` counterparts in `lib/data/demo/`. |
| `supabase_service` | ⚠️ | Not exhaustively re-read; relies on existing integration (see `SUPABASE_AUTH_TEST.md`). |
| Audio fallbacks | ✅ | `AppAudioService` + feature-level try/catch on `audioplayers`. |

---

## 13. Console & Logging

| Check | Status | Notes |
|-------|--------|--------|
| `print(` in `lib/` | ✅ | **None** found. |
| `debugPrint` | ⚠️ | Present in `bootstrap`, repos, `auth_screen`, `app_audio_service`, etc. — mostly errors / debug-only paths. |

---

## 14. Firebase

| Check | Status | Notes |
|-------|--------|--------|
| `firebase_options.dart` | ✅ | File exists (FlutterFire). |
| Correctness of IDs | ⚠️ | **Not validated** in this pass — confirm in Firebase console + target platforms. |
| Crashlytics | ⚠️ | Not verified in this audit. |

---

## 15. Lint & Format

| Check | Status | Notes |
|-------|--------|--------|
| `dart format lib/` | ✅ | Run; 87 files touched. |
| `flutter analyze` after format | ✅ | Clean after brace fixes. |

---

## Summary Table

| # | Section | Result |
|---|---------|--------|
| 1 | Build & Analysis | ✅ |
| 2 | Asset Integrity | ⚠️ (count/paths vs checklist; optional files) |
| 3 | Image.asset errorBuilder | ✅ |
| 4 | Routing | ✅ (⚠️ `/scroll` naming, intro PopScope) |
| 5 | First-run flags | ⚠️ (no single `firstRunProvider`) |
| 6 | Buttons & theme | ✅ |
| 7 | Typography | ⚠️ |
| 8 | Colors | ✅ |
| 9 | Audio service | ⚠️ |
| 10 | Elias dialogue | ✅ |
| 11 | Models | ✅ |
| 12 | Repositories | ✅ |
| 13 | Logging | ⚠️ |
| 14 | Firebase | ⚠️ |
| 15 | Format / analyze | ✅ |

## Final Verdict (this report)

**READY FOR FRESH-USER TESTING** with **non-blocking follow-ups**:

1. Add **`assets/images/wood_plank.png`** + pubspec entry when art is ready (currently fallback only).  
2. Optionally add **`scroll_close`** + **`forest_threshold`** assets for richer polish.  
3. Confirm **Firebase** options and **Crashlytics** on release builds.  
4. Run **device** test for intro **back** behavior and **audio** on real hardware.

---

*Next: see `GEMINI_AUDIT_REPORT.md` (secondary structural review) and `FINAL_PRE_TEST_REPORT.md` (consolidated).*
