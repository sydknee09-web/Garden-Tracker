/**
 * Vendor name normalization for matching and display.
 * Ensures "Floret" / "floret flowers", "Territorial Seed" / "Territorial Seed Company",
 * and "Johnnyseeds" / "Johnny's Selected Seeds" match for cache lookups and hero image.
 */

import { getCanonicalKey } from "@/lib/canonicalKey";

/** Suffix words to strip from the end of vendor names when building match key (order matters). */
const VENDOR_KEY_SUFFIXES = [
  "seeds", "seed", "company", "co", "inc", "llc", "garden", "heirloom",
  "selected", "organic", "store", "shop",
];

/**
 * Normalize vendor to a stable key for matching.
 * "Territorial Seed", "Territorial Seed Company", "TerritorialSeed" → same key.
 */
export function normalizeVendorKey(vendor: string): string {
  if (!vendor || typeof vendor !== "string") return "";
  let s = vendor.trim().toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return "";

  // Strip trailing suffix words (with space)
  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of VENDOR_KEY_SUFFIXES) {
      const re = new RegExp(`\\s+${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
      if (re.test(s)) {
        s = s.replace(re, "").trim();
        changed = true;
        break;
      }
    }
  }
  // Strip trailing "seeds"/"seed" when concatenated (e.g. "johnnyseeds" -> "johnny")
  s = s.replace(/([a-z0-9])seeds?$/i, "$1").trim();
  return getCanonicalKey(s) || getCanonicalKey(vendor.trim()) || "";
}

/**
 * Known canonical display names by normalized key (key = normalizeVendorKey(any variant)).
 * Used so dropdown and saved values prefer one consistent label.
 */
const CANONICAL_BY_KEY: Record<string, string> = {
  bakercreek: "Baker Creek Heirloom Seeds",
  johnnysselectedseeds: "Johnny's Selected Seeds",
  johnnysseeds: "Johnny's Selected Seeds",
  johnnys: "Johnny's Selected Seeds",
  marysheirloomseeds: "Mary's Heirloom Seeds",
  marys: "Mary's Heirloom Seeds",
  territorial: "Territorial Seed Company",
  territorialseed: "Territorial Seed Company",
  edenbrothers: "Eden Brothers",
  outsidepride: "Outsidepride",
  parkseed: "Park Seed",
  burpee: "Burpee",
  botanicalinterests: "Botanical Interests",
  highmowingseeds: "High Mowing Seeds",
  floretflowers: "Floret Flowers",
  floret: "Floret Flowers",
  reneesgarden: "Renee's Garden",
  southernexposure: "Southern Exposure",
  fedcoseeds: "Fedco Seeds",
  hudsonvalleyseed: "Hudson Valley Seed",
  victoryseeds: "Victory Seeds",
  swallowtailgardenseeds: "Swallowtail Garden Seeds",
  swallowtailgarden: "Swallowtail Garden Seeds",
  selectseeds: "Select Seeds",
  rareseeds: "Rare Seeds",
  opencircleseeds: "Open Circle Seeds",
};

/**
 * Prefer canonical display name when we have one; otherwise pick best from variants.
 */
export function pickCanonicalVendorDisplay(variants: string[]): string {
  const trimmed = variants.map((v) => (v ?? "").trim()).filter(Boolean);
  if (trimmed.length === 0) return "";
  if (trimmed.length === 1) return toCanonicalDisplay(trimmed[0]!);

  const byKey = new Map<string, string[]>();
  for (const v of trimmed) {
    const key = normalizeVendorKey(v);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(v);
    byKey.set(key, list);
  }
  // Use first variant's key to pick canonical
  const firstKey = normalizeVendorKey(trimmed[0]!);
  const group = byKey.get(firstKey) ?? trimmed;
  const canonical = CANONICAL_BY_KEY[firstKey] ?? CANONICAL_BY_KEY[normalizeVendorKey(group[0]!)];
  if (canonical) return canonical;
  // Prefer longest title-case style (likely full name)
  const sorted = [...group].sort((a, b) => {
    const aLen = (a ?? "").length;
    const bLen = (b ?? "").length;
    if (bLen !== aLen) return bLen - aLen;
    return (a ?? "").localeCompare(b ?? "");
  });
  return sorted[0] ?? trimmed[0] ?? "";
}

/**
 * Return canonical display name for a single vendor (for saving after user selection).
 */
export function toCanonicalDisplay(vendor: string): string {
  const v = (vendor ?? "").trim();
  if (!v) return "";
  const key = normalizeVendorKey(v);
  return CANONICAL_BY_KEY[key] ?? v;
}

/**
 * Dedupe a list of vendor names by normalized key; each key maps to one display name.
 */
export function dedupeVendorsForSuggestions(vendorNames: string[]): string[] {
  const byKey = new Map<string, string[]>();
  for (const name of vendorNames) {
    const t = (name ?? "").trim();
    if (!t) continue;
    const key = normalizeVendorKey(t);
    if (!key) {
      byKey.set(t, [t]);
      continue;
    }
    const list = byKey.get(key) ?? [];
    if (!list.includes(t)) list.push(t);
    byKey.set(key, list);
  }
  return Array.from(byKey.entries())
    .map(([, group]) => pickCanonicalVendorDisplay(group))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
