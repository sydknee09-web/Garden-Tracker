/**
 * In-memory cache for Calendar page tasks.
 * Shows cached data immediately when navigating back, then refetches in background.
 */

type CachedTasks = {
  tasks: unknown[];
  timestamp: number;
};

const cache = new Map<string, CachedTasks>();

const CACHE_KEY = (userId: string, viewMode: string) => `${userId}:${viewMode}`;

export function getCachedTasks(userId: string, viewMode: string): unknown[] | null {
  const key = CACHE_KEY(userId, viewMode);
  const entry = cache.get(key);
  if (!entry) return null;
  return entry.tasks;
}

export function setCachedTasks(userId: string, viewMode: string, tasks: unknown[]): void {
  const key = CACHE_KEY(userId, viewMode);
  cache.set(key, { tasks, timestamp: Date.now() });
}

/** Clear cache when user logs out (call from auth context if needed). */
export function clearCalendarCache(): void {
  cache.clear();
}
