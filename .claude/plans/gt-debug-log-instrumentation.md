# GT Debug-Log Instrumentation — 8-Layer Plan

> **Status:** drafted 2026-05-25, awaiting "yes build" greenlight.
> **Source:** rebuilt in chat from handoff substance after previous chat's plan file was lost (never committed; previous chat stalled on AskUserQuestion).
> **Substance locks (PM-approved on handoff):** 8 layers, buffer cap 500, helper shape `logEvent(scope, action, payload?)`, privacy rule (log SHAPE only — counts/ids/table/op/ms/error.message; NEVER payload content), exclusions, single-commit ship.
> **What this chat adds:** Pass 1-4 file:line enumeration; Pass 2/3/4 audit findings; test-update implications.

## Purpose

Add lightweight, in-app debug-log instrumentation so that when the user reports a bug, the debug-log textarea at `/settings/developer/debug-log` (already shipped, see [debug-log/page.tsx](src/app/settings/developer/debug-log/page.tsx)) captures enough breadcrumb data to diagnose without screenshots-of-text round-trips. Builds on `ed5441c` (debug log page) + `debugLogBuffer.ts` console capture.

## Non-goals

- Not a telemetry / analytics framework. No remote ingestion. Sessionstorage-buffered only.
- Not user-facing. Stays at `/settings/developer/debug-log` (dev-unlocked).
- Not exhaustive — exclusions list below names what we deliberately don't log.

## In-scope (file count)

- **2 NEW files:** `src/lib/debugLog.ts`, `src/lib/debugLog.test.ts`
- **17 EDITED files:** see Layer details below. Total 19 files.
- **Single commit.**

## Out-of-scope (counter-creep guard)

- Remote ingestion / network-uploaded logs
- Per-render or per-mouse-event logging
- Logging the contents of payloads / form values / plant data
- Restructuring `debugLogBuffer.ts` capture mechanics
- Renaming `[scope] action` format-shape across the codebase's existing colon-notation peers (Pass 3 finding CONCERN, see below)

## Privacy contract (load-bearing)

Every `logEvent(scope, action, payload?)` call MUST satisfy:
- Payload keys are SHAPE only: counts, ids, table, op, ms, online-flag, error.message
- Payload NEVER contains user content: plant names, notes, seed varieties, journal text, photos, supply names
- Error logging uses `err.message` only (string, scrubbed by the caller if non-trivial); never the full error object

If in doubt: leave the field out.

## Helper shape (Layer 1)

```ts
// src/lib/debugLog.ts (NEW)
/**
 * Lightweight client-side telemetry into the sessionStorage debug buffer.
 * Parallels src/lib/apiErrorLog.ts (bracket-prefix format).
 *
 * Privacy: payload shape only (counts, ids, table, op, ms, error.message).
 * Never log payload content (user data, notes, plant names).
 */
export function logEvent(
  scope: string,
  action: string,
  payload?: Record<string, unknown>,
): void {
  try {
    console.log(`[${scope}] ${action}`, payload ?? {});
  } catch {
    // Never let logging crash the app
  }
}
```

`console.log` is captured by [debugLogBuffer.installConsoleCapture()](src/lib/debugLogBuffer.ts:88) — same pipeline as existing logs.

---

## Layers 1-8 (file:line enumeration)

### Layer 1 — Helper

- **NEW:** `src/lib/debugLog.ts` (shape above)
- **NEW:** `src/lib/debugLog.test.ts` — 3-4 tests:
  - emits `[scope] action {}` with empty payload
  - emits `[scope] action {payload}` when payload provided
  - never throws (mock console.log to throw, verify logEvent still returns)
  - format matches `[API ${route}]` bracket-style sibling at [apiErrorLog.ts:7](src/lib/apiErrorLog.ts:7)

### Layer 2 — Buffer cap bump

- **EDIT:** [debugLogBuffer.ts:10](src/lib/debugLogBuffer.ts:10) — `const MAX_ENTRIES = 50` → `const MAX_ENTRIES = 500`
- **EDIT:** [debugLogBuffer.test.ts:32-38](src/lib/debugLogBuffer.test.ts:32) — test currently iterates 75× and expects first 25 dropped. With cap 500, 75 entries fit entirely so the test assertions fail. Update:
  - Loop: `for (let i = 0; i < __test__.MAX_ENTRIES + 25; i++)` so overflow logic is exercised regardless of cap
  - First-kept assertion: `expect(entries[0].message).toBe(\`msg-${25}\`)` (the first 25 drop)
  - Last assertion: `expect(entries[entries.length - 1].message).toBe(\`msg-${__test__.MAX_ENTRIES + 24}\`)`
  - Description: "respects the rolling MAX_ENTRIES limit" (drop the literal "50")

### Layer 3 — Boot + Auth + SW

**Boot:**
- **EDIT:** [DebugLogInit.tsx:8](src/components/DebugLogInit.tsx:8) — after `installConsoleCapture()`, add `logEvent("app", "boot", { ua: navigator.userAgent.slice(0, 80), online: navigator.onLine })`
- ALSO add Layer 5 navigation in same file — see Layer 5

**Auth:**
- **EDIT:** [AuthContext.tsx:31-43](src/contexts/AuthContext.tsx:31)
  - Line 31 (after `getSession().then`): `logEvent("auth", s ? "session_restored" : "no_session", { hasUser: !!s?.user })`
  - Line 38 (inside `onAuthStateChange((_event, s) =>`): `logEvent("auth", _event, { hasSession: !!s })` — uses Supabase event name verbatim (`SIGNED_IN` / `SIGNED_OUT` / `TOKEN_REFRESHED` / `USER_UPDATED`)
- **EDIT:** [AuthContext.tsx:45](src/contexts/AuthContext.tsx:45) — in `signOut`, before `supabase.auth.signOut()`: `logEvent("auth", "sign_out_requested")`

**SW:**
- **EDIT:** [ServiceWorkerRegistration.tsx:7-17](src/components/ServiceWorkerRegistration.tsx:7)
  - Line 8 (before `.register`): `logEvent("sw", "register_attempt")`
  - Line 8 `.then((reg) => {`: add `logEvent("sw", "registered", { scope: reg.scope })` first thing inside `.then`
  - Line 9 (inside `updatefound` handler): `logEvent("sw", "update_found")`
  - Line 11 (inside `controllerchange` handler): `logEvent("sw", "controller_changed")` before `window.location.reload()`
  - Line 15-17 (catch block): `logEvent("sw", "register_error", { message: err instanceof Error ? err.message : String(err) })` — currently silent; add err param to catch

### Layer 4 — Network

- **EDIT:** [OfflineIndicator.tsx:22-34](src/components/OfflineIndicator.tsx:22) — inside both `handleOnline` and `handleOffline`, log `logEvent("net", "online" | "offline")` before existing state setters
- **EDIT:** [OfflineIndicator.tsx:37-69](src/components/OfflineIndicator.tsx:37) `replayWrites`:
  - Line 42 after `getPendingWrites()`: `logEvent("net", "replay_start", { count: writes.length })`
  - Line 58 after `removeWrite(write.id)`: `logEvent("net", "replay_ok", { table: write.table, op: write.operation })`
  - Line 60-62 catch: `logEvent("net", "replay_retry", { table: write.table, op: write.operation, retries: write.retries })`
  - Line 67-68 finally: `logEvent("net", "replay_done", { remaining: ... })` — compute from new pendingCount

### Layer 5 — Navigation

- **EDIT:** [DebugLogInit.tsx](src/components/DebugLogInit.tsx) — add `usePathname` import from `next/navigation`; add second `useEffect` that depends on pathname; call `logEvent("nav", "enter", { path: pathname })` on each change. Note: `DebugLogInit` is mounted at [layout.tsx:51](src/app/layout.tsx:51) (root level, client component) — `usePathname` works there.

### Layer 6 — Onboarding

- **EDIT:** [useOnboarding.ts:83-114](src/hooks/useOnboarding.ts:83) `reportAction`:
  - Line 84 entry: `logEvent("onboard", "action", { action: _action })`
  - Line 106 (before `setState({ step: 3, completed: true })`): `logEvent("onboard", "complete", { trigger: "all_done" })`
- **EDIT:** [useOnboarding.ts:116-123](src/hooks/useOnboarding.ts:116) `dismiss`:
  - Line 117: `logEvent("onboard", "dismiss")`

### Layer 7 — Supabase mutations

**EDIT:** [supabaseWithOffline.ts](src/lib/supabaseWithOffline.ts) — wrap each of the 5 helpers with start-event + end-event around the supabase call. Pattern:

```ts
const t0 = Date.now();
const online = typeof navigator !== "undefined" ? navigator.onLine : true;
// ...existing offline-queue branch...
logEvent("db", "queued", { table, op: "insert", online });  // when offline
// ...supabase call...
logEvent("db", error ? "error" : "ok", {
  table, op: "insert", ms: Date.now() - t0,
  ...(error ? { message: error.message } : {})
});
```

- [insertWithOfflineQueue lines 30-44](src/lib/supabaseWithOffline.ts:30) — op: "insert"
- [updateWithOfflineQueue lines 49-68](src/lib/supabaseWithOffline.ts:49) — op: "update"
- [insertManyWithOfflineQueue lines 73-92](src/lib/supabaseWithOffline.ts:73) — op: "insert_many", payload includes `count: rows.length`
- [upsertWithOfflineQueue lines 97-120](src/lib/supabaseWithOffline.ts:97) — op: "upsert"
- [deleteWithOfflineQueue lines 126-144](src/lib/supabaseWithOffline.ts:126) — op: "delete"

**Test impact:** [supabaseWithOffline.test.ts](src/lib/supabaseWithOffline.test.ts) exists — verify no breakage from new `logEvent` calls (it's a no-throw side effect, should be transparent). If a test asserts on call count of a mocked `console.log`, may need adjustment.

### Layer 8 — Error boundary + error toasts + 6 form envelopes

**Error boundary:**
- **EDIT:** [ErrorBoundary.tsx:25-27](src/components/ErrorBoundary.tsx:25) — `componentDidCatch` already calls `console.error("ErrorBoundary caught:", error, errorInfo)`. ADD `logEvent("error_boundary", "caught", { name: error.name, message: error.message })`. Keep `console.error` for stack (gets captured anyway by `installConsoleCapture` since console.error is wrapped).

**Error toasts:**
- **EDIT:** [useToast.tsx:55-58](src/hooks/useToast.tsx:55) — inside `showErrorToast` callback, before `showToast(msg, "error")`: `logEvent("toast", "error", { message: msg })`. Note: `msg` here is the user-facing toast string ("Could not save. Try again."), not payload content — privacy-safe.

**6 form envelopes** — wrap each form's primary submit handler with submit/success/error log calls. Pattern at each:

```ts
const handleSubmit = async (...) => {
  logEvent("form", "submit", { name: "<form_name>" });
  try {
    // ...existing logic...
    logEvent("form", "success", { name: "<form_name>" });
  } catch (err) {
    logEvent("form", "error", { name: "<form_name>", message: err instanceof Error ? err.message : String(err) });
    throw err; // preserve existing error handling
  }
};
```

The 6 picks (chosen for entity coverage — all 6 main canonical FAB-flow save paths):

1. **AddPlantModal** — [AddPlantModal.tsx:227](src/components/AddPlantModal.tsx:227) `handleSubmit` — `name: "add_plant"`
2. **QuickAddSeed** — [QuickAddSeed.tsx:409](src/components/QuickAddSeed.tsx:409) `handleSubmit` — `name: "add_seed"` (canonical single-seed FAB path)
3. **QuickAddSupply** — [QuickAddSupply.tsx:246](src/components/QuickAddSupply.tsx:246) `handleSubmit` — `name: "add_supply"`
4. **QuickLogModal** — [QuickLogModal.tsx:272](src/components/QuickLogModal.tsx:272) `handleSubmit` — `name: "add_journal"`
5. **NewTaskModal (TaskForm)** — [NewTaskModal.tsx:135](src/components/NewTaskModal.tsx:135) `handleSubmit` — `name: "add_task"`
6. **HarvestModal** — [HarvestModal.tsx:81](src/components/HarvestModal.tsx:81) `handleSave` — `name: "harvest"`

Forms NOT instrumented (counter-creep guard): BatchAddSeed/Supply (multi-stage extract+review, not single-save); EditJournalModal / EditPacketModal / etc. (edit paths — lower diagnostic value vs. add paths); FeedbackModal / InviteMemberModal (auxiliary).

---

## Total file inventory (19 files)

NEW (2):
1. `src/lib/debugLog.ts`
2. `src/lib/debugLog.test.ts`

EDITED (17):
3. `src/lib/debugLogBuffer.ts` (cap)
4. `src/lib/debugLogBuffer.test.ts` (test update for new cap)
5. `src/lib/supabaseWithOffline.ts` (5 helpers wrap)
6. `src/components/DebugLogInit.tsx` (boot + navigation)
7. `src/contexts/AuthContext.tsx` (auth events)
8. `src/components/ServiceWorkerRegistration.tsx` (SW events)
9. `src/components/OfflineIndicator.tsx` (network + replay)
10. `src/hooks/useOnboarding.ts` (onboarding events)
11. `src/components/ErrorBoundary.tsx` (boundary catch)
12. `src/hooks/useToast.tsx` (error toast)
13. `src/components/AddPlantModal.tsx` (form envelope)
14. `src/components/QuickAddSeed.tsx` (form envelope)
15. `src/components/QuickAddSupply.tsx` (form envelope)
16. `src/components/QuickLogModal.tsx` (form envelope)
17. `src/components/NewTaskModal.tsx` (form envelope)
18. `src/components/HarvestModal.tsx` (form envelope)

Note: handoff said "19 files, 2 new" — my count is 2 new + 17 edited = 19 ✅. If existing supabaseWithOffline.test.ts needs a test adjustment, total stays at 19 (already counted).

---

## Exclusions (deliberately NOT logged)

Per handoff substance:
- `.from(...).select()` read calls — read-heavy, low diagnostic value, noise
- Render cycles / re-render counts
- Mouse events / hover / focus
- Success toasts (`showToast(msg, "success")` path) — toast-error is the diagnostic signal
- Calendar cache hits (per `calendarTasksCache.ts`)
- Per-asset SW cache events (per-asset fetch + cache write within `sw.js`)

These exclusions keep noise floor low so the 500-entry buffer captures meaningful flow even on long sessions.

---

## Audit log (Pass 1-4)

### Pass 1 — Factual ✅

All file:line citations grep-verified against `src/`. Key checks:
- `MAX_ENTRIES = 50` confirmed at [debugLogBuffer.ts:10](src/lib/debugLogBuffer.ts:10).
- `installConsoleCapture` confirmed exported [debugLogBuffer.ts:88](src/lib/debugLogBuffer.ts:88) and used at [DebugLogInit.tsx:8](src/components/DebugLogInit.tsx:8).
- `OfflineIndicator` handleOnline/handleOffline at [OfflineIndicator.tsx:22,26](src/components/OfflineIndicator.tsx:22).
- `replayWrites` async loop at [OfflineIndicator.tsx:37-69](src/components/OfflineIndicator.tsx:37).
- `supabaseWithOffline` exports 5 helpers (insert/update/insertMany/upsert/delete) verified.
- `useOnboarding.reportAction` at [useOnboarding.ts:83](src/hooks/useOnboarding.ts:83) takes `_action` arg of `"zone_set" | "seed_added" | "task_added"`.
- `useOnboarding.dismiss` at [useOnboarding.ts:116](src/hooks/useOnboarding.ts:116).
- `AuthContext.onAuthStateChange` callback at [AuthContext.tsx:38](src/contexts/AuthContext.tsx:38) receives `_event` (Supabase string event).
- `signOut` at [AuthContext.tsx:45](src/contexts/AuthContext.tsx:45).
- `ServiceWorkerRegistration` register + updatefound + controllerchange at [ServiceWorkerRegistration.tsx:7-17](src/components/ServiceWorkerRegistration.tsx:7); catch is currently bare `.catch(() => {})` (must change to `.catch((err) => { logEvent(...) })`).
- `ErrorBoundary.componentDidCatch` at [ErrorBoundary.tsx:25-27](src/components/ErrorBoundary.tsx:25) already has `console.error`.
- `useToast.showErrorToast` at [useToast.tsx:55-58](src/hooks/useToast.tsx:55) wraps `showToast(msg, "error")`.
- 6 form handlers grep-verified at the cited lines.
- `usePathname` from `next/navigation` is used in 10 files (matches existing pattern).
- `DebugLogInit` is at [layout.tsx:51](src/app/layout.tsx:51), root level, client component — `usePathname` works there.

No `ICON_MAP-not-imported`-class issues found. Every cited line exists.

### Pass 2 — Concerns / gaps / inconsistencies hunt ✅

Hunt categories named explicitly for this code batch:

**State transitions:**
- `installConsoleCapture` is idempotent (verified [debugLogBuffer.ts:89](src/lib/debugLogBuffer.ts:89)). Multi-mount DebugLogInit safe.
- New `usePathname` effect in DebugLogInit will fire on every nav — that's the point. No transition concern; effect deps are `[pathname]`.

**Race conditions / async ordering:**
- `replayWrites` is sequential per-write loop. Adding `logEvent` inside loop is sync (console.log). No new race.
- `supabaseWithOffline` wrappers: `t0 = Date.now()` BEFORE the awaited call, logged AFTER. Timestamp drift in concurrent calls? Each call has its own `t0` scoped to the function call — safe.

**Null / empty states:**
- `logEvent(scope, action, payload?)` payload optional. Helper handles undefined via `?? {}`.
- Buffer is empty on first boot — boot logEvent works (just pushes the first entry).

**Missing query filters:** N/A — no DB queries added.

**Error handling gaps:**
- Helper wraps `console.log` in try/catch internally (load-bearing — must NEVER throw).
- Form envelope `try/catch` preserves existing error flow via `throw err` re-raise.
- ErrorBoundary keeps original `console.error` AND adds `logEvent` — captures both stack and structured entry.
- ServiceWorkerRegistration: bare `.catch(() => {})` becomes `.catch((err) => { logEvent("sw", "register_error", { message: ... }) })`. Adds an explicit reference to the previously-discarded error. Safe.

**Missing imports:** every edited file gains `import { logEvent } from "@/lib/debugLog"`. 17 import additions. No barrel-import; direct path.

**Optimistic-UI vs. refetch:** N/A.

**RLS / auth assumptions:** N/A — no DB writes added.

**Mobile-vs-desktop:** console.log is universal. logEvent runs identically on phone + desktop + iPad. Safe.

**Test coverage gaps:**
- NEW `debugLog.test.ts` covers helper.
- `debugLogBuffer.test.ts:32-38` needs update for cap bump (covered in Layer 2).
- `supabaseWithOffline.test.ts` MAY need mock-console adjustment if asserts on console call count; verify on first test run, fix if needed (mock console.log to no-op in those tests).
- No new behavior change in any wired-up file → no functional regression tests required.

**Cohesion-by-aggregation:**
- `[scope] action {payload}` bracket-prefix format aligns with [apiErrorLog.ts:7](src/lib/apiErrorLog.ts:7) `[API ${route}]` — PM-greenlit anchor.
- Toast variants: only `"error"` is logged (success excluded per exclusions). Aligns with existing showErrorToast usage.
- Buffer cap 500 — new value, not anchored to existing peer (no other buffer in app). PM-greenlit value.
- Form `name` field uses snake_case: `add_plant` / `add_seed` / `add_supply` / `add_journal` / `add_task` / `harvest`. Consistent within Layer 8.

**Persona walk:**
- This is dev tooling (gated by `useDeveloperUnlock`). All 5 personas pass by exclusion — never see logs unless they tap version 7×. User (developer persona) is the only consumer.
- Privacy: log shape only. No persona's data leaks through buffer copy-paste.

### Pass 3 — Sibling pattern sweep ✅

**Vocabulary-breadth grep:**

| Family | Grep pattern | Found | Aligned? |
|---|---|---|---|
| Logging helpers | `log\w+\(.*\)` in src/lib | `logApiError`, `logApiUsage`, `logRequestMetrics`, `logClientMetrics` | New `logEvent` joins `log*` prefix family ✅ |
| Telemetry / tracking / analytics | `track\|analytics\|telemetry\|instrument\|pageview\|posthog\|amplitude\|mixpanel\|sentry` | 2 unrelated matches (journal `track`, test file) | No existing framework to duplicate ✅ |
| Event-name | `logEvent` | 0 matches | Name is free ✅ |
| Console.error format | `console\.error\([\`'"]` | Two families: bracket `[scope]` (apiErrorLog, reviewImportStorage); colon `scope:` (cascadeOnGrowEnd, ActiveGardenView, HarvestModal, BatchLogSheet, etc. — ~10+ uses) | See CONCERN below |

**Sibling patterns aligned (BLOCKING — must match):**
- Helper format → `[scope] action {payload}` matches [apiErrorLog.ts:7](src/lib/apiErrorLog.ts:7) bracket-prefix ✅
- `installConsoleCapture` capture pipeline → reused, not duplicated ✅
- Error toast already routes through `useToast.showErrorToast` → instrumented at hook, not per-call-site ✅
- Onboarding events use the existing `_action` arg verbatim (`zone_set`/`seed_added`/`task_added`) → no new vocabulary ✅
- Auth event names use Supabase's `_event` string verbatim → no new vocabulary ✅

**ADJACENT (logged, not fixed this ship):**
- `BatchAddSeed handleSaveAll` (multi-stage) NOT in 6-form picks; could benefit from envelope in future. Logged as ADJACENT.
- `BatchAddSupply` photo-extract flow (handleExtractAll) NOT in 6-form picks. Logged as ADJACENT.
- Edit-flow handlers (EditJournalModal, EditPacketModal, GrowInstanceModal) — could add `form: update` later. ADJACENT.
- BatchLogSheet handleSubmit (multi-row save with showErrorToast) — could add envelope. ADJACENT.

**CONCERN (codebase-wide pattern; not blocking this ship):**
- Console error string format is split: bracket `[scope]` (~2 uses, structured) vs. colon `scope:` (~10+ uses, ad-hoc inside lib helpers). New `logEvent` joins the bracket family. The colon-notation peers remain as-is (they're scope-specific error catchers in cascade/sow/care helpers, not a structured telemetry pattern). Introducing a third structured-prefix usage doesn't worsen the split — but a future cohesion pass could standardize all 12+ logging sites on `[scope] action`. Logged as CONCERN; not BLOCKING because this ship is additive instrumentation, not a refactor of existing peers.

### Pass 4 — Lock hygiene ✅

**VISION §10 don't-touch:** Plantable banner, Calendar grid prominence, Plantable widget separation, plant placeholder PNG, Active Garden gallery card, empty-by-default onboarding, no activity feed at sharing layer. **None brushed.** Debug log is dev tooling under `useDeveloperUnlock` — invisible to all personas except the developer.

**VISION §11 open decisions:**
- Beds-as-first-class — N/A.
- Plant database moderation — N/A.
- Growing instance representation — N/A.
- Calendar task fatigue — N/A.
- Cross-view consistency Vault/Garden/My Plants — N/A.
- Plant image edit places — N/A.
- App-wide icon density — N/A.
- Save / Cancel button consistency — N/A.
- Calendar task row primitive — N/A.
- Modal/menu placement on desktop — N/A.
- Desktop layout — N/A.
- HarvestModal end-state realization — HarvestModal IS in 6-form envelopes. ENVELOPE ADDITION ONLY — no behavior change to the existing insert path. Parked decision (auto-end checkbox vs. follow-up prompt) is preserved untouched. ✅
- Sister's additional feedback — N/A.
- Sharing UX — N/A.
- AGENTS.md split — N/A.

**ROADMAP §6 decision log:** No decision in §6 affects logging/instrumentation.

**State-touching changes (Pass 4 trigger):**
- AuthContext: ADDITIVE log calls only. No state changes to the user/session/loading reducer. No effect on auth state machine. ✅
- OnboardingContext / useOnboarding: ADDITIVE log calls only. No state shape change. ✅
- SyncContext: NOT touched.
- HouseholdContext: NOT touched.
- UniversalAddContext: NOT touched.
- ErrorBoundary: keeps existing `setState` and `componentDidCatch` semantics. Log call is side-effect-free. ✅

**Migration/SQL:** NONE.

**Configuration files:** NONE.

**Service Worker:** ServiceWorkerRegistration.tsx edits are log-only; sw.js itself is not touched.

Lock hygiene clean.

---

## Acceptance criteria

- [ ] `src/lib/debugLog.ts` exports `logEvent(scope, action, payload?)` matching shape above
- [ ] `src/lib/debugLog.test.ts` covers emit + format + never-throws (3-4 tests)
- [ ] `MAX_ENTRIES = 500` in `debugLogBuffer.ts` and `debugLogBuffer.test.ts` updated to use dynamic cap
- [ ] All 8 layers wired per Layer details above
- [ ] All 19 files import + call `logEvent` correctly
- [ ] Tests: 434/434 existing + new `debugLog.test.ts` (3-4 tests) = ~437-438/437-438 passing
- [ ] `npm run build` clean
- [ ] No new console errors / warnings introduced
- [ ] Privacy contract honored: grep new diff for any payload-content logging — must be 0 occurrences
- [ ] Single commit
- [ ] Dogfood verification path surfaced post-ship: open debug log page → trigger boot/auth/nav/form events → confirm entries appear with correct shape

## Test plan (pre-push)

1. `npm run test:run` — all 434 pass + 3-4 new debugLog tests pass + supabaseWithOffline tests still pass.
2. `npm run build` — clean.
3. (Skipped per documented .env.local-absent worktree condition) Preview MCP visual check — N/A for non-visual change; user phone-verifies via debug log page on prod.
4. Manual diff scan for privacy contract: grep diff for `payload` / `note` / `name:` / `text:` / plant data in logEvent calls — must find 0 leaks.

## Dogfood verification path (post-ship)

After push to main + Vercel deploy:
1. User opens app → sign-in.
2. Tap App Version 7× on Profile → unlock dev tools.
3. Navigate around (Calendar / Garden / Vault / Journal). Trigger an Add flow.
4. Go to Settings → Developer → Debug Log.
5. Verify entries appear with shapes:
   - `[app] boot {ua, online}`
   - `[auth] SIGNED_IN {hasSession: true}` or `session_restored`
   - `[sw] registered {scope}`
   - `[nav] enter {path: "/calendar"}`
   - `[net] online` (when toggling airplane mode)
   - `[onboard] action {action: "zone_set"}` if onboarding still in flight
   - `[db] ok {table, op, ms}` on save
   - `[form] submit/success {name}` on form save
6. Tap Copy all → verify clipboard text format intact.

## Open verification (post-ship, optional)

- Buffer cap 500: confirm long session retains expected breadcrumbs without overflow truncation.
- Privacy: confirm copy-paste of debug log shows zero user content (only shape data).

---

*Plan rebuilt 2026-05-25 by `continue-from-prev-chat` chat after previous-chat plan file was lost. Awaiting "yes build" greenlight before Phase 3 execute.*
