# Secondary Architectural Review (Cursor-Authored)

> **Note:** The Google Gemini API was **not** invoked from this environment. This document is a **second-pass structural review** performed in Cursor using the same codebase. For a true Gemini Cloud review, paste `PRE_TEST_AUDIT_REPORT.md` + critical file excerpts into Gemini or enable a Gemini integration in your IDE.

---

## 1. Codebase Structure

| Topic | Finding | Severity |
|-------|---------|----------|
| Import cycles | No obvious **lib↔lib** cycles detected in spot-checks (`app.dart` → features → providers → data). | Low |
| Folder layout | Clear **`features/`**, **`providers/`**, **`widgets/`**, **`data/`** split. | ✅ |
| Split / consolidate | `sanctuary_screen.dart` and `climb_flow_overlay.dart` are very large — candidates for private widgets in part files when you next refactor. | Low |
| Dead code | Integration test had unused const removed earlier; no broad dead-code sweep run. | Low |

---

## 2. Riverpod

| Topic | Finding | Severity |
|-------|---------|----------|
| Provider typing | Mix of `FutureProvider`, `StateNotifierProvider`, `StateProvider` — appropriate for async vs mutable UI. | ✅ |
| `.family` | Used where keyed by id (e.g. mountain/node). | ✅ |
| Circular deps | None obvious; `repository_providers` centralizes repos. | Low |
| Invalidation | `invalidateAfterNodeMutation`, `narrow_invalidation` patterns present — verify on device after rapid edits. | Medium |
| `autoDispose` | Many providers are **not** autoDispose — intentional for session cache; watch for stale data on account switch (handled partly by logout flows). | Medium |

---

## 3. Architecture & Best Practices

| Topic | Finding | Severity |
|-------|---------|----------|
| Models vs UI | Models in `data/models`; UI stays mostly dumb. | ✅ |
| Repository pattern | Implemented for all major domains + demo. | ✅ |
| Logic in widgets | Some orchestration in `ConsumerWidget` / `ConsumerStatefulWidget` (e.g. climb save) — acceptable for Flutter; extract if tests need it. | Low |
| Async | Most `await` paths wrapped; a few `Future.delayed` for UX timing — ensure `mounted` checks (mostly present). | Low |

---

## 4. Security & Auth

| Topic | Finding | Severity |
|-------|---------|----------|
| Secrets | **No hardcoded Supabase keys** in `lib/` (use `.env` / config — verify not committed). | ✅ |
| Route guards | `AppRoutes.isProtected` + redirect to `/auth`. | ✅ |
| Logging | Avoid logging tokens — current `debugPrint` paths look error-oriented. | Low |
| Account delete | Not re-audited RPC body in this pass — confirm RLS + RPC in Supabase dashboard. | Medium |

---

## 5. Performance & Memory

| Topic | Finding | Severity |
|-------|---------|----------|
| Rebuilds | Large screens may rebuild often — acceptable for beta; use `const` / `RepaintBoundary` where already done (Sanctuary background). | Low |
| Images | Rely on Flutter asset cache; no custom `cacheWidth` — OK for current asset sizes. | Low |
| Lists | `ReorderableListView`, `ListView` — reasonable for expected data volume. | Low |
| Streams | Realtime subscriptions — ensure cancelled on logout (prior work referenced in project history). | Medium |
| Leaks | `dispose` on controllers in major overlays — spot-check any new `Timer` without cancel. | Low |

---

## 6. Error Handling

| Topic | Finding | Severity |
|-------|---------|----------|
| Supabase | Repositories throw / surface failures; UI uses SnackBars / Elias copy in places. | Medium |
| Audio | Try/catch + alternate extension in `AppAudioService` and some `audioplayers` paths. | ✅ |
| Images | `errorBuilder` widely used. | ✅ |
| Fire-and-forget | Some `Future.microtask` / navigation after dialog — generally guarded with `mounted`. | Low |

---

## 7. Testing Readiness

| Topic | Finding | Severity |
|-------|---------|--------|
| Unit tests | Strong coverage for **LTREE**, **satchel state**, **whetstone state**, **ScenePeriod**. | ✅ |
| Widget/integration | `integration_test/mallet_flow_test.dart` exists; requires signed-in device. | Low |
| Demo mode | `demo_storage` + `kSkipAuthForTesting` paths support local runs. | ✅ |
| Offline | Offline copy centralized in places; full offline UX not guaranteed for all flows. | Medium |

---

## 8. Documentation

| Topic | Finding | Severity |
|-------|---------|--------|
| Elias / routing | `ELIAS_DIALOGUE_REFERENCE.md`, `MASTER_PLAN.md`, `TESTING_CHECKLIST.md` exist. | ✅ |
| README | Project root README — confirm setup steps match current Flutter/Dart SDK. | Low |

---

## Risk Register (Top 5)

| # | Risk | Mitigation |
|---|------|------------|
| 1 | **Missing optional assets** (wood plank, forest threshold, scroll_close) degrade polish but not logic. | Ship assets + pubspec lines before marketing screenshots. |
| 2 | **Account switch / logout** stale providers or realtime channels. | Manual test: login A → logout → login B; verify satchel/map. |
| 3 | **Intro `PopScope`** traps back button — could confuse testers who expect OS back. | Document in test script; consider “Skip” visibility. |
| 4 | **Supabase latency / timeout** on first pack — user sees SnackBar; verify copy is calm. | Run on slow 3G profile. |
| 5 | **Large-file maintainability** (`climb_flow_overlay`, `sanctuary_screen`) increases regression risk. | Post-beta extract widgets + golden tests for critical UI. |

---

## Fresh-User UX Watchpoints (Predicted)

1. **First-time length:** Forest → profile gate delay → intro beats → wizard → whetstone — fatigue risk.  
2. **“Scroll” vs “Map”** naming in UI vs mental model.  
3. **Pack / Burn** sequence after first mountain — map flow uses hearth focus without Elias parchment (returning path).  
4. **Whetstone** day slider + swipe actions — discoverability.  
5. **Auth errors** — ensure non-technical copy on `AuthScreen`.

---

*End of secondary review.*
