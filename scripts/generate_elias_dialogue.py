#!/usr/bin/env python3
"""
Voyager Sanctuary — Elias dialogue generation with locked voice and style.

Uses elias_voice_guide.yaml to build consistent prompts and calls the Gemini API
to generate dialogue. Ensures every line matches Elias's tone, vocabulary, and lore.

Usage:
  python scripts/generate_elias_dialogue.py list
  python scripts/generate_elias_dialogue.py generate --context intro_beat_1
  python scripts/generate_elias_dialogue.py generate --context on_tap --count 5
  python scripts/generate_elias_dialogue.py generate --context custom --prompt "Elias greets user at night"
  python scripts/generate_elias_dialogue.py generate --context intro_beat_1 --dry-run

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


def load_config() -> dict:
    """Load elias_voice_guide.yaml."""
    try:
        import yaml
    except ImportError:
        sys.exit("Install PyYAML: pip install pyyaml")
    config_path = SCRIPT_DIR / "elias_voice_guide.yaml"
    if not config_path.exists():
        sys.exit(f"Missing config: {config_path}")
    with open(config_path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def build_system_prompt(config: dict) -> str:
    """Build the system/voice prompt from global config."""
    g = config.get("global", {})
    identity = (g.get("identity") or "").strip()
    tone = (g.get("tone") or "").strip()
    vocab = g.get("vocabulary", {})
    use_vocab = vocab.get("use", [])
    avoid_vocab = vocab.get("avoid", [])
    style = g.get("sentence_style", [])
    do = g.get("do", [])
    dont = g.get("dont", [])

    parts = [
        "You are Elias, the guide of Voyager Sanctuary—a contemplative goal app.",
        "",
        "IDENTITY:",
        identity,
        "",
        "TONE:",
        tone,
        "",
        "VOCABULARY — Use: " + ", ".join(use_vocab),
        "VOCABULARY — Avoid: " + ", ".join(avoid_vocab),
        "",
        "SENTENCE STYLE:",
        *style,
        "",
        "DO: " + "; ".join(do),
        "DON'T: " + "; ".join(dont),
        "",
        "Output ONLY the dialogue lines, one per line. No numbering, no explanations.",
        "Each line should be a complete sentence Elias would say. Keep under ~80 chars when possible.",
    ]
    return "\n".join(parts)


def build_context_prompt(config: dict, context_key: str, custom_prompt: str | None = None) -> str:
    """Build the user prompt for a specific context."""
    contexts = config.get("contexts", {})
    if context_key not in contexts:
        raise KeyError(f"Unknown context: {context_key}. Run 'list' to see available contexts.")

    ctx = contexts[context_key]
    purpose = (ctx.get("purpose") or "").strip()
    goal = (ctx.get("goal") or "").strip()
    existing = ctx.get("existing") or []
    constraints = ctx.get("constraints") or []
    count = ctx.get("count", 3)

    if custom_prompt and context_key == "custom":
        return (
            f"Generate {count} NEW Elias dialogue lines for this scenario:\n\n"
            f"{custom_prompt}\n\n"
            "Do NOT repeat any existing lines. Output one line per line, no numbering."
        )

    parts = [
        f"Context: {purpose}",
        f"Goal: {goal}",
        "",
        "Existing examples (match this voice, do NOT copy):",
    ]
    for ex in existing:
        parts.append(f'  "{ex}"')
    if constraints:
        parts.append("")
        parts.append("Constraints:")
        for c in constraints:
            parts.append(f"  - {c}")
    parts.append("")
    parts.append(f"Generate {count} NEW variants that fit this context. Output one line per line, no numbering.")

    return "\n".join(parts)


def list_contexts(config: dict) -> None:
    """Print contexts from config."""
    contexts = config.get("contexts", {})
    if not contexts:
        print("No contexts in elias_voice_guide.yaml")
        return
    print("\nElias Dialogue Contexts")
    print("=" * 50)
    for key, ctx in contexts.items():
        purpose = (ctx.get("purpose") or "")[:60]
        count = ctx.get("count", 3)
        print(f"  {key}:")
        print(f"    {purpose}...")
        print(f"    (generates {count} variants)")
    print("\nUsage: python scripts/generate_elias_dialogue.py generate --context <key>")
    print("       python scripts/generate_elias_dialogue.py generate --context custom --prompt \"...\"")


def generate_dialogue(
    config: dict,
    context_key: str,
    *,
    count_override: int | None = None,
    custom_prompt: str | None = None,
    dry_run: bool = False,
) -> list[str]:
    """Generate dialogue for a context and return list of lines."""
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key and not dry_run:
        sys.exit("Set GEMINI_API_KEY in your environment.")

    system_prompt = build_system_prompt(config)
    user_prompt = build_context_prompt(config, context_key, custom_prompt)

    if count_override is not None:
        ctx = config.get("contexts", {}).get(context_key, {})
        ctx = dict(ctx)
        ctx["count"] = count_override
        config = dict(config)
        config["contexts"] = dict(config.get("contexts", {}))
        config["contexts"][context_key] = ctx
        user_prompt = build_context_prompt(config, context_key, custom_prompt)

    if dry_run:
        print("DRY RUN")
        print("\n--- System Prompt ---")
        print(system_prompt[:800] + "..." if len(system_prompt) > 800 else system_prompt)
        print("\n--- User Prompt ---")
        print(user_prompt)
        return []

    try:
        from google import genai
    except ImportError:
        sys.exit("Install the Google GenAI SDK: pip install google-genai")

    client = genai.Client(api_key=api_key)

    # Combine system + user into one prompt (Gemini accepts string)
    full_prompt = f"{system_prompt}\n\n---\n\n{user_prompt}"

    print(f"Generating dialogue for context: {context_key}")
    print("Calling Gemini...")

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=full_prompt,
        config={"temperature": 0.8, "top_p": 0.95},
    )

    # Extract text (handles both response.text and legacy structure)
    text = getattr(response, "text", None) or ""
    if not text and response and getattr(response, "candidates", None):
        for part in getattr(response.candidates[0].content, "parts", []):
            if hasattr(part, "text") and part.text:
                text += part.text

    # Parse lines: remove numbering, empty lines, strip
    lines = []
    for raw in text.splitlines():
        line = raw.strip()
        # Remove leading "1. " or "1)" etc.
        if line and line[0].isdigit():
            for i, c in enumerate(line):
                if not (c.isdigit() or c in ".): "):
                    line = line[i:].strip()
                    break
        if line and line.startswith('"') and line.endswith('"'):
            line = line[1:-1]
        if line:
            lines.append(line)

    return lines


def main():
    parser = argparse.ArgumentParser(
        description="Generate Elias dialogue with locked voice and style."
    )
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("list", help="List dialogue contexts from elias_voice_guide.yaml")

    gen = sub.add_parser("generate", help="Generate dialogue for a context")
    gen.add_argument(
        "--context", "-c",
        required=True,
        help="Context key (e.g. intro_beat_1, on_tap). Use 'list' to see all.",
    )
    gen.add_argument(
        "--count", "-n",
        type=int,
        default=None,
        help="Override number of variants to generate.",
    )
    gen.add_argument(
        "--prompt", "-p",
        default=None,
        help="For context 'custom': describe the scenario for Elias dialogue.",
    )
    gen.add_argument(
        "--dry-run",
        action="store_true",
        help="Print prompts only, do not call API.",
    )
    gen.add_argument(
        "--output", "-o",
        default=None,
        help="Write output to file (e.g. elias_suggestions.md). Default: stdout.",
    )

    args = parser.parse_args()
    config = load_config()

    if args.command == "list":
        list_contexts(config)
        return

    if args.command == "generate":
        if args.context == "custom" and not args.prompt:
            sys.exit("For context 'custom', provide --prompt with the scenario description.")
        lines = generate_dialogue(
            config,
            args.context,
            count_override=args.count,
            custom_prompt=args.prompt,
            dry_run=args.dry_run,
        )
        if not lines:
            return
        output = "\n".join(f'- "{line}"' for line in lines)
        if args.output:
            out_path = Path(args.output)
            if not out_path.is_absolute():
                out_path = PROJECT_ROOT / out_path
            out_path.parent.mkdir(parents=True, exist_ok=True)
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(f"# Elias dialogue suggestions — {args.context}\n\n")
                f.write(output)
                f.write("\n")
            print(f"\nSaved to {out_path}")
        else:
            print("\n--- Generated dialogue ---\n")
            print(output)
            print("\nCopy into elias_dialogue.dart or ELIAS_DIALOGUE_REFERENCE.md as needed.")


if __name__ == "__main__":
    main()
