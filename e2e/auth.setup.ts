import { test as setup } from "@playwright/test";

/**
 * Authenticates for E2E tests via the browser login form.
 * Supabase JS handles session persistence to localStorage natively,
 * which avoids any dependency on the internal storage-key format.
 *
 * Requires: E2E_TEST_EMAIL + E2E_TEST_PASSWORD in .env.local (or CI env)
 */
setup("authenticate", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set for authenticated tests."
    );
  }

  // --- Step 1: navigate to login and fill credentials ---
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  await page.locator("#login-email").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // --- Step 2: wait for redirect away from /login (up to 30s) ---
  await page.waitForURL(/\/(?!login)/, { timeout: 30000 }).catch(async () => {
    const errorText = await page
      .locator('[role="alert"]:not(#__next-route-announcer__)')
      .textContent()
      .catch(() => null);
    throw new Error(
      `Login failed — still on login page (${page.url()}). ` +
        `Page error: ${errorText ?? "none"}. ` +
        `Check E2E_TEST_EMAIL and E2E_TEST_PASSWORD.`
    );
  });

  // --- Step 3: let Supabase JS write the session to localStorage ---
  await page.waitForLoadState("networkidle", { timeout: 20000 });

  // --- Step 4: save the authenticated storage state ---
  await page.context().storageState({ path: ".auth/user.json" });
});
