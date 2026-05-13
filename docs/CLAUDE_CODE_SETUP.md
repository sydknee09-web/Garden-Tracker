# Claude Code setup — recommended hook for rules-card injection

Adding a `UserPromptSubmit` hook to `.claude/settings.json` injects the
[CLAUDE.md Rules Card](../CLAUDE.md#-rules-card--check-before-every-response-locked-2026-05-12)
into every prompt Claude receives. This forces Claude to scan the
load-bearing rules each turn, instead of relying on memory or buried
detail sections.

**Drift this fixes (observed 2026-05-12 session):**
- Claude triaged 12 items of feedback without grepping `BUGS.md` first;
  missed U12, U13 re-surfacing.
- Claude jumped to "fix strict bug" on subsequent feedback without
  triage.
- Claude needed reminding of session-switch signals; rules-card item 8
  reinforces this.

## How to enable

Create or edit the project's `.claude/settings.json` at the **main repo
root** (NOT inside a worktree — the worktree's own `.claude/` is for
worktree state, not Claude config):

```
C:\Users\marsh\OneDrive\Documents\Garden Tracker\.claude\settings.json
```

Paste this content (or merge with existing settings):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "echo '🪪 RULES CARD — re-verify before responding:\\n1. Read VISION/ROADMAP/WORKFLOW once per session.\\n2. Bug/feature mentioned by user? grep docs/BUGS.md + ROADMAP §3+§4 + VISION §11 + BACKLOG.md FIRST. Surface existing entry if found.\\n3. Every chat purpose runs Chat Lifecycle Protocol: kickoff → readiness gate → execute (amendment=re-audit) → verification (def-of-done) → close (uncovered-work clean + Rule A explicit asks + Rule B loose-ends tied). Phase declarations required at chat-open / transitions / amendments.\\n4. Aesthetic decision? Propose options, ask. Do NOT decide silently.\\n5. Off-roadmap / feature-creep request? Push back plainly per PM rule. Park unless user overrides after hearing cost. Tooling ≠ feature creep.\\n6. Push to main? Code needs explicit yes-build per push. Doc-only pushes immediately (verify diff). Destructive always asks.\\n7. End substantive responses with where-we-are / what-next (one sentence).\\n8. Watch for session-switch signals (long chat, mode shift, chunk shipped, drift detected). Suggest fresh chat proactively.\\nFull detail: ./CLAUDE.md'"
          }
        ]
      }
    ]
  }
}
```

## How it works

- Every time you send a message in Claude Code, the hook's `command`
  runs.
- Stdout is injected into the prompt as additional context Claude sees.
- The injected text is the 8-bullet rules card.
- Claude reads it BEFORE responding, can't skip it.

## Cost

- ~250 tokens added to every turn (small).
- Adds ~50ms hook execution per turn (imperceptible).
- Reduces drift events that cost 5-10 turns of recovery — net positive.

## When to update

When a rule changes in `CLAUDE.md`'s Rules Card section, mirror the
change in this file's hook command so the injection stays in sync.
Imperfect coupling but acceptable until automated.

## To disable

Delete `.claude/settings.json` or remove the `UserPromptSubmit` block
inside it.

---

*This is project-level configuration, not Claude-generated runtime code.
Owned by the user. Claude proposes; user enables.*
