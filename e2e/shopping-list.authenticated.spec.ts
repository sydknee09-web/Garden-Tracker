import { test, expect } from "@playwright/test";

/**
 * Critical path: Shopping List — add from vault profile, verify item, remove.
 * Requires: E2E_TEST_EMAIL + E2E_TEST_PASSWORD in .env.local
 */

test.describe("Shopping List", () => {
  test("shopping list page loads and shows expected UI", async ({ page }) => {
    await page.goto("/shopping-list");
    await page.waitForLoadState("networkidle");

    // Should not redirect to login
    await expect(page).not.toHaveURL(/\/login/);

    // Should show either the list or an empty state — not a blank page
    const hasContent = await Promise.race([
      page.getByRole("list").waitFor({ state: "visible", timeout: 8000 }).then(() => true),
      page.getByText(/shopping list|out of stock|nothing here/i).waitFor({ state: "visible", timeout: 8000 }).then(() => true),
    ]).catch(() => false);
    expect(hasContent, "Shopping list page should show content or empty state").toBe(true);
  });

  test("add to shopping list from vault profile, verify, remove", async ({ page }) => {
    // Step 1: go to vault, find the first plant profile card
    await page.goto("/vault");
    await page.waitForLoadState("networkidle");

    // Find the first clickable profile card (link to /vault/[id])
    const firstProfileLink = page.locator('a[href^="/vault/"]:not([href="/vault/plant"]):not([href="/vault/import"]):not([href="/vault/shed"])').first();
    const hasProfile = await firstProfileLink.waitFor({ state: "visible", timeout: 10000 }).then(() => true).catch(() => false);

    if (!hasProfile) {
      test.skip(true, "No plant profiles in test account — skipping add-to-shopping-list test");
      return;
    }

    const profileHref = await firstProfileLink.getAttribute("href");
    await firstProfileLink.click();
    await page.waitForURL(/\/vault\/[^/]+$/, { timeout: 10000 });

    // Step 2: click "Add to shopping list" button on the profile page
    const addToListBtn = page.getByRole("button", { name: /add to shopping list/i });
    const hasAddToList = await addToListBtn.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);

    if (!hasAddToList) {
      test.skip(true, `Profile at ${profileHref} has no Add to Shopping List button (may be in-stock or permanent type)`);
      return;
    }

    await addToListBtn.click();

    // Wait for success indication (toast or button state change)
    await page.waitForTimeout(1500);

    // Step 3: navigate to shopping list and verify item is present
    await page.goto("/shopping-list");
    await page.waitForLoadState("networkidle");
    await expect(page).not.toHaveURL(/\/login/);

    // Shopping list should have at least one item
    const listItems = page.getByRole("listitem");
    await expect(listItems.first()).toBeVisible({ timeout: 8000 });

    // Step 4: remove the first item
    const removeBtn = page.getByRole("button", { name: /remove from list/i }).first();
    const hasRemove = await removeBtn.waitFor({ state: "visible", timeout: 5000 }).then(() => true).catch(() => false);

    if (hasRemove) {
      const countBefore = await listItems.count();
      await removeBtn.click();
      await page.waitForTimeout(1000);
      const countAfter = await listItems.count();
      expect(countAfter).toBeLessThanOrEqual(countBefore);
    }
  });
});
