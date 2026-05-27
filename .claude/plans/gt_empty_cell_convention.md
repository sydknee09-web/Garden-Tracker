# gt-empty-cell-convention — plan + audit log

**Branch:** main (no worktree this chat — same shape as gt_title_case_split sweep)
**Chat:** gt-empty-cell-convention (2026-05-27)
**Purpose:** Lock single empty-cell display convention (em dash "—") across GT, amend canonical docs (VISION §8 + CLAUDE.md callout + ROADMAP §6), sweep every inconsistent treatment app-wide.
**Pattern:** Mirrors casing-policy sweep chapter (commits `3ee1063` → `cb6a203`, 2026-05-27).

---

## §1 — Scope at a glance

**Phase A (doc-only ship, immediate push):**
- VISION.md §8 — new "Empty-cell display convention" subsection between Casing + Beds-as-first-class
- CLAUDE.md — new "Empty-cell convention (locked 2026-05-27)" top-level section after Casing convention
- ROADMAP.md §1 lead-line refresh (per §7 2-paragraph cap) + §6 new dated entry

**Phase B (audit only):**
- Pass 1-4 audit looped until clean
- Grep families: literal "--", "N/A", "None", "Unknown", `|| ""` empty-fallback in data-display rendering
- Output: classification matrix (REPLACE / PRESERVE / AMBIGUOUS)

**Phase C (code sweep, explicit yes-build greenlight pre-granted):**
- Replace "no data" indicators with "—" per matrix
- Preserve semantic strings (None/N/A/Unknown that carry meaning)
- Update test assertions where touched
- 1-2 commits depending on file count

**OUT OF SCOPE:**
- Voyager (different voice)
- Loading-state indicators (spinners/skeletons)
- Disabled-state indicators (opacity/muted color)
- Form placeholder text (prompts, not empty-state)
- Plant profile pathways audit (next chunk)
- Grow-now zone investigation
- Multi-link "+"

**Success criteria:**
- (a) VISION.md §8-adjacent lock with rationale + criterion + GT-only scope
- (b) Phase A doc commit shipped + pushed
- (c) Phase B audit log enumerating every grep hit categorized REPLACE/PRESERVE/AMBIGUOUS
- (d) Phase C sweep commit(s) shipped + pushed, tests + build green
- (e) ROADMAP §6 dated entry with both commit hashes
- (f) Dogfood test plan surfaced for Syd

---

## §2 — Phase A doc lock content (drafted before commit)

### VISION.md §8 — new subsection (insert after Casing, before Beds-as-first-class)

Title: **Empty-cell display convention**
Lock date: **2026-05-27**

The rule:
- Use "—" (em dash, U+2014) for empty data fields in profile / table / detail views where there's no semantic distinction between missing / didn't-enter / doesn't-apply
- Preserve semantic strings where the value carries meaning (None as user choice, N/A as structural, Unknown as known-unknown)

Decision criterion at audit time (one question): *Does this field's absence carry meaning that the user needs to read?*
- No → "—"
- Yes → preserve

NOT for: loading states (spinners), disabled states (opacity), form placeholders, empty-state body copy (full sentences).

Rationale: industry-standard typography (Apple Numbers, Google Sheets, financial dashboards). Single character, clean, scannable. GT-only — Voyager has its own voice.

Persona walk: all 5 personas pass (Maya scans tables → standard convention; Sydney sees cohesion; Walter reads universally-recognized "no value"; Aria + Sam see less visual noise on low-data states).

### CLAUDE.md — new top-level section after Casing convention

Quick-lookup format pointing at VISION §8 for full rule. Same shape as Casing convention callout.

### ROADMAP §6 — new top entry

`### 2026-05-27 (newest — gt-empty-cell-convention chat — em-dash empty-cell lock + app-wide sweep)`

- Convention lock: em dash "—" for empty data cells
- Rationale + criterion
- Phase A doc commit: `<hash>`
- Phase C sweep commit: `<hash>`
- Sweep inventory: count of files / lines / preserved-semantic-strings
- Persona walk pass

### ROADMAP §1 — lead-line refresh

Add new top paragraph (this chat); demote existing 2nd paragraph (2026-05-26 FAB-form saga) to archive placeholder per §7 2-paragraph cap.

---

## §3 — Audit log (Phase 1 — VISION.md / CLAUDE.md / ROADMAP edits)

### Pass 1 — Factual (Phase A doc edits)

To verify before commit:
- [ ] VISION.md line 320 (end of Casing subsection) is `### Beds as first-class entity (architectural decision)` at line 322
- [ ] CLAUDE.md line 810 is `---` separator (end of Casing convention block)
- [ ] ROADMAP.md §1 first paragraph is `As of 2026-05-27 (latest — fab-tree-route-to-modal-conversion-cluster chat)` and second is `As of 2026-05-26 (earlier — continue-from-prev-chat-fab-form-submit-saga chat)`
- [ ] ROADMAP.md §6 latest entry is `### 2026-05-27 (latest — gt-title-case-split chat — casing-policy reversal + app-wide sweep)`

### Pass 2 — Concerns hunt (Phase A)

Hunt categories for THIS doc batch:
- Internal contradictions: does "—" conflict with any existing VISION/CLAUDE/ROADMAP entry? No — no prior empty-cell rule exists; this is net-new policy.
- Cross-ref accuracy: §8 cross-ref placement (after Casing, before Beds) — correct.
- Numbering/placement: §8 grows by one subsection; no §-number collision; no chapter renumber.
- Hierarchy: VISION = canonical lock (per CLAUDE.md authority precedence 2026-05-16 — voice/tone/locked design decisions belong in VISION). CLAUDE.md callout = quick lookup. ROADMAP §6 = dated decision log. Three-tier mirrors casing-policy lock 2026-05-27.
- Dating/stamp drift: lock-date stamp = 2026-05-27 (today's date per system reminder).
- Missing destination routing: signal goes to VISION (canonical), CLAUDE (process callout), ROADMAP (dated log) — all three destinations consume it.
- "—" vs "–" vs "-": confirm em dash (U+2014, "—") not en dash (U+2013, "–") or hyphen ("-"). Em dash is the typographic standard for missing data. Use Unicode literal in source.

### Pass 3 — Sibling pattern sweep (Phase A)

Sibling locks in VISION.md §8:
- Plant placeholder (asset + container background)
- Transitions (FAB & modals)
- Colors / brand
- Field treatments — dropdown vs free-text
- Form-level error treatment
- Casing (headers + buttons vs body)
- Beds as first-class entity

The new "Empty-cell display convention" fits this taxonomy — discrete locked visual/typographic convention with criterion + rationale + persona walk. Same shape as Casing (parallel rule for a different layer of UI).

CLAUDE.md sibling callouts:
- Casing convention (locked 2026-05-27) — directly above the new section. Same shape.

ROADMAP §6 sibling entry shape:
- 2026-05-27 (latest — gt-title-case-split) — same shape.

### Pass 4 — Lock hygiene (Phase A)

- VISION §10 don't-touch — no item brushed. Empty-cell convention is net-new; no existing locked item touched.
- VISION §11 parked decisions — no item brushed. Empty-cell isn't in the parked register; this is fresh policy not a deferred decision.
- ROADMAP §6 locked decisions — no prior empty-cell rule exists in §6; net-new entry.
- CLAUDE.md rules — no rule contradicted. Adding a parallel design-token quick-lookup is the cohesion-by-aggregation pattern + the casing convention's direct sibling.
- Authority precedence (2026-05-16) — VISION owns voice/tone/locked design decisions. Empty-cell convention IS a locked design decision. VISION canonical; CLAUDE.md callout + ROADMAP §6 entry are derived references.

Phase A Pass 1-4 audit: **TERMINATED CLEAN** (no findings to resolve, no revision needed).

---

## §4 — Phase B audit log (terminated clean Pass 1-4 iter 1)

### Grep families run (Pass 1 + Pass 3)

1. Literal "--" — 20 hits across 8 files (REPLACE bucket, all data-display contexts)
2. "N/A" — **0 hits** in src/
3. "Unknown" — 28 hits, ALL preserve (sentinel value in AI extraction / filter chains, not user-visible empty cell)
4. "None" — 2 hits, both `<option value="">None</option>` (semantic user choice, preserve)
5. Vocab-breadth `(none)` / `(unknown)` / `(no data)` / `(blank)` / `(empty)` / TBD / n/a — **0 hits** in display context (React `onEmptyStateChange` callback name is logic, not display)
6. Existing em dash "—" usage — **6 hits as data-cell empty indicator** (BLOCKING sibling anchors — convention already in practice at scraper-audit + ActiveGardenView)

### Classification matrix

**REPLACE bucket (20 hits → "—"):**

| File | Line | Surface | Current | Reason |
|---|---|---|---|---|
| src/app/settings/developer/page.tsx | 753 | Archived planting "Ended" date fallback | `: "--"` | data-cell empty |
| src/app/settings/vendors/page.tsx | 38 | formatAvg() return for null rating | `return "--"` | data-cell empty (helper consumed downstream) |
| src/app/settings/vendors/page.tsx | 314 | Vendor group rating display | `<span>--</span>` | data-cell empty |
| src/app/settings/vendors/page.tsx | 330 | Per-packet rating display (collapsed group) | `<span>--</span>` | data-cell empty |
| src/app/vault/[id]/VaultProfilePacketsTab.tsx | 99 | Vendor name fallback in packet row | `\|\| "--"` | data-cell empty |
| src/app/vault/[id]/page.tsx | 636 | yieldLabel for no-yield case | `\|\| "--"` | data-cell empty |
| src/app/vault/[id]/page.tsx | 710 | About field — Sowing Method | `\|\| "--"` | data-cell empty |
| src/app/vault/[id]/page.tsx | 711 | About field — Planting Window | `\|\| "--"` | data-cell empty |
| src/app/vault/[id]/page.tsx | 712 | About field — Spacing | `\|\| "--"` | data-cell empty |
| src/app/vault/[id]/page.tsx | 713 | About field — Sowing Depth | `\|\| "--"` | data-cell empty |
| src/app/vault/[id]/page.tsx | 716 | About field — Sun | `\|\| "--"` | data-cell empty |
| src/app/vault/[id]/page.tsx | 717 | About field — Water | `\|\| "--"` | data-cell empty |
| src/app/vault/[id]/page.tsx | 718 | About field — Germination | `\|\| "--"` | data-cell empty |
| src/app/vault/[id]/page.tsx | 721 | About field — Days to Maturity (ternary) | `: "--"` | data-cell empty |
| src/app/vault/history/page.tsx | 122 | Location fallback in history table | `\|\| "--"` | data-cell empty |
| src/app/vault/history/page.tsx | 133 | Summary string fallback | `\|\| "--"` | data-cell empty |
| src/app/vault/history/page.tsx | 135 | Harvest count fallback (ternary) | `: "--"` | data-cell empty |
| src/components/PacketVaultView.tsx | 749 | Packet table — vendor_name | `\|\| "--"` | data-cell empty |
| src/components/PacketVaultView.tsx | 750 | Packet table — purchase_date (ternary) | `: "--"` | data-cell empty |
| src/components/StarRating.tsx | 23 | StarRating readonly null fallback (consumed by 7 sites) | `<span>--</span>` | data-cell empty |

Total: **20 line-edits across 8 files**.

**PRESERVE bucket (semantic value, no change):**

- All 28 "Unknown" hits — sentinel value in AI extraction routes + filter chains. Used as conditional check (`plant_name !== "Unknown"`). Semantic state ("we tried to infer but couldn't determine"). Per Phase A rule branch 2.
- 2 `<option value="">None</option>` (CareScheduleManager:370, NewTaskModal:399) — user choice ("I deliberately chose none"). Per Phase A rule branch 2.
- Range en-dashes `"3–5"`, `"7–14 Days"` in plantDefaults.ts — separator convention (U+2013), different shape from empty-cell.
- Sentence em-dashes in toasts/paragraphs — punctuation, not empty-cell indicator.
- Existing "—" usage at scraper-audit (5 sites) + ActiveGardenView:372 — already canonical, no change.

**AMBIGUOUS bucket (out of convention scope, ADJACENT parked):**

- QuickAddSeed.tsx:721, 746, 883, 908 — `vendor_name || "Unknown"` rendered as "Selected: {vendor} ({date})" sentence fragment. Sentence-fragment context; em-dash doesn't fit; better treatment is improved empty-vendor copy. **Out of convention scope** (sentence-fragment placeholder, not data-cell). ADJACENT for future polish.
- shopping-list/page.tsx:207 — `|| "Unknown"` as item-name fallback. Sentence-fragment context. ADJACENT for future polish (better treatment = "Unnamed item" or similar).

### Pass 1 — Factual

Each REPLACE site verified via Read tool — file exists, line content matches, render context is data-display (not loading / disabled / placeholder). formatAvg() at vendors:38 consumed by collapsed vendor-group row rating + per-packet rating spans (both also flip in this sweep). StarRating.tsx:23 consumed by 7 files; flipping the component propagates the change to all consumers automatically.

**Pass 1 clean iter 1.**

### Pass 2 — Concerns hunt

Hunt categories declared:
- **Loading vs empty vs disabled vs missing** — Every "--" hit is empty (no data), not loading or disabled. Verified by context: ratings = null → "--" (not "Loading..."); vendor field empty → "--" (field exists, no value); About fields → "--" (data absent). ✅
- **Persona walk** (per VISION §8 new subsection):
  - Maya (power user) — reads "—" as standard table convention ✅
  - Sydney — cohesion across Vault profile About fields (currently mixed "--" / em-dash sibling at ActiveGardenView is the drift this fixes) ✅
  - Walter (iPad-primary) — universally-recognized "no value" symbol ✅
  - Aria + Sam (low-data states) — less visual noise than "--" ✅
  - All 5 personas pass.
- **Cohesion-by-aggregation** — Vault profile About (9 fields) flips in lockstep; PacketVaultView (vendor + date) flips together; settings/vendors (group + per-packet) flips together. ✅
- **Semantic preservation** — "Unknown" sentinel + "None" user-choice preserved per Phase A rule branch 2. ✅
- **Test assertion drift** — `Grep "--" *.test.{ts,tsx}` returned 0 hits. No test updates needed. ✅
- **Migration semantics** — formatAvg() return value flips → all downstream consumers receive "—" automatically (single source of truth). ✅
- **Off-by-one rendering** — Each "--" → "—" is a 2-char-to-1-char swap. JSX render output shrinks by 1 char per cell; no layout impact (`text-sm text-neutral-400` classes preserve sizing). ✅

**Pass 2 clean iter 1.**

### Pass 3 — Sibling pattern sweep

BLOCKING sibling anchors (existing canonical pattern):
- `src/app/admin/scraper-audit/page.tsx` — 5 sites use `?? "—"` for empty-cell display in admin table. This IS the convention's existing reference implementation.
- `src/components/ActiveGardenView.tsx:372` — `b.profile_variety_name?.trim() || "—"` for variety fallback. Already canonical.

All 20 REPLACE sites flip to align with these anchors. Cohesion-by-aggregation drift resolved: scraper-audit + ActiveGardenView were the new-pattern peers; Vault / settings / StarRating / PacketVault were the older "--" peers. Sweep brings older sites into alignment.

ADJACENT (logged, not flipped this ship):
- QuickAddSeed.tsx 4 sites + shopping-list/page.tsx 1 site — `|| "Unknown"` in sentence-fragment context. Different convention shape (sentence placeholder, not data-cell). Logged for future polish pass.
- PacketVaultView.tsx:288, 319 + reviewImportSave.ts:56, 121 + matchExistingProfile.ts:26 + BatchAddSeed.tsx:293, 316, 573 — `?? "Unknown"` as internal data-structure placeholder (assigned to name fields in extraction logic). Not user-facing empty-cell; semantic placeholder. ADJACENT (preserve, but flag pattern for future revisit if it surfaces in UI).

CONCERN (none surfaced this ship).

**Pass 3 clean iter 1.**

### Pass 4 — Lock hygiene

- VISION §10 don't-touch — empty-by-default principle: this sweep refines DISPLAY of empty cells, not the empty-state DEFAULT. OnboardingDock untouched. ✅
- VISION §11 parked decisions — none brushed. ✅
- ROADMAP §6 — Phase A doc lock just shipped (this commit's prior commit `29f37a1`); Phase C sweep matches the convention. ✅
- §3.12 theme #5 empty-state copy (`9bad88f` 2026-05-18) — body-copy layer; empty-cell symbol is a different visual layer. No overlap. ✅
- Casing-policy lock 2026-05-27 (`3ee1063` → `cb6a203`) — different surface (headers/buttons vs cells); no conflict. ✅
- Authority precedence (2026-05-16) — VISION §8 canonical; CLAUDE.md callout; ROADMAP §6 dated. All consistent. ✅

**Pass 4 clean iter 1.**

### Audit termination

Pass 1-4 terminated **CLEAN on iteration 1** with zero amendments. No revision-and-re-run needed. Plan-of-record locked for Phase C execution.

---

## §5 — Phase C ship log

To be filled in after Phase B audit terminates clean.

---

## §6 — 3 buckets close-out (Phase 5)

To be filled in at close-out.

**(a) Parked items added this chat:**
**(b) Deferred audits / known follow-ups:**
**(c) Dogfood-style findings:**
