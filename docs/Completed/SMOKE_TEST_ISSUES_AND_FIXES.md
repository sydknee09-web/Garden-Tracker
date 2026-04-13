# Smoke Test & Synthetic User Test — Issues and Fixes

**Purpose:** Single source of truth for issues identified during smoke/integration test runs, the fix applied, and status. Update this document whenever a new issue is found or a fix is completed.

**Last updated:** March 2026

---

## Issue Log

| # | Issue | Location | Fix | Status |
|---|-------|----------|-----|--------|
| 1 | RenderFlex overflow in _CompactSlot (5px bottom) on narrow screens | `sanctuary_screen.dart` ~965 | Wrapped Column in `FittedBox(fit: BoxFit.scaleDown)`. Switched to `stone_medium.png` per Technical Audit. | Completed |
| 2 | Satchel tap target off-screen (Y=841–889 vs root 823) | `sanctuary_screen.dart` _CompactSatchelTray | Wrapped Layer 3 in LayoutBuilder; tray in ConstrainedBox + FittedBox + SizedBox. `trayMaxHeight = (layerConstraints.maxHeight * 0.15).clamp(70, 120)`. | Completed |
| 3 | Satchel state empty after demo placement | `sanctuary_initialization_provider.dart` | Added `ref.invalidate(satchelProvider)` after placing pebbles into slots. | Completed |
| 4 | complete_task journey fails when satchel full (Pack not found) | `complete_task_journey.dart`, `journey_runner.dart` | Pack step uses `tap_or_skip`; skip when Pack button not visible. | Completed |
| 5 | Satchel tap potentially blocked by overlay | `sanctuary_screen.dart` _CompactSatchelTray | Added `HitTestBehavior.translucent` to Satchel GestureDetector. | Completed |
| 6 | Overflow logged as VisualCollision instead of layout error | `journey_runner.dart` | When exception contains 'overflow', log `action: 'layout_error'`, `note: 'RenderFlex overflow'`. | Completed |
| 7 | add_task journey brittle (icon finders) | `add_task_journey.dart`, scroll_map, climb_flow | Added Semantics(label: 'Template 1'), 'Mountain', 'Boulder', 'Pebble'. Replaced icon finders with `find.bySemanticsLabel()`. | Completed |
| 8 | Test timing too long | `synthetic_user_test.dart` | Reduced pumpAndSettle: 6s→4s initial, 3s→2s after tap. | Completed |
| 9 | complete_task journey not in test suite | `synthetic_user_test.dart` | Added `testWidgets` for completeTaskJourney with power_user_paul. | Completed |
| 10 | No narrow-screen regression test | `synthetic_user_test.dart` | Added Narrow Screen Regression test with `setSurfaceSize(360, 640)`. | Completed |
| 11 | Connection closed / DDS failure during test run | Environment | Device USB, screen unlock, or ADB stability. Not a code fix. Run: `flutter test integration_test/synthetic_users/synthetic_user_test.dart -d R5CW3057XJP` | Environment |
| 12 | All tests "did not complete" at ~02:33 | `synthetic_user_test.dart`, `journey_runner.dart` | Sanctuary has infinite animations (Timer.periodic 50ms, repeat animations). pumpAndSettle never settles. Replaced with `pump()` + `pump(duration)` to advance time without waiting for settle. | Completed |
| 13 | Satchel tap target still off-screen (Y=850–891 vs root 823) | `sanctuary_screen.dart`, `journey_runner.dart`, `synthetic_user_test.dart` | waitForStableTarget debounces slide animation; tapAt(rect.centerRight - 20px) for clean hit; try-catch on addTaskJourneySmoke; adb pull for logs. | Completed |
| 14 | SessionLogger path read-only on device | `session_logger.dart` | Integration tests run on device; project path not writable. Use path_provider getTemporaryDirectory() for device logs. | Completed |
| 15 | ScrollMapScreen ref used in dispose() | `scroll_map_screen.dart` | Moved refineModeProvider reset from dispose() to deactivate(); stop() AudioPlayers before dispose(); FocusManager.primaryFocus?.unfocus() at end of runJourney. | Completed |
| 16 | AudioPlayer animation callback after dispose | `scroll_map_screen.dart` | Call _scrollAudio.stop() and _rockBreakAudio.stop() before dispose() to cancel FramePositionUpdater. | Completed |
| 17 | App stuck on native splash (SharedPreferences/init hang) | `bootstrap.dart` | 12s timeout on initVoyagerSanctuary; on timeout, force demo mode and proceed so first frame renders. | Completed |
| 18 | Integration test broken by 5-step wizard + F5 terminology | `add_task_journey.dart` | Updated: The Scroll→The Map, Climb New Mountain→New Journey, Mountain→Peak, Add→Place Pebble. Added Intent/Identity/Logic steps. | Completed |
| 19 | Loading Screen Purgatory (SharedPreferences/init hang) | `bootstrap.dart` | loadDemoMode 3s timeout; setDemoMode 2s; DemoStorage.load 5s; overall 8s. Escape hatch: "Stuck? Use offline" after 5s. | Completed |
| 20 | Purgatory persists on manual launch; smoke test doesn't catch it | `bootstrap.dart`, `demo_storage.dart`, `synthetic_user_test.dart` | (1) When SKIP_AUTH: skip DemoStorage.load entirely, use seedInMemoryOnly. (2) Escape hatch at 3s; _onTryDemoMode avoids SharedPreferences (seedInMemoryOnly, unawaited setDemoMode). (3) Add "Loading Screen Purgatory" test that runs real flow (no pre-init). (4) Manual install: build with --dart-define=SKIP_AUTH=true to avoid purgatory. | Completed |
| 21 | _RouterNotifier used after dispose | `app.dart` | `ref.listen(authProvider, ...)` schedules `addPostFrameCallback` to call `_notifier.refresh()`. During integration tests the app can be disposed before the callback runs. Added `if (mounted)` guard before `_notifier.refresh()`. | Completed |
| 22 | Duplicate keys for pebbles (demo-pebble-1) in Column | `scroll_map_screen.dart` | Pebble rows used `ValueKey(pebble.id)`; demo pebbles can produce duplicate keys when same ID appears in list. Changed to composite key `ValueKey('${mountain.id}_${boulder.id}_${pebble.id}_$i')` using `pebbles.asMap().entries`. | Completed |

---

## Troubleshooting: "did not complete"

If tests still report "did not complete" after the pump fix (issue #12):

1. **Run one test** to isolate: `flutter test integration_test/synthetic_users/synthetic_user_test.dart -d R5CW3057XJP --name "Sanctuary Navigation Smoke" --timeout 5m`
2. **Keep device awake:** Disable sleep, keep screen on during run.
3. **USB:** Use a direct cable; avoid hubs. Try a different port.
4. **ADB:** Run `adb devices` before tests; reconnect if needed.
5. **Ignore timeouts (experimental):** `flutter test ... --ignore-timeouts` (Flutter 3.24+).

---

## Constraints (Immutable)

When fixing issues, follow:

- **No Clipping:** Use FittedBox, Flexible, or LayoutBuilder. No ClipRect or OverflowBox.
- **Z-Index Sovereignty:** Elias behind Hearth; fire visible. Use HitTestBehavior.translucent if blocking taps.
- **Asset Integrity:** Use stone_medium.png for compact views. No Icon fallbacks for stone assets.
- **State Truth:** Fix Riverpod/Supabase logic. No fake UI removal.
- **Refined Palette:** Keep Dark Walnut and Cream Parchment hex codes.

---

## How to Run Tests

Integration tests require auth bypass. Pass `--dart-define=SKIP_AUTH=true`:

```powershell
cd voyager_sanctuary
flutter test integration_test/synthetic_users/synthetic_user_test.dart -d R5CW3057XJP --dart-define=SKIP_AUTH=true
```

- **Single test (faster feedback):** `flutter test ... --name "Sanctuary Navigation Smoke" -d R5CW3057XJP --dart-define=SKIP_AUTH=true`
- **Device ID:** `R5CW3057XJP` is the Samsung device. Run `flutter devices` to see your device ID.
- **Requirements:** Device unlocked, screen on, USB debugging enabled.
- **SKIP_AUTH:** The app is secure by default; tests use `--dart-define=SKIP_AUTH=true` to bypass the auth gate. `run_smoke_tests_and_keep_app.ps1` includes this flag.

---

## Keep App Installed for Manual Testing

Flutter uninstalls the app after integration tests. To leave the app on your device for manual testing between smoke runs:

**Option 1 — Script (runs tests, then reinstalls):**
```powershell
cd voyager_sanctuary
.\scripts\run_smoke_tests_and_keep_app.ps1
# Or with a different device: .\scripts\run_smoke_tests_and_keep_app.ps1 -DeviceId YOUR_DEVICE_ID
```

**Option 2 — Manual (after running tests yourself):**
```powershell
flutter install -d R5CW3057XJP --debug
```

The app will remain installed until you uninstall it or run tests again. Tests will still install/uninstall as needed during their run; the install step only restores the app for your own use.

---

## Related Docs

- [RECOMMENDED_FIXES_AND_PLAN.md](./RECOMMENDED_FIXES_AND_PLAN.md) — General fixes beyond smoke tests
- [TESTING_CHECKLIST.md](../TESTING_CHECKLIST.md) — Manual QA checklist
- [TECHNICAL_AUDIT_REPORT.md](TECHNICAL_AUDIT_REPORT.md) — Audit findings
