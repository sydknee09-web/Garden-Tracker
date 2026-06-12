# AI Fill backgrounding — job queue + in-invocation worker + realtime + global toast

**Date:** 2026-06-11
**Branch:** worktree-ai-fill-backgrounding (isolated worktree off origin/main `a9c59fc`)
**Source:** Dispatch brief (AI Fill backgrounding, locked design); builds on Ship 2 `2dc9860`
**NORTH_STAR cites:** §2 "Take mental load OFF the user" (the user clicks AI Fill and moves on — the app carries the job, restores its visual state when she returns, and tells her when it's done wherever she is; she never babysits a spinner). §1 "No duplicate paths" (one pipeline: the background job self-invokes the EXISTING fill-blanks-for-profile route — no parallel worker pipeline, no Deno port; both Fill Blanks and Overwrite ride the same job shape). §3 "Information-hub framing" (completion toast's View action returns the user to the profile hub; results land on the hub regardless of where she is).

---

## Purpose

AI Fill (Fill Blanks + Overwrite) runs as a background job that survives navigation: click → job enqueued → user roams free → button spinner + per-field shimmer restore on return mid-job → global toast on completion from anywhere, with a View action to the profile.

## Brief-vs-reality drift notes (verified at Phase 1)

- Brief's `agent/memory/project_gt_ai_fill_backgrounding_design.md` does not exist in this repo (no `agent/` dir) — Dispatch-side memory; design restated inline in the brief, used as spec (same shape as Ship 2's drift note).
- Brief path `docs/plans/ai_fill_overhaul_2026-06-11.md` exists on origin/main (`a9c59fc`) — the original checkout was stale; worktree is current. Read in full.
- Brief says "extend the existing `toast.success()` call / parallel jobs stack natively via the toast library / tap toast jumps to profile (existing behavior)" — **no toast library exists.** Reality: custom `useToast` hook ([src/hooks/useToast.tsx](../../src/hooks/useToast.tsx)) — page-local, single-slot (new toast replaces prior), no tap-to-navigate. Adaptations declared below (D5, D6).
- Brief says "server action enqueues" — codebase has zero server actions; every server entry point is an API route. Enqueue = API route (Pass 3 sibling alignment).
- Brief says "per-field shimmer" as if existing — no field shimmer exists today; the skeleton register (`animate-pulse` + `bg-neutral-200`, [page.tsx:711](../../src/app/vault/[id]/page.tsx)) is the anchor for building it.
- Brief's "archive completed jobs older than 7 days" — no archive table in the locked schema; interpreted as delete (D8).

## Acceptance criteria

1. Clicking Fill Blanks / Overwrite enqueues a row in `ai_fill_jobs` and returns immediately; the pipeline runs server-side to completion regardless of client navigation/disconnect.
2. While a job is active for a profile: AI Fill button shows the existing spinner; empty fields on the About tab show shimmer. Both restore when the user navigates away and back mid-job.
3. On completion, a toast fires globally (any page), subject-named ("Cherokee Purple profile updated"), with a View action to the profile. Honest-feedback semantics (couldn't-find / nothing-new / AI-unavailable) survive.
4. If the user is on the profile when the job completes, the page refetches and shows the new values; not-found inline notice state updates.
5. User-edit-wins conflict rule holds: fill path writes only blank fields (existing `setStr` blank-guards, unchanged — the job wraps the route, never bypasses it).
6. Parallel jobs across different profiles allowed; duplicate active job per profile blocked (DB partial unique index).
7. Stuck/stale jobs can't spin forever: client 15-min staleness guard + daily sweeper cron (stale → failed; complete/failed >7d deleted).
8. Tests + build green. Migration staged; **`supabase db push` AND code push BOTH held for Syd greenlight** (schema ship — no auto-push tier; same as Ship 2).

## Out of scope

- Jobs tray / global progress UI (brief: not at v1 scale).
- Conflict UI / version tracking (brief: conditional-write rule suffices).
- Import-flow enrichment calls (review-import / import / BatchAddSeed) — they keep calling the route directly; backgrounding scope = the two profile AI buttons.
- Settings bulk fill-in-blanks route (pre-existing separate surface).
- Toast stacking (D5).

## Files (13)

1. `supabase/migrations/20260611190000_ai_fill_jobs.sql` — NEW; additive only
2. `package.json` (+ lockfile) — add `@vercel/functions` (official `waitUntil`)
3. `vercel.json` — daily sweeper cron
4. `src/app/api/ai-fill/enqueue/route.ts` — NEW enqueue + in-invocation worker
5. `src/app/api/cron/ai-fill-jobs-sweeper/route.ts` — NEW cleanup cron
6. `src/contexts/AiFillJobsContext.tsx` — NEW global job tracking + realtime + global toast
7. `src/lib/aiFillToast.ts` — NEW subject-aware toast copy helper (moved/adapted from useVaultEditHandlers)
8. `src/lib/aiFillToast.test.ts` — NEW
9. `src/app/api/ai-fill/enqueue/route.test.ts` — NEW
10. `src/app/vault/[id]/useVaultEditHandlers.ts` — handlers enqueue; running state from context; completion effect
11. `src/app/vault/[id]/VaultProfileAboutTab.tsx` — per-field shimmer on empty cells keyed off `retryRunning`
12. `src/app/layout.tsx` — mount `AiFillJobsProvider`
13. `.env.example` — `CRON_SECRET`

Plus docs at close: `docs/plans/ai_fill_backgrounding_2026-06-11.md` (durable copy, Ship 2 sibling), ROADMAP §1/§5/§6.

## Design decisions (with anchors)

- **D1 — Worker = in-invocation background processing via `waitUntil` (`@vercel/functions`), NOT Vercel cron NOR Supabase Edge Function.** The brief offered cron/edge-function and asked the chat to pick per existing infrastructure. Both rejected on facts:
  - *Supabase Edge Function:* zero edge functions exist; the pipeline is Next.js TypeScript (`researchVariety.ts`, `fillBlanksCache.ts`, tier ladder) — a Deno worker would either port it (massive duplication, NORTH_STAR §1 violation at the code level) or HTTP back into Next (pointless hop).
  - *Vercel polling cron:* `vercel.json` has no crons; Hobby-tier crons fire at most daily → pending-job pickup latency up to hours. Even per-minute polling adds latency and invocation burn vs today's instant start.
  - *Decisive third fact:* the entire pipeline is user-Bearer-token-driven ([fill-blanks-for-profile/route.ts:81](../../src/app/api/seed/fill-blanks-for-profile/route.ts) `getSupabaseUser(req)`; token forwarded to find-hero-photo `:41-61` and enrich-from-name `:237-248`). A deferred worker runs minutes later with a possibly-expired token, forcing a service-role rewrite of auth + RLS + the Leak-3 ceiling logging. In-invocation processing uses the token NOW, valid by construction.
  - `waitUntil` is Vercel's official primitive for exactly this (work continues after the response); in `next dev` (no Vercel request context) the promise simply floats in the Node process — same effect. A thin `safeWaitUntil` wrapper guards against context absence.
- **D2 — Worker reuses the existing route via self-fetch.** The enqueue route's background continuation fetches `/api/seed/fill-blanks-for-profile` with the same Bearer token + body `{profileId, useGemini:true, forceRefresh:true, overwrite}` — byte-identical params to today's two handlers ([useVaultEditHandlers.ts:234-238, 257-261](../../src/app/vault/[id]/useVaultEditHandlers.ts)). Self-fetch-with-forwarded-token is the route's own established pattern (it already self-fetches find-hero-photo and enrich-from-name). Zero pipeline refactor; Fill Blanks + Overwrite + the Ship 2 tier ladder/provenance all inherit automatically.
- **D3 — Status flow** `pending` (insert) → `running` (processing start, same invocation) → `complete`/`failed` (+ `completed_at`, `result_summary` jsonb `{fieldsFilled, notFound, enriched, error?, plantName}`). Locked schema + one declared column addition: `overwrite boolean not null default false` (the job must carry its mode; result_summary is for results, not request params).
- **D4 — Client state lives in a global `AiFillJobsContext`** (layout-mounted, inside AuthProvider — sibling: SyncProvider/OnboardingContext register). Initial fetch of active jobs on auth + realtime `postgres_changes` (INSERT/UPDATE, `user_id=eq.<uid>`) + reconciliation refetch on visibility/reconnect (missed-event recovery) + 10s poll fallback only while jobs are active AND the channel isn't joined. Exposes `activeJobs`, `enqueue()`, `lastCompleted`.
- **D5 — Toast: provider-owned `useToast` instance rendered globally.** Reuses the existing toast primitive verbatim (visuals, variants, action button, aria). Single-slot replacement semantics kept (existing lock; near-simultaneous parallel completions replace — rare at v1 scale; flagged to Syd, not silently re-engineered into stacking).
- **D6 — "Tap toast → profile" via the existing `ToastAction` inline button** (`action: {label: "View", onAction: router.push}`) — the Undo-button primitive ([useToast.tsx:18-23](../../src/hooks/useToast.tsx)), Title Case label per casing convention. Whole-toast tap target doesn't exist in the primitive; not invented.
- **D7 — Toast copy (supersession declared).** The 2026-06-10 "locked verbatim" honest-feedback copy gains a subject, per the brief's explicit direction ("Cherokee Purple profile updated" — Syd-directed via Dispatch, same supersession shape as Ship 2's species-fallback lock). Set: filled>0 → `"<subject> profile updated"`; notFound → `"Couldn't find data for <subject>. Check the spelling of name and variety."`; nothing-new → `"<subject>: nothing new to add"`; unavailable → `"<subject>: AI unavailable, try again later"` (error variant). Subject = `variety_name || name` (brief: "use common_name or variety as the subject"). Copy set flagged in the close report for Syd's wordsmith pass.
- **D8 — Cleanup:** daily Vercel cron (Hobby-safe cadence; fine for hygiene work) marks `pending`/`running` older than 15 min as `failed` (`{error:"TIMEOUT"}`) and DELETEs `complete`/`failed` older than 7 days ("archive" → delete; no archive table in the locked schema). Auth via `CRON_SECRET` Bearer (Vercel cron convention). Client mirrors the 15-min staleness guard so a stuck row can't spin a button forever even before the sweeper runs.
- **D9 — Duplicate guard:** partial unique index on `(plant_profile_id) WHERE status IN ('pending','running')`; enqueue race → catch unique violation, return the existing active job.
- **D10 — Shimmer:** empty-cell sites swap "—" for a pulse block (`h-5 w-24 rounded bg-neutral-200 animate-pulse`, anchored to the page-skeleton register [page.tsx:711](../../src/app/vault/[id]/page.tsx) and hero pulse `:1308`) while `retryRunning` is true. Keyed off the EXISTING `retryRunning` prop (= `fillBlanksRunning`) — zero new page-level plumbing. Fill-blanks mode: blanks are exactly the fields being filled. Overwrite mode: filled cells keep their values (shimmering over real data would hide it); the button spinner is the global signal — honest per-field signal without destroying content.
- **D11 — maxDuration 120 on enqueue route** (covers response + background pipeline; anchor: settings/fill-in-blanks `:13` uses 120; inner route's own 60s budget bounds the fetch).

## Pass 1 — Factual (clean after 1 run)

- `getSupabaseUser` + `unauthorized` exist ([src/app/api/import/auth.ts:6-24](../../src/app/api/import/auth.ts)); user-scoped client carries the Bearer token globally ✓
- `getSupabaseAdmin` exists ([src/lib/supabaseAdmin.ts](../../src/lib/supabaseAdmin.ts), imported at fill-blanks route `:4`) — sweeper's client ✓
- Base-URL pattern for self-fetch: `process.env.VERCEL_URL || NEXT_PUBLIC_APP_URL || http://localhost:3000` ([fill-blanks-for-profile/route.ts:41,237](../../src/app/api/seed/fill-blanks-for-profile/route.ts)) ✓
- Handler bodies to reproduce byte-identically: `{profileId, useGemini:true, forceRefresh:true}` / `+overwrite:true` ([useVaultEditHandlers.ts:237,260](../../src/app/vault/[id]/useVaultEditHandlers.ts)) ✓
- Route response contract consumed by the job: `{ok, fromCache, fromAi, enriched, fieldsFilled, notFound?, error?}` (route `:373-381`) ✓
- `useToast` returns `{toast, showToast, showErrorToast}`; `ToastAction {label, onAction}`; toast renders `fixed top-20 z-50` (position-independent of page) ([useToast.tsx:65-177](../../src/hooks/useToast.tsx)) ✓
- `useAuth()` exposes `session` (access_token) + `user` ([AuthContext.tsx:13,61-67](../../src/contexts/AuthContext.tsx)) ✓
- Provider mount point: layout provider stack ([layout.tsx:54-70](../../src/app/layout.tsx)); AiFillJobsProvider needs only Auth → slots after SyncProvider ✓
- `supabase` browser client ([src/lib/supabase.ts](../../src/lib/supabase.ts)) is supabase-js v2.94 — `.channel().on('postgres_changes', …)` + auto realtime auth available ✓
- Spinner already keyed off `fillBlanksRunning` ([page.tsx:1194-1206, 1283-1286](../../src/app/vault/[id]/page.tsx)); deriving that value from context makes persistence free ✓
- `retryRunning` already threaded into AboutTab ([page.tsx:1375 area](../../src/app/vault/[id]/page.tsx), [VaultProfileAboutTab.tsx:40,219](../../src/app/vault/[id]/VaultProfileAboutTab.tsx)) ✓
- Empty-cell sites: `PillDetailField` `:107-108` + propagation "—" `:448-490` region + How-to-Grow "—" rows ✓
- Migration timestamp: latest existing is `20260611150000` (Ship 2) → `20260611190000` collides with nothing ✓
- `enrichToastMessage` has exactly one consumer (useVaultEditHandlers) — safe to move/adapt ✓
- e2e grep: no assertions on AI Fill strings/toasts in `e2e/` ✓

**Bidirectional state-transition matrix (job lifecycle × client lifecycle — Pass 1 subcategory, state-machine change):**

| Transition | Client on profile | Client elsewhere | Client closed/locked |
|---|---|---|---|
| enqueue → pending/running | optimistic add via `enqueue()` + realtime INSERT (idempotent merge) | n/a (enqueue only from profile) | n/a |
| running → complete | realtime UPDATE → toast + `lastCompleted` → page effect refetches profile + clears shimmer/spinner | realtime UPDATE → toast w/ View action | event missed → reconciliation refetch on next visibility/auth → active-set drains; **no toast for completions observed only via reconciliation older than 60s (stale-completion guard — avoids toast-on-every-app-open)**; fields simply present |
| running → failed | same path, error-variant toast, `aiNotFound`/attempted state set from summary | error toast | same reconciliation, no stale toast |
| navigate away mid-job | page unmounts; context (global) keeps job; spinner/shimmer restore on remount from `activeJobs` | — | — |
| return mid-job | `activeJobs[profileId]` truthy → `fillBlanksRunning` true → spinner + shimmer | — | initial fetch on auth ready restores active set |
| function killed (timeout/crash) | row stuck `running` → client 15-min staleness guard stops spinner; sweeper marks failed (next UPDATE event also clears any listening client) | same | same |
| duplicate click | button disabled while running (existing) + DB partial unique index + race catch returns existing job | — | — |

## Pass 2 — Concerns hunt (clean after 2 revisions)

Hunt categories named: race conditions / async ordering; null-empty-many states; RLS/auth assumptions; realtime delivery gaps; optimistic-vs-refetch mismatch; token lifetime; serverless lifecycle (freeze/timeout); double-toast; mobile/desktop split; test coverage; cohesion-by-aggregation; persona walk.

- **Token lifetime:** token captured at enqueue, used immediately in the same invocation — no expiry window ✓
- **Serverless freeze:** response returned before work → `waitUntil` is the official keep-alive; dev/no-context → floating promise in persistent Node process; wrapper try/catches ✓. Function timeout → stuck `running` → dual staleness guard (client 15-min + sweeper) ✓
- **Double toast (revision 1):** old handlers toasted locally on completion; provider now toasts globally → local completion toast REMOVED from handlers (enqueue-failure error toast stays local). Single source ✓
- **Toast-on-app-open (revision 2):** reconciliation discovering an old completion must not toast days later → stale-completion guard (only toast transitions observed live OR completions <60s old during reconciliation) ✓
- **Optimistic-vs-realtime merge:** `enqueue()` adds optimistically with returned jobId; realtime INSERT for the same jobId merges idempotently (keyed map) ✓
- **RLS:** select/insert/update own (`auth.uid() = user_id`); job writes use the user-scoped client inside the invocation; sweeper uses admin client ✓. Realtime postgres_changes respects RLS for the subscriber ✓
- **Realtime delivery gaps:** missed events covered by reconciliation refetch (visibilitychange + channel re-join) + bounded 10s poll only while active jobs exist and channel isn't joined ✓
- **Null/empty/many:** zero active jobs → no subscription work beyond the channel; many parallel jobs → map handles n; profile deleted mid-job → route 404s → job `failed` (`{error:"HTTP_404"}`), toast error-variant; subject falls back to "Plant" when name/variety both empty ✓
- **`loadProfile` refetch on completion:** effect depends on `lastCompleted` (jobId-keyed) so it fires once per completion, not on every render ✓
- **Conflict rule (brief item 4):** verified — fill path's blank-guards live in the route (`setStr` `overwrite ||` blank check, route `:267-276` at HEAD); the job wraps the route without touching write semantics; user edits mid-job win on any field they fill before the AI write lands (route re-reads the profile at run time — job enqueue→run gap is ~0 since processing starts in the same invocation) ✓
- **Cohesion-by-aggregation:** new patterns inventoried — shimmer block (anchored: skeleton register D10), toast copy (D7, flagged), View action label (Title Case, anchored to Undo label convention), cron route shape (anchored: developer routes' Bearer-check pattern), console format `functionName: description` colon-notation per U24 lock. No unanchored pattern ships silently ✓
- **Persona walk (user-facing: background behavior, shimmer, toast):** Maya — fire-and-roam across many profiles, parallel jobs, no babysitting ✓. Sydney — same button, same spinner, same toast register she knows; nothing relearned ✓. Walter — no new gesture; toast is plain words + a visible View button (44px min-height inherited) ✓. Aria — houseplant profiles same flow; no outdoor assumption ✓. Sam — no new chrome when she's not using AI Fill; empty-state untouched ✓. No exclusions.

## Pass 3 — Sibling sweep (clean after 1 revision)

- **BLOCKING (resolved in plan):** background work pattern — existing sibling is client fire-and-forget fetch ([review-import/page.tsx:1140-1146](../../src/app/vault/review-import/page.tsx)). The job design deliberately upgrades it (durable row + guaranteed continuation) per the locked design; divergence is conscious and named, import flows stay on their pattern (out of scope) ✓
- **Sibling alignment:** API route (not server action) ✓; route auth via `getSupabaseUser`/`unauthorized` (every seed route) ✓; `maxDuration` export shape ✓; context file shape + `useX` hook export (AuthContext/SyncContext register) ✓; test shape mirrors `enrich-from-name/route.test.ts` mock pattern ✓
- **Vocabulary breadth (queue/job/background/worker families):** swept `job|queue|enqueue|worker|pending|inflight|background|task` across src/ + migrations → `offlineQueue`/`supabaseWithOffline` (client offline write queue — different concern, no overlap: AI Fill never queues offline, it requires connectivity), `background-hero-for-profile` + `backgroundEnrich` flag (import-time enrichment naming — coexists; new table/routes use `ai_fill_jobs`/`ai-fill` namespace, no collision), `care_tasks`/task-system (garden tasks, unrelated). No existing job-queue mechanism to reuse ✓
- **ADJACENT (no action, named):** `background-hero-for-profile` + review-import fire-and-forget hero fan-out could someday ride `ai_fill_jobs` for durability — consolidation candidate post-v1; not this ship.
- **ADJACENT (no action, named):** offline-first surfaces use `upsertWithOfflineQueue`; AI Fill enqueue has no offline story (requires server) — enqueue failure surfaces the existing local error toast; acceptable, named.
- **e2e grep:** old strings unchanged ("Fill blanks", "Overwrite existing and fill all" stay); toast copy changes have no e2e assertions; new strings net-new ✓

## Pass 4 — Lock hygiene (clean; 1 supersession declared)

- **Toast honest-feedback copy "locked verbatim" (Syd 2026-06-10):** SUPERSEDED in part by the brief's explicit subject-named copy direction — declared (D7), same Syd-directed supersession shape as Ship 2's species-fallback lock; honest-feedback SEMANTICS fully preserved. New §6 entry at close.
- **Leak-hardening locks (`b9746ff`):** untouched — job runs the same route once; no new retry layers; daily ceiling + per-attempt usage logging inherited ✓
- **B5 couldn't-find lock:** preserved — `notFound` rides result_summary; inline notice + Try Again state still set on the profile page via the completion effect ✓
- **Contexts (Pass 4 trigger):** new context added; existing contexts untouched; provider ordering needs only Auth ✓
- **VISION §10 don't-touch / §11 parked:** none touched ✓
- **Push tier:** schema migration ⇒ explicit greenlight for `supabase db push` AND the dependent code push. BOTH HELD. Sweeper cron needs `CRON_SECRET` env var on Vercel (escalated in report). Migration apply order: Ship 2's `20260611150000` status on remote must be confirmed at push time (worktree has no supabase link — verify per memory).

## Amendments (declared during Phase 3)

1. **Reconciliation toast guard: tracked-set membership replaces the "<60s old" window.** Toast fires for (a) live realtime complete/failed events and (b) reconciliation completions of jobs this session was actively tracking. Re-audit (Pass 2 toast-on-app-open): cold start fetches only ACTIVE rows → historical completions never toast ✓; locked-phone completions of tracked jobs DO toast on unlock — matches the brief's "toast fires regardless of where Syd is" verification path better than the time window ✓.
2. **Shimmer delivery: file-local `AiFillShimmerContext` instead of prop-threading.** `PillDetailField` has ~25 call sites; one provider at the tab root (value = existing `retryRunning` prop) eliminates per-site misses. Visible primitive unchanged from plan (pulse block, skeleton-register anchor). `EmptyNote` component swaps the four paragraph-register "—" sites element-for-element. How-to-Grow rows arrive with literal "—" pre-applied by the page → the em-dash counts as empty for shimmer.
3. **Enqueue-gap guard:** local `enqueueInFlight` state bridges click→response so the button can't double-fire before the job lands in `activeJobs` (DB unique index backs it server-side).

## Phase 4 results (2026-06-11)

- `npm run test:run` → **651/651 pass** (was 636 post-Ship-2; +15: 7 aiFillToast, 8 enqueue route).
- `npm run build` → compiled clean; `/api/ai-fill/enqueue` + `/api/cron/ai-fill-jobs-sweeper` registered.
- e2e grep → no assertions on AI Fill strings; old button labels unchanged.
- Preview screenshot skipped per brief (no screenshots; profile surface auth-blocked; realtime needs a live session).
- Acceptance criteria 1–8 individually verified (1–2 via code trace + route tests; 3–4 via context implementation + toast tests; 5 via unchanged route semantics; 6 via partial unique index + dedupe test; 7 via staleness guard + sweeper; 8 this section).
- **Pushes HELD:** migration (`supabase db push`) + code push both await Syd greenlight (schema ship). Apply order: migration FIRST (realtime publication + RLS must exist before clients subscribe), then code push. Also requires `CRON_SECRET` env var added in Vercel before the sweeper cron can run.

## Verification plan

- `npm run test:run` + `npm run build` in worktree (Phase 4). No screenshots per brief.
- Syd verification path (post-greenlight + deploy + migration): brief's script — click AI Fill → spinner+shimmer → navigate to Garden → return (state persists) → completion toast anywhere → profile populated w/ provenance → repeat with Overwrite.

---

## Addendum 2026-06-11 (same day) — per-field shimmer REMOVED after Syd dogfood

**D10 superseded.** Syd dogfooded Overwrite All and reported visual weirdness: empty fields shimmer while already-filled fields stay static, creating a mixed gray/normal patchwork that reads as broken — exactly the honest-per-field-signal trade-off D10 accepted, judged wrong in practice. Decision locked via Dispatch: **drop the per-field shimmer entirely; the button spinner is the sole "AI is running" indicator** (NORTH_STAR §2 "Take mental load OFF the user" — one consistent signal beats a mixed patchwork the user has to interpret).

**What changed** (follow-up ship, this addendum's commit):
- `VaultProfileAboutTab.tsx` — `AiFillShimmerContext` + `FieldShimmer` + `EmptyNote` removed; `PillDetailField` shimmer branch removed; the four paragraph-register sites restored to the literal `<p className="text-sm text-neutral-500">—</p>`; provider wrapper back to a fragment. `retryRunning` prop KEPT (the B5 Try Again button consumes it).
- Stale doc-comments updated in `AiFillJobsContext.tsx` + `enqueue/route.ts` (no behavior change).
- Everything else from this ship — jobs table, enqueue worker, context, realtime, reconciliation, toast, sweeper — unchanged.

**Latent bug fixed by the removal:** the shipped `EmptyNote` rendered `<EmptyNote />` recursively on its own non-running branch (instead of the em-dash paragraph) — infinite render recursion that would crash any profile rendering the Propagation section with an empty notes field while no job was running. Escaped Phase 4 because no component test covered the tab and the collapsed-by-default section hid it from the build/preview pass. Removal eliminates the component entirely.
