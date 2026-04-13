# v0.1.2+ — Demo APK for Firebase distribution

Build a **release** APK that skips Supabase login (`SKIP_AUTH=true`) so testers land on Sanctuary with demo repositories.

## STEP 1 — Build (PowerShell)

From `voyager_sanctuary`:

```powershell
cd voyager_sanctuary

# Optional clean
flutter clean

flutter build apk --release --dart-define=SKIP_AUTH=true
```

Verify:

`build\app\outputs\flutter-apk\app-release.apk` (~74 MB)

## STEP 2 — Install & smoke-test locally

```powershell
adb install -r build\app\outputs\flutter-apk\app-release.apk
```

**Expected:** App opens on **Sanctuary** (no auth). Elias visible. Streak chip visible. Map may show **Create a Mountain** (mountains are **not** pre-seeded; Whetstone has **starter habits**).

If you see **login** instead:

- Rebuild ensuring `--dart-define=SKIP_AUTH=true` is on the **same** command as `build apk`.
- Fresh install: `adb uninstall com.voyagersanctuary.voyager_sanctuary` then install again.

## STEP 3 — Firebase App Distribution

**Important:** Use `-DemoMode` so the script does not rebuild without `SKIP_AUTH`.

```powershell
.\deploy.ps1 -DemoMode -ReleaseNotes "v0.1.2+19 demo: no login, in-memory demo path"
```

Optional clean + demo in one shot:

```powershell
.\deploy.ps1 -Clean -DemoMode -ReleaseNotes "v0.1.2+19 demo build"
```

## Demo behavior (accurate)

| Item | Behavior |
|------|----------|
| Login | Skipped (`SKIP_AUTH=true`) |
| Start route | `/sanctuary` |
| Mountains | Start **empty**; create via map flow |
| Whetstone | **Starter habits** seeded (in-memory path) |
| Persistence | `SKIP_AUTH` uses in-memory seed; treat as **session-oriented**; uninstall clears app data |

## Tester copy

See release notes in your Firebase message; align **What’s New** with `docs/TESTING_CHECKLIST.md`.
