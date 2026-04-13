# Request: Prioritized next chunk to finish building and polishing Voyager Sanctuary

## Context

Voyager Sanctuary is a Flutter + Supabase goal/ritual app (Japandi, Ghibli-esque). Phases 0–11 are largely done: Auth, Satchel, Hearth, Whetstone, Mallet, New Journey wizard (6 steps), Elias intro, Forest Threshold, Hammer/Refine modal, Whetstone choice overlay, Peak Journal spec. Build Outs 1–10 are resolved with specs.

## What’s left (from MASTER_PLAN and HEALTH_AND_IMPROVEMENTS)

**Gatekeepers (must do before heavy polish):**
- First Blockage RPC (Highest Incomplete Ancestor in `get_packable_candidates`) — VALIDITY_FILTER_RPC_SPEC.md
- RLS verification (two-account test; document in TESTING_CHECKLIST)
- Display name (Elias uses user’s name; profile/name capture)
- Shard completion (parent progress updates when shard is completed; no UI lag)

**High-value polish / UX:**
- Part E audit fixes: node stream `mountain_id` filter; climb flow provider keepAlive; Elias line cache staleness; Place Pebble row overflow; Return to Sanctuary wrapping; Step 5 fixed button labels; Step 4 spacing; step descriptions
- Part F: keyboard overlays input (scroll + padding); Save/Skip → Cancel and Save; duplicate New Journey buttons; terminology Lock→Stow, "Pack this Journey"; speech bubble only on tap
- Part C/D: burn celebration, mountain summit, streaks display, Elias context-aware, Step 5 keyboard retention, Whetstone overlay bubble tail

**Release path:** First Five tests, RLS confirm, satchel new-user verify, store assets, build appbundle/ipa, TestFlight/Play Internal.

## Ask

Give one prioritized **next chunk** of work (3–7 concrete actions) that Cursor should implement next to move the app toward “finished and polished.” Respect gatekeepers: prefer data/logic integrity (First Blockage, RLS, Display name, Shard completion) before purely visual polish. Each action should be specific enough for Cursor to execute (e.g. “Add mountain_id filter to node realtime in node_repository.dart” not “improve realtime”). Return needs_human only if you need user input (e.g. product decision or unclear repro).
