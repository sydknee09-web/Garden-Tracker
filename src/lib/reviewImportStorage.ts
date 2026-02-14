/**
 * Import review storage -- uses localStorage for persistence across tab closes.
 * Previously used sessionStorage which lost data on tab navigation.
 */

export const REVIEW_IMPORT_STORAGE_KEY = "garden-review-import";

export type ReviewImportItem = {
  id: string;
  /** Empty for link-import items (use hero_image_url for thumbnail) */
  imageBase64: string;
  fileName: string;
  vendor: string;
  type: string;
  variety: string;
  tags: string[];
  purchaseDate: string;
  /** Research (grounding) fields - optional */
  sowing_depth?: string;
  spacing?: string;
  sun_requirement?: string;
  /** Alternative field names from scrape API */
  water?: string;
  sun?: string;
  plant_spacing?: string;
  harvest_days?: number;
  days_to_germination?: string;
  days_to_maturity?: string;
  source_url?: string;
  /** Short description from scrape or research (passed to cache and profile). */
  plant_description?: string;
  /** Scientific name (e.g. Thunbergia alata) from extraction */
  scientific_name?: string;
  /** From link extraction: stock/vendor plant image URL for profile hero and review thumbnail */
  hero_image_url?: string;
  /** From photo extraction research: stock image of actual plant/fruit (not packet) */
  stock_photo_url?: string;
  /** When true, save stock_photo_url or hero_image_url to profile hero_image_url on save. Default true when URL present. */
  useStockPhotoAsHero?: boolean;
  /** True when Pass 1 got 404 for this item's source URL (link may be dead). */
  linkNotFound?: boolean;
  /** Normalized key from plant type + variety for batch duplicate detection */
  identityKey?: string;
  /** Full type/variety from extract for search API */
  originalType?: string;
  originalVariety?: string;
  /** Variety label for table display (cleaned) */
  cleanVariety?: string;
  /** True when another item in the same batch has the same identityKey */
  isPotentialDuplicate?: boolean;
  /** Additional source URLs merged from duplicate rows */
  secondary_urls?: string[];
  /** 0–1 from extract API; when < 0.7, UI can highlight row/inputs for review */
  confidence_score?: number;
  /** Additional packet photos (base64). First image in imageBase64 + these are all saved to the packet. */
  extraPacketImages?: string[];
  /** Optional packet notes (saved to seed_packets.user_notes). */
  user_notes?: string;
  /** Optional storage location (e.g. box, drawer); saved to seed_packets.storage_location. */
  storage_location?: string;
  /** From link import: extract API result; used to know if item was from cache (write to global cache only when not). */
  extractResult?: { cached?: boolean; [key: string]: unknown };
};

export type ReviewImportSource = "purchase_order" | "link" | "photo";

export type ReviewImportData = {
  items: ReviewImportItem[];
  /** When "purchase_order", review page skips auto hero fetch; user must click "Find Hero Photos" to go to hero step. */
  source?: ReviewImportSource;
};

export function getReviewImportData(): ReviewImportData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REVIEW_IMPORT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ReviewImportData;
    return Array.isArray(data?.items) ? data : null;
  } catch {
    return null;
  }
}

export function setReviewImportData(data: ReviewImportData): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REVIEW_IMPORT_STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be full -- try to save anyway
    console.warn("[reviewImportStorage] localStorage full, trying sessionStorage fallback");
    try { sessionStorage.setItem(REVIEW_IMPORT_STORAGE_KEY, JSON.stringify(data)); } catch { /* give up */ }
  }
}

export function clearReviewImportData(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REVIEW_IMPORT_STORAGE_KEY);
  sessionStorage.removeItem(REVIEW_IMPORT_STORAGE_KEY); // clean up any fallback too
}

/** Check if there's pending review data (used to show banner on vault page). */
export function hasPendingReviewData(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(REVIEW_IMPORT_STORAGE_KEY) !== null;
}

// ---------------------------------------------------------------------------
// Progressive import storage -- saves successful items as they complete,
// surviving tab closes and partial imports.
// ---------------------------------------------------------------------------
const PROGRESSIVE_KEY = "garden-import-progress";

export function getProgressiveItems(): ReviewImportItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROGRESSIVE_KEY);
    return raw ? (JSON.parse(raw) as ReviewImportItem[]) : [];
  } catch { return []; }
}

export function addProgressiveItem(item: ReviewImportItem): void {
  if (typeof window === "undefined") return;
  const items = getProgressiveItems();
  items.push(item);
  try { localStorage.setItem(PROGRESSIVE_KEY, JSON.stringify(items)); } catch { /* full */ }
}

export function clearProgressiveItems(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PROGRESSIVE_KEY);
}

// ---------------------------------------------------------------------------
// Pending photo import (camera/file capture)
// ---------------------------------------------------------------------------
export const PENDING_PHOTO_IMPORT_KEY = "garden-pending-photo-import";

export type PendingPhotoImportItem = {
  id: string;
  fileName: string;
  /** Base64 image data (no data URL prefix). */
  imageBase64: string;
};

export type PendingPhotoImportData = {
  items: PendingPhotoImportItem[];
};

export function getPendingPhotoImport(): PendingPhotoImportData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PENDING_PHOTO_IMPORT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PendingPhotoImportData;
    return Array.isArray(data?.items) ? data : null;
  } catch { return null; }
}

export function setPendingPhotoImport(data: PendingPhotoImportData): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(PENDING_PHOTO_IMPORT_KEY, JSON.stringify(data)); } catch { /* full */ }
}

export function clearPendingPhotoImport(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_PHOTO_IMPORT_KEY);
}

// ---------------------------------------------------------------------------
// Pending photo hero import (BatchAddSeed review → hero processing → review-import)
// Items already have extracted vendor/type/variety; hero page runs find-hero-photo only.
// ---------------------------------------------------------------------------
export const PENDING_PHOTO_HERO_KEY = "garden-pending-photo-hero";

export type PendingPhotoHeroItem = {
  id: string;
  imageBase64: string;
  fileName: string;
  vendor: string;
  type: string;
  variety: string;
  tags: string[];
  purchaseDate: string;
};

export type PendingPhotoHeroData = {
  items: PendingPhotoHeroItem[];
};

export function getPendingPhotoHeroImport(): PendingPhotoHeroData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PENDING_PHOTO_HERO_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PendingPhotoHeroData;
    return Array.isArray(data?.items) ? data : null;
  } catch { return null; }
}

export function setPendingPhotoHeroImport(data: PendingPhotoHeroData): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(PENDING_PHOTO_HERO_KEY, JSON.stringify(data)); } catch { /* full */ }
}

export function clearPendingPhotoHeroImport(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_PHOTO_HERO_KEY);
}

// ---------------------------------------------------------------------------
// Pending manual add (Quick Add → loading page → review)
// ---------------------------------------------------------------------------
export const PENDING_MANUAL_ADD_KEY = "garden-pending-manual-add";

export type PendingManualAdd = {
  plantName: string;
  varietyCultivar: string;
  vendor: string;
  volume: string;
  tagsToSave?: string[];
  sourceUrlToSave?: string;
};

export function getPendingManualAdd(): PendingManualAdd | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PENDING_MANUAL_ADD_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PendingManualAdd;
  } catch {
    return null;
  }
}

export function setPendingManualAdd(data: PendingManualAdd): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PENDING_MANUAL_ADD_KEY, JSON.stringify(data));
  } catch {
    /* full */
  }
}

export function clearPendingManualAdd(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PENDING_MANUAL_ADD_KEY);
}
