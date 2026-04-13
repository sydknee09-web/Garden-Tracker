#!/usr/bin/env python3
"""
Prepare App Open (parchment snap) sound from Luffy (freesound 17294).
First 1.5 s (snap + decay). EQ boost 200–400 Hz for wood/weight. No reverb (dry).

Usage:
  python scripts/prepare_app_open_sound.py [path_to_source.wav]
  Default: C:\\Users\\marsh\\Downloads\\17294__luffy__luffy_fire2.wav
"""
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUT_DIR = PROJECT_ROOT / "assets" / "sounds"
OUT_WAV = OUT_DIR / "app_open.wav"

SOURCE_DEFAULT = Path(r"C:\Users\marsh\Downloads\17294__luffy__luffy_fire2.wav")
DURATION_S = 1.5
# Boost 200–400 Hz (wood/weight of scroll rods). Approximate with a peaking EQ.
EQ_LOW_HZ = 300
EQ_BOOST_DB = 2.5
EQ_Q = 1.2


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
        print("Usage: python prepare_app_open_sound.py [path_to_source.wav]")
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

    samples = np.array(seg.get_array_of_samples(), dtype=np.float64) / 32768.0
    if seg.channels == 2:
        samples = samples.reshape(-1, 2).mean(axis=1)
    sr = seg.frame_rate

    # Boost 200–400 Hz (wood/weight): bandpass + blend
    if scipy_signal is not None and EQ_BOOST_DB != 0:
        nyq = sr / 2
        low = 200 / nyq
        high = 400 / nyq
        low, high = min(low, 0.99), min(high, 0.99)
        b, a = scipy_signal.butter(2, [low, high], btype="band")
        band = scipy_signal.filtfilt(b, a, samples)
        gain = 10 ** (EQ_BOOST_DB / 20) - 1
        samples = samples + band * gain

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
    print("Source: Luffy (freesound.org/people/Luffy/sounds/17294/) CC BY 3.0")


if __name__ == "__main__":
    main()
