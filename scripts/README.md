# Voyager Sanctuary — Scripts

## Android deploy (Firebase App Distribution)

One-click build and push to testers:

**PowerShell (Windows):**
```powershell
# From repo root (voyager_sanctuary)
.\scripts\deploy_android.ps1
.\scripts\deploy_android.ps1 "Display name in Settings; First Blockage verified."
```

**Bash (macOS/Linux):**
```bash
./scripts/deploy_android.sh
./scripts/deploy_android.sh "Fixed Whetstone ritual error and onboarding focus."
```

**First-time setup:** `firebase login`. See [.cursor/rules/firebase-deploy.mdc](../.cursor/rules/firebase-deploy.mdc) for when to send a build to testers.

---

## Gemini–Cursor decision bridge

**`gemini_decision.py`** — Lets Cursor get Gemini’s decisions without the user as middleman. Cursor writes context to `docs/gemini_request.md`, runs the script; Gemini returns structured JSON to `docs/gemini_response.json`. When Gemini sets `needs_human` to `"debug"` or `"vision"`, the script appends to `docs/HUMAN_INPUT_NEEDED.md` and the user steps in. Same `GEMINI_API_KEY` as below. See [docs/GEMINI_CURSOR_PROTOCOL.md](../docs/GEMINI_CURSOR_PROTOCOL.md).

```bash
python scripts/gemini_decision.py --request-file docs/gemini_request.md
```

---

## Asset & Dialogue generation

Scripts and config for generating character/assets and Elias dialogue with **locked POV and style** via the Gemini API.

## Setup

1. **Python 3.10+** and a virtualenv (recommended):

   ```bash
   cd voyager_sanctuary
   python -m venv .venv
   .venv\Scripts\activate   # Windows
   # source .venv/bin/activate   # macOS/Linux
   pip install -r scripts/requirements.txt
   ```

2. **API key** (do not commit):

   - Get a key from [Google AI Studio](https://aistudio.google.com/apikey).
   - Set it in your environment:
     - Windows (PowerShell): `$env:GEMINI_API_KEY = "your-key"`
     - macOS/Linux: `export GEMINI_API_KEY=your-key`
   - Or use a `.env` file in the project root and load it before running (e.g. `python-dotenv`); ensure `.env` is in `.gitignore`.

## Art direction (style lock)

All prompts are built from **`scripts/art_direction.yaml`** so every image shares the same:

- **Global style** — e.g. “Digital illustration, hand-painted feel, muted earth tones…”
- **Subject description** — one canonical description per character (e.g. Elias: beard, helmet, chainmail, apron…).
- **POV and rules** — “He holds the space”, do’s and don’ts.
- **Per-pose prompt** — only the specific pose/moment (e.g. “Standing, looking at horizon, cup in hand”).

To add new subjects or poses, edit `art_direction.yaml`; the script will use it automatically.

## Commands

From the **project root** (`voyager_sanctuary/`):

```bash
# List subjects and poses
python scripts/generate_assets.py list

# Generate one image (dry run: no API call, just print prompt and path)
python scripts/generate_assets.py generate --subject elias --pose dawn --dry-run

# Generate one image (writes to assets/elias/elias_dawn.png)
python scripts/generate_assets.py generate --subject elias --pose dawn

# Generate all poses for a subject
python scripts/generate_assets.py generate --subject elias

# Use Gemini native image model instead of Imagen (if Imagen isn’t on your key)
python scripts/generate_assets.py generate --subject elias --pose midday --model gemini
```

Output directory for each subject is set in `art_direction.yaml` under `subjects.<name>.output_dir` (e.g. `assets/elias`).

## Models

- **`imagen`** (default) — Imagen 4 (`imagen-4.0-generate-001`). Best for high-fidelity character art. Requires Imagen access on your API key.
- **`gemini`** — Gemini native image generation. Use if Imagen returns an error (e.g. not enabled for your key).

## Adding new subjects or poses

1. Open `scripts/art_direction.yaml`.
2. Under `subjects`, add a new key (e.g. `prop_hearth`) or new poses under an existing subject.
3. For each pose, set `prompt` (the moment/pose only) and `filename`.
4. Run `generate --subject <key>` or `--pose <pose>` as above.

This keeps POV and design style consistent across all future images.

---

## Elias Dialogue Generation

Generate Elias dialogue that matches his voice and tone. Uses `elias_voice_guide.yaml` for style lock.

### Setup

Same as asset generation (Python venv, `pip install -r scripts/requirements.txt`, `GEMINI_API_KEY`).

### Commands

```bash
# List all dialogue contexts (intro beats, onTap, afterBurn, etc.)
python scripts/generate_elias_dialogue.py list

# Generate intro variants (e.g. Beat 1 — first greeting)
python scripts/generate_elias_dialogue.py generate --context intro_beat_1

# Generate for a specific context
python scripts/generate_elias_dialogue.py generate --context on_tap --count 5

# Custom scenario (describe your own)
python scripts/generate_elias_dialogue.py generate --context custom --prompt "Elias greets user at night after 3 days away"

# Dry run (see prompts only, no API call)
python scripts/generate_elias_dialogue.py generate --context intro_beat_1 --dry-run

# Save to file
python scripts/generate_elias_dialogue.py generate --context intro_beat_5 --output docs/elias_intro5_suggestions.md
```

### Output

Output is a list of dialogue lines in quotes. Copy into `lib/core/content/elias_dialogue.dart` or review in `docs/ELIAS_DIALOGUE_REFERENCE.md`.

### Voice Guide

See [docs/ELIAS_VOICE_GUIDE.md](../docs/ELIAS_VOICE_GUIDE.md) for the full voice bible, tone rules, and a copy-paste prompt for Cursor/AI when writing dialogue manually.
