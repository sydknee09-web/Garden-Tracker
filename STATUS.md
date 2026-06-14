# Garden Tracker — STATUS (single source of truth)

**Last updated:** 2026-06-14 (Sprint 12 Phase 3 — Planting History UX + back-label sweep shipped `4ac6134`)

> **What this doc is.** The ONE place to check "where are we right now." Scannable, mobile-friendly, plain language. When Syd asks for "status" or "the plan," this is the answer — not a paraphrase.
>
> **How it relates to the other docs:**
> - **`STATUS.md`** (this file) = the live snapshot. Update it on every state change.
> - **`docs/ROADMAP.md`** = the running narrative (§1) + dated decision log (§6) + full ship history (§5). The deep detail; this file is the skim layer on top.
> - **`.claude/plans/gt_v1_scope.md`** = the v1 ship-gate framework + the % math (a *local* planning doc, not committed to the repo).
> - **`docs/PROJECT_STATUS.md`** = **superseded by this file** (it drifted; left in place with a redirect banner).
>
> **Naming convention is LOCKED** — see [CLAUDE.md "Sprint.Phase naming convention"](CLAUDE.md). Every plan / commit / spawned chat uses `Sprint N Phase X: <desc> [Foundation | Dogfood | Polish]`.

---

## ⚠️ Read this first — the numbering is being un-tangled

Syd's 2026-06-14 feedback was right: there have been **three different "Sprint" counters running at once**, which is why nothing lined up. This doc documents all three honestly (it does **not** pretend the mess away). The naming lock + this doc stop new drift going forward.

| Counter | Where it lives | What it covers | Status |
|---|---|---|---|
| **#1 — v1 gate sprints (canonical math)** | `.claude/plans/gt_v1_scope.md §4` (local) | Sprint **1–5**: the original pre-tester roadmap with the v1 % math | The authority for "are we v1-ready?" — **~83% to v1** as of 2026-05-30 |
| **#2 — June IA-restructure labels** | git commit messages | "Sprint **2 / 3 / 4** Chunk A/B" — packet pages, instance page, AI enrichment, profile display (restarted counting in June) | Retired — collides with #1's low numbers; superseded by #3 |
| **#3 — Dispatch continuation line (LIVE)** | git commits + `.claude/plans/sprint*.md` | "Sprint **6 / 8 / 9 / 10 / 11 / 11.5** Phase 2a/2b" — the orchestrator's continuation counter | **The active counter.** High-water mark = Sprint 11.5 Phase 2b (shipped) |

**The fix going forward:** ONE counter — **#3** (see [§ Going forward](#going-forward--the-single-counter)). History below is shown under the numbers it actually shipped with, with overlaps + gaps flagged. Renumbering the past would add confusion, not remove it.

---

## A) Where we are right now

**Date:** 2026-06-14. **Latest shipped code:** `bfb5a17` (Sprint 13 — consumePackets archive-not-soft-delete forward-fix). Backfill migration was committed then reverted (`70e50b9`) per Syd's Option-C call.

- **Just shipped (counter #3):** **Sprint 13 — packet-history forward-fix (Option C, NO backfill)** (`bfb5a17`). `consumePackets` archives instead of soft-deleting consumed packets (`qty=0, is_archived=true`, no `deleted_at`), matching the 4 other consume paths — every NEW consumption stays visible in "Used up (N)". **Backfill explicitly SKIPPED per Syd 2026-06-14 20:04:** her account is years of test-data bug exposure new users won't have; the forward-fix gives every new account the clean experience without touching her historical mess. The 19 already-tombstoned packets on her account stay as-is — she'll manually un-archive specific cases (e.g. Parsley) from Developer tools if wanted. The committed migration was reverted (`70e50b9`); never applied to prod.
- **Prior ship (counter #3):** **Sprint 13 Phase C (1/2) — "Previously owned" filter fix** (`ceb6776`). Library/Vault "Previously owned" toggle no longer uses the `plant_profiles.status` proxy (which false-matched profiles that never had a packet — the Parsley dogfood bug, Sprint 12 Phase 2 #73). New `ever_owned` signal (profile has ≥1 packet row EVER, incl. archived + soft-deleted history) gates the toggle via `isPreviouslyOwned(ever_owned && packet_count===0)`. Non-destructive; no migration. **Held (Phase C 2/2):** the destructive backfill migration + `consumePackets` soft-delete forward-fix — pending Syd's Phase A SQL classification + migration greenlight (fuzzy consumption-vs-deletion predicate → Syd-ASK).
- **Prior ship (counter #3):** **Sprint 12 Phase 3 — Planting History UX + back-button sweep** (`4ac6134`). Planting History back → Settings (named label); mobile cards; "Currently growing (N)" / "Archived plantings (N)" sections; app-wide honest-label back-button sweep on 10 single-parent pages.
- **In flight (counter #3):** **Sprint 13 packet-history architecture** — Phase A diagnostic queries authored for Syd (live SQL not runnable from this checkout); Phase B locked on **Option B** (unify on `is_archived`; `deleted_at` = true-deletion-only); Phase C 2/2 (backfill + consumePackets fix) awaiting Syd's Phase A data + migration greenlight.
- **v1 readiness:** **~83% to the v1 ship gate** (from the 2026-05-30 math; the large body of June work since then is dogfood polish + IA refinement, not new v1-gate chapters). The remaining v1 blockers are **Syd dashboard actions**, not code — see [§ G](#g-v1-launch-checklist).

> **One-line address today:** *"Sprint 12 Phase 3 (Planting History UX + back-label sweep) just shipped — counter #3 is the live line. No code in flight; awaiting Syd dogfood confirmation."*

---

## B) Sprint hierarchy

### Layer 1 — v1 gate sprints (counter #1, canonical math) — `gt_v1_scope.md §4`

The original 5-sprint pre-tester roadmap — the spine the v1 % math is built on. All five are shipped except for Syd's launch-checklist dashboard actions.

| Sprint | Scope | Origin | Status |
|---|---|---|---|
| **Sprint 1** | Infrastructure + IA Ship A (Plants tab, 6-tab nav, FAB +Add Variety) | [Foundation] | ✅ SHIPPED |
| **Sprint 2** | Plant instance Phase B (visual overhaul) + Care-tab data model + migration guard/indexes | [Foundation] | ✅ SHIPPED |
| **Sprint 3** | Garden + Groups (IA Ship B merge) + Care tab UI + contextual-add fixes | [Foundation] | ✅ SHIPPED |
| **Sprint 4** | Established plants + FAB-tree cohesion sweep + Zone polish | [Foundation] | ✅ SHIPPED (closed 2026-05-29) |
| **Sprint 5** | Pre-launch polish + v1 gate items (casing, sort, onboarding, launch checklist) | [Foundation] | 🟡 IN PROGRESS — all *code* shipped; remaining = Syd dashboard actions (L1/L2/L5) |

**Sprint 5 v1-gate chapters:** MUST #7 casing (`7db44c5`) · #8 sort (`a4f2235`) · #9 contextual-add (`8897fe8`) · #14 onboarding (`3e4c02a`) — all ✅. SHOULD polish bucket #15–#21 = 7/7 ✅. **#13 launch checklist L1+L2 = ⏳ pending Syd.**

### Layer 2 — Dispatch continuation (counter #3, LIVE) — since 2026-05-30

Dogfood-driven + IA-refinement work after the v1 plan. This is the live counter. Newest first; **all shipped to origin/main.**

| Address | Scope | Origin | Status |
|---|---|---|---|
| **Sprint 13 Phase C (1/2)** | "Previously owned" filter on real packet history (`ever_owned`) — fixes Parsley false-positive (Sprint 12 Phase 2 #73); `ceb6776` | [Foundation] | ✅ SHIPPED (today) |
| **Sprint 13 Phase A/B + C (2/2)** | Packet-history architecture: Phase A diagnostic queries (Syd to run) + Phase B Option-B lock + held backfill migration & consumePackets soft-delete forward-fix | [Foundation] | 🟡 IN FLIGHT — awaiting Syd Phase A data + migration greenlight |
| **Sprint 12 Phase 3** | Planting History UX: back→Settings (named label) + mobile cards + "Currently growing (N)" / "Archived plantings (N)" sections; app-wide honest-label back-button sweep on 10 single-parent pages — `4ac6134` | [Dogfood] | ✅ SHIPPED |
| **Sprint 12 Phase 2** | Diagnostic chat (`local_dd0515d1`) — no code; produced the Q1–Q9 Planting History + back-button findings that Phase 3 implements | [Dogfood] | ✅ DIAGNOSTIC (no code) |
| **Sprint 12 Phase 1** | Archive consistency bundle: profile Packets/Plants counts exclude archived + used-up (+ "Used up (N)" / "Past plantings (N)" subsections); retire dev Archived Plantings browser into guarded Planting History delete; fix stale copy — `68f015d` | [Foundation] | ✅ SHIPPED (today) |
| **Sprint 11.5 Phase 2b** | Full filter sweep (Library/Packets/Garden refine modals) — `13c4770` | [Dogfood] | ✅ SHIPPED (today) |
| **Sprint 11.5 Phase 2a** | Relocate plant_category chips into Filter modal (first Category section) — `5294a51` | [Dogfood] | ✅ SHIPPED |
| **Sprint 11.5 #28** | Canonical plant_category primary chip row — `a9cfa6f` | [Dogfood] | ✅ SHIPPED |
| **Sprint 11** | Bundle: shed data-focus layout + modal X-close primitive + How-to-Grow cohesion (`8ddfd30`) + amendment: remove per-section Notes expanders + Planting Depth (`d76d880`) | [Polish] | ✅ SHIPPED |
| **Sprint 10** | Plant profile IA redesign (card reorder + Seed Starting split + sectioned Growing Notes, `52a5f2e`) + per-section Notes expanders (`d794f3c`) | [Dogfood] | ✅ SHIPPED |
| **Sprint 9** | Polish bundle: image-search query + About sub-tab gesture + fill-blanks partial signal (`fc7d90b`) | [Polish] | ✅ SHIPPED |
| **Sprint 8** | Profile display cleanup bundle (`f2c9efa`, findings #43–49, #32) | [Dogfood] | ✅ SHIPPED |
| **Sprint 7** | — | — | ⚠️ NO RECORD in repo (see note) |
| **Sprint 6** | AI-fill quality bundle: rich Growing Notes + full Characteristics + deeper Propagation/seed-saving (`fdf505b`, findings #15/#18/#22) | [Dogfood] | ✅ SHIPPED |

**Also shipped in this window (numbered under the now-retired counter #2, or un-numbered dogfood):** `/library` URL rebrand (`d6cf9ad`); zone-agnostic encyclopedia + viability banner (`9e07161`); AI-fill backgrounding job queue (`860606e`); cover-photo state machine (`de30275`); chrome cohesion sweep (`cd738d3`); photo-import cleanup (`e552799`); branded 404 + error pages (`1c615ab`); Groups follow-ups (`c7fe6f6`+); instance detail page (`02ff1d8`, was labelled "Sprint 3" under counter #2).

> **Ambiguities flagged (not guessed):**
> - **Sprint 7 has no record** in this repo (no commit, no plan file) — it may exist only in the Dispatch orchestrator's memory, or the counter simply skipped it. Named here rather than invented.
> - **Counter #2's "Sprint 3/4 Chunk"** git labels (instance page, enrichment, profile display) overlap counter #1's Sprint 3/4 and **are not a continuation of them** — that double-use is the core of Syd's confusion. Counter #2 is retired.

---

## C) In flight right now

**Nothing in flight. Sprint 13 is CODE-COMPLETE** (forward-fix only, Option C — `bfb5a17`). No migration; no prod data touched.

- **Phase A (DONE 2026-06-14):** 8 "Previously owned" matches → 5 Type-C false-positives (excluded by `ceb6776`), 2 already-correct, 1 Type-B (Parsley, confirmed `has_live_planting=false`).
- **Phase B (locked):** Option B semantics — `is_archived` = canonical used-up state; `deleted_at` = true deletion only (NORTH_STAR §1 + VISION §8:509 + Law 3). The forward-fix implements the go-forward half.
- **Decision (Syd, Option C):** ship the forward-fix only; **skip the historical backfill.** New users get the clean schema from `bfb5a17`; Syd's 19 legacy tombstones stay put. Parsley's "Used up (N)" stays empty on Syd's account until she manually un-archives that packet via Developer tools (her chosen cheap workaround). The committed migration was reverted (`70e50b9`).

---

## D) Shipped recently (chronological, newest last)

| Commit | Address (as labelled) | Summary |
|---|---|---|
| `52a5f2e` `d794f3c` | Sprint 10 (#3) | Plant profile IA redesign + per-section Notes |
| `8ddfd30` `d76d880` | Sprint 11 (#3) | Shed layout + modal X-close primitive + How-to-Grow cohesion; remove Notes expanders |
| `a6605d0` `5ba5141` | (detail polish) | Desktop swipe-chevron centering + visibility on scroll |
| `e15685d` | (polish) | Universal canonical X-close on all modals |
| `a9cfa6f` | Sprint 11.5 #28 (#3) | Canonical plant_category primary chip row |
| `5294a51` | Sprint 11.5 Phase 2a (#3) | Relocate category chips into Filter modal |
| `13c4770` | Sprint 11.5 Phase 2b (#3) | **Full filter sweep across Library/Packets/Garden** |
| `68f015d` | Sprint 12 Phase 1 (#3) | **Archive consistency bundle** — profile Packets/Plants counts exclude archived/used-up (+ Used-up/Past subsections); dev archive browser → guarded Planting History delete |
| `4ac6134` | Sprint 12 Phase 3 (#3) | **Planting History UX + back-label sweep** — back→Settings (named) + mobile cards + Currently-growing/Archived sections; 10-page honest-label back-button sweep |
| `ceb6776` | Sprint 13 Phase C 1/2 (#3) | **"Previously owned" filter on real packet history** — `ever_owned` signal replaces `plant_profiles.status` proxy; fixes Parsley false-positive (#73); non-destructive, no migration |
| `bfb5a17` | Sprint 13 (#3) | **consumePackets archive-not-soft-delete** — Vault Plant flow stops soft-deleting consumed packets (Law-3 archival, not Law-2 deletion); stops new "Used up" history loss |
| `9defc15` → `70e50b9` | Sprint 13 (#3) | backfill migration committed then **reverted** (Syd Option-C); never applied to prod ← HEAD |

*(Full ship history with hashes + dogfood paths: `docs/ROADMAP.md` §5 + §6.)*

---

## E) Queued next

| Address | Scope | Why queued / waiting on |
|---|---|---|
| Sprint 5 MUST #13 (#1) | L1 PITR enable/skip decision + L2 restore drill | **Syd** — ~30 min dashboard actions; the last v1-gate code-independent blockers |
| Sprint 5 L5 (#1) | Backup retention/tier dashboard confirmation | **Syd** — ~5 min dashboard check |
| Next structural work (#3) | TBD — dogfood-driven; **Sprint 12 is now open** (Phase 1 shipped `68f015d`) | Awaiting Syd's next dogfood batch / priority call |
| CAN bucket (`gt_v1_scope §2.3`) | Zone-aware library schema, weather notifications, Calendar widget redesign, standalone-profile audit | **Post-v1** — explicitly deferred, ship as v1.x |

---

## F) Dogfood findings rollup

> **Honest grounding note.** The canonical numbered dogfood register (Syd's "#1–#70") lives in the **Dispatch orchestrator's memory**, which is **not committed to this repo** — so exact per-status counts can't be derived here without fabricating numbers. What's verifiable in the repo is summarized below; the orchestrator memory is the source for the full numbered list.

**Status convention** (per the dogfood-status memory): `PENDING` → `IN-FLIGHT` → `SHIPPED` → `MERGED` → `DEFERRED` → `OBSOLETE`.

**What the repo shows:**
- Findings are tracked **inline in commit messages** — e.g. Sprint 6 (`#15/#18/#22`), Sprint 8 (`#43–49, #32`), plus `#36`, `#51`, `#16b`, `F10`. Commit-referenced findings run at least into the **#50s**; the orchestrator register reportedly reaches ~#70.
- Recent dogfood batches that shipped: AI-fill quality (Sprint 6), profile display cleanup (Sprint 8), Sprint 9/10/11 polish + IA, the full filter sweep (Sprint 11.5), Groups follow-ups, photo-import cleanup, cover photo.
- Separately, **`docs/BUGS.md`** holds the older **U-numbered** bug register (U1–U27; last updated 2026-05-19 — stale). This is a *different* numbering system from the dogfood findings and should not be conflated.

**Sister-bounce / v1-launch blockers:** the Groups work (`c7fe6f6` and follow-ups) explicitly targeted "the sister-bounce blockers (plant location tracking + organization)" and shipped. Any remaining PENDING finding tagged `v1-blocker` or `sister-bounce` should be surfaced here. **(Cannot enumerate the full PENDING set from this checkout — flagged for the next Dispatch sync.)**

---

## G) v1 launch checklist status

Source: `gt_v1_scope.md §3` (6 items, from the 2026-05-28 Supabase + backup audit).

| Item | What | Owner | Status |
|---|---|---|---|
| **L1** — PITR decision | Enable Point-in-Time Recovery (~$100/mo) OR explicitly accept 24h granularity | Syd | ⏳ PENDING |
| **L2** — Restore drill | Trigger a dashboard-clone restore; verify it matches prod | Syd | ⏳ PENDING |
| **L3** — Migration collision guard | CI check failing on duplicate `YYYYMMDDHHMMSS` prefixes | Claude | ✅ DONE (`f793a55`) |
| **L4** — Composite indexes | `grow_instances(plant_profile_id, status)` + `seed_packets(...)` | Claude | ✅ DONE (`c81c3ab`) |
| **L5** — Backup retention/tier check | Confirm Pro tier + 7-day retention in dashboard | Syd | ⏳ PENDING (~5 min) |
| **L6** — Public-storage trade-off | Accept public bucket for v1 OR switch to signed URLs | Syd | 🟣 DEFERRED (post-launch OK) |

**v1 gate math (as of 2026-05-30):** 15 / 18 = **~83% to v1**. Remaining = L1 + L2 (+ L5 should-resolve). All are Syd dashboard actions; **no remaining v1-gate *code* work.** *(The % predates the June Sprint 6–11.5 work, which was polish/IA refinement, not new MUST chapters — so it doesn't move the gate number, but it does raise the polish/quality bar.)*

---

## H) Update log (last 5 entries)

| Date | Address | What changed |
|---|---|---|
| 2026-06-14 | Sprint 13 (#3) | **Option C locked (Syd 20:04):** forward-fix only, NO backfill. Reverted the backfill migration (`70e50b9`, drops `9defc15`'s file) — never applied to prod. Rationale: Syd's account is legacy test-data mess; new users get clean schema from the forward-fix; she'll manually un-archive Parsley etc. from Developer tools. Sprint 13 code-complete. |
| 2026-06-14 | Sprint 13 (#3) | `9defc15` — backfill migration committed (later reverted, see above). Parsley confirmed `has_live_planting=false`. |
| 2026-06-14 | Sprint 13 (#3) | `bfb5a17` — consumePackets archive-not-soft-delete forward-fix. Phase A data in (Syd 19:33): 5/8 Type-C false-positives excluded by `ceb6776`, 1 Type-B (Parsley); discriminator NOT sharp (19 consumption-shaped vs 3 with live planting). Backfill held → recommend Option A (broad, all 19) since Parsley is in the 16-ambiguous; awaiting Syd migration greenlight. |
| 2026-06-14 | Sprint 13 Phase C 1/2 (#3) | `ceb6776` — "Previously owned" filter fix: new `ever_owned` signal (≥1 packet row ever, incl. archived + soft-deleted) replaces the `plant_profiles.status` proxy; fixes Parsley false-positive (Sprint 12 Phase 2 #73). Non-destructive. Phase A diagnostic queries authored for Syd; Phase B locked on Option B; Phase C 2/2 (backfill + consumePackets fix) held pending Syd data + migration greenlight. |
| 2026-06-14 | Sprint 12 Phase 3 (#3) | `4ac6134` — Planting History: back→Settings (named "← Settings" label) + mobile cards (table at md+) + "Currently growing (N)" / "Archived plantings (N)" sections; app-wide honest-label back-button sweep on 10 single-parent pages (settings/* → Settings, debug-log → Developer, settings root + resources + help → Home). Phase 2 was a diagnostic chat (no code). |
| 2026-06-14 | Sprint 12 Phase 1 (#3) | `68f015d` — archive consistency bundle: profile Packets/Plants counts exclude archived + used-up (+ Used-up/Past subsections); retired dev Archived Plantings browser into guarded Planting History permanent-delete; fixed stale "Settings → Archived Plantings" copy. |
| 2026-06-14 | Foundation | **Created STATUS.md** + locked Sprint.Phase naming convention in CLAUDE.md. Documented the 3 colliding counters; flagged ROADMAP/PROJECT_STATUS drift. |
| 2026-06-14 | Sprint 11.5 Phase 2b (#3) | `13c4770` — full filter sweep across Library/Packets/Garden. |
| 2026-06-14 | Sprint 11.5 Phase 2a + #28 (#3) | `5294a51` + `a9cfa6f` — category chips into Filter modal. |
| 2026-06-13/14 | Sprint 11 (#3) | `8ddfd30` + `d76d880` — shed layout + modal X-close + Notes-expander removal. |
| 2026-06-13 | Sprint 10 (#3) | `52a5f2e` + `d794f3c` — plant profile IA redesign + per-section Notes. |

---

## Going forward — the single counter

To stop new drift, **one counter** is the spine from here on:

- **Counter #3 (the Dispatch line) is the live counter.** High-water mark = **Sprint 11.5 Phase 2b**. The next new structural sprint is **Sprint 12**; sub-work within a sprint is **Phase 1, 2, 2a, 2b, …**.
- **Counter #1 (`gt_v1_scope.md` Sprint 1–5) is frozen** as the "v1 gate framework" reference — it keeps the v1 % math but is **not a live counter** anymore.
- **Counter #2 (the June "Sprint 2/3/4 Chunk" git labels) is retired** — no new commits use it.

Every new plan, commit, and spawned chat uses the locked format:

```
Sprint N Phase X: <description>  [Foundation | Dogfood | Polish]
```

See [CLAUDE.md → "Sprint.Phase naming convention"](CLAUDE.md) for the full rule.

> **One open decision for Syd** (this chat's report has the full ask): confirm counter #3 as the forward spine (recommended), or pick a different anchor. Until Syd says otherwise, #3 is treated as canonical.

---

*This is a living doc. Update §A, §C, §D, §H on every state change; refresh §G when a launch item resolves; re-run the v1 math at each sprint close per `gt_v1_scope.md §5.4`.*
