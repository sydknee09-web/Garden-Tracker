import { test, expect } from "@playwright/test";

/**
 * Critical path: Vault → FAB → Add Seed Packet (manual entry).
 * Verifies that the add flow completes without error, and the URL either
 * stays on /vault (packet added to existing profile) or navigates to /vault/[id]
 * (new profile created). Never redirects to /login.
 *
 * Requires: E2E_TEST_EMAIL + E2E_TEST_PASSWORD in .env.local
 */

test.describe("Vault — Add Seed Packet (FAB flow)", () => {
  test("FAB opens universal add menu", async ({ page }) => {
    await page.goto("/vault");
    // Wait for the vault to finish loading
    await page.waitForLoadState("networkidle");

    const fab = page.getByRole("button", { name: "Add", exact: true });
    await fab.waitFor({ state: "visible", timeout: 10000 });
    await fab.click();

    // Universal Add Menu dialog should appear
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Add Seed Packet")).toBeVisible();
    await expect(page.getByText("Add to shed")).toBeVisible();

    // Cancel to clean up
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3000 });
  });

  test("FAB → Add Seed Packet opens QuickAddSeed modal", async ({ page }) => {
    await page.goto("/vault");
    await page.waitForLoadState("networkidle");

    // Open FAB menu
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Click Add Seed Packet
    await page.getByText("Add Seed Packet").click();

    // QuickAddSeed should open with "Add Seed" heading and "Manual Entry" option
    await expect(page.getByText("Add Seed")).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole("button", { name: "Manual Entry" })).toBeVisible();
  });

  test("manual add flow completes and stays on vault or profile page", async ({ page }) => {
    const uniqueName = `E2E Test Plant ${Date.now()}`;

    await page.goto("/vault");
    await page.waitForLoadState("networkidle");

    // Open FAB → Add Seed Packet
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await page.getByText("Add Seed Packet").click();
    await expect(page.getByText("Add Seed")).toBeVisible({ timeout: 5000 });

    // Choose Manual Entry
    await page.getByRole("button", { name: "Manual Entry" }).click();

    // Fill required plant name
    const nameInput = page.getByLabel(/plant name|name/i).first();
    await nameInput.waitFor({ state: "visible", timeout: 5000 });
    await nameInput.fill(uniqueName);

    // Submit the form
    const saveBtn = page.getByRole("button", { name: /save|add seed|quick add/i }).last();
    await saveBtn.click();

    // Should not redirect to login
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });

    // URL should be /vault or /vault/[id] (new profile redirect)
    await expect(page).toHaveURL(/\/vault/, { timeout: 15000 });

    // No visible error alert (excludes Next.js route announcer which is always in the DOM)
    await expect(
      page.locator('[role="alert"]:not(#__next-route-announcer__)').filter({ hasText: /./ })
    ).not.toBeVisible();
  });
});
