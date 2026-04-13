#!/usr/bin/env python3
"""
Generate scroll_open sound for The Scroll unroll.

With pydub (+ ffmpeg): writes assets/sounds/scroll_open.mp3.
With pydub only: writes assets/sounds/scroll_open.wav (app falls back to .wav).
With no deps: writes scroll_open.wav using stdlib (wave + math).

Usage:
  python scripts/generate_scroll_audio.py
"""

import math
import struct
import wave
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUT_DIR = PROJECT_ROOT / "assets" / "sounds"
OUT_MP3 = OUT_DIR / "scroll_open.mp3"
OUT_WAV = OUT_DIR / "scroll_open.wav"

SAMPLE_RATE = 44100
DURATION_S = 0.35
FREQ = 220
FADE_SAMPLES = int(0.08 * SAMPLE_RATE)  # ~80 ms fade


def write_wav(path: Path) -> None:
    """Write a short soft sine tone (with fade in/out) as WAV. No deps."""
    n = int(SAMPLE_RATE * DURATION_S)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        val = 0.25 * math.sin(2 * math.pi * FREQ * t)
        # Fade in/out
        if i < FADE_SAMPLES:
            val *= i / FADE_SAMPLES
        elif i > n - FADE_SAMPLES:
            val *= (n - i) / FADE_SAMPLES
        out.append(max(-1, min(1, val)))
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SAMPLE_RATE)
        for v in out:
            w.writeframes(struct.pack("<h", int(v * 32767)))


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    try:
        from pydub import AudioSegment
        from pydub.generators import Sine
    except ImportError:
        write_wav(OUT_WAV)
        print(f"Saved (stdlib): {OUT_WAV}")
        print("Install pydub (and ffmpeg for MP3) for smaller MP3 output.")
        return

    duration_ms = int(DURATION_S * 1000)
    segment = Sine(FREQ).to_audio_segment(duration=duration_ms)
    segment = segment - 12
    segment = segment.fade_in(80).fade_out(120)

    try:
        segment.export(str(OUT_MP3), format="mp3", bitrate="128k")
        print(f"Saved: {OUT_MP3}")
        return
    except Exception as e:
        if "ffmpeg" in str(e).lower() or "converter" in str(e).lower():
            print("MP3 export needs ffmpeg. Writing WAV.")
        else:
            print(f"MP3 failed: {e}. Writing WAV.")

    segment.export(str(OUT_WAV), format="wav")
    print(f"Saved: {OUT_WAV}")
    print("To get MP3: install ffmpeg, then re-run this script.")


if __name__ == "__main__":
    main()
