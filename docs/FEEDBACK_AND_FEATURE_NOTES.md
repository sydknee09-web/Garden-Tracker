# Feedback & feature notes (running log)

**Purpose:** One place for user feedback, feature ideas, and **how we resolved them**—so we don’t re-litigate the same topics, duplicate small fixes, or miss a **process-level** fix that replaces many one-offs.

**How to use**

- Add new items under **Inbox** (short title + note).
- When you decide: move to **Resolved by product/process** (preferred) or **Deferred / backlog** with a one-line rationale.
- Prefer linking to a single ADR, roadmap phase, or doc section over scattering the same answer in chat.

**Principles**

1. **Process before patch storm** — If several reports share a root cause (e.g. unclear where to put X), fix navigation/copy/schema once instead of closing 20 tickets the same way.
2. **Document the resolution** — Future you (and collaborators) should see *what we decided*, not only *that we closed something*.
3. **No duplicate work** — Before implementing, search this file and `docs/` for the same keyword.
4. **Testing feedback** — Log findings in **Inbox** (or a dated note); promote to **Resolved** when you’ve chosen behavior or deferred intentionally.

---

## Product principles — Plant profile (`/vault/[id]`)

**North star:** The plant profile is an **information hub**, not a menu or navigation page. Here the user should:

- **Learn** about the plant (identity, care, packets as relevant).
- **See an overview** of plantings / batches.
- **See history** (what they’ve done — journal, key events).
- **See what’s next** (upcoming care / tasks so the plant doesn’t get “lost”).
- **Enter data consistently and with fewer steps** — avoid chains like: profile → Plants tab → journal affordance → another tab → scroll → FAB (etc.).

**Directional implications**

- Prefer **in-context** patterns on the profile: inline sections, **modals/sheets** that stay scoped to this plant or this planting, and **one primary path** to “log something” where possible.
- **Plantings tab:** Journal-related actions should **not** be defined as “send the user somewhere else” as the default. Logging or viewing activity should feel like part of the **same hub** (e.g. quick log scoped to profile + optional grow, inline preview, or sheet — not only “jump to Journal tab”).
- **Tasks / care:** Upcoming work should be **visible on the profile** (Care tab, summaries, or planting detail), not only Calendar/Garden.

**Note on older roadmap:** Phase 4 in `remaining_steps_roadmap.plan.md` once suggested the Journal icon on a planting **switches to Journal tab + scroll**. That conflicts with this hub model unless reinterpreted (e.g. expand journal on the profile **without** leaving the hub, or a slide-over). Treat this doc as the **current intent** when planning.

---

## Deploy: app vs Supabase

| Layer | What it is | When to “push” |
|--------|------------|----------------|
| **App** (Next.js in this repo) | UI, API routes, client logic | **Git push** to the branch connected to production (e.g. Vercel). Run `npm run build` before merging. |
| **Supabase** (hosted project) | Postgres schema, RLS, Auth, Storage policies | Only when there are **new or pending SQL migrations** (`supabase/migrations/`). Use Supabase CLI (`supabase link` then `supabase db push`) or run statements in **Dashboard → SQL** (see also `supabase/SQL_FOR_SUPABASE.md`). |

**Typical UI-only iterations** (vault polish, modals, journal labels, Add Plant gallery button, etc.): **deploy the app; no Supabase migration required** unless the remote DB was never caught up to existing migrations.

---

## Inbox

(Add new items here; triage into sections below.)

| Date | Topic | Note |
|------|--------|------|
| — | — | — |

---

## Resolved by product / process (reference)

Decisions that stand unless product direction changes.

| Topic | Resolution | Notes |
|--------|------------|--------|
| **Grafted fruit trees / rootstock** | No dedicated “grafted” field today. **Variety/name** (e.g. cultivar + rootstock in variety line), **Growing notes** for permanent graft/rootstock detail, optional **journal** (`vault_add` / `note`) at purchase for a dated record. | First-class option later: optional fields on **permanent** profiles or **grow instance** (e.g. rootstock line), not a new tab. |

---

## Deferred / backlog

| Topic | Why deferred | Possible future trigger |
|--------|----------------|-------------------------|
| **Phase 4 “minimal Plantings cards”** | Conflicts with richer hub; user preference to keep cards informative. | If we add a strong summary row elsewhere and cards feel redundant. |
| **Phase 4 Journal icon → Journal tab only** | Superseded by **information hub** principle (see above). | Revisit only if combined with on-profile journal reveal. |

---

## Related docs

- Roadmap / polish: `.cursor/plans/remaining_steps_roadmap.plan.md`, `full_luxury_polish.plan.md`
- App audit / recommendations: `docs/APP_AUDIT_RECOMMENDATIONS.md`, `docs/IMPLEMENTATION_PLAN_AUDIT.md`
- Navigation: `docs/NAVIGATION_MAP.md`
- Testing policy: `TESTING.md`
