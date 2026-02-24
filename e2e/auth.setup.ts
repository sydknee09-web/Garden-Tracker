import { test as setup } from "@playwright/test";

/**
 * Logs in and saves auth state for authenticated E2E tests.
 * Requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD in .env.local or environment.
 */
setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set for authenticated tests. " +
        "Add them to .env.local or skip the authenticated project."
    );
  }

  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(?!login|signup|reset-password)/, { timeout: 15000 });
  await page.context().storageState({ path: ".auth/user.json" });
});
