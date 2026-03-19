# Testing checklist — what should be working

Use this when doing manual testing or regression checks. Assumes Supabase is configured and `ready_to_burn` + `ensure_profile` are applied (see README / schema.sql).

**When the app is ready for testing:** Always send a build to testers. Windows: `.\scripts\deploy_android.ps1` from voyager_sanctuary. macOS/Linux: `./scripts/deploy_android.sh`. Do not wait for the user to ask. See [.cursor/rules/firebase-deploy.mdc](../.cursor/rules/firebase-deploy.mdc).

---

## First Five (pre-release gate)

**Before deploy:** Run these five and fill the Pass/Fail column below. See [TEST_STRATEGY.md](TEST_STRATEGY.md) for detailed steps.

| # | Test | Pass / Fail |
|---|------|-------------|
| 1 | **Auth** — Sign in / sign up; post-auth redirect to Intro or Sanctuary | |
| 2 | **Scroll** — Map loads; tap mountain → Detail; Architect mode, add boulder/pebble | |
| 3 | **Satchel** — 6 slots; Pack fills from peaks; stone icon per row (muted until Done, then active); Done → Ready to burn; Remove animates out | |
| 3b | **Fresh-UID Satchel setup** — New account → open Satchel → 6 empty slots; Pack shows candidates or "No tasks waiting". Confirms placement logic. Document result here or in [TEST_STRATEGY.md](TEST_STRATEGY.md). | |
| 4 | **Sanctuary** — Tray shows stones always (neutral until Done); drag locked stone → Elias "mark done in Satchel"; drag ready stone to Hearth → burn; streak / Elias feedback | |
| 5 | **RLS** — Two accounts per [RLS_VERIFICATION.md](RLS_VERIFICATION.md); Account A cannot see Account B data. **Document result in this table.** | |

**Satchel slots (new user):** Fresh UID → open Satchel → 6 empty slots → Pack fills or shows "No tasks waiting". See [TEST_STRATEGY.md](TEST_STRATEGY.md) § Satchel Slots.

### First Five — Success Log (physical device)

Run these on a **physical device** (e.g. SM S918U) before implementing Semantics (21) or Loading (33). Record pass/fail and date below.

| Test | Focus | Success criteria | Date / Device | Pass / Fail | Notes |
|------|--------|------------------|---------------|-------------|--------|
| **3b: Fresh-UID** | Satchel setup | New account → open Satchel immediately → **6 empty slots** (no blank screen or error). | | | |
| **5: RLS** | Data privacy | Second user cannot see primary account data (e.g. navigate to primary’s Peak ID → fail or empty). | | | |
| **1: First Blockage** | Tree logic | Nested tree (Boulder → Sub-Boulder → Pebble). Complete first sub-pebble → *next* in that branch unlocks; other Boulders stay blocked. | | | |

**Suggested order:** 3b (fastest, confirms placement) → 5 (RLS) → 1 (needs nested tree setup).

---

## Onboarding / first-run verification

Run this on the **latest Firebase build** (e.g. testers group) after code changes to onboarding. Prerequisites: device is signed in or will sign up. (RLS migration **20250320000006** is already applied on this project.)

**Flow:** Intro beats → name prompt → name confirmation → New Journey wizard (Intent → Identity → Theme → Logic → Markers → Placing stones) → closing line → Whetstone setup (if shown) → Sanctuary.

| Check | Expected |
| **Sanctuary home intro (first run)** | First time on Sanctuary after intro + first mountain: overlay appears (Satchel → Path Ahead → Firepit). Each step shows Elias line, spotlight cutout, pulsed gold ring; only **Continue** advances. After three Continues, overlay dismisses and does not show again. |
|--------|----------|
| **Name step** | One button **Continue**; tap saves input and advances (keyboard dismisses if up). No "Done" then "Continue". |
| **Wizard from intro** | Center/left nav button is **Stow the Map** (exits wizard). Right button is **Continue** (advances). Never two "Continue" labels. |
| **Intent / Identity / Markers** | One button **Continue**; tap saves input and advances (keyboard dismisses if up). No "Done" then "Continue". |
| **Theme (mountain has a spirit)** | Select a color, tap **Continue**; page advances to Logic step. If "Couldn't save" appears (4s SnackBar), check auth/session. |
| **Underlines** | No visible white/bright underline on text fields when typing; border matches unfocused state. |
| **Stagger** | Input areas (name, Intent, etc.) fade in after ~1.2s (800ms on Appearance/Logic); no flash of empty then pop. |

**Reset first-run flags (development):** To replay the Sanctuary home intro without clearing app data, use a debug/settings control that calls `prefs.remove('has_seen_sanctuary_home_intro')` and invalidates `hasSeenSanctuaryHomeIntroProvider` (or document the manual step for testers).

**Release gate:** Before marking onboarding "done", run this section on a physical device with the release-candidate build and record pass/fail + build version (e.g. in the table or in RELEASE_CANDIDATE_SCRIPT.md).

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
| Device testing (bypass auth) | `flutter run --dart-define=SKIP_AUTH=true` to skip login for quick device QA. Omit for production builds. |
| Manual install (avoid loading purgatory) | Build and install with SKIP_AUTH: `flutter build apk --debug --dart-define=SKIP_AUTH=true` then `flutter install -d DEVICE_ID --debug`. Skips SharedPreferences at startup; prevents "Loading Sanctuary..." hang on some devices. |

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

---

## Release path (Phase 14)

- **Release Candidate script** — Before treating a build as V1-ready, run the on-device verification in **[RELEASE_CANDIDATE_SCRIPT.md](RELEASE_CANDIDATE_SCRIPT.md)** (Shard trigger, Elias personalization, Sound toggle, Realtime cleanup, First Five, Climb no-ghosts).
- **Full checklist** — Run every section above on a physical device; document edge cases.
- **Performance** — Confirm 60fps on mid-range device.
- **Assets** — App icons, splash screen; store copy in [STORE_LISTING.md](STORE_LISTING.md); Data Safety / Privacy in [DATA_SAFETY_AND_PRIVACY.md](DATA_SAFETY_AND_PRIVACY.md); ToS and hosting in [LEGAL.md](LEGAL.md); screenshots and published Privacy Policy / ToS URLs.
- **Android first:** `flutter build appbundle` (release); submit to Google Play Internal Testing.
- **iOS parity:** `flutter build ipa`; submit to TestFlight after first stable Android build.
- **Credentials:** Use `--dart-define=SUPABASE_URL=...` and `SUPABASE_ANON_KEY=...` for release builds; never ship with SKIP_AUTH.
