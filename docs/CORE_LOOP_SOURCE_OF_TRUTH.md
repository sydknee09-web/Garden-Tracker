# Core loop, fire, Elias, map — source of truth (v0)

Single place to align product, Cursor sessions, and implementation. **Update this file when you change a rule**; do not rely only on chat history.

---

## 0. How to read this doc (discipline for Cursor and humans)

Every substantive section mixes **two layers**. Do not implement “vision” as if it were already shipped.

| Label | Meaning |
|--------|--------|
| **Vision** | What we want users to feel and what we will build toward. Copy, pacing, and UI specs live here until implemented. |
| **As-built** | What `main` does today—file/provider/RPC names when known. If it contradicts vision, **either** file a bug **or** revise vision—don’t silently merge them. |

If a bullet has no tag, treat it as **product intent** until code is cited.

---

## 1. Naming (non-negotiable)

- **Peak** → **Boulder** → **Pebble** is the hierarchy users see in copy and mental models.
- Do not flatten to generic “goals / tasks / subtasks” in user-facing text.

---

## 2. Daily loop (intent — protect this backbone)

**Vision — target experience:**

1. Open app → **Sanctuary** (home) + **Satchel** as the place for *today’s work* (up to **six** tray slots on home; full Satchel on **Pack** route).
2. User completes work in the Satchel → **mark done** → item becomes **ready for the hearth** (“rune / ready to burn” state — see §6).
3. User **brings stones to the fire** (drag from tray → hearth, and/or **Offer to fire** from Satchel — see §5) → **fire responds** + optional **Elias** line.
4. **Return tomorrow** — empty satchel, absence, and fire each have a **designed** response (see §14 `EDGE_STATES`).

**As-built — packing today:** “Pack Satchel” fills empty slots from **`fetchPackCandidates`** + `packSlots` (`satchel_provider.dart` / `SatchelRepository`). Layout and sequential rules come from the RPC—not user manual pick.

**Vision — framing (decided):** Long term the six are **Elias-framed (C)**—he is the voice of “what matters today.” **Until** true C logic exists, keep **auto-pack (B)** but **never** tell users it’s a raw algorithm. Use Elias-facing copy, e.g. *“I’ve set out what needs doing today.”* Same engine as B; **perceived** as C.

---

## 3. Fire — meaning

### 3.1 Vision (stakeholder)

- Prefer **two signals**, **visually separated** when art supports it:
  - **Recency / warmth** — “Have you shown up lately?”
  - **Cumulative / height** — “How far have you journeyed?”
- Example story: a **large but cold** flame vs a **small but warm** flame—**only** after both channels exist in UI.

### 3.2 As-built today (`lib/providers/hearth_fuel_provider.dart`)

- **Effective fuel** = **recent** events only:
  - Pebble **burns** in the last **4 hours** (each counts).
  - **Whetstone completions** in the last **2 hours** (weighted **0.5** in the same formula).
- **Fire level** display = `min(effectiveFuel, 3)`.
- **Celebration:** `shouldCelebrate` / `hearthCelebrationProvider` when fuel crosses session rules.
- **Not implemented:** separate cumulative “height” channel; that remains **vision** in §3.1.

---

## 4. Satchel — six slots (**decisions**)

### 4.1 How the six fill (**decided**)

| Horizon | Mechanism | User-facing rule |
|--------|------------|------------------|
| **Now (ship)** | **B** — Auto-pack via `fetchPackCandidates` + empty slots. | **Never** say “algorithm” or “system picked.” **Elias-framed copy** (e.g. *“I’ve set out what needs doing today.”*) so B **feels** like **C**. |
| **Later** | **C** — True Elias curation (rules, priorities, or narrative constraints) may replace or wrap the same pipeline. | Update RPC/copy together when that ships. |

### 4.2 After **3+ days** away (**decided** — vision; not fully as-built)

**Vision:**

- **Replace** tray contents on the next appropriate open/pack—**do not** silently pretend nothing happened.
- **Elias names the gap** (fire already reads cooler from recency fuel). Example tone: *“The hearth has cooled. Let’s start small.”*
- **Ease back in:** auto-pack a **lighter** load—**~3 items** instead of **6** until the user is active again (exact thresholds TBD in implementation).
- **As-built today:** absence does **not** yet change pack count or dedicated “return” copy; treat this as a **feature** to implement against `EDGE_STATES` + `EliasDialogue`.

### 4.3 “All caught up” / no packable pebbles

See **§14** — must not be a blank screen.

### 4.4 Sanctuary home tray — empty vs filled slots (**decided**)

- **Up to six** fixed-width positions in the row (layout for the daily tray).
- **No pebble packed** in that slot: **visually empty** (no muted placeholder stone)—avoids looking like a fake task. **Same width** as occupied cells so the row stays aligned.
- **Asset pairs (two families, not one asset + filter):**
  - **Natural rock** — `LargeRock.png` / `MediumRock.png` / `SmallRock.png` for **boulder / pebble / shard** while packed **but not** `ready_to_burn`.
  - **Rune stone** — `stone_large.png` / `stone_medium.png` / `stone_small.png` for the same tiers when **`ready_to_burn`** (then draggable to the hearth).
- **Implementation:** `lib/core/utils/satchel_stone_assets.dart` → `satchelStoneImagePath(...)`.

---

## 5. Offer to fire (**decided**)

**Vision:**

- **Primary path:** a control on the **Satchel** screen (e.g. **Offer to the hearth**) that **carries the user to Sanctuary** and **starts** the hearth drop / celebration flow—**no** requirement to manually find the fire after completing tasks.
- **Optional later:** power users may still drag from the home tray; both can coexist.

**As-built today:** burn is driven from **Sanctuary** tray drag into hearth; there is **no** Satchel-wide “offer” button that auto-navigates + animates. Implement §5 as new UX.

---

## 6. Rune / ready-to-burn ceremony (vision — UI spec)

When a pebble is marked complete (then `ready_to_burn`):

1. **Feedback** — short pulse or glow (haptic optional).
2. **Visual shift** — stone → **warm amber / gold rune** (or agreed asset); ~300–600ms.
3. **Particles** — optional sparks; degrade gracefully on low-end.
4. **Placement** — must match **`ready_to_burn`** state used by hearth drag targets.

**Boulder vs Pebble in lists:** distinct shape/size/icon so users always know level (vision; Satchel row styling TBD).

---

## 7. Map hierarchy (vision)

- **Map** = **Peaks** + progress at a glance.
- **Drill:** Peak → **Boulders** (card) → **Pebbles** (checklist).
- **Satchel** = today’s execution; **Map** = plan/context—don’t duplicate the same three levels without clear roles.

---

## 8. Whetstone (vision — product stance)

- Start **simple:** daily check-ins, **low cap** (e.g. 5), single tap; **under ~20 seconds** on the happy path.
- Loosen only with data.

---

## 9. Elias — character brief (vision — do before dialogue sprawl)

One-pager minimum:

- **Voice** — tone, taboos.
- **Idle / Prompted / Triggered** — when he may speak, caps, silence rules.
- **~10 example lines** — regression anchor for new copy.

---

## 10. Onboarding (vision)

- Progressive disclosure; Day 1 smallest slice that gives a **win**.
- Reconcile with any intro that already mentions Whetstone—don’t double-teach.

---

## 11. Peak completion (vision)

- Define **binary vs maintenance** completion.
- MVP: hearth roar + Elias line + SFX; escalate deliberately later.

---

## 12. Build order (engineering)

1. Sanctuary + hearth + tray read state.
2. Satchel → ready → burn loop + §5 **Offer to fire**.
3. Map drill-down + satchel row context.
4. Whetstone.
5. Elias brief + triggers + §14 pools.
6. Onboarding vs §10.

---

## 13. Art direction (vision)

- Illustrated / parchment / watercolor first on new screens; clarity beats ornament when they conflict.

---

## 14. `EDGE_STATES` — failure & empty-state library

**Purpose:** Every “nothing to show” or **failure** moment gets **Elias copy** + **UI behavior** before Cursor invents a blank screen or a crash.

**Convention:** Each row: **State** · **Vision: UI** · **Vision: Elias (example or pool direction)** · **As-built (if known)** — update as shipped.

| ID | State | Vision: UI (never blank) | Vision: Elias (voice / pool) | As-built today |
|----|--------|---------------------------|------------------------------|----------------|
| **E1** | **Empty satchel** — no packable candidates, user “caught up” | Parchment card + **primary CTA** (Map / Plot path / Pack) + optional secondary (Whetstone). Illustration or Elias silhouette—not white void. | *“The path is clear for the moment. Shall we plan the next climb—or tend the blade?”* (pool; not literal-only) | **As-built:** `EliasDialogue.edgeEmptySatchelCaughtUp()` pool; `emptySatchel()` / `satchelEmptyEliasLine()` alias it. Pack returns *No tasks…* → sets `eliasMessageProvider` so Sanctuary bubble shows (`satchel_screen.dart`). |
| **E2** | **Fire reads “dead”** — fuel 0 for extended session | Hearth still visible; **soft** relight CTA or “stoke” path via one small action (e.g. open Satchel / one whetstone tap)—not punishing UI. | *“The hearth has cooled. Let’s start small.”* (aligns with §4.2 return) | **As-built:** `EliasDialogue.edgeFireCold()` → `coldHearth()` pool. Dedicated “dead fire” screen still **vision**. |
| **E3** | **No active Peaks** — zero mountains | Single focused CTA: **Plot a first path** (climb flow) + optional “Seek guidance.” No endless empty map without words. | *“Every summit begins with a single step from camp.”* (pool) | **As-built:** `EliasDialogue.edgeNoActivePeaks()` (`scroll_map_screen.dart` `_EmptyState`). Sanctuary zero-peak greeting remains separate first-run flow. |
| **E4** | **Long absence (3+ days)** — return session | Per §4.2: **replace** satchel with **lighter** pack; show **one** acknowledgment banner or bubble once per session—not spam. | Gap-named + gentle next step (see §4.2). | **Copy as-built:** `EliasDialogue.edgeLongAbsenceReturn()` pool. **Behavior** (3-day detect, lighter pack) — **not implemented** yet. |
| **E5** | **Whetstone streak broken** / long miss | Whetstone screen: non-judgmental card + **one** tap to restart today; optional streak stat. | *“Even iron rests. The stone remembers your hand—when you return.”* (pool) | Struggle prompt exists in places—align copy to this table. |
| **E6** | **Onboarding abandoned mid-flow** | Resume: **same step** with *“Welcome back”* strip; never restart from zero without consent. Offer **skip** only where product allows. | Short, dignified—no guilt. | Depends on `SharedPreferences` / flags—audit routes. |
| **E7** | **Satchel full** — cannot pack | Inline message + link to **complete or burn**; haptic optional. | *“Your satchel is full—finish what you’ve started, or feed the fire.”* (align with existing satchel-full pool) | **As-built:** `EliasDialogue.edgeSatchelFull()` → `satchelFull()`; wired from **Pack** in `management_menu_sheet.dart` (+ snack). |
| **E8** | **Auth / offline / data load failure** | Retry + **offline mode** if applicable; never infinite spinner without copy. | Minimal—system honesty over poetry, unless brand allows one warm line. | Connection + demo paths documented elsewhere—cross-link in implementation tickets. |
| **E9** | **RPC / pack error** | Toast or inline error + **retry**; no silent no-op. | Optional single Elias line on **retry** only—don’t blame the user. | Errors return strings today—ensure UI always surfaces them. |

**Maintenance:** When you hit a new “null UI” in development, **add a row** here before merging.

---

## 15. Revision log

| Date | Change |
|------|--------|
| 2026-04-14 | Initial v0. |
| 2026-04-14 | §0 vision vs as-built; §4–§5 stakeholder decisions; §14 `EDGE_STATES`; § renumber. |
| 2026-04-14 | EDGE E1/E3/E7 (+E2/E4 accessors) in `elias_dialogue.dart`; Pack “no tasks” → `eliasMessageProvider`; map empty → `edgeNoActivePeaks()`. |
| 2026-04-14 | §4.4: empty home-tray cells = visually empty (fixed width); rune-stone art = existing `stone_*.png`; muted vs ember by state. |
