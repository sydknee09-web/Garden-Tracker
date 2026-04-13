#!/usr/bin/env python3
"""
Prepare Rock Breaking sound from Uminari (freesound 389724).
Uses initial impact + crumble segment. Normalized ~15% quieter than
parchment (-4.5 dB peak). High-shelf to reduce >10 kHz (warm, thuddy).

Usage:
  python scripts/prepare_rock_break_sound.py [path_to_source.wav]
  Default: C:\\Users\\marsh\\Downloads\\389724__uminari__rolling-rocks-06.wav
"""
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUT_DIR = PROJECT_ROOT / "assets" / "sounds"
OUT_WAV = OUT_DIR / "rock_break.wav"

SOURCE_DEFAULT = Path(r"C:\Users\marsh\Downloads\389724__uminari__rolling-rocks-06.wav")
# Impact + crumble: first 1.2 s
END_S = 1.2
# ~15% quieter than parchment (-3 dB) → peak at -4.5 dB
TARGET_DB = -4.5
# High-shelf: reduce "clicking" above 10 kHz (warm, thuddy)
HIGHSHELF_HZ = 10000
HIGHSHELF_GAIN_DB = -6.0  # attenuate highs


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
        print("Usage: python prepare_rock_break_sound.py [path_to_source.wav]")
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
    end_ms = int(END_S * 1000)
    seg = seg[:end_ms]

    # Normalize so peak is at TARGET_DB (e.g. -4.5 dB)
    seg = seg.normalize(headroom=abs(TARGET_DB))

    samples = np.array(seg.get_array_of_samples(), dtype=np.float64) / 32768.0
    if seg.channels == 2:
        samples = samples.reshape(-1, 2).mean(axis=1)
    sr = seg.frame_rate

    # High-shelf: reduce frequencies above 10 kHz (warm, thuddy)
    if scipy_signal is not None and HIGHSHELF_GAIN_DB != 0:
        nyq = sr / 2
        if HIGHSHELF_HZ < nyq * 0.95:
            # Biquad high-shelf (simplified: lowpass at 10kHz then blend)
            # Alternative: attenuate highs with a lowpass at 10kHz
            b, a = scipy_signal.butter(2, HIGHSHELF_HZ / nyq, btype="low")
            low = scipy_signal.filtfilt(b, a, samples)
            # Blend: more low = warmer (shelf down)
            gain_linear = 10 ** (HIGHSHELF_GAIN_DB / 20)
            # high = samples - low; out = low + high * gain
            high = samples - low
            gain_linear = 10 ** (HIGHSHELF_GAIN_DB / 20)
            samples = low + high * gain_linear

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
    print("Source: Uminari (freesound.org/people/Uminari/sounds/389724/) CC BY 3.0")


if __name__ == "__main__":
    main()
