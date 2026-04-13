# Release Candidate — On-Device Verification Script

**Purpose:** Final "bumpy-free" pass before treating the build as V1 release-ready. Run on a **physical device** with a real Supabase backend. Completing this script confirms the gatekeeper items (Shard trigger, Elias personalization, Sound toggle, Realtime cleanup) and core flows are solid.

**Prerequisites:**
- Supabase project with all migrations applied (including `20250320000000_shard_completion_trigger.sql`).
- Built app on device: `flutter run` or `flutter install` with your `SUPABASE_URL` and `SUPABASE_ANON_KEY` (no `SKIP_AUTH` for this pass).
- Optional: second account for RLS check (see [RLS_VERIFICATION.md](RLS_VERIFICATION.md)).

---

## Gatekeeper Verification

| Task | Status | How to verify |
|------|--------|----------------|
| **Shard trigger (Item 55)** | ☐ Pending deploy / ☐ Verified | See § 1 below. |
| **Elias intro (Item 51)** | ☐ | See § 2. |
| **Sound toggle (Item 52)** | ☐ | See § 3. |
| **Realtime cleanup** | ☐ | See § 4. |

---

## 1. Shard Completion Trigger (Item 55)

**Requirement:** When the last pebble in a shard (or boulder) is marked complete, the parent node must become completed/archived immediately.

**Steps:**
1. Open **Scroll** → pick a mountain that has at least one **boulder** with **multiple pebbles** (or one pebble).
2. Complete **all but one** pebble under that boulder (tap name → edit → check complete, or burn in Hearth).
3. Complete the **last** pebble (e.g. burn it in the Hearth, or mark complete on the Map).
4. **Expected:** Parent boulder (and any parent shard) shows as completed/archived in the UI and in Supabase (Dashboard → Table Editor → `nodes`: parent row `is_complete = true`, `is_archived = true`).
5. **If it fails:** Check Postgres logs for recursion/depth errors; confirm migration `20250320000000_shard_completion_trigger.sql` is applied.

---

## 2. Elias Personalization (Item 51)

**Requirement:** Elias uses the user’s name in Beats 3 & 5 of the intro and in the management sheet greeting. Default when name is skipped is "traveler".

**2a — Intro (new user or reset intro):**
1. Use a fresh account or one that hasn’t completed the Elias intro (or clear app data / use an account that sees the intro again).
2. Go through the intro until the **name prompt** ("What shall I call you?").
3. **Path A:** Enter a name (e.g. "Alex") → Continue. **Expected:** Beat 3 and Beat 5 include "Alex" (e.g. "The mountains are the journeys you climb, Alex...", "Tell me, Alex... what is calling to you today?").
4. **Path B:** Leave the field empty → Continue. **Expected:** Beats 3 & 5 use "traveler" (no "Wayfarer").
5. After intro, open **Elias / Management** (tap Elias or menu). **Expected:** Greeting is personalized (e.g. "What would you like to do, Alex?").

**2b — Management sheet (existing user with display_name):**
1. With an account that already has a display name set, open **Sanctuary** → tap Elias (or open management menu).
2. **Expected:** Bubble greeting uses your name (e.g. "How can I help you today, Alex?").
3. **Name-change edge case:** Intro already does Update → `ref.invalidate(profileProvider)` after `updateDisplayName`, so Beats 3 & 5 and management stay in sync. If you add "Change display name" in Settings, use the same pattern: after `profileRepository.updateDisplayName(newName)`, call `ref.invalidate(profileProvider)` so the management sheet updates immediately without restart.

---

## 3. Sound Toggle (Item 52 — Total Stillness)

**Requirement:** When Settings → Sound is **off**, no app sounds play. When **on**, entrance and interaction sounds play.

**Steps:**
1. Open **Settings** → ensure **Sound** is **on**. Close Settings.
2. **Entrance:** Force quit the app, reopen. **Expected:** Parchment/app-open sound plays when you land on Sanctuary (or profile gate).
3. Open **Settings** → turn **Sound off**. Close Settings.
4. Force quit, reopen. **Expected:** No app-open sound.
5. Open **Scroll** → tap ARCHITECT → drop mallet (e.g. on a mountain name). **Expected:** No mallet/rock-break sound.
6. Open **Management** → "Seek Guidance" → go through storybook; tap "Done" on last page. **Expected:** No weight clink.
7. Turn **Sound** back **on**. **Expected:** Next entrance, mallet, or storybook completion plays sound.

---

## 4. Realtime Cleanup (Logout)

**Requirement:** On sign out, Supabase Realtime channels are released; no background heartbeat or battery drain from stale subscriptions.

**Steps:**
1. Sign in and use the app (open Scroll, Satchel, so streams are active).
2. Open **Settings** → **Sign out** (confirm in dialog).
3. **Expected:** App navigates to Auth screen; no errors in UI.
4. **Debug console:** Watch for any Realtime/channel heartbeat or subscription errors after sign out. **Expected:** No active channel noise; subscriptions cancelled.
5. Sign back in. **Expected:** Scroll and Satchel load again; no stale data from the previous user.

---

## 5. First Five (Sanity)

Quick pass to confirm the pre-release gate is still met. See [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) § First Five for full detail.

| # | Check | Pass / Fail |
|---|--------|-------------|
| 1 | Auth → redirect to Intro or Sanctuary | ☐ |
| 2 | Scroll loads; Architect; add boulder/pebble | ☐ |
| 3 | Satchel 6 slots; Pack; Done → Ready to burn | ☐ |
| 3b | Fresh UID → Satchel 6 empty slots; Pack shows candidates or "No tasks waiting" | ☐ |
| 4 | Sanctuary: drag ready stone to Hearth; burn; Elias feedback | ☐ |
| 5 | RLS: two accounts; Account B cannot see Account A data | ☐ |

---

## 6. Climb Flow (No Ghosts)

**Requirement:** New Journey overlay starts fresh each time; no leftover state from a previous run.

**Steps:**
1. Open **Elias / Management** → **Plot a New Path** (or equivalent). Complete or partially complete a journey (e.g. set intent, add a landmark), then close the overlay (Stow the Map / back).
2. Open **Plot a New Path** again.
3. **Expected:** Step 1 shows empty intent and identity; no previous peak name or landmarks. No "ghosts" of the last run.

---

## 7. Sign-Off

| Item | Result |
|------|--------|
| Shard trigger (55) | ☐ Pass ☐ Fail ☐ Pending deploy |
| Elias intro & management (51) | ☐ Pass ☐ Fail |
| Sound toggle (52) | ☐ Pass ☐ Fail |
| Realtime cleanup | ☐ Pass ☐ Fail |
| First Five | ☐ Pass ☐ Fail |
| Climb flow (no ghosts) | ☐ Pass ☐ Fail |

**Device / build:** _______________________  
**Date:** _______________________  
**Notes:** _____________________________________________________

---

**After this script passes:** Proceed to [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) § Release path (performance, assets, store submission). The Master Plan is code- and doc-complete; this script is the final on-device gate before V1.
