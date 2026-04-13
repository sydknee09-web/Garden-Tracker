#!/usr/bin/env python3
"""
Prepare Stone Drop (hearth thud) sound from dobroide (freesound 95550).
Primary impact only — short and punchy. Low-shelf boost at 150 Hz for mass.
Volume set to cut through fire ambiance.

Usage:
  python scripts/prepare_stone_drop_sound.py [path_to_source.wav]
  Default: C:\\Users\\marsh\\Downloads\\95550__dobroide__20100422lightmyfire.wav
"""
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUT_DIR = PROJECT_ROOT / "assets" / "sounds"
OUT_WAV = OUT_DIR / "stone_drop.wav"

SOURCE_DEFAULT = Path(r"C:\Users\marsh\Downloads\95550__dobroide__20100422lightmyfire.wav")
# Primary impact: short and punchy
DURATION_S = 0.35
# Slightly louder so it cuts through fire loop (-2 dB peak)
TARGET_DB = -2
# Low-shelf boost at 150 Hz for "mass"
LOWSHELF_HZ = 150
LOWSHELF_GAIN_DB = 2.5


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
        print("Usage: python prepare_stone_drop_sound.py [path_to_source.wav]")
        sys.exit(1)

    try:
        from pydub import AudioSegment
        import numpy as np
    except ImportError as e:
        print("Need pydub and numpy: pip install pydub numpy")
        raise SystemExit(1) from e

    try:
        from scipy import signal as scipy_signal
    except ImportError:
        scipy_signal = None

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    seg = AudioSegment.from_file(str(source_path))
    end_ms = int(DURATION_S * 1000)
    seg = seg[:end_ms]
    seg = seg.normalize(headroom=abs(TARGET_DB))

    samples = np.array(seg.get_array_of_samples(), dtype=np.float64) / 32768.0
    if seg.channels == 2:
        samples = samples.reshape(-1, 2).mean(axis=1)
    sr = seg.frame_rate

    # Low-shelf boost at 150 Hz (mass / permanent structure feel)
    if scipy_signal is not None and LOWSHELF_GAIN_DB != 0:
        nyq = sr / 2
        fc = min(LOWSHELF_HZ / nyq, 0.99)
        # First-order low-shelf: boost below 150 Hz
        # Use a lowpass and blend to approximate shelf
        b, a = scipy_signal.butter(1, fc, btype="low")
        low = scipy_signal.filtfilt(b, a, samples)
        high = samples - low
        gain = 10 ** (LOWSHELF_GAIN_DB / 20)
        samples = low * gain + high
    samples = np.clip(samples, -1.0, 1.0)
    samples_int = (samples * 32767).astype(np.int16)
    raw = samples_int.tobytes()
    out_seg = AudioSegment(
        data=raw,
        sample_width=2,
        frame_rate=sr,
        channels=1,
    )
    out_seg.export(str(OUT_WAV), format="wav")
    print(f"Saved: {OUT_WAV}")
    print("Source: dobroide (freesound.org/people/dobroide/sounds/95550/) CC BY 3.0")


if __name__ == "__main__":
    main()
