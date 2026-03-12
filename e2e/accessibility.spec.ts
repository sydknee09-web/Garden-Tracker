import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility audit", () => {
  test("home page has no critical a11y violations", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical, `Critical/serious a11y violations:\n${JSON.stringify(critical, null, 2)}`).toHaveLength(0);
  });

  test("login page has no critical a11y violations", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
    expect(critical, `Critical/serious a11y violations:\n${JSON.stringify(critical, null, 2)}`).toHaveLength(0);
  });
});
