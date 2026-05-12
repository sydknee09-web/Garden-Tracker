# Known Issues & Bug Triage

**Last updated:** 2026-05-07 (live user feedback session — see "User-reported issues" section below)
**Owner:** Part 5 (Bug Fix and Hardening)

All items are triaged as **must-fix before release**, **post-launch**, or **user-reported (2026-05-07)**. Must-fix items are tracked here until closed; post-launch items move to [BACKLOG.md](BACKLOG.md) when deferred.

For systemic / pattern-level analysis of these bugs, see [PRODUCT_AUDIT_2026-05-07.md](PRODUCT_AUDIT_2026-05-07.md). Several bugs below are likely the same underlying issue (e.g., truncation handling, modal layering).

---

## Must-Fix Before Release

| # | Area | Issue | Status | Notes |
|---|------|-------|--------|-------|
| 1 | Law 4 / Security | `save-hero-from-url` API route uploaded raw web images (5–10 MB) without Sharp compression | **Fixed** (2026-03-11) | Added Sharp `.resize(1200×1200).jpeg({ quality: 85 })` before upload, matching other server-side routes. |
| 2 | Auth / PKCE | Signup email verification froze; password reset redirected to wrong domain | **Fixed** (prior session) | Implemented `/auth/callback` PKCE exchange page; updated `signup`, `reset-password`, `update-password` pages; added `AuthGuard` exemption. |
| 3 | UX | Seed packet Notes and Location fields stripped spaces mid-typing | **Fixed** (prior session) | `updatePacketNotes` / `updatePacketStorageLocation` in `vault/[id]/page.tsx` now only trims on `onBlur` persist, not on live `onChange`. |

---

## Post-Launch (Deferred)

| # | Area | Issue | Effort | Source |
|---|------|-------|--------|--------|
| 1 | Scheduling | `plantingWindow.ts` does not use `user_settings.planting_zone` for zone-aware sow windows. Uses static month ranges only. | Medium | `plantingWindow.ts` TODO comment |
| 2 | Navigation | `?grow=` URL param from vault profile → Active Garden scrolls to batch, but only if the batch is currently growing. Ended/archived batches don't highlight. | Low | NAVIGATION_ISSUES_LOG |
| 3 | UX | Stroke weight inconsistency: inline SVGs outside `ICON_MAP` still use `strokeWidth="2"` or `"2.5"` in a few secondary locations (e.g. calendar, some edit modals). Core interactive icons are consistent. | Low | TECHNICAL_AUDIT_ACTION_CENTER_AND_EDIT |
| 4 | Feature | Plant → Harvest E2E test not written (sow + harvest automation). | Medium | Part 4.1 deferred |
| 5 | UX | Full-screen drawer (Edit Grow, EditPacketModal) has no `visualViewport` resize handler for virtual keyboard. Only needed if users report inputs hidden behind keyboard. | Low | TECHNICAL_AUDIT_ACTION_CENTER_AND_EDIT |

---

## Resolved (Closed)

| # | Area | Issue | Fix date |
|---|------|-------|----------|
| 1 | Security | `plant_varieties` table had no RLS — any user could read/update any plant by id | 2025-02-05 (migration `20250205600000_plant_varieties_rls.sql`) |
| 2 | Data | `plant_profiles` missing RLS `WITH CHECK` on INSERT | 2025-02-12 (migration `20250212200000_plant_profiles_seed_packets_rls_with_check.sql`) |
| 3 | UX | `AddPlantModal` wrote to both `purchase_vendor` and `purchase_nursery` | Fixed (prior audit wave) |
| 4 | UX | `QuickAddSeed` locked-in chip briefly empty when `preSelectedProfileId` loads async | Fixed — `lockedInVarietyLabel` now falls back to `profileDisplayName` prop while profiles load |
| 5 | UX | Edit Plant Profile modal did not show save failure message | Fixed (Part 3.3 audit wave) — error renders in modal footer |

---

## User-reported issues (2026-05-07 feedback session)

Concrete, reproducible issues raised during a live testing session. Each is contained — most are quick fixes. Patterns across these are analyzed in [PRODUCT_AUDIT_2026-05-07.md](PRODUCT_AUDIT_2026-05-07.md).

### Bugs (specific reproductions)

| # | Surface | Issue | Likely fix | Effort |
|---|---------|-------|------------|--------|
| U1 | Home — Quick Start | "Set up your zone" step persists after zone is set in `user_settings` | Read `user_settings.planting_zone` and gate the step | ~1h |
| U2 | FAB sub-modals | Background visible & interactable behind sub-modal (e.g., open "Add Seed", parent menu still scrollable) | Audit modal scroll-lock + backdrop primitive globally — likely affects all modals (see PRODUCT_AUDIT Pattern 4) | ~2-4h (one-time, app-wide) |
| U3 | QuickAddSeed manual | Variety dropdown not alphabetical — hard to find entries | Sort the array before render | ~10 min |
| U4 | Journal page header | "Journal" truncates to "Jou..." on small screens | Responsive header sizing or shorter label | ~30 min |
| U5 | Active Garden gallery cards | Plant names clip from the LEFT ("rtichoke", "umber", "mato") | Switch to right-side ellipsis (`text-overflow: ellipsis; overflow: hidden; white-space: nowrap`) — likely affects other surfaces too (see Pattern 7) | ~30 min |
| U6 | FAB main vs submenus | Main menu icons styled differently from submenu icons | Unify under ICON_MAP — part of design system pass | Bundle with U10 |
| U7 | FAB transitions | "Add seed" smooth in-place transition; other 3 submenus close + reopen — feels glitchy | Pick one model (in-place sub-screen for all) and align | ~2-3h |
| U8 | FAB submenu headers | Header positions / styling differ between submenus | Standardize | ~1-2h |
| U9 | Active Garden cards | Selection / highlight border looks visually off | Tune border weight / color (part of design system pass) | Bundle with U10 |
| U10 | Throughout | Seedling placeholder for missing hero is visually unpleasant | Design new placeholder (icon, illustration, or initials) — part of design system pass | ~2-4h |
| U11 | Active Garden cards | Quick Log button uses ICON_MAP.Journal which reads ambiguous at small sizes | Replace with clearer icon OR add label | ~30 min |
| U12 | Journal page | Two ways to add an entry ("+Entry" button + FAB → Add journal) — redundant *(re-flagged 2026-05-12 — user verifying journal page after `7482c59` search ship)* | UX coherence decision: keep both with differentiation, or remove one | Decision + ~30 min |
| U13 | Journal entry cards | Visual hierarchy poor — eyes dart between date, badge, note, pills; plant variety mingled with description *(re-flagged 2026-05-12 — user feedback batch item #6)* | Lead with note in heavier weight, demote date, group type+pills; structured header + body + tags | ~1-2h |
| U14 | Journal entry cards | Spacing between cards too tight | `space-y` increase OR adjust card padding | ~15 min |
| U15 | AddPlantModal | "Permanent / Seasonal" terminology inconsistent with "Active Garden / My Plants" tab labels | Pick one terminology and propagate (UX coherence — see Pattern 6) | ~1h + decision |
| U16 | AddPlantModal | Permanent/Seasonal toggle redundant when already chosen via FAB sub-screen | Hide toggle when `defaultProfileType` already set | ~30 min |
| U17 | Journal page | View-mode icons (Table / Gallery / Timeline) unlabeled | Add tooltips or visible labels | ~30 min |
| U18 | Calendar page | Header (May 2026 + arrows + Plantable banner) takes too much vertical space; calendar grid feels secondary | Compact month nav inline, demote Plantable to smaller link, reduce padding | ~2-3h |
| U19 | Home page | Bottom half (Shopping list, At a glance) lacks visual hierarchy compared to top half | Consistent card style; soften "Done" buttons; consolidate or restructure | ~2-3h |
| U20 | Home page | Sections load staggered on app open (top first, bottom pops in later) | Skeleton placeholders for all sections at first paint, OR batched data fetch | ~2-3h |
| U21 | Journal search input (`7482c59`) | Two clear-X buttons visible when query is non-empty on Android Chrome — one grey (custom React clear-X) and one blue (browser-native `type="search"` cancel button). Reported 2026-05-12 immediately after `7482c59` shipped. | Hide native button via Tailwind arbitrary variant `[&::-webkit-search-cancel-button]:appearance-none` on the search input; custom X remains as the single control | ~5 min (1-line CSS) |

### Systemic / structural issues (require workstream-scale work)

These were reported but are larger than single bugs. See [PRODUCT_AUDIT_2026-05-07.md](PRODUCT_AUDIT_2026-05-07.md) for analysis.

| # | Issue | Workstream |
|---|-------|------------|
| S1 | Hero-photo finding during import is slow | Import flow (#1) — defer hero search |
| S2 | Original uploaded photos / receipts are discarded after AI extraction | Source-image / receipt retention (#4) |
| S3 | AI autofill load-bearing because legacy DB data is dirty | Data quality remediation (#3) + AI autofill UX (#2) |
| S4 | Per-specimen care impossible (only variety-level care) | Per-specimen care (#8) |
| S5 | Calendar bounded recurrence missing — copper protocol case requires manual cleanup | Calendar recurrence model (#9) |
| S6 | Calendar chain-snooze missing — slipping day 1 doesn't shift days 2-7 | Calendar recurrence model (#9) |
| S7 | Grow instance "profile" is underdeveloped — should be the central hub for an individual plant | Grow instance hub buildout (#10) |
| S8 | Plant profile vs grow instance terminology / conceptual confusion | Resolved by #10 + UX coherence (#6) |
| S9 | Empty / sparse-data states neglected (Journal opaque to new users, Gallery view useless without photos, etc.) | New-user discoverability (#5) |
| S10 | Visual cohesion uneven across icons, placeholders, badges | Design system pass (#7) |

---

## Security Checklist (Part 5.2 — Completed 2026-03-11)

| Check | Result |
|-------|--------|
| **RLS on all user tables** | ✅ `plant_profiles`, `seed_packets`, `grow_instances`, `journal_entries`, `tasks`, `care_schedules`, `shopping_list`, `plant_varieties` all have RLS enabled with `auth.uid() = user_id` policies. |
| **`user_id` on all INSERTs** | ✅ Full sweep of 22 source files — no violations found. Law 1 upheld across entire insert surface. |
| **No secrets in client code** | ✅ All API keys (`GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TAVILY_API_KEY`) are server-only env vars. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public (by design). |
| **Image compression on all upload paths** | ✅ Client uploads use `compressImage()` from `src/lib/compressImage.ts`. Server-side routes (`batch-import`, `find-hero-photo`, `extract-from-photo`, `save-hero-from-url`) all use Sharp after this session's fix. |
| **Soft delete on all deletions** | ✅ `plant_profiles`, `seed_packets`, `grow_instances`, `journal_entries`, `tasks` use `update({ deleted_at })`. Hard `.delete()` is only used in Settings Trash for permanent purge. |
