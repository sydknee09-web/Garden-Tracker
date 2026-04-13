# Grace Day Streak — Whetstone Ritual Specification

**Purpose:** The "heartbeat" of the Whetstone ritual. Firm enough to encourage discipline, forgiving enough to feel like a Sanctuary—not a rigid corporate tracker.  
**Status:** Locked — ready for implementation  
**Related:** [MASTER_PLAN.md](MASTER_PLAN.md) Build Out 5

---

## 1. Grace Variant — Option A (The Freeze)

| Rule | Behavior |
|------|----------|
| **One miss** | Streak **pauses**. No progress lost, none gained. Treats the missed day as a "rest day" on the mountain. |
| **Two consecutive misses** | Streak **resets to zero**. |

**Philosophy:** Life happens. A single miss shouldn't feel like punishment (-2). A double miss signals loss of momentum and requires a fresh start.

---

## 2. Schema — `user_streaks`

**Hybrid approach:** Dedicated table for fast UI. No scanning months of `whetstone_completions` on every app open.

| Column | Type | Description |
|--------|------|-------------|
| `user_id` | UUID | References `profiles(id)`. One row per user. |
| `current_streak` | INT | Consecutive days of completion. |
| `last_completion_date` | DATE | Last day user completed. Normalized to 4:00 AM logic. |
| `grace_used` | BOOLEAN | True if the current "day" is the first miss (freeze active). |

**Primary key:** `user_id` (one row per user).

---

## 3. Midnight-in-Session Logic (4:00 AM Boundary)

| Scenario | Behavior |
|----------|----------|
| **Active at 1:00 AM Tuesday** | Completion at 1:00 AM Tuesday counts as **Monday**. |
| **Day rollover** | "Day" officially rolls over at **4:00 AM**. |
| **Grace trigger** | Grace/Freeze check runs when the clock hits 4:00 AM and no completion was logged for the previous 24-hour block. |

**Elias lore:** *"The morning sun doesn't touch the valley until the fourth hour. Until then, the fire of yesterday still burns in the hearth."*

---

## 4. Date Normalization

**Helper:** `getSanctuaryDate(DateTime now)`

- Returns **today** if `now` is >= 4:00 AM (local).
- Returns **yesterday** if `now` is < 4:00 AM (local).

All streak logic uses this normalized date. Completions at 1:00 AM count for the "previous" calendar day.

---

## 5. Sweep Logic (Client-Side or Edge)

When the sweep runs (at app open after 4:00 AM, or via Edge Function):

**Completion check:** User "completed" the day if they have completions for all their Whetstone habits on that `completed_date`. (Compare `whetstone_completions` count vs `whetstone_items` count for the user.)

| Condition | Action |
|-----------|--------|
| `completed == true` | `current_streak++`, `grace_used = false`. |
| `completed == false` AND `grace_used == false` | `current_streak` unchanged, `grace_used = true` (The Freeze). |
| `completed == false` AND `grace_used == true` | `current_streak = 0`, `grace_used = false` (The Reset). |

**Edge case:** First-time user (no row in `user_streaks`): create row with `current_streak = 0`, `grace_used = false`. If they completed today, set `current_streak = 1`.

---

## 6. UI Feedback

| State | Visual |
|-------|--------|
| **Normal** | Standard streak display: "X-day streak" |
| **Grace active (freeze)** | "Frozen" icon—snowflake or blue-tinted stone. User knows they are on their last warning. |

---

## 7. Implementation Checklist for Cursor

- [ ] Migration: `user_streaks` table with RLS
- [ ] `getSanctuaryDate(DateTime now)` helper
- [ ] Sweep logic: run on app open if `now >= 4:00 AM` and last sweep was before today
- [ ] Completion check: all habits completed for the date
- [ ] Streak state: `current_streak`, `grace_used` in provider
- [ ] Whetstone UI: "X-day streak" display
- [ ] Whetstone UI: Frozen icon when `grace_used == true`
- [ ] Elias line: "The morning sun doesn't touch the valley until the fourth hour..."

---

**End of Grace Day Streak Spec.**
