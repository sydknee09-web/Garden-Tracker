import { test, expect } from "@playwright/test";

/**
 * Smoke tests for authenticated pages.
 * Requires auth setup (E2E_TEST_EMAIL, E2E_TEST_PASSWORD) to run.
 */
test.describe("Authenticated pages smoke", () => {
  const routes = [
    { path: "/", name: "Home" },
    { path: "/vault", name: "Vault" },
    { path: "/garden", name: "Garden" },
    { path: "/calendar", name: "Calendar" },
    { path: "/journal", name: "Journal" },
    { path: "/schedule", name: "Schedule" },
    { path: "/shopping-list", name: "Shopping List" },
    { path: "/settings", name: "Settings" },
    { path: "/shed", name: "Shed" },
  ] as const;

  for (const { path, name } of routes) {
    test(`${name} (${path}) loads`, async ({ page }) => {
      await page.goto(path);
      // Should not redirect to login
      await expect(page).not.toHaveURL(/\/login/);
      // Page should have main content (header or nav)
      await page.locator("header, nav, [role='navigation'], main").first().waitFor({ state: "visible", timeout: 10000 });
    });
  }
});
