import { test, expect } from "@playwright/test";

/**
 * Journal entry creation via Quick Log modal.
 * Verifies the FAB → UniversalAddMenu → "Add journal" → QuickLogModal flow
 * completes without errors and the dialog closes cleanly.
 *
 * Requires: authenticated session (E2E_TEST_EMAIL / E2E_TEST_PASSWORD)
 */

test.describe("Journal — Quick Log entry creation", () => {
  test("FAB opens Add menu with Add journal option", async ({ page }) => {
    await page.goto("/journal");
    await page.waitForLoadState("networkidle");

    // Open the FAB
    const fab = page.getByRole("button", { name: "Add", exact: true });
    await fab.waitFor({ state: "visible", timeout: 10000 });
    await fab.click();

    // Universal Add Menu should appear
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Add journal")).toBeVisible({ timeout: 5000 });

    // Close to clean up
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 3000 });
  });

  test("Quick Log modal opens with correct heading and fields", async ({ page }) => {
    await page.goto("/journal");
    await page.waitForLoadState("networkidle");

    // FAB → Add journal
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.getByText("Add journal").click();

    // QuickLogModal should open with "Quick Log" heading
    await expect(
      page.getByRole("dialog").getByText("Quick Log"),
      "Quick Log modal should have a 'Quick Log' heading"
    ).toBeVisible({ timeout: 5000 });

    // Quick memo textarea should be present
    await expect(page.locator("#quicklog-note")).toBeVisible({ timeout: 3000 });

    // Close to clean up
    await page.getByRole("button", { name: "Cancel" }).click();
  });

  test("submitting a note entry saves and closes the modal", async ({ page }) => {
    await page.goto("/journal");
    await page.waitForLoadState("networkidle");

    // Open Quick Log
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });
    await page.getByText("Add journal").click();

    await expect(page.locator("#quicklog-note")).toBeVisible({ timeout: 5000 });

    // Fill in a note (no plant required — saving with no linked plant is valid)
    await page.locator("#quicklog-note").fill("E2E test note with spaces");

    // Submit
    await page.getByRole("button", { name: "Save" }).click();

              // Dialog should close after save (allow up to 30s for Supabase insert in CI)
              await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 30000 });

    // Should stay on journal page, no login redirect
    await expect(page).not.toHaveURL(/\/login/);

    // No visible error alerts
    await expect(
      page.locator('[role="alert"]:not(#__next-route-announcer__)').filter({ hasText: /./ })
    ).not.toBeVisible();
  });
});
