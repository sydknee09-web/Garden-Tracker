# Build Guidance

**Source:** [GEMINI_RECOMMENDATIONS.md](GEMINI_RECOMMENDATIONS.md) — consolidated coding updates, gaps, outstanding tasks, and polishing from Gemini full-app review.  
**Use this doc as:** a short build checklist before release and when incorporating Gemini’s recommendations.

---

## Pre-release checklist (order matters)

**Gatekeepers (do first)**  
1. **Display name** — Verify intro Beats 3 & 5, management, and Sanctuary use `profile.display_name`; skip/empty → “traveler”. Document in TESTING_CHECKLIST.  
2. **Shard completion** — Verify on device: last leaf under a boulder completes → parent completion updates.  
3. **RLS verify** — Two-account test per RLS_VERIFICATION.md; document in TESTING_CHECKLIST row 5.  
4. **Satchel verify** — Fresh UID → Satchel shows 6 empty slots; Pack shows candidates or “No tasks waiting.” Document in TESTING_CHECKLIST row 3b.

**High-value**  
5. First Blockage migration applied in target env.  
6. Error boundaries: SanctuaryErrorWidget and ErrorWidget.builder catch red screens and offer Retry.  
7. Sound toggle: audit every `play()` path; sound off → no playback.  
8. Offline: centralize “no connection” copy and retry on Scroll, Satchel, Whetstone.  
9. Realtime cleanup on logout/background.  
10. Smoke tests: run `integration_test/synthetic_users/synthetic_user_test.dart`.

**Polish / code**  
11. Loading: Waiting/dimmed HearthSparkPainter on Scroll, Satchel, Whetstone, Archive.  
12. Semantics: ExcludeSemantics for sparks; labels for Pack, Burn, New Journey, Hammer, Whetstone.  
13. Deferred bugs: when touching Satchel/Edit/wizard, fix “(untitled)” and BUGS_DEFERRED_TO_PHASE items.  
14. Docs sync: ARCHITECTURE, CONVENTIONS, MASTER_PLAN after large features.  
15. Release path: full TESTING_CHECKLIST on device, 60fps, app icons/splash, store assets, TestFlight/Play Internal.

---

## Coding updates (done or verify)

| Item | Status | Location |
|------|--------|----------|
| `withOpacity` → `withValues(alpha: …)` | ✅ Done | `lib/features/sanctuary/sanctuary_screen.dart` |
| Unused imports / dead code | ✅ Done | bootstrap: removed `demo_mode_provider`; elias_intro_overlay: removed `gradientColors`/`isHearthBeat`; whetstone_choice_overlay: use `bubbleSpacing` in `totalContentHeight` |
| Narrow invalidation | Already adopted | Use `invalidateAfterNodeMutation` / `invalidateAfterBurn` for node edits; do not invalidate `mountainListProvider` for node-level ops. |
| Sound before play | Verify | Every `play()` / AudioPlayer path must check `ref.read(soundEnabledProvider)` first. |
| Display name skip/empty | Verify | `elias_dialogue.dart`: `managementGreeting`, `sanctuaryPeriodGreeting` yield “traveler” when null/empty. |

---

## Gaps to address (when touching area)

- **Satchel untitled** — Show “(untitled)” or “New pebble” when `node.title` is empty.  
- **Demo schema** — Demo repos support `intent_statement`, `layout_type`, `appearance_style`.  
- **NULL intent/layout** — Bones view: “(Not set)” or empty; default `layout_type` to `climb`.  
- **Realtime cleanup** — Cancel subscriptions in node/mountain repo on sign-out or background.  
- **RPC fallback** — `debugPrint` in progress RPC catch blocks to distinguish migration vs network.  
- **Integration tests** — Synthetic user test uses New Journey, 6-step wizard, 1–10 markers.

---

## Quick commands

```bash
# Analyze
flutter analyze lib/

# Build (quick check)
flutter build apk --debug

# Smoke test
flutter test integration_test/synthetic_users/synthetic_user_test.dart
```

---

**Full detail:** [GEMINI_RECOMMENDATIONS.md](GEMINI_RECOMMENDATIONS.md) §1–7.
