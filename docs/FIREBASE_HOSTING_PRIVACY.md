# Firebase Hosting — Privacy policy URL

Hosts a **public Privacy Policy** (and a tiny legal index) for **store consoles** and the in-app **Settings → Privacy & Data** link.

**Live URL after deploy (default):**

- `https://voyager-sanctuary.web.app/privacy`  
- (mirror) `https://voyager-sanctuary.firebaseapp.com/privacy`

`cleanUrls` is enabled, so `firebase_public/privacy.html` is served at **`/privacy`** (no `.html` in the URL).

**Source files:** `firebase_public/privacy.html`, `firebase_public/index.html`  
**Config:** `firebase.json` → `hosting` (FlutterFire `flutter` block is unchanged).  
**Project:** `.firebaserc` → `voyager-sanctuary`

---

## One-time setup

1. **Install Firebase CLI** (if you don’t have it):
   ```powershell
   npm install -g firebase-tools
   ```
2. **Log in:**
   ```powershell
   firebase login
   ```
3. **Confirm project** (from `voyager_sanctuary` folder):
   ```powershell
   cd path\to\voyager_sanctuary
   firebase projects:list
   ```
   You should see **`voyager-sanctuary`**. If `firebase use` ever asks, pick that project.

---

## Deploy (every time you change policy HTML)

From the **`voyager_sanctuary`** directory:

```powershell
firebase deploy --only hosting
```

First deploy may prompt to confirm **Hosting** for the project — accept.

Then verify in a browser (incognito):

- [ ] `https://voyager-sanctuary.web.app/privacy` → **200**, policy text visible  
- [ ] `https://voyager-sanctuary.web.app/` → index with link  

---

## App link

`lib/features/management/settings_screen.dart` uses:

`https://voyager-sanctuary.web.app/privacy`

After first successful deploy, **Privacy & Data** in the app should open this page.

Optional later: add a **custom domain** in Firebase Console → Hosting → **Add custom domain** (e.g. `voyagersanctuary.com`), then update `_kPrivacyPolicyUrl` to match.

---

## Editing the policy

1. Change **`firebase_public/privacy.html`** (keep content aligned with `docs/DATA_SAFETY_AND_PRIVACY.md` for store forms).  
2. Run **`firebase deploy --only hosting`** again.

---

## Troubleshooting

| Issue | What to do |
|--------|------------|
| `Error: HTTP Error: 404` on deploy | Enable **Hosting** in [Firebase Console](https://console.firebase.google.com) for project `voyager-sanctuary`, or run `firebase init hosting` once and choose **`firebase_public`** as public directory (should match this repo). |
| Wrong project | `firebase use voyager-sanctuary` |
| FlutterFire overwrites `firebase.json` | Re-merge the **`hosting`** block from this doc / git history, or run `firebase init hosting` and point `public` to `firebase_public`. |
