/**
 * In-process rate limiting for expensive API routes.
 * Keyed by user id when available, otherwise "anon". Prunes expired entries to avoid unbounded growth.
 */

export type RateLimitOptions = {
  windowMs: number;
  maxPerWindow: number;
};

const store = new Map<string, { count: number; resetAt: number }>();

/** Prune entries whose window has expired. */
function prune() {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

/**
 * Check and consume one request from the rate limit for the given key.
 * @returns true if under limit (and increments), false if over limit.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): boolean {
  const { windowMs, maxPerWindow } = options;
  const now = Date.now();

  // Occasional prune to avoid unbounded growth
  if (Math.random() < 0.01) prune();

  let entry = store.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return true;
  }

  if (entry.count >= maxPerWindow) return false;
  entry.count += 1;
  return true;
}

/** Default limits for expensive routes: 10 requests per 60 seconds per key. */
export const DEFAULT_RATE_LIMIT = {
  windowMs: 60_000,
  maxPerWindow: 10,
} as const;
