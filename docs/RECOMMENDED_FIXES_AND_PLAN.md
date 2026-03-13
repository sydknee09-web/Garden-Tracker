# Voyager Sanctuary — Recommended Fixes & Plan

**Created:** March 2026  
**Purpose:** Single reference for everything else noticed and recommended fixes beyond the current MVP. Use alongside [AUDIT.md](AUDIT.md) and [PROJECT_PLAN.md](PROJECT_PLAN.md).

---

## 1. High priority (do before release)

| # | Item | Why | Action |
|---|------|-----|--------|
| 1 | **Initialize Git** | No version history; Phase 0 still open | `git init`, create `main` + `dev`, first commit, add remote if desired |
| 2 | **Run First Five tests** | Regressions possible; plan marks Tests #1–#5 unverified | Run manually on device per [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md); mark pass/fail in PROJECT_PLAN (Phase 5, 6, 8, 9) |
| 3 | **Verify RLS with two accounts** | Data could leak between users | Sign in as User A, create mountains/satchel data; sign in as User B, confirm B cannot see A’s data; document result |
| 4 | **Confirm satchel slots for new users** | New users might have 0 rows in `satchel_slots` | Test: create a brand‑new account, open Satchel, tap Pack (or open Scroll first). If empty slots don’t appear or errors occur, ensure app or backend seeds 6 slots (see §4 below) |

---

## 2. Recommended (improve robustness & UX)

| # | Item | Why | Action |
|---|------|-----|--------|
| 5 | **Deep link for password reset** | Reset link opens browser, not app | Add `app_links` (or equivalent), handle `voyagersanctuary://` and call `SupabaseService.client.auth.recoverSession(url)` so “Reset password” opens the app and completes flow |
| 6 | **Network failure docs** | “No address associated with hostname” confuses users | Add a short “Troubleshooting” section in README or SUPABASE_SETUP: require internet, try different network, check Supabase project not paused |
| 7 | **E2E tests for critical paths** | Only Whetstone has integration tests | Add integration tests for: (a) Auth → sign in → land on Sanctuary, (b) Scroll load + Architect flow (e.g. create boulder), (c) Satchel Pack → Hearth burn (if feasible with test account) |
| 8 | **Mallet integration test** | Phase 5 exit criteria | Implement and run integration test for full Mallet flow (toggle Architect, create boulder/pebble, split, metadata clone) |
| 9 | **Mark Phase 9 / 12 asset tasks done** | Plan still shows “Wire real background / Elias” unchecked | In PROJECT_PLAN Phase 9 and 12, check off “Wire real background Image.asset()” and “Wire real Elias Image.asset()” (assets are in place and wired) |

---

## 3. Polish & Phase 12 (optional, when time allows)

| # | Item | Notes |
|---|------|--------|
| 10 | Hearth burn/shatter animation tuning | Phase 12; improve feel of drop-to-burn |
| 11 | Satchel pack animation | Stones “flying into bag” |
| 12 | Scroll path polish, mallet cursor/shadow | Phase 12 |
| 13 | Elias idle (breathing/blink) | Phase 12 |
| 14 | Parallax / particles (e.g. campfire smoke) | Phase 12 |
| 15 | Typography & color formalized | Single source of truth for “Refined Architectural Luxury” palette |
| 16 | Haptics on key actions | Burn, split, pack |

---

## 4. Code & design observations

| # | Observation | Recommendation |
|---|--------------|----------------|
| 17 | **Untitled pebbles** | BUGS_DEFERRED notes “(untitled)” for unnamed pebbles in Satchel. When polishing Satchel, consider showing “(Unnamed task)” or prompting for name on pack. |
| 18 | **Satchel seed source** | Schema defines `seed_satchel_for_user(uuid)` but the signup trigger only creates a profile. The app currently upserts 6 empty slots (e.g. in repository) when needed. Either: (a) call `seed_satchel_for_user` from `ensure_profile()` so every user has 6 rows from signup, or (b) document that app-side seed on first Satchel/Scroll load is intentional. |
| 19 | **Icons’ black background** | Elias, mallet, and satchel assets are now displayed on `Colors.black` containers so the art’s black background is preserved. No further change needed unless you add new icon assets. |
| 20 | **No TODO/FIXME in lib** | Codebase is clean of stray TODOs; keep it that way by resolving or moving items to this doc or BUGS_DEFERRED. |
| 21 | **Error handling** | Auth and several screens already use friendly messages and SnackBars. Keep the same pattern for any new flows (e.g. deep link errors). |

---

## 5. Backend & ops

| # | Item | Recommendation |
|---|------|----------------|
| 22 | **Supabase Edge Functions** | Phase 1 lists them as optional (midnight sweep, priority query). Current design uses app-side midnight timer and repo queries; no change unless you want server-side guarantees. |
| 23 | **Supabase project limits / pause** | If project is paused or over free-tier limits, auth and DB stop. Document in README or SUPABASE_SETUP; consider paid plan if you need reliability for testers. |
| 24 | **Secrets** | Supabase URL/anon key via `--dart-define` or env; e2e credentials in `e2e_test.env` (gitignored). Rotate any keys that were ever committed or shared. |

---

## 6. Release path (Phase 14)

When you’re ready to ship:

- Run full [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) on a physical device (iOS + Android).
- Document edge cases (empty satchel, 0 mountains, first-time user).
- Performance: confirm 60fps on a mid-range device.
- App icons, splash screen, store listing assets.
- `flutter build appbundle` and `flutter build ipa`; submit to TestFlight and Google Play Internal Testing.

---

## 7. Summary checklist

- [ ] Git initialized, main + dev, first commit
- [ ] First Five tests run and results noted in PROJECT_PLAN
- [ ] RLS verified with two test accounts
- [ ] New-user satchel slots verified (or backend seed added)
- [ ] (Optional) Deep link for password reset
- [ ] (Optional) Network/troubleshooting docs
- [ ] (Optional) Extra E2E tests + Mallet integration test
- [ ] Phase 9/12 asset tasks marked done in PROJECT_PLAN
- [ ] Phase 14 when ready: QA, icons, store builds

**Verdict:** The app is MVP-complete. The items above are verification, hygiene, and optional polish so you can ship with confidence and a clear upgrade path.
