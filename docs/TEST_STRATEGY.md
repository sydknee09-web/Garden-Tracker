# Test Strategy

Manual test checklists for critical flows. Run on physical device before release.

---

## First Blockage RPC (Climb + Nested Boulders)

**Purpose:** Verify packable candidates work when Climb peaks have sub-boulders.

### Setup

1. Create a Climb peak (e.g. "Organize House")
2. Add top-level boulders: Office, Kitchen
3. Under Office, add pebbles: Desk, Chair. Under Desk, add pebble: Organize Drawers
4. Under Kitchen, add sub-boulders: Clean Fridge, Organize Pantry. Add pebbles under each

### Test Steps

1. **Complete Office fully** — Burn all pebbles under Office (Desk, Chair, Organize Drawers, etc.)
2. **Open Satchel, tap Pack** — Confirm leaves under Kitchen (or its first incomplete sub-boulder) become packable
3. **Verify no "stuck" state** — User should always have a next packable task when incomplete work remains
4. **Survey unchanged** — Create a Survey peak with similar structure; confirm all branches remain packable (no sequential lock)

### Pass Criteria

- After completing Office, Kitchen's leaves (or Organize Pantry's leaves) appear in Pack
- No empty "No tasks waiting" when incomplete nested work exists

---

## Satchel Slots (New User)

1. Create fresh account (or use First User mode)
2. Open Satchel — confirm 6 empty slots appear
3. Tap Pack — verify message (either slots fill or "No tasks waiting")
4. Create a peak with pebbles, Pack again — verify slots fill correctly

---

## RLS Verification

See [RLS_VERIFICATION.md](RLS_VERIFICATION.md).
