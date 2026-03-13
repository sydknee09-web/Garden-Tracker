# VOYAGER SANCTUARY — NAVIGATION MAP
**Version:** 1.2 — LOCKED  
**Date:** March 11, 2026  
**Last Updated:** Mallet tap-to-reveal, Satchel compact tray, Mountain cap at 3

---

## ROUTE TABLE

| Route | Screen | Auth Required |
|---|---|---|
| `/` | EntranceScreen (splash/redirect) | No |
| `/login` | LoginScreen | No |
| `/sanctuary` | SanctuaryScreen (main hub) | Yes |
| `/scroll` | ScrollMapScreen | Yes |
| `/scroll/:mountainId` | MountainDetailScreen (nodes view) | Yes |
| `/satchel` | SatchelScreen | Yes |
| `/whetstone` | WhetstoneScreen | Yes |
| `/management` | ManagementMenuSheet (bottom sheet) | Yes |
| `/archive` | ArchiveRecoveryScreen | Yes |
| `/settings` | SettingsScreen | Yes |

---

## SCREEN-BY-SCREEN MAP

---

### 1. ENTRANCE SCREEN (`/`)
**Type:** Animated splash → auto-redirect  
**Auth guard:** None (runs before auth check)

```
[APP LAUNCH]
     │
     ▼
Read device clock
     │
     ├── 5am–10am  → Load DAWN background
     ├── 10am–5pm  → Load MIDDAY background
     ├── 5pm–8pm   → Load SUNSET background
     └── 8pm–5am   → Load NIGHT background
     │
     ▼
Show background + Elias (correct pose) for ~1.5s
     │
     ▼
Check Supabase auth state
     │
     ├── Authenticated  → Navigate to /sanctuary
     └── Not authed     → Navigate to /login
```

**Assets used:** `assets/backgrounds/dawn.png`, `midday.png`, `sunset.png`, `night.png`  
**Elias assets:** `assets/elias/dawn_pose.png`, `midday_pose.png`, `sunset_pose.png`, `night_pose.png`

---

### 2. LOGIN SCREEN (`/login`)
**Type:** Full screen  
**Auth guard:** Redirect to `/sanctuary` if already logged in

```
[LoginScreen]
  Email + Password fields
  [Sign In] button → Supabase signInWithPassword
  [Sign Up] link → toggle to signup form
  │
  ├── Success → AuthProvider updates → go_router redirects to /sanctuary
  └── Failure → show inline error message
```

---

### 3. SANCTUARY SCREEN (`/sanctuary`) ⭐ MAIN HUB
**Type:** Full screen, static campsite scene  
**Auth guard:** Yes — redirect to /login if not authenticated

```
┌─────────────────────────────────────┐
│         [TIME-OF-DAY BACKGROUND]    │
│                                     │
│   [ELIAS SPRITE - left/center]      │  ← Tap → opens ManagementMenuSheet
│   "Good morning, traveler..."       │
│                                     │
│         [ THE HEARTH 🔥 ]           │  ← DragTarget: accepts stones from compact tray
│         (center campfire)           │     On drop: burn animation → complete task
│                                     │
│  [WHETSTONE 🪨]     [SCROLL 📜]    │  ← Tap Whetstone → /whetstone
│  (bottom-left)      (bottom-right)  │     Tap Scroll    → /scroll
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ [S1][S2][S3][S4][S5][S6]  🎒   │ │  ← COMPACT SATCHEL TRAY (always visible)
│ └─────────────────────────────────┘ │     Each slot: draggable stone
└─────────────────────────────────────┘     Tapping 🎒 icon → /satchel (full detail)
                                            Tapping empty slot → ManagementMenuSheet
                                            Drag stone up to Hearth → burns it
```

**The Compact Satchel Tray:**
- Always rendered at the bottom of the Sanctuary screen.
- Shows up to 6 stone slots. Filled slots show a stone (with title truncated). Empty slots show an empty slot visual.
- Each filled stone is a `Draggable` widget. Drag up to the Hearth `DragTarget` to burn.
- Tapping the 🎒 icon pushes to `/satchel` for full metadata view (due dates, stars, mountain).
- Tapping an empty slot opens ManagementMenuSheet directly to the Pack Satchel option.

**Interactions:**
| Element | Tap | Long-Press | Drag |
|---|---|---|---|
| Elias | Opens ManagementMenuSheet | — | — |
| Hearth | — | — | **Receives** stones from compact tray → burns task |
| Whetstone icon | → /whetstone | — | — |
| Scroll icon | → /scroll | — | — |
| Compact tray stone | — | — | **Source** — drag to Hearth |
| Compact tray 🎒 icon | → /satchel (full view) | — | — |
| Compact tray empty slot | Opens ManagementMenuSheet (Pack Satchel focused) | — | — |

---

### 4. MANAGEMENT MENU SHEET
**Type:** Bottom sheet (modal, slides up from Sanctuary)  
**Trigger:** Tap Elias OR tap empty Satchel slot

```
┌─────────────────────────────────────┐
│  ▬  (drag handle)                   │
│                                     │
│  🎒  Pack Satchel                   │  ← runs priority query → fills empty slots
│  ⚙️  Settings                       │  ← → /settings
│  📦  Archive Recovery               │  ← → /archive
│  🚪  Sign Out                       │  ← Supabase signOut
│                                     │
└─────────────────────────────────────┘
```

**Pack Satchel flow:**
```
Tap "Pack Satchel"
     │
     ▼
Count empty satchel slots (0–6)
     │
     ├── 0 empty → dismiss sheet, show toast "Your satchel is full."
     └── N empty → run priority query (Due Date → Starred → FIFO)
                   fill N slots with top N results
                   animate stones flying into satchel
                   dismiss sheet
```

---

### 5. SATCHEL SCREEN (`/satchel`)
**Type:** Full screen overlay (slides up or pushes)

```
┌─────────────────────────────────────┐
│  ← Back          YOUR SATCHEL       │
├─────────────────────────────────────┤
│  [SLOT 1: Stone Title ⭐ 📅 Mar 15] │  ← Draggable (drag to Hearth on Sanctuary)
│  [SLOT 2: Stone Title              ]│
│  [SLOT 3: ─────── empty ──────────]│  ← Tap empty slot → ManagementMenuSheet
│  [SLOT 4: Stone Title              ]│
│  [SLOT 5: ─────── empty ──────────]│
│  [SLOT 6: Stone Title 📅 Mar 20   ]│
├─────────────────────────────────────┤
│  [⚔️ Pack Satchel]                  │  ← shortcut to Pack Satchel
└─────────────────────────────────────┘
```

**Stone metadata displayed per slot:**
- Title
- Star indicator (if `is_starred`)
- Due date badge (if `due_date` is set)
- Which mountain it belongs to (subtitle)

**Drag behavior:** Stones are draggable widgets. When user navigates back to Sanctuary with a stone held, it can be dropped on the Hearth.

---

### 6. SCROLL MAP SCREEN (`/scroll`)
**Type:** Full screen, vertically scrollable  
**Mountain cap:** Maximum 3 active mountains. `[+]` is disabled when count = 3.

```
┌─────────────────────────────────────┐
│  ← Back     THE SCROLL MAP   [+ 🏔️] │  ← [+] disabled if 3 active mountains exist
├─────────────────────────────────────┤
│                                     │
│  🏔️ MOUNTAIN 1                      │  ← Long-press → (Rename / Archive)
│  ████████░░░░ 65%  (pebbles only)  │
│  └── 🪨 Boulder A                   │
│       ├── 🌑 Pebble 1 ⭐            │
│       │    └── · Shard 1a           │  ← Shards shown as indented sub-bullets
│       │    └── · Shard 1b           │     No checkbox. Visual notes only.
│       └── 🌑 Pebble 2 📅            │
│  └── 🪨 Boulder B                   │
│       └── 🌑 Pebble 3              │
│                                     │
│  🏔️ MOUNTAIN 2                      │
│  ██░░░░░░░░░░ 15%                   │
│                                     │
│  🏔️ MOUNTAIN 3                      │
│  ░░░░░░░░░░░░ 0%                    │
│                                     │
│  ─── [+ Add Mountain] ─── (greyed) │  ← Greyed + message if at cap
├─────────────────────────────────────┤
│              [🔨]                   │  ← "Architect" tool icon. TAP TO REVEAL mallet.
└─────────────────────────────────────┘
```

**Mallet — Tap to Reveal (Architecture Mode)**

The `[🔨]` icon sits quietly at the bottom of the screen. The Scroll Map looks like a clean,
readable document by default. Tapping `[🔨]` enters **Architecture Mode**:
- A visual cue signals the mode is active (icon highlights, subtle overlay).
- The mallet "attaches" — user drags from any node to the target.
- After a drag action completes, Architecture Mode automatically deactivates.
- Tapping `[🔨]` again also deactivates.

```
ARCHITECTURE MODE — MALLET TARGETS:

  [Drag on] Mountain section (empty space between nodes)
       → CREATE Boulder
       → Dialog: enter boulder name
       → Architecture Mode deactivates

  [Drag on] Boulder
       → SHATTER: creates 1 new empty Pebble as child
       → Keyboard opens on Pebble title
       → Architecture Mode deactivates

  [Drag on] Pebble
       → SPLIT: creates 1 new sibling Pebble
       → Clones is_starred + due_date to new pebble
       → New pebble title is empty, keyboard opens
       → Architecture Mode deactivates

  [Drag on] Shard
       → SPLIT: creates 1 new sibling Shard
       → Clones is_starred + due_date to new shard
       → New shard title is empty, keyboard opens
       → Architecture Mode deactivates
```

**Node context menu (long-press any node, outside Architecture Mode):**
- Edit title
- Set due date (date picker)
- Toggle star ⭐
- Delete (with confirmation)

---

### 7. WHETSTONE SCREEN (`/whetstone`)
**Type:** Full screen, parchment aesthetic

```
┌─────────────────────────────────────┐
│  ← Back        THE WHETSTONE        │
├─────────────────────────────────────┤
│  [ Yesterday ]  [ Today ]  [Tomorrow]│  ← Day slider (StateProvider)
├─────────────────────────────────────┤
│                                     │
│  ☐  Morning Meditation              │
│  ☑  10,000 Steps                   │  ← checked for this date
│  ☐  Read 20 Pages                  │
│  ☐  Cold Shower                    │
│  ☑  Journaling                     │
│                                     │
│  [+ Add Habit]                      │
└─────────────────────────────────────┘
```

**Day logic:**
| Slider position | Query date |
|---|---|
| Yesterday | `today - 1 day` |
| Today | `today` (device local date) |
| Tomorrow | `today + 1 day` |

**Midnight reset behavior:**
- No data is deleted. A new date = no completion rows for that date = all unchecked.
- When app is in foreground at midnight: `AppLifecycleState` listener triggers `WhetstoneProvider.refreshDate()`
- When app is opened after midnight: `TimeOfDayProvider` recalculates → provider sees new date → UI shows blank slate.

**Add Habit:** Bottom sheet with text input. Adds to `whetstone_items`.

---

### 8. ARCHIVE RECOVERY SCREEN (`/archive`)
**Type:** Full screen list

```
┌─────────────────────────────────────┐
│  ← Back       ARCHIVE               │
├─────────────────────────────────────┤
│  🏔️ Old Mountain 1  [Restore]        │
│  🏔️ Old Mountain 2  [Restore]        │
│  (empty state: "No archived mountains") │
└─────────────────────────────────────┘
```

Restore: sets `is_archived = false` on the mountain.

---

## GO_ROUTER CONFIGURATION (SKETCH)

```dart
final router = GoRouter(
  redirect: (context, state) {
    final isLoggedIn = ref.read(authProvider) != null;
    final isOnLogin = state.matchedLocation == '/login';
    if (!isLoggedIn && !isOnLogin) return '/login';
    if (isLoggedIn && isOnLogin) return '/sanctuary';
    return null;
  },
  routes: [
    GoRoute(path: '/',          builder: (_, __) => const EntranceScreen()),
    GoRoute(path: '/login',     builder: (_, __) => const LoginScreen()),
    GoRoute(path: '/sanctuary', builder: (_, __) => const SanctuaryScreen()),
    GoRoute(path: '/scroll',    builder: (_, __) => const ScrollMapScreen()),
    GoRoute(path: '/satchel',   builder: (_, __) => const SatchelScreen()),
    GoRoute(path: '/whetstone', builder: (_, __) => const WhetstoneScreen()),
    GoRoute(path: '/archive',   builder: (_, __) => const ArchiveScreen()),
    GoRoute(path: '/settings',  builder: (_, __) => const SettingsScreen()),
  ],
);
```

---

## STATE FLOWS BETWEEN SCREENS

```
SanctuaryScreen
  │
  ├── reads: TimeOfDayProvider (background, Elias pose)
  ├── reads: AuthProvider (user greeting)
  │
  ├── [Elias tap] ──────────────────────► ManagementMenuSheet
  │                                           │
  │                                    "Pack Satchel"
  │                                           │
  │                                    SatchelProvider.pack()
  │
  ├── [Hearth drop] ──────────────────► SatchelProvider.burn(slotIndex)
  │                                     NodeRepository.markComplete(nodeId)
  │                                     slot → null (NO auto-refill)
  │
  ├── [Whetstone tap] ────────────────► /whetstone
  │                                     WhetstoneProvider (selectedDate = Today)
  │
  ├── [Satchel tap] ──────────────────► /satchel
  │                                     SatchelProvider (reads current 6 slots)
  │
  └── [Scroll tap] ───────────────────► /scroll
                                        MountainListProvider (live stream)
```
