# Navigation Map

**Reference guide for app navigation flows.** Do not change these flows without explicit request/approval. When a flow is changed, update this document to reflect the new behavior.

---

## Governance

| Rule | Description |
|------|-------------|
| **No silent changes** | Navigation flows documented here are intentional. Changing them (e.g., redirect targets, modal vs. page, back behavior) requires approval. |
| **Update on change** | When a flow is modified, update this map in the same change. |
| **Update change log** | When a flow is modified, add an entry to the Change log section. |
| **Source of truth** | This doc is the reference. If code and this doc disagree, fix the code or update the doc with approval. |

---

## Garden

### Garden FAB (floating action button)

| View | Action | Destination / Behavior |
|------|--------|-------------------------|
| **Active Garden** | FAB tap | Opens menu: "Add from Vault", "Add plant", "Add journal entry", Cancel |
| **Active Garden** | "Add from Vault" | Navigate to `/vault/plant?from=garden` |
| **Active Garden** | "Add plant" | Open AddPlantModal (add seasonal/permanent) |
| **Active Garden** | "Add journal entry" | Enter bulk journal mode (select plants, then log) |
| **My Plants** | FAB tap | Opens menu: "Add permanent plant", "Add journal entry", Cancel |
| **My Plants** | "Add permanent plant" | Open AddPlantModal (permanent type) |
| **My Plants** | "Add journal entry" | **Approved:** Open quick-add journal modal (inline). Do not navigate to Journal page. |

### My Plants – profile cards

| Action | Behavior |
|--------|----------|
| **Short tap** | Navigate to `/vault/[id]?from=garden` |
| **Long-press (~500ms)** | Enter selection mode; select this profile. Support multi-select. |
| **Tap when selected** | Toggle selection |
| **Selection mode** | Show "Cancel" / "Done" to clear selection |

### My Plants – quick-add journal modal

| Aspect | Behavior |
|--------|----------|
| **Trigger** | "Add journal entry" from Garden FAB (My Plants view) |
| **Content** | Note (required), optional photo (Take Photo / Choose from Files) |
| **Pre-link** | If profiles selected, create one entry per selected plant (same note/photo) |
| **No selection** | Create one general entry (`plant_profile_id: null`) |
| **On save** | Close modal, clear selection, stay on Garden, refetch |
| **On cancel** | Close modal, stay on Garden |

---

## Journal

### Journal FAB

| Action | Destination / Behavior |
|--------|-------------------------|
| **FAB tap (no selection)** | **Current:** Opens "Quick log" modal with Snapshot / Quick Note / Detailed Log. **Planned:** Navigate directly to `/journal/new` |
| **FAB tap (entries selected)** | Opens selection actions (e.g., bulk delete) |

### Journal – add entry flows

| Flow | Trigger | Destination |
|------|---------|-------------|
| **Snapshot** | Quick log → "Snapshot — take a photo" | Inline modal (camera) |
| **Quick Note** | Quick log → "Quick Note — text only" | Inline modal (text) |
| **Detailed Log** | Quick log → "Detailed Log — link plant, packet, sowing" | Navigate to `/journal/new` |

### Journal – entry cards

| Action | Behavior |
|--------|----------|
| **Short tap** | Navigate to `/vault/[plant_profile_id]?tab=journal` |
| **Long-press (~500ms)** | Enter selection mode; select this entry |
| **Tap when selected** | Toggle selection |

---

## Journal New (`/journal/new`)

| Aspect | Behavior |
|--------|----------|
| **Entry** | Full form: note, photo, plant selection |
| **Back link** | If `?from=garden`: go to `/garden`. Else: go to `/journal` |
| **Cancel** | Same as back link |
| **Post-save redirect** | Same as back link |

---

## Vault

### Vault → Plant (`/vault/plant`)

| Query param | Behavior |
|-------------|----------|
| `from=garden` | "Back" returns to Garden; add-plant flow optimized for garden context |
| `ids=...` | Pre-select packets for batch plant |

### Vault profile (`/vault/[id]`)

| Query param | Behavior |
|-------------|----------|
| `from=garden` | "Back" returns to Garden (My Plants) |
| `tab=journal` | Open Journal tab |

### Vault – selection mode

| Element | Behavior |
|---------|----------|
| **Select / Cancel button** | Single button slot. Shows "Select" when not in selection mode; shows "Cancel" when in selection mode. Same position — user knows where to look. |
| **Select All** | Appears next to Cancel when in selection mode |
| **Vault quantity** | Displays **active** seed packet count only (excludes archived packets) |

### Garden (Active Garden) – bulk selection mode

| Element | Behavior |
|---------|----------|
| **Cancel button** | In the same row as Filter (next to Filter), like Vault. Exits bulk selection mode. |
| **Selecting (N) + Delete** | Shown in row below when items are selected |

---

## Other routes

| Route | Purpose |
|-------|---------|
| `/` | Home / dashboard |
| `/vault` | Seed vault |
| `/garden` | Garden (Active / My Plants) |
| `/journal` | Journal list |
| `/journal/new` | New journal entry (full form) |
| `/calendar` | Calendar / tasks |
| `/shed` | Supplies |
| `/shopping-list` | Shopping list |
| `/settings/*` | Settings |

---

## Change log

| Date | Change |
|------|--------|
| (initial) | Created navigation map. Documented Garden FAB, My Plants quick-add + multi-select (approved), Journal flows (current + planned). |
| (update) | Added Vault: Select/Cancel same-slot behavior, vault quantity = active packets only. |
| 2025-02-22 | Journal FAB goes directly to /journal/new (Quick log modal removed). Garden My Plants: quick-add modal, long-press multi-select. Journal New: ?from=garden → back/cancel/save return to /garden. |
| 2025-02-22 | Both maps (Navigation Map + Navigation Issues Log) now include change logs; both will be updated when flows change or issues are logged/fixed. |
| 2025-02-22 | Garden: Always show toolbar (search, filter, view toggle) even when list is empty. Vault profile Add planting: pass from=garden when opened from garden so redirect returns to garden. |
