# Known Issues & Bug Triage

**Last updated:** 2026-03-11  
**Owner:** Part 5 (Bug Fix and Hardening)

All items are triaged as **must-fix before release** or **post-launch**. Must-fix items are tracked here until closed; post-launch items move to [BACKLOG.md](BACKLOG.md) when deferred.

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

## Security Checklist (Part 5.2 — Completed 2026-03-11)

| Check | Result |
|-------|--------|
| **RLS on all user tables** | ✅ `plant_profiles`, `seed_packets`, `grow_instances`, `journal_entries`, `tasks`, `care_schedules`, `shopping_list`, `plant_varieties` all have RLS enabled with `auth.uid() = user_id` policies. |
| **`user_id` on all INSERTs** | ✅ Full sweep of 22 source files — no violations found. Law 1 upheld across entire insert surface. |
| **No secrets in client code** | ✅ All API keys (`GOOGLE_GENERATIVE_AI_API_KEY`, `OPENAI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `TAVILY_API_KEY`) are server-only env vars. Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public (by design). |
| **Image compression on all upload paths** | ✅ Client uploads use `compressImage()` from `src/lib/compressImage.ts`. Server-side routes (`batch-import`, `find-hero-photo`, `extract-from-photo`, `save-hero-from-url`) all use Sharp after this session's fix. |
| **Soft delete on all deletions** | ✅ `plant_profiles`, `seed_packets`, `grow_instances`, `journal_entries`, `tasks` use `update({ deleted_at })`. Hard `.delete()` is only used in Settings Trash for permanent purge. |
