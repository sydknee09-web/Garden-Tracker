#!/usr/bin/env python3
"""
Voyager Sanctuary — Asset generation with locked POV and style.

Uses art_direction.yaml to build consistent prompts and calls the Gemini/Imagen API
to generate images. Ensures every image follows the same character description,
style, and do/don't rules.

Usage:
  python generate_assets.py list
  python generate_assets.py generate --subject elias --pose dawn
  python generate_assets.py generate --subject elias
  python generate_assets.py generate --subject elias --pose midday --model imagen

Requires: GEMINI_API_KEY in environment.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

# Project root = parent of scripts/
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent


def load_config():
    """Load art_direction.yaml."""
    try:
        import yaml
    except ImportError:
        sys.exit("Install PyYAML: pip install pyyaml")
    config_path = SCRIPT_DIR / "art_direction.yaml"
    if not config_path.exists():
        sys.exit(f"Missing config: {config_path}")
    with open(config_path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def build_prompt(config: dict, subject_key: str, pose_key: str) -> str:
    """Build full prompt from global style + subject + pose. Keeps POV and style locked."""
    global_cfg = config.get("global", {})
    subjects = config.get("subjects", {})
    if subject_key not in subjects:
        raise KeyError(f"Unknown subject: {subject_key}")
    subject = subjects[subject_key]
    poses = subject.get("poses", {})
    if pose_key not in poses:
        raise KeyError(f"Unknown pose for {subject_key}: {pose_key}")

    style = (global_cfg.get("style") or "").strip()
    quality = (global_cfg.get("quality_modifiers") or "").strip()
    background = (
        (subject.get("default_background") or global_cfg.get("default_background")) or ""
    ).strip()
    desc = (subject.get("description") or "").strip()
    pov = (subject.get("pov") or "").strip()
    do = subject.get("do") or []
    dont = subject.get("dont") or []
    pose_cfg = poses[pose_key]
    pose_prompt = (pose_cfg.get("prompt") or "").strip()

    do_str = " ".join(do) if isinstance(do, list) else do
    dont_str = " ".join(dont) if isinstance(dont, list) else dont

    parts = [
        style,
        f"Character: {desc}",
        f"POV and tone: {pov}",
        f"Pose and moment: {pose_prompt}",
        f"Always: {do_str}",
        f"Avoid: {dont_str}",
        background,
        quality,
    ]
    return " ".join(p for p in parts if p).replace("\n", " ")


def list_subjects(config: dict) -> None:
    """Print subjects and poses from config."""
    subjects = config.get("subjects", {})
    if not subjects:
        print("No subjects in art_direction.yaml")
        return
    for skey, subj in subjects.items():
        name = subj.get("name", skey)
        print(f"\n{skey} ({name})")
        print(f"  output_dir: {subj.get('output_dir', '—')}")
        poses = subj.get("poses", {})
        for pkey, p in poses.items():
            fn = p.get("filename", f"{pkey}.png")
            prompt = (p.get("prompt") or "")[:60]
            print(f"  - {pkey}: {fn}  |  {prompt}...")


def generate_one(
    config: dict,
    subject_key: str,
    pose_key: str,
    *,
    model: str = "imagen",
    out_dir_override: str | None = None,
    dry_run: bool = False,
) -> None:
    """Generate a single image for subject/pose and save to output_dir."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key and not dry_run:
        sys.exit("Set GEMINI_API_KEY in your environment.")

    prompt = build_prompt(config, subject_key, pose_key)
    subjects = config.get("subjects", {})
    subject = subjects[subject_key]
    poses = subject.get("poses", {})
    pose_cfg = poses[pose_key]
    filename = pose_cfg.get("filename", f"{pose_key}.png")
    rel_output_dir = out_dir_override or subject.get("output_dir", "assets/generated")
    output_dir = PROJECT_ROOT / rel_output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / filename

    global_cfg = config.get("global", {})
    aspect_ratio = (
        pose_cfg.get("aspect_ratio")
        or subject.get("aspect_ratio")
        or global_cfg.get("aspect_ratio", "3:4")
    )
    # Normalize for API (e.g. "3:4" string)
    if isinstance(aspect_ratio, str) and ":" in aspect_ratio:
        pass
    else:
        aspect_ratio = "3:4"

    if dry_run:
        print("DRY RUN")
        print("Prompt (first 500 chars):")
        print(prompt[:500])
        print(f"\nWould save to: {out_path}")
        return

    print(f"Generating: {subject_key} / {pose_key} -> {out_path}")
    print("Prompt length:", len(prompt), "chars")

    try:
        from google import genai
        from google.genai import types
        from google.genai.errors import ClientError
    except ImportError:
        sys.exit("Install the Google GenAI SDK: pip install google-genai")

    client = genai.Client(api_key=api_key)

    def handle_api_error(e: Exception) -> None:
        if isinstance(e, ClientError) and e.response and getattr(e.response, "status_code", None) == 429:
            msg = getattr(e, "message", str(e))
            print("\nQuota exceeded (429). Image generation on free tier may have no quota for this model.")
            print("  • Upgrade: https://ai.dev/projects")
            print("  • Usage: https://ai.google.dev/gemini-api/docs/rate-limits")
            if "retry" in msg.lower() or "retryDelay" in str(e).lower():
                print("  • Wait a minute and try again, or check your plan.")
            sys.exit(1)
        raise

    if model == "imagen":
        # Imagen 4 for high-fidelity character art
        try:
            response = client.models.generate_images(
                model="imagen-4.0-generate-001",
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=1,
                    aspect_ratio=aspect_ratio,
                    person_generation="allow_adult",
                ),
            )
        except Exception as e:
            # Some API keys may not have Imagen; suggest gemini fallback
            print(f"Imagen request failed: {e}")
            print("Try: --model gemini (uses Gemini native image generation)")
            raise
        if not response.generated_images:
            sys.exit("No image in response.")
        img = response.generated_images[0]
        if hasattr(img, "image") and hasattr(img.image, "save"):
            img.image.save(str(out_path))
        else:
            # Fallback: assume image has raw bytes or PIL-like API
            raw = getattr(img.image, "image_bytes", None) or getattr(img, "image_bytes", None)
            if raw:
                with open(out_path, "wb") as f:
                    f.write(raw if isinstance(raw, bytes) else raw.encode())
            else:
                sys.exit("Could not extract image bytes from response.")
    else:
        # Gemini native image generation (Nano Banana / gemini-3.1-flash-image-preview)
        response = client.models.generate_content(
            model="gemini-3.1-flash-image-preview",
            contents=[prompt],
        )
        found = False
        for part in getattr(response, "parts", []):
            if getattr(part, "inline_data", None) is not None:
                image = part.as_image()
                if image is not None:
                    image.save(str(out_path))
                    found = True
                    break
        if not found:
            sys.exit("No image part in Gemini response.")
    print("Saved:", out_path)


def main():
    parser = argparse.ArgumentParser(description="Generate assets with locked POV and style.")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list", help="List subjects and poses from art_direction.yaml")

    gen = sub.add_parser("generate", help="Generate image(s)")
    gen.add_argument("--subject", "-s", required=True, help="Subject key (e.g. elias)")
    gen.add_argument("--pose", "-p", default=None, help="Pose key (e.g. dawn). Omit to generate all poses.")
    gen.add_argument("--model", "-m", choices=["imagen", "gemini"], default="imagen", help="Model: imagen (default) or gemini")
    gen.add_argument("--output-dir", default=None, help="Override output directory")
    gen.add_argument("--dry-run", action="store_true", help="Print prompt and path only, do not call API")

    args = parser.parse_args()
    config = load_config()

    if args.command == "list":
        list_subjects(config)
        return

    if args.command == "generate":
        subject_key = args.subject
        if args.pose:
            generate_one(
                config,
                subject_key,
                args.pose,
                model=args.model,
                out_dir_override=args.output_dir,
                dry_run=args.dry_run,
            )
        else:
            poses = config.get("subjects", {}).get(subject_key, {}).get("poses", {})
            if not poses:
                sys.exit(f"No poses defined for subject: {subject_key}")
            for pose_key in poses:
                generate_one(
                    config,
                    subject_key,
                    pose_key,
                    model=args.model,
                    out_dir_override=args.output_dir,
                    dry_run=args.dry_run,
                )


if __name__ == "__main__":
    main()
