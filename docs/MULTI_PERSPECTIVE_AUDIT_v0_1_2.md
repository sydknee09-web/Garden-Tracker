# Multi-Perspective App Audit — Voyager Sanctuary v0.1.2+21

**Scope:** Findings originally written against **v0.1.2+19** (March 2026). **Document control** and **§ Resolution (post-audit)** updated for **v0.1.2+21**.  
**Purpose:** (1) Specialist/org findings for coordination & QA. (2) **User archetypes (Part B).** (3) **Digital literacy levels (Part C §1).** (4) **User intentions — why they use the app (Part C §2).**

---

## Summary matrix (specialists 1–20)

| # | Specialist | Org | Primary gap / focus | When needed | Audit verdict (baseline **+19**) |
|---|------------|-----|---------------------|-------------|---------------------------|
| 1 | Product Visionary | You | Vision, tone, philosophy | Active | **Strong** docs; **tension** intro vs `SKIP_AUTH` demo |
| 2 | Flutter Developer | Cursor | Code, features, build | Active | **Solid** stack; signing + script drift |
| 3 | Strategy / Architect | Claude | Audit, specs, handoff | Active | **Canonical** `MASTER_PLAN` + `AGENTS.md` |
| 4 | PM / Coordinator | — | Timeline, tester feedback | After v0.1.2 ships | Checklist vs `deploy.ps1`; no feedback template |
| 5 | QA Engineer | — | Systematic testing, edge cases | v0.1.3 | Unit thin; integration device-bound |
| 6 | Tester / Beta User | You | Real-world validation | Active | Demo APK must use `SKIP_AUTH` / `-DemoMode` |
| 7 | Data Architect | — | Supabase schema, performance | If schema changes | Migrations + RLS; connection vs demo doc gap |
| 8 | Mobile QA Specialist | — | Device fragmentation, Android/iOS | Wider beta | Android-first; debug release signing |
| 9 | UX / UI Designer | — | Visual consistency, accessibility | If polish needed | Semantics partial; no WCAG sign-off |
| 10 | DevOps / CI-CD | — | Build, distribute, automation | — | Firebase manual; **no CI** in repo |
| 11 | Security Officer | Legal | GDPR/CCPA, encryption | **Before wider beta** | Privacy **docs** strong; **DPA/subprocessors**, consent UX TBD |
| 12 | UX Researcher | Product | Behavior data, retention metrics | **Next week** | **No** in-app research hooks; no funnel metrics |
| 13 | Content Strategist | Product | Tone guide, dialogue audit, copy | **Next week** | Tone in `MASTER_PLAN` + `ELIAS_DIALOGUE_REFERENCE`; **no** single tone guide |
| 14 | Community Manager | Support | Support channel, FAQ, bug triage | **Next week** | **No** in-app FAQ/support link; privacy placeholder email |
| 15 | Monetization Lead | Business | Revenue, pricing, sustainability | **Month 2** | **No** paywall, IAP, or subscription code paths |
| 16 | Localization Engineer | Engineering | i18n, RTL, timezones | **Month 3** (if expanding) | **`intl`** only for formatting; strings **not** ARB/`l10n` |
| 17 | Performance Engineer | Engineering | Speed, memory, caching, CDN | **Month 3** | No perf budget doc; assets local; profile TBD |
| 18 | Analytics Engineer | Data | Telemetry, dashboards, retention | **Before wider beta** | **firebase_core** only; **no** Analytics/Crashlytics in `pubspec` |
| 19 | Accessibility Expert | Product | WCAG AA, screen readers | **Before wider beta** | Partial **Semantics**; **no** formal WCAG audit |
| 20 | Design System Manager | Design | Brand consistency, component library | **Month 3** | **MASTER_PLAN** palette; **no** shared component catalog in repo |

---

## Summary matrix (user archetypes 1–7)

*Your model: how strongly each archetype **needs** grace-day design, journal depth, and whether they’re likely to **pay**; **LTV** is a planning band, not a forecast.*

| # | Archetype | Core need | Grace day (need) | Journal (need) | Pays? | LTV (planning band) | Fit vs v0.1.2+19 |
|---|-----------|-----------|------------------|------------------|-------|---------------------|------------------|
| 1 | **Goal-Setter** | Meaning-making | High | High | Medium | $2–5 | **Strong** — mountains/peaks + optional reflections + Elias tone align |
| 2 | **Habit-Builder** | Consistency | Critical | Low | Low | $1–3 | **Strong** on Whetstone + streak; **risk** if grace rules feel arbitrary |
| 3 | **Reflective** | Self-discovery | Medium | **Very High** | High | $4–10 | **Strong** on journal optional UX; **gap** — no long-form history / review surface |
| 4 | **Busy Manager** | Simplicity | Critical | None | Low | $1–2 | **Mixed** — metaphor-rich UI may read as **noise**; fast path unclear |
| 5 | **Creative** | Flexibility | **Very High** | Medium | None | $0 | **Mixed** — structure is real; **undo** + draft peaks help; may chafe at leaf/pack rules |
| 6 | **Skeptical Minimalist** | Ethics / trust | Medium | Medium | High | $5–10 | **Strong** on privacy docs + no ads; **must** prove data story in-app (Settings link) |
| 7 | **Accountability Seeker** | Witness | Med–High | Medium | Medium | $2–5 | **Strong** — Elias + streak + ring = progress witness; **gap** — no social/sharing witness |

---

## Summary matrix — Dimension 1: Digital literacy / comfort

| Level | Label | Age (your model) | Profile | v0.1.2 **risk** | Key need | Fit vs v0.1.2+19 |
|-------|--------|------------------|---------|-----------------|----------|------------------|
| **1** | **Reluctant** | 45–70 | Scared of breaking things; minimal apps | **High** | Phone support, **clear guidance** | **Weak** — metaphor stack + drag/pack/burn = **high fear surface**; tooltip grace is hidden |
| **2** | **Comfortable** | 25–60 | 10–20 apps; finds Settings; self-serves | **Low** | Intuitive UI, **minimal friction** | **Strong** — Riverpod/go_router consistent; undo reduces fear |
| **3** | **Native** | 18–45 | 50+ apps; early adopter; wants **exports** | **Moderate** | Data export, API, customization | **Weak** — **no** user-facing export; no public API hooks in app |
| **4** | **Professional** | 25–40 | Devs; inspect code; **security-conscious** | **High** | Open source, privacy, **GitHub** | **Mixed** — privacy **docs** + no analytics SDK align; **no** OSS repo link in product; signing keys still debug for release |

---

## Summary matrix — Dimension 2: User intentions (WHY)

| # | Intention | Time / week | Approach | **Churn risk** | Journal use (your model) | Revenue (planning) | Fit vs v0.1.2+19 |
|---|-----------|-------------|----------|----------------|----------------------------|--------------------|------------------|
| **1** | **Committed Goal-Seeker** | 30+ min | Serious; won’t quit | **Low** | ~20%+ | $2–5/mo | **Strong** — depth of mountain flow + ring + Elias rewards sustained use |
| **2** | **Habit Optimizer** | ~5 min/day | Pragmatic; wants **evidence** | **Medium** | under 5% | $1–3/mo | **Strong** Whetstone path; **risk** if Sanctuary metaphor slows “check off and leave” |
| **3** | **Self-Discovery** | 10–20 min | Reflective | **Low** | 30–50% | $4–10/mo | **Strong** optional journal; **gap** — read-back / export for heavy journalers |
| **4** | **Skeptical Experimenter** | 5–10 min | Analytical; wants **proof** | **Very high** | ~0% | $0–5/mo | **Mixed** — demo build helps try-before-trust; **no** in-app “proof” hub (privacy, data flow) |
| **5** | **Emergency Grabber** | 20–30 min (**week 1** spike) | Desperate; needs accountability | **Extreme** | ~10%+ | $0/mo | **Risky** — rich onboarding may feel **slow**; needs **fast “one goal + one action”** path; $0 revenue = support burden |

*Journal % = expected adoption band for reflection features, not measured in-app.*

---

## 1 — Product Visionary (vision, tone, philosophy)

### Strengths
- **North Star** and **Sanctuary DNA** are explicit: cozy, Japandi, ritual over task list, no guilt, Elias as guide (`docs/MASTER_PLAN.md`, `docs/VISION_AND_AUTOMATION.md` referenced from `AGENTS.md`).
- **Tone guardrails** are operationalized in copy pools and recent polish (grace tooltip, optional journal hints, less “wellness app” cheeriness — per release notes / `elias_dialogue.dart` trajectory).
- **Metaphor consistency** (Mountain → Boulder → Pebble/Stone, Satchel, Hearth) is documented and enforced in agent rules.

### Findings / risks
- **Canonical entry:** MASTER_PLAN states first-time users must **not** land straight on Sanctuary; must see Intro. **`SKIP_AUTH=true`** (demo/tester distribution) **intentionally bypasses** that — correct for testers, but **not** representative of the shipped “real user” philosophy. Communicate that clearly in tester briefings.
- **Forest Threshold / cinematic cold start** vs **connection error screen** — the latter is utilitarian (wifi icon, Retry only). Acceptable for errors, but slightly off-brand vs “no harsh techy contrast.”
- **`traveler` fallback** for display name is specified in `AGENTS.md` and `TESTING_CHECKLIST.md` — good alignment with inclusive tone.

### Recommendations
- Keep a one-line **“demo build ≠ first-run product contract”** in every Firebase release note for `SKIP_AUTH` builds.
- Optional v0.1.3: soften connection-error screen (parchment, gentler copy) to match Forest Threshold language without adding noise.

---

## 2 — Flutter Developer (code, features, build)

### Strengths
- **Stack** matches plan: Flutter, **Riverpod**, **go_router**, Supabase client.
- **Dual data path:** `lib/providers/repository_providers.dart` switches `Demo*` vs real repositories via `demoModeProvider`; demo storage in `lib/data/demo/`.
- **Bootstrap** (`lib/bootstrap.dart`): idempotent init, timeout handling, `Supabase.initialize` with retry; clear separation when `kSkipAuthForTesting`.
- **Feature areas** are feature-folder structured (`features/sanctuary`, `scroll_map`, `satchel`, `whetstone`, etc.).
- **Version** pinned in `pubspec.yaml` (`0.1.2+19`).

### Findings / risks
- **Android release signing:** `android/app/build.gradle.kts` uses **debug signing for `release`** with an explicit TODO — fine for **internal/Firebase** distribution, **not** for Play Store without change.
- **`flutter clean`** on Windows can fail to delete `.dart_tool` if another process locks it — builds may still succeed; document for devs.
- **Hierarchy naming:** `AGENTS.md` states **Mountain > Trail > Boulder > Stone**; some UI/docs use **Peak / Boulder / Pebble / Shard** — not a bug, but **onboarding copy** must stay consistent for users.

### Recommendations
- Before store submission: **upload keystore + signingConfigs.release**.
- Add `README` snippet: `deploy.ps1 -DemoMode` vs plain `deploy.ps1`.

---

## 3 — Strategy / Architect (audit, specs, handoff)

### Strengths
- **Single canonical plan:** `docs/MASTER_PLAN.md` with phased work, migrations index, Logic & Leaf spec.
- **Agent contract:** `AGENTS.md` + vision doc pointer — strong handoff for AI and humans.
- **Database evolution:** numbered migrations under `supabase/migrations/` (profiles, RLS, packable RPCs, whetstone, reflections, streak functions, etc.).

### Findings
- **Multiple “derived” plans** mentioned in MASTER_PLAN — risk of **stale duplicates** if not consolidated when scope changes.
- **Demo vs production** behavior is split across `bootstrap.dart`, `supabase_config.dart` (`SKIP_AUTH`), and `demo_mode.dart` (`loadDemoMode` / `setDemoMode`) — architects should treat **three concepts**: (a) compile-time skip auth, (b) runtime demo flag, (c) persisted demo preference. Not all paths are equally exercised (see §7).

### Recommendations
- For v0.1.3: one **architecture note** (`docs/ARCHITECTURE_RUNTIME_MODES.md`) diagramming auth, demo, and Supabase init.

---

## 4 — PM / Coordinator (timeline, tester feedback)

### Strengths
- **TESTING_CHECKLIST** is detailed: First Five, gatekeepers, draft peaks, RLS, display name.
- **Firebase App Distribution** workflow documented in spirit (tester group `testers` in `deploy.ps1`).

### Findings / gaps
- **Script path drift:** `docs/TESTING_CHECKLIST.md` references `scripts/deploy_android.ps1` / `.sh`; repo primary script is **`deploy.ps1`** at project root with `-DemoMode` / `-Clean`. PMs should **standardize** on one command in checklist.
- **First Five / success log tables** are templates — no automation to ensure they’re filled before ship.
- **Tester feedback** has no in-repo template (e.g. `docs/TESTER_FEEDBACK_TEMPLATE.md`) — optional but helps v0.1.3 triage.

### Recommendations
- Update checklist § deploy instructions to:  
  `.\deploy.ps1 -DemoMode -ReleaseNotes "..."` and note `-Clean` optional.
- Add a **short feedback form** link or markdown template for beta.

---

## 5 — QA Engineer (systematic testing, edge cases)

### Strengths
- **Automated unit tests:** `test/data_layer_test.dart`, `provider_test.dart`, `time_of_day_test.dart`, `widget_test.dart` — cover LTREE paths, sort rules, satchel/whetstone state, scene periods.
- **Integration tests:** `integration_test/` includes mallet flow, whetstone flow, synthetic user journeys — **require device/emulator** per TESTING_CHECKLIST.
- **Manual gatekeepers** are explicit (display name, shard completion, RLS, satchel verify).

### Findings / gaps
- **Coverage:** No broad widget/golden tests for Sanctuary, burn flow, or map ring — regression risk on UI-heavy features.
- **Edge cases** called out in audits (e.g. streak grace vs calendar-day spec, stacked haptics) should be **test cases** in TESTING_CHECKLIST or a QA spreadsheet — not all are encoded in automated tests.
- **Demo mode:** automated tests may use `SKIP_AUTH` paths — ensure **release + demo** both get a smoke pass before Firebase.

### Recommendations
- v0.1.3: add **checklist section** “Demo APK smoke (SKIP_AUTH)” mirroring production smoke.
- Run `flutter test integration_test -d <id>` on a schedule or before each RC.

---

## 6 — Tester / Beta User (real-world validation)

### Strengths
- **Clear feature list** for v0.1.2: streak/grace, undo, haptics, ring, empty states, Elias, journal.
- **Demo build** enables exploration without accounts when built with **`SKIP_AUTH=true`**.

### Findings
- **Wrong APK = wrong experience:** Standard `flutter build apk --release` **without** dart-define shows **login / entrance** — testers may report “bug: still asks for login.”
- **Data lifetime:** In-memory demo resets on process kill — **expected**; must be in every tester note.
- **Undo** is on **Sanctuary** (burn) and **Whetstone** (habit), not Satchel — testers should be told to avoid false defects.
- **Tooltip / grace:** Long-press or hover on streak chip — **Android TalkBack / long-press** behavior may confuse some users; worth watching in feedback.

### Recommendations
- Ship **release notes** that state: build flavor (demo vs production), `applicationId`, and “reinstall if stale.”
- **applicationId** for uninstall: `com.voyagersanctuary.voyager_sanctuary` (from `android/app/build.gradle.kts`).

---

## 7 — Data Architect (Supabase schema, performance)

### Strengths
- **Migrations** under `supabase/migrations/` cover profiles, RLS, nodes, packable candidates, peak progress, whetstone, streak SQL, mountain reflections.
- **App repositories** filter by **`user_id`** (e.g. `node_repository`, `satchel_repository`) — aligns with `AGENTS.md` RLS expectations.
- **LTREE** and RPCs documented in MASTER_PLAN / migration comments.

### Findings
- **Demo mode** skips Supabase initialization in bootstrap when `SKIP_AUTH` — **no server load**, **no RLS verification** on that build.
- **`loadDemoMode()`** / SharedPreferences persistence exists in `lib/core/config/demo_mode.dart`, but **normal production bootstrap** forces `isDemoMode = false` without loading prefs first — **architects should verify** whether “persisted demo after connection failure” is still a product requirement; `docs/DEMO_MODE_TESTING.md` mentions **“Use offline (Demo Mode)”** on connection error, while **`_ConnectionErrorScreen`** currently only offers **Retry** — **spec vs implementation gap**.

### Recommendations
- Either **add** offline demo entry on connection screen **or** update `DEMO_MODE_TESTING.md` to match reality.
- Before new schema work: diff migrations vs production Supabase (drift check).

---

## 8 — Mobile QA Specialist (fragmentation, Android / iOS)

### Strengths
- **Flutter** single codebase for iOS + Android.
- **Haptics** and **audio** are implemented with platform-aware expectations (device may mute or not vibrate).

### Findings
- **Primary validation** in docs and Firebase flow is **Android APK**.
- **Release signing:** debug keystore — fine for internal; **not** production store signal.
- **minSdk / targetSdk** delegated to Flutter defaults — confirm against Play requirements periodically.
- **iOS:** Not audited in this document; **wider beta** should add TestFlight checklist (permissions, background audio, haptics differences).
- **Screen sizes / tablets:** Not explicitly called out in docs — map and drag-drop flows are high-risk on small or unusual aspect ratios.

### Recommendations
- Maintain a **device matrix** (3–5 Android versions + one iPhone) for v0.1.3.
- Test **tooltip / streak chip** on Samsung + Pixel + one low-end device.

---

## 9 — UX / UI Designer (visual consistency, accessibility)

### Strengths
- **Design system** direction in MASTER_PLAN (palette, avoid pure grey/white, parchment metaphors).
- **Semantics:** `Semantics` / `ExcludeSemantics` used in `sanctuary_screen`, `satchel_screen`, `climb_flow_overlay`, `waiting_pulse` — aligns with `AGENTS.md` (decorative excluded, controls labeled).
- **Loading:** Waiting pulse pattern referenced in agent rules.

### Findings
- **Accessibility audit** not complete in repo — no statement of **contrast ratios** or **font scaling** limits (e.g. `textScaleFactor` overflow on Elias bubbles).
- **Connection error** screen is functional but **less Japandi** than Sanctuary chrome.
- **Tooltip** for grace day is discoverability-sensitive — design may want a **visible affordance** beyond small info icon on some themes.

### Recommendations
- v0.1.3: one pass with **TalkBack** on burn + pack + map ring.
- Optional: **design token** file or `AppTheme` comment block listing approved hex values (MASTER_PLAN already lists many).

---

## 10 — DevOps / CI-CD

### Strengths
- **`deploy.ps1`:** Parameters `-ReleaseNotes`, `-DemoMode`, `-Clean`; runs `flutter build apk` then `firebase appdistribution:distribute` with `--groups "testers"`.
- **Firebase** project ID embedded for distribution (see script).

### Findings
- **No CI config** found in-repo (e.g. no GitHub Actions / GitLab CI under searched paths) — **builds and uploads are local/manual**.
- **Firebase “24h availability”** is **not** a standard App Distribution constraint — releases persist until replaced; correct external comms to avoid confusion.
- **Secrets:** Supabase keys use `fromEnvironment` with defaults in `supabase_config.dart` — **DevOps** should ensure **production** builds use CI-injected defines if keys rotate; avoid relying on embedded defaults for long-term ops.

### Recommendations
- Add **minimal CI:** `flutter analyze` + `flutter test` on push (no device).
- Optional: **artifact** upload (APK) to storage with version tag from `pubspec.yaml`.

---

## 11 — Security Officer (Legal: GDPR/CCPA, encryption)

**When needed:** Before wider beta.

### Strengths
- **`docs/DATA_SAFETY_AND_PRIVACY.md`** and **`docs/LEGAL.md`** give store-oriented framing: RLS, encryption in transit, no third-party sale, account deletion from Settings (as stated for questionnaires).
- **`AGENTS.md`** explicitly avoids logging PII/tokens; repositories scope by `user_id` with Supabase RLS expectations.

### Findings / gaps
- **Regulatory completeness:** GDPR/CCPA need **lawyer-reviewed** privacy policy, **subprocessor list** (Supabase, Firebase), retention periods, and (if applicable) **DPA** — docs are a **draft starting point**, not compliance sign-off.
- **Contact placeholder:** Privacy draft still says *“contact [your support email]”* — must be real before public beta.
- **`SKIP_AUTH` demo builds:** Testers bypass auth; ensure demo APKs are **not** confused with production privacy posture in comms (no account ≠ no policy story for real users).
- **Encryption:** TLS + Supabase at-rest is documented; **local** data (SharedPreferences, draft peaks) is not called out in store copy — worth one sentence for accuracy.

### Recommendations
- Engage counsel for **GDPR/CCPA** checklist before scaling testers beyond trusted circle.
- Publish **Privacy + Terms** at stable URLs; link from app Settings before store submission.

---

## 12 — UX Researcher (Product: behavior, retention)

**When needed:** Next week.

### Strengths
- **Qualitative direction** is clear in vision docs (ritual, first 60 seconds, moments of truth).
- **Manual testing** checklists define success scenarios (First Five, gatekeepers).

### Findings / gaps
- **No behavioral instrumentation** in codebase for funnels (intro completion, first burn, D7 return).
- **No** structured **retention metrics** definition (WAU/MAU, habit adherence) tied to product events.
- **Tester feedback** is ad hoc — no standard survey or session protocol in repo.

### Recommendations
- Define **3–5 research questions** for v0.1.3 (e.g. grace-day comprehension, journal friction).
- Pair with §18 if product accepts privacy-reviewed **minimal event schema** (see Analytics Engineer).

---

## 13 — Content Strategist (Product: tone guide, dialogue audit, copy)

**When needed:** Next week.

### Strengths
- **`docs/MASTER_PLAN.md`** § Tone and **Sanctuary DNA** are explicit (guide not coach, no guilt).
- **`docs/ELIAS_DIALOGUE_REFERENCE.md`** and `lib/core/content/elias_dialogue.dart` centralize Elias lines; v0.1.2 polish addressed “wellness cheer” drift.
- **Empty states** and **CTAs** are metaphor-aligned per feature work.

### Findings / gaps
- **No single “Tone & Microcopy” guide** (voice rules, words to avoid, examples per surface) — strategists must mine multiple docs + code.
- **Unused / orphaned strings** risk: dialogue pools may not all be wired; periodic **audit** against UI triggers is manual.
- **Inconsistent naming** (Trail vs Peak vs Mountain) across agent spec vs UI — content strategist should own **glossary**.

### Recommendations
- Add **`docs/TONE_AND_COPY_GUIDE.md`** (1–2 pages): voice, Elias rules, CTA patterns, glossary.
- Schedule **dialogue audit** after each release (grep pools vs call sites).

---

## 14 — Community Manager (Support: channel, FAQ, bug triage)

**When needed:** Next week.

### Strengths
- **Firebase App Distribution** gives a channel to push builds to `testers` group.
- **TESTING_CHECKLIST** educates on what “working” means.

### Findings / gaps
- **No** dedicated **support email**, Discord, or **in-app “Help / FAQ”** entry surfaced in audit pass.
- **Bug triage** template (severity, repro, build number, demo vs prod) not in repo.
- **Known limitations** (demo data loss, undo location) should live in **FAQ** to reduce duplicate reports.

### Recommendations
- Create **`docs/FAQ_AND_SUPPORT.md`** + link from Settings when ready.
- Use a **single feedback inbox** or form; train triage on `applicationId` + version from `pubspec.yaml`.

---

## 15 — Monetization Lead (Business: revenue, pricing, sustainability)

**When needed:** Month 2.

### Strengths
- Product scope is **experience-first**; no premature paywalls conflicting with “sanctuary” positioning.

### Findings / gaps
- **No** IAP, subscription, ads, or entitlements in `pubspec.yaml` or audited architecture.
- **Data Safety** doc currently aligns with **no ads / no analytics SDKs** — any monetization that shares data requires **revising** disclosures.

### Recommendations
- When model is chosen, run **privacy + store disclosure** updates in same release as code.
- Keep **free ritual core** as a design constraint if brand promises “no corporate tracker feel.”

---

## 16 — Localization Engineer (Engineering: i18n, RTL, timezones)

**When needed:** Month 3 (if expanding).

### Strengths
- **`intl`** package present; **date/time** logic documented in `docs/ARCHITECTURE.md` (midnight sweep, day slider).
- Flutter stack supports **`flutter gen-l10n`** when you adopt it.

### Findings / gaps
- **No** `.arb` / generated `l10n`; UI strings are **inline** in widgets — high cost to translate.
- **RTL** layout and mirrored assets **not** validated.
- **Timezones:** streak “4 AM boundary” and calendar semantics need **locale/timezone test matrix** when you go global.

### Recommendations
- Before first locale: extract strings; enable **`generate: true`** + ARB workflow.
- Add **RTL** snapshot tests for Satchel + map when targeting Arabic/Hebrew markets.

---

## 17 — Performance Engineer (Engineering: speed, memory, caching, CDN)

**When needed:** Month 3.

### Strengths
- **Local assets** (images/audio) — predictable latency; no CDN dependency for core art.
- **Riverpod** allows scoped rebuilds; no obvious “god provider” from high-level audit.

### Findings / gaps
- **No** documented **performance budget** (frame time, APK size ceiling, memory on low-RAM devices).
- **APK ~74MB** — acceptable for internal; investigate **asset compression** before store if needed.
- **Caching strategy** for Supabase reads not documented (stale-while-revalidate, offline cache).

### Recommendations
- Profile **Sanctuary + map + climb overlay** on a **low-end Android** device; log jank with Flutter DevTools.
- Document **cold start** target (Forest Threshold + init timeout already in bootstrap).

---

## 18 — Analytics Engineer (Data: telemetry, dashboards, retention)

**When needed:** Before wider beta.

### Strengths
- **`docs/HEALTH_AND_IMPROVEMENTS.md`** acknowledges **crash reporting** (e.g. Sentry, Crashlytics) as future work with PII caution.
- **`DATA_SAFETY_AND_PRIVACY.md`** currently states **no analytics SDKs** — honest baseline.

### Findings / gaps
- **`pubspec.yaml`:** **`firebase_core`** only; **no** `firebase_analytics`, **Crashlytics**, or **Sentry**.
- **No** event taxonomy, BigQuery export, or dashboard spec in repo.
- Adding analytics **requires** updating Privacy Policy + Play/App Store answers (contradicts “no analytics” line today).

### Recommendations
- If instrumenting before wider beta: define **minimal schema** (screen views + 5–10 key events), **opt-in** where required, and update **DATA_SAFETY_AND_PRIVACY.md** in the same PR.
- Prefer **privacy-preserving** defaults (no raw goal titles in event payloads).

---

## 19 — Accessibility Expert (Product: WCAG AA, screen readers)

**When needed:** Before wider beta.

### Strengths
- **`AGENTS.md`** requires meaningful **Semantics**, **ExcludeSemantics** on decorative effects, loading pattern consistency.
- **Implemented:** `Semantics` / `ExcludeSemantics` in `sanctuary_screen`, `satchel_screen`, `climb_flow_overlay`, `waiting_pulse` (non-exhaustive).

### Findings / gaps
- **No WCAG 2.x AA audit** or VPAT-style record in repo.
- **Contrast, focus order, touch targets, dynamic type** not systematically verified.
- **Tooltip-based** grace explanation may be **poorly exposed** to screen readers on some platforms — expert review needed.

### Recommendations
- Run **TalkBack** + **VoiceOver** pass on: auth (prod build), pack, burn, undo SnackBar, settings.
- File issues for **any control without semantic label** found in audit.

---

## 20 — Design System Manager (Design: brand consistency, component library)

**When needed:** Month 3.

### Strengths
- **`MASTER_PLAN`** defines palette philosophy, materials, and anti-patterns (grey/white bans).
- **`AppTheme`** / shared constants (`AppColors`, etc.) centralize some visual decisions.

### Findings / gaps
- **No** Figma ↔ code **component library** doc or Storybook-style catalog in repo.
- **Elias art** mix (multiple assets) risks **visual inconsistency** across screens — noted in prior release audits.
- **Connection error** vs **Sanctuary** chrome mismatch (§1, §9) is a **system** gap.

### Recommendations
- Define **tier-1 components** (buttons, parchment panels, streak chip, dialogue bubble) with **token** names.
- One **visual regression** pass per release on key screens (Sanctuary, Map, Satchel).

---

## Part B — User archetype audit (v0.1.2+19)

*Below: product fit, not implementation tickets. “Grace” = streak grace + 4 AM boundary + tooltip; “Journal” = climb/peak reflections (optional).*

### A1 — Goal-Setter (meaning-making · grace High · journal High · pays Medium · LTV $2–5)

**Core need vs product:** Hierarchy (mountain → milestones → tasks) supports **narrative goals**, not just lists. Elias as guide reinforces meaning without corporate OKR tone.

**Strengths in build:** Peak/journey flow, optional reflection copy (“what this peak represents”), progress ring = tangible progress story.

**Gaps / risks:** Meaning is **front-loaded** in creation; few prompts **after** burn (“what shifted?”) beyond dialogue pools. High journal need may outgrow single optional fields.

**Recommendations:** v0.1.3+ consider **one** lightweight “after burn” reflection prompt (skippable) or deepen Chronicled Peaks with intent snippets.

---

### A2 — Habit-Builder (consistency · grace **Critical** · journal Low · pays Low · LTV $1–3)

**Core need vs product:** Whetstone + streak + haptics reward **repeat behavior**. Undo window supports “oops” without breaking chain psychology.

**Strengths in build:** Daily habits, completions, streak chip, 4s undo on habit complete.

**Gaps / risks:** **Critical** grace need: if users don’t **discover** tooltip or misunderstand calendar vs 4 AM, trust in “fair” streaks drops. Habit-builder may **ignore** mountain/journal entirely — ensure Whetstone empty states and streak copy are **crystal clear**.

**Recommendations:** Onboarding micro-copy for grace; consider **one-line** streak rule the first time streak reaches 2+ (not only tooltip).

---

### A3 — Reflective (self-discovery · grace Medium · journal **Very High** · pays High · LTV $4–10)

**Core need vs product:** Optional journal reduces friction; Elias framing supports introspection.

**Strengths in build:** “(optional)” hints, Tell Elias / reflection steps in climb flow; tone polish away from cheerleader voice.

**Gaps / risks:** **Very High** journal need implies **browsing/editing** past reflections, search, or export — not a focus of v0.1.2. Self-discovery users may want **private rereading**, not one-off fields.

**Recommendations:** Roadmap item: **reflections timeline** on mountain detail or dedicated “Chronicle” surface; respect privacy (no sharing by default).

---

### A4 — Busy Manager (simplicity · grace Critical · journal None · pays Low · LTV $1–2)

**Core need vs product:** Wants **few screens, plain language**. Current app is metaphor-dense (Satchel, Hearth, Scroll) — high cognitive load for this archetype.

**Strengths in build:** Undo reduces fear of mistakes; empty states give a single CTA path.

**Gaps / risks:** **Critical** simplicity need conflicts with **ritual UX**. Journal **None** — good (optional), but **too many taps** to pack/burn may cause drop-off.

**Recommendations:** Optional **“plain labels”** or tooltips that map metaphor → task (“Pack = add to today’s list”); or a **compact mode** later. Not v0.1.3 blocker if audience skews ritual-first.

---

### A5 — Creative (flexibility · grace **Very High** · journal Medium · pays None · LTV $0)

**Core need vs product:** Wants freedom to reorganize, try paths, break things safely. **Undo** + draft peaks support experimentation.

**Strengths in build:** Hammer/split, mallet, undo snackbars, draft persistence for peaks.

**Gaps / risks:** **Very High** grace need: Logic & Leaf rules (only leaves pack/burn) can feel **rigid** to creatives. **Pays None** in your model — acquisition/voice may come from this segment anyway (word of mouth).

**Recommendations:** Surface **why** a node can’t pack in **one friendly line** (not only Elias nag). Consider “reorder / reparent” if feedback demands flexibility.

---

### A6 — Skeptical Minimalist (ethics/trust · grace Medium · journal Medium · pays High · LTV $5–10)

**Core need vs product:** Trust > features. Clear data boundary, no dark patterns, no surprise tracking.

**Strengths in build:** **`DATA_SAFETY_AND_PRIVACY.md`** + RLS story; **no** analytics SDK in `pubspec` (matches “no tracking” claim). Demo mode avoids account for try-before-trust.

**Gaps / risks:** Trust is **won in-app**: Settings should surface **Privacy** link, deletion path, and “what we collect” **before** wider beta. **Medium** journal need: they’ll read reflection prompts for manipulation — keep **optional** and non-guilt.

**Recommendations:** In-app **Privacy & data** row linking to hosted policy; align copy with §11 Security audit.

---

### A7 — Accountability Seeker (witness · grace Med–High · journal Medium · pays Medium · LTV $2–5)

**Core need vs product:** Something **sees** effort — Elias, streak, ring, milestone dialogue = internal witness. Not necessarily social.

**Strengths in build:** Context-aware Elias, streak milestone lines, map ring X/Y, haptic “weight” of burn.

**Gaps / risks:** No **external** accountability (partner, coach, share card). **Med–High** grace: broken streak messaging must stay **empathetic** (setback tone in tester brief).

**Recommendations:** Later: optional **share progress** (image/card) without exposing private titles; for now, strengthen **Elias setback** pool consistency.

---

### Archetype → v0.1.3 priority hints

| Archetype | Top follow-ups |
|-----------|----------------|
| A2, A4, A5 | Grace **discoverability** + simplicity path |
| A3, A1 | Journal **read-back** or post-completion meaning |
| A6 | In-app **privacy link** + trust chrome |
| A7 | Setback tone + optional future **share/witness** |
| A4 | Metaphor **translation** (plain language layer) |

---

## Part C — Literacy & intention lenses (v0.1.2+19)

### C1 — Digital literacy levels (DIMENSION 1)

#### L1 — Reluctant (45–70) · v0.1.2 risk **High**

**What they need:** Reassurance, few decisions, visible back/undo, human support.

**Audit:** The app is **ritual-first** (Scroll, Satchel, Hearth, pack vs burn). That is **cognitively expensive** for users who fear “breaking” software. **Long-press tooltip** for grace is **non-discoverable** for this segment. Connection error screen is binary (Retry) — no warm “what happened?” copy.

**Recommendations:** Priority **FAQ + optional video or PDF “first journey”** for wider beta; in-app **?** or **Help** with 5 steps: create peak → pack → mark done → burn. Consider **larger tap targets** and **explicit confirmations** on destructive actions (some already mitigated by undo). **Phone support** is operational, not code — document a **support number/hours** before marketing to L1.

---

#### L2 — Comfortable (25–60) · v0.1.2 risk **Low**

**What they need:** Obvious navigation, Settings, predictable patterns.

**Audit:** **go_router** + tab/shell patterns; Settings and profile flows exist in product scope. **Undo snackbars** reduce anxiety. Friction is mostly **learning the metaphor once**, not raw UI bugs.

**Recommendations:** Keep **empty states** as the teaching surface (already warm CTAs). Optional: **Settings → “How the Sanctuary works”** one-pager.

---

#### L3 — Native (18–45) · v0.1.2 risk **Moderate**

**What they need:** **Export**, portability, maybe automation.

**Audit:** Data lives in **Supabase** (user-owned, RLS). App has **no** “Export my data” (JSON/CSV) or calendar sync in audited scope. **intl** only — not full i18n. Customization is **appearance**-oriented, not behavior scripts.

**Recommendations:** Before promising to this cohort: **GDPR-style export** (even minimal: mountains + nodes JSON) + roadmap post. **API** = Supabase-backed; public developer API is a **business** decision, not v0.1.3 default.

---

#### L4 — Professional (25–40) · v0.1.2 risk **High**

**What they need:** **Privacy verifiability**, open posture, no dark patterns, reproducible builds.

**Audit:** **Strength:** No analytics SDK; privacy draft aligns. **Gaps:** App not **open source** in-repo as product promise; **release APK signs with debug keystore** — professionals will notice in Play-internal testing. No **Security.txt** / bug bounty in scope.

**Recommendations:** Link **Privacy Policy** + **source** stance (even “closed beta, OSS TBD”) in Settings. Move to **release signing** before “Professional” marketing. If OSS is planned, say **where** (GitHub org) on website.

---

### C2 — User intentions (DIMENSION 2)

#### I1 — Committed Goal-Seeker (30+ min/wk · churn Low · journal ~20%+ · $2–5/mo)

**Audit:** Product depth (hierarchy, ring, streaks, Elias) **matches** long sessions. Journal adoption moderate — optional fields won’t block them.

**Recommendations:** Double down on **milestone celebration** and **long-arc** copy; avoid dumbing down core loop.

---

#### I2 — Habit Optimizer (~5 min/day · churn Medium · journal under 5% · $1–3/mo)

**Audit:** **Whetstone** is the right surface; **risk** is **navigation cost** from Sanctuary to habits and back. Evidence = streak + completions; **grace** must feel **fair** or they churn analytically.

**Recommendations:** **Widget / shortcut** (future) or persistent **Whetstone** entry with **fewest taps** from cold start after first week. **One visible line** explaining grace (see Part B A2).

---

#### I3 — Self-Discovery (10–20 min · churn Low · journal 30–50% · $4–10/mo)

**Audit:** **Highest revenue band** in your model — aligns with **Reflective** archetype (A3). Optional journal is on-brand; **missing** reread/edit/export **caps LTV**.

**Recommendations:** **Reflections list** on mountain or export = priority when monetizing this segment.

---

#### I4 — Skeptical Experimenter (5–10 min · churn **Very high** · journal ~0% · $0–5/mo)

**Audit:** They **bounce** if trust or value isn’t instant. **Demo APK** (`SKIP_AUTH`) is perfect for **try**. Lack of **in-app proof** (what’s stored where, who can see it) hurts conversion to account.

**Recommendations:** **First-session** card: “Your data stays in your account — we don’t sell it” + link to policy. **No** journal investment needed — keep path short to **one burn** or **one habit check**.

---

#### I5 — Emergency Grabber (week-1 spike · churn **Extreme** · journal ~10%+ · $0/mo)

**Audit:** Crisis users need **fastest path to one committed action** and **witness** (Elias, streak). Current **intro + metaphor** may feel **too slow** if they’re panicking. **$0/mo** in your model implies **support cost** without revenue — risky at scale.

**Recommendations:** Product: consider **“Quick path”** after auth: skip optional beats, land on **one template mountain** or **Whetstone-only** mode (spec, not built). Ops: **crisis disclaimer** in FAQ (not therapy). PM: **don’t** acquire this segment paid until retention strategy exists.

---

### Literacy × intention — quick risk grid (planning)

|  | I1 Goal-Seeker | I2 Habit | I3 Self-Discovery | I4 Skeptical | I5 Emergency |
|--|----------------|----------|-------------------|--------------|--------------|
| **L1 Reluctant** | Medium | Medium | Low fit | Low | **Critical** (fear + urgency) |
| **L2 Comfortable** | Low | Low | Low | Medium | High |
| **L3 Native** | Low | Low | Medium (export) | Low | Medium |
| **L4 Professional** | Low | Low | Medium | Low (proof) | Medium |

Use this grid for **marketing** (who to target first) and **support** staffing (L1 × I5 = highest human help load).

---

## Cross-cutting issues (prioritized for v0.1.3)

| Priority | Issue | Owner lens |
|----------|--------|------------|
| P0 | Tester build **must** use `-DemoMode` / `SKIP_AUTH=true` or instructions fail | PM, DevOps, Tester |
| P1 | **TESTING_CHECKLIST** deploy path vs `deploy.ps1` | PM |
| P1 | **Connection screen** vs **DEMO_MODE_TESTING.md** (offline demo CTA) | Product, Data/Arch |
| P2 | **Release signing** for Play Store | DevOps, Flutter |
| P2 | **Integration tests** not in CI | QA, DevOps |
| P3 | **Persisted demo mode** vs bootstrap behavior | Architect |
| P1 (wider beta) | **Privacy policy URL + contact**; counsel review | Security Officer (11) |
| P1 (wider beta) | **Analytics/crash** decision + doc updates if added | Analytics (18), Security (11) |
| P2 | **WCAG / TalkBack** pass before scaling testers | Accessibility (19) |
| P2 | **FAQ + support channel** for triage | Community (14) |
| P3 | **Tone guide + glossary** | Content (13) |
| P3 | **i18n extraction** before locales | Localization (16) |

---

## Resolution (post-audit) — tracked in-repo

*Shipped **v0.1.2+20** (tester-readiness) and **v0.1.2+21** (privacy URL + hosting). Closes several cross‑cutting items; others stay open until v0.1.3 / wider beta.*

| Cross-cutting (§ above) | Status | What changed |
|-------------------------|--------|----------------|
| P0 — Demo build instructions | **Done** | `docs/TESTING_CHECKLIST.md`: `.\deploy.ps1 -DemoMode …`, demo context block, macOS/Linux note |
| P1 — `deploy.ps1` vs old script path | **Done** | Same file; removed `scripts/deploy_android.ps1` as primary path |
| P1 — Connection screen vs `DEMO_MODE_TESTING.md` | **Done** | `docs/DEMO_MODE_TESTING.md`: init failure = Retry only; restart/reconnect; demo via `-DemoMode` APK |
| P1 (wider beta) — **Public privacy URL** | **Done** | Firebase Hosting: `https://voyager-sanctuary.web.app/privacy`; `firebase_public/` + `firebase.json` hosting; `docs/FIREBASE_HOSTING_PRIVACY.md` |
| P1 — **Privacy row in app** | **Done** | `lib/features/management/settings_screen.dart`: **Privacy & Data** → live URL; `url_launcher` + Android `https` query |
| Support contact in legal drafts | **Done** | `docs/LEGAL.md` + `docs/DATA_SAFETY_AND_PRIVACY.md`: **support@voyagersanctuary.com** |
| P1 (wider beta) — **Counsel review** | **Open** | Lawyer review before store / large beta |
| P2 — Release signing | **Open** | Release still uses debug keystore until Play submission prep |
| P2 — CI + integration tests | **Open** | No GitHub Actions etc. yet |
| P2 — WCAG / TalkBack | **Open** | Planned manual pass (user) |
| P2 — FAQ / support channel | **Open** | |
| P3 — Persisted demo / bootstrap | **Open** | |
| P3 — Tone guide, i18n | **Open** | |
| P1 — Analytics / crash decision | **Open** | Still no Analytics SDK; policy unchanged |

---

## Document control

| Field | Value |
|-------|--------|
| App version (current) | **0.1.2+21** |
| Audit narrative baseline | v0.1.2+19 (findings unchanged unless noted in § Resolution) |
| Package (Android) | `com.voyagersanctuary.voyager_sanctuary` |
| Primary artifact | `build/app/outputs/flutter-apk/app-release.apk` |
| Public privacy URL | `https://voyager-sanctuary.web.app/privacy` |
| Specialist roster | § Summary matrix (1–20); detailed audits §1–§20 |
| User archetypes | § Summary matrix (A1–A7); **Part B** narrative |
| Literacy & intentions | § Summary matrices (Dimension 1 & 2); **Part C** narrative |
| Next review | After tester feedback → v0.1.3 scope; before wider beta → §11, §18, §19 |

*End of audit.*
