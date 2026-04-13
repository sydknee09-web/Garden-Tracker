# Health Audit Runbook

**Purpose:** Regular health checks and audits so the project stays clean, consistent, and sane. Use as a project-manager and developer checklist. Cursor can run this when starting a session, before a release, or when the user asks for a health check.

**Canonical scope:** [MASTER_PLAN.md](MASTER_PLAN.md). **Conventions:** [CONVENTIONS.md](CONVENTIONS.md). **Vision:** [VISION_AND_AUTOMATION.md](VISION_AND_AUTOMATION.md).

---

## 1. When to Run

| Trigger | Scope |
|--------|--------|
| **Session start** (optional) | Quick pass: §2.1 (analyze), §2.2 (TODOs), §3.1 (doc hierarchy). |
| **Before release** | Full run: all of §2, §3, §4. Update HEALTH_AND_IMPROVEMENTS §2 table with `flutter analyze` result. |
| **On demand** | User asks for "health check" or "audit" → full run and report. |

---

## 2. Code Health

### 2.1 Analyzer

- **Command:** `flutter analyze lib/`
- **Expect:** 0 errors, 0 warnings, 0 infos. No dead code, unused imports, or deprecated API in `lib/`.
- **If issues:** Fix or document in MASTER_PLAN Part G / BUGS_DEFERRED_TO_PHASE and note in this runbook’s "Last run" below.

### 2.2 No TODOs in lib/

- **Rule (CONVENTIONS):** Do not leave TODO/FIXME/HACK comments in `lib/`. Resolve or move to MASTER_PLAN Part G or [BUGS_DEFERRED_TO_PHASE.md](BUGS_DEFERRED_TO_PHASE.md).
- **Check:** Search `lib/` for `TODO`, `FIXME`, `HACK`, `XXX`. Expect zero matches.

### 2.3 RLS / user_id

- **Rule (CONVENTIONS + user rules):** Every Supabase insert/update/delete must include `user_id` from the authenticated user.
- **Check:** All repositories under `lib/data/repositories/` (and any other code that writes to Supabase) pass `user_id` on writes. Grep for `.insert`, `.update`, `.upsert`, `.delete` and confirm `user_id` is set.

### 2.4 Folder structure

- **Ref:** [ARCHITECTURE.md § FOLDER STRUCTURE](ARCHITECTURE.md). No new top-level folders under `lib/` without updating ARCHITECTURE.
- **Check:** List `lib/` top-level; compare to ARCHITECTURE. New folders must be documented.

---

## 3. Doc Consistency

### 3.1 Plan hierarchy

- **Canonical:** MASTER_PLAN.md. **Derived:** BUILD_ALIGNMENT_PLAN, HEALTH_AND_IMPROVEMENTS, PROJECT_PLAN_REFINE_AND_POLISH. When in doubt, MASTER_PLAN wins.
- **Check:** No derived doc should contradict MASTER_PLAN on scope, phases, or status. If a task is "done" in MASTER_PLAN, derived docs should not list it as open (or should reference MASTER_PLAN).

### 3.2 Aesthetic single source

- **Canonical:** MASTER_PLAN § Design Aesthetic & Philosophy (North Star: Cozy, Smooth, Gamified, Polished; Japandi; Ghibli-esque). "Hotel Executive" is **evicted** (MASTER_PLAN).
- **Check:** ARCHITECTURE.md § DESIGN AESTHETIC must align with MASTER_PLAN. If ARCHITECTURE still says "Hotel Executive," update it to match MASTER_PLAN (Japandi, Ghibli, warm parchment, ritual over task list).

### 3.3 Cross-references

- **Check:** Links in key docs (MASTER_PLAN, CONVENTIONS, VISION_AND_AUTOMATION, GEMINI_CURSOR_PROTOCOL, HEALTH_AND_IMPROVEMENTS) point to existing files. Broken `[text](path)` → fix or remove.

### 3.4 Completed plans

- **Rule (CONVENTIONS):** Finished/superseded plans live in `docs/Completed/`. WIP stays in `docs/`.
- **Check:** No obviously completed plan (e.g. "Phase X — DONE") left in `docs/` root; move to `docs/Completed/` and update MASTER_PLAN if needed.

---

## 4. File Hygiene & Sanity

### 4.1 Automation files

- **gemini_request.md / gemini_response.json:** Optional. If present, ensure `gemini_response.json` is valid JSON and `needs_human` is null or "debug"/"vision." No stale request left as only source of truth for scope.
- **HUMAN_INPUT_NEEDED.md:** If present, list entries. User should clear or address; no unbounded backlog. Consider adding "Last reviewed: <date>."

### 4.2 Deferred bugs

- **BUGS_DEFERRED_TO_PHASE.md:** One row per deferred bug. When starting a phase, revisit rows for that phase. Check for duplicate or stale rows.

### 4.3 No "crazy" patterns

- **Spot-check:** No committed secrets (API keys, passwords). No generated binaries or huge blobs in repo. No duplicate copies of whole features (e.g. two `sanctuary_screen.dart` in different places). No obvious dead docs that reference removed features.

### 4.4 Scripts and config

- **Scripts:** `scripts/README.md` documents main scripts. `scripts/requirements.txt` matches imports in Python scripts (e.g. `google-genai`, `PyYAML`).
- **Cursor rules:** `.cursor/rules/*.mdc` exist and have `description`; no rule contradicts VISION_AND_AUTOMATION or CONVENTIONS.

---

## 5. Reporting

After a full run, record:

- **Date:** YYYY-MM-DD  
- **flutter analyze:** Pass / Fail (and count of issues if any)  
- **TODOs in lib/:** 0 or list files  
- **Doc issues:** None or list (e.g. "ARCHITECTURE aesthetic out of date")  
- **Hygiene:** None or list (e.g. "HUMAN_INPUT_NEEDED has 3 entries")  
- **Actions:** What was fixed or deferred

Update the "Last run" section below (or append to it) and, if applicable, [HEALTH_AND_IMPROVEMENTS.md § 2](HEALTH_AND_IMPROVEMENTS.md) health table.

---

## 6. Last Run (template)

| Date | Analyze | TODOs in lib | Doc issues | Hygiene | Actions |
|------|---------|--------------|------------|---------|--------|
| 2026-03-18 | Pass (0 errors; 11 warnings/infos) | 0 | ARCHITECTURE § DESIGN AESTHETIC aligned with MASTER_PLAN | — | Fixed body_might_complete_normally in elias_intro_overlay.dart; added runbook + health-audit rule. Warnings (unused imports, unused locals, deprecated withOpacity, etc.) left for future cleanup. |

*(Append new rows after each full run.)*
