#!/usr/bin/env python3
"""
Voyager Sanctuary — Gemini decision bridge for Cursor.

Cursor (or any agent) sends context to Gemini; Gemini returns a structured decision
aligned with docs/VISION_AND_AUTOMATION.md. The user is only in the loop when
Gemini sets needs_human to "debug" or "vision".

Usage:
  # Request from file (Cursor writes this, then runs script)
  python scripts/gemini_decision.py --request-file docs/gemini_request.md
  python scripts/gemini_decision.py --request-file docs/gemini_request.md --response-file docs/gemini_response.json

  # Request from stdin
  echo "What should we do next for Build Out 1?" | python scripts/gemini_decision.py

  # Inline context
  python scripts/gemini_decision.py --context "Review this approach: ..."

Requires: GEMINI_API_KEY in environment.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
DOCS = PROJECT_ROOT / "docs"


def _load_dotenv() -> None:
    """Load .env from project root if present (GEMINI_API_KEY). Do not commit .env."""
    env_file = PROJECT_ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            k, v = k.strip(), v.strip()
            if k and (v.startswith('"') and v.endswith('"') or v.startswith("'") and v.endswith("'")):
                v = v[1:-1]
            if k and not os.environ.get(k):
                os.environ[k] = v


def load_vision_doc() -> str:
    """Load VISION_AND_AUTOMATION.md for system context."""
    path = DOCS / "VISION_AND_AUTOMATION.md"
    if not path.exists():
        return "(Vision doc not found; proceed with MASTER_PLAN alignment.)"
    return path.read_text(encoding="utf-8").strip()


def load_master_plan_head() -> str:
    """Load first ~200 lines of MASTER_PLAN for scope/design context."""
    path = DOCS / "MASTER_PLAN.md"
    if not path.exists():
        return ""
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()[:220]
    return "\n".join(lines)


def build_system_prompt() -> str:
    vision = load_vision_doc()
    plan_head = load_master_plan_head()
    return f"""You are the decision-making AI for Voyager Sanctuary (Flutter + Supabase, Japandi/Ghibli-esque goal app). Cursor implements your decisions; the human only steps in when you set needs_human to "debug" or "vision".

VISION & ALIGNMENT (follow this):
{vision}

SCOPE & DESIGN (excerpt from MASTER_PLAN):
{plan_head}

RULES:
- All implementation scope comes from MASTER_PLAN. No net-new features unless the request explicitly asks.
- Align every decision with North Star and Sanctuary DNA (cozy, smooth, ritual over task list).
- Set needs_human only when:
  - "debug": repro is unclear, behavior is ambiguous, or you need user input to fix a bug.
  - "vision": the request requires new lore, new Elias voice, new metaphors, or product direction the user must define.
- If the request is clear and in-scope, set needs_human to null and give a concrete decision and actions.

Respond with a single JSON object and nothing else. No markdown fences, no extra text. Use this shape:
{{
  "needs_human": null | "debug" | "vision",
  "reason": "One sentence why, or empty if needs_human is null.",
  "decision": "Short summary of what to do.",
  "actions": ["Step 1", "Step 2", "..."],
  "notes": "Optional implementation or doc notes."
}}"""


def extract_json(text: str) -> dict:
    """Extract JSON object from model output (may be wrapped in markdown)."""
    text = text.strip()
    # Remove optional markdown code block
    if "```" in text:
        match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", text)
        if match:
            text = match.group(1)
    # Find first { ... }
    start = text.find("{")
    if start == -1:
        return {"needs_human": "debug", "reason": "No JSON in response", "decision": "", "actions": [], "notes": text}
    depth = 0
    end = -1
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    if end == -1:
        return {"needs_human": "debug", "reason": "Invalid JSON", "decision": "", "actions": [], "notes": text}
    try:
        return json.loads(text[start:end])
    except json.JSONDecodeError as e:
        return {"needs_human": "debug", "reason": f"JSON parse error: {e}", "decision": "", "actions": [], "notes": text[start:end]}


def append_human_input_needed(payload: dict, request_preview: str) -> None:
    """Append one entry to docs/HUMAN_INPUT_NEEDED.md."""
    path = DOCS / "HUMAN_INPUT_NEEDED.md"
    needs = payload.get("needs_human") or ""
    reason = (payload.get("reason") or "").strip()
    decision = (payload.get("decision") or "").strip()
    block = f"""
---
**needs_human:** {needs}  
**reason:** {reason}  
**decision:** {decision}  
**request_preview:** {request_preview[:200]}...
"""
    if path.exists():
        path.write_text(path.read_text(encoding="utf-8") + block, encoding="utf-8")
    else:
        path.write_text(
            "# Human input needed\n\n"
            "Cursor and Gemini escalate here when a **debug** (repro/steps) or **vision** (lore/direction) decision is required.\n"
            "After you respond, you can clear the relevant entry and tell Cursor to continue.\n"
            + block,
            encoding="utf-8",
        )


def call_gemini(user_content: str, dry_run: bool = False) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key and not dry_run:
        sys.exit("Set GEMINI_API_KEY in your environment.")

    system = build_system_prompt()
    full_prompt = f"{system}\n\n---\n\nUSER REQUEST / CONTEXT:\n\n{user_content}"

    if dry_run:
        print("DRY RUN")
        print("\n--- System (first 1200 chars) ---")
        print(system[:1200] + "..." if len(system) > 1200 else system)
        print("\n--- User content ---")
        print(user_content[:800] + "..." if len(user_content) > 800 else user_content)
        return {"needs_human": None, "reason": "", "decision": "dry run", "actions": [], "notes": ""}

    try:
        from google import genai
    except ImportError:
        sys.exit("Install the Google GenAI SDK: pip install google-genai")

    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=full_prompt,
        config={"temperature": 0.3},
    )

    text = getattr(response, "text", None) or ""
    if not text and response and getattr(response, "candidates", None):
        c0 = response.candidates[0]
        for part in getattr(c0.content, "parts", []):
            if hasattr(part, "text") and part.text:
                text += part.text

    if not text:
        return {"needs_human": "debug", "reason": "Empty Gemini response", "decision": "", "actions": [], "notes": ""}

    payload = extract_json(text)
    if not isinstance(payload.get("actions"), list):
        payload["actions"] = payload.get("actions") or []
    return payload


def main() -> None:
    _load_dotenv()
    parser = argparse.ArgumentParser(
        description="Send context to Gemini for a decision; output JSON. Escalate to HUMAN_INPUT_NEEDED when needs_human is set.",
    )
    parser.add_argument("--request-file", "-r", type=Path, help="Read request/context from this file.")
    parser.add_argument("--response-file", "-o", type=Path, default=DOCS / "gemini_response.json", help="Write response JSON here.")
    parser.add_argument("--context", "-c", type=str, help="Inline context string (alternative to request-file).")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts and skip API call.")
    parser.add_argument("--no-escalate", action="store_true", help="Do not append to HUMAN_INPUT_NEEDED.md when needs_human is set.")
    args = parser.parse_args()

    if args.request_file:
        if not args.request_file.is_absolute():
            args.request_file = PROJECT_ROOT / args.request_file
        if not args.request_file.exists():
            sys.exit(
                f"Request file not found: {args.request_file}\n"
                "Create it (e.g. docs/gemini_request.md) and add your context, or use --context '...' or stdin."
            )
        user_content = args.request_file.read_text(encoding="utf-8")
    elif args.context:
        user_content = args.context
    else:
        user_content = sys.stdin.read()

    if not user_content.strip():
        sys.exit("No request content. Use --request-file, --context, or stdin.")

    payload = call_gemini(user_content, dry_run=args.dry_run)

    if not args.response_file.is_absolute():
        args.response_file = PROJECT_ROOT / args.response_file
    args.response_file.parent.mkdir(parents=True, exist_ok=True)
    args.response_file.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(f"Wrote {args.response_file}")

    if payload.get("needs_human") and not args.no_escalate and not args.dry_run:
        append_human_input_needed(payload, user_content)
        print(f"Appended to {DOCS / 'HUMAN_INPUT_NEEDED.md'} — human input required ({payload.get('needs_human')}).")


if __name__ == "__main__":
    main()
