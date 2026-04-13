# VOYAGER SANCTUARY — ARCHITECTURE
**Version:** 1.2 — LOCKED  
**Date:** March 11, 2026  
**Last Updated:** All architectural decisions finalized. Build-ready.

---

## FINAL DECISION LOG (Locked March 11, 2026)

| Decision | Choice | Rationale |
|---|---|---|
| Shard completion | Visual-only. No `is_complete`. | Pebble is the unit of work. Shards are the roadmap to get there. |
| Progress bar | Burned Pebbles only. | Cleanest math. Immediate visual feedback. Simple SQL. |
| Auth | Hard login gate. No guest mode. | Avoids local-to-cloud migration. The "Key to the Sanctuary" is on-brand. |
| Offline | None for MVP. Online-only. | Move fast. Offline is post-v1. |
| Mallet | Tap to reveal (Option B). | The Scroll Map should look like art until the user chooses to architect. |
| Mountain cap | 3 active mountains max. | "Rule of Three." Subtraction for focus. Archive to open new paths. |
| Satchel UX | Compact tray on Sanctuary + full-screen detail. | Tray enables drag-to-hearth. Full screen shows metadata. |
| Whetstone | 5 starter habits (pre-loaded). Reorderable. | Blank first screen is disorienting. Starters show intent. |
| Realtime sync | Supabase realtime ON from day one. | Trivial to enable. Painful to retrofit. |
| Notifications | None for MVP. | Elias is a Silent Operator. Notifications feel like nagging. |
| Art assets | Placeholder gradients + labeled rectangles. | Build around the asset slot, not the art. |

---

## DESIGN AESTHETIC — THE NORTH STAR

> **Cozy. Smooth. Gamified. Polished. Fun.** (Aligned with [MASTER_PLAN.md](MASTER_PLAN.md) § Design Aesthetic.)

A Studio Ghibli–esque retreat—tactile, whimsical, satisfying. Japandi: minimal entry points, calm over chaos, "less is more." Ritual over task list. The Sanctuary is a place you want to return to, not a productivity tool you open out of obligation. *Evicted:* "Hotel Executive" / high-end office vibes; status over satisfaction.

| Element | Aesthetic Direction |
|---|---|
| **Textures** | Worn parchment, vellum for overlays and bubbles; tactile, hand-crafted feel |
| **Color palette** | Dark Walnut, Cream Parchment, warm orange accents (`#C26D2B`). Charcoal Stone or Misty Navy instead of flat grey; Warm Parchment or Soft Linen instead of pure white. Organic, muted tones. |
| **Typography** | Serif or refined sans-serif. No playful rounded fonts. |
| **Iconography** | Weighty, intentional. Stone and fire metaphors. No flat emoji-style icons. |
| **Animations** | Slow, deliberate, physical. Stone weight. Fire warmth. No bouncy spring physics. |
| **Whitespace** | Generous. The Sanctuary should feel like a room, not a dashboard. |

**Elias specifically:** He is a *Grounded Presence*, not an assistant. He speaks like a guide, not a coach. He does not lecture, nag, or offer project advice. He greets warmly, holds the space, and gatekeeps the Satchel refill. He is a Silent Operator.

---

## TECH STACK RATIONALE

| Layer | Technology | Why |
|---|---|---|
| Frontend | Flutter (stable) | Single codebase for iOS + Android. Highly performant (Skia/Impeller). Rich animation support critical for Hearth effects and drag interactions. |
| State | Riverpod (+ riverpod_generator) | Compile-safe providers. No BuildContext dependency. Testable in isolation. Code-gen reduces boilerplate. |
| Backend | Supabase | Postgres (LTREE native), Row-Level Security, real-time streams, Auth, and Storage in one platform. |
| Hierarchy | LTREE (Postgres extension) | Shards live in Pebbles, in Boulders, in Mountains. LTREE queries entire subtrees with a single indexed query instead of recursive JOINs. |
| Navigation | go_router | Declarative, URL-based routing. Essential for deep links and auth guards. |
| Local Cache | **NONE (MVP)** | Online-only for MVP. Isar/offline sync deferred to post-v1. Move fast, validate the core loop first. |
| Animations | flutter_animate | Chainable animation API. Used for Hearth burn, stone shatter, satchel pack. |
| Date/Time | intl + dart:core DateTime | Midnight sweep, Yesterday/Today/Tomorrow slider, Due Date comparisons. |

---

## FOLDER STRUCTURE

```
lib/
├── main.dart                  # App entry, ProviderScope, Supabase init
├── app.dart                   # MaterialApp + go_router setup
│
├── core/
│   ├── constants/             # Colors, text styles, durations, asset paths
│   ├── enums/                 # DayPeriod, NodeType, SatchelSlotState
│   ├── extensions/            # DateTime extensions (isSameDay, dayPeriod)
│   └── utils/                 # LtreePath builder, priority sorter
│
├── data/
│   ├── models/                # Immutable data classes (Mountain, Node, WhetstoneItem)
│   ├── repositories/          # One repo per domain (mountains, nodes, satchel, whetstone)
│   └── supabase_service.dart  # Supabase client singleton
│
├── providers/
│   ├── auth_provider.dart
│   ├── time_of_day_provider.dart
│   ├── mountain_provider.dart
│   ├── node_provider.dart
│   ├── satchel_provider.dart
│   └── whetstone_provider.dart
│
├── features/
│   ├── entrance/              # EntranceScreen
│   ├── sanctuary/             # SanctuaryScreen (Elias, Hearth, icons)
│   ├── scroll_map/            # ScrollMapScreen, MountainCard, MalletTool
│   ├── satchel/               # SatchelScreen, StoneWidget, SlotWidget
│   ├── whetstone/             # WhetstoneScreen, HabitRow, DaySlider
│   └── management/            # ManagementMenuSheet, ArchiveScreen
│
└── widgets/                   # Shared atomic widgets (HearthWidget, EliasSprite, etc.)
```

---

## DATABASE SCHEMA

### Enable LTREE Extension
```sql
CREATE EXTENSION IF NOT EXISTS ltree;
```

---

### Table: `profiles`
Extends Supabase `auth.users`. Created via trigger on signup.
```sql
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access own profile"
  ON profiles FOR ALL USING (auth.uid() = id);
```

---

### Table: `mountains`
Top-level goal categories. The "mountains" a user is climbing.

**HARD RULE: Maximum 3 active (non-archived) mountains per user.**
This is enforced at the application layer. Before creating a new mountain, the app queries
`COUNT(*) WHERE user_id = ? AND is_archived = FALSE`. If count >= 3, the [+] button is disabled
and a message is shown: *"You are climbing 3 mountains. Archive one before opening a new path."*

```sql
CREATE TABLE mountains (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  order_index INT DEFAULT 0,         -- display order on Scroll Map
  is_archived BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE mountains ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns their mountains"
  ON mountains FOR ALL USING (auth.uid() = user_id);
```

---

### Table: `nodes`
The core hierarchy table. Houses all four node types: Boulder, Pebble, and Shard.
The `path` column uses LTREE to encode the full ancestry.

**LTREE Path Convention:**
```
{mountain_id}.{boulder_id}                           → Boulder    (milestone)
{mountain_id}.{boulder_id}.{pebble_id}              → Pebble     (task)
{mountain_id}.{boulder_id}.{pebble_id}.{shard_id}   → Shard      (sub-task)
```

**The Full Hierarchy:**
```
Mountain  (mountains table)
  └── Boulder  (nodes: node_type = 'boulder')     — The Landmark. A major milestone.
        └── Pebble   (nodes: node_type = 'pebble')     — The Task. What goes in the Satchel.
              └── Shard    (nodes: node_type = 'shard')      — The Sub-task. A granular step.
```

**What can enter the Satchel:** Only **Pebbles**. Shards are visual-only planning notes. They have no independent completion state. When their parent Pebble is burned, its Shards are deleted/archived silently. Shards are never packed, never burned individually, never tracked for progress.

All UUIDs are stripped of hyphens for LTREE compatibility (UUIDs with hyphens are not valid LTREE labels).

```sql
CREATE TABLE nodes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mountain_id   UUID NOT NULL REFERENCES mountains(id) ON DELETE CASCADE,
  path          LTREE NOT NULL,        -- e.g. 'abc_123.def_456.ghi_789' (underscores, no hyphens)
  node_type     TEXT NOT NULL CHECK (node_type IN ('boulder', 'pebble', 'shard')),
  title         TEXT NOT NULL DEFAULT '',
  is_starred    BOOLEAN DEFAULT FALSE,  -- meaningful on pebbles + shards (inherited on split)
  due_date      DATE,                   -- meaningful on pebbles + shards (inherited on split)
  is_complete   BOOLEAN DEFAULT FALSE,  -- ONLY meaningful on pebbles. Shards: always false, never set.
  completed_at  TIMESTAMPTZ,            -- ONLY set on pebbles at burn time.
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Constraint: shards cannot be individually completed
-- Enforced at application layer (not DB constraint) to keep schema simple.
-- Rule: if node_type = 'shard', is_complete must always remain FALSE.

-- Critical index: makes subtree queries O(log n)
CREATE INDEX nodes_path_gist ON nodes USING GIST(path);
CREATE INDEX nodes_user_mountain ON nodes(user_id, mountain_id);

ALTER TABLE nodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns their nodes"
  ON nodes FOR ALL USING (auth.uid() = user_id);
```

**Key LTREE Queries:**
```sql
-- All children of a boulder (pebbles)
SELECT * FROM nodes WHERE path <@ 'mountainId.boulderId';

-- Direct children only
SELECT * FROM nodes WHERE path ~ 'mountainId.boulderId.*{1}';

-- Mountain progress: burned Pebbles only. Shards and Boulders do NOT count.
-- progress = complete_pebbles / total_pebbles
SELECT
  COUNT(*) FILTER (WHERE is_complete = TRUE) as complete_pebbles,
  COUNT(*)                                   as total_pebbles
FROM nodes
WHERE mountain_id = $1
  AND node_type = 'pebble';  -- Shards excluded. Boulders excluded.
```

---

### Table: `satchel_slots`
Tracks what's currently in the user's 6-slot execution bag.
This is a snapshot table — we never auto-populate it. Only "Pack Satchel" writes to it.

```sql
CREATE TABLE satchel_slots (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  slot_index INT NOT NULL CHECK (slot_index BETWEEN 1 AND 6),
  node_id   UUID REFERENCES nodes(id) ON DELETE SET NULL,  -- NULL = empty slot
  packed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, slot_index)
);

ALTER TABLE satchel_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns their satchel"
  ON satchel_slots FOR ALL USING (auth.uid() = user_id);
```

---

### Priority Query (Pack Satchel Logic)
This query runs when the user taps "Pack Satchel." It fetches the top N unpacked, incomplete
**Pebbles only** — Shards are sub-tasks for planning purposes, not individually packable.
Ordered by: due_date ASC NULLS LAST → is_starred DESC → created_at ASC (FIFO).

```sql
SELECT n.*
FROM nodes n
LEFT JOIN satchel_slots ss ON ss.node_id = n.id AND ss.user_id = n.user_id
WHERE n.user_id = $1
  AND n.node_type = 'pebble'      -- Pebbles only. Shards stay in the Scroll Map.
  AND n.is_complete = FALSE
  AND ss.node_id IS NULL          -- not already in satchel
ORDER BY
  n.due_date ASC NULLS LAST,      -- 1. Due Date (soonest first — rare/emergency)
  n.is_starred DESC,              -- 2. Starred (manually flagged priorities)
  n.created_at ASC                -- 3. FIFO (oldest created = highest default priority)
LIMIT 6;
```

---

### Table: `whetstone_items`
The user's recurring habits and rituals. Static list they maintain.
```sql
CREATE TABLE whetstone_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  order_index INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE whetstone_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns their whetstone items"
  ON whetstone_items FOR ALL USING (auth.uid() = user_id);
```

---

### Table: `whetstone_completions`
One row per (user, item, date). This is how we track daily check-offs without deleting data.
The "reset at midnight" logic is achieved by querying by date — we never delete rows.
```sql
CREATE TABLE whetstone_completions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id     UUID NOT NULL REFERENCES whetstone_items(id) ON DELETE CASCADE,
  completed_date DATE NOT NULL,   -- local date (YYYY-MM-DD), not UTC
  completed_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, item_id, completed_date)
);

ALTER TABLE whetstone_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User owns their completions"
  ON whetstone_completions FOR ALL USING (auth.uid() = user_id);
```

---

## RIVERPOD PROVIDER MAP

```
AuthProvider                    (StreamProvider<User?>)
  └── drives go_router redirect

TimeOfDayProvider               (StreamProvider<DayPeriod>)
  └── drives: EntranceScreen bg, EliasSprite pose, Elias greeting pool

MountainListProvider            (StreamProvider<List<Mountain>>)
  └── drives: ScrollMapScreen list

NodeProvider(mountainId)        (StreamProvider<List<Node>>)
  └── drives: MountainCard nodes, Mallet targets

SatchelProvider                 (StateNotifierProvider<SatchelNotifier, SatchelState>)
  ├── SatchelState: List<SatchelSlot> (6 slots, nullable node)
  ├── packSatchel(): runs priority query, fills empty slots
  └── burnStone(slotIndex): marks node complete, sets slot to null (NO auto-refill)

WhetstoneProvider               (StateNotifierProvider<WhetstoneNotifier, WhetstoneState>)
  ├── WhetstoneState: selectedDate, List<WhetstoneItem>, Set<completedItemIds>
  ├── selectDay(DayOffset): Yesterday / Today / Tomorrow
  └── toggleCompletion(itemId): upsert/delete whetstone_completions for selectedDate

ActiveDayProvider               (StateProvider<DayOffset>)
  └── drives: WhetstoneScreen slider position
```

---

## NODE SPLITTING LOGIC (THE MALLET)

The Mallet is the architectural tool. Its behavior changes based on what it's dropped onto.

### Mallet on Mountain Path (empty space)
```
Before: Mountain (no boulder selected)
After:  Boulder (id: B1, path: M1.B1, title: '', node_type: 'boulder')
        → keyboard opens on B1.title
```

### Mallet on Boulder → Shatter to Pebble
```
Before: Boulder (id: B1, path: M1.B1)
After:  Boulder (id: B1, path: M1.B1)         [unchanged]
        Pebble  (id: P1, path: M1.B1.P1,
                 title: '', starred: false, due_date: null, node_type: 'pebble')
        → keyboard opens on P1.title
```

### Mallet on Pebble → Split to 2 Pebbles
```
Before: Pebble (id: P1, path: M1.B1.P1, starred: true, due_date: 2026-04-01)
After:  Pebble (id: P1, path: M1.B1.P1, starred: true, due_date: 2026-04-01)   [unchanged]
        Pebble (id: P2, path: M1.B1.P2, starred: true, due_date: 2026-04-01)   [CLONED metadata]
        → keyboard opens on P2.title (empty)
```

### Mallet on Shard → Split to 2 Shards
```
Before: Shard (id: S1, path: M1.B1.P1.S1, starred: true, due_date: 2026-04-01)
After:  Shard (id: S1, path: M1.B1.P1.S1, starred: true, due_date: 2026-04-01)  [unchanged]
        Shard (id: S2, path: M1.B1.P1.S2, starred: true, due_date: 2026-04-01)  [CLONED metadata]
        → keyboard opens on S2.title (empty)
```

**The Metadata Clone Rule (INVIOLABLE):**
On any split operation, `is_starred` and `due_date` are ALWAYS cloned to the new sibling node.
Title starts empty on the new node. Parent path stays the same (siblings, not children).

**The Deadline Pressure Rule (Why this matters):**
If a task has a due date and is too large, splitting it into two shards ensures both
inherit the deadline. The urgency is never lost during architectural refinement.

---

## SECURITY MODEL

- All tables have RLS enabled.
- Every insert/update/delete MUST include `user_id: supabase.auth.currentUser!.id`.
- Supabase anon key is safe to ship in the client (RLS is the auth boundary).
- Service role key NEVER touches the Flutter app.
- JWT tokens managed by `supabase_flutter` SDK automatically.

---

## LTREE UUID SANITIZATION HELPER

LTREE labels cannot contain hyphens. UUIDs must be sanitized before use as path segments.

```dart
// lib/core/utils/ltree_path.dart
extension LtreeUuid on String {
  /// Converts a UUID to a LTREE-safe label by replacing hyphens with underscores.
  String get ltreeLabel => replaceAll('-', '_');
}

// Mountain → Boulder
String buildBoulderPath(String mountainId, String boulderId) =>
    '${mountainId.ltreeLabel}.${boulderId.ltreeLabel}';

// Mountain → Boulder → Pebble
String buildPebblePath(String mountainId, String boulderId, String pebbleId) =>
    '${mountainId.ltreeLabel}.${boulderId.ltreeLabel}.${pebbleId.ltreeLabel}';

// Mountain → Boulder → Pebble → Shard
String buildShardPath(String mountainId, String boulderId, String pebbleId, String shardId) =>
    '${mountainId.ltreeLabel}.${boulderId.ltreeLabel}.${pebbleId.ltreeLabel}.${shardId.ltreeLabel}';

// Derive parent path from any child path (strip last label)
String parentPath(String ltreePath) {
  final segments = ltreePath.split('.');
  if (segments.length <= 1) throw ArgumentError('Root node has no parent.');
  return segments.sublist(0, segments.length - 1).join('.');
}

// Determine node depth from path length
int nodeDepth(String ltreePath) => ltreePath.split('.').length;
// depth 1 = Boulder, 2 = Pebble, 3 = Shard
```

**Path depth reference:**
```
M1                          depth 1 → Boulder
M1.B1                       depth 2 → Pebble   ← also depth 1 relative to its mountain
M1.B1.P1                    depth 3 → Shard
M1.B1.P1.S1                 depth 4 → (reserved / not used in MVP)
```

Note: Mountain IDs are stored in the `mountains` table, not as LTREE root nodes. The LTREE path on `nodes` starts at the Boulder level, with the mountain_id as the first label.
