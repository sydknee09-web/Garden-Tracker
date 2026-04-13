#!/usr/bin/env python3
"""
Generate placeholder scroll_top.png and scroll_bottom.png when GEMINI_API_KEY is not set.
Creates simple wooden-roller-style images (dark brown horizontal bars) for the Scroll UI.
Run from project root: python scripts/generate_scroll_placeholders.py
"""
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
OUTPUT_DIR = PROJECT_ROOT / "assets" / "images"


def make_wooden_roller(width: int = 600, height: int = 80) -> bytes:
    """Create a simple wooden roller PNG (dark brown, subtle gradient)."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        raise SystemExit("Install Pillow: pip install Pillow")

    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Dark wood tones
    dark = (69, 52, 38, 255)   # #453426
    mid = (89, 68, 52, 255)   # #594434
    light = (109, 84, 64, 255)  # #6B5440

    # Draw horizontal cylinder (rounded rect)
    padding = 4
    draw.rounded_rectangle(
        [padding, padding, width - padding, height - padding],
        radius=height // 2 - 2,
        fill=mid,
        outline=dark,
        width=2,
    )

    # Subtle highlight line (top edge)
    draw.line(
        [(padding + 8, height // 2 - 4), (width - padding - 8, height // 2 - 4)],
        fill=light,
        width=2,
    )

    import io
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    for name in ("scroll_top", "scroll_bottom"):
        path = OUTPUT_DIR / f"{name}.png"
        data = make_wooden_roller()
        path.write_bytes(data)
        print(f"Created: {path}")


if __name__ == "__main__":
    main()
