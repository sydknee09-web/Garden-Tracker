/**
 * fetch wrapper with exponential-backoff auto-retry for transient failures.
 *
 * Built for AI image-extraction calls (Gemini-backed routes), which intermittently
 * throw on rate-limit / 503 / timeout and return 500. Without retry the user sees an
 * error on the first hiccup and has to manually re-click 2-3 times (Syd dogfood 2026-06-08).
 *
 * Retries on: a thrown fetch (network drop) OR a retryable HTTP status.
 * Does NOT retry 4xx (400/401/403/404 are permanent — retrying won't help).
 * Returns the final Response (ok or not) so callers keep their existing body-handling.
 */

/** Statuses worth retrying: request timeout, rate-limit, and transient server/gateway errors. */
export const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

/** Default backoff between attempts. delays.length === number of retries after the first attempt. */
export const DEFAULT_RETRY_DELAYS = [1000, 2000];

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface FetchWithRetryOptions {
  /** Backoff waits (ms) between attempts. One entry per retry. Default [1000, 2000] → 3 attempts total. */
  delays?: number[];
  /** fetch implementation (injectable for tests). Default: global fetch. */
  fetchImpl?: typeof fetch;
  /** sleep implementation (injectable for tests). Default: setTimeout-based. */
  sleepImpl?: (ms: number) => Promise<void>;
}

/**
 * Fetch with auto-retry on transient failures.
 *
 * @returns the final Response — including a non-ok one if every attempt failed with a
 *   retryable status. Rejects only if the final attempt itself threw (network error).
 */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const delays = options.delays ?? DEFAULT_RETRY_DELAYS;
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleepImpl ?? defaultSleep;
  const totalAttempts = delays.length + 1;

  let lastError: unknown;

  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    const isLastAttempt = attempt === totalAttempts - 1;
    try {
      const res = await doFetch(input, init);
      // Success or a permanent (non-retryable) failure → return as-is.
      if (res.ok || !RETRYABLE_STATUSES.has(res.status) || isLastAttempt) {
        return res;
      }
      // Retryable status with attempts remaining → wait and retry.
      await sleep(delays[attempt]!);
    } catch (err) {
      // Network-level throw. Retry if attempts remain, otherwise propagate.
      lastError = err;
      if (isLastAttempt) throw err;
      await sleep(delays[attempt]!);
    }
  }

  // Unreachable in practice (loop returns or throws), but satisfies the type checker.
  throw lastError ?? new Error("fetchWithRetry: exhausted without a response");
}
