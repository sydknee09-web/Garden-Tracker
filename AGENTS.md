# Voyager Sanctuary - Agent Alignment & Autopilot Protocol

When working on this repo (Cursor, Gemini, or other agents), align with the product vision and scope so the app stays consistent and the user can stay hands-off except for debugging and vision.

**Read first:** [docs/VISION_AND_AUTOMATION.md](docs/VISION_AND_AUTOMATION.md)

That doc defines:

- North Star and Sanctuary DNA (cozy, smooth, Japandi, ritual over task list).
- Where scope comes from ([MASTER_PLAN.md](docs/MASTER_PLAN.md)); no net-new features unless the user asks.
- Who does what: user owns vision and debugging input; agent owns implementation within the vision.
- When to stop and ask: unclear bugs, new lore/copy/rituals, or conflicts with the stated aesthetic.

Use this file as the single contract for implementation and product decisions.

## 1. Core Logic (WBS Hierarchy)
- Build and preserve the 4-level hierarchy: **Mountain (Goal) > Trail (Project) > Boulder (Milestone) > Stone (Task)**.
- Every `Stone` MUST have a parent `Boulder` (no orphan tasks).
- Use Supabase PostgreSQL `ltree` for hierarchy paths.

## 2. Tech Stack & Architecture
- **Frontend:** Flutter stable + Riverpod-first state architecture.
- **Backend:** Supabase.
- **Schema changes:** Always generate SQL migration scripts for DB changes.
- **Design:** Japandi/minimalist; muted earth tones; organic forms; avoid harsh/techy contrast.
- Prefer Riverpod for app state; localized widget `setState` is allowed for purely local UI animation/ephemeral view state in existing screens.

## 3. Data & Safety Rules
- Every insert/upsert for user-owned rows must include `user_id = user.id`.
- Preserve RLS behavior. Never bypass policies in app logic.
- Do not log personal user data (emails, raw auth tokens, user content) to console.
- Keep original vendor/source links in `source_url` when applicable.

## 4. Runtime Quality Gates
- If a build/test fails, fix the issue before moving on (self-healing workflow).
- If a button is dead, wire route + action to the correct hierarchy flow.
- After meaningful edits: run analyzer and a build check when possible.
- Prefer non-destructive fixes; do not run destructive git/file operations unless explicitly requested.

## 5. Sanctuary-Specific UX Invariants
- Keep dialogue and ritual tone aligned with Sanctuary voice and docs.
- Decorative effects (e.g., sparks) should use `ExcludeSemantics`; actionable controls must have clear semantics labels.
- Loading UX should use the shared Waiting pattern (dimmed spark motif) instead of raw spinners where standardized.
- Audio playback paths must respect `soundEnabledProvider`.
- Display-name fallback should remain `traveler` when name is empty/blank.

## 6. Technical Constraint: Logic & Leaf Protocol
- **Packable Check:** Only Leaf Nodes (nodes with no children) are allowed in the Satchel.
- **Container Rule:** If a Pebble has Shards, the Pebble becomes a non-packable container.
- **Hammer Logic (Satchel):** When striking a Stone with the Hammer, the agent must:
  1) remove the parent Stone from the Satchel,
  2) trigger `createShardUnderParent()` in Supabase,
  3) inherit metadata (`starred`, `due_date`) to new Shards,
  4) return new Shards to the Satchel if space permits.
- Never allow burning or packing of non-leaf container nodes (e.g., Boulder, Pebble-with-shards).

## 7. Verification Workflow
- Before release candidates, run and document gatekeepers from `docs/TESTING_CHECKLIST.md` section 8:
  - (a) Display name
  - (b) Shard completion
  - (c) RLS
  - (d) Satchel verify
- Record outcomes in First Five table / success log with date, device, and build.

## 8. Implementation Strategy: Phase-by-Phase Agent
- Do not prompt the agent to "build the whole app".
- Use phase-scoped prompts tied to `docs/MASTER_PLAN.md`.
- Preferred command pattern:
  - "@MASTER_PLAN.md @agent_alignment.mdc We are moving to Phase X: <Phase Name>. Implement <specific bullets>. Run smoke test on connected phone."
- Keep each phase prompt to concrete deliverables + one verification step.

## 9. Grounding Sources
- Flutter implementation guidance: @Flutter
- Supabase auth/database guidance: @Supabase
- Product scope and vision contract: `docs/VISION_AND_AUTOMATION.md`
- Execution priorities: `docs/GEMINI_RECOMMENDATIONS_BUILD.md` + `docs/TESTING_CHECKLIST.md`