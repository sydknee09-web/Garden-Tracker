# Build Alignment Plan — Master Plan → Implementation

**Purpose:** Align the current build with the MASTER_PLAN blueprint and all related specs.  
**Goal:** Fully implement remaining items, pass smoke tests, then hand off for manual debug.  
**Date:** March 2026  
**Derived from:** [MASTER_PLAN.md](MASTER_PLAN.md). Status and scope must align with MASTER_PLAN.

---

## 1. Current State Summary

### ✅ Implemented (Aligned)

| Area | Status | Notes |
|------|--------|-------|
| **Auth → Profile Gate → Intro/Sanctuary** | Done | `has_seen_elias_intro` check; ProfileGateScreen redirects |
| **Management Menu order** | Done | New Journey (first), Seek Guidance, Pack Satchel, Archive Recovery, Settings |
| **New Journey wizard (6 steps)** | Done | Intent (0) → Identity (1) → Appearance (2) → Logic (3) → Markers (4) → Placing stones (5) |
| **ClimbFlowProvider** | Done | `appearanceStyle`, `setAppearanceStyle`, step 0-based |
| **Mountain creation** | Done | After Appearance (Step 2) → Logic (Step 3) transition |
| **Edit Appearance** | Done | Back from Logic with `mountainId != null` updates style/name |
| **Layout type persistence** | Done | Logic step persists `layoutType` to Markers |
| **Schema** | Done | `appearance_style`, `has_seen_elias_intro`, `user_streaks`, etc. |
| **Demo mode / first-user** | Done | Connection error → "Use Demo Mode"; first-user mode |
| **Satchel "Return"** | Done | Lock → Return terminology |
| **Unit tests** | 55/55 passing | — |
| **Intro flow** | Done | 5-beat tap-to-advance, typewriter, name capture, New Journey wizard, post-wizard closing line, Whetstone setup (1–3 habits), has_seen_elias_intro → /sanctuary. EliasIntroOverlay (elias_intro_overlay.dart). |
| **Whetstone setup (post-intro)** | Done | 1–3 habits, no skip; inline prompt in sheet. |

### ⚠️ Partial / Misaligned

| Area | Gap | Fix |
|------|-----|-----|
| **Terminology** | Scroll Map app bar: "THE SCROLL" | Change to "THE MAP" per MASTER_PLAN |
| **Integration test** | `mallet_flow_test` expects "The Scroll" | Update to "The Map"; nav via Satchel → The Map |
| **Intro visuals** | Partial / Deferred | Forest Threshold (cold-start fade), Elias pose variants per beat, background progression (parallax). See ELIAS_INTRODUCTION_SPEC §1, §6. |
| **Forest Threshold** | Bootstrap shows "Loading Sanctuary..." | Replace with forest image fade (cold start) |
| **Step 5 button** | Uses "Return to Map" / Next Area | Add "Pack this Journey" as final CTA when all markers have stones placed |

### ❌ Not Yet Implemented

| Area | Spec | Priority |
|------|------|----------|
| **Hammer in Satchel** | Trailing icon on each stone; tap → Refine modal | P0 |
| **MountainDetailScreen** | Route `/scroll/:mountainId`; Map → Detail flow | P0 |
| **Map refactor** | Summary cards only; full tree in Detail | P0 |
| **Whetstone choice overlay** | Tap Whetstone tile → bubble tail; Sharpen Habits only (Refine on Map) | P1 |
| **Forest Threshold** | Cold-start forest fade | P1 |
| **Auth screen aesthetic** | Japandi, warm palette | P2 |
| **Audit fixes** | Node stream filter, climb flow disposal | P2 |

---

## 2. Implementation Phases

### Phase A — Smoke Test Unblock (Quick Wins)

**Goal:** Get integration tests passing so we have a green baseline.

| # | Task | File(s) | Acceptance |
|---|------|---------|------------|
| A.1 | Terminology: "THE SCROLL" → "THE MAP" | `scroll_map_screen.dart` | App bar shows "THE MAP" |
| A.2 | Update mallet_flow_test | `mallet_flow_test.dart` | Test taps Satchel → The Map; expects "THE MAP" |
| A.3 | Fix mallet test wizard flow | `mallet_flow_test.dart` | Handle 6-step wizard (Intent, Identity, Appearance, Logic, Markers, Placing stones) if adding mountain |

**Notes:** The mallet test may add a mountain via Architect (existing flow) or via New Journey. If it uses Architect, the old "Name This Mountain" / "Begin the Climb" may be gone—wizard is now 6-step. Check whether Architect still creates mountains or if that path was removed. If Architect creates boulders on existing mountains only, the test needs a mountain first—either from wizard or from pre-loaded demo data.

### Phase B — P0: Hammer + Mountain Detail

**Goal:** Core flows from MASTER_PLAN Part B and Build Outs 9–10.

| # | Task | Spec | Acceptance |
|---|------|------|------------|
| B.1 | Hammer icon on Satchel slots | HAMMER_REFINE_MODAL_SPEC | Trailing hammer (Aged Bronze) on each filled slot |
| B.2 | Refine modal (Shatter layout) | HAMMER_REFINE_MODAL_SPEC | Tap hammer → modal with boulder name, pebble inputs, Strike |
| B.3 | Strike → createPebble batch | HAMMER_REFINE_MODAL_SPEC | Pebbles created under boulder; Satchel updates |
| B.4 | Route `/scroll/:mountainId` | PEAK_JOURNAL_SPEC, app.dart | go_router sibling route |
| B.5 | MountainDetailScreen | PEAK_JOURNAL_SPEC | Intent, Progress, collapsible tree, Sacred Actions |
| B.6 | Map refactor: summary cards | PEAK_JOURNAL_SPEC | Remove full tree from Map; cards with Name, Icon, Progress |
| B.7 | Tap card → push to Detail | PEAK_JOURNAL_SPEC | Hero transition optional; navigation works |
| B.8 | Architect only on Detail | PEAK_JOURNAL_SPEC | Mallet/Architect on Detail, not on Map summary |

### Phase C — P1: Elias Intro + Whetstone

**Goal:** First-impression flow per ELIAS_INTRODUCTION_SPEC.

| # | Task | Spec | Acceptance |
|---|------|------|------------|
| C.1 | EliasIntroOverlay | ELIAS_INTRODUCTION_SPEC | 5-beat tap-to-advance; typewriter |
| C.2 | Beat 5 → New Journey Wizard | ELIAS_INTRODUCTION_SPEC | Wizard opens; user creates first peak |
| C.3 | Post-wizard closing line | ELIAS_INTRODUCTION_SPEC | Elias: "This mountain is now carved..." |
| C.4 | Whetstone setup (1–3 habits) | ELIAS_INTRODUCTION_SPEC | No skip; min 1 habit |
| C.5 | Set has_seen_elias_intro | ELIAS_INTRODUCTION_SPEC | On Whetstone complete → update profile → /sanctuary |
| C.6 | Forest Threshold (cold start) | MASTER_PLAN § Living World | Bootstrap: forest fade instead of "Loading Sanctuary..." |
| C.7 | Whetstone choice overlay | WHETSTONE_CHOICE_OVERLAY_SPEC | Tap Whetstone in Satchel → bubble tail; Sharpen Habits only |

### Phase D — P2: Polish + Audit

**Goal:** Robustness and doc fixes.

| # | Task | Spec | Acceptance |
|---|------|------|------------|
| D.1 | Node stream mountain_id filter | Part E Audit | `.eq('mountain_id', mountainId)` in node_repository |
| D.2 | Climb flow disposal | Part E Audit | `ref.keepAlive` in initState; `ref.invalidate` in dispose |
| D.3 | Step 5 "Pack this Journey" | MASTER_PLAN F.0.5 | When all markers have stones placed, primary CTA = "Pack this Journey" |
| D.4 | RLS verification | Build Out 7 | Two test accounts; poison-record test |
| D.5 | First Five tests | Part G | Run on device; document pass/fail |

---

## 3. Smoke Test Fixes (Phase A Detail)

### A.1 Terminology

```dart
// scroll_map_screen.dart — app bar
'THE SCROLL' → 'THE MAP'
```

### A.2 Mallet Flow Test

Current test expects:
- `find.text('The Scroll')` on Sanctuary — **not present** (access via Satchel)
- `find.text('THE SCROLL')` on Scroll screen — **should be "THE MAP"**

**Updated flow:**
1. Sanctuary: tap Satchel bag (or "Satchel" label)
2. Satchel screen: tap "The Map"
3. Scroll screen: expect "THE MAP" in app bar
4. Rest of test unchanged (Architect, boulder, pebble, split)

**Mountain creation:** If test adds mountain via FAB, the old "Name This Mountain" dialog is gone. New Journey is 6-step. Options:
- **A:** Pre-load a test mountain in demo/storage so test doesn't need to create one
- **B:** Add a helper that creates a minimal mountain via repository (bypass UI)
- **C:** Extend test to run through 6-step wizard (slower, brittle)

Recommendation: **A** for smoke test speed; **C** for full E2E coverage later.

### A.3 Wizard Step Labels

If mallet test ever goes through New Journey, it must handle:
- Step 0: Intent (multi-line)
- Step 1: Identity (name)
- Step 2: Appearance (style picker)
- Step 3: Logic (Climb/Survey)
- Step 4: Markers (1–10)
- Step 5: Placing stones (Place Pebble, Pack this Journey)

---

## 4. Execution Order

```
Phase A (smoke unblock) → Phase B (Hammer + Detail) → Phase C (Intro) → Phase D (polish)
```

**Before manual debug:**
1. Phase A complete → `flutter test integration_test` passes
2. Phase B complete → Hammer works; Map → Detail works
3. Phase C optional for smoke — intro can be placeholder if time-boxed
4. Phase D deferred — user does manual debug first

---

## 5. Handoff Checklist

When smoke test passes and build is ready for manual debug:

- [x] All Phase A items done (terminology, mallet test nav fix)
- [ ] Phase B items done (or explicitly deferred with notes)
- [x] `flutter test` (unit) passes — 55/55
- [ ] `flutter test integration_test` passes — run on device/emulator with `--dart-define=SKIP_AUTH=true`
- [ ] `flutter run` on device — no crash on cold start
- [ ] Demo mode works (connection error → Use Demo Mode)
- [ ] First-user mode works (reset intro state)

**Integration test note:** Run with `flutter test integration_test --dart-define=SKIP_AUTH=true` on an attached device/emulator. Demo mode pre-loads "Sanctuary Heights"; mallet test navigates Satchel → The Map.

---

## 6. Related Docs

- [MASTER_PLAN.md](MASTER_PLAN.md) — Blueprint
- [MASTER_PLAN_AUDIT_REPORT.md](MASTER_PLAN_AUDIT_REPORT.md) — Audit findings
- [ELIAS_INTRODUCTION_SPEC.md](ELIAS_INTRODUCTION_SPEC.md) — 5-beat intro
- [HAMMER_REFINE_MODAL_SPEC.md](HAMMER_REFINE_MODAL_SPEC.md) — Hammer in Satchel
- [PEAK_JOURNAL_SPEC.md](PEAK_JOURNAL_SPEC.md) — Mountain Detail + Map refactor
- [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) — Manual test steps

---

**End of Build Alignment Plan.**
