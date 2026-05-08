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
Plan → Plan-audit → (clean?) → Build → Self-audit → Fix → Re-audit → Hand off → Ship
   ↑        ↓                    ↑                     ↓
   └─ (until clean or material) ─┘   └── (until clean or immaterial) ──┘
```

**Engagement points with user:**
- **At plan-audit:** user reviews the plan + audit, approves or redirects.
- **At hand-off:** user reviews what shipped (or is ready to ship), confirms or flags.

**Between those: Claude operates autonomously.** Once a plan is approved, Claude doesn't seek approval to build. Once a build self-audit passes, Claude doesn't seek approval to commit/push (within the risk tier rules in step 7 below).

### 1. Plan

Before any code, draft the plan. Plan answers:
- **Acceptance criteria:** what changes for the user, how we know it's done
- **Approach:** what files / areas / functions get touched
- **Scope boundaries:** what's explicitly out of scope
- **Risks:** what could go wrong, what's uncertain
- **Verification strategy:** which tests, what manual check, code-review agent if warranted
- **Effort estimate:** XS / S / M / L / XL

For XS tasks (under 30 min) the plan is a few lines in conversation. For S+ it's a structured list (TodoWrite or bullet block). For M+ it may be its own doc.

### 2. Plan-audit

Claude reviews the plan against:
- Are acceptance criteria specific and testable?
- Is scope tight? (No "while I'm at it" sprawl)
- Are risks acknowledged?
- Is verification strategy proportional to size?
- Is there hidden coupling? (Will this fix really live alone, or does it need a refactor first?)
- Are there better/cheaper paths to the same outcome?

If plan-audit surfaces issues: revise the plan, re-audit. Loop until clean.

**Then:** present plan + audit findings to user. User approves or redirects. **Once approved, no further approval needed until hand-off.**

### 3. Build

Implementation. May span multiple files. May use sub-agents for parallel research or independent code review. Claude works without check-ins; the plan was the contract.

### 4. Self-audit

Claude (and optionally a code-reviewer agent) checks:
- Acceptance criteria met
- Existing tests still pass (`npm run test:run`)
- No new TypeScript errors (build passes for M+ tasks)
- Edge cases considered
- No accidental scope creep beyond the plan
- For UI: visual quality, accessibility (touch targets, aria-labels), responsive layouts
- For data: RLS / soft-delete / user_id scoping (the project's "Laws")

### 5. Fix

Address findings. Loop back to step 4.

### 6. Re-audit

Repeat 4+5 until findings are clean or only immaterial.

**"Immaterial"** means: out-of-scope concern (logged for later), pre-existing issue (not caused by this change), or stylistic preference that doesn't affect function. Document it; don't gate on it.

### 7. Hand off (with explicit next step)

Plain-language summary to user:
- **What changed for the user** (in their words, not technical)
- **Where to test it**
- **Any decisions made** that the user should know
- **Anything new I noticed** that's out of scope but worth logging
- **NEXT STEP** — explicit. One of:
  - "Next: ship this (push) — speak up if you want to hold."
  - "Next: I'll verify with you, then push. Tap to confirm or flag issues."
  - "Next: planning [task X]."
  - "Next: waiting for your direction on [decision]."

The "next step" line is non-optional. Every hand-off ends with it so the user can intervene before momentum carries us in a wrong direction.

### 8. Ship

`git push` per risk tier:
- **Doc-only / lock-file / config:** push immediately, summarize after
- **UI changes / new behavior:** push after self-audit; user verifies in production. Hand-off-first only when user-flagged or for risky changes.
- **Schema changes:** always hand-off → user reviews migration → push deliberately
- **Anything irreversible** (schema migration to prod, force-push, account changes): explicit approval before pushing

For this project specifically: the user has approved deploys to `garden-tracker-cyan.vercel.app` via push to `main`. The hand-off includes the next step, so the user always knows what's about to happen.

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

## Don't assume aesthetic / UX intent

If the user says **"X takes too much space"** or **"X feels off"** or **"the calendar header is too big"**, that is a **prompt to discuss, not a spec to fix.** It tells me what they don't like, not what they want instead.

**Before changing anything visual / aesthetic / structural, I have to surface my reasoning and ask:**
- What is the user trying to highlight on this page? (e.g. for Calendar — the grid? the tasks? the plantable widget?)
- What did they already like that I should preserve? (color scheme, specific elements, a particular treatment)
- What's the *outcome* they want — not the *implementation* I assume?

**Hard rule:** if a fix involves changing colors, sizes, paddings beyond minor (>4px), reorganizing a section's hierarchy, demoting/promoting a feature, or changing how prominent something feels — STOP and ask before building. Even when the user has flagged the issue. The flag identifies a problem; it does not authorize my interpretation of the solution.

**OK to fix without asking:** strict bugs (truncation, clipping, off-by-one, broken layout, broken behavior), where there's a single objectively-correct answer.

**NOT OK to fix without asking:** anything where reasonable people could disagree on the solution. Visual hierarchy, color choices, density tradeoffs, what to emphasize, what to demote.

When in doubt, ask. The cost of a question is 30 seconds; the cost of building the wrong thing is a deploy + verification + revert + redo.

---

## Batching small fixes

Small visual/UX changes (XS or small S) should be **batched into a single ship cycle** rather than deployed one at a time. Vercel build + user verification takes 2-3 min per round; ten 1-line fixes shouldn't mean ten deploys.

**Batch when:**
- Each item is XS or small S (≤ 1 hour individually)
- Items are visual / cosmetic / contained CSS or copy changes
- All can be verified in a single test session
- Risk is independent (one broken item shouldn't block the others — easy to revert if needed)

**Don't batch when:**
- Any item is M+ (real engineering scope)
- Items touch the same file in conflicting ways
- One item depends on another's outcome
- Risk is high enough that the user might want to verify each independently

**Batch size:** 3-5 items is the sweet spot. More than 5 and the user's test burden grows; fewer than 3 and we're not really batching.

**Each batched commit's hand-off** lists every item and where to test it, so the user can run through the batch in one session.

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
