/**
 * Section-based filter clearing for navigation.
 * When navigating between top-level sections (Vault, Garden, Journal, etc.),
 * clear the destination page's filters so they don't carry over.
 * Exception: Profile → Garden with plant filter (profile/grow URL params) stays applied.
 */

const LAST_NAV_SECTION_KEY = "last-nav-section";

const VAULT_KEYS = [
  "vault-view-mode",
  "vault-status-filter",
  "vault-status-filter-grid",
  "vault-status-filter-list",
  "vault-grid-style",
  "vault-shed-display-style",
  "vault-search",
  "vault-sort",
  "packet-vault-search",
  "packet-vault-status",
  "packet-vault-vendor",
  "packet-vault-sow",
  "packet-vault-sort",
];

const GARDEN_KEYS = [
  "garden-view-mode",
  "garden-active-sort",
  "garden-active-sort-dir",
  "garden-plants-sort",
  "garden-plants-sort-dir",
  "garden-active-display-style",
  "garden-plants-display-style",
];

const JOURNAL_KEYS = ["journal-view-mode"];

export function getNavSection(pathname: string): string {
  if (!pathname || pathname === "/") return "home";
  if (pathname.startsWith("/vault")) return "vault";
  if (pathname === "/garden" || pathname.startsWith("/garden/")) return "garden";
  if (pathname.startsWith("/journal")) return "journal";
  if (pathname.startsWith("/calendar")) return "calendar";
  if (pathname.startsWith("/shed")) return "shed";
  if (pathname === "/shopping-list" || pathname.startsWith("/shopping-list")) return "shopping-list";
  if (pathname.startsWith("/settings")) return "settings";
  return "home";
}

export function getLastNavSection(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(LAST_NAV_SECTION_KEY);
  } catch {
    return null;
  }
}

export function setLastNavSection(section: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(LAST_NAV_SECTION_KEY, section);
  } catch {
    /* ignore */
  }
}

function removeKeys(keys: string[]): void {
  if (typeof window === "undefined") return;
  try {
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

export function clearVaultFilters(): void {
  removeKeys(VAULT_KEYS);
}

export function clearGardenFilters(): void {
  removeKeys(GARDEN_KEYS);
}

export function clearJournalFilters(): void {
  removeKeys(JOURNAL_KEYS);
}

/**
 * Returns true when we should clear this page's filters on mount:
 * last section exists and differs from current section.
 * Returns false on first load, refresh, or when staying in same section.
 */
export function shouldClearFiltersOnMount(pathname: string): boolean {
  const last = getLastNavSection();
  if (!last) return false;
  const current = getNavSection(pathname);
  return last !== current;
}
