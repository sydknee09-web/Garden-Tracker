import { test, expect } from "@playwright/test";

/**
 * Plant profile inline-edit tests.
 * Verifies that the packet notes and storage location fields accept spaces
 * during live typing (regression for the space-stripping bug fixed in vault/[id]/page.tsx).
 *
 * Requires: authenticated session (E2E_TEST_EMAIL / E2E_TEST_PASSWORD)
 */

test.describe("Vault — Plant Profile inline editing", () => {
  test("packet notes field allows spaces and multi-word input", async ({ page }) => {
    await page.goto("/vault");
    await page.waitForLoadState("networkidle");

    // Find the first plant profile link
    const firstProfile = page
      .locator('a[href^="/vault/"]:not([href="/vault/plant"]):not([href="/vault/import"])')
      .first();
    const hasProfile = await firstProfile
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!hasProfile) {
      test.skip(true, "No plant profiles in test account — skipping profile edit test");
      return;
    }

    await firstProfile.click();
    await page.waitForURL(/\/vault\/[^/]+$/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    // The profile may need a "Packets" tab to be selected to show packet fields
    const packetsTab = page.getByRole("tab", { name: /packets/i });
    const hasTab = await packetsTab
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (hasTab) {
      await packetsTab.click();
      await page.waitForTimeout(500);
    }

    // Look for the packet notes textarea
    const notesField = page.getByLabel(/packet notes/i).first();
    const hasNotes = await notesField
      .waitFor({ state: "visible", timeout: 8000 })
      .then(() => true)
      .catch(() => false);

    if (!hasNotes) {
      test.skip(
        true,
        "No visible packet notes field — profile has no seed packets or uses permanent profile type"
      );
      return;
    }

    // Type a multi-word string — the old bug stripped spaces during live typing
    await notesField.fill("hello world test note");
    const value = await notesField.inputValue();

    expect(value, "Packet notes field must preserve spaces during typing").toContain(" ");
    expect(value).toBe("hello world test note");
  });

  test("storage location field allows spaces and multi-word input", async ({ page }) => {
    await page.goto("/vault");
    await page.waitForLoadState("networkidle");

    const firstProfile = page
      .locator('a[href^="/vault/"]:not([href="/vault/plant"]):not([href="/vault/import"])')
      .first();
    const hasProfile = await firstProfile
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!hasProfile) {
      test.skip(true, "No plant profiles in test account — skipping storage location test");
      return;
    }

    await firstProfile.click();
    await page.waitForURL(/\/vault\/[^/]+$/, { timeout: 10000 });
    await page.waitForLoadState("networkidle");

    const packetsTab = page.getByRole("tab", { name: /packets/i });
    const hasTab = await packetsTab
      .waitFor({ state: "visible", timeout: 3000 })
      .then(() => true)
      .catch(() => false);
    if (hasTab) {
      await packetsTab.click();
      await page.waitForTimeout(500);
    }

    // Look for the storage location input
    const locationField = page.getByLabel(/storage location/i).first();
    const hasLocation = await locationField
      .waitFor({ state: "visible", timeout: 8000 })
      .then(() => true)
      .catch(() => false);

    if (!hasLocation) {
      test.skip(
        true,
        "No visible storage location field — profile has no seed packets or uses permanent profile type"
      );
      return;
    }

    await locationField.fill("Green box shelf two");
    const value = await locationField.inputValue();

    expect(value, "Storage location field must preserve spaces during typing").toContain(" ");
    expect(value).toBe("Green box shelf two");
  });

  test("profile page loads with no errors and no login redirect", async ({ page }) => {
    await page.goto("/vault");
    await page.waitForLoadState("networkidle");

    const firstProfile = page
      .locator('a[href^="/vault/"]:not([href="/vault/plant"]):not([href="/vault/import"])')
      .first();
    const hasProfile = await firstProfile
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (!hasProfile) {
      test.skip(true, "No plant profiles in test account");
      return;
    }

    await firstProfile.click();
    await page.waitForURL(/\/vault\/[^/]+$/, { timeout: 10000 });

    // Should not redirect to login
    await expect(page).not.toHaveURL(/\/login/);

    // Profile page should have main content
    await page.locator("main").waitFor({ state: "visible", timeout: 8000 });

    // No visible error alerts
    await expect(
      page.locator('[role="alert"]:not(#__next-route-announcer__)').filter({ hasText: /./ })
    ).not.toBeVisible();
  });
});
