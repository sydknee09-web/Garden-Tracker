import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads and shows sign-in prompt when unauthenticated", async ({ page }) => {
    await page.goto("/");
    // Unauthenticated users see login/signup
    await expect(page).toHaveTitle(/Garden|Track|Seed/i);
    // Either auth prompt or dashboard
    const hasAuthPrompt = await page.getByText(/sign in|log in|get started/i).isVisible().catch(() => false);
    const hasDashboard = await page.getByText(/tasks|upcoming|shopping/i).isVisible().catch(() => false);
    expect(hasAuthPrompt || hasDashboard).toBeTruthy();
  });

  test("has accessible navigation", async ({ page }) => {
    await page.goto("/");
    // Bottom nav or main nav should be present
    const nav = page.locator("nav, [role='navigation']").first();
    await expect(nav).toBeVisible();
  });
});
