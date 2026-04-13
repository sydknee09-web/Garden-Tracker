#!/usr/bin/env python3
"""Remove black background from images and save as transparent PNG.

Use for Elias (and other) assets that are generated with a black background.
Default: process all PNGs in assets/elias/ in place.

Usage:
  python scripts/remove_black_bg.py                    # all PNGs in assets/elias/
  python scripts/remove_black_bg.py path/to/image.png
  python scripts/remove_black_bg.py path/to/folder/   # all PNGs in folder
  python scripts/remove_black_bg.py image.png 50      # threshold 50 (default 40)
"""
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Install Pillow: pip install Pillow")
    sys.exit(1)


def remove_black_background(
    input_path: str | Path,
    output_path: str | Path | None = None,
    threshold: int = 40,
) -> None:
    """Make black/near-black pixels transparent. Saves to output_path or overwrites input."""
    src = Path(input_path)
    dst = Path(output_path) if output_path else src

    img = Image.open(src).convert("RGBA")
    data = list(img.getdata())

    new_data = []
    for item in data:
        r, g, b, a = item
        if r <= threshold and g <= threshold and b <= threshold:
            new_data.append((r, g, b, 0))
        else:
            new_data.append(item)

    img.putdata(new_data)
    img.save(dst, "PNG")
    print(f"Saved: {dst}")


def main() -> None:
    repo_root = Path(__file__).resolve().parent.parent
    default_elias = repo_root / "assets" / "elias"

    if len(sys.argv) == 1:
        # No args: process all PNGs in assets/elias
        if not default_elias.is_dir():
            print(f"Directory not found: {default_elias}")
            print("Create assets/elias/ and add your Elias PNGs, then run again.")
            sys.exit(1)
        paths = list(default_elias.glob("*.png"))
        if not paths:
            print(f"No PNGs in {default_elias}")
            sys.exit(0)
        threshold = 40
        for p in paths:
            remove_black_background(p, threshold=threshold)
        return

    target = Path(sys.argv[1]).resolve()
    threshold = int(sys.argv[2]) if len(sys.argv) > 2 else 40

    if target.is_file():
        if target.suffix.lower() != ".png":
            print("Only PNG is supported.")
            sys.exit(1)
        remove_black_background(target, threshold=threshold)
    elif target.is_dir():
        for p in sorted(target.glob("*.png")):
            remove_black_background(p, threshold=threshold)
    else:
        print(f"Not found: {target}")
        sys.exit(1)


if __name__ == "__main__":
    main()
