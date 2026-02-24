import { test, expect } from "@playwright/test";

test.describe("Public pages", () => {
  test("login page loads", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle(/Garden|Track|Seed/i);
    await page.getByRole("button", { name: /sign in/i }).waitFor({ state: "visible", timeout: 10000 });
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
  });

  test("signup page loads", async ({ page }) => {
    await page.goto("/signup");
    await expect(page).toHaveTitle(/Garden|Track|Seed/i);
    await page.getByRole("button", { name: /create account|sign up/i }).waitFor({ state: "visible", timeout: 10000 });
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
  });

  test("reset-password page loads", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page).toHaveTitle(/Garden|Track|Seed/i);
    await page.getByRole("heading", { name: /forgot password/i }).waitFor({ state: "visible", timeout: 10000 });
    await expect(page.getByLabel(/email/i)).toBeVisible();
  });
});
