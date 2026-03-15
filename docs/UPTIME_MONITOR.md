# Uptime monitor setup

After deploying to production, point an external monitor at the health endpoint so you get alerted when the app or database is down.

## Endpoint

- **URL:** `https://<your-production-domain>/api/health`
- **Method:** GET
- **Auth:** None (public)
- **Success:** HTTP 200 with body `{ "ok": true, "status": "ok", "db": "ok" }`
- **Degraded:** HTTP 503 with body `{ "ok": false, "status": "degraded", "db": "error" }` when Supabase is unreachable or times out (3s).

## Recommended settings

- **Interval:** 1–5 minutes
- **Alert on:** Any non-200 response (including 503)
- **Timeout:** 10–15 seconds (health route responds in under 3s when DB is checked)

## Example providers

- [UptimeRobot](https://uptimerobot.com) — free tier, HTTP(s) monitor
- [Better Uptime](https://betteruptime.com) — status page + incidents

### Vercel

Vercel does **not** offer a built-in “ping this URL and email me if it fails” monitor. You have two options:

1. **Use an external monitor (recommended for alerts)**  
   Use UptimeRobot, Better Uptime, or similar: add a monitor for `https://<your-vercel-domain>/api/health`. They will ping the URL and **notify you** (email, Slack, etc.) when it fails or times out.

2. **Optional: Vercel Cron (pings only, no alerts)**  
   You can have Vercel ping `/api/health` on a schedule so it’s hit regularly (e.g. every 5 minutes). This does **not** send alerts; it only creates request logs in the Vercel dashboard. To set it up:
   - In your project root, add or edit `vercel.json` and add a `crons` array:
     ```json
     {
       "crons": [
         {
           "path": "/api/health",
           "schedule": "*/5 * * * *"
         }
       ]
     }
     ```
   - `schedule` uses cron syntax (UTC). `*/5 * * * *` = every 5 minutes.
   - Redeploy the project. Cron runs only on **production**.
   - Your `/api/health` route is public, so you don’t need to set `CRON_SECRET` for it unless you later add auth to the health endpoint.

For “tell me when the app or DB is down,” use an **external** monitor (UptimeRobot, Better Uptime, etc.) in addition to or instead of the cron.

---

Configure your chosen provider to GET your production `/api/health` URL and notify you (email, Slack, etc.) when the check fails. If you use Vercel, see the **Vercel** subsection above for cron (optional) and why an external provider is still recommended for alerts.
