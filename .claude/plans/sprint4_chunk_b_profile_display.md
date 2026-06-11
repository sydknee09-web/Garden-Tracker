# Sprint 4 Chunk B — Profile display split + pill+detail + responsive Propagation + sticky anchor nav + couldn't-find UX

> Execution plan. Branch `feat/instance-detail-page` (pushes HEAD:main, even with origin/main at `1ff86ab`).
> Brief: Dispatch 2026-06-10. Plan-doc: `docs/plans/sprint4_plant_profile_instance_bundle.plan.md` §2 Chunk B.
> Greenlight: the Dispatch brief is the execution greenlight ("drive autonomously"; auto-push tier qualifies — pure UI/display/backend-logic, no schema/RLS/auth/data-loss).

## Purpose
Ship B1 (Characteristics / How to Grow split) + B2 (pill+detail primitive) + B3 (responsive Propagation) + B4 (sticky anchor pills) + B5 (variety-not-found honest empty-state + backend 2-shape contract) + B6 (Edit modal cleanup).

## Acceptance criteria
- AI returns `{found:false}` → toast `Couldn't find data for this plant. Check the spelling of name and variety.` + inline notice + Try Again on profile; nothing cached under the variety key; no species fallback anywhere.
- About tab renders **Plant Characteristics** + **How to Grow** scroll sections (Title Case headers), pill+detail for data-rich paired fields, **Propagation** section adapting to `propagation_method`, no "tap ✨" default CTAs.
- Sticky pill anchor row on About tab: auto-generated from content sections, scroll-spy active state, smooth scroll, horizontal scroll on mobile.
- Edit modal: Type toggle replaced by Lifecycle dropdown (gray-fill, Annual/Biennial/Perennial, derives profile_type on save only when set); "Plant Type" → "Plant Name"; helper text dropped.
- Tests + build green.

## Files
1. `src/lib/researchVariety.ts` — exact-match-only prompt + `found` discriminator; REMOVE species fallback (deepFieldCount / THIN_RESULT_THRESHOLD / mergeFillingBlanks / fallback block). New return: `{found:true,data} | {found:false} | null` (null = AI failure, distinct from not-found).
2. `src/lib/researchVariety.test.ts` — rewrite for new contract.
3. `src/app/api/seed/extract/route.ts:439-453` — adapt `researchVarietyForExtract` (found:false → null).
4. `src/lib/backfillPlantDescriptionsBatch.ts:278`, `src/lib/backfillCacheBatch.ts:114`, `scripts/backfill-global-cache.ts:184`, `scripts/backfill-plant-descriptions.ts:403`, `scripts/data-hygiene/cleanup.ts:216` — unwrap union (found:false → skip, same as no-data).
5. `src/app/api/seed/enrich-from-name/route.ts` — found:false → `{enriched:false, found:false}`, NO cache upsert; found:true → flat response + `found:true`; cache hit → `found:true`. **Tactical: flat shape retained** (4 existing consumers spread it; nesting `data` is churn with zero user-visible gain; locked substance = 2-outcome contract + cache rule, honored).
6. `src/app/api/seed/enrich-from-name/route.test.ts` — wrap mocks, add found:false + no-cache-on-not-found tests.
7. `src/app/api/seed/fill-blanks-for-profile/route.ts` — propagate `notFound:true` in response when enrich returns found:false.
8. `src/app/vault/[id]/useVaultEditHandlers.ts` — toast priority for notFound (locked copy); `aiNotFound` state + dismiss/clear rules (clear on successful fill, on edit-save, on dismiss); editForm `lifecycle` replaces `lifecycleType`; save derives profile_type from lifecycle ONLY when lifecycle set (else omit — preserves existing value).
9. `src/app/vault/[id]/page.tsx` — widen profile select (all Sprint-4 columns + mature_height/mature_width); build howToGrow list; pass new props to About tab; B6 edit-modal JSX (Lifecycle gray-fill select, Plant Name label, drop helper).
10. `src/app/vault/[id]/VaultProfileAboutTab.tsx` — B1/B2/B3/B4/B5-notice. New `PillDetailField` primitive; Characteristics + How to Grow sections; Propagation section (renamed, responsive); sticky anchor pills + IntersectionObserver scroll-spy; inline not-found notice + Try Again.
11. `src/types/garden.ts` — extend PlantProfile with the Sprint-4 columns.

## Audit log

### Pass 1 — factual (clean after 2 runs)
- Chunk A migration verified on disk (`20260610120000_sprint4_plant_profile_enrichment_fields.sql`): all B1 fields exist EXCEPT **bloom_color, bloom_season, hardiness zone range, expected_lifespan_years, germination temp** — named in the brief's B1 list but never added in Chunk A; migrations are locked out of scope this chunk → **these fields are skipped and reported back** (rendering them would require schema work = scope violation).
- `researchVariety` callers enumerated by grep: 6 call sites + re-export at `extract/route.ts:176`. Union forces compile-time adaptation everywhere (no silent behavior change in backfills).
- Profile AI buttons call `/api/seed/fill-blanks-for-profile` (NOT enrich-from-name directly) → found flag must thread: researchVariety → enrich-from-name → fill-blanks → client. Verified fill-blanks parses enrich JSON at :249.
- enrich-from-name cache upsert occurs only on AI success path (:308-367) — found:false branch returns before it. Cache-stays-null verified by construction + new test.
- page.tsx:201 select lacks ALL new columns (and mature_height/mature_width) → widened.
- e2e grep for "Propagate / Save Seeds", "Plant Type", "Seasonal", "How to Grow", "tap ✨": **zero hits in e2e/** (e2e-scope sub-rule satisfied; strings changed are not asserted).
- `aboutCollapsed` map shared with VaultProfileCareTab — its only key is `historicalTasks`; new key `characteristics` collision-free.
- State-transition note (bidirectional matrix N/A): no modal/menu lifecycle change. The only state machine added is scroll-spy (observer attach/detach on section refs) — covered in Pass 2.

### Pass 2 — concerns hunt (categories: state transitions, null/empty/many, optimistic-vs-refetch, mobile/desktop split, cohesion-by-aggregation, persona walk, test gaps)
- **found:false vs null split**: null (network/parse fail) must keep mapping to "AI unavailable", found:false to couldn't-find. Toast priority order in client: notFound → fieldsFilled>0 → error/quota → nothing-new. Edge: overwrite path can set hero (fieldsFilled=1) AND notFound — notFound wins (honest about data fields).
- **aiNotFound persistence**: session-local React state (no schema changes allowed). Survives tab switches within page, not reloads — acceptable: toast already informed; reload shows plain "—" per §10 empty-by-default.
- **Lifecycle empty on legacy profiles**: derive profile_type ONLY when lifecycle non-empty; omit otherwise → no clobber of existing seasonal/permanent behavior (Q1 derived-back-compat preserved).
- **Scroll-spy lifecycle**: IntersectionObserver created once per section-set render, disconnected on unmount/tab-switch (About unmounts on tab change — observer cleanup in useEffect return). Tap-scroll vs spy race: tapping sets active immediately; observer corrects on settle (standard pattern, no lock needed).
- **Empty-density (Aria/Sam personas)**: Characteristics on a sparse profile = many "—". Mitigation: rows with no value AND no detail render in the dl grid as "—" per locked convention (correct, not a bug per VISION §10); pill+detail rows hide the detail line when empty. Persona walk: Maya gets depth; Sydney gets one primitive reused; Walter gets ≥44px pills + visible-button Try Again; Aria/Sam see calm "—" grid not broken UI; all 5 pass.
- **Cohesion anchors (every new visual cited)**: section cards = existing About collapsed-card register (`bg-white rounded-xl border border-neutral-200` + chevron button, VaultProfileAboutTab.tsx:97); pill token = tab-slot/toggle register `bg-neutral-100` container + active `bg-white text-emerald-700 shadow-sm` (VISION §8 single-state tab-slot, VaultPageContent); value pills = TagBadges-style `rounded-full px-2 py-0.5 text-xs font-medium` neutral; detail text = info-note-adjacent `text-sm text-neutral-600` (non-italic — it's primary field detail, not aside); inline notice = info-note italic register (VISION §8) + secondary teal Try Again button (button-system secondary tier); smooth scroll = scrollIntoView precedent (CareScheduleManager.tsx:113); scroll-mt precedent (VaultProfileJournalTab.tsx:44).
- **Test gaps**: new unit tests for found-contract (lib + route). UI sections not unit-tested (no existing AboutTab test precedent — consistent with siblings).

### Pass 3 — sibling sweep
- e2e: clean (above). 
- "Tap the ✨" CTA grep: 2 sites in AboutTab (removed by B3) + 1 in settings/profile zone-change notice (different context — instructional, not an empty-state CTA; LEFT, named here as ADJACENT).
- Pill+detail introduced as ONE component reused across Sun/Water/Soil/Pollination/Toxicity/etc. (NORTH_STAR §1 — no per-field treatments).
- **BLOCKING-resolved**: B4 brief pill list includes Plants/Packets/Journal — these are TABS; adding them to the pill row would duplicate the tab strip one row above (NORTH_STAR §1 "No duplicate paths"). Pills cover About scroll sections only (Characteristics / How to Grow / Companion Planting / Propagation). Reported as tactical deviation.
- Casing: section headers Title Case ("Plant Characteristics", "How to Grow", "Propagation", sub-headers "Propagated by Division" etc.); notice body sentence case; toast sentence case (locked copy verbatim).
- Edit-modal label "Plant Name" matches brief verbatim; in-modal siblings are Title Case ("Variety Name") so consistent in place. (VISION §8 says field labels sentence case — the whole modal predates that sweep; flagged as ADJACENT cohesion item, not fixed here.)

### Pass 4 — lock hygiene
- VISION §10 empty-by-default: honored ("—" on unpopulated; honest not-found notice aligns).
- Locked toast/notice copy used verbatim (plan-doc A7 Leg-4 + B5 FINAL).
- profile_type stays derived (Q1 lock) — no rip-out.
- No VISION §10 don't-touch surfaces; no parked §11 items touched (stroke-weight parked item unaffected — pills are text chips).
- Q8 lock honored: both tiers visible, no tap-to-expand.

### Amendment — concurrent-session collision detected mid-execute (2026-06-10 20:54)

- **Trigger:** `npm run build` failed with a JSX syntax error in `page.tsx` at a hunk I never wrote. `git diff` shows a SECOND session working in the SAME working tree (not a worktree): EditPacketModal integration on the Packets tab, QuickLogModal `preSelectedPacketId`, edit-grow modal flex-col-shell restructure — `QuickLogModal.tsx` mtime was 6s old at detection. Their in-flight hunk (`{editGrowTarget && (` followed by a bare `{/* … */}` before the JSX element) is the build breaker — a JSX comment is illegal at that expression position.
- **Decision (Pass 2 race-condition category, applied to ourselves):** do NOT race the other session on shared files. My page.tsx hunks are complete; remaining work is verify+commit, which needs a settled tree. Watching for tree-quiet (3 min) or a new HEAD commit, then reconciling.
- **Commit-separation risk (named):** page.tsx now interleaves both sessions' hunks; file-level staging can't separate them. Resolution path: if the other session commits first, my residual diff commits cleanly after; if it goes quiet without committing and the syntax error remains, I fix the one-line syntax error (minimal repair, preserving their work) so verification can run, and flag the shared-tree hazard in the report (process finding: parallel execution chats should use worktrees per `.claude/worktrees/` or sequence chunks).
- Pass 1/3/4 unaffected (no plan-scope change; no new files in my scope).
