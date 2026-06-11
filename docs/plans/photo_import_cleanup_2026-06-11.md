# Photo Import Comprehensive Cleanup — 2026-06-11

> Dispatch-spawned pre-tester sweep of the Photo Import path (Add Plant → Photo Import +
> Add Seed Packet → Photo Import). Base: `origin/main` @ `6071916`, isolated worktree
> `chore/photo-import-cleanup`.
>
> **Brief-source caveat:** the brief's required reads `agent/memory/project_gt_queued_chapters.md`
> + `project_gt_pre_tester_roadmap.md` are the Dispatch orchestrator's own memory and do not
> exist on this machine (searched `~/.claude` tree + repo). The literal "5 dogfooded items"
> list was unavailable; this audit independently re-derived the findings from the live code
> paths. Reconciliation ask is in the close-out report.

---

## 1. Audit findings — the live flow vs the maze

**Live Photo Import path (verified by trace):** FAB → Add Plant / Add Seed Packet → Photo
Import → `BatchAddSeed` (capture → `ImageCropModal` crop → inline `/api/seed/extract` per
item → Confirm & Save) → `handleSaveToVault` → `setPendingPhotoHeroImport` →
`/vault/import/photos/hero` (find-hero per item, F13 `imageLoads` verification) →
`/vault/review-import` → Save All.

| # | Finding | Verdict | Severity |
|---|---|---|---|
| F-A | `BatchAddSeed` carries 3 dead functions: `handleSaveAll` (113-line direct DB save that ignores `addPlantMode` — would create seed packets for Add Plant flows if ever rewired), `processFilesWithGeminiAndRedirect` (only writer of `setPendingPhotoImport`), `processOrderConfirmation` (+ `orderInputRef`, `orderProcessing`, `geminiProcessing`, `batchProgress`, `saveSuccessCount` states and their JSX). None is referenced by any handler/JSX (grep-verified). Consequence: **`/vault/import/photos/page.tsx` is unreachable** — its only feeder is the dead function. | REAL — dead code | Cleanup (hazard if rewired) |
| F-B | `processOneItem` posts the **uncompressed** cropped image (ImageCropModal outputs a natural-resolution crop, no resize — verified `handleConfirm` canvas math) as base64 to `/api/seed/extract`. Every sibling AI-image path compresses first (`processOrderConfirmation`†, `handleSaveToVault`, `handleSaveAll`†, AddPlantModal uploads, review-import uploads — all via `compressImage` 1200px/0.85). †dead but consistent. | REAL — cross-flow image-handling divergence | Perf/cost bug (slow scans, Gemini payload, localStorage quota pressure) |
| F-C | Capture CTA uses `bg-emerald` (= emerald-500, tailwind.config DEFAULT) in BOTH `BatchAddSeed.tsx:874` and `BatchAddSupply.tsx:370`. VISION §8 emerald split: action CTA = `bg-emerald-600 hover:bg-emerald-700`; emerald-500 is the STATE/SELECTION shade. Progress-bar fills correctly stay `bg-emerald` (semantic non-CTA carve-out). | REAL — token-lock violation (2 siblings, same class) | Cohesion |
| F-F | `hero/page.tsx:195` hardcodes `source: "purchase_order"` when building review data — written for the PO→hero roundtrip, but the photo flow lands here too. Photo imports then render the PO review chrome: "Step 1: Import Review" header, PO field labels/visibility splits (review-import lines 1213/1227/1421/1509+), and in addPlantMode the save writes a bogus `source_po_ref` journal artifact (line 870) alongside the correct `image_file_path`. | REAL — strict bug | User-visible drift + data pollution |
| F-G | `hero/page.tsx` reads `pending.addPlantMode` but **never reads `pending.defaultProfileType`** — `defaultProfileTypeRef` stays `"seed"`. Add Plant → Photo Import with type Permanent: profile inserted `profile_type: "seed"`, `is_permanent_planting: false`, care templates copied + harvest task created for a permanent plant. Affects the PO→hero roundtrip identically (review-import `handleGoToHeroPhotos` stores the type at line 617; hero page drops it). | REAL — strict bug | Wrong list (Active Garden vs My Plants) + wrong tasks |
| F-D | `photos/page.tsx:170` uses plain `fetch` for `lookup-by-identity` (vs `fetchWithRetry` siblings). Page is unreachable (F-A), so moot. | MOOT (dead page) | — |
| F-E | `hero_image_url: heroUrl \|\| "/plant-placeholder.png"` fallback — matches the canonical `buildPlantProfileInsertPayload` fallback; existing-profile guard excludes placeholder (review-import:796). | NOT A BUG — canonical pattern | — |
| F-H | `processOneItem` `useCallback` deps `[]` close over `authSession.access_token` — mid-batch token rotation would 401. | REAL — edge nit | Fixed (1-line dep) |
| F-I | **(found mid-build; re-audited)** `ImageCropModal` fires `onConfirm` THEN `onClose` on Apply (`handleConfirm` → `onConfirm(blob); onClose();`). BatchAddSeed popped `cropQueue` in BOTH callbacks → two pops per Apply → **every second photo in a multi-photo batch silently dropped** (cropped photo A queued, photo B's crop-queue entry popped + blob URL revoked uncropped, photo C shown next). Cancel (onClose only) was correct. Sibling sweep: shed/review-import, vault/[id] hero crop, QuickAddSupply are single-image callers with idempotent close — unaffected. Fix: single pop lives in `onClose`; `onConfirm` only enqueues. | REAL — strict bug | Data loss (photos silently dropped) |

**Already-consistent (verified, no change):** AddPlantModal manual-photo uploads compress
(`compressImage` :397/:560); review-import + saveManualImportItem compress all uploads; F13
`imageLoads` verification live on hero page; F19 multi-item warning live in both extract paths;
`FormError` + emerald-600/700 submit + `SubmitLoadingOverlay` patterns from the form-parity
sweep (`650a1e6`) intact in BatchAddSeed (its overlay deferral is an intentional NON-target
per that plan §2).

## 2. Canonical pattern + NORTH_STAR justification

- **One save path** for photo import: review-import Save All. Removing the dead direct-save
  (`handleSaveAll`) and the orphaned pipeline feeder enforces **"No duplicate paths"** at the
  code level — the dead path is a second, divergent renderer of the same concept (it ignores
  `addPlantMode`, skips journal/instance creation) one rewire away from resurfacing.
- **One image-handling rule**: every image leaving the client is `compressImage`-bounded
  (1200px / 0.85). F-B fix moves compression to the crop-confirm point so extract, storage
  quota, and upload all see the bounded file. **"Take mental load OFF the user"** — faster
  scans, fewer "too many/large photos" quota errors the user has to reason about.
- **One review surface per source**: threading real `source` through `PendingPhotoHeroData`
  makes the review page render photo-import items as photo imports. **"No duplicate paths"**
  (same content, one treatment) + **"Take mental load OFF the user"** (no "why does it say
  Step 1 / purchase order?" reconciliation).
- **Emerald split lock** (VISION §8): Capture = action CTA → emerald-600/700. Anchor: 40+
  file FAB-form submit saga + form-parity sweep `650a1e6`.

## 3. Changes

| File | Change |
|---|---|
| `src/components/BatchAddSeed.tsx` | Remove dead: `handleSaveAll`, `processFilesWithGeminiAndRedirect`, `processOrderConfirmation`, `orderInputRef`, `orderProcessing`, `geminiProcessing`, `batchProgress`, `saveSuccessCount` (+ JSX branches: gemini overlay, "Saved to vault" body, "Done" footer) + now-unused imports (`setReviewImportData`, `setPendingPhotoImport`, `OrderLineItem`, `parseVarietyWithModifiers`, `normalizeForMatch`, `getTagsFromText`, `applyZone10bToProfile`, `toCanonicalDisplay`, `EXTRACTION_RETRY_FAILED`, `useOnboardingContextOptional`) + `onSuccess` prop. Compress at crop-confirm (`resizeImageIfNeeded` on the cropped file). Crop-queue double-pop fix (F-I): `onConfirm` enqueues only; the single pop lives in `onClose`. Capture CTA → emerald-600/700. `processOneItem` dep fix. `handleSaveToVault` passes `source: "photo"`. |
| `src/components/BatchAddSupply.tsx` | Capture CTA → emerald-600/700 (sibling alignment, same lock). |
| `src/lib/reviewImportStorage.ts` | `PendingPhotoHeroData.source?: ReviewImportSource`. |
| `src/app/vault/import/photos/hero/page.tsx` | Read `pending.defaultProfileType` into ref (F-G); carry `pending.source ?? "purchase_order"` (back-compat default for in-flight pre-deploy batches) into review data (F-F). |
| `src/app/vault/review-import/page.tsx` | `handleGoToHeroPhotos` passes `source: importSource` into `setPendingPhotoHeroImport`. |
| `src/app/{page,calendar,journal,garden}/page.tsx`, `src/app/vault/VaultPageContent.tsx` | Drop now-removed `onSuccess` prop from `<BatchAddSeed>` (5 callsites). |

**Not changed (escalated/deferred — see §5):** `/vault/import/photos/page.tsx` deletion;
hero-finder architecture items (BUGS.md #6 "2B" URL validation, IMPORT_FLOW_AUDIT 0b deferred
hero); `lookup-by-identity` retry (moot with dead page).

## 4. Audit passes

- **Pass 1 (factual):** every cited line read directly this session (BatchAddSeed full file;
  photos/page full; hero/page full; review-import 200–500 + 590–697 + 698–1027;
  reviewImportSave full; reviewImportStorage 60–260; ImageCropModal full; AddPlantModal
  940–1079; tailwind.config emerald block). Dead-code claims grep-verified across `src/`
  (`handleSaveAll` / `processFilesWithGeminiAndRedirect` / `processOrderConfirmation` /
  `setPendingPhotoImport` have zero live callers). Bidirectional trace: no modal open/close
  state-machine shape changes (deletions + data-threading on existing flags); the one
  lifecycle-adjacent edit (crop-confirm async) keeps the same setQueue/setCropQueue ordering.
  **Clean.**
- **Pass 2 (concerns hunt)** — categories: *double hero-fetch on source flip* (review-import
  auto-hero effect skips items with `hero_image_url` or `imageBase64` — photo items always
  have both → no re-fetch); *stale localStorage batches across deploy* (missing `source` →
  defaults to `"purchase_order"` = today's behavior, no regression); *PO flow regression*
  (handleGoToHeroPhotos now passes its real source — identical value); *quota errors* (compression
  shrinks stored base64 — strictly better); *onSuccess removal* (only consumer was dead code;
  shopping-list refresh after photo import was never firing from this component — review-import
  owns post-save effects incl. `reportAction("seed_added")` :1157); *crop-confirm async race*
  (sequential queue shift unchanged; compression happens before enqueue, modal stays open until
  onConfirm resolves? — no: onConfirm fires, modal advances via setCropQueue immediately, compression
  completes before setQueue → item appears compressed; ordering per-item preserved since both
  setters are called in the same async fn in order); *test coverage* (no unit/e2e references
  to removed symbols — grep clean); *persona walk* (Walter/Aria: permanent plants land in My
  Plants correctly, no bogus harvest tasks; Sam: review page no longer shows PO jargon for a
  photo flow; Maya: faster batch scans; Sydney: consistent chrome — no exclusions). **Clean.**
- **Pass 3 (sibling sweep):** BatchAddSupply capture CTA aligned in-ship (BLOCKING peer);
  progress-bar `bg-emerald` fills left as-is across both components (semantic carve-out —
  matches Schedule/legend precedent). ADJACENT: `BatchAddSupply` has no crop step and posts
  compressed images already (`resizeImageIfNeeded` at :182 path — verified its extract call
  uses `fetchWithRetry` + compressed base64), no divergence. E2E-scope grep: zero label
  changes; `e2e/` greps for "Photo Import" / "Save to Vault" / "Continue to Import Review"
  → no matches. **Clean.**
- **Pass 4 (lock hygiene):** enforces VISION §8 emerald split; touches no §10 don't-touch,
  no contexts/nav state machines (UniversalAddMenu untouched), no ROADMAP §6 conflicts; the
  FAB-form submit saga lock is reinforced, not modified. No schema/migration/RLS/auth →
  auto-push tier per CLAUDE.md push tiers (2026-06-07 relaxation). **Clean.**

## 5. Escalations + deferrals

- **E1 — `/vault/import/photos/page.tsx` fate.** Now provably orphaned (only feeder was dead
  code). Options: (a) delete the route next ship, (b) resurrect the direct multi-photo
  pipeline as a no-crop bulk path. Recommend (a) — the crop→inline-extract flow superseded it
  and "No duplicate paths" argues against keeping a second pipeline. Route deletion is a
  product-surface call → Syd decision, not shipped here.
- **D1 — Hero-finder investigation** (brief item 2): BUGS.md #6 ("2B" — Tier-4 hero URLs
  persisted without load validation via `background-hero-for-profile`) + IMPORT_FLOW_AUDIT
  rec 0b (defer hero search to post-import). Both M-sized architecture items, already
  registered; out of cleanup scope. The client-side F13 `imageLoads` guard covers the
  photo/PO interactive path today.
- **D2 — `lookup-by-identity` plain fetch** in dead photos page — moot unless E1 resurrects it.
