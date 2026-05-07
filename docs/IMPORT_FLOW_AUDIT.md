# Import Flow Audit

**Date:** 2026-05-07
**Purpose:** Full friction audit of every import path (seed and supply) to inform a focused polish project. Companion to [IMPORT_BY_LINK_VS_IMAGE.md](IMPORT_BY_LINK_VS_IMAGE.md), which documents the *exact mechanics*; this doc focuses on **user-visible friction** and **prioritized recommendations**.

**Scope:** Every method by which a user adds a seed packet or supply, including the multi-pass async machinery, the review pages, and the post-save handoff.

---

## TL;DR — Top 5 friction points

In order of estimated impact:

1. **The review page is doing too much** ([vault/review-import/page.tsx](../src/app/vault/review-import/page.tsx) — 1,784 lines). Per-item: 8+ editable fields, hero photo with crop/retry/manual upload, vendor "golden record" priority logic, duplicate detection, identity merging. Users have to absorb all of this on one page after waiting through async passes.
2. **No method memory.** Every import starts at the choose screen even if the user always picks the same method. 1-2 wasted taps per import × frequency = real annoyance.
3. **Seed-vs-supply UX inconsistency.** Link import on the seed side is a *separate page*; on the supply side it's a *modal sub-screen*. Manual on seed has an "Add new vs Link-to-existing" toggle; supply doesn't. Same conceptual operation, different UX.
4. **Edit-after-save is broken on the Packets tab.** If an imported packet has bad data (vendor wrong, photo wrong, notes empty), you can't easily fix it — there's no Edit button on the Packets tab inside the plant profile (already in [BACKLOG.md](BACKLOG.md)). So the review page is the *last chance* to fix things, and that's why it carries so much load.
5. **No state recovery if the browser closes mid-import.** Photo flows hand off via `localStorage` (`pendingPhotoImport`, `reviewImportData`). If the page closes during async passes, items in flight are lost; on next visit there's no "you have an import in progress" prompt.

These are the 5 to fix first. The rest of this doc explains why and lists secondary items.

---

## Surface area

### Seed import paths (5 methods)

| Method | Entry component | Async machinery | Lands at |
|---|---|---|---|
| Manual | [QuickAddSeed](../src/components/QuickAddSeed.tsx) (modal `manual` screen) | enrichProfileFromName (background) | Stay + refresh, or `/vault/[id]` if new profile |
| Photo (single/batch) | [BatchAddSeed](../src/components/BatchAddSeed.tsx) → [`/vault/import/photos`](../src/app/vault/import/photos/page.tsx) | extract (image+AI) → researchVariety → lookup-by-identity → find-hero-photo, with retries | `/vault/review-import` → Save All |
| Link | [QuickAddSeed](../src/components/QuickAddSeed.tsx) → [`/vault/import`](../src/app/vault/import/page.tsx) | Pass 1 extract-metadata → Pass 2 extract-rescue → Pass 3 find-hero-photo → Pass 4/5 simplified retries | `/vault/review-import` → Save All |
| Purchase Order | [PurchaseOrderImport](../src/components/PurchaseOrderImport.tsx) | extract-order (image+AI) | `/vault/review-import` → Save All |
| AddPlantModal "Manual Entry" | [AddPlantModal](../src/components/AddPlantModal.tsx) | enrichProfileFromName (background) | Stay + refresh, or `/vault/[id]` if new profile |

### Supply import paths (5 methods)

| Method | Entry component | Async machinery | Lands at |
|---|---|---|---|
| Manual | [QuickAddSupply](../src/components/QuickAddSupply.tsx) (modal `form`) | enrich-from-name (background, optional) | Stay + refresh |
| Photo single | [QuickAddSupply](../src/components/QuickAddSupply.tsx) (modal `form` with photo) | extract-from-photo → fills form | Stay in modal — user reviews/edits before save |
| Photo batch | BatchAddSupply | extract-from-photo per image | `/shed/review-import` → Save All |
| Link | [QuickAddSupply](../src/components/QuickAddSupply.tsx) (modal `link` sub-screen) | extract-from-url → fills form | Stay in modal — user reviews/edits before save |
| Purchase Order | [PurchaseOrderImport](../src/components/PurchaseOrderImport.tsx) (`mode="supply"`) | extract-order (image+AI) | `/shed/review-import` → Save All |

### State handoff between pages

- `pendingPhotoImport` — localStorage; set by BatchAddSeed, consumed by `/vault/import/photos`
- `reviewImportData` — localStorage; set by import flows, consumed by `/vault/review-import`
- `progressiveItems` — localStorage; used by link-import progressive ingest into review
- `pendingPhotoHeroImport`, `pendingManualAdd`, `supplyReviewData` — additional handoff stores

**No "in-flight import" recovery UI.** If a tab closes during an async pass, the user has to start over.

---

## Per-path flow walkthrough

### Path: Seed link import

1. **FAB** → "Add Seed Packet" → choose screen
2. Tap **"Link Import"** → modal closes, navigate to `/vault/import`
3. Paste URL(s) into textarea → **Start Import**
4. **Pass 1** (extract-metadata): per URL, in chunks of 3, with 1–2s delay. Phase label: "Scraping Link…". Cache hit returns immediately.
5. **Pass 2** (extract-rescue): only for items where Pass 1 returned `failed: true`. Phase label: "Rescuing…" / "Rescuing Data via Search…".
6. **Pass 3** (find-hero-photo): for items missing hero. Phase label: "Finding Hero Photo…".
7. **Pass 4/5** (simplified retries): "Searching AI (fallback)…" / "Searching AI (final try)…".
8. User can **Stop & Review** at any time → navigate to `/vault/review-import` with whatever's done.
9. Review page: edit each item, merge duplicates (amber-bordered), retry hero, upload manual photo, fix variety/vendor/tags.
10. **Save All** → match-or-create plant_profiles, insert seed_packets, optional hero download, upsert plant_extract_cache.
11. Toast on success → stay on `/vault` (or redirect to `/vault/[id]` if a new profile was created from a single-item import).

**User-visible feedback:** ✅ Per-item phase labels, ✅ overall progress, ✅ Stop & Review button, ✅ Cancel.

### Path: Seed photo import (batch)

1. **FAB** → "Add Seed Packet" → choose screen
2. Tap **"Photo Import"** → modal closes, opens [BatchAddSeed](../src/components/BatchAddSeed.tsx)
3. Capture/select photos → **"Import as new seeds"**
4. Per photo: compress + base64 encode → setPendingPhotoImport → navigate to `/vault/import/photos`
5. Per photo, in series:
   - Phase: **"Uploading file…"**
   - Phase: **"Scanning image (AI Pass 1)…"** — `/api/seed/extract` (Gemini reads packet)
   - Early-out: if `stock_photo_url` from researchVariety, mark success
   - Early-out: vault check — if user already has profile by identity, reuse hero
   - Early-out: lookup-by-identity cache hit → reuse hero
   - Phase: **"Finding hero photo (Pass 2)…"** — `/api/seed/find-hero-photo`
   - Mark success/error
6. Stop & Review or wait for all → buildReviewItems → `/vault/review-import`
7. Same review/save flow as link import.

**User-visible feedback:** ✅ Per-item phase + per-item progress bar + global progress bar + Stop & Review + Cancel + Retry Failed.

### Path: Seed manual

1. **FAB** → "Add Seed Packet" → choose screen
2. Stays in modal. Two modes:
   - **Add new** (default): plant name + variety + vendor + volume + tags + source URL + notes + price
   - **Link to existing**: dropdown → pick variety → "Add new packet" or "Use existing packet"
3. Submit → insert plant_profile (if new) or update existing → insert seed_packet
4. enrichProfileFromName runs in background to fill optional fields
5. New profile → redirect to `/vault/[id]`; otherwise stay + refresh.

**User-visible feedback:** Loading overlay during submit. No background-fill progress visible.

### Path: Seed Purchase Order

1. **FAB** → "Add Seed Packet" → choose screen
2. Tap **"Purchase Order"** → opens [PurchaseOrderImport](../src/components/PurchaseOrderImport.tsx) modal
3. Camera (`getUserMedia`) auto-starts. Capture frame OR file upload.
4. Preview shown. **Extract** button → `/api/seed/extract-order` returns line items (vendor, plant, variety, qty)
5. Items → setReviewImportData → navigate to `/vault/review-import`
6. Same review/save flow.

**User-visible feedback:** "Extracting…" state. No per-item progress (single batch call). Camera permission handling.

### Path: Supply manual

1. **FAB** → "Add to shed" → opens [QuickAddSupply](../src/components/QuickAddSupply.tsx)
2. Choose screen → Manual → form (name, brand, category, NPK, size, usage, photo)
3. Submit → insert supply_profile → stay in modal until success animation → close.

### Path: Supply photo (single)

1. **FAB** → "Add to shed" → choose screen → Photo Import (single)
2. Capture or select → AI `extract-from-photo` fills form fields
3. User reviews/edits in same modal → submit.

**Different from seed photo!** No separate processing page; everything in the modal.

### Path: Supply link

1. **FAB** → "Add to shed" → choose screen → Link
2. **Stays in modal at `link` sub-screen**
3. Paste URL → extract-from-url → fills form → user reviews → submit.

**Different from seed link!** No `/shed/import` separate page — everything in the modal.

### Path: Supply Purchase Order

1. Same PurchaseOrderImport component as seeds, with `mode="supply"`
2. Lands at `/shed/review-import` instead of `/vault/review-import`.

### Path: Supply photo batch

1. Closes modal, opens BatchAddSupply
2. Multiple photos → extract each → `/shed/review-import`.

---

## Friction inventory

Grouped by theme, in rough order of impact within each group.

### A — Choose-screen friction

| # | Issue | Where | Severity |
|---|-------|-------|----------|
| A1 | No "last used method" memory; user re-picks every time | QuickAddSeed, QuickAddSupply choose screens | Medium — frequent users |
| A2 | Method icons are emojis (🌐, 🧾, etc.); inconsistent with ICON_MAP design system | [QuickAddSeed.tsx:567, 580](../src/components/QuickAddSeed.tsx) | Low — cosmetic |
| A3 | Seed has Manual + Photo + Link + PO (4 methods); supply has same 5 + an extra "Photo single" inline; user model differs | Per-method UX | Medium — cognitive load |
| A4 | "Manual" on seed = new modal screen; "Manual" on supply = direct form | QuickAddSupply has only `choose` → `form`/`link` | Low — minor inconsistency |

### B — Async / progress UX

| # | Issue | Where | Severity |
|---|-------|-------|----------|
| B1 | No estimated time remaining or "this could take 30 seconds" warning | All async flows | Low — phase labels mostly compensate |
| B2 | When all Pass 3 hero attempts fail, user lands in review with no images and no obvious "why" | `/vault/review-import` | Medium |
| B3 | Per-pass timing not surfaced — users don't see that Pass 1 was fast vs Pass 3 was slow | Link/photo import pages | Low |
| B4 | No retry-with-different-URL from the review page (typo recovery) | Review page | Medium |
| B5 | Background `enrichProfileFromName` on manual add has no visible status | After manual add | Low — happens after save |

### C — Review page complexity

| # | Issue | Where | Severity |
|---|-------|-------|----------|
| C1 | One page, 1,784 lines, 8+ editable fields per item, hero photo controls, duplicate detection, vendor priority — heavy for users to absorb | [vault/review-import/page.tsx](../src/app/vault/review-import/page.tsx) | **High** |
| C2 | "Save All" is single-shot; no per-item save or partial save | Review page | Medium |
| C3 | Duplicate detection (amber border) is implicit; no explicit "merge into" affordance per row beyond mergeDuplicateIntoOriginal | Review page | Medium |
| C4 | Vendor "Golden Record" priority logic invisible to user — they may not understand why a "Johnny's" name overrode a "Rare Seeds" name | Review page | Low — feature hides itself well |
| C5 | When hero photo fails, "Searching AI…" overlay shows; but no clear "give up and use a placeholder" path | Review page | Medium |
| C6 | Delete-row (×) doesn't undo or "restore" — destructive single action | Review page | Low |

### D — State handoff brittleness

| # | Issue | Where | Severity |
|---|-------|-------|----------|
| D1 | localStorage handoffs (`pendingPhotoImport`, `reviewImportData`); if page closes mid-import, items in flight are lost with no recovery UI | Multiple | **Medium-High** |
| D2 | If user navigates away from `/vault/review-import` accidentally, edits aren't auto-saved; state lives in component memory | Review page | Medium |
| D3 | Multiple localStorage keys for similar things (`pendingPhotoImport`, `pendingPhotoHeroImport`, `pendingManualAdd`, `progressiveItems`, `reviewImportData`, `supplyReviewData`); fragmented mental model | reviewImportStorage.ts, supplyReviewStorage.ts | Low — internal only |
| D4 | No "you have an import in progress, resume?" UX on next page load | All flows | Medium |

### E — Edit-after-save (review page is the last chance to fix)

| # | Issue | Where | Severity |
|---|-------|-------|----------|
| E1 | No Edit button on Packets tab inside plant profile — packet data fixes require workarounds | [BACKLOG.md](BACKLOG.md) item already logged | **High** — couples to review page complexity |
| E2 | If a profile is created with wrong variety/type, fixing requires `/vault/[id]` Edit Plant Profile, which has its own modal | Vault profile | Medium |
| E3 | Hero photo can be re-found via "✨ Fill blanks" or "Overwrite AI" on profile, but discoverability is low | Vault profile | Low |

### F — Failure modes

| # | Issue | Where | Severity |
|---|-------|-------|----------|
| F1 | Network error mid-AI-call: photo flow shows "Scan failed" with retry button ✅; link flow's behavior is less consistent | Photo: ✅ visible; Link: ⚠️ verify | Medium |
| F2 | Vendor blocked (e.g. rareseeds.com 403): special-cased with slug rescue → user doesn't see what happened, just gets a result | [vault/import/page.tsx:85](../src/app/vault/import/page.tsx) | Low — handled invisibly |
| F3 | Camera permission denied in PurchaseOrderImport: "Camera access denied." but no "use file upload instead" prompt | [PurchaseOrderImport.tsx:77](../src/components/PurchaseOrderImport.tsx) | Medium |
| F4 | If `extract-from-url` for supply returns empty, user sees stale form fields with no clear error message | QuickAddSupply link flow | Verify needed |
| F5 | `/api/seed/scrape-url` is the largest API route (4,445 lines) — vendor-specific scraping logic. New vendors fail silently to AI fallback. | API | Maintenance debt |

### G — Asymmetries (seed vs supply)

| # | Issue | Where | Severity |
|---|-------|-------|----------|
| G1 | Seed link = separate page (`/vault/import`); supply link = modal sub-screen | UX | **Medium** |
| G2 | Seed manual has "Add new vs Link-to-existing" mode toggle; supply manual goes straight to form (no equivalent "link to existing supply profile") | UX | Medium |
| G3 | Seed photo = batch UX with own page; supply has both single (modal) AND batch (BatchAddSupply) | UX | Medium — supply has more methods |
| G4 | Seed photo lands at `/vault/review-import`; supply photo can land at `/shed/review-import` (batch only) | Routing | Low |
| G5 | Two review pages with different code paths but similar UX needs | review-import × 2 | Maintenance debt |

---

## Prioritized recommendations

Ordered by **impact / effort ratio**. Each item includes rough effort estimate.

### 🟢 Quick wins (under 2 hours each, ship same session)

1. **Remember last-used import method** — store in localStorage per add-type; pre-select on next open. Saves a tap. ~1h. Addresses A1.
2. **Replace emoji method icons with ICON_MAP icons** — consistency with rest of app. ~30 min. Addresses A2.
3. **Add "use file upload instead" fallback in PurchaseOrderImport when camera denied** — small UX safety net. ~30 min. Addresses F3.
4. **Add Edit button to Packets tab on plant profile** — already in backlog. ~1-2h. Addresses E1 (couples with review page reduction).

### 🟡 Medium-effort improvements (half-day each)

5. **Resume-import UX**: detect non-empty `reviewImportData` or `pendingPhotoImport` on app load; show banner "You have N items waiting for review — Continue / Discard". ~3-4h. Addresses D1, D4.
6. **Edit-and-re-extract from review page**: when an item has bad URL or wrong variety, allow editing the URL and triggering extract-rescue from inside review. ~3-4h. Addresses B4, C2.
7. **Auto-save review page edits to localStorage**: every edit writes back to `reviewImportData` so accidental nav doesn't lose work. ~2-3h. Addresses D2.
8. **Per-item save in review**: instead of "Save All," allow saving individual rows. Lets user partial-import 4 of 5 if 1 is broken. ~3-4h. Addresses C2.
9. **Unify seed and supply link import UX**: pick one model (modal sub-screen OR separate page) and apply to both. Modal-sub-screen is faster; separate-page handles batch better. Half-day decision + half-day implementation. Addresses G1.

### 🔴 Larger projects (multi-day)

10. **Review page decomposition**: split [vault/review-import/page.tsx](../src/app/vault/review-import/page.tsx) (1,784 lines) into focused components. The page does too much; this enables easier improvements. 1-2 days of refactor. Addresses C1.
11. **Unified ImportReviewItem component**: extract shared review-card UI used by both seed and supply review pages. Reduces drift. 1-2 days. Addresses G5.
12. **AI-pass progress modal**: a richer "what's happening" modal with per-pass icons, expandable "see what AI returned" panel, and ETA. Currently phase labels are good but flat. 1-2 days. Addresses B1, B3.
13. **Manual-add `enrichProfileFromName` visible progress**: show "Filling in care notes…" toast or banner so user knows background AI is running. 1 day. Addresses B5.

### 🔵 Architectural / longer-term

14. **Single review-import page for both seed and supply**: data model already supports it (item type field). One UI, parameterized. 2-3 days. Addresses G5.
15. **Background-import support**: long-running imports continue if user navigates away (service worker or persistent queue). Major project. 3+ days. Addresses D1, D4.
16. **Refactor `/api/seed/scrape-url` (4,445 lines)** into per-vendor strategy files. Makes adding new vendors safer and easier. 2-3 days. Addresses F5.

---

## Recommended sequencing

If we attack this as one focused project, a sane plan is:

**Phase 1 — quick wins (~1 day total)**: items 1, 2, 3, 4. Visible immediate relief, no architectural risk.

**Phase 2 — review page improvements (~2 days)**: items 6, 7, 8. The review page is the load-bearing surface; making it more forgiving compounds value.

**Phase 3 — resume + asymmetry (~2-3 days)**: items 5, 9. Tackle state recovery and align seed/supply UX.

**Phase 4 — architectural (when warranted)**: items 10, 11, 14. Only when there's appetite for refactor work; not immediately user-visible.

Items 12, 13, 15, 16 are nice-to-have — schedule individually or skip.

---

## User answers (2026-05-07 feedback session)

The questions below were answered during a live feedback session. The answers re-rank Phase 1 priorities — captured in the addendum below.

1. **Which import method do you use most?**
   → **Shed Purchase Order, Shed Photo Import, Add Plant Scan Purchase Order, Add Seed Purchase Order.** Notably absent: link import. Manual is used but with friction (variety dropdown not alphabetical, malformed legacy data in autocomplete).

2. **What does "really problematic" feel like to you?**
   → Multiple things: hero photo finding is slow during import; original uploaded photos and receipts get discarded; review page handles too much; AI autofill is load-bearing because legacy DB data is dirty.

3. **Single-item or batch?**
   → Mixed; PO flows are inherently batch (a single receipt → multiple line items).

4. **Tab close mid-import — has it bitten you?**
   → Not explicitly answered, but related concern: receipts and original images have no recovery point because they're discarded.

5. **Do you fix imported data after the fact often?**
   → Yes — frequently relies on AI autofill (`✨ Fill blanks`, `Overwrite AI`, Magic Fill) to populate profile data that the original scrape missed or corrupted.

---

## Addendum — 2026-05-07 re-prioritization

User feedback re-orders the original recommendations. **PurchaseOrderImport flow becomes top priority** (used in 3 of 4 most-used flows). Photo import gets bumped up. Link-import-specific work drops in priority. Two new sections added below.

### New Phase 0 — Critical user-reported items (do first)

These are concrete, contained, and address top user friction. Most are 30 min – 2 hours each.

| # | Item | Why now |
|---|------|---------|
| 0a | **Variety dropdown alphabetical sort** in QuickAddSeed manual | User hits this every manual add. ~10 min fix. |
| 0b | **Defer hero-photo finding** to post-import. Use user's uploaded image as immediate visual; trigger find-hero on demand from review page. | Biggest speed win for the user's most-used flows (Photo + PO). Touches `/vault/import/photos`, BatchAddSeed, BatchAddSupply, PurchaseOrderImport. ~3-5h. |
| 0c | **Receipt retention for Purchase Order** — save the original receipt image as a `vault_add` journal entry attached to the created profile(s) / grow_instances. Use the existing `journal-photos` bucket. | Closes a real workflow gap: nursery warranty case for permanent plants, supply purchase records. Touches PurchaseOrderImport, supply review-import save, `vault_add` journal type. ~4-6h. |
| 0d | **Display-time normalization for autocomplete** — strip apostrophes, fix case, filter obvious junk from plant_name / variety dropdowns even though source data is dirty. | Quick UX fix while data quality remediation (workstream #3) is scheduled later. ~2-3h. |

### New section — Receipt retention (workstream #4 in PRODUCT_AUDIT)

The original audit treated import as one concern. The 2026-05-07 session revealed a **separate concern that import flows currently break**: keeping the original photo / receipt as a record, distinct from using it as the product's visual identity.

**Two distinct image roles being conflated:**

| Concern | Where the image should live |
|---------|-----------------------------|
| Visual identity (profile / product hero) | `hero_image_path` on profile, `primary_image_path` on packet |
| Purchase record (receipt for warranty etc.) | `journal_entries` row with `entry_type: "vault_add"` and the receipt image attached |

**These should not share a slot.** A PO receipt as a plant's hero image would be silly. A packet photo as the journal "I added this on date X" record is fine and useful.

**What to build:**
- PurchaseOrderImport saves the receipt to `journal-photos` and creates a `vault_add` journal entry on each profile/grow_instance the order touched.
- AddPlantModal (esp. for permanent plants) allows attaching a receipt photo, saved to the grow_instance's `vault_add` journal entry.
- Photo Import (seed packets) — option to use uploaded packet photo as the profile hero (replacing the AI-found one) via a toggle on the review page.

### New section — Hero photo deferral (Pattern 5 expression)

User suggestion validated against current code: hero-photo finding runs synchronously in the import pipeline (every photo / link import waits on `find-hero-photo` before reaching review). This is a major time-sink in the user's most-used flows.

**Proposed shape:**

1. **During import** — use the user's uploaded image (or extracted vendor image from page metadata) as the visual immediately. Skip AI hero search.
2. **On review page** — show user's image already in place. Per-item button: "Find a stock photo" triggers find-hero-photo on demand.
3. **After save** — profile has user's image as hero by default. User can replace later via existing "Set Profile Photo" / "Search web" affordances.

This decouples import speed from hero photo quality. **Significant win for the speed concern AND closes a "wanted my photo as hero" frustration in one change.**

### Re-ranked priority list (replaces the original Phase 1)

**🟢 Phase 1 — Most impactful quick wins (target: half-day each, ship together)**

1. **0a: Variety dropdown alphabetical** — universal, instant relief.
2. **0b: Defer hero-photo finding to post-import** — biggest speed improvement for most-used flows.
3. **0d: Display-time normalization for dropdowns** — interim fix while data quality work is scheduled.
4. **A1: Remember last-used import method** — per-add-type localStorage.
5. **A2: ICON_MAP icons replacing emoji** in choose screens.
6. **0c: Receipt retention for Purchase Order flows** — closes a real product gap.

That's roughly 1.5–2 days of focused work, addresses the user's top concrete friction, and sets up the more architectural improvements that follow.

**🟡 Phase 2 — Review page improvements** (unchanged from original audit): items 6, 7, 8.

**🔴 Phase 3+** (unchanged from original audit): seed/supply asymmetry, review page decomposition, etc.

---

## Open questions for you (original — kept for reference)

---

## Verified vs inferred

To be transparent about what's confirmed vs what's a hypothesis from reading code:

**Verified by reading the code:**
- File sizes, surface area, async pass machinery, phase labels, state stores
- Photo flow has Stop & Review + Retry Failed + Cancel + per-item progress (✅ in code)
- Link flow has phase labels for Pass 1/2/3 + simplified retries (✅ in code)
- Asymmetry between seed link (separate page) and supply link (modal sub-screen) (✅ in code)
- Edit packet button missing on profile Packets tab (✅ confirmed earlier audit)

**Inferred — need user confirmation:**
- Which friction items are *most* painful in actual use
- Whether tab-close-mid-import has happened to you
- Whether the AI accuracy is a major source of frustration (review page edits) or minor (mostly accurate, light edits)
- Whether seed/supply asymmetry actually bothers you in practice

---

*Last updated: 2026-05-07*
