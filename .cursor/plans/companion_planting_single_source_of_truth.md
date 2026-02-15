# Companion Planting — Single Source of Truth (Revised)

## Summary

- **Single source of truth**: A global reference table (e.g. `companion_planting_reference`) keyed by plant name, with `companion_plants` and `avoid_plants` arrays. No per-profile storage; we look up by the profile’s plant name when displaying.
- **No vendor scrape**: Companion/avoid data is generic (species-level). Do not add it to URL or PDF scrape flows.
- **Display**: On the profile About tab, look up the profile’s `name` in the reference table and show “Plant with” / “Avoid” or “None known” if no row exists.

---

## 1. Reference table (single source of truth)

**Table:** `companion_planting_reference` (or `plant_companion_lookup`)

| Column            | Type       | Purpose |
|-------------------|------------|--------|
| `id`              | `uuid` PK  | —       |
| `plant_name`      | `text` UNIQUE | Canonical plant name (e.g. "Tomato", "Basil", "Carrot"). Used for lookup. |
| `companion_plants`| `text[]`   | “Plant with” list. |
| `avoid_plants`    | `text[]`   | “Do not plant with” list. |
| `created_at`      | `timestamptz` | Optional. |
| `updated_at`      | `timestamptz` | Optional. |

- **RLS**: Enable RLS; policy: `SELECT` for `authenticated` only (same pattern as `global_plant_cache`). No `user_id`; this is app-wide reference data. **Writes**: regular users do not INSERT/UPDATE; only migrations, service role, or a server-side API route (that uses service role or a `SECURITY DEFINER` function) can write. This allows AI auto-fill to insert new rows.
- **Index**: `CREATE UNIQUE INDEX ON companion_planting_reference (lower(trim(plant_name)));` so lookups are case-insensitive and trim-safe.
- **Optional column**: `source text` (e.g. `'seed' | 'ai'`) to distinguish migration-seeded rows from AI-added rows (useful for developer menu / auditing).

**Seeding:** Populate via migration (or a one-off seed script) with a curated list of common garden plants. Example rows:

- Tomato → companions: Basil, Carrot, Marigold, Onion; avoid: Fennel, Potato, Brassicas
- Basil → companions: Tomato, Pepper; avoid: Rue
- Carrot → companions: Tomato, Lettuce, Onion; avoid: Dill
- … (expand to 30–50+ common plants as needed)

Sources for data: gardening guides, extension offices, or a small hand-curated list. No scraping required.

---

## 2. Lookup flow (how data is “sourced”)

1. User opens a plant profile (e.g. “Tomato – Cherokee Purple”).
2. Backend (or client) has the profile’s `name` (e.g. `"Tomato"` or `"Cherry Tomato"`).
3. **Lookup**: Query `companion_planting_reference` where `lower(trim(plant_name)) = lower(trim(profile.name))` **or** use a “match by first word / canonical name” strategy so “Cherry Tomato” maps to “Tomato” (e.g. normalize to first word, or maintain an alias list).
4. If a row is found: display `companion_plants` and `avoid_plants` in the About tab.
5. If no row is found: show “None known” (or hide the block).

So the **only** place companion/enemy data is stored is this reference table. It is **not** stored on `plant_profiles` and **not** coming from vendor scrape.

---

## 3. Matching profile name → reference row

- **Exact match**: `lower(trim(profile.name))` = `lower(trim(plant_name))`. Works when profile name is “Tomato” and reference has “Tomato”.
- **First-word / canonical**: For “Cherry Tomato”, take first word “Cherry” or map “Cherry Tomato” → “Tomato” (e.g. reference has “Tomato” and we try both full name and first word, or we store “Tomato” and alias “Cherry Tomato”). Simplest v1: store in reference by **common species name** (“Tomato”, “Basil”, “Carrot”). Lookup: try exact match on `profile.name`, then try `split(profile.name)[0]` if you want “Cherry Tomato” to match “Tomato” (then reference would need “Tomato” and we’d need to try “Tomato” from “Cherry Tomato” — e.g. last word or a known list). Easiest v1: **exact match only** on normalized `plant_name`; seed reference with the same names users are likely to have (Tomato, Basil, etc.). If we need “Cherry Tomato” → “Tomato”, add a small alias table or a `normalized_name` column (e.g. “tomato” for both “Tomato” and “Cherry Tomato”).
- **Recommendation**: Seed reference with common names. Lookup: `lower(trim(profile.name))` and also try first word if no match (so “Cherry Tomato” → try “Cherry Tomato” then “Cherry”). If still no match, show “None known”. We can refine matching later (e.g. “Tomato” as last word for “Cherry Tomato”).

---

## 4. No columns on `plant_profiles`

- Do **not** add `companion_plants` or `avoid_plants` to `plant_profiles`.
- All companion/avoid data comes from the reference table lookup by profile name.

**Optional later:** If you want user overrides (“for this variety I want to add Cilantro”), we could add optional columns on `plant_profiles` and merge: “show reference + profile overrides”. Not in initial scope.

---

## 5. Where this runs (backend vs client)

- **Option A – Client**: Profile page fetches profile; then client (or a small API route) fetches companion row(s) by name. Two requests, or one that joins (see B).
- **Option B – Server/API**: When loading the profile, server does the lookup (e.g. in the same page load or API that returns profile) and returns `companion_plants` and `avoid_plants` along with the profile. Single round-trip.
- **Option C – Supabase join**: Not a real “join” because reference is keyed by name, not profile id. So we’d do: load profile, then `select * from companion_planting_reference where lower(trim(plant_name)) = lower(trim($profileName))`. Easiest in the same place you load the profile (e.g. vault `[id]` page): after fetching the profile, run one query to the reference table and attach result to state.

Recommendation: In the **profile detail page** (vault `[id]`), after loading the profile, run a single `select companion_plants, avoid_plants from companion_planting_reference where lower(trim(plant_name)) = lower(trim(${profile.name}))` and use that for the About tab block. If no row exists, trigger **AI auto-fill** (see section 8); then display the result.

---

## 6. Vendor scrape / import

- **Do not** add companion/avoid to:
  - URL scraping (vendor product pages),
  - PDF catalog import,
  - or any other import path.
- Companion data is generic and comes only from the reference table.

---

## 7. UI (unchanged from original plan)

- **About tab**: One card “Companion planting”.
  - If lookup returned a row: show “Plant with: …” and “Avoid: …” (chips or comma-separated).
  - If no row: show “None known.”
- Mobile-friendly, same as before. No Edit fields for companion/avoid (since it’s read-only from reference).

---

## 8. AI auto-fill (on first profile view)

When we display a profile and **no row** exists in `companion_planting_reference` for that plant name:

1. Show a brief “Looking up companion info…” state in the Companion planting card.
2. Call AI (e.g. Gemini, same as existing app usage) with a prompt: *“What are the recommended companion plants and plants to avoid for [plant name]? Return only a JSON object with keys: companions (array of plant names), avoid (array of plant names). Use common names only.”*
3. Parse the response; normalize to arrays (trim, filter empty).
4. **Insert** a new row into `companion_planting_reference` via a server-side API route that uses **service role** (or a Supabase RPC with `SECURITY DEFINER`) so the table can be written. Use `plant_name` = normalized profile name (e.g. the name we looked up with). Set `source = 'ai'` if column exists.
5. Update UI state with the new data and show “Plant with” / “Avoid” in the card.

**When to trigger:** Only when the profile is **viewed** and the lookup returns no row. Do not run AI on every profile create (e.g. bulk import) — that would cause many calls. Lazy on first view keeps cost and rate limits under control.

**Matching for AI:** Use the same name we use for lookup (e.g. `profile.name` trimmed; or “last word” for “Cherry Tomato” → “Tomato” so the reference row is reusable). The row we insert should use a canonical form (e.g. “Tomato”) so future profiles with “Tomato” or “Cherry Tomato” (if we match on last word) hit the same row.

**Failure:** If AI fails or returns invalid data, show “None known” and do not insert. Optionally retry on next view.

---

## 9. Developer menu: Companion planting guide

Add a section under **Settings → Developer** (or existing developer page):

- **“Companion planting guide”**: List plants currently in the reference table (plant_name, companion_plants, avoid_plants, source). Read-only list so the user can see what’s saved; optional later: edit/delete rows.
- **“Plants not in guide yet”**: List plant **names** that appear in the user’s vault (from `plant_profiles` where `deleted_at` is null) but have **no** row in `companion_planting_reference` (using the same matching logic). So the user (and their sister) can see which plants will trigger an AI lookup on first view, or which they might want to add manually. Keeps the “info saved away” so they can update the reference later (e.g. after opening those profiles to auto-fill, or via a future edit flow).

No email in v1; developer menu is the single place to see guide + missing list.

---

## 10. Implementation checklist

- [ ] Migration: create `companion_planting_reference` table (with optional `source`), unique index on normalized plant_name, RLS (SELECT for authenticated; no direct user INSERT/UPDATE).
- [ ] Migration or seed script: insert initial set of common plants (e.g. 20–50 rows), `source = 'seed'`.
- [ ] API route (server-side): e.g. `POST /api/companion-lookup` or `POST /api/companion-fill`: accepts plant name, calls AI, inserts into reference via service role (or RPC), returns `{ companion_plants, avoid_plants }`. Called from profile page when lookup is empty.
- [ ] Profile detail page: after loading profile, query reference by `profile.name` (with chosen matching rule). If no row: call the API to AI-fill and insert; then display. If row exists: display. State: companion/avoid + loading/error.
- [ ] About tab: “Companion planting” card; show “Looking up…” when fetching AI; show “Plant with” / “Avoid” or “None known” when done.
- [ ] Developer menu: “Companion planting guide” (list reference table); “Plants not in guide yet” (vault plant names with no reference row).
- [ ] Types: TypeScript type for reference row (e.g. `CompanionPlantingReference`).
- [ ] No changes to: vendor scrape, PDF import, or `plant_profiles` schema (no new columns).

---

## 11. Optional: matching “Cherry Tomato” → “Tomato”

- **V1**: Exact match only. Seed “Tomato” in reference; profiles named exactly “Tomato” get data; “Cherry Tomato” does not until we improve matching.
- **V2**: Try first word: “Cherry Tomato” → try “Cherry” (no match). Try last word “Tomato” (match). So lookup logic: 1) full name, 2) last word (or “most common” token). Or add `aliases text[]` to reference: e.g. row “Tomato” has `aliases = ['Cherry Tomato', 'Beefsteak Tomato']` and we match profile.name against `plant_name` or `aliases`. That’s more flexible and still one source of truth.
