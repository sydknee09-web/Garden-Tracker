# Voyager Sanctuary — Project Audit

**Audit date:** March 2026  
**Scope:** Codebase, PROJECT_PLAN.md alignment, assets, tooling, and recent work.

---

## 1. Executive summary

The app is **MVP-complete** for core flows: auth, mountains (with trail UI), mallet hierarchy, satchel, hearth burn, whetstone habits, time-of-day + Elias with real art, and polish (Elias bubbles, friendly auth errors, forgot password). Backend is Supabase with LTREE, RLS, and profiles. Remaining work is mostly verification tests, optional polish, and release prep. Offline is deferred.

---

## 2. Plan vs actual

### Phases 0–4 (Environment, Schema, Data, State, Screens)

| Phase | Status | Notes |
|-------|--------|--------|
| 0 | ✅ Done | Git repo with main/dev not initialized (only open item). |
| 1 | ✅ Done | Schema in `docs/schema.sql`; profiles, mountains, nodes, satchel_slots, whetstone_*, RLS, trigger, ensure_profile. Edge Functions not implemented (optional). |
| 2 | ✅ Done | SupabaseService, Mountain/Node/Satchel/WhetstoneRepository; unit tests for priority, LTREE, midnight. |
| 3 | ✅ Done | TimeOfDay, Auth, MountainList, Node(mountainId), Satchel, Whetstone providers. |
| 4 | ✅ Done | Entrance, Sanctuary, ScrollMap, Satchel, Whetstone, ManagementMenuSheet, go_router, titles, breadcrumbs. |

### Phases 5–8 (Mallet, Satchel, Hearth, Whetstone)

| Phase | Status | Notes |
|-------|--------|--------|
| 5 | ✅ Done | Architect FAB, mallet → boulder/pebble/shard/split, metadata clone. Test #2 (star/due-date on split) and integration test not run/done. |
| 6 | ✅ Done | 6-slot UI, Pack from Elias, priority, no auto-refill, check-off, remove. Tests #3–#4 not run. |
| 7 | ✅ Done | HearthWidget DragTarget, burn animation, delete node, clear slot, progress bar. |
| 8 | ✅ Done | Whetstone checklist, Y/T/T slider, completions upsert, midnight timer, app resume. Test #5 not run. |

### Phases 9–11 (Time-of-day, Mountains, Auth)

| Phase | Status | Notes |
|-------|--------|--------|
| 9 | ✅ Done | ScenePeriod, TimeOfDayProvider, **real backgrounds** (sunrise/midday/dusk/night.jfif), **real Elias** (elias_dawn/midday/sunset/night.png), greetings. Test #1 not run. |
| 10 | ✅ Done | Add/rename/archive mountains, cap 3, archive recovery, progress bar, mountain trail visual (boulders/pebbles/shard waypoints). |
| 11 | ✅ Done | Email/password sign-in and sign-up, AuthScreen, auth guard, Settings + Sign Out. RLS isolation between users not formally verified. |

### Phase 12 (Polish)

| Item | Status |
|------|--------|
| Elias speech bubbles (tap, afterBurn, afterPack) | ✅ |
| Real background Image.asset() | ✅ (sunrise/midday/dusk/night.jfif) |
| Real Elias Image.asset() | ✅ (four PNGs) |
| Hearth/shatter tuning, satchel pack animation | ⬜ |
| Scroll path polish, mallet cursor/shadow | ⬜ |
| Elias idle, parallax/particles | ⬜ |
| Typography/color formalized, haptics | ⬜ |

### Phases 13–14

- **13 (Offline):** Deferred.
- **14 (QA & release):** Not started (First Five, device QA, store builds).

---

## 3. Work beyond the plan (this session)

- **Elias art:** Four time-of-day PNGs added and wired; silhouette fallback on load error.
- **Hammer + satchel art:** mallet.png, satchel_open.png, satchel_closed.png in assets and used in UI.
- **Asset generation pipeline:** `scripts/generate_assets.py` + `art_direction.yaml` for locked POV/style; Gemini/Imagen (optional); README and requirements.
- **Auth UX:** User-friendly error messages (network, invalid credentials, email not confirmed, etc.); **Forgot password?** on sign-in with `resetPasswordForEmail(redirectTo: voyagersanctuary://)`.
- **Supabase URL config:** Site URL / Redirect URLs set to `voyagersanctuary://` (no localhost); docs in AUTH_PASSWORD_RESET.md.
- **Static redirect page:** `static/index.html` + README for optional hosting (password reset/confirmation landing).
- **E2E test credentials:** `e2e_test.env` (gitignored), `e2e_test.env.example`, TESTING_CHECKLIST updated; test account documented.

---

## 4. Codebase health

- **Structure:** Clear split (core/, data/, features/, providers/, widgets/). Single Supabase config; user_id and RLS used consistently.
- **Assets:** Elias (4), mallet (1), satchel (2), backgrounds (4 .jfif). All referenced in code and in pubspec.
- **Tests:** Unit tests for repos/provider logic; one integration test (Whetstone add/check-off), skips when not signed in.
- **Docs:** PROJECT_PLAN.md, ARCHITECTURE.md, NAVIGATION_MAP.md, TESTING_CHECKLIST.md, AUTH_PASSWORD_RESET.md, SUPABASE_SETUP.md, BUGS_DEFERRED_TO_PHASE.md, static/README.md, scripts/README.md.

---

## 5. Gaps and risks

| Gap | Risk | Suggestion |
|-----|------|------------|
| Git repo not initialized (Phase 0) | No version history or branches | Initialize repo, main + dev, first commit. |
| First Five tests (Tests #1–#5) not run | Regressions possible | Run manually or automate; mark in plan when passed. |
| RLS not verified with two accounts | Data could leak between users | Sign in as two users, confirm each sees only own data. |
| Network/DNS failures on device | “No address associated with hostname” when Supabase unreachable | Document network requirements; consider optional offline later. |
| Supabase project paused or over limit | Auth and DB stop working | Monitor dashboard; consider paid tier if needed. |
| No deep link handling for voyagersanctuary:// | Reset link doesn’t open app automatically | Optional: add app_links + recoverSession for better UX. |

---

## 6. Asset and config checklist

| Asset / config | Location | Status |
|----------------|----------|--------|
| elias_dawn/midday/sunset/night.png | assets/elias/ | ✅ Present, wired |
| sunrise/midday/dusk/night.jfif | assets/backgrounds/ | ✅ Present, wired |
| mallet.png | assets/mallet/ | ✅ Present, wired |
| satchel_open.png, satchel_closed.png | assets/satchel/ | ✅ Present, wired |
| Supabase URL + anon key | lib/core/config/supabase_config.dart | ✅ Defaults set; override via --dart-define |
| Redirect URL (auth) | Supabase Dashboard | ✅ Set to voyagersanctuary:// |

---

## 7. Recommendations

1. **Version control:** Initialize Git, create main and dev, add and commit current state.
2. **Verification:** Run First Five tests on a device; confirm RLS with two test accounts; note results in PROJECT_PLAN.md.
3. **Build and install:** Use `flutter run` or `flutter build apk` + `flutter install` for device testing after changes.
4. **Optional polish:** Pick 1–2 Phase 12 items (e.g. haptics, hearth animation) before or after QA.
5. **Release path:** When ready, follow Phase 14 (icons, splash, appbundle/ipa, TestFlight/Play Internal).

---

## 8. Summary table

| Area | Done | Pending |
|------|------|--------|
| Backend (Supabase) | Schema, RLS, profiles, LTREE | Edge Functions (optional), RLS verification |
| App (screens & flows) | Auth, scroll, satchel, hearth, whetstone, management | — |
| Art & time-of-day | Elias (4), mallet, satchel, backgrounds (4) | — |
| Auth UX | Friendly errors, forgot password, redirect config | Deep link for reset (optional) |
| Tooling | generate_assets.py, static page, e2e env | — |
| Tests | Unit (repos), 1 integration (Whetstone) | First Five, mallet integration test |
| Docs | Plan, architecture, nav, testing, auth redirect, audit | — |
| Release | — | Phase 14 (QA, store builds) |

**Verdict:** Project is in good shape for MVP testing and for moving toward release once verification and (optional) polish are done.
