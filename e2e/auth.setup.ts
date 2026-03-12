import { test as setup } from "@playwright/test";

/**
 * Authenticates for E2E tests by calling the Supabase REST API directly
 * (bypasses the browser login form, which is fragile in headless mode).
 * Injects the session into localStorage and saves storageState.
 *
 * Requires: E2E_TEST_EMAIL + E2E_TEST_PASSWORD + NEXT_PUBLIC_SUPABASE_URL
 *           + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 */
setup("authenticate", async ({ page, request }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!email || !password || !supabaseUrl || !supabaseKey) {
    throw new Error(
      "E2E_TEST_EMAIL, E2E_TEST_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, and " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY must all be set for authenticated tests."
    );
  }

  // --- Step 1: get a session token directly from Supabase REST API ---
  const response = await request.post(
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
      },
      data: { email, password },
    }
  );

  if (!response.ok()) {
    const body = (await response.json()) as {
      error_description?: string;
      message?: string;
    };
    throw new Error(
      `Supabase sign-in failed (${response.status()}): ${body.error_description ?? body.message ?? "unknown error"}`
    );
  }

  const session = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
    expires_in?: number;
    token_type?: string;
    user?: unknown;
  };

  // --- Step 2: load the app so we have an origin to write localStorage into ---
  await page.goto("/login");
  await page.waitForLoadState("domcontentloaded");

  // --- Step 3: inject session into localStorage using Supabase JS v2 key format ---
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
    {
      key: storageKey,
      value: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type ?? "bearer",
        user: session.user,
      },
    }
  );

  // --- Step 4: reload so the app reads the session from localStorage ---
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // --- Step 5: confirm we're not on the login page ---
  const url = page.url();
  if (url.includes("/login")) {
    throw new Error(
      `Session injection failed — app still redirected to /login. ` +
        `Check that the storageKey "${storageKey}" matches what Supabase JS uses.`
    );
  }

  // --- Step 6: save the authenticated storage state ---
  await page.context().storageState({ path: ".auth/user.json" });
});
