# Password reset & redirect URL

## Why you saw localhost and `otp_expired`

1. **Redirect to localhost**  
   Supabase’s **Site URL** was still `http://localhost:3000`, so after the reset link was used, the browser was sent there. That’s wrong for a mobile app (and for opening the link on a desktop browser).

2. **`otp_expired`**  
   Password recovery links expire (often after about 1 hour). If the link is old or you clicked it too late, you’ll see “Email link is invalid or has expired”. Fix: request a **new** password reset (from the app or from Supabase Dashboard → Authentication → Users → “Send password recovery”).

---

## Fix in Supabase (do this first)

1. Open your project: [Supabase Dashboard](https://supabase.com/dashboard) → **Voyager-Sanctuary** (the one with URL `ibfkeovmgnvfdnrpvoxg.supabase.co`).
2. Go to **Authentication** → **URL Configuration** (in the left sidebar under Configuration).
3. Change **Site URL** from `http://localhost:3000` to one of:
   - **Option A (recommended for mobile):** a custom scheme so the app can eventually handle the link, e.g.  
     `voyagersanctuary://`
   - **Option B:** a real webpage you host (e.g. GitHub Pages, Vercel) that shows something like “Password updated. You can close this and open the app.” Use that page’s URL as Site URL.
4. In **Redirect URLs**, add the same value you used as Site URL, e.g.:
   - `voyagersanctuary://**`
   - or your webpage URL, e.g. `https://yourpage.github.io/**`
5. Save.

After this, new password-reset emails will redirect to the URL you set instead of localhost.

---

## Getting a fresh reset link

- From the app: use “Forgot password?” (when we add it) with the user’s email.  
- From the dashboard: Authentication → Users → select the user → **Send password recovery**.  
Use the new link within the validity window (e.g. within an hour).

---

## Optional later: open app from reset link (deep link)

To have the reset link open the Voyager Sanctuary app and complete sign-in automatically (e.g. on phone), we’d need to:

- Keep **Site URL** / **Redirect URLs** using `voyagersanctuary://` (or your app’s scheme).
- In the app: register that scheme (Android `AndroidManifest.xml`, iOS `Info.plist`), add the `app_links` package, and on startup call `Supabase.instance.recoverSession(uri)` when the app is opened from that link.

That can be added in a follow-up. For now, fixing the URL in Supabase and using a new reset link is enough so you no longer land on localhost or hit the wrong redirect.
