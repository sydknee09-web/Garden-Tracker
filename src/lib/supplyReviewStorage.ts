/**
 * Supply PO import review storage -- uses localStorage for persistence.
 */

export const SUPPLY_REVIEW_STORAGE_KEY = "garden-supply-review-import";

export type SupplyReviewItem = {
  id: string;
  name: string;
  brand: string;
  category: "fertilizer" | "pesticide" | "soil_amendment" | "other";
  npk: string;
  application_rate: string;
  usage_instructions: string;
  vendor: string;
  quantity: number;
  price?: string;
};

export type SupplyReviewData = {
  items: SupplyReviewItem[];
};

export function getSupplyReviewData(): SupplyReviewData | null {
  if (typeof window === "undefined") return null;
  try {
    let raw = localStorage.getItem(SUPPLY_REVIEW_STORAGE_KEY);
    if (!raw) raw = sessionStorage.getItem(SUPPLY_REVIEW_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SupplyReviewData;
    return Array.isArray(data?.items) ? data : null;
  } catch {
    return null;
  }
}

export function setSupplyReviewData(data: SupplyReviewData): void {
  if (typeof window === "undefined") return;
  const json = JSON.stringify(data);
  try {
    localStorage.setItem(SUPPLY_REVIEW_STORAGE_KEY, json);
  } catch {
    /* localStorage may be full or disabled */
  }
  try {
    sessionStorage.setItem(SUPPLY_REVIEW_STORAGE_KEY, json);
  } catch {
    /* give up */
  }
}

export function clearSupplyReviewData(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SUPPLY_REVIEW_STORAGE_KEY);
    sessionStorage.removeItem(SUPPLY_REVIEW_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
