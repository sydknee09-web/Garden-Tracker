# Use-it audit — Calendar, Plant profile, Grow instance

Manual click-through checklist and code-review findings for the Phase 1 & 2 flows.

---

## 1. Calendar

### Checklist
- [ ] **Tap a task** → Task detail popup opens (not navigation). Shows: category/title, due date, plant name, linked product (if any), Close + View Plant Profile.
- [ ] **View Plant Profile** → Navigates to plant profile Care tab with `from=calendar&date=...`.
- [ ] **Long-press a task** → Enters select mode (task highlighted, checkbox).
- [ ] **Tap another task** → Toggles selection (multi-select).
- [ ] **Tap FAB (orange arrow)** → Batch menu opens: Reschedule, Delete, Edit task, Exit select mode.
- [ ] **Reschedule** → Sheet with Tomorrow / In 3 days / Next week + date picker; Apply updates due dates.
- [ ] **Delete** → Confirmation sheet. If any selected task is recurring: two options — "Only this instance" vs "All future tasks".
- [ ] **Edit task** (one task selected) → NewTaskModal opens in edit mode; change title/due/category and Save.
- [ ] **Exit select mode** → Clears selection, FAB returns to green +.

### Feels off / missing (from review)
- **Task detail popup:** Completed tasks don’t show "Completed" or completed date — added below.
- **Delete dialog:** When selection mixes recurring and non-recurring, copy could say "One or more selected tasks are recurring" — clarified below.
- **Discoverability:** After long-press, some users may not notice the FAB turned orange; no explicit hint. Consider a one-time tooltip or leave as-is.

---

## 2. Plant profile

### Checklist
- [ ] **Care tab** → Companion planting and Tags sections appear (moved from About).
- [ ] **About tab** → How to Grow above Propagate & Harvest; single merged card for "Propagate & Harvest seeds".
- [ ] **Header:** ✨ (Fill blank info) and **Overwrite AI** (amber) visible for own profile, non-legacy.
- [ ] **Overwrite AI** → Confirmation: "This will replace description, growing notes… Continue?" → Continue runs AI overwrite and refreshes profile.
- [ ] **Fill blanks (✨)** → Fills empty fields from cache/AI; does not overwrite existing.
- [ ] **Magic Fill (Care tab)** → Generates suggestions; list auto-refreshes; unapproved tasks appear muted/grey; loading shows spinner.

### Feels off / missing
- **Overwrite AI** and **Fill blanks** both use the same error banner; ensure message is clear which action failed.
- **Scroll position:** After Overwrite AI or Magic Fill, page may jump to top on refresh; acceptable for now.

---

## 3. Grow instance page

### Checklist
- [ ] **From Vault → Plantings tab** → Card links to `/garden/grow/[id]?from=profile`. Back returns to profile Plantings tab.
- [ ] **From Garden (Active or My Plants)** → Card links with `from=garden&gardenTab=active|plants`. Back returns to same tab.
- [ ] **Header:** Back, title (+ location), "About variety" (→ plant profile), Archive (red trash) if own plant.
- [ ] **Hero** → Law 7: journal photo → profile hero path → profile hero URL → placeholder.
- [ ] **Stats bar:** Age, Status, Next milestone, Location (tappable to edit).
- [ ] **Tabs:** Overview (key facts, gallery), Task History (timeline), Notes (note entries + Add note).
- [ ] **Archive** → Confirmation; on confirm, status → archived and redirect to back link.

### Feels off / missing
- **Next milestone:** Uses first incomplete task by due_date order (tasks loaded ascending); correct.
- **Direct URL** (no `from`): Back goes to `/garden` or `/garden?tab=plants` for permanent; fine.
- **Empty states:** No specific empty copy for "No notes yet" beyond empty list; optional enhancement.

---

## Summary of code changes from this audit (done)
- Task detail popup: show "Completed" + date when `task.completed_at` is set.
- Delete confirmation: when any selected task is recurring, intro copy now says "One or more selected tasks are recurring. Delete:"

---

*Last updated: March 2026*
