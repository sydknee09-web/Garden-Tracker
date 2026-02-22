# UX Concepts — Explanations

## Deep links

**What they are:** Direct URLs to a specific resource in the app, e.g. `/vault/abc123` for a plant profile or `/shed/xyz789` for a supply.

**Why they help:**
- **Sharing** — Send a link to a specific plant or supply (e.g. “Check out this tomato”)
- **Bookmarks** — Save links in browser or notes for quick access
- **Cross-app** — Open from email, messages, or other apps

**Current state:** The app already supports deep links. Routes like `/vault/[id]` and `/shed/[id]` work when you navigate or paste the URL. What’s missing is explicit “Share” or “Copy link” actions so users can easily get these URLs.

---

## Breadcrumbs

**What they are:** A trail showing where you are in the app, e.g. `Vault → Tomato → Roma`.

**Why they help:**
- **Orientation** — Clarifies hierarchy (vault → profile → packet)
- **Navigation** — One-click back to parent levels
- **Context** — Especially useful on nested pages like profile detail or packet edit

**Current state:** Back links exist (e.g. “← Back to Shed”) but there’s no full breadcrumb trail. Adding breadcrumbs would make hierarchy clearer on deeper pages.

---

## Tab persistence

**What it is:** Remembering the user’s view choice (grid/list/shed) across navigation and sessions.

**Why it helps:** Avoids re-selecting the same view every time.

**Current state:** Already implemented. The vault uses `sessionStorage` to persist:
- View mode (grid, list, shed)
- Grid style (photo, condensed)
- Status filter
- Search query
- Sort (by purchase date, name, etc.)

Values are restored when returning to the vault without URL params. `sessionStorage` is per-tab and cleared when the tab closes; `localStorage` would persist across tabs and browser restarts if you want that instead.
