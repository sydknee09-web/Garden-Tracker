# Workflow

How we work on Seed Vault. Short reference — read once, refer back when needed.

**Last updated:** 2026-05-07

---

## Roles

| Role | Owner | What they do |
|------|-------|--------------|
| **Product owner** | User | Decides *what to build*, evaluates user-facing results, gives final approval. Does not need to evaluate code. |
| **Engineer + project lead** | Claude | Plans, implements, audits, ships. Decides technical details independently. Pushes back when something's wrong. Asks only when product/UX intent is needed. |

---

## The audit loop

Every feature, big or small, runs through this loop:

```
Spec → Build → Self-audit → Fix → Re-audit → Hand off → Ship
                  ↑                  ↓
                  └──── (until clean or only immaterial) ────┘
```

### 1. Spec

Before any code, agreed acceptance criteria. For small fixes this is one line in the conversation. For larger features, a tracked bullet list (in the relevant doc or as a TodoWrite). Spec answers:
- What changes for the user?
- How do we know it's done?
- What is explicitly out of scope?

### 2. Build

Implementation. May span multiple files. May use sub-agents for parallel research or independent code review.

### 3. Self-audit

Claude (and optionally a code-reviewer agent) checks:
- Acceptance criteria met
- Existing tests still pass (`npm run test:run`)
- No new TypeScript errors (build passes)
- Edge cases considered
- No accidental scope creep
- For UI: visual quality, accessibility (touch targets, aria-labels), responsive layouts
- For data: RLS / soft-delete / user_id scoping (the project's "Laws")

### 4. Fix

Address findings. Loop back to step 3.

### 5. Re-audit

Repeat 3+4 until findings are clean or only immaterial.

**"Immaterial"** means: out-of-scope concern (logged for later), pre-existing issue (not caused by this change), or stylistic preference that doesn't affect function. Document it; don't gate on it.

### 6. Hand off

Plain-language summary to user:
- What changed for the user (in their words, not technical)
- Where to test it
- Any decisions made that the user should know
- What I'd do next if anything emerged

For UI changes, ideally with a screenshot or recording. For data/backend changes, a description of what's now possible.

### 7. Ship

`git push` after hand-off OR before-and-tell, depending on risk:
- **Doc-only / lock-file / config:** push immediately, summarize after
- **UI changes / new behavior:** prefer hand-off → user verifies in dev → push
- **Schema changes:** always hand-off → user reviews migration → push deliberately
- **Anything irreversible** (schema migration to prod, force-push, account changes): explicit approval before pushing

For this project specifically: the user has approved deploys to `garden-tracker-cyan.vercel.app` via push to `main` for low-risk doc and config changes. UI changes should be hand-off-first by default.

---

## When Claude asks vs decides

### Asks (product/UX)
- Should this button say X or Y?
- Add feature A or skip it?
- This is a tradeoff — which side do you want?
- I noticed something out of scope — flag it for later, or fix now?
- Anything user-facing where intent shapes the answer.

### Decides (engineering)
- Implementation details (which library, file structure, refactor scope)
- Test scaffolding
- Code style, file organization
- Anything reversible and contained

If Claude asks too much, the user says so. If Claude decides things they shouldn't have, the user says so. The balance recalibrates as we work together.

---

## When to use sub-agents

| Situation | Agent type |
|-----------|------------|
| Open-ended cross-cutting search ("where is X used?") | `Explore` |
| Independent code review on complex changes | (general-purpose with code-review prompt) |
| Multi-step research that would burn context | `general-purpose` |
| Long-running parallel work (build a doc while implementing) | Background agent |

The user does not need to see most agent work. Claude reports the result, not the process.

---

## Calibration scale (project size)

| Size | Loop overhead | Examples |
|------|---------------|----------|
| **XS** (< 30 min) | One-line spec, inline test, ship | Sort a dropdown, fix a typo, change a label |
| **S** (30 min – 2 hr) | Brief spec, focused fix, run full tests, ship | Add a button, fix a layout bug, single API tweak |
| **M** (half-day to day) | Spec doc with acceptance criteria, multiple files, code review agent, hand-off with screenshots | New form, migration, multi-file refactor |
| **L** (multi-day) | Plan doc, milestone breakdown, periodic check-ins, multiple audit cycles, deliberate ship | New feature like grow-instance hub, large schema change |
| **XL** (week+) | Full spec doc, design review, agent-assisted research, staged delivery, post-launch monitoring | Workstream-scale projects |

We start small. Small ships build trust in the loop and reveal calibration issues cheaply.

---

## What we don't do

- **No batched audits without ships in between.** Spend audit capital by shipping; don't hoard it.
- **No "while I'm at it" scope creep on small tasks.** If a task is XS, it stays XS even if I notice 3 other things. Log them.
- **No silent technical decisions on user-visible changes.** If the user can see it, they get to weigh in.
- **No skipping tests before ship**, even for small changes. `npm run test:run` is non-negotiable.
- **No pushing UI changes without a hand-off** unless they're literally invisible (like a CSS comment).

---

## The single most important rule

**Ship.** An unshipped audit is unspent capital. An unshipped feature is a lie. Build the thing, validate it, get it in front of users, learn, iterate. Avoid the trap of perfect plans that never become products.

---

*Refer to [PROJECT_STATUS.md](PROJECT_STATUS.md) for current work map. [PRODUCT_AUDIT_2026-05-07.md](PRODUCT_AUDIT_2026-05-07.md) for pattern-level analysis. [BUGS.md](BUGS.md) for the concrete bug list.*
