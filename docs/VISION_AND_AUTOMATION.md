# Vision & Automation — Alignment Contract

**Purpose:** Single reference so any AI (Cursor, Gemini, or other) can make decisions aligned with the product vision. The user stays hands-off except for **debugging** (needs user input) and **vision creation** (user defines; AI executes).

See [MASTER_PLAN.md](MASTER_PLAN.md) for full scope, phases, and tasks. This doc is the **contract** for what "aligned" means and who does what.

---

## 1. North Star & DNA

- **North Star:** Cozy. Smooth. Gamified. Polished. Fun. Studio Ghibli–esque retreat—tactile, whimsical, satisfying.
- **Focus:** Satisfaction of the *movement* (burning a rune stone, packing, striking the hammer), not the status of materials. Sanctuary is a place you *want* to return to, not a productivity tool you open out of obligation.
- **Sanctuary DNA:** Cozy, Smooth, Intent-focused. Structure supports clarity; clutter undermines it. Japandi: minimal entry points, calm over chaos, "less is more." When in doubt, subtract.
- **Tone:** Ritual over task list. Metaphor-rich, warm, no guilt. Elias speaks like a guide, not a coach. Arriving at a place, not checking a box.
- **What we avoid:** Clutter, guilt-tripping, cold/sterile UI, corporate tracker feel, flat grey dimming. No "productivity software" feel. Evicted: "Hotel Executive" / high-end office vibes; status over satisfaction.

Full detail: [MASTER_PLAN.md § Design Aesthetic & Philosophy](MASTER_PLAN.md#design-aesthetic--philosophy).

---

## 2. Scope — Where Implementation Comes From

- **Single source of scope:** All implementation scope comes from [MASTER_PLAN.md](MASTER_PLAN.md) (and its derived docs: BUILD_ALIGNMENT_PLAN, HEALTH_AND_IMPROVEMENTS, PROJECT_PLAN_REFINE_AND_POLISH). See [CONVENTIONS.md § Plan document hierarchy](CONVENTIONS.md#plan-document-hierarchy).
- **No net-new features** outside MASTER_PLAN unless the user explicitly asks (e.g. "add a new X").
- **Build philosophy:** Small verified chunks. Never build what you cannot test. Data models first, state layer second, UI last.

---

## 3. Who Does What

| Responsibility | Owner | Notes |
|----------------|--------|------|
| **Vision & product direction** | User | North star, new metaphors, lore, tone, "what the app is." |
| **Implementation & code** | AI | Within MASTER_PLAN and this vision. Update docs when scope or status changes. |
| **Decisions that fit the vision** | AI | E.g. layout, copy within existing tone, error messages, small UX choices. |
| **Debugging** | User + AI | AI needs user input for repro steps, environment, "what’s wrong." Do not guess—ask. |
| **New vision (lore, tone, rituals)** | User | AI does not invent new Elias voice, new rituals, or new metaphors. Propose options or ask user to provide. |

---

## 4. When to Stop and Ask the User

- **Debugging:** If repro is unclear, behavior is ambiguous, or the fix could have side effects—ask for steps, device, or clarification before implementing.
- **Vision or product conflict:** If a change might conflict with the stated aesthetic, flow, or "Sanctuary DNA"—propose options or ask; do not assume.
- **New lore / copy / rituals:** Do not create new Elias dialogue, new ritual names, or new metaphors from scratch. Suggest alternatives and let the user choose or supply the vision.
- **Scope outside MASTER_PLAN:** If the user’s request implies a new feature or phase not in the plan, confirm or add it to the plan (user approves) before building.

---

## 5. How to Use This Doc (for AI)

1. **Before implementing:** Read this doc and the relevant parts of MASTER_PLAN (and CONVENTIONS). Ensure the change aligns with North Star, DNA, and scope.
2. **When the user gives feedback:** Treat it as a vision/alignment input. Update behavior or docs to reflect it; do not treat it as a one-off hack unless the user says so.
3. **When something breaks or is unclear:** Do not guess. Ask the user for repro, environment, or clarification.
4. **When proposing new copy/lore/UX:** Propose options; do not invent new vision. User decides; AI implements.

---

## 6. Automation Loop (Summary)

- **User provides:** Vision, high-level feedback, and debugging input when things go wrong.
- **AI does:** Implements within MASTER_PLAN; makes small decisions that fit this vision; updates docs; stops and asks for user when debugging is unclear or new vision is required.

Result: a polished app built from docs and code with the user hands-off except for debugging and vision creation.

---

## 7. Gemini–Cursor (No User Middleman)

Cursor and Gemini work together directly via `scripts/gemini_decision.py`. The user is **not** the middleman.

- **Cursor** writes context to `docs/gemini_request.md` and runs the script; **Gemini** returns a structured decision in `docs/gemini_response.json` (aligned with this vision doc).
- If Gemini sets **`needs_human`: "debug"** or **"vision"**, the script appends to `docs/HUMAN_INPUT_NEEDED.md`. Cursor does not implement—it stops. The **user** steps in only then (repro steps for debug, or vision/lore for vision).
- If `needs_human` is null, Cursor implements Gemini’s decision and actions with no user input.

See [GEMINI_CURSOR_PROTOCOL.md](GEMINI_CURSOR_PROTOCOL.md) for the full flow and file layout.
