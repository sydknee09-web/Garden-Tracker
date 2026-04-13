# Voyager Term Scrub — Cursor Prompt & Mapping

Use this after running `term_scrub_audit.py` and opening `voyager_term_audit.txt`.

---

## Cursor prompt

> I am providing voyager_term_audit.txt which lists all the 'garden-related' terms currently in my app. These belong to a different project. Please go through these files and replace the terminology using the **Voyager Sanctuary Metadata Mapping** below. Ensure logic remains intact but the storybook metaphor is consistent. Follow the **Golden Rules** and **Grow Nuance** sections so the transition from Garden to Sanctuary is seamless.

---

## Golden Rules (apply every replacement)

### 1. The "Technical Seed" Shield

If the term **"seed"** appears inside a function call like `fromSeed` or a variable that looks like a database mock/initializer (e.g. `seedEmptySlots`, `seedInMemoryOnly`), **do not touch it** unless you are also updating the function definition and all its references. Preserve Dart/Flutter APIs: `Random().seed`, `Color.fromSeed(...)`, `ColorScheme.fromSeed(seedColor: ...)`.

### 2. Verb conjugation

The mapping "Planting → Carving/Setting" must flow naturally in sentences:

- *Garden:* "You are **planting** a new goal."
- *Sanctuary:* "You are **carving** a new stone" or "You are **placing** a new pebble."

Choose **carving** when the action is formative; **placing** when it’s about putting a pebble in a slot.

### 3. The "Grow" nuance

In a mountain context we don’t just "grow"—we **ascend**, **sharpen**, or **weather**.

- *Example:* "Growing Habit" → **"Hardening Habit"** or **"Ascending Path"**.
- Use **ascend** for progress upward; **sharpen** for refinement; **weather** for persistence over time.

---

## Voyager Sanctuary metadata mapping (translation guide)

| Old (Garden) Term | New (Voyager Sanctuary) Term |
|-------------------|------------------------------|
| Seed              | Stone or Pebble              |
| Planting          | Carving or Setting           |
| Garden            | Sanctuary or Peak            |
| Grow / Bloom      | Ascend / Sharpen             |
| Harvest           | Summit / Reach the Peak     |
| Soil              | Earth / Hearth               |
| *(orchard)*       | *(use Peak / Grove as needed)* |

---

## Important: do not change these “seed” usages

- **`Random().seed`** — Dart API.
- **`Color.fromSeed(...)`** / **`ColorScheme.fromSeed(seedColor: ...)`** — Flutter API.

Method names like `seedInMemoryOnly()`, `seedEmptySlots()`, `seedStarterHabits()` are **domain** uses and should be translated per the mapping (e.g. “stone”/“pebble” or “carve”/“set” as appropriate) **only** where it keeps the storybook consistent and doesn’t break APIs or public method contracts. If a method is part of a public or repository interface, see Golden Rule 1: do not touch them unless updating definition and all references in one pass. If in doubt, leave identifiers as-is; change only user-facing copy and comments.

---

## Satchel integration check

Before or after the scrub, confirm that **Whetstone/Satchel** surfaces stay on-metaphor: `docs/ELIAS_PRESENTATION.md` and `lib/features/satchel/whetstone_choice_overlay.dart`. As of the last audit run, neither file contained any of the target garden terms—they are already clean. If you add new copy to those files later, re-run `term_scrub_audit.py` and spot-check.

---

## How to run the audit

1. In Cursor, open a terminal in the project root (`voyager_sanctuary`).
2. Run: `python term_scrub_audit.py` (or `python3 term_scrub_audit.py`).
3. Open the generated `voyager_term_audit.txt`.
4. Use the prompt and mapping above with Cursor to apply replacements.
