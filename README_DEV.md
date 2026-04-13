# Voyager Sanctuary — Developer Notes

---

## RLS Verification

**Demo Mode does not validate security.** When running in demo mode (offline, `SKIP_AUTH`, or "Use offline"), the app uses in-memory or local storage. Row-Level Security (RLS) is not exercised.

**RLS verification requires a live Supabase project** with real authentication. Before release:

1. Create two test accounts (Account A, Account B)
2. Follow [RLS_VERIFICATION.md](docs/RLS_VERIFICATION.md)
3. Confirm Account A cannot see Account B's mountains, nodes, satchel, whetstone, or streaks
4. Run the poison-record test per the spec

---

## Quick Commands

```bash
# Run with Supabase
flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...

# Run in demo mode (skips auth)
flutter run --dart-define=SKIP_AUTH=true

# Analyze
flutter analyze lib/
```

---

## App Distribution (test builds on device)

**Convention:** After a meaningful batch of changes (especially UI/flow), run a **production** APK deploy so testers can install via Firebase App Distribution **without** USB:

```powershell
cd voyager_sanctuary
.\deploy.ps1 -ReleaseNotes "Short description of what changed"
```

`deploy.ps1` **increments the `+build` number** in `pubspec.yaml` before each build (e.g. `0.1.2+22` → `+23`) so App Distribution shows a distinct release. Use `.\deploy.ps1 -SkipVersionBump` only if you must redeploy the same build number.

Use `.\deploy.ps1 -DemoMode -ReleaseNotes "..."` only when you explicitly want the no-login demo build. No need to re-approve each deploy in chat if the stakeholder has asked to ship batches this way.

### Auto deploy (so you can test on your phone without asking each time)

1. **Cursor (this machine)** — On each **agent turn end** (`stop` hook), if `lib/`, `pubspec.yaml`, or `android/` have **uncommitted** changes compared to the last successful auto-deploy fingerprint, the project runs `deploy.ps1` automatically (same Firebase flow as manual). **Requires** Flutter + Firebase CLI on PATH and a prior `firebase login` on this PC. **Open the `voyager_sanctuary` folder as the Cursor project root** (not a parent monorepo folder) so `.cursor/hooks.json` is picked up. **Restart Cursor** after pulling hook files. The hook can take ~2 minutes when it fires; duplicate deploys for the same file state are skipped.

2. **GitHub (when you push)** — Workflow `.github/workflows/firebase-app-distribution.yml` builds and uploads on push to `main` or `master` when Flutter-related paths change. Add a repository secret **`FIREBASE_TOKEN`** (create with `firebase login:ci` on your computer and paste the token into GitHub → Settings → Secrets and variables → Actions). If the secret is missing, the workflow still builds but skips the upload step with a warning.
