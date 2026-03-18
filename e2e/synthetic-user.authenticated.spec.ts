import { test, expect } from "@playwright/test";

/**
 * Synthetic User Procedure — single sequential user journey.
 *
 * Simulates a real user session: one login, one browser context, multiple
 * actions in order. Use for:
 * - Pre-deploy smoke: run against staging before release
 * - Production monitoring: schedule against live URL (e.g. cron + PLAYWRIGHT_BASE_URL)
 * - Regression: verify critical paths work end-to-end in one flow
 *
 * Run: npm run test:synthetic
 * Or:  npx playwright test synthetic-user.authenticated.spec.ts
 *
 * For production: PLAYWRIGHT_BASE_URL=https://your-app.vercel.app npm run test:synthetic
 *
 * Requires: E2E_TEST_EMAIL + E2E_TEST_PASSWORD in .env.local (or env)
 */
test.describe("Synthetic User Procedure", () => {
  test("full user journey — home → vault add seed → journal → calendar → shopping list", async ({
    page,
  }) => {
    test.setTimeout(180000); // 3 min — long sequential flow
    const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
    const steps: string[] = [];

    const step = (name: string) => {
      steps.push(name);
      console.log(`[Synthetic] Step ${steps.length}: ${name}`);
    };

    // --- 1. Home loads ---
    step("Home loads");
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
    await page.locator("header, nav, main").first().waitFor({ state: "visible", timeout: 10000 });
    step("Home OK");

    // --- 2. Vault loads ---
    step("Navigate to Vault");
    await page.goto("/vault");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login/);
    await page.locator("main").first().waitFor({ state: "visible", timeout: 10000 });
    step("Vault OK");

    // --- 3. FAB → Add Seed Packet (manual) ---
    step("FAB → Add Seed Packet");
    const fab = page.getByRole("button", { name: "Add", exact: true });
    await fab.waitFor({ state: "visible", timeout: 10000 });
    await fab.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Add Seed Packet")).toBeVisible();
    await page.getByText("Add Seed Packet").click();
    await expect(page.getByText("Add Seed")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Manual Entry" }).click();

    const uniqueName = `E2E Synthetic ${Date.now()}`;
    const nameInput = page.getByLabel(/plant name|name/i).first();
    await nameInput.waitFor({ state: "visible", timeout: 5000 });
    await nameInput.fill(uniqueName);
    const saveBtn = page.getByRole("button", { name: /save|add seed|quick add/i }).last();
    await saveBtn.click();

    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
    await expect(page).toHaveURL(/\/vault/, { timeout: 15000 });
    await expect(
      page.locator('[role="alert"]:not(#__next-route-announcer__)').filter({ hasText: /./ })
    ).not.toBeVisible();
    step("Add Seed Packet OK");

    // --- 4. Journal — Quick Log ---
    step("Journal → Quick Log");
    await page.goto("/journal");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.getByText("Add journal").click();
    await expect(page.locator("#quicklog-note")).toBeVisible({ timeout: 5000 });
    await page.locator("#quicklog-note").fill(`Synthetic test note ${Date.now()}`);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 30000 });
    await expect(page).not.toHaveURL(/\/login/);
    step("Journal Quick Log OK");

    // --- 5. Calendar loads and FAB ---
    step("Calendar");
    await page.goto("/calendar");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login/);
    await page.locator("main").waitFor({ state: "visible", timeout: 8000 });
    const calFab = page.getByRole("button", { name: "Add", exact: true });
    await calFab.waitFor({ state: "visible", timeout: 10000 });
    await calFab.click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
    step("Calendar OK");

    // --- 6. Shopping List ---
    step("Shopping List");
    await page.goto("/shopping-list");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(
      page.getByRole("main").getByRole("heading", { name: /shopping list/i })
    ).toBeVisible({ timeout: 8000 });
    step("Shopping List OK");

    // --- 7. Garden ---
    step("Garden");
    await page.goto("/garden");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login/);
    await page.locator("main").first().waitFor({ state: "visible", timeout: 10000 });
    step("Garden OK");

    // --- 8. Settings ---
    step("Settings");
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login/);
    await page.locator("main").first().waitFor({ state: "visible", timeout: 8000 });
    step("Settings OK");

    // --- 9. Shed ---
    step("Shed");
    await page.goto("/shed");
    // Use domcontentloaded — Shed may have ongoing network activity (polling, etc.)
    await page.waitForLoadState("domcontentloaded");
    await expect(page).not.toHaveURL(/\/login/);
    await page.locator("main").first().waitFor({ state: "visible", timeout: 15000 });
    step("Shed OK");

    // --- 10. Back to Home (full loop) ---
    step("Return to Home");
    await page.goto("/");
    await expect(page).not.toHaveURL(/\/login/);
    step("Home (return) OK");

    console.log(`[Synthetic] Completed ${steps.length} steps against ${baseURL}`);
  });
});
