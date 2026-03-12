# Grow Instance Page — Spec

**Route:** `/garden/grow/[id]` (id = `grow_instance.id`)

The plant **profile** (`/vault/[id]`) describes a variety ("how to grow Peaches"). The **instance page** describes *this specific plant* ("this peach tree: when planted, last fertilized, task history"). Not a duplicate of the profile — personal, minimal, journal-focused.

---

## Data model

| Table | Purpose |
|-------|---------|
| `grow_instances` | Core row: sown_date, expected_harvest_date, status, location, ended_at, end_reason, seed_packet_id, vendor, is_permanent_planting |
| `plant_profiles` | Joined for variety name, variety_name, hero_image_url, hero_image_path |
| `journal_entries` | Filtered by grow_instance_id: task history, photos, notes |
| `tasks` | Filtered by grow_instance_id: next-due task, completed care history |
| `supply_profiles` | Optional join: show product name when last-fertilized entry has supply_profile_id |

---

## Decisions

| # | Decision |
|---|----------|
| Q1 | Red trash = **archive** (set status to archived + ended_at + end_reason). Not soft-delete in v1. "Remove permanently" deferred to Settings later. |
| Q2 | Stats bar Next milestone: show `Harvest ~45 days · Next: Fertilize Tue` when both exist; show only the one that exists otherwise; if harvest is in the past, show only next task. |
| Q3 | **Location only in v1.** Use `grow_instances.location` as display name. Nickname column and UI added later. |
| Q4 | Include "View plant profile" link to `/vault/[plant_profile_id]` in the header. |
| Q5 | Health & Notes tab uses journal entries with `entry_type = 'note'` and `grow_instance_id = this id`. No new `instance_notes` column in v1. |

---

## Page structure

### Back link
- `?from=profile` → `/vault/[plant_profile_id]?tab=plantings`
- `?from=garden&gardenTab=active` → `/garden?tab=active`
- `?from=garden&gardenTab=plants` → `/garden?tab=plants`
- Fallback (no from/gardenTab): `/garden` (or `/garden?tab=plants` if `is_permanent_planting`)

### Header
- Back button (left), title: `{profile.name}{location ? " · " + location : ""}` (right: "View variety" link to vault)
- Edit (pencil icon, inline location) and red trash (archive with confirm dialog)

### Hero image
Law 7 fallback for this grow: latest `image_file_path` from journal entries for this grow → `hero_image_path` (journal-photos bucket) from plant profile → `hero_image_url` (external URL) from plant profile → `PlantPlaceholderIcon`

### Stats bar (horizontal scroll)
| Stat | Source |
|------|--------|
| Age | `sown_date` → today (or `ended_at` if ended); formatted as "X yrs Y mo" or "X days" |
| Status | `grow_instance.status`; colored badge |
| Next milestone | `expected_harvest_date` days-remaining + first incomplete task for this grow |
| Location | `grow_instance.location` (tappable to edit inline) |

### Tabs
- **Overview:** Date planted, sow method, plant count, location, vertical photo gallery (journal photos for this grow only, newest first)
- **Task history:** Vertical timeline of journal entries + completed tasks; "Last fertilized" card if a care/fertilize entry exists; thumbnails when entry has photo
- **Health & notes:** Journal entries with `entry_type = 'note'` for this grow + "Add note" CTA (opens QuickLogModal scoped to this plant profile)

---

## Navigation wiring

| From | Link |
|------|------|
| Plant profile → Plantings tab | `/garden/grow/${gi.id}?from=profile` |
| Garden (Active, grid card) | `/garden/grow/${batch.id}?from=garden&gardenTab=active` |
| Garden (Active, list card) | `/garden/grow/${batch.id}?from=garden&gardenTab=active` |
| Garden (My Plants, list card) | `/garden/grow/${batch.id}?from=garden&gardenTab=plants` |

---

## Out of scope (future)

- Nickname column + UI (v2)
- `instance_notes` column (if one rich note per instance preferred later)
- Garden-versary badge/toast (1 year milestone)
- "Remove permanently" action in Settings
