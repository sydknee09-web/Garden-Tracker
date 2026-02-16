# Vercel Deployment Checklist

Use this when deploying Seed Vault (Garden Tracker) to Vercel.

## Required environment variables

In **Vercel → Project → Settings → Environment Variables**, set:

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `NEXT_PUBLIC_APP_URL` | Yes (prod) | Your production URL, e.g. `https://your-app.vercel.app` (used for auth redirects and invite links) |
| `SUPABASE_SERVICE_ROLE_KEY` | Optional | Needed for creating storage bucket and some admin flows |

Add these for **Production**, **Preview**, and **Development** as needed.

## Optional (features)

- `GOOGLE_GENERATIVE_AI_API_KEY` – seed packet extraction, hero image, OCR
- `OPENAI_API_KEY` – fallback OCR
- `PERENUAL_API_KEY` – botanical enrichment
- `TAVILY_API_KEY` – used by scrape-url for some search flows

## Build settings

- **Framework**: Next.js (auto-detected)
- **Install command**: `npm install --legacy-peer-deps` (already in `vercel.json`)
- **Node**: 24.x (per `package.json` `engines`)

## If the build fails

1. **Check the build log** on Vercel for the exact error (TypeScript, missing module, etc.).
2. **Env at build time**: `NEXT_PUBLIC_*` vars must be set in Vercel so they are inlined at build time. If they’re missing, the app may build but fail at runtime with Supabase/auth errors.
3. **Node version**: Vercel uses Node 18 by default; this project specifies Node 24.x in `package.json` `engines`.
4. **Large API routes**: If you see “function size” or timeout errors, the `/api/seed/scrape-url` route is large; consider splitting or increasing function timeout in `vercel.json` if needed.

## After deploy

- Open your `NEXT_PUBLIC_APP_URL` and sign in; confirm Supabase auth redirects use that URL.
- In Supabase Dashboard → Authentication → URL Configuration, add your Vercel site URL to **Redirect URLs**.
