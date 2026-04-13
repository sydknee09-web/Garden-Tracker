# Sounds

**Source paths:** Use a folder path with **no spaces** (e.g. `source_wavs` or `audio_sources`). Paths with spaces can break script or shell handling; if your sources were in a folder with a space, copy it and rename (e.g. `My Sounds` → `MySounds`).

- **app_open.mp3** / **app_open.wav** — plays when splash finishes and Sanctuary appears (parchment snap). Sourced from Luffy (freesound 17294); see Credits in Settings.
- **scroll_open.mp3** / **scroll_open.wav** — plays when The Scroll opens (unroll). Sourced from Benboncan (freesound 77319), processed for vellum tone; see Credits in Settings.
- **rock_break.mp3** / **rock_break.wav** — plays when you hit a pebble/shard with the mallet in architect mode (split). Sourced from Uminari (freesound 389724); see Credits in Settings.
- **stone_drop.mp3** / **stone_drop.wav** — wooden thud when a stone hits the hearth (dobroide 95550). Layered with weight.
- **weight.mp3** / **weight.wav** — metallic “weight” layer, mixed by stone count 1–5 (hykenfreak 331621); see Credits in Settings.

**App open (parchment snap):** From project root, with source WAV in place:
```bash
pip install pydub numpy scipy
python scripts/prepare_app_open_sound.py "C:\path\to\17294__luffy__luffy_fire2.wav"
```
Output: `app_open.wav` (first 1.5 s, 200–400 Hz boost, dry).

**Weight (hearth layer):** From project root:
```bash
python scripts/prepare_weight_sound.py "C:\path\to\331621__hykenfreak__flame-ignition.wav"
```
Output: `weight.wav` (first 0.5 s). Pitch/volume varied in app per stone (1–5).

**Stone drop (hearth thud):** From project root, with source WAV in place:
```bash
pip install pydub numpy scipy
python scripts/prepare_stone_drop_sound.py "C:\path\to\95550__dobroide__20100422lightmyfire.wav"
```
Output: `stone_drop.wav` (primary impact, 150 Hz shelf, punchy).

**Rock break (high-fidelity):** From project root, with source WAV in place:
```bash
pip install pydub numpy scipy
python scripts/prepare_rock_break_sound.py "C:\path\to\389724__uminari__rolling-rocks-06.wav"
```
Output: `rock_break.wav` (impact + crumble segment, -4.5 dB, high-shelf above 10 kHz).

**Scroll open (high-fidelity):** From project root, with source WAV in place:
```bash
pip install pydub numpy scipy
python scripts/prepare_scroll_open_sound.py "C:\path\to\77319__benboncan__unrolling-and-rolling-map.wav"
```
Output: `scroll_open.wav` (slice 17–19.5s, trim, fade, -3dB, low-pass 6kHz, light reverb).

**Fallback / other:** From project root:
```bash
python scripts/generate_scroll_audio.py    # simple tone scroll_open
python scripts/generate_rock_break_audio.py   # rock_break
```
The app tries .mp3 first, then .wav.

---

## Run instructions (prepare scripts from your source folder)

Use a **folder path with no spaces** for source WAVs (e.g. `C:\Users\marsh\OneDrive\Documents\Goals_App\voyager_sanctuary\source_wavs` or wherever you put the renamed folder). Replace `SOURCE_FOLDER` below with that path.

**1. Open a terminal and go to the project root (voyager_sanctuary):**
```powershell
cd "c:\Users\marsh\OneDrive\Documents\Goals_App\voyager_sanctuary"
```

**2. Activate the venv and install deps (once):**
```powershell
.\.venv\Scripts\Activate.ps1
pip install pydub numpy scipy
```

**3. Run each prepare script with the path to the matching source WAV:**

| Sound        | Script                      | Example (replace SOURCE_FOLDER with your no-space path) |
|-------------|-----------------------------|--------------------------------------------------------|
| app_open    | prepare_app_open_sound.py    | `python scripts/prepare_app_open_sound.py "SOURCE_FOLDER\17294__luffy__luffy_fire2.wav"` |
| weight      | prepare_weight_sound.py     | `python scripts/prepare_weight_sound.py "SOURCE_FOLDER\331621__hykenfreak__flame-ignition.wav"` |
| stone_drop  | prepare_stone_drop_sound.py | `python scripts/prepare_stone_drop_sound.py "SOURCE_FOLDER\95550__dobroide__20100422lightmyfire.wav"` |
| rock_break  | prepare_rock_break_sound.py | `python scripts/prepare_rock_break_sound.py "SOURCE_FOLDER\389724__uminari__rolling-rocks-06.wav"` |
| scroll_open | prepare_scroll_open_sound.py| `python scripts/prepare_scroll_open_sound.py "SOURCE_FOLDER\77319__benboncan__unrolling-and-rolling-map.wav"` |

**When source WAVs are in `assets/sounds/`** (same folder as outputs), from project root run **one command per line**. For ready-to-paste commands, see **COPY_PASTE_AUDIO_COMMANDS.txt** in this folder. (pasting all five at once can mangle the path and cause "Permission denied: '.'"):

```powershell
python scripts/prepare_app_open_sound.py "assets\sounds\17294__luffy__luffy_fire2.wav"
python scripts/prepare_weight_sound.py "assets\sounds\331621__hykenfreak__flame-ignition.wav"
python scripts/prepare_stone_drop_sound.py "assets\sounds\95550__dobroide__20100422lightmyfire.wav"
python scripts/prepare_rock_break_sound.py "assets\sounds\389724__uminari__rolling-rocks-06.wav"
python scripts/prepare_scroll_open_sound.py "assets\sounds\77319__benboncan__unrolling-and-rolling-map.wav"
```

Outputs overwrite/write to `assets/sounds/` (e.g. `app_open.wav`). Keep paths in quotes. If you see "Couldn't find ffmpeg" — ignore it; WAV in/out works without ffmpeg.
