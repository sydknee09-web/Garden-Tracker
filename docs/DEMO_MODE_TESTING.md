# Demo Mode Testing Protocol

**Purpose:** Verify that Demo Mode feels as responsive as the Supabase-connected app. Stone drop audio, fire ignition, and burn flow must match.

---

## Prerequisites

**Tester / Firebase build (recommended):** Install an APK built with demo auth bypass:

```powershell
flutter build apk --release --dart-define=SKIP_AUTH=true
```

Or deploy with demo baked in:

```powershell
.\deploy.ps1 -DemoMode -ReleaseNotes "your notes"
```

(`deploy.ps1` without **`-DemoMode`** builds a normal release — login required.)

**What you get:** No login; app opens on **Sanctuary**; `DemoStorage` + demo repositories; `SKIP_AUTH` uses in-memory seed (`seedInMemoryOnly`) — treat data as ephemeral across reinstalls / process death.

**Other paths (dev):** `SKIP_AUTH` defaults **on** in **debug** (`kDebugMode`). Persisted demo via SharedPreferences exists for non–`SKIP_AUTH` demo flows (e.g. settings).

### Connection failure during init (no “offline demo” button)

If the app shows **Connection unavailable** at startup, the UI only offers **Try again** (retry Supabase init). There is **no** “use offline demo” action on that screen.

**What to do:** Reconnect to the network, tap **Try again**, or **force-close and restart the app** after you’re online so bootstrap runs clean. Demo mode for testers is delivered via an APK built with **`SKIP_AUTH=true`** (`deploy.ps1 -DemoMode`), not via the connection-error screen.

---

## Burn Flow Test

1. **Create data** (or use pre-loaded demo data):
   - Open Scroll, create a mountain and at least one pebble.
   - Or use the 5 starter habits in Whetstone if testing habits.

2. **Pack Satchel:**
   - Open Satchel, tap **Pack**.
   - Confirm pebbles appear in slots.

3. **Mark ready to burn:**
   - Swipe right on a pebble (or tap the checkbox) to mark it **Ready to burn**.
   - Confirm the flame icon appears.

4. **Burn in Hearth:**
   - Return to Sanctuary.
   - Drag the ready stone from the tray to the Hearth (fire pit).

5. **Verify:**
   - `stone_drop.wav` / `stone_drop.mp3` plays.
   - `weight.wav` / `weight.mp3` plays (hearth weight layer).
   - Fire animates (hearth scale, ember burst if last pebble of mountain).
   - Elias speaks (first burn, streak, or summit line).
   - Haptic fires (light / medium double / heavy depending on context).

---

## Whetstone Test

1. Open Whetstone.
2. Toggle a habit completion for today.
3. Verify: check animation and any associated feedback match the Supabase-connected version.

---

## Compare

Repeat the same flows with Supabase connected (normal mode). Behavior should match. Demo Mode must not feel less responsive.
