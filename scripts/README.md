# Voyager Sanctuary — Asset generation

Scripts and config for generating character/assets with **locked POV and design style** via the Gemini API.

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
