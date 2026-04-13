# Voyager Sanctuary — Development conventions

**Purpose:** Single reference for how we add audio, assets, features, and code so the app stays uniform as we build. See [ARCHITECTURE.md](ARCHITECTURE.md) for data model and layers, [MASTER_PLAN.md](MASTER_PLAN.md) for phases and tasks.

---

## Audio

- **Paths:** All sounds live under `assets/sounds/`. Declare the folder in `pubspec.yaml` (already listed).
- **Formats:** Prefer both `.mp3` and `.wav`. In code, try `.mp3` first, then fall back to `.wav` so the app works with generator output when ffmpeg isn’t available.
- **Playback:** Use `audioplayers`. One `AudioPlayer` per sound (or a shared one with stop-before-play for one-shots). Fire-and-forget for UI feedback (e.g. mallet split); no need to await unless timing matters.
- **Adding a new sound:**  
  1. Add the file(s) under `assets/sounds/` (e.g. `my_sound.mp3` and/or `my_sound.wav`).  
  2. In code: `player.play(AssetSource('sounds/my_sound.mp3'))` with a `.catchError` or try/catch that plays `sounds/my_sound.wav`.  
  3. Optional: add a generator script in `scripts/` (e.g. `generate_my_sound_audio.py`) and document it in `assets/sounds/README.md`.

---

## Assets (images, etc.)

- **Paths:** Under `assets/<domain>/` (e.g. `assets/images/`, `assets/elias/`, `assets/backgrounds/`). Each domain is declared under `flutter.assets` in `pubspec.yaml`.
- **Missing assets:** Use `errorBuilder` on `Image.asset()` and try/catch on audio so the app degrades when a file isn’t present.
- **Generator scripts:** Image generation lives in `scripts/generate_assets.py` (driven by `art_direction.yaml`). Dedicated scripts (e.g. `generate_scroll_audio.py`) are fine for one-off or non-image assets. Document each in the relevant `assets/<domain>/README.md`.
- **Adding a new asset domain:** Create the folder, add its path to `pubspec.yaml`, and add a short README in that folder describing expected files and how to generate them (if applicable).

---

## Adding a new feature

- **Screen / UI:** `lib/features/<feature_name>/` (e.g. `scroll_map/`, `satchel/`). One main screen file plus feature-specific widgets in the same folder or under a subfolder.
- **State:** Provider in `lib/providers/` (e.g. `satchel_provider.dart`). Use Riverpod; follow existing patterns (StreamProvider for Supabase streams, StateNotifier for mutable app state).
- **Data:** Repository in `lib/data/repositories/` when the feature talks to Supabase. All inserts/updates/deletes must include `user_id` (see Code below).
- **Navigation:** Add the route in `lib/app.dart` (go_router). Update [NAVIGATION_MAP.md](NAVIGATION_MAP.md) with the new route and any assets used.
- **Master plan:** [MASTER_PLAN.md](MASTER_PLAN.md) is the single source of truth for all project tasks. All plans have been merged there.
- **Elias dialogue presentation:** See [ELIAS_PRESENTATION.md](ELIAS_PRESENTATION.md) for which visual mode to use (Cinematic, Modal, Character Bubble, Targeted Bubble).
- **Plan doc:** For non-trivial flows, add `docs/<FEATURE>_PLAN.md`; when complete, merge into MASTER_PLAN and move to `docs/Completed/`.
- **Completed plans:** Finished or superseded plans live in `docs/Completed/`. Keeps `docs/` focused on WIP.

### Plan document hierarchy

- **Canonical:** [MASTER_PLAN.md](MASTER_PLAN.md) is the single source of truth for project tasks, phases, and build-out status.
- **Vision & automation:** [VISION_AND_AUTOMATION.md](VISION_AND_AUTOMATION.md) is the alignment contract for AI-assisted build: North Star, who does what, when to ask the user. Any agent (Cursor, Gemini, etc.) should read it before implementing. See also repo-root [AGENTS.md](../AGENTS.md). Cursor and Gemini talk via [GEMINI_CURSOR_PROTOCOL.md](GEMINI_CURSOR_PROTOCOL.md) and `scripts/gemini_decision.py`; user only steps in for debug or vision (see HUMAN_INPUT_NEEDED.md).
- **Health audit:** [HEALTH_AUDIT_RUNBOOK.md](HEALTH_AUDIT_RUNBOOK.md) is the recurring health-check and audit checklist (code, docs, hygiene). Run on session start (quick pass), before release (full run), or when the user asks. See .cursor/rules/health-audit.mdc.
- **Derived views:** [BUILD_ALIGNMENT_PLAN.md](BUILD_ALIGNMENT_PLAN.md), [HEALTH_AND_IMPROVEMENTS.md](HEALTH_AND_IMPROVEMENTS.md), and [PROJECT_PLAN_REFINE_AND_POLISH.md](PROJECT_PLAN_REFINE_AND_POLISH.md) are derived from MASTER_PLAN. They provide implementation-focused views (alignment phases, health checklist, polish items) but must stay consistent with MASTER_PLAN. When in doubt, MASTER_PLAN wins; update derived docs when status or scope changes.

---

## Code

- **RLS / user_id:** Every Supabase insert, update, or delete must include `user_id` from the authenticated user (e.g. `SupabaseService.client.auth.currentUser!.id`). This is required for RLS. See [ARCHITECTURE.md](ARCHITECTURE.md) — Security model.
- **Folder structure:** Follow the layout in [ARCHITECTURE.md](ARCHITECTURE.md) — FOLDER STRUCTURE. Do not add new top-level folders under `lib/` without updating ARCHITECTURE.
- **Errors:** Use friendly user-facing messages and SnackBars (or equivalent) for recoverable errors. No raw exception text on screen. See [MASTER_PLAN.md](MASTER_PLAN.md) Part G — Error handling.
- **TODOs:** Do not leave TODO/FIXME comments in `lib/`. Resolve them or move the item to MASTER_PLAN Part G or BUGS_DEFERRED_TO_PHASE.
