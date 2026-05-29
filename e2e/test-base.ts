import { test as base, expect } from "@playwright/test";

/**
 * Shared Playwright fixture for Garden Tracker e2e tests.
 *
 * P0c (2026-05-29): in CI we block Supabase image-fetch network requests at the
 * Playwright route layer so authenticated specs can run against prod Supabase
 * without burning Free-plan egress quota.
 *
 * Two patterns are blocked, both gated on process.env.CI:
 *   (a) /_next/image?url=...supabase.co...   — Next/Image proxy path for Supabase
 *       storage URLs. This is where the real egress happens — the server-side
 *       proxy fetches from Supabase on behalf of the browser. Regex-matched.
 *   (b) **\/storage/v1/object/public/**       — Belt-and-suspenders for any
 *       future code path that fetches Supabase storage URLs directly (today
 *       PlantImage routes Supabase URLs through Next/Image, so this is dormant).
 *
 * Trade-off: image rendering is NOT verified by CI under P0c. Relies on Syd's
 * phone dogfood. P0b (second Supabase project for tests) is the canonical fix
 * and remains deferred — see docs/SUPABASE_OPS.md §11.
 *
 * Local dev runs without the route block; image rendering works normally.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    if (process.env.CI) {
      await page.route(/\/_next\/image.*supabase\.co/, (route) => route.abort());
      await page.route("**/storage/v1/object/public/**", (route) => route.abort());
    }
    await use(page);
  },
});

export { expect };
