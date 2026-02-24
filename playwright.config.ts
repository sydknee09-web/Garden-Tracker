import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.local" });

/**
 * Playwright E2E config for Garden Tracker.
 * Run: npm run test:e2e
 * Install browsers (first time): npx playwright install
 *
 * Authenticated smoke tests (vault, garden, etc.) run only when
 * E2E_TEST_EMAIL and E2E_TEST_PASSWORD are set (e.g. in .env.local).
 */
const hasAuthCreds = !!(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
    // Authenticated smoke tests (run only when E2E_TEST_EMAIL + E2E_TEST_PASSWORD are set)
    ...(hasAuthCreds
      ? [
          { name: "setup", testMatch: /auth\.setup\.ts/ },
          {
            name: "chromium-authenticated",
            use: { ...devices["Desktop Chrome"], storageState: ".auth/user.json" },
            dependencies: ["setup"],
            testMatch: /smoke-authenticated\.spec\.ts/,
          },
        ]
      : []),
  ],
  // In CI, server is started by the workflow. Locally, start dev server.
  ...(process.env.CI
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: "http://localhost:3000",
          reuseExistingServer: true,
          timeout: 120000,
        },
      }),
});
