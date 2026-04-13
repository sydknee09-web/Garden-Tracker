#!/usr/bin/env python3
"""
Prepare Scroll Opening sound from Benboncan (freesound 77319).
Extract 17s–19.5s, trim silence, fade out, normalize to -3dB,
apply low-pass 6kHz and light reverb (cozy vellum / outdoor clearing).

Usage:
  python scripts/prepare_scroll_open_sound.py [path_to_source.wav]
  Default source: (script will prompt or use env SOURCE_WAV)
"""
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUT_DIR = PROJECT_ROOT / "assets" / "sounds"
OUT_WAV = OUT_DIR / "scroll_open.wav"

SOURCE_DEFAULT = Path(r"C:\Users\marsh\Downloads\77319__benboncan__unrolling-and-rolling-map.wav")
START_S = 17.0
END_S = 19.5
FADE_OUT_MS = 50
NORMALIZE_DB = -3  # peak at -3dB
LOWPASS_HZ = 6000
REVERB_ROOM = 0.10  # 10% wet
REVERB_DAMPING = 0.80  # fast decay
SILENCE_THRESHOLD = 0.02  # trim leading samples below this (fraction of max)


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
        print("Usage: python prepare_scroll_open_sound.py [path_to_source.wav]")
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

    # Load and slice
    seg = AudioSegment.from_file(str(source_path))
    start_ms = int(START_S * 1000)
    end_ms = int(END_S * 1000)
    seg = seg[start_ms:end_ms]

    # Trim leading silence: find first frame where level exceeds threshold
    samples = np.array(seg.get_array_of_samples(), dtype=np.float64) / 32768.0
    if seg.channels == 2:
        samples = samples.reshape(-1, 2).mean(axis=1)
    peak = float(np.abs(samples).max()) or 1.0
    thresh = peak * SILENCE_THRESHOLD
    start_frame = 0
    frame_count = len(samples)
    for i in range(min(frame_count, int(seg.frame_rate * 2))):
        if np.abs(samples[i]) >= thresh:
            start_frame = i
            break
    if start_frame > 0:
        trim_ms = int(1000 * start_frame / seg.frame_rate)
        seg = seg[trim_ms:]

    # Fade out at end
    seg = seg.fade_out(FADE_OUT_MS)

    # Normalize to -3dB peak (pydub: headroom in dB)
    seg = seg.normalize(headroom=3.0)

    # Convert to mono float for processing
    samples = np.array(seg.get_array_of_samples(), dtype=np.float64) / 32768.0
    if seg.channels == 2:
        samples = samples.reshape(-1, 2).mean(axis=1)
    sr = seg.frame_rate

    # Low-pass 6kHz (4th order Butterworth)
    if scipy_signal is not None:
        nyq = sr / 2
        cutoff = min(LOWPASS_HZ, nyq * 0.95)
        b, a = scipy_signal.butter(4, cutoff / nyq, btype="low")
        samples = scipy_signal.filtfilt(b, a, samples)

    # Simple reverb: room 10%, damping 80% (short delays, quick decay)
    # Two short delays with decay
    delay1 = int(sr * 0.03)   # 30ms
    delay2 = int(sr * 0.08)   # 80ms
    decay = 1.0 - REVERB_DAMPING  # 0.2
    wet = np.zeros_like(samples)
    n = len(samples)
    wet[delay1:n] += samples[: n - delay1] * (REVERB_ROOM * 0.6 * decay)
    wet[delay2:n] += samples[: n - delay2] * (REVERB_ROOM * 0.4 * (decay ** 2))
    samples = samples * (1 - REVERB_ROOM) + wet

    # Clip and convert back to int16
    samples = np.clip(samples, -1.0, 1.0)
    samples_int = (samples * 32767).astype(np.int16)

    # Build new segment from raw
    raw = samples_int.tobytes()
    out_seg = AudioSegment(
        data=raw,
        sample_width=2,
        frame_rate=sr,
        channels=1,
    )

    out_seg.export(str(OUT_WAV), format="wav")
    print(f"Saved: {OUT_WAV}")
    print("Source: Benboncan (freesound.org/people/Benboncan/sounds/77319/) CC BY 4.0")


if __name__ == "__main__":
    main()
