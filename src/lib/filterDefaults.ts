/**
 * Persist and restore filter defaults per view.
 * Uses localStorage. Keys: garden-active, garden-plants, vault-profiles, vault-packets, vault-shed.
 */

const PREFIX = "filter-default-";

export function loadFilterDefault<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveFilterDefault(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export function clearFilterDefault(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    // ignore
  }
}

export function hasFilterDefault(key: string): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PREFIX + key) != null;
}

/**
 * Active-filter persistence (Sprint 14 #74). Separate from the saved-DEFAULT helpers above:
 * `sessionStorage`, not `localStorage` — these mirror the CURRENT ad-hoc filter selection so it
 * survives a navigation away + browser/hardware back (which remounts the list and would otherwise
 * reset filters to empty). Ephemeral by design: cleared when the tab session ends, so a fresh
 * session falls back to the saved default. Keyed off the same storageKey the saved default uses.
 */
const ACTIVE_PREFIX = "filter-active-";

export function loadActiveFilters<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(ACTIVE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function saveActiveFilters(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(ACTIVE_PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export const FILTER_DEFAULT_KEYS = {
  gardenActive: "garden-active",
  gardenPlants: "garden-plants",
  vaultProfiles: "vault-profiles",
  vaultPackets: "vault-packets",
  vaultShed: "vault-shed",
} as const;
