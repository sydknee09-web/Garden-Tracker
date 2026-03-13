# Testing checklist — what should be working

Use this when doing manual testing or regression checks. Assumes Supabase is configured and `ready_to_burn` + `ensure_profile` are applied (see README / schema.sql).

---

## Scroll (goals / rocks)

| Action | Expected |
|--------|----------|
| Open app → Scroll tab | See up to 3 mountains; empty state or list. |
| Tap **ARCHITECT** | Label toggles to "ARCHITECT ✕", hammer FAB appears (not cut off by nav bar). |
| Tap **ARCHITECT** again | Hammer disappears; exit architect mode. |
| Drop hammer on mountain name | New boulder created; **dialog** "Name this milestone" with Skip/Save. |
| Drop hammer on boulder | New pebble; **dialog** "Name this task". |
| Drop hammer on pebble or shard | Split; **dialog** "Name the new task". |
| Tap a boulder/pebble/shard name | Inline edit; type, then tap away or tap **Save** in app bar → saves. |
| Tap another row while editing | First row saves, second row goes into edit mode. |
| Tap **Quill** (when not editing) | Snackbar: "Tap any goal or task to edit…". |
| Mountain options (⋯ or long-press) → Rename | Dialog; new name saves. |
| Mountain options → Archive | Mountain disappears from list soon after; snackbar about Archive Recovery. |
| Add mountain (if &lt; 3) | Dialog; new mountain appears. |
| Add mountain when 3 active | Message that you need to archive one first. |
| Bad network / Realtime off | Scroll shows friendly error + **Retry** (no raw exception). |

---

## Archive recovery

| Action | Expected |
|--------|----------|
| Open from Elias / menu | List of archived mountains. |
| **Restore** on one | Mountain moves back to Scroll; list updates. |
| Load error | Friendly message + **Retry**. |

---

## Satchel

| Action | Expected |
|--------|----------|
| **Pack** (with empty slots) | Empty slots 1, 2, 3… fill first with priority tasks; snackbar confirms. |
| **Pack** when full | "Your satchel is full." |
| **Pack** with no incomplete pebbles | "No tasks waiting on your mountains." |
| Tap **Done** on a filled slot | Slot shows "Ready to burn" + flame; can still edit others. |
| Slot already "Ready to burn" | No extra Done; flame icon shown. |

---

## Sanctuary (hearth + tray)

| Action | Expected |
|--------|----------|
| Stone **not** marked Done in Satchel | In tray: dimmed, lock icon; tap → snackbar "Open your Satchel…". |
| Stone **marked** Done in Satchel | In tray: draggable, ember border; drag to hearth to burn. |
| Drop ready stone on hearth | Pebble completes; slot clears; no wrong-slot fill on next Pack. |
| Empty slot in tray | Tap opens Satchel (or add flow as implemented). |

---

## Whetstone (habits)

| Action | Expected |
|--------|----------|
| Add / toggle habit | Works as before. |
| Delete (trash icon) | Confirmation dialog; then soft delete and snackbar. |

---

## Config / backend

| Check | Expected |
|--------|----------|
| New user / first mountain | No crash if `ensure_profile` is missing (graceful skip). |
| DB has `ready_to_burn` | Satchel check-off and hearth drag work. |
| Build with URL/key | `flutter run --dart-define=SUPABASE_URL=… --dart-define=SUPABASE_ANON_KEY=…` so Realtime/auth point at your project. |

---

## E2E testing — integration_test

**Current:** `integration_test` (Flutter SDK) is set up. Tests live in `integration_test/`.

**Implemented:**

- **Whetstone add** — Open app (session must be signed in), go to Whetstone, tap +, add habit "E2E habit add test", assert it appears in the list.
- **Whetstone check-off** — Drag the test habit row to reveal the "Done" action, tap it, assert the row stays (completion state).

Tests skip gracefully if the app shows the auth screen (no test credentials; run on a device/emulator where you’re already signed in).

**Test account (e2e / manual)**

- Credentials for e2e or manual testing are in `e2e_test.env` (gitignored). Copy `e2e_test.env.example` to `e2e_test.env` and fill in, or use the project test account.
- Use this account when you need a signed-in session for integration tests or when walking through the checklist.

**How to run e2e**

- From project root:
  - All integration tests: `flutter test integration_test`
  - One file: `flutter test integration_test/whetstone_flow_test.dart`
- Run on a device/emulator: sign in once (e.g. with the e2e test account), then run the same command with a device attached; tests use the persisted session.
- After big changes (nav, Whetstone UI, auth), run these to confirm add + check-off still work.

**Worth adding later:**

- Auth + Scroll load; Architect flow (boulder naming); Satchel → Hearth burn.
- Patrol or Maestro for broader coverage if needed.
