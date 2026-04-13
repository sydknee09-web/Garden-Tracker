#!/usr/bin/env python3
"""
Prepare Weight (hearth layering) sound from hykenfreak (freesound 331621).
First 0.5 s — initial metallic impact. Pitch is varied in Flutter per stone.

Usage:
  python scripts/prepare_weight_sound.py [path_to_source.wav]
  Default: C:\\Users\\marsh\\Downloads\\331621__hykenfreak__flame-ignition.wav
"""
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUT_DIR = PROJECT_ROOT / "assets" / "sounds"
OUT_WAV = OUT_DIR / "weight.wav"

SOURCE_DEFAULT = Path(r"C:\Users\marsh\Downloads\331621__hykenfreak__flame-ignition.wav")
SKIP_S = 0.08   # Skip quiet lead-in (first bit is often silence)
DURATION_S = 1.2   # Length of clip (was 0.5s; longer for more body)
TARGET_DB = -3  # Normalize for layering (volume controlled in Flutter)


def main() -> None:
    import os
    raw = os.environ.get("SOURCE_WAV", "").strip() or (
        (sys.argv[1].strip() if len(sys.argv) > 1 else None)
    )
    if not raw:
        source_path = SOURCE_DEFAULT
    else:
        source_path = Path(raw)
        if not source_path.is_absolute():
            source_path = (PROJECT_ROOT / source_path).resolve()
        else:
            source_path = source_path.resolve()
    if not source_path.exists() or not source_path.is_file():
        print(f"Source not found or not a file: {source_path}")
        print("Usage: python prepare_weight_sound.py [path_to_source.wav]")
        sys.exit(1)

    try:
        from pydub import AudioSegment
    except ImportError as e:
        print("Need pydub: pip install pydub")
        raise SystemExit(1) from e

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    seg = AudioSegment.from_file(str(source_path))
    skip_ms = int(SKIP_S * 1000)
    end_ms = int(DURATION_S * 1000)
    seg = seg[skip_ms : skip_ms + end_ms]
    seg = seg.normalize(headroom=abs(TARGET_DB))
    seg.export(str(OUT_WAV), format="wav")
    print(f"Saved: {OUT_WAV}")
    print("Source: hykenfreak (freesound.org/people/hykenfreak/sounds/331621/) CC BY 3.0")


if __name__ == "__main__":
    main()
