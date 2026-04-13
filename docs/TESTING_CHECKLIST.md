# Testing checklist — what should be working

Use this when doing manual testing or regression checks. Assumes Supabase is configured and `ready_to_burn` + `ensure_profile` are applied (see README / schema.sql).

**When the app is ready for testing:** Always send a build to testers. From the `voyager_sanctuary` directory:

```powershell
.\deploy.ps1 -DemoMode -ReleaseNotes "v0.1.2+19 demo: no login, try features freely"
```

(Optional: `.\deploy.ps1 -Clean -DemoMode` to run `flutter clean` first.)

**Demo builds (`SKIP_AUTH=true` via `-DemoMode`):**

- App boots directly to **Sanctuary** (no auth screen).
- No account needed.
- Data is **in-memory**; resets on app restart (intentional for testing).
- Omit **`-DemoMode`** only when you want a **production-style** build (Supabase login required).

macOS/Linux: run `flutter build apk --release --dart-define=SKIP_AUTH=true` then `firebase appdistribution:distribute` with your app ID, or use PowerShell Core: `pwsh ./deploy.ps1 -DemoMode ...` if available.

Do not wait for the user to ask. See [.cursor/rules/firebase-deploy.mdc](../.cursor/rules/firebase-deploy.mdc) if present.

### Manual vs automated (what can't be "tested by AI")

- **Gatekeeper checklists (§8)** and **First Five** require a **human on a physical device**: sign-in, tap through Intro, create two accounts for RLS, complete pebbles for shard completion, etc. An AI or CI cannot do this end-to-end without a real session and device.
- **Smoke tests** = the **integration tests** in `integration_test/`. They *can* be run by you or CI, but they need a **connected device or emulator** (e.g. Android). From the project root:
  - **With a device/emulator:** `flutter test integration_test -d <deviceId>` (use `flutter devices` to get IDs). Sign in once on that device so tests use the persisted session.
  - **Without a device:** These tests will not run (they launch the app and drive the UI). Run them before release when you have a device attached.
- **Summary:** You run the gatekeepers and First Five manually; you run the smoke tests with `flutter test integration_test -d <deviceId>` when a device is available.

---

## How to run the gatekeeper checklists (for testers)

Before release, run the **four gatekeeper checklists** in **§ Release-readiness / gatekeeper checklist** below on a **physical device** with the latest tester build (e.g. from Firebase App Distribution). For each checklist: work through the steps in order, check the boxes as you go, then **document** the result where the checklist says (e.g. "Document in row 3b" → fill the Pass/Fail column in the **First Five** table for that row, with date and build version). Suggested order: **3b (Satchel verify)** → **5 (RLS)** → **(a) Display name** → **(b) Shard completion**.

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

## Draft peaks (local persistence, v0.1.2)

Drafts are stored in **SharedPreferences** (`climb_drafts_v1`); not synced to Supabase.

- [ ] Open **New Journey** from the Map, enter a **name**, close with **X** (or system back) → SnackBar mentions saving; open **Chronicled Peaks** → row shows **In progress**, muted card, step hint.
- [ ] **Tap** the draft → wizard opens at the saved step with **name / intent / choices** restored.
- [ ] Reach **Pack this Journey** and complete → draft row **disappears**; mountain is on the Map as usual.
- [ ] **Swipe left** on a draft → **Delete** removes it; **kill and relaunch** app → other drafts still listed.

---

## Release-readiness / gatekeeper checklist (§8)

Run these on a **physical device** with a release-candidate or tester build (e.g. Firebase v0.1.1+15). Source: [GEMINI_RECOMMENDATIONS_BUILD.md](GEMINI_RECOMMENDATIONS_BUILD.md) §8. Record results in the tables below or in the First Five success log.

### (a) Display name

Elias must use the user's display name in intro Beats 3 & 5, management greeting, and Sanctuary greeting; skip or empty must yield "traveler" (no crash, no blank).

- [ ] **Step 1:** New account or clear app data; go through Intro. At Beat 3 (name prompt), enter a name (e.g. "River") and continue. Confirm Beat 5 uses that name (e.g. "River, the path ahead…").
- [ ] **Step 2:** Same run or new: at Beat 3, tap **Continue** without typing (skip). Confirm Beat 5 uses "traveler" or equivalent generic wording, and no crash.
- [ ] **Step 3:** At Beat 3, enter only spaces and tap **Continue**. Confirm Beat 5 uses "traveler" or equivalent.
- [ ] **Step 4:** After intro, open **Elias → Management** (tap Elias, management sheet). Confirm greeting uses the name you set (e.g. "River") or "traveler" if skipped/empty.
- [ ] **Step 5:** From Sanctuary home, confirm period greeting (e.g. "Good morning, River" or "Good morning, traveler") uses profile display name or "traveler".
- [ ] **Step 6:** Go to **Settings** → change "What Elias calls you" to empty, save. Re-open Management and Sanctuary. Confirm "traveler" (or generic) is used.
- **Document:** Record result in First Five success log or add a "Display name" row below. Pass = all steps show correct personalization or "traveler" with no crash.

### (b) Shard completion

When the last leaf (shard) under a boulder is completed, the parent boulder's completion state must update so the UI reflects "all done" for that marker.

- [ ] **Step 1:** On the Scroll, pick a mountain and open **Mountain Detail**. Ensure you have a boulder with at least two pebbles (or pebble + shards).
- [ ] **Step 2:** Complete all but one pebble/shard under that boulder (tap to complete or use Satchel Done then burn). Confirm parent still shows incomplete (e.g. open circle or "in progress").
- [ ] **Step 3:** Complete the **last** pebble/shard under that boulder (e.g. last leaf under the boulder).
- [ ] **Step 4:** Confirm the **parent boulder** now shows complete (e.g. checkmark, filled state) without needing to leave and re-enter the screen or pull-to-refresh.
- [ ] **Step 5:** If the mountain uses Climb logic, confirm the **next** boulder (or next pebble) becomes available/unlocked as expected.
- **Document:** Record result in First Five success log or add a "Shard completion" row. Pass = last leaf complete → parent updates immediately (or after expected refresh).

### (c) RLS

Two accounts must not see each other's data. Use [RLS_VERIFICATION.md](RLS_VERIFICATION.md) as the authoritative procedure.

- [ ] **Step 1:** Follow RLS_VERIFICATION.md **Steps 1–3**: Create and use Account A (create mountain, boulder, pebble; pack Satchel; add Whetstone habit). Note what you see.
- [ ] **Step 2:** Sign out. Create or sign in as Account B. Confirm Scroll shows no mountains (or only B's). Satchel shows empty slots (or only B's). Whetstone shows no habits/completions from A.
- [ ] **Step 3:** (Optional) Run **Poison-record test** (RLS_VERIFICATION.md §4): insert a row in `mountains` with User B's UUID, sign in as User A, confirm User A does **not** see "Poison Peak (User B)". Clean up the poison row.
- **Document:** In **row 5** (RLS) in the First Five table above, fill **Pass** or **Fail** and date. Reference: "Per RLS_VERIFICATION.md; poison test [done/omitted]."

### (d) Satchel verify

Fresh UID must see 6 empty slots; Pack must show candidates or "No tasks waiting." Confirms placement logic and no blank/error for new users.

- [ ] **Step 1:** Use a **fresh account** (new sign-up) or a test account that has never opened Satchel. Do **not** use an account that already has mountains/pebbles unless you first clear satchel_slots in DB for that user.
- [ ] **Step 2:** Open the **Satchel** tab/screen immediately after reaching Sanctuary (or after intro).
- [ ] **Step 3:** Confirm **6 empty slots** are visible (no blank screen, no crash, no "loading" hang).
- [ ] **Step 4:** Tap **Pack**. If the account has no incomplete pebbles on any mountain, confirm message "No tasks waiting" (or equivalent). If there are packable candidates, confirm they fill empty slots in order (filled-first, stone icon per row).
- [ ] **Step 5:** Confirm Pack behavior: when slots are full, "Your satchel is full"; when there are candidates, they fill; when none, friendly empty state.
- **Document:** In **row 3b** (Fresh-UID Satchel setup) in the First Five table above, fill **Pass** or **Fail**, date, and device/build. Pass = 6 empty slots + correct Pack behavior.

---

## Onboarding / first-run verification

Run this on the **latest Firebase build** (e.g. testers group) after code changes to onboarding. Prerequisites: device is signed in or will sign up. (RLS migration **20250320000006** is already applied on this project.)

**Flow:** Intro beats → name prompt → name confirmation → New Journey wizard (Intent → Identity → Theme → Logic → Markers → Placing stones) → closing line → Whetstone setup (if shown) → Sanctuary.

| Check | Expected |
| **Sanctuary first entry (beta)** | No spotlight/tutorial overlay. Onboarding is Elias’s narration (Guide’s Whisper + intro) only; Satchel / Hearth / Map / Whetstone are explained there. First land quest bubbles still fire from `sanctuary_screen.dart` as before. |
|--------|----------|
| **Name step** | One button **Continue**; tap saves input and advances (keyboard dismisses if up). No "Done" then "Continue". |
| **Wizard from intro** | Center/left nav button is **Stow the Map** (exits wizard). Right button is **Continue** (advances). Never two "Continue" labels. |
| **Intent / Identity / Markers** | One button **Continue**; tap saves input and advances (keyboard dismisses if up). No "Done" then "Continue". |
| **Theme (mountain has a spirit)** | Select a color, tap **Continue**; page advances to Logic step. If "Couldn't save" appears (4s SnackBar), check auth/session. |
| **Underlines** | No visible white/bright underline on text fields when typing; border matches unfocused state. |
| **Stagger** | Input areas (name, Intent, etc.) fade in after ~1.2s (800ms on Appearance/Logic); no flash of empty then pop. |

**Reset first-run flags (development):** `has_seen_sanctuary_home_intro` is still written when completing the full Elias + Whetstone path (`markSanctuaryHomeIntroSeen`) but no longer drives a Sanctuary overlay. Clear other intro prefs if you need to replay the Guide’s Whisper from scratch.

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
| **Realtime cleanup on logout** | Sign out (Settings → Leave the Sanctuary) invalidates `mountainListProvider`, `archivedMountainListProvider`, and `nodeListProvider` in [settings_screen.dart](../lib/features/management/settings_screen.dart), which cancels Supabase Realtime stream subscriptions. No extra disposal needed. |

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
