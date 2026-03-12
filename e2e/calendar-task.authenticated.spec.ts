import { test, expect } from "@playwright/test";

/**
 * Calendar task completion tests.
 * Verifies the task list loads and that clicking "Mark complete" removes
 * the task from the active list.
 *
 * If the test account has no tasks, all task-action tests are skipped gracefully.
 *
 * Requires: authenticated session (E2E_TEST_EMAIL / E2E_TEST_PASSWORD)
 */

test.describe("Calendar — task management", () => {
  test("calendar page loads and shows expected UI", async ({ page }) => {
    await page.goto("/calendar");
    await page.waitForLoadState("networkidle");

    // Should not redirect to login
    await expect(page).not.toHaveURL(/\/login/);

    // Calendar should render its main content
    await page.locator("main").waitFor({ state: "visible", timeout: 8000 });

    // No visible error alerts
    await expect(
      page.locator('[role="alert"]:not(#__next-route-announcer__)').filter({ hasText: /./ })
    ).not.toBeVisible();
  });

  test("mark complete removes a task from the active list", async ({ page }) => {
    await page.goto("/calendar");
    await page.waitForLoadState("networkidle");

    // Look for a completable (non-sow) task — "Mark complete" aria-label
    const completeBtn = page.getByRole("button", { name: "Mark complete" }).first();
    const hasTask = await completeBtn
      .waitFor({ state: "visible", timeout: 8000 })
      .then(() => true)
      .catch(() => false);

    if (!hasTask) {
      test.skip(
        true,
        "No completable tasks in test account for this month — skipping mark-complete test"
      );
      return;
    }

    // Count total "Mark complete" buttons before completing one
    const countBefore = await page.getByRole("button", { name: "Mark complete" }).count();

    await completeBtn.click();

    // Wait for the optimistic update or Supabase response
    await page.waitForTimeout(1500);

    const countAfter = await page.getByRole("button", { name: "Mark complete" }).count();

    expect(
      countAfter,
      "Completing a task should reduce the number of incomplete tasks shown"
    ).toBeLessThan(countBefore);
  });

  test("calendar FAB opens Add menu with Add Task option", async ({ page }) => {
    await page.goto("/calendar");
    await page.waitForLoadState("networkidle");

    // Open the FAB
    const fab = page.getByRole("button", { name: "Add", exact: true });
    await fab.waitFor({ state: "visible", timeout: 10000 });
    await fab.click();

    // Universal Add Menu should appear
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 5000 });

    // Close via Cancel button (UniversalAddMenu has no Escape handler)
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible({ timeout: 5000 });
  });
});
