# Test Supabase Auth / "Can't reach the server"

When the app says it can't reach the server, the request often never reaches Supabase—or Supabase rejects it (e.g. over quota). Use these steps to see whether the problem is **quota**, **network/project**, or **auth config**.

---

## Test account (for Test 2 and app login testing)

| Field    | Value                      |
|----------|----------------------------|
| Email    | `sydneysubscribed@gmail.com` |
| Password | `test1234`                 |

Use this in the PowerShell Test 2 below or in the app when testing login. (If the repo is public, consider moving this to a gitignored file.)

---

## 0. Quota / "EXCEEDING USAGE LIMITS"

If the dashboard shows **"Organization plan has exceeded its quota"** and a red **"EXCEEDING USAGE LIMITS"** badge:

- Supabase may throttle or block API requests (including Auth). That can show up as "can't reach the server" or timeouts.
- **Fix:** [Billing & Usage](https://supabase.com/dashboard/org/_/billing) → reduce usage (e.g. Cached Egress, DB size) or upgrade. Grace period is temporary; after it ends, requests can be blocked.
- The app now shows a clearer message when it receives a quota-related error: *"Plan limit reached. Check Supabase billing or try again later."*

---

## 1. Dashboard checks (Supabase)

1. **Project not paused**  
   [Supabase Dashboard](https://supabase.com/dashboard) → your project **ibfkeovmgnvfdnrpvoxg**. If it says "Paused", click **Restore**. Paused projects don’t accept connections.

2. **URL and anon key**  
   **Project Settings → API**:  
   - **Project URL** should be `https://ibfkeovmgnvfdnrpvoxg.supabase.co`  
   - **anon public** key should match `lib/core/config/supabase_config.dart`.  
   If you rotated the key in the dashboard, the app must use the new key (rebuild with the same key or set `SUPABASE_ANON_KEY`).

3. **Email auth enabled**  
   **Authentication → Providers → Email**: "Enable Email provider" should be **ON**.

4. **Optional – test user**  
   **Authentication → Users → Add user**: create a user with email + password so you can test login with known credentials.

---

## 2. Test from your machine (reachability + Auth)

Run this from PowerShell on a machine that has internet (same network as the phone is ideal). Test 2 uses the test account from the table above.

```powershell
# Test 1: Can we reach the Auth service? (expect 200 and GoTrue version JSON)
$headers = @{ "apikey" = "sb_publishable_3kFcOgv-zDSFl5QVCuhUbw_QqmWAh6w" }
try {
  $r = Invoke-RestMethod -Uri "https://ibfkeovmgnvfdnrpvoxg.supabase.co/auth/v1/health" -Method GET -Headers $headers
  Write-Host "OK - Auth service reachable:" $r
} catch { Write-Host "Error:" $_.Exception.Message }

# Test 2: Auth token request (uses test account sydneysubscribed@gmail.com / test1234)
$body = @{ grant_type = "password"; email = "sydneysubscribed@gmail.com"; password = "test1234" } | ConvertTo-Json
$headers = @{
  "apikey"       = "sb_publishable_3kFcOgv-zDSFl5QVCuhUbw_QqmWAh6w"
  "Content-Type" = "application/json"
}
try {
  $r = Invoke-RestMethod -Uri "https://ibfkeovmgnvfdnrpvoxg.supabase.co/auth/v1/token?grant_type=password" -Method POST -Headers $headers -Body $body
  Write-Host "OK - Got session (server is reachable, auth works)"
  $r
} catch {
  Write-Host "Error:" $_.Exception.Message
  if ($_.Exception.Response) { Write-Host "Status:" $_.Exception.Response.StatusCode }
}
```

- **Test 1**  
  - Succeeds (e.g. 200): project is reachable; problem may be app config or device/network.  
  - Timeout / connection error: network or project URL wrong / project paused.

- **Test 2**  
  - Success: Auth is working from your network; app likely wrong URL/key or device/emulator can’t reach Supabase.  
  - 400/401: Server is reachable; fix credentials or email provider.  
  - Timeout: Same as Test 1 – reachability issue.

---

## 3. Run Test 1 only (no account)

If you don’t have a user yet, run only Test 1. If that fails, the app will also fail with "can't reach the server". If it succeeds, the next step is to confirm the app’s URL and anon key match the dashboard and that the device can reach the internet.

---

## Run app with real auth (no demo)

Debug builds default to **demo/skip-auth**. To test the real sign-in flow locally:

```bash
flutter run --dart-define=SKIP_AUTH=false
```

Use `-d chrome` or `-d <device-id>` to choose a device. You’ll see entrance → login screen.

---

## 4. In-app URL/key

The app uses (from `lib/core/config/supabase_config.dart`):

- **URL:** `https://ibfkeovmgnvfdnrpvoxg.supabase.co`  
- **Anon key:** `sb_publishable_3kFcOgv-zDSFl5QVCuhUbw_QqmWAh6w`

If you changed the anon key in the dashboard, do a clean rebuild (or set `SUPABASE_ANON_KEY` when building) so the app uses the current key.
