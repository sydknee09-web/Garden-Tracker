# Voyager Sanctuary — Next Steps (Post Phase 1)

**Phase 1 Master Ledger is complete.** All smoke tests passing. This document guides your next decision.

**Current path (March 2026):** Option A — Ship and Learn for 1–2 weeks.

---

## What You Should Do Now

### Step 1: Choose Your Path

Pick **one** of the following based on your goal:

---

### Option A: Ship and Learn (Recommended if you want feedback first)

**Goal:** Use the app in real workflows, gather feedback, then prioritize features.

**Your actions:**

1. **Install on your device** (if not already):
   ```powershell
   cd voyager_sanctuary
   flutter install -d R5CW3057XJP --debug
   ```

2. **Use the app for 1–2 weeks** with real goals:
   - Create a peak via New Journey (Elias → Management → New Journey)
   - Run through the 6-step wizard (Intent, Identity, Appearance, Logic, Markers, Placing stones)
   - Pack Satchel, burn stones, use the Map
   - Tap peak titles to open Bones; edit Intent and Logic

3. **Note friction points:**
   - What felt confusing?
   - What did you wish you could do?
   - Where did you get stuck?

4. **Return with feedback** to prioritize: Branch Removal, Promote, or something else.

---

### Option B: Build Branch Removal Next (Recommended if you want more features now)

**Goal:** Add long-press on Marker → "Move to General" or "Scatter" so users can reorganize peaks.

**Your actions:**

1. **Request implementation:** Ask your dev (or Cursor) to implement Branch Removal per `docs/MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md` §6:
   - Long-press on Marker (boulder) → show options
   - **Move to General:** Create "Miscellaneous" region at bottom of same peak; move pebbles there
   - **Scatter:** Hard delete with Elias confirmation: *"Are you sure? These memories will be lost to the wind."*

2. **After Branch Removal:** Consider Level Up (Promote) or shipping for feedback.

---

### Step 2: Run Smoke Tests Before Any Release

Whenever you make changes or before shipping:

```powershell
cd voyager_sanctuary
flutter test integration_test/synthetic_users/synthetic_user_test.dart -d R5CW3057XJP --timeout 8m --dart-define=SKIP_AUTH=true
```

**Requirements:** Device unlocked, screen on, USB connected.

---

### Step 3: Keep the App Installed (Optional)

Flutter uninstalls the app after integration tests. To keep it on your device for manual testing:

```powershell
flutter install -d R5CW3057XJP --debug
```

---

## Summary

| Path | When to choose |
|------|----------------|
| **Option A: Ship and Learn** | You want real-world feedback before building more. |
| **Option B: Branch Removal** | You want to add lifecycle features (reorganize markers) next. |

Both are valid. Option A reduces risk of building the wrong thing; Option B delivers a high-value feature from the spec.

---

## Reference

- **Master Ledger:** `docs/MASTER_LEDGER_ARCHITECTURE_OVERHAUL.md`
- **Cursor rule:** `.cursor/rules/master-ledger-overhaul.mdc` (enforces Phase 1 conventions)
- **Smoke test doc:** `docs/Completed/SMOKE_TEST_ISSUES_AND_FIXES.md`
