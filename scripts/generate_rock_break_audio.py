#!/usr/bin/env python3
"""
Generate rock_break sound for mallet split (architect mode).

Plays when you hit a pebble/shard to break it apart. Writes assets/sounds/rock_break.wav
(stdlib). With pydub + ffmpeg can write rock_break.mp3.

Usage:
  python scripts/generate_rock_break_audio.py
"""

import math
import struct
import wave
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUT_DIR = PROJECT_ROOT / "assets" / "sounds"
OUT_MP3 = OUT_DIR / "rock_break.mp3"
OUT_WAV = OUT_DIR / "rock_break.wav"

SAMPLE_RATE = 44100
DURATION_S = 0.14
FREQ = 90
# Quick decay: amplitude * exp(-t * decay_rate)
DECAY_RATE = 35


def write_rock_break_wav(path: Path) -> None:
    """Short satisfying 'crack' / thunk: low damped sine. No deps."""
    n = int(SAMPLE_RATE * DURATION_S)
    out = []
    for i in range(n):
        t = i / SAMPLE_RATE
        val = 0.5 * math.exp(-t * DECAY_RATE) * math.sin(2 * math.pi * FREQ * t)
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
        write_rock_break_wav(OUT_WAV)
        print(f"Saved (stdlib): {OUT_WAV}")
        return

    # Damped tone: short sine with fade out
    duration_ms = int(DURATION_S * 1000)
    segment = Sine(FREQ).to_audio_segment(duration=duration_ms)
    segment = segment - 6
    segment = segment.fade_out(duration_ms)
    try:
        segment.export(str(OUT_MP3), format="mp3", bitrate="128k")
        print(f"Saved: {OUT_MP3}")
        return
    except Exception:
        pass

    write_rock_break_wav(OUT_WAV)
    print(f"Saved: {OUT_WAV}")


if __name__ == "__main__":
    main()
