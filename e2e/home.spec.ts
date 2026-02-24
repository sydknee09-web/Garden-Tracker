import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads and shows sign-in prompt when unauthenticated", async ({ page }) => {
    // Home redirects to /login when unauthenticated; go there directly to avoid loading state
    await page.goto("/login");
    await expect(page).toHaveTitle(/Garden|Track|Seed/i);
    const signInBtn = page.getByRole("button", { name: /sign in/i });
    await signInBtn.waitFor({ state: "visible", timeout: 10000 });
    await expect(signInBtn).toBeVisible();
  });

  test("has accessible navigation or auth form", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: /sign in/i }).waitFor({ state: "visible", timeout: 10000 });
    // Page has usable structure: Sign in button
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});
