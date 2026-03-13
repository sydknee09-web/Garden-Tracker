# Static redirect page (testing & password reset)

This folder contains a single HTML page you can host so Supabase auth redirects (password reset, email confirmation) send users here instead of localhost.

## What it does

- **Password reset / email link:** User clicks the link in email → Supabase verifies → redirects to this page. They see “Password updated. Close this and open the app.”
- **Testing:** Gives you a real URL to put in Supabase **Site URL** and **Redirect URLs** so you can test auth flows.

## Host it (pick one)

### GitHub Pages (free)

1. Create a new repo (e.g. `voyager-sanctuary-redirect`) or use a branch.
2. Copy only `index.html` into the repo root (or into a folder like `docs/` if using GitHub Pages from `/docs`).
3. Settings → Pages → Source: main branch, folder “/ (root)” or “/docs”.
4. Your URL will be like `https://<username>.github.io/voyager-sanctuary-redirect/` or `https://<username>.github.io/<repo>/`.

### Netlify / Vercel (free)

1. Sign up at [netlify.com](https://netlify.com) or [vercel.com](https://vercel.com).
2. New site → “Deploy from Git” or “Import project”, or drag-and-drop the `static` folder.
3. You get a URL like `https://your-site.netlify.app`.

### Supabase Storage (same project)

1. In Supabase Dashboard: Storage → create a public bucket (e.g. `public`).
2. Upload `index.html` and set it as the default or use the object URL.
3. If you use a static site host that supports custom paths, you can point the “root” to this file.

## Configure Supabase

1. **Authentication** → **URL Configuration**.
2. **Site URL:** set to your hosted page URL (e.g. `https://yourusername.github.io/voyager-sanctuary-redirect/`).
3. **Redirect URLs:** add the same URL and optionally with path wildcard, e.g. `https://yourusername.github.io/voyager-sanctuary-redirect/**`.
4. Save.

After that, new password reset and confirmation emails will redirect to this page instead of localhost.
