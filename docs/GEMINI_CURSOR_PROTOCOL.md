# Gemini–Cursor Protocol

**Goal:** Cursor and Gemini work together without the user as middleman. The user only gives input when **human debug** is needed or a **vision gap** requires their explanation.

---

## 1. Flow

1. **Cursor** has a task (from MASTER_PLAN, or user feedback). When the task benefits from a product/design decision or review, Cursor writes the **request** to `docs/gemini_request.md` (what we’re building, options, or “what should we do next?”).
2. **Cursor** runs:  
   `python scripts/gemini_decision.py --request-file docs/gemini_request.md`
3. **Gemini** (via the script) reads `docs/VISION_AND_AUTOMATION.md` and MASTER_PLAN excerpt, then returns a structured decision. The script writes the response to `docs/gemini_response.json`.
4. **Cursor** reads `docs/gemini_response.json`:
   - If **`needs_human` is null:** Cursor implements Gemini’s `decision` and `actions`; no user needed.
   - If **`needs_human` is `"debug"` or `"vision"`:** The script has already appended an entry to `docs/HUMAN_INPUT_NEEDED.md`. Cursor **does not implement**; it documents the ask and stops. The user responds when they see HUMAN_INPUT_NEEDED (repro steps, vision clarification, or “proceed with X”). After the user responds, they can tell Cursor to continue (and optionally clear that entry).

---

## 2. When Cursor Should Call Gemini

- **Before** a non-trivial implementation: “Get Gemini’s decision on approach” by writing the context to `gemini_request.md` and running `gemini_decision.py`.
- **After** a chunk of work: “Get Gemini’s review” by writing what was done and asking for alignment check; if Gemini says needs_human, stop.
- **When** the user’s feedback is high-level: Write it into `gemini_request.md` and run the script so Gemini turns it into concrete actions; Cursor then implements.

---

## 3. When Cursor Must NOT Implement (Escalate Only)

- **`needs_human: "debug"`** — Repro or environment unclear; Cursor cannot fix without user input. Stop; entry is in HUMAN_INPUT_NEEDED.
- **`needs_human: "vision"`** — New lore, Elias voice, metaphors, or product direction. User must provide the vision; Cursor implements after.

Do not guess in either case. Document the escalation and wait for the user.

---

## 4. Files

| File | Purpose |
|------|--------|
| `docs/gemini_request.md` | Cursor (or user) writes context / question for Gemini. |
| `docs/gemini_response.json` | Gemini’s structured response: `needs_human`, `reason`, `decision`, `actions`, `notes`. |
| `docs/HUMAN_INPUT_NEEDED.md` | Escalations when Gemini set `needs_human`. User responds here (or in chat) and tells Cursor to continue. |
| `scripts/gemini_decision.py` | Bridge: reads request + vision doc, calls Gemini API, writes response and optionally appends to HUMAN_INPUT_NEEDED. |

---

## 5. Setup

- **GEMINI_API_KEY** in environment or in project root **`.env`** (script loads `.env` automatically; `.env` is gitignored). Same key as for `generate_elias_dialogue.py` and `generate_assets.py`.
- From repo root:  
  `python scripts/gemini_decision.py --request-file docs/gemini_request.md`
- **429 RESOURCE_EXHAUSTED:** If you see "quota exceeded, limit: 0", Google may require a **billing account linked** to the project even for free-tier quotas. Enable billing in Google Cloud / AI Studio for the project, then retry. See [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

---

## 6. User’s Role (No Middleman)

- **You do not** sit between Cursor and Gemini. Cursor calls Gemini via the script and follows the response.
- **You step in only when:**
  - **Debug:** An entry in HUMAN_INPUT_NEEDED says `needs_human: debug` — provide repro steps, device, or clarification so Cursor can fix.
  - **Vision:** An entry says `needs_human: vision` — provide the lore, tone, or direction; then tell Cursor to continue and implement.

Everything else is Cursor ↔ Gemini using this protocol and [VISION_AND_AUTOMATION.md](VISION_AND_AUTOMATION.md).
