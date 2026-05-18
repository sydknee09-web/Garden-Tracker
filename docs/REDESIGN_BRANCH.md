# Redesign Branch

This branch is the parallel-track redesign work for Garden Tracker per the redesign plan in `docs/REDESIGN_2026-05-18_add-entry-organization.md`.

**Strategy:**
- `main` branch continues shipping bug fixes + incremental Phase 1 work that's compatible with production
- This `redesign` branch holds the structural Phase 2 work (Zones, log-driven state, lifecycle, Compare tab, etc.)
- Vercel auto-deploys this branch to a preview URL (separate from production)
- Syd uses the preview URL to dogfood the redesign; Sam stays on production
- Schema changes here MUST be backward-compatible until cutover (additive columns, new tables, no destructive changes)
- When ready, merge `redesign` → `main` for cutover. Migration scripts run once on cutover.

**Created:** 2026-05-18
