import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PLANT_CATEGORY_DEFAULTS, type PlantCategoryKey } from "@/constants/plantDefaults";
import { getZone10bScheduleForPlant } from "@/data/zone10b_schedule";
import {
  getRareseedsSlugFromUrl,
  slugToSpaced,
  rareseedsAutotreatment,
} from "@/lib/rareseedsAutotreatment";

/** Root domains for allowed vendors (no www); subdomains and paths are allowed (e.g. shop.johnnyseeds.com, www.rareseeds.com) */
const ALLOWED_HOST_ROOTS = [
  "johnnyseeds.com",
  "rareseeds.com",
  "marysheirloomseeds.com",
  "territorialseed.com",
  "burpee.com",
  "highmowingseeds.com",
  "botanicalinterests.com",
  "edenbrothers.com",
  "parkseed.com",
  "outsidepride.com",
  "swallowtailgardenseeds.com",
  "superseeds.com",
  "sowrightseeds.com",
  "sandiegoseedcompany.com",
  "victoryseeds.com",
  "hudsonvalleyseed.com",
  "southernexposure.com",
  "fedcoseeds.com",
  "floretflowers.com",
  "reneesgarden.com",
  "theodorepayne.org",
  "nativewest.com",
  "growitalian.com",
  "migardener.com",
  "row7seeds.com",
  "seedsavers.org",
  "selectseeds.com",
];

function isAllowedUrl(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return ALLOWED_HOST_ROOTS.some(
    (root) => host === root || host.endsWith("." + root)
  );
}

/** Strip common vendor noise from plant type so "Non Gmo Burgundy Okra" → "Okra" for category lookup. */
function sanitizePlantType(type: string): string {
  if (!type || !type.trim()) return type;
  const noise = [
    /\bnon\s*[- ]?gmo\b/gi,
    /\bheirloom\b/gi,
    /\borganic\b/gi,
    /\bburgundy\b/gi,
    /\bhybrid\b/gi,
    /\bopen\s*pollinated\b/gi,
    /\bop\b/gi,
    /\bheritage\b/gi,
    /\bnon\s*hybrid\b/gi,
    /\bseeds?\b/gi,
    /\bvariety\b/gi,
    /\bpack\b/gi,
  ];
  let out = type.trim();
  for (const re of noise) {
    out = out.replace(re, " ").replace(/\s+/g, " ").trim();
  }
  return out.trim();
}

/** Same noise list for cleaning titles so plant/variety parsing matches single-upload behavior. */
function stripTitleNoise(title: string): string {
  if (!title || !title.trim()) return title;
  return sanitizePlantType(title);
}

/** Strip Organic, Seeds, and trailing numeric IDs from Fedco (and similar) slug parts for variety/plant cleaning. */
function stripFedcoSlugNoise(s: string): string {
  if (!s || !s.trim()) return s;
  return s
    .replace(/\borganic\b/gi, " ")
    .replace(/\bseeds?\b/gi, " ")
    .replace(/\s*[-_]?\d+\s*$/i, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip product IDs (prod003168), hybrid, organic, seeds from final plant/variety names for vault display. */
function stripVaultNoise(s: string): string {
  if (!s || !s.trim()) return s;
  return s
    .replace(/\bprod[a-z0-9]*\b/gi, " ")
    .replace(/\bhybrid\b/gi, " ")
    .replace(/\borganic\b/gi, " ")
    .replace(/\bseeds?\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse URL slug into plant (first segment) and variety (rest). Segments cleaned with stripVaultNoise. */
function parseSlugPlantVariety(slug: string): { plant_name: string; variety_name: string } {
  const noTrailingNum = slug.replace(/[-_]?\d+$/i, "").trim();
  const parts = noTrailingNum.split(/[-_]/).map((p) => stripVaultNoise(p)).filter(Boolean);
  if (parts.length === 0) return { plant_name: "General", variety_name: "" };
  if (parts.length === 1) return { plant_name: toTitleCase(parts[0]!), variety_name: "" };
  return {
    plant_name: toTitleCase(parts[0]!),
    variety_name: toTitleCase(parts.slice(1).join(" ")),
  };
}

/** Broad categories that must not be saved as plant_type; re-map from variety or URL slug. */
const FORBIDDEN_BROAD_TYPES = ["Herbs", "Flowers", "Vegetables", "Seeds"];

function isForbiddenBroadType(plant: string): boolean {
  return FORBIDDEN_BROAD_TYPES.some((t) => t.toLowerCase() === (plant ?? "").trim().toLowerCase());
}

/**
 * Parse Eden Brothers product slug for plant and variety so variety comes from URL, not page "Hot".
 * e.g. lobelia-seeds-starship-blue → Lobelia / Starship Blue; pepper-seeds-cayennetta → Pepper / Cayennetta;
 * organic-jalapeno-early-pepper-seeds → Pepper / Jalapeno Early.
 * Underscore slugs: annual_phlox_seeds_dwarf_mixed → Phlox / Dwarf Mixed; mixed_annual_phlox_seeds → Phlox / Mixed; red_annual_phlox_seeds → Phlox / Red.
 */
function parseEdenBrothersSlug(slug: string): { plant_name: string; variety_name: string } | null {
  const s = slug.trim();
  if (!s || s.length < 3) return null;
  const lower = s.toLowerCase();

  // Underscore slugs: annual_phlox_seeds_dwarf_mixed, mixed_annual_phlox_seeds, red_annual_phlox_seeds
  const parts = s.replace(/-/g, "_").split("_").filter(Boolean);
  const partsLower = parts.map((p) => p.toLowerCase());
  const phloxIdx = partsLower.indexOf("phlox");
  const seedsIdx = partsLower.indexOf("seeds");
  const annualIdx = partsLower.indexOf("annual");
  if (phloxIdx !== -1 && seedsIdx !== -1 && seedsIdx >= phloxIdx) {
    const plant_name = "Phlox";
    let variety_name = "";
    if (seedsIdx + 1 < parts.length) {
      variety_name = parts.slice(seedsIdx + 1).map((p) => stripVaultNoise(p)).filter(Boolean).join(" ");
    } else if (annualIdx !== -1 && annualIdx > 0) {
      variety_name = parts.slice(0, annualIdx).map((p) => stripVaultNoise(p)).filter(Boolean).join(" ");
    } else if (phloxIdx > 0) {
      variety_name = parts.slice(0, phloxIdx).map((p) => stripVaultNoise(p)).filter(Boolean).join(" ");
    }
    variety_name = toTitleCase(variety_name.trim()) || "";
    if (variety_name || plant_name) {
      return { plant_name, variety_name };
    }
  }

  // Underscore: dwarf_nasturtium_seeds → Nasturtium / Dwarf (variety before plant)
  const nasturtiumIdx = partsLower.indexOf("nasturtium");
  if (nasturtiumIdx !== -1 && seedsIdx !== -1 && seedsIdx > nasturtiumIdx) {
    const variety_name = parts.slice(0, nasturtiumIdx).map((p) => stripVaultNoise(p)).filter(Boolean).join(" ");
    if (variety_name) {
      return { plant_name: "Nasturtium", variety_name: toTitleCase(variety_name) };
    }
  }

  // Hyphen: nasturtium-alaska-mix → Nasturtium / Alaska Mix (plant first, then variety; trailing -mix is part of variety)
  if (!lower.includes("-seeds-") && parts.length >= 2) {
    const first = partsLower[0] ?? "";
    if (first === "nasturtium") {
      const varietyPart = parts.slice(1).map((p) => stripVaultNoise(p)).filter(Boolean).join(" ");
      if (varietyPart) {
        return { plant_name: "Nasturtium", variety_name: toTitleCase(varietyPart) };
      }
    }
  }

  if (lower.includes("-seeds-")) {
    const idx = lower.indexOf("-seeds-");
    const plantPart = s.slice(0, idx).replace(/-/g, " ").trim();
    const varietyPart = s.slice(idx + 7).replace(/-/g, " ").trim();
    if (plantPart && varietyPart) {
      return {
        plant_name: toTitleCase(stripVaultNoise(plantPart)) || "General",
        variety_name: toTitleCase(stripVaultNoise(varietyPart)) || "",
      };
    }
  }
  const plantSuffixMatch = s.match(/^(.+?)-(pepper|tomato|lettuce|cucumber|bean|squash)s?-seeds?$/i);
  if (plantSuffixMatch) {
    const varietyPart = plantSuffixMatch[1]!
      .replace(/^organic-?/i, "")
      .replace(/-/g, " ")
      .trim();
    const plant = plantSuffixMatch[2]!;
    if (varietyPart) {
      return {
        plant_name: toTitleCase(plant),
        variety_name: toTitleCase(stripVaultNoise(varietyPart)) || "",
      };
    }
  }
  return null;
}

/**
 * Parse Fedco URL slug (e.g. maxibel-organic-bush-haricots-verts-249) into plant_name and variety_name.
 * Never use "Fedco" as plant type. Maps haricots-verts / bush-bean → Bean; variety e.g. "Maxibel Bush Haricots Verts".
 * Strips organic, seeds, trailing numeric IDs from variety.
 */
function parseFedcoSlug(slug: string): { plant_name: string; variety_name: string } {
  const noTrailingNum = slug.replace(/[-_]?\d+$/i, "").trim();
  const parts = noTrailingNum.split(/[-_]/).filter(Boolean);
  const slugLower = noTrailingNum.toLowerCase();

  if (/\bharicots-verts\b|\bharicotsverts\b/.test(slugLower) || /\bbush-bean\b|\bbushbean\b/.test(slugLower)) {
    const plantType = "Bean";
    const varietyParts = parts.map((p) => stripFedcoSlugNoise(p)).filter(Boolean);
    const variety = toTitleCase(varietyParts.join(" ")) || "";
    return { plant_name: plantType, variety_name: variety };
  }

  if (parts.length === 0) return { plant_name: "General", variety_name: "" };
  const cleaned = parts.map((p) => stripFedcoSlugNoise(p)).filter(Boolean);
  if (cleaned.length === 0) return { plant_name: "General", variety_name: "" };
  if (cleaned.length === 1) return { plant_name: toTitleCase(cleaned[0]!), variety_name: "" };
  return { plant_name: toTitleCase(cleaned[cleaned.length - 1]!), variety_name: toTitleCase(cleaned.slice(0, -1).join(" ")) };
}

/** PROPER-style: first letter of each word capitalized. */
function toTitleCase(s: string): string {
  if (!s || !s.trim()) return s;
  return s.trim().replace(/(^|\s)(\w)/g, (_, before, letter) => before + letter.toUpperCase());
}

/** Host (lowercase, with or without www) -> vendor display name. Aligns with single-upload import. */
const HOST_TO_VENDOR: Record<string, string> = {
  "rareseeds.com": "Baker Creek",
  "www.rareseeds.com": "Baker Creek",
  "johnnyseeds.com": "Johnny's Seeds",
  "www.johnnyseeds.com": "Johnny's Seeds",
  "marysheirloomseeds.com": "Mary's",
  "www.marysheirloomseeds.com": "Mary's",
  "territorialseed.com": "Territorial",
  "www.territorialseed.com": "Territorial",
  "edenbrothers.com": "Eden Brothers",
  "www.edenbrothers.com": "Eden Brothers",
  "outsidepride.com": "Outsidepride",
  "www.outsidepride.com": "Outsidepride",
  "parkseed.com": "Park Seed",
  "www.parkseed.com": "Park Seed",
  "burpee.com": "Burpee",
  "www.burpee.com": "Burpee",
  "botanicalinterests.com": "Botanical Interests",
  "www.botanicalinterests.com": "Botanical Interests",
  "highmowingseeds.com": "High Mowing Seeds",
  "floretflowers.com": "Floret Flowers",
  "www.floretflowers.com": "Floret Flowers",
  "shop.floretflowers.com": "Floret Flowers",
  "reneesgarden.com": "Renee's Garden",
  "southernexposure.com": "Southern Exposure",
  "fedcoseeds.com": "Fedco Seeds",
  "hudsonvalleyseed.com": "Hudson Valley Seed",
  "victoryseeds.com": "Victory Seeds",
  "swallowtailgardenseeds.com": "Swallowtail Garden Seeds",
  "selectseeds.com": "Select Seeds",
  "www.selectseeds.com": "Select Seeds",
  "sowrightseeds.com": "Sow Right Seeds",
  "www.sowrightseeds.com": "Sow Right Seeds",
  "seedsavers.org": "Seed Savers Exchange",
  "row7seeds.com": "Row 7 Seeds",
  "www.row7seeds.com": "Row 7 Seeds",
};

/**
 * Parse a cleaned product title into plant_name (e.g. Tomato) and variety_name (e.g. Sun Gold).
 * Uses PLANT_CATEGORY_DEFAULTS to detect plant; rest is variety. Same cleaning as single upload.
 */
function parsePlantVarietyFromTitle(title: string): { plant_name: string; variety_name: string } {
  const cleaned = stripTitleNoise(title).trim();
  if (!cleaned) return { plant_name: "General", variety_name: "" };
  const keys = Object.keys(PLANT_CATEGORY_DEFAULTS) as PlantCategoryKey[];
  const byLen = [...keys].sort((a, b) => b.length - a.length);
  const lower = cleaned.toLowerCase();
  let bestKey: string | null = null;
  let bestEnd = -1;
  for (const key of byLen) {
    const keyLower = key.toLowerCase();
    const idx = lower.lastIndexOf(keyLower);
    if (idx === -1) continue;
    const end = idx + keyLower.length;
    if (end === lower.length || (end < lower.length && /\s/.test(lower[end]))) {
      if (idx === 0 || /\s/.test(lower[idx - 1])) {
        if (end > bestEnd) {
          bestEnd = end;
          bestKey = key;
        }
      }
    }
  }
  if (bestKey) {
    const before = cleaned.slice(0, bestEnd - bestKey.length).trim();
    const after = cleaned.slice(bestEnd).trim();
    const variety = stripTitleNoise(before).trim() || stripTitleNoise(after).trim();
    return {
      plant_name: toTitleCase(bestKey),
      variety_name: variety ? toTitleCase(variety) : "",
    };
  }
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { plant_name: "General", variety_name: "" };
  if (words.length === 1) return { plant_name: toTitleCase(words[0]), variety_name: "" };
  const last = words[words.length - 1];
  const rest = words.slice(0, -1).join(" ");
  return { plant_name: toTitleCase(last), variety_name: toTitleCase(rest) };
}

/**
 * Derive plant_name, variety_name, vendor_name from payload + url + metadata so batch and single upload stay consistent.
 * Applies vendor-specific surgical overrides: Territorial (title split + strip), Floret (variety from URL).
 */
function getStructuredNameVendor(
  payload: Record<string, unknown>,
  requestUrl: URL,
  metadata?: OgMetadata | null
): { plant_name: string; variety_name: string; vendor_name: string } {
  let ogTitle = (payload.ogTitle as string | null | undefined) ?? metadata?.ogTitle ?? "";
  let rawTitle = typeof ogTitle === "string" ? ogTitle.trim() : "";
  const host = requestUrl.hostname.toLowerCase().replace(/^www\./, "");
  const fullHost = requestUrl.hostname.toLowerCase();

  if (host.includes("selectseeds.com") && rawTitle) {
    rawTitle = rawTitle.replace(/\.aspx\b/gi, "").trim();
  }

  if (host.includes("territorialseed.com") && rawTitle) {
    rawTitle = rawTitle.split("|")[0].trim();
    rawTitle = rawTitle
      .replace(/\bSeed\b/gi, " ")
      .replace(/\bPelleted\b/gi, " ")
      .replace(/\bTape\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  let plant_name: string;
  let variety_name: string;

  if (host.includes("selectseeds.com") && /cupani/i.test(rawTitle || requestUrl.pathname)) {
    plant_name = "Sweet Pea";
    variety_name = "Cupani";
  } else if (host.includes("sowrightseeds.com") && /^cucumber\s+/i.test(rawTitle || "")) {
    plant_name = "Cucumber";
    variety_name = (rawTitle || "").replace(/^cucumber\s+/i, "").trim() || "";
  } else if (host.includes("floretflowers.com") && rawTitle) {
    const cleaned = stripTitleNoise(rawTitle).trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      plant_name = toTitleCase(words[0]);
      variety_name = toTitleCase(words.slice(1).join(" "));
    } else if (words.length === 1) {
      plant_name = toTitleCase(words[0]);
      variety_name = "";
    } else {
      const parsed = parsePlantVarietyFromTitle(rawTitle || "General");
      plant_name = parsed.plant_name;
      variety_name = parsed.variety_name;
    }
  } else if (host.includes("edenbrothers.com")) {
    const pathSegments = requestUrl.pathname.split("/").filter(Boolean);
    const slug = (pathSegments.pop() ?? "").replace(/\.(html?|aspx|php)$/i, "").trim();
    const fromSlug = slug ? parseEdenBrothersSlug(slug) : null;
    if (fromSlug && (fromSlug.plant_name !== "General" || fromSlug.variety_name)) {
      plant_name = fromSlug.plant_name;
      variety_name = fromSlug.variety_name;
    } else if (rawTitle) {
      let cleaned = rawTitle.replace(/\bSeeds?\s*$/i, "").trim();
      cleaned = stripTitleNoise(cleaned).trim();
      const keys = Object.keys(PLANT_CATEGORY_DEFAULTS) as PlantCategoryKey[];
      const byLen = [...keys].sort((a, b) => b.length - a.length);
      const lower = cleaned.toLowerCase();
      let bestKey: string | null = null;
      let bestEnd = -1;
      for (const key of byLen) {
        const keyLower = key.toLowerCase();
        const idx = lower.lastIndexOf(keyLower);
        if (idx === -1) continue;
        const end = idx + keyLower.length;
        if (end === lower.length || (end < lower.length && /\s/.test(lower[end]))) {
          if (idx === 0 || /\s/.test(lower[idx - 1])) {
            if (end > bestEnd) {
              bestEnd = end;
              bestKey = key;
            }
          }
        }
      }
      if (bestKey) {
        const before = cleaned.slice(0, bestEnd - bestKey.length).trim();
        plant_name = toTitleCase(bestKey);
        variety_name = before ? toTitleCase(stripTitleNoise(before).trim()) : "";
      } else {
        const parsed = parsePlantVarietyFromTitle(cleaned || "General");
        plant_name = parsed.plant_name;
        variety_name = parsed.variety_name;
      }
    } else {
      plant_name = "General";
      variety_name = "";
    }
  } else if (host.includes("rareseeds.com") && rawTitle) {
    const fromBreadcrumb = (payload.plant_name_from_breadcrumb as string | null | undefined)?.trim();
    if (fromBreadcrumb) {
      plant_name = toTitleCase(fromBreadcrumb);
      const titleCleaned = stripTitleNoise(rawTitle).trim();
      const plantLower = fromBreadcrumb.toLowerCase();
      let variety = titleCleaned;
      const idx = variety.toLowerCase().lastIndexOf(plantLower);
      if (idx !== -1) {
        const before = variety.slice(0, idx).trim();
        const after = variety.slice(idx + plantLower.length).trim();
        variety = (before + " " + after).replace(/\s+/g, " ").trim();
      }
      variety_name = variety ? toTitleCase(variety) : "";
    } else {
      const parsed = parsePlantVarietyFromTitle(rawTitle || "General");
      plant_name = parsed.plant_name;
      variety_name = parsed.variety_name;
    }
    if (!variety_name || /^[-—–]\s*$/.test(variety_name.trim())) {
      const pathSegments = requestUrl.pathname.split("/").filter(Boolean);
      const slug = (pathSegments.pop() ?? "").replace(/\.(html?|aspx|php)$/i, "").trim();
      if (slug) {
        const fromSlug = parseSlugPlantVariety(slug);
        plant_name = fromSlug.plant_name;
        variety_name = fromSlug.variety_name;
      }
    }
  } else if (host.includes("growitalian.com") && rawTitle) {
    const cleaned = stripTitleNoise(rawTitle).trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      plant_name = toTitleCase(words[0]);
      variety_name = toTitleCase(words.slice(1).join(" "));
    } else if (words.length === 1) {
      plant_name = toTitleCase(words[0]);
      variety_name = "";
    } else {
      const parsed = parsePlantVarietyFromTitle(rawTitle || "General");
      plant_name = parsed.plant_name;
      variety_name = parsed.variety_name;
    }
  } else if (host.includes("burpee.com")) {
    const pathSegments = requestUrl.pathname.split("/").filter(Boolean);
    const slug = (pathSegments.pop() ?? "").replace(/\.(html?|aspx|php)$/i, "").trim();
    const titleLooksLikeProductCode = /^prod\d+$/i.test((rawTitle ?? "").trim());
    if (titleLooksLikeProductCode && slug) {
      const fromSlug = parseSlugPlantVariety(slug);
      plant_name = fromSlug.plant_name;
      variety_name = fromSlug.variety_name;
    } else if (rawTitle) {
      const commaIdx = rawTitle.indexOf(",");
      if (commaIdx !== -1) {
        plant_name = toTitleCase(rawTitle.slice(0, commaIdx).trim());
        variety_name = toTitleCase(rawTitle.slice(commaIdx + 1).trim());
      } else {
        const parsed = parsePlantVarietyFromTitle(rawTitle || "General");
        plant_name = parsed.plant_name;
        variety_name = parsed.variety_name;
      }
      if (!variety_name || /^[-—–]\s*$/.test(variety_name.trim())) {
        if (slug) {
          const fromSlug = parseSlugPlantVariety(slug);
          plant_name = fromSlug.plant_name;
          variety_name = fromSlug.variety_name;
        }
      }
    } else if (slug) {
      const fromSlug = parseSlugPlantVariety(slug);
      plant_name = fromSlug.plant_name;
      variety_name = fromSlug.variety_name;
    } else {
      plant_name = "General";
      variety_name = "";
    }
  } else if (host.includes("row7seeds.com") && rawTitle) {
    const cleaned = rawTitle.replace(/\bSeeds\s*$/i, "").trim();
    const words = cleaned.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      plant_name = toTitleCase(words[words.length - 1] ?? "");
      variety_name = toTitleCase(words.slice(0, -1).join(" "));
    } else if (words.length === 1) {
      plant_name = toTitleCase(words[0] ?? "");
      variety_name = "";
    } else {
      const parsed = parsePlantVarietyFromTitle(rawTitle || "General");
      plant_name = parsed.plant_name;
      variety_name = parsed.variety_name;
    }
  } else if (host.includes("outsidepride.com")) {
    // Outsidepride: derive plant/variety from URL path and slug only — do not use title/default "Flower".
    // e.g. /seed/flower-seed/viola/sweet-violet-seeds-reine-de-neiges → Sweet Violet / Reine De Neiges
    // e.g. /seed/flower-seed/stokesia-seeds/stokesia-seeds-white-star → Stokesia / White Star
    const pathSegments = requestUrl.pathname.split("/").filter(Boolean);
    const slugWithExt = pathSegments.pop() ?? "";
    const slug = slugWithExt.replace(/\.(html?|aspx|php)$/i, "").trim();
    const categorySegment = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] ?? "" : "";

    if (slug) {
      const lower = slug.toLowerCase();
      // Pattern: something-seeds-something (e.g. sweet-violet-seeds-reine-de-neiges) → plant from left, variety from right
      if (lower.includes("-seeds-")) {
        const idx = lower.indexOf("-seeds-");
        const leftPart = slug.slice(0, idx).replace(/-/g, " ").trim();
        const rightPart = slug.slice(idx + 7).replace(/-/g, " ").trim();
        if (leftPart && rightPart) {
          plant_name = toTitleCase(stripVaultNoise(leftPart));
          variety_name = toTitleCase(stripVaultNoise(rightPart));
        }
      }
      if (!plant_name || !variety_name) {
        // Pattern: {plant}-seeds-{variety} (e.g. stokesia-seeds-white-star) — plant from path segment or slug prefix
        const categoryLower = categorySegment.toLowerCase().replace(/-/g, " ");
        let plantFromCategory = "";
        if (categorySegment) {
          if (categorySegment.toLowerCase().endsWith("-seeds")) {
            plantFromCategory = categorySegment.slice(0, -6).replace(/-/g, " ").trim();
          } else if (categorySegment.toLowerCase() !== "flower-seed" && categorySegment.toLowerCase() !== "flower") {
            plantFromCategory = categorySegment.replace(/-/g, " ").trim();
          }
        }
        const plantFromSlug = (lower.split("-seeds-")[0] ?? "").replace(/-/g, " ").trim();
        const plantBase = plantFromCategory || plantFromSlug;
        if (plantBase) {
          plant_name = toTitleCase(plantBase);
          const prefixToStrip = (plantBase.toLowerCase() + "-seeds-").replace(/\s+/g, "-");
          let varietySlug = lower;
          if (lower.startsWith(prefixToStrip)) {
            varietySlug = lower.slice(prefixToStrip.length).replace(/-/g, " ").trim();
          } else if (lower.startsWith(plantBase.toLowerCase().replace(/\s+/g, "-") + "-seeds-")) {
            varietySlug = lower.slice((plantBase.toLowerCase().replace(/\s+/g, "-") + "-seeds-").length).replace(/-/g, " ").trim();
          }
          variety_name = varietySlug ? toTitleCase(stripVaultNoise(varietySlug)) : "";
        }
      }
    }
    if (!plant_name) {
      plant_name = categorySegment ? toTitleCase(categorySegment.replace(/-/g, " ")) : "General";
      variety_name = slug ? toTitleCase(slug.replace(/-/g, " ")) : "";
    }
    if (plant_name === "General" && slug) {
      const parts = slug.split("-").filter(Boolean);
      plant_name = parts.length ? toTitleCase(parts[0] ?? "") : "General";
      variety_name = parts.length > 1 ? toTitleCase(parts.slice(1).join(" ")) : "";
    }
    // Never use generic "Flower" for Outsidepride — prefer first meaningful part of slug
    if (/^flower(s|\s*seed)?$/i.test((plant_name ?? "").trim()) && slug) {
      const first = slug.split("-").filter(Boolean)[0];
      if (first) plant_name = toTitleCase(first);
    }
    // User preference: "Sweet Violet" → "Sweet Viola" for display
    if (plant_name === "Sweet Violet") plant_name = "Sweet Viola";
  } else if (host.includes("swallowtailgardenseeds.com")) {
    const pathSegments = requestUrl.pathname.split("/").filter(Boolean);
    const slugWithExt = pathSegments.pop() ?? "";
    const slug = slugWithExt.replace(/\.(html?|aspx|php)$/i, "").trim();
    const topCategories = ["annuals", "perennials", "herbs", "vegetables", "bulk", "flowering-vines"];
    if (pathSegments.length >= 1 && slug) {
      const plantSegment = pathSegments[pathSegments.length - 1] ?? "";
      const plantLower = plantSegment.toLowerCase().replace(/-/g, " ");
      if (!topCategories.includes(plantSegment.toLowerCase())) {
        const plantTitle = toTitleCase(plantSegment.replace(/-/g, " "));
        plant_name = plantTitle.endsWith("s") && plantTitle.length > 1 ? plantTitle.slice(0, -1) : plantTitle;
        let varietySlug = slug
          .replace(/-seeds?$/gi, "")
          .replace(/-flower(s)?$/gi, "")
          .trim();
        const plantForStrip = plant_name.toLowerCase();
        if (varietySlug.toLowerCase().endsWith(plantForStrip)) {
          varietySlug = varietySlug.slice(0, -plantForStrip.length).replace(/-+$/, "").trim();
        }
        if (varietySlug && varietySlug.toLowerCase() !== plantForStrip) {
          variety_name = toTitleCase(stripVaultNoise(varietySlug.replace(/-/g, " "))) || "";
        } else {
          variety_name = rawTitle ? toTitleCase(stripTitleNoise(rawTitle).trim()) : "";
        }
      } else {
        const fromSlug = parseSlugPlantVariety(slug);
        plant_name = fromSlug.plant_name;
        variety_name = fromSlug.variety_name;
      }
    } else if (pathSegments.length >= 1) {
      const plantSegment = pathSegments[pathSegments.length - 1] ?? "";
      if (!topCategories.includes(plantSegment.toLowerCase())) {
        plant_name = toTitleCase(plantSegment.replace(/-/g, " "));
        variety_name = rawTitle ? toTitleCase(stripTitleNoise(rawTitle).trim()) : "";
      } else {
        const parsed = parsePlantVarietyFromTitle(rawTitle || "General");
        plant_name = parsed.plant_name;
        variety_name = parsed.variety_name;
      }
    } else {
      const parsed = parsePlantVarietyFromTitle(rawTitle || "General");
      plant_name = parsed.plant_name;
      variety_name = parsed.variety_name;
    }
  } else if (host.includes("fedcoseeds.com")) {
    const pathSegments = requestUrl.pathname.split("/").filter(Boolean);
    const slugWithExt = pathSegments.pop() ?? "";
    const slug = slugWithExt.replace(/\.(html?|aspx|php)$/i, "").trim();
    if (slug) {
      const parsed = parseFedcoSlug(slug);
      plant_name = parsed.plant_name;
      variety_name = parsed.variety_name;
    } else {
      const parsed = parsePlantVarietyFromTitle(rawTitle || "General");
      plant_name = parsed.plant_name === "Fedco" ? "General" : parsed.plant_name;
      variety_name = parsed.variety_name;
    }
    variety_name = stripFedcoSlugNoise(variety_name).replace(/\s*[-|:]+\s*$/g, "").trim();
    if (plant_name === "Fedco") plant_name = "General";
  } else if (host.includes("johnnyseeds.com")) {
    // Johnny's URL: either category/plant/variety-slug (3+ parts) or category/slug (2 parts, e.g. /herbs/stevia).
    const pathSegments = requestUrl.pathname.split("/").filter(Boolean);
    const slugWithExt = pathSegments.pop() ?? "";
    const slug = slugWithExt.replace(/\.(html?|aspx|php)$/i, "").trim();
    const productCodePattern = /-\d+[a-z]*$/i;
    const slugWithoutCode = slug.replace(productCodePattern, "").replace(/-+$/, "").trim();
    const titleLooksLikeProductCode = /^\d+[a-z]*$/i.test((rawTitle ?? "").trim()) || ((rawTitle ?? "").trim().length <= 8 && /\d+[a-z]*/i.test(rawTitle ?? ""));

    // Two-part URL: /category/slug (e.g. /herbs/stevia) — slug is the plant name, avoid "General"
    if (pathSegments.length === 1 && slug) {
      plant_name = toTitleCase(slug.replace(/-/g, " "));
      variety_name = rawTitle && !titleLooksLikeProductCode ? toTitleCase(stripTitleNoise(rawTitle).trim()) : "";
    } else if (pathSegments.length >= 2 && (slugWithoutCode || titleLooksLikeProductCode)) {
      // Standard: last path segment = plant, slug = variety (e.g. vegetables/beans/bush-beans/provider-bean-seed-10)
      const plantSegment = pathSegments[pathSegments.length - 1];
      if (plantSegment) {
        plant_name = toTitleCase(plantSegment.replace(/-/g, " "));
        if (slugWithoutCode) {
          let varietySlug = slugWithoutCode
            .replace(/-organic\b/gi, "")
            .replace(/-lettuce\b/gi, "")
            .replace(/-seeds?\b/gi, "")
            .replace(/-bean(-seed)?$/gi, "")
            .replace(/-+/g, " ")
            .trim();
          const plantLower = plant_name.toLowerCase().replace(/\s+/g, " ");
          if (varietySlug.toLowerCase().endsWith(plantLower)) {
            varietySlug = varietySlug.slice(0, -plantLower.length).trim();
          }
          variety_name = toTitleCase(stripVaultNoise(varietySlug)) || "";
        } else {
          variety_name = rawTitle && !titleLooksLikeProductCode ? toTitleCase(stripTitleNoise(rawTitle).trim()) : "";
        }
      } else {
        const parsed = parsePlantVarietyFromTitle(rawTitle || "General");
        plant_name = parsed.plant_name;
        variety_name = parsed.variety_name;
      }
    } else {
      const parsed = parsePlantVarietyFromTitle(rawTitle || "General");
      plant_name = parsed.plant_name;
      variety_name = parsed.variety_name;
    }
  } else {
    const parsed = parsePlantVarietyFromTitle(rawTitle || "General");
    plant_name = parsed.plant_name;
    variety_name = parsed.variety_name;
  }

  variety_name = variety_name.replace(/\s*[-|:]+\s*$/g, "").trim();
  if (host.includes("fedcoseeds.com") && (plant_name === "Fedco" || /^fedco\s*$/i.test(plant_name))) {
    plant_name = "General";
  }

  if (isForbiddenBroadType(plant_name)) {
    const pathSegments = requestUrl.pathname.split("/").filter(Boolean);
    const slug = (pathSegments.pop() ?? "").replace(/\.(html?|aspx|php)$/i, "").trim();
    const slugHasParts = slug && /[-_]/.test(slug);
    // Renee's Garden (e.g. /products/arugula-runway): prefer URL slug when header is broad (Herbs/Flowers).
    if (host.includes("reneesgarden.com") && slugHasParts) {
      const fromSlug = parseSlugPlantVariety(slug);
      if (fromSlug.plant_name && !isForbiddenBroadType(fromSlug.plant_name)) {
        plant_name = fromSlug.plant_name;
        variety_name = fromSlug.variety_name;
      }
    }
    if (isForbiddenBroadType(plant_name)) {
      const varietyWords = (variety_name ?? "").trim().split(/\s+/).filter(Boolean);
      if (varietyWords.length >= 2) {
        plant_name = toTitleCase(varietyWords[varietyWords.length - 1]!);
        variety_name = toTitleCase(varietyWords.slice(0, -1).join(" "));
      } else if (slugHasParts) {
        const fromSlug = parseSlugPlantVariety(slug);
        if (fromSlug.plant_name && !isForbiddenBroadType(fromSlug.plant_name)) {
          plant_name = fromSlug.plant_name;
          variety_name = fromSlug.variety_name;
        }
      }
    }
  }

  plant_name = toTitleCase(stripVaultNoise(plant_name)) || plant_name || "General";
  variety_name = toTitleCase(stripVaultNoise(variety_name)) || variety_name;

  // High Mowing: "Pelleted" is a tag (seed form), not plant or variety — strip so it doesn't show as name
  if (host.includes("highmowingseeds.com")) {
    plant_name = plant_name.replace(/\s*Pelleted\s*/gi, " ").replace(/\s+/g, " ").trim() || plant_name;
    variety_name = variety_name.replace(/\s*Pelleted\s*/gi, " ").replace(/\s+/g, " ").trim() || variety_name;
  }

  let vendor_name = (payload.vendor as string | null | undefined) ?? metadata?.ogSiteName ?? null;
  if (typeof vendor_name === "string") vendor_name = stripHtmlAndDecode(vendor_name).trim() || null;
  if (!vendor_name) {
    vendor_name = HOST_TO_VENDOR[host] ?? HOST_TO_VENDOR[fullHost] ?? "";
  }
  // Standardize Rare Seeds identity for Golden Record merging (rareseeds.com -> "Rare Seeds").
  if (host.includes("rareseeds.com")) vendor_name = "Rare Seeds";
  return { plant_name, variety_name, vendor_name: vendor_name ?? "" };
}

/** Prefer category key that matches the sanitized type (e.g. "Okra"), else match from plant name. */
function getPlantCategoryFromTypeOrName(typeFromPage: string | null | undefined, plantName: string): PlantCategoryKey | null {
  const keys = Object.keys(PLANT_CATEGORY_DEFAULTS) as PlantCategoryKey[];
  const byLen = [...keys].sort((a, b) => b.length - a.length);
  if (typeFromPage && typeFromPage.trim()) {
    const sanitized = sanitizePlantType(typeFromPage).toLowerCase();
    if (sanitized) {
      for (const key of byLen) {
        const keyLower = key.toLowerCase();
        if (keyLower === sanitized) return key;
        if (sanitized.includes(keyLower)) return key;
        if (key.includes(" ") && keyLower.split(/\s+/).every((w) => sanitized.includes(w))) return key;
      }
    }
  }
  const name = plantName.trim().toLowerCase();
  if (!name) return null;
  for (const key of byLen) {
    const keyLower = key.toLowerCase();
    if (key.includes(" ")) {
      const words = keyLower.split(/\s+/).filter(Boolean);
      if (words.every((w) => name.includes(w))) return key;
    } else if (name.includes(keyLower)) return key;
  }
  return null;
}

/** Identify plant category from product/plant name for defaults lookup (e.g. "Cherry Tomato" → Tomato). Optional typeFromPage (e.g. breadcrumb) is tried first after sanitization. */
function getPlantCategoryFromName(plantName: string, typeFromPage?: string | null): PlantCategoryKey | null {
  return getPlantCategoryFromTypeOrName(typeFromPage ?? null, plantName);
}

/** Apply PLANT_CATEGORY_DEFAULTS when Sun, Water, Spacing, or Germination is empty; set source: 'default' for UI Standard badge. Optional categoryFromPage (e.g. sanitized breadcrumb type) improves lookup. */
function applyPlantCategoryDefaults<T extends Record<string, unknown>>(
  payload: T,
  plantName: string,
  categoryFromPage?: string | null
): T & {
  sunIsDefault?: boolean;
  waterIsDefault?: boolean;
  plant_spacingIsDefault?: boolean;
  days_to_germinationIsDefault?: boolean;
  sunSource?: "default" | "scrape";
  waterSource?: "default" | "scrape";
  plant_spacingSource?: "default" | "scrape";
  days_to_germinationSource?: "default" | "scrape";
} {
  const category = getPlantCategoryFromName(plantName, categoryFromPage) ?? "general";
  const out: Record<string, unknown> = { ...payload };
  out.sunIsDefault = false;
  out.waterIsDefault = false;
  out.plant_spacingIsDefault = false;
  out.days_to_germinationIsDefault = false;
  out.sunSource = undefined;
  out.waterSource = undefined;
  out.plant_spacingSource = undefined;
  out.days_to_germinationSource = undefined;
  const d = PLANT_CATEGORY_DEFAULTS[category];
  if (d) {
    const sun = (payload.sun as string | null | undefined)?.trim();
    const water = (payload.water as string | null | undefined)?.trim();
    const plant_spacing = (payload.plant_spacing as string | null | undefined)?.trim();
    const days_to_germination = (payload.days_to_germination as string | null | undefined)?.trim();
    const spacingVal = d.plant_spacing ?? d.spacing;
    const germinationVal = d.days_to_germination ?? d.germination;
    if (!sun) {
      out.sun = d.sun;
      out.sunIsDefault = true;
      out.sunSource = "default";
    } else {
      out.sunSource = "scrape";
    }
    if (!water && d.water) {
      out.water = d.water;
      out.waterIsDefault = true;
      out.waterSource = "default";
    } else {
      out.waterSource = "scrape";
    }
    if (!plant_spacing && spacingVal) {
      out.plant_spacing = spacingVal;
      out.plant_spacingIsDefault = true;
      out.plant_spacingSource = "default";
    } else {
      out.plant_spacingSource = "scrape";
    }
    if (!days_to_germination && germinationVal) {
      out.days_to_germination = germinationVal;
      out.days_to_germinationIsDefault = true;
      out.days_to_germinationSource = "default";
    } else {
      out.days_to_germinationSource = "scrape";
    }
    if (d.harvest_days != null && payload.harvest_days == null) {
      const m = String(d.harvest_days).match(/(\d+)/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (Number.isFinite(num) && num > 0 && num < 365) out.harvest_days = num;
      }
    }
    if (d.life_cycle != null && !(payload.life_cycle as string)?.trim()) out.life_cycle = d.life_cycle;
  }
  return out as T & {
    sunIsDefault?: boolean;
    waterIsDefault?: boolean;
    plant_spacingIsDefault?: boolean;
    days_to_germinationIsDefault?: boolean;
    sunSource?: "default" | "scrape";
    waterSource?: "default" | "scrape";
    plant_spacingSource?: "default" | "scrape";
    days_to_germinationSource?: "default" | "scrape";
  };
}

/** Extract first match of regex from HTML, return group 1 or full match */
function extract(html: string, regex: RegExp): string | null {
  const m = html.match(regex);
  if (!m) return null;
  return (m[1] ?? m[0])?.trim() || null;
}

/** Remove vendor template placeholders (e.g. %%Excerpt%%, %%Title%%) so they never reach the DB or UI */
function stripTemplatePlaceholders(text: string): string {
  if (!text || !text.trim()) return text;
  return text
    .replace(/\*\*?%%[^%]*%%\*\*?/g, "")
    .replace(/%%[A-Za-z0-9_]+%%/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Remove <style> and <script> blocks from HTML so parsers never extract layout/CSS/JS as content. */
function stripStyleAndScriptFromHtml(html: string): string {
  if (!html || !html.trim()) return html;
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Strip CSS and class-name artifacts from extracted text (e.g. '-sections-desktop: 0px;', '{ }'). Keeps real specs like "12-18 inches". */
function stripCssAndClassArtifacts(text: string): string {
  if (!text || !text.trim()) return text;
  let out = text
    .replace(/\{[^}]*\}/g, " ")
    .replace(/-[a-zA-Z0-9_-]+\s*:\s*[^;]*\s*(?:px|em|rem|vh|vw)\s*;?/gi, " ")
    .replace(/\b[-a-zA-Z0-9_]+\s*:\s*[^;]*\s*0\s*px\s*;?/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return out;
}

/** True only if value looks like real spec text; false for CSS/code (e.g. contains {} or -prop: value). */
function isValidSpecValue(s: string | null | undefined): boolean {
  if (!s || !s.trim()) return false;
  const t = s.trim();
  if (/\{|\}/.test(t)) return false;
  if (/[-a-zA-Z0-9_]+\s*:\s*[^;]*;/.test(t)) return false;
  if (/^\s*[-a-zA-Z0-9_]+\s*:\s*/.test(t)) return false;
  if (/\d+\s*px\s*;?/i.test(t)) return false;
  return true;
}

/** Reject values that are HTML fragments, phone numbers, or footer/boilerplate (for scientific_name, plant_spacing, etc.). */
function isJunkSpecValue(s: string | null | undefined): boolean {
  if (!s || !s.trim()) return true;
  const t = s.trim();
  if (/<|>|&lt;|&gt;/.test(t)) return true;
  if (/\d{3}[-.\s]\d{3}[-.\s]\d{4}/.test(t)) return true;
  if (/selected for (improved )?traits|,\s*and selected|creates stronger|mechanical seeders/i.test(t)) return true;
  if (t.length > 120) return true;
  return false;
}

/** True if value looks like a URL slug (underscores or dashes without spaces, e.g. flower_seeds_mammoth). */
function looksLikeUrlSlug(s: string | null | undefined): boolean {
  if (!s || !s.trim()) return true;
  const t = s.trim();
  if (/_/.test(t)) return true;
  if (/-/.test(t) && !/\s/.test(t)) return true;
  return false;
}

/** Decode numeric HTML entities (&#x20;, &#32;) for all scraped strings. */
function decodeHtmlEntities(text: string): string {
  if (!text || !text.trim()) return text;
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    });
}

/** Strip HTML tags and decode common entities so we never store raw markup. Removes CSS/class artifacts. */
function stripHtmlAndDecode(text: string): string {
  if (!text || !text.trim()) return text;
  let out = text
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  out = decodeHtmlEntities(out);
  out = out
    .replace(/&quot;/g, '"')
    .replace(/&deg;/g, "°")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&frac12;/g, "½")
    .replace(/&#189;/g, "½")
    .replace(/&copy;/g, "©")
    .replace(/&#169;/g, "©");
  out = stripTemplatePlaceholders(out.trim());
  return stripCssAndClassArtifacts(out);
}

/** Remove HTML tags and orphan fragments (e.g. "> or </strong>) from scraped text before saving. */
function stripHtml(text: string): string {
  if (!text || typeof text !== "string") return text;
  let out = text
    .replace(/<[^>]*>/g, " ")
    .replace(/">\s*/g, " ")
    .replace(/\s*<\//g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripHtmlAndDecode(out);
}

const SCRAPED_STRING_KEYS = [
  "sun", "water", "plant_spacing", "days_to_germination", "plant_description", "growing_notes",
  "pretreatment_notes", "ogTitle", "latin_name", "life_cycle", "hybrid_status", "vendor", "category",
  "plant_name", "variety_name", "vendor_name",
] as const;

/** Run stripHtml on all string fields; for spec fields (sun, plant_spacing) reject CSS/code and set null if invalid. */
function cleanScrapedPayload<T extends Record<string, unknown>>(payload: T): T {
  const out: Record<string, unknown> = { ...payload };
  const specKeys = ["sun", "plant_spacing", "days_to_germination"] as const;
  for (const key of SCRAPED_STRING_KEYS) {
    const v = out[key];
    if (typeof v !== "string" || !v.trim()) continue;
    const cleaned = stripHtml(v);
    if (specKeys.includes(key as (typeof specKeys)[number]) && !isValidSpecValue(cleaned)) {
      out[key] = null;
      continue;
    }
    out[key] = cleaned;
  }
  return out as T;
}

/** Max length for AI-sourced string fields to keep table clean (map long paragraphs to truncated value). */
const AI_FIELD_MAX_LEN = 120;

/** Map free-text sun description to nearest logical default for display. */
function normalizeSunFromAi(text: string | null): string | null {
  if (!text || !text.trim()) return null;
  const t = stripHtmlAndDecode(text).trim().slice(0, 80);
  const fullSun = /\bfull\s*sun\b/i.test(t);
  const partSun = /\bpart(?:ial)?\s*sun\b|\bpart\s*sun\b/i.test(t);
  const partShade = /\bpartial\s*shade\b|\bpart\s*shade\b/i.test(t);
  const fullShade = /\bfull\s*shade\b/i.test(t);
  if (fullSun) return "Full Sun";
  if (partShade) return "Partial Shade";
  if (fullShade) return "Full Shade";
  if (partSun) return "Part Sun";
  if (/\bsun\b/i.test(t)) return "Full Sun";
  if (/\bshade\b/i.test(t)) return "Partial Shade";
  return null;
}

/** AI Search Fallback (Plan B): call Tavily, parse result into partial ScrapedSeedPayload. Returns null if API key missing or request fails. */
async function searchWebFallback(
  varietyName: string,
  categoryKey: PlantCategoryKey | null
): Promise<{
  sun: string | null;
  plant_spacing: string | null;
  days_to_germination: string | null;
  harvest_days: number | null;
} | null> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  if (!apiKey) return null;

  // Use "general" when category is unknown so we never append a wrong category (e.g. "Tomato") to the variety name in the query or response.
  const category = categoryKey ?? "general";
  const query = categoryKey
    ? `Growing specifications for ${varietyName} ${category} in Zone 10b (Vista, CA). Focus on spacing, sun, and days to maturity.`
    : `Growing specifications for ${varietyName} in Zone 10b (Vista, CA). Focus on spacing, sun, and days to maturity.`;
  console.log("AI PROMPT:", query);
  let combinedText = "";
  let answerOnly = "";

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: 5,
        include_answer: "basic",
      }),
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      console.log("AI Search Tavily HTTP error:", res.status, res.statusText, "(partial vendor data will still be saved)");
      return null;
    }
    const data = (await res.json()) as {
      answer?: string;
      results?: Array<{ content?: string }>;
    };
    console.log("TAVILY RESPONSE:", JSON.stringify(data, null, 2));
    if (data.answer && typeof data.answer === "string") {
      answerOnly = stripHtmlAndDecode(data.answer).trim();
      combinedText += answerOnly;
    }
    for (const r of data.results ?? []) {
      if (r.content && typeof r.content === "string") {
        combinedText += " " + stripHtmlAndDecode(r.content).trim();
      }
    }
    combinedText = combinedText.replace(/\s+/g, " ").trim().slice(0, 6000);
  } catch {
    return null;
  }

  if (!combinedText) return null;

  const text = combinedText;
  const textLower = text.toLowerCase();

  /** Flexible parse from a snippet (e.g. answer field): sun, spacing, harvest_days. */
  function parseFromSnippet(snippet: string): { sun: string | null; plant_spacing: string | null; harvest_days: number | null; days_to_germination: string | null } {
    const s = snippet.toLowerCase();
    let sun: string | null = null;
    if (s.includes("full sun")) sun = "Full Sun";
    else if (s.includes("partial shade") || s.includes("part shade")) sun = "Partial Shade";
    else if (s.includes("full shade")) sun = "Full Shade";
    else if (s.includes("part sun")) sun = "Part Sun";
    else if (s.includes("sun")) sun = "Full Sun";
    else if (s.includes("shade")) sun = "Partial Shade";

    let plant_spacing: string | null = null;
    const spacingM = snippet.match(/(\d+\s*[–\-]\s*\d+)\s*[""]?/);
    if (spacingM) plant_spacing = (spacingM[1] ?? spacingM[0]).trim().slice(0, AI_FIELD_MAX_LEN);

    let harvest_days: number | null = null;
    const maturityM = snippet.match(/(\d+)\s*days?\s*(?:to|until|to\s*)?\s*maturity/i) ?? snippet.match(/maturity[:\s]*(\d+)/i) ?? snippet.match(/(\d+)\s*days?\s*to\s*harvest/i) ?? snippet.match(/(\d+)\s*days?/i);
    if (maturityM) {
      const n = parseInt(maturityM[1], 10);
      if (Number.isFinite(n) && n > 0 && n < 365) harvest_days = n;
    }

    let days_to_germination: string | null = null;
    const germM = snippet.match(/(\d+(?:\s*[–\-]\s*\d+)?)\s*days?\s*(?:to|for)?\s*germination/i) ?? snippet.match(/germination[:\s]*(\d+)/i);
    if (germM) days_to_germination = (germM[1] ?? "").trim().slice(0, AI_FIELD_MAX_LEN);

    return { sun, plant_spacing, harvest_days, days_to_germination };
  }

  let sun: string | null = null;
  let plant_spacing: string | null = null;
  let days_to_germination: string | null = null;
  let harvest_days: number | null = null;

  if (answerOnly) {
    const fromAnswer = parseFromSnippet(answerOnly);
    sun = fromAnswer.sun;
    plant_spacing = fromAnswer.plant_spacing;
    harvest_days = fromAnswer.harvest_days;
    days_to_germination = fromAnswer.days_to_germination;
  }

  // Fill any missing from full combined text
  if (!sun) {
    sun = text.match(/\b(Full\s*Sun|Part\s*Sun|Partial\s*Shade|Full\s*Shade)\b/i)?.[1]?.trim() ?? null;
    if (!sun) {
      if (textLower.includes("full sun")) sun = "Full Sun";
      else if (textLower.includes("partial shade") || textLower.includes("part shade")) sun = "Partial Shade";
      else if (textLower.includes("full shade")) sun = "Full Shade";
      else if (textLower.includes("part sun")) sun = "Part Sun";
      else if (textLower.includes("sun")) sun = "Full Sun";
      else if (textLower.includes("shade")) sun = "Partial Shade";
    }
    if (!sun) sun = normalizeSunFromAi(text.slice(0, 500));
  }
  if (!plant_spacing) {
    const spacingMatch =
      text.match(/(\d+\s*[–\-]\s*\d+)\s*[""]/i) ??
      text.match(/(\d+\s*[–\-]\s*\d+)\s*(?:inch|in\.?)/i) ??
      text.match(/spacing[:\s]+([^\n.]{2,60})/i) ??
      text.match(/(?:space|plant)\s*(?:d?\s*)?(\d+\s*[–\-]\s*\d+)\s*[""]?/i);
    if (spacingMatch) {
      const raw = stripHtmlAndDecode(spacingMatch[1] ?? spacingMatch[0]).trim();
      plant_spacing = raw.slice(0, AI_FIELD_MAX_LEN);
    }
    if (!plant_spacing && /\d+\s*[–\-]\s*\d+/.test(text) && (textLower.includes("inch") || textLower.includes("spacing"))) {
      const m = text.match(/(\d+\s*[–\-]\s*\d+)\s*(?:inch|in\.?)?/i);
      if (m) plant_spacing = stripHtmlAndDecode(m[1]).trim().slice(0, AI_FIELD_MAX_LEN);
    }
  }
  if (!days_to_germination) {
    const germMatch =
      text.match(/(\d+\s*[–\-]\s*\d+)\s*days?\s*(?:to|for)\s*germination/i) ??
      text.match(/germination[:\s]*(\d+(?:\s*[–\-]\s*\d+)?)\s*days?/i) ??
      text.match(/(\d+\s*[–\-]\s*\d+)\s*days?\s*(?:at|to)/i);
    if (germMatch) {
      const raw = stripHtmlAndDecode(germMatch[1]).trim();
      days_to_germination = raw.slice(0, AI_FIELD_MAX_LEN);
    }
    if (!days_to_germination && textLower.includes("germination")) {
      const m = text.match(/(\d+(?:\s*[–\-]\s*\d+)?)\s*days?/i);
      if (m) days_to_germination = stripHtmlAndDecode(m[1]).trim().slice(0, AI_FIELD_MAX_LEN);
    }
  }
  if (harvest_days == null) {
    const maturityMatch =
      text.match(/(\d+)\s*days?\s*(?:to|until)\s*maturity/i) ??
      text.match(/maturity[:\s]*(\d+)\s*days?/i) ??
      text.match(/(?:DTM|days\s*to\s*maturity)[:\s]*(\d+)/i) ??
      text.match(/(\d+)\s*days?\s*to\s*harvest/i);
    if (maturityMatch) {
      const n = parseInt(maturityMatch[1], 10);
      if (Number.isFinite(n) && n > 0 && n < 365) harvest_days = n;
    }
    if (harvest_days == null && (textLower.includes("maturity") || textLower.includes("harvest"))) {
      const m = text.match(/(\d+)\s*days?/i);
      if (m) {
        const n = parseInt(m[1], 10);
        if (Number.isFinite(n) && n > 0 && n < 365) harvest_days = n;
      }
    }
  }

  return { sun, plant_spacing, days_to_germination, harvest_days };
}

/** Blacklist: discard any paragraph containing these (case-insensitive) */
const BLACKLIST_PATTERNS = [
  /Copyright/i,
  /All Rights Reserved/i,
  /Sitemap/i,
  /Password/i,
  /Email Address/i,
  /document\.write/i,
  /LiveChat/i,
];

function containsBlacklist(text: string): boolean {
  return BLACKLIST_PATTERNS.some((re) => re.test(text));
}

/** Filter out blacklisted paragraphs and rejoin */
function filterBlacklistedParagraphs(text: string): string {
  const paragraphs = text.split(/\n\s*\n/);
  const kept = paragraphs.filter((p) => !containsBlacklist(p.trim()));
  return kept.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Decode HTML entities so description never shows raw &copy; &quot; etc. */
function decodeDescriptionEntities(text: string): string {
  if (!text || !text.trim()) return text;
  return text
    .replace(/&copy;/g, "©")
    .replace(/&#169;/g, "©")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&frac12;/g, "½")
    .trim();
}

/** Code-like line: contains # [ or = and is longer than 20 chars (attribute/code, not a sentence) */
function looksLikeCode(line: string): boolean {
  const t = line.trim();
  if (t.length <= 20) return false;
  return /[#\[=]/.test(t);
}

/** Keyword purge: discard lines containing these (carousel, nav, data attrs, etc.) */
const DESCRIPTION_NOISE = /carousel|slide-to|nav-link|button|data-|data-target|data-slide|data-ride|target\s*=/i;

/**
 * Aggressive description sanitization: remove code vomit, keep only real sentences.
 * Returns a clean array of sentences (lines) joined with newlines.
 */
function filterSurgicalDescription(text: string): string {
  if (!text || !text.trim()) return text;
  const decoded = decodeDescriptionEntities(text);
  const lines = decoded.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const kept: string[] = [];
  for (const line of lines) {
    if (DESCRIPTION_NOISE.test(line)) continue;
    if (looksLikeCode(line)) continue;
    if (containsBlacklist(line)) continue;
    kept.push(line);
  }

  const joined = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  return stripTemplatePlaceholders(joined);
}

/** RareSeeds/Baker Creek: extract full story from div.product-description (capture full block, do not stop at first </div>). */
function extractRareSeedsProductDescription(html: string): string | null {
  const match = html.match(
    /<div[^>]*\bclass=["'][^"']*product-description[^"']*["'][^>]*>([\s\S]{1,12000})/i
  );
  if (!match?.[1]) return null;
  const block = match[1].replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p/gi, "\n\n");
  const raw = stripHtmlAndDecode(block).trim();
  if (raw.length < 30 || containsBlacklist(raw)) return null;
  return filterSurgicalDescription(raw.slice(0, 4000));
}

/** Baker Creek (rareseeds.com) blueprint: div.description holds Story + Technical Specs. Breadcrumb for plant name. */
function parseBakerCreek(html: string, pageOrigin: string, metadata?: OgMetadata | null): {
  imageUrl: string | null;
  harvest_days: number | null;
  sun: string | null;
  days_to_germination: string | null;
  plant_spacing: string | null;
  growing_notes: string | null;
  plant_description: string | null;
  latin_name: string | null;
  life_cycle: string | null;
  hybrid_status: string | null;
  plant_name_from_breadcrumb: string | null;
} {
  const imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);
  let plant_description: string | null = null;
  let sun: string | null = null;
  let plant_spacing: string | null = null;
  let days_to_germination: string | null = null;
  let latin_name: string | null = null;
  let plant_name_from_breadcrumb: string | null = null;

  const breadcrumbMatch = html.match(/<nav[^>]*\bclass=["'][^"']*breadcrumb[^"']*["'][^>]*>([\s\S]{1,2000})<\/nav>/i)
    ?? html.match(/<ol[^>]*\bclass=["'][^"']*breadcrumb[^"']*["'][^>]*>([\s\S]{1,2000})<\/ol>/i);
  if (breadcrumbMatch?.[1]) {
    const links = breadcrumbMatch[1].match(/<a[^>]*>([\s\S]*?)<\/a>/gi) ?? [];
    const items = links.map((a) => stripHtmlAndDecode(a.replace(/<[^>]+>/g, "")).trim()).filter(Boolean);
    if (items.length >= 1) {
      const last = items[items.length - 1] ?? "";
      const secondToLast = items.length >= 2 ? items[items.length - 2] ?? "" : "";
      if (last && last.split(/\s+/).length > 1 && secondToLast) {
        plant_name_from_breadcrumb = secondToLast.trim();
      } else if (last) {
        plant_name_from_breadcrumb = last.trim();
      }
    }
  }

  const descMatch = html.match(
    /<div[^>]*\bclass=["']description["'][^>]*>([\s\S]{1,15000})/i
  );
  if (descMatch?.[1]) {
    let block = descMatch[1];
    const growingTipsIdx = block.search(/\bGrowing\s+Tips\b/i);
    if (growingTipsIdx !== -1) block = block.slice(0, growingTipsIdx);
    const raw = stripHtmlAndDecode(block).trim();
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const kept: string[] = [];
    for (const line of lines) {
      if (/Warning!/i.test(line) || /Add to Cart/i.test(line) || /\bQuantity\b/i.test(line)) continue;
      kept.push(line);
    }
    const surgical = kept.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (surgical.length > 20 && !containsBlacklist(surgical)) {
      plant_description = stripTemplatePlaceholders(surgical);
    }
    const sunLine = lines.find((l) => /\b(Full\s+sun|Part\s+sun)\b/i.test(l));
    if (sunLine) {
      const m = sunLine.match(/\b(Full\s+sun|Part\s+sun)\b/i);
      if (m?.[1]) sun = m[1].trim();
    }
    const spacingLine = lines.find((l) => /Plant\s*spacing\s*:\s*\d+\s+to\s+\d+\s+inches/i.test(l) || /Plant\s*spacing\s*:\s*\d+\s*-\s*\d+\s+inches/i.test(l));
    if (spacingLine) {
      const m = spacingLine.match(/Plant\s*spacing\s*:\s*(\d+\s+to\s+\d+\s+inches|\d+\s*-\s*\d+\s+inches)/i)
        ?? spacingLine.match(/(\d+\s+to\s+\d+\s+inches|\d+\s*-\s*\d+\s+inches)/i);
      if (m?.[1]) plant_spacing = m[1].trim().replace(/\s+/g, " ");
    }
    const germLine = lines.find((l) => /Sprouts?\s+in\s+\d+[\s\-–]\d+\s+days/i.test(l));
    if (germLine) {
      const m = germLine.match(/Sprouts?\s+in\s+(\d+[\s\-–]\d+)\s+days/i);
      if (m?.[1]) days_to_germination = m[1].replace(/\s+/, "–").trim() + " days";
    }
    const firstPMatch = descMatch[1].match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (firstPMatch?.[1]) {
      const firstPText = stripHtmlAndDecode(firstPMatch[1]);
      const parenMatch = firstPText.match(/\(([^)]+)\)/);
      if (parenMatch?.[1]) {
        const candidate = parenMatch[1].trim();
        if (candidate.length > 2 && candidate.length < 80 && /[A-Za-z]/.test(candidate)) latin_name = candidate;
      }
    }
  }

  if (!plant_description && metadata?.ogDescription && metadata.ogDescription.length > 20 && !containsBlacklist(metadata.ogDescription)) {
    plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 800));
  }
  if (!plant_description) {
    plant_description = extractRareSeedsProductDescription(html);
  }
  if (!plant_description && metadata?.ogDescription && metadata.ogDescription.length > 30 && !containsBlacklist(metadata.ogDescription)) {
    plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 800));
  }

  const harvest_days = extractFuzzyMaturityDays(html);
  if (!sun) {
    sun = extractFuzzyLabel(html, SUN_KEYWORDS, 30);
    if (!sun) {
      const lightMatch = html.match(/\b(Full\s*Sun|Part\s*Sun|Sun|Partial\s*Shade|Full\s*Shade)\b/i);
      if (lightMatch?.[1]) sun = lightMatch[1].trim();
    }
  }
  if (!days_to_germination) days_to_germination = extractFuzzyLabel(html, GERMINATION_KEYWORDS);
  if (!plant_spacing) plant_spacing = extractFuzzyLabel(html, SPACING_KEYWORDS);
  if (!latin_name) latin_name = extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80);

  const growing_notes = extractSectionedGrowingGuides(html);

  return {
    imageUrl,
    harvest_days,
    sun,
    days_to_germination,
    plant_spacing,
    growing_notes: growing_notes ?? null,
    plant_description,
    latin_name,
    life_cycle: extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30),
    hybrid_status: extractFuzzyLabel(html, HYBRID_KEYWORDS, 30),
    plant_name_from_breadcrumb,
  };
}

/** Section headings used in Territorial Seed and similar "Growing Tips" / guide content */
const GROWING_GUIDE_HEADINGS = [
  "Sunlight Requirements",
  "Watering Requirements",
  "Soil Requirements",
  "Benefits & Care Tips",
  "How to Harvest",
  "Harvest & Storage",
  "Insects & Diseases",
  "Transplanting",
  "Culture",
  "Direct Sowing",
  "From Seed",
  "Growing Info",
];

/**
 * Extract Territorial-style (and similar) sectioned growing guides: Sunlight, Watering, Soil,
 * Benefits & Care Tips, How to Harvest, etc. These appear in the main HTML but are not in
 * og:description. We find the first section heading and capture a large block that follows.
 */
function extractSectionedGrowingGuides(html: string): string | null {
  const lower = html.toLowerCase();
  let start = -1;
  for (const heading of GROWING_GUIDE_HEADINGS) {
    const idx = lower.indexOf(heading.toLowerCase());
    if (idx !== -1 && (start === -1 || idx < start)) start = idx;
  }
  if (start === -1) return null;
  const chunk = html.slice(start, start + 14000);
  const raw = stripHtmlAndDecode(chunk).trim();
  if (raw.length < 80 || containsBlacklist(raw)) return null;
  const filtered = filterSurgicalDescription(raw);
  return filtered.length > 60 ? filtered : null;
}

/** Johnny's: paragraph immediately following "Product ID" (first <p> or first text block) */
function extractJohnnysProductStory(html: string): string | null {
  const afterId = html.indexOf("Product ID");
  if (afterId === -1) return null;
  const fragment = html.slice(afterId, afterId + 3000);
  const pMatch = fragment.match(/Product\s*ID[^<]*(?:<[^>]+>)*\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  if (pMatch?.[1]) {
    const raw = stripHtmlAndDecode(pMatch[1].slice(0, 1200)).trim();
    if (raw.length > 20 && !containsBlacklist(raw)) return filterSurgicalDescription(raw);
  }
  const blockMatch = fragment.match(/Product\s*ID[^<]*(?:<[^>]+>)*\s*([\s\S]*?)(?=Specs:|Read\s+More|Size:|Quick\s+Facts|Add\s+to\s+Cart)/i);
  if (blockMatch?.[1]) {
    const raw = stripHtmlAndDecode(blockMatch[1].slice(0, 1200)).trim();
    if (raw.length > 20 && !containsBlacklist(raw)) return filterSurgicalDescription(raw);
  }
  return null;
}

/** Extract og:title, og:image, og:description, og:site_name (safety fallback when surgical scrape fails or times out) */
function extractOgMetadata(html: string): {
  ogTitle: string | null;
  ogImage: string | null;
  ogDescription: string | null;
  ogSiteName: string | null;
} {
  let ogTitle: string | null = null;
  let ogImage: string | null = null;
  let ogDescription: string | null = null;
  let ogSiteName: string | null = null;
  const ogTitleMatch = html.match(
    /<meta[\s\S]*?\bproperty=["']og:title["'][\s\S]*?\bcontent=["']([^"']+)["']/i
  ) ?? html.match(
    /<meta[\s\S]*?\bcontent=["']([^"']+)["'][\s\S]*?\bproperty=["']og:title["']/i
  );
  if (ogTitleMatch?.[1]) ogTitle = stripHtmlAndDecode(ogTitleMatch[1]).trim();
  const ogImageMatch = html.match(
    /<meta[\s\S]*?\bproperty=["']og:image["'][\s\S]*?\bcontent=["']([^"']+)["']/i
  ) ?? html.match(
    /<meta[\s\S]*?\bcontent=["']([^"']+)["'][\s\S]*?\bproperty=["']og:image["']/i
  );
  if (ogImageMatch?.[1]) ogImage = ogImageMatch[1].trim();
  const ogDescMatch = html.match(
    /<meta[\s\S]*?\bproperty=["']og:description["'][\s\S]*?\bcontent=["']([^"']+)["']/i
  ) ?? html.match(
    /<meta[\s\S]*?\bcontent=["']([^"']+)["'][\s\S]*?\bproperty=["']og:description["']/i
  );
  if (ogDescMatch?.[1]) ogDescription = stripHtmlAndDecode(ogDescMatch[1]).trim();
  const ogSiteMatch = html.match(
    /<meta[\s\S]*?\bproperty=["']og:site_name["'][\s\S]*?\bcontent=["']([^"']+)["']/i
  ) ?? html.match(
    /<meta[\s\S]*?\bcontent=["']([^"']+)["'][\s\S]*?\bproperty=["']og:site_name["']/i
  );
  if (ogSiteMatch?.[1]) ogSiteName = stripHtmlAndDecode(ogSiteMatch[1]).trim();
  return { ogTitle, ogImage, ogDescription, ogSiteName };
}

/** Escape phrase for regex (e.g. "plant spacing" -> "plant\\s+spacing"; "open.pollinated" keeps dot literal) */
function keywordPattern(phrase: string): string {
  return phrase
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
}

const SPACING_KEYWORDS = ["spacing", "plant spacing", "sowing rate", "distancia"];
const GERMINATION_KEYWORDS = ["germination", "days to sprout", "emergence", "days to germination"];
const SUN_KEYWORDS = ["sun", "light", "exposure", "full sun", "part sun"];
const MATURITY_KEYWORDS = ["maturity", "days to harvest", "fruit set", "days to maturity"];
const LATIN_NAME_KEYWORDS = ["latin name", "latin", "botanical name", "scientific name", "species"];
const LIFE_CYCLE_KEYWORDS = ["life cycle", "plant type", "growth habit", "habit"];
const HYBRID_KEYWORDS = ["hybrid status", "hybrid", "pollination", "open pollinated", "open.pollinated"];

const MAX_FUZZY_CHARS = 50;

/**
 * Find first occurrence of any keyword (case-insensitive), then capture value until first newline or tag.
 * Applies stripHtmlAndDecode and enforces maxChars to keep table clean across vendors.
 */
function extractFuzzyLabel(html: string, keywords: string[], maxChars: number = MAX_FUZZY_CHARS): string | null {
  const pattern = keywords.map(keywordPattern).join("|");
  const re = new RegExp(
    `(?:${pattern})\\s*[:\\s]*([^\\n\\r<]*?)(?=\\r?\\n|\\r\\n|<\\w|$)`,
    "i"
  );
  const m = html.match(re);
  if (!m?.[1]) return null;
  const raw = stripHtmlAndDecode(m[1]).trim();
  if (raw.length === 0) return null;
  return raw.length > maxChars ? raw.slice(0, maxChars).trim() : raw;
}

/**
 * Find maturity-style keywords then extract a number (single or range like 65-75).
 */
function extractFuzzyMaturityDays(html: string): number | null {
  const pattern = MATURITY_KEYWORDS.map(keywordPattern).join("|");
  const re = new RegExp(
    `(?:${pattern})[^\\d]*(\\d+)\\s*[-–]\\s*(\\d+)|(?:${pattern})[^\\d]*(\\d+)\\s*day`,
    "i"
  );
  const m = html.match(re);
  if (!m) return null;
  const a = m[1] != null ? parseInt(m[1], 10) : null;
  const b = m[2] != null ? parseInt(m[2], 10) : null;
  const single = m[3] != null ? parseInt(m[3], 10) : null;
  if (a != null && b != null && !Number.isNaN(a) && !Number.isNaN(b)) return Math.round((a + b) / 2);
  if (single != null && !Number.isNaN(single)) return single;
  return null;
}

/** Resolve possibly relative image URL against page origin */
function resolveImageUrl(raw: string, pageOrigin: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    return new URL(trimmed, pageOrigin).href;
  } catch {
    return trimmed;
  }
}

/**
 * Extract product image URL: metadata first (og:image), then twitter, JSON-LD, then img with "product" in id/class, then any product-like img.
 * optionalOgImage: when provided (from extractOgMetadata), use it first for reliability across vendors.
 */
function extractImageUrl(html: string, pageOrigin: string, optionalOgImage?: string | null): string | null {
  // Metadata first: use pre-extracted og:image when provided (Baker Creek, etc.)
  if (optionalOgImage && optionalOgImage.trim()) return resolveImageUrl(optionalOgImage.trim(), pageOrigin);

  // og:image from HTML
  const ogMatch = html.match(
    /<meta[\s\S]*?\bproperty=["']og:image["'][\s\S]*?\bcontent=["']([^"']+)["']/i
  ) ?? html.match(
    /<meta[\s\S]*?\bcontent=["']([^"']+)["'][\s\S]*?\bproperty=["']og:image["']/i
  );
  if (ogMatch?.[1]) return resolveImageUrl(ogMatch[1], pageOrigin);

  // twitter:image fallback
  const twMatch = html.match(
    /<meta[\s\S]*?\bname=["']twitter:image["'][\s\S]*?\bcontent=["']([^"']+)["']/i
  ) ?? html.match(
    /<meta[\s\S]*?\bcontent=["']([^"']+)["'][\s\S]*?\bname=["']twitter:image["']/i
  );
  if (twMatch?.[1]) return resolveImageUrl(twMatch[1], pageOrigin);

  // JSON-LD product image (cap iterations to prevent runaway on huge HTML)
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const MAX_JSON_LD_BLOCKS = 20;
  let jsonLdBlock;
  let jsonLdCount = 0;
  while ((jsonLdBlock = jsonLdRegex.exec(html)) !== null) {
    if (++jsonLdCount > MAX_JSON_LD_BLOCKS) break;
    try {
      const parsed = JSON.parse(jsonLdBlock[1]) as { image?: string | string[]; "@graph"?: Array<{ image?: string | string[] }> };
      const candidates: (string | string[] | undefined)[] = [parsed?.image];
      if (Array.isArray(parsed?.["@graph"])) {
        for (const node of parsed["@graph"]) candidates.push(node?.image);
      }
      for (const img of candidates) {
        const url = Array.isArray(img) ? img[0] : typeof img === "string" ? img : null;
        if (url && typeof url === "string" && url.startsWith("http")) return resolveImageUrl(url, pageOrigin);
      }
    } catch {
      // ignore
    }
  }

  // Fallback: first <img> with "product" (or "main", "primary") in id or class – high-res product photo on many sites
  const productImgMatch = html.match(
    /<img[\s\S]*?(?:id|class)=["'][^"']*(?:product|main|primary)[^"']*["'][\s\S]*?(?:data-src|data-lazy|src)=["']([^"']+)["']/i
  ) ?? html.match(
    /<img[\s\S]*?(?:data-src|data-lazy|src)=["']([^"']+)["'][\s\S]*?(?:id|class)=["'][^"']*(?:product|main|primary)[^"']*["']/i
  );
  if (productImgMatch?.[1]) {
    const src = productImgMatch[1].trim();
    if (!src.startsWith("data:") && /\.(jpg|jpeg|png|webp)(\?|$)/i.test(src))
      return resolveImageUrl(src, pageOrigin);
  }

  // Generic: first substantial img (product/image/media in src or common patterns)
  const imgMatch = html.match(
    /<img[\s\S]*?(?:data-src|data-lazy|src)=["']([^"']+)["'][\s\S]*?>/i
  ) ?? html.match(
    /<img[\s\S]*?src=["']([^"']+)["'][\s\S]*?>/i
  );
  if (imgMatch?.[1]) {
    const src = imgMatch[1].trim();
    if (!src.startsWith("data:") && (src.includes("product") || src.includes("image") || src.includes("media") || src.includes("photo") || /\.(jpg|jpeg|png|webp)(\?|$)/i.test(src))) {
      return resolveImageUrl(src, pageOrigin);
    }
  }
  return null;
}

export type ScrapedQuickFacts = {
  latin_name?: string | null;
  life_cycle?: string | null;
  hybrid_status?: string | null;
};

type OgMetadata = { ogTitle: string | null; ogImage: string | null; ogDescription: string | null; ogSiteName?: string | null };

const GEMINI_SCRAPE_PROMPT = `From this seed vendor URL page text, extract: Variety Name, Days to Maturity, Sowing Depth, and Sun Requirements. Return ONLY a valid JSON object with keys: varietyName, daysToMaturity, sowingDepth, sunRequirements. Use empty string when not found. For daysToMaturity use a single number (e.g. 80) or 0 if unknown. No markdown or explanation.`;

/** Build plain text for Gemini from HTML and OG metadata (title + description + body, truncated). */
function getPageTextForGemini(html: string, metadata: OgMetadata | null): string {
  const parts: string[] = [];
  if (metadata?.ogTitle?.trim()) parts.push(metadata.ogTitle.trim());
  if (metadata?.ogDescription?.trim()) parts.push(metadata.ogDescription.trim());
  const body = stripHtml(html).replace(/\s+/g, " ").trim();
  if (body) parts.push(body.slice(0, 15000));
  return parts.join("\n\n");
}

/** Call Gemini 1.5 Flash to extract variety, maturity, depth, sun. Returns payload-shaped object or null on failure. */
async function extractWithGemini(
  pageText: string,
  _url: URL
): Promise<{ variety_name: string; harvest_days: number | null; plant_spacing: string; sun: string } | null> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (!apiKey || !pageText.trim()) return null;
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent([GEMINI_SCRAPE_PROMPT, pageText]);
    const text = result.response.text();
    if (!text?.trim()) return null;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? (JSON.parse(jsonMatch[0]) as Record<string, unknown>) : null;
    if (!parsed || typeof parsed !== "object") return null;
    const varietyName = typeof parsed.varietyName === "string" ? parsed.varietyName.trim() : "";
    let harvest_days: number | null = null;
    if (typeof parsed.daysToMaturity === "number" && Number.isFinite(parsed.daysToMaturity) && parsed.daysToMaturity > 0) {
      harvest_days = parsed.daysToMaturity;
    } else if (typeof parsed.daysToMaturity === "string" && parsed.daysToMaturity.trim()) {
      const n = parseInt(parsed.daysToMaturity.replace(/\D/g, ""), 10);
      if (Number.isFinite(n) && n > 0) harvest_days = n;
    }
    const sowingDepth = typeof parsed.sowingDepth === "string" ? parsed.sowingDepth.trim() : "";
    const sunRequirements = typeof parsed.sunRequirements === "string" ? parsed.sunRequirements.trim() : "";
    return { variety_name: varietyName, harvest_days, plant_spacing: sowingDepth, sun: sunRequirements };
  } catch {
    return null;
  }
}

/** Parse days-to-maturity string (e.g. "75-90 days") to a single number for harvest_days. */
function parseDaysToMaturityFromSchedule(s: string | undefined): number | null {
  if (!s?.trim()) return null;
  const range = s.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (range) return Math.round((parseInt(range[1], 10) + parseInt(range[2], 10)) / 2);
  const single = s.match(/(\d+)/);
  return single ? parseInt(single[1], 10) : null;
}

/** Parse Johnny's Selected Seeds (johnnyseeds.com): h1.product-name for title; .c-product-attributes + product-quick-facts + #growing-info for specs; proxy for image. */
function parseJohnnys(html: string, pageOrigin: string, metadata?: OgMetadata | null): {
  imageUrl: string | null;
  harvest_days: number | null;
  sun: string | null;
  days_to_germination: string | null;
  plant_spacing: string | null;
  growing_notes: string | null;
  plant_description: string | null;
  latin_name: string | null;
  life_cycle: string | null;
  hybrid_status: string | null;
  ogTitle?: string;
} {
  let ogTitle: string | undefined = undefined;
  const h1Match = html.match(/<h1[^>]*\bclass=["'][^"']*product-name[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match?.[1]) {
    const fullTitle = stripHtmlAndDecode(h1Match[1]).trim();
    if (fullTitle.length > 1) ogTitle = fullTitle;
  }
  if (!ogTitle && metadata?.ogTitle?.trim()) ogTitle = metadata.ogTitle.trim();

  // Image: Johnny's main gallery — first img with class primary-image (they block direct external requests; client uses proxy for fetch)
  let imageUrl: string | null = null;
  const primaryImgMatch = html.match(
    /<img[^>]*\bclass=["'][^"']*primary-image[^"']*["'][^>]*(?:src|data-src)=["']([^"']+)["']/i
  ) ?? html.match(
    /<img[^>]*(?:src|data-src)=["']([^"']+)["'][^>]*\bclass=["'][^"']*primary-image[^"']*["']/i
  );
  if (primaryImgMatch?.[1]) {
    const src = primaryImgMatch[1].trim();
    if (!src.startsWith("data:")) imageUrl = resolveImageUrl(src, pageOrigin);
  }
  if (!imageUrl) imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);
  // Johnny's: reject logo as hero (JSS_Logo, logo.svg, /logo/ path)
  if (imageUrl && /JSS_Logo|logo\.svg|\/logo\b/i.test(imageUrl)) imageUrl = null;

  let harvest_days: number | null = null;
  let sun: string | null = null;
  let days_to_germination: string | null = null;
  let plant_spacing: string | null = null;
  let growing_notes: string | null = null;
  let plant_description: string | null = null;
  let latin_name: string | null = null;
  let life_cycle: string | null = null;
  let hybrid_status: string | null = null;

  // .c-product-attributes — primary specs block (label/value pairs)
  const attrsMatch = html.match(/<[^>]*\bclass=["'][^"']*c-product-attributes[^"']*["'][^>]*>([\s\S]{1,5000})/i);
  const attrsBlock = attrsMatch?.[1] ?? "";
  if (attrsBlock) {
    const text = stripHtmlAndDecode(attrsBlock);
    const lightMatch = text.match(/(?:Light|Sun)\s*[:\s]*([^\n]{2,60}?)(?=\s*[A-Z]|\s*$)/i);
    if (lightMatch?.[1] && isValidSpecValue(lightMatch[1].trim())) sun = lightMatch[1].trim();
    const spacingMatch = text.match(/Spacing\s*[:\s]*([^\n]{2,60}?)(?=\s*[A-Z]|\s*$)/i) ?? text.match(/Plant\s+Spacing\s*[:\s]*([^\n]{2,60}?)(?=\s*[A-Z]|\s*$)/i);
    if (spacingMatch?.[1] && isValidSpecValue(spacingMatch[1].trim())) plant_spacing = spacingMatch[1].trim();
    const germMatch = text.match(/(?:Germination|Emergence)\s*[:\s]*([^\n]{2,60}?)(?=\s*[A-Z]|\s*$)/i);
    if (germMatch?.[1] && isValidSpecValue(germMatch[1].trim())) days_to_germination = germMatch[1].trim();
    const matMatch = text.match(/(?:Days\s+to\s+Maturity|Maturity)\s*[:\s]*(\d+)\s*[-–]?\s*(\d+)?/i) ?? text.match(/(\d+)\s*[-–]\s*(\d+)\s*days?/i);
    if (matMatch && (matMatch[1] || matMatch[2])) {
      const a = parseInt(matMatch[1], 10);
      const b = matMatch[2] != null ? parseInt(matMatch[2], 10) : NaN;
      if (!Number.isNaN(a)) harvest_days = Number.isNaN(b) ? a : Math.round((a + b) / 2);
    }
  }

  // product-quick-facts — Latin Name, Days to Maturity, Hybrid Status (if not set from attributes)
  const quickFactsMatch = html.match(
    /<div[^>]*\bclass=["'][^"']*product-quick-facts[^"']*["'][^>]*>([\s\S]{1,4000})/i
  );
  const quickBlock = quickFactsMatch?.[1] ?? "";
  if (quickBlock) {
    const latinEl = quickBlock.match(
      /(?:class|className)=["'][^"']*quick-fact-latin-name[^"']*["'][^>]*>([\s\S]*?)<\/\w+>/i
    );
    if (latinEl?.[1]) {
      const raw = stripHtmlAndDecode(latinEl[1]).trim();
      if (raw.length >= 2 && raw.length <= 80 && /^[A-Za-z]+\s+[a-z]+/.test(raw)) latin_name = raw;
    }
    const maturityEl = quickBlock.match(
      /(?:class|className)=["'][^"']*quick-fact-days-to-maturity[^"']*["'][^>]*>([\s\S]*?)<\/\w+>/i
    );
    if (harvest_days == null && maturityEl?.[1]) {
      const text = stripHtmlAndDecode(maturityEl[1]);
      const range = text.match(/(\d+)\s*[-–]\s*(\d+)\s*days?/i);
      if (range) {
        const a = parseInt(range[1], 10);
        const b = parseInt(range[2], 10);
        if (!Number.isNaN(a) && !Number.isNaN(b)) harvest_days = Math.round((a + b) / 2);
        else if (!Number.isNaN(a)) harvest_days = a;
      } else {
        const single = text.match(/(\d+)\s*days?/i);
        if (single?.[1]) {
          const n = parseInt(single[1], 10);
          if (!Number.isNaN(n)) harvest_days = n;
        }
      }
    }
    const hybridEl = quickBlock.match(
      /(?:class|className)=["'][^"']*quick-fact-hybrid-status[^"']*["'][^>]*>([\s\S]*?)<\/\w+>/i
    );
    if (hybridEl?.[1]) {
      const raw = stripHtmlAndDecode(hybridEl[1]).trim();
      if (raw.length > 0 && raw.length <= 60) hybrid_status = raw;
    }
  }

  // Deep scrape: div#growing-info — Transplanting (spacing), Culture (germination)
  const growingInfoMatch = html.match(
    /<div[^>]*\bid=["']growing-info["'][^>]*>([\s\S]{1,6000})/i
  ) ?? html.match(
    /id=["']growing-info["'][^>]*>([\s\S]{1,6000})/i
  );
  const growingInfoBlock = growingInfoMatch?.[1] ?? "";
  if (growingInfoBlock) {
    const transplantIdx = growingInfoBlock.search(/Transplanting/i);
    if (transplantIdx !== -1) {
      const transplantSlice = growingInfoBlock.slice(transplantIdx, transplantIdx + 800);
      const transplantText = stripHtmlAndDecode(transplantSlice);
      const spacingRange = transplantText.match(/(\d+)\s*[-–]\s*(\d+)\s*[""]/);
      if (spacingRange) {
        plant_spacing = `${spacingRange[1]}–${spacingRange[2]} inches`;
      } else {
        const spacingIn = transplantText.match(/(\d+)\s*[-–]\s*(\d+)\s*inches?/i);
        if (spacingIn) plant_spacing = `${spacingIn[1]}–${spacingIn[2]} inches`;
      }
    }
    const cultureIdx = growingInfoBlock.search(/Culture/i);
    if (cultureIdx !== -1) {
      const cultureSlice = growingInfoBlock.slice(cultureIdx, cultureIdx + 800);
      const cultureText = stripHtmlAndDecode(cultureSlice);
      const germMatch = cultureText.match(/germinate\s+in\s+(\d+)\s*[-–]\s*(\d+)\s*days?/i);
      if (germMatch) days_to_germination = `${germMatch[1]}–${germMatch[2]} days`;
    }
  }

  // Fallbacks: description, maturity, sun, germination, spacing, growing_notes, life_cycle
  plant_description = extractJohnnysProductStory(html);
  if (!plant_description && metadata?.ogDescription && metadata.ogDescription.length > 20 && !containsBlacklist(metadata.ogDescription)) {
    plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 1200));
  }
  if (!plant_description) {
    const descMatch = html.match(
      /<h1[^>]*>[\s\S]*?<\/h1>\s*(?:<[^>]+>)*\s*([\s\S]*?)(?=Specs:|Read\s+More|Size:|Quick\s+Facts)/i
    );
    if (descMatch?.[1]) {
      const descRaw = stripHtmlAndDecode(descMatch[1].slice(0, 1200)).trim();
      if (descRaw.length > 20 && !containsBlacklist(descRaw)) {
        plant_description = filterSurgicalDescription(
          descRaw.replace(/[ \t]+/g, " ").replace(/\n\s+/g, "\n").replace(/\s+\n/g, "\n").trim()
        );
      }
    }
  }
  const specsMatch = html.match(/Specs:\s*([\s\S]*?)(?=Read\s+More|Size:|<\/ul>|<\/div>|Add\s+to\s+Cart)/i);
  if (specsMatch?.[1]) {
    const specsRaw = stripHtmlAndDecode(specsMatch[1].slice(0, 400))
      .replace(/\s+/g, " ")
      .trim();
    const specsLines = filterSurgicalDescription(specsRaw)
      .split(/\s*[•*\-]\s*/)
      .map((s) => s.trim())
      .filter((s) => s.length > 2 && s.length < 120);
    if (specsLines.length > 0) {
      const specsBlock = specsLines.join("\n");
      plant_description = plant_description
        ? `${plant_description}\n\n${specsBlock}`
        : specsBlock;
    }
  }
  if (harvest_days == null) {
    const daysMatch = html.match(
      /(?:Days\s+To\s+Maturity|days?\s+to\s+maturity)[\s\S]*?(\d+)\s*[-–]\s*(\d+)\s*days?/i
    ) ?? html.match(/(\d+)\s*[-–]\s*(\d+)\s*days?\s*(?:to\s+maturity)?/i);
    if (daysMatch) {
      const a = parseInt(daysMatch[1], 10);
      const b = parseInt(daysMatch[2], 10);
      if (!Number.isNaN(a) && !Number.isNaN(b)) harvest_days = Math.round((a + b) / 2);
      else if (!Number.isNaN(a)) harvest_days = a;
    }
  }
  if (harvest_days == null) harvest_days = extractFuzzyMaturityDays(html);

  const lightMatch = extract(html, /LIGHT\s*PREFERENCE:\s*([^.<]+?)(?:\.|$)/i)
    ?? extract(html, /Light\s*requirement[s]?:\s*([^.<]+?)(?:\.|$)/i)
    ?? extract(html, /(?:Sun|Light):\s*([^.<]+?)(?:\.|$)/i);
  if (lightMatch) {
    const s = lightMatch.trim();
    if (/full\s*sun|sun|part\s*sun|partial\s*sun|shade/i.test(s)) sun = /^Sun$/i.test(s) ? "Full Sun" : s;
  }
  if (!sun) {
    const fullSunMatch = html.match(/\b(Full\s*Sun|Part\s*Sun|Sun|Partial\s*Shade)\b/i);
    if (fullSunMatch?.[1]) {
      const raw = fullSunMatch[1].trim();
      sun = /^Sun$/i.test(raw) ? "Full Sun" : raw;
    }
  }

  if (days_to_germination == null) {
    const germBlock = html.match(/DAYS\s+TO\s+GERMINATION:\s*([\s\S]+?)\s+SOWING\s*:/i);
    if (germBlock?.[1] && germBlock[1].trim().length > 2) {
      let raw = stripHtmlAndDecode(germBlock[1]).trim();
      if (raw.length > MAX_FUZZY_CHARS) raw = raw.slice(0, MAX_FUZZY_CHARS).trim();
      if (raw.length >= 3) days_to_germination = raw;
    }
  }
  if (days_to_germination == null) days_to_germination = extractFuzzyLabel(html, GERMINATION_KEYWORDS);

  if (plant_spacing == null) {
    const spaceMatch = html.match(
      /PLANT\s*SPACING:\s*([^\n\r<]*?)(?=\r?\n|\r\n|HARDINESS\s+ZONES|PLANT\s+HEIGHT|<\w|$)/i
    );
    if (spaceMatch?.[1]) {
      const raw = stripHtmlAndDecode(spaceMatch[1]).trim();
      if (raw.length > 0 && raw.length <= MAX_FUZZY_CHARS) plant_spacing = raw;
    }
  }
  if (plant_spacing == null) plant_spacing = extractFuzzyLabel(html, SPACING_KEYWORDS);

  const growingStart = html.indexOf("DAYS TO GERMINATION");
  if (growingStart !== -1) {
    const after = html.slice(growingStart);
    const hardStopRe = /Questions\?|Satisfaction\s+Guarantee|From\s+the\s+Grower's\s+Library/i;
    const satisfactionIdx = after.search(hardStopRe);
    const scriptIdx = after.indexOf("<script");
    const footerIdx = after.search(/<footer[\s>]/i);
    const junkIdx = after.search(/\b(function\s*\(\)|CQuotient|slotRecommendation|DataCloud|getCQUserld)\b/i);
    const endIdx = [satisfactionIdx, scriptIdx, footerIdx, junkIdx].filter((i) => i >= 0);
    const cut = endIdx.length > 0 ? Math.min(...endIdx) : 2400;
    const block = after.slice(0, Math.min(cut, 2400));
    let raw = stripHtmlAndDecode(block);
    raw = filterBlacklistedParagraphs(raw);
    if (raw.length > 40 && !raw.includes("CQuotient") && !raw.includes("slotRecommendationType")) {
      let notes = raw
        .replace(/\s*(DAYS TO GERMINATION|SOWING|LIGHT PREFERENCE|PLANT HEIGHT|PLANT SPACING|HARDINESS ZONES|HARVEST|SOIL REQUIREMENTS|USES|NOTES):/gi, "\n\n$1:")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      notes = notes
        .replace(/\n\nDAYS TO GERMINATION:[^\n]*(?=\n\n|$)/gi, "")
        .replace(/\n\nPLANT SPACING:[^\n]*(?=\n\n|$)/gi, "")
        .replace(/\n\nLIGHT PREFERENCE:[^\n]*(?=\n\n|$)/gi, "")
        .replace(/\n\nPLANT HEIGHT:[^\n]*(?=\n\n|$)/gi, "")
        .replace(/\n\nHARDINESS ZONES:[^\n]*(?=\n\n|$)/gi, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
      notes = filterBlacklistedParagraphs(notes);
      if (notes.length > 20) growing_notes = notes;
    }
  }

  if (latin_name == null) latin_name = extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80);
  if (latin_name != null && isJunkSpecValue(latin_name)) latin_name = null;
  if (plant_spacing != null && isJunkSpecValue(plant_spacing)) plant_spacing = null;
  life_cycle = extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30);
  if (hybrid_status == null) hybrid_status = extractFuzzyLabel(html, HYBRID_KEYWORDS, 30);

  const result = {
    imageUrl,
    harvest_days,
    sun,
    days_to_germination,
    plant_spacing,
    growing_notes,
    plant_description,
    latin_name,
    life_cycle,
    hybrid_status,
  };
  if (ogTitle) return { ...result, ogTitle };
  return result;
}

/** Mary's Heirloom Seeds (marysheirloomseeds.com) blueprint: div.product__description, first "N days", italic Latin, .product__media-list img, plant-family fallback. */
function parseMarysHeirloom(html: string, pageOrigin: string, metadata?: OgMetadata | null): {
  imageUrl: string | null;
  harvest_days: number | null;
  sun: string | null;
  water: string | null;
  days_to_germination: string | null;
  plant_spacing: string | null;
  growing_notes: string | null;
  plant_description: string | null;
  latin_name: string | null;
  life_cycle: string | null;
  hybrid_status: string | null;
} {
  const title = (metadata?.ogTitle ?? "").toLowerCase();
  let imageUrl: string | null = null;
  const mediaListIdx = html.indexOf("product__media-list");
  if (mediaListIdx !== -1) {
    const afterMedia = html.slice(mediaListIdx, mediaListIdx + 8000);
    const imgMatch = afterMedia.match(/<img[\s\S]*?(?:src|data-src)=["']([^"']+)["']/i);
    if (imgMatch?.[1]) imageUrl = resolveImageUrl(imgMatch[1].trim(), pageOrigin);
  }
  if (!imageUrl) imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);

  let plant_description: string | null = null;
  let harvest_days: number | null = null;
  let latin_name: string | null = null;

  const descMatch = html.match(
    /<div[^>]*\bclass=["'][^"']*product__description[^"']*["'][^>]*>([\s\S]{1,8000})/i
  );
  if (descMatch?.[1]) {
    const block = descMatch[1];
    const raw = stripHtmlAndDecode(block).trim();
    if (raw.length > 20 && !containsBlacklist(raw)) {
      plant_description = stripTemplatePlaceholders(filterSurgicalDescription(raw));
    }
    const daysMatch = raw.match(/^(\d+)\s*days/i) ?? block.match(/>\s*(\d+)\s*days/i);
    if (daysMatch?.[1]) {
      const n = parseInt(daysMatch[1], 10);
      if (!Number.isNaN(n)) harvest_days = n;
    }
    const italicMatch = block.match(/<(?:i|em)[^>]*>([A-Z][a-z]+\s+[a-z]+)<\/(?:i|em)>/i);
    if (italicMatch?.[1]) {
      const candidate = italicMatch[1].trim();
      if (candidate.length >= 3 && candidate.length <= 50) latin_name = candidate;
    }
  }

  if (!harvest_days) harvest_days = extractFuzzyMaturityDays(html);
  if (!plant_description && metadata?.ogDescription && metadata.ogDescription.length > 20 && !containsBlacklist(metadata.ogDescription)) {
    plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 800));
  }
  if (!latin_name) latin_name = extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80);

  // Mary's Sun: text immediately after "Light:" or "Sun:"; stop before any < tag
  let sun: string | null = null;
  const lightOrSunRe = /(?:Light|Sun)\s*:\s*([^<]{1,80}?)(?=<|$)/i;
  const lightMatch = html.match(lightOrSunRe);
  if (lightMatch?.[1]) {
    const raw = lightMatch[1].trim();
    if (raw.length > 0) sun = stripHtmlAndDecode(raw).trim();
  }
  if (!sun) sun = extractFuzzyLabel(html, SUN_KEYWORDS, 30);
  if (!sun) {
    const fallbackMatch = html.match(/\b(Full\s*Sun|Part\s*Sun|Sun|Partial\s*Shade|Full\s*Shade)\b/i);
    if (fallbackMatch?.[1]) sun = fallbackMatch[1].trim();
  }
  // Fallback for Beets: if Sun is invalid (>15 chars or contains HTML), use Full Sun
  if (title.includes("beet") && sun) {
    if (sun.length > 15 || /<|>/.test(sun)) sun = "Full Sun";
  }

  let water: string | null = null;
  let plant_spacing: string | null = extractFuzzyLabel(html, SPACING_KEYWORDS);

  // Mary's Germination: "Days to Germination:" then capture only the numbers
  let days_to_germination: string | null = null;
  const germMatch = html.match(/Days\s+to\s+Germination\s*:\s*(\d+(?:\s*[-–]\s*\d+)?)/i);
  if (germMatch?.[1]) {
    const nums = germMatch[1].trim();
    days_to_germination = nums.includes("-") || nums.includes("–") ? nums : `${nums} Days`;
  }
  if (!days_to_germination) days_to_germination = extractFuzzyLabel(html, GERMINATION_KEYWORDS);

  if (title.includes("beet")) {
    if (!sun) sun = "Full Sun";
    if (!plant_spacing) plant_spacing = "3-4 inches";
    if (!water) water = "Consistent";
  }

  // Sanity checks: don't store HTML fragments, phone numbers, or boilerplate
  if (sun != null && isJunkSpecValue(sun)) sun = null;
  if (days_to_germination != null && isJunkSpecValue(days_to_germination)) days_to_germination = null;
  if (plant_spacing != null && isJunkSpecValue(plant_spacing)) plant_spacing = null;
  if (latin_name != null && isJunkSpecValue(latin_name)) latin_name = null;

  return {
    imageUrl,
    harvest_days,
    sun,
    water,
    days_to_germination,
    plant_spacing,
    growing_notes: extractSectionedGrowingGuides(html) ?? null,
    plant_description,
    latin_name,
    life_cycle: extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30),
    hybrid_status: extractFuzzyLabel(html, HYBRID_KEYWORDS, 30),
  };
}

/** Burpee (burpee.com): h1.product-name for title; JSON-LD (name, image, description); div.pdp-specs for Sun, Spacing, Maturity; Sowing Method → growing_notes. */
function parseBurpee(html: string, pageOrigin: string, metadata?: OgMetadata | null): {
  imageUrl: string | null;
  harvest_days: number | null;
  sun: string | null;
  days_to_germination: string | null;
  plant_spacing: string | null;
  growing_notes: string | null;
  plant_description: string | null;
  latin_name: string | null;
  life_cycle: string | null;
  hybrid_status: string | null;
  ogTitle?: string;
} {
  let imageUrl: string | null = null;
  let plant_description: string | null = null;
  let ogTitle: string | undefined = undefined;

  const h1Match = html.match(/<h1[^>]*\bclass=["'][^"']*product-name[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match?.[1]) {
    const h1Inner = h1Match[1];
    const varietySpanMatch = h1Inner.match(/<span[^>]*\bclass=["'][^"']*variety[^"']*["'][^>]*>([\s\S]*?)<\/span>/i)
      ?? h1Inner.match(/<span[^>]*\bclass=["'][^"']*product-name[^"']*variety[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
    const varietyFromSpan = varietySpanMatch?.[1] ? stripHtmlAndDecode(varietySpanMatch[1]).trim() : null;
    if (varietyFromSpan) {
      const mainPart = stripHtmlAndDecode(h1Inner.replace(/<span[^>]*\bclass=["'][^"']*variety[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, "").replace(/<span[^>]*\bclass=["'][^"']*product-name[^"']*variety[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, "")).trim();
      if (mainPart.length > 0) ogTitle = `${mainPart}, ${varietyFromSpan}`;
      else ogTitle = varietyFromSpan;
    } else {
      const fullTitle = stripHtmlAndDecode(h1Inner).trim();
      if (fullTitle.length > 1) ogTitle = fullTitle;
    }
  }
  if (!ogTitle && metadata?.ogTitle?.trim()) ogTitle = metadata.ogTitle.trim();

  // 1. Secret Menu: parse JSON-LD first (name, image, description — clean format)
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonLdBlock: RegExpExecArray | null;
  while ((jsonLdBlock = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(jsonLdBlock[1]) as {
        "@type"?: string;
        name?: string;
        image?: string | string[];
        description?: string;
        "@graph"?: Array<{ "@type"?: string; name?: string; image?: string | string[]; description?: string }>;
      };
      const candidates: typeof data[] = [data];
      if (Array.isArray(data?.["@graph"])) candidates.push(...data["@graph"]);
      for (const node of candidates) {
        const typeRaw = node?.["@type"] as string | string[] | undefined;
        if (!typeRaw) continue;
        const isProduct = (t: string) => /Product/i.test(t);
        const typeStr = typeof typeRaw === "string" ? typeRaw : (Array.isArray(typeRaw) ? typeRaw.find(isProduct) : "");
        if (!typeStr || !isProduct(typeStr)) continue;
        if (node.image) {
          const img = Array.isArray(node.image) ? node.image[0] : node.image;
          if (typeof img === "string" && img.startsWith("http") && !imageUrl) {
            imageUrl = resolveImageUrl(img.trim(), pageOrigin);
          }
        }
        if (node.description && typeof node.description === "string" && !plant_description) {
          const raw = node.description.trim();
          if (raw.length > 20 && !containsBlacklist(raw)) {
            plant_description = filterSurgicalDescription(stripTemplatePlaceholders(raw.slice(0, 2000)));
          }
        }
      }
    } catch {
      // ignore invalid JSON-LD
    }
  }
  if (!imageUrl) imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);
  if (!plant_description && metadata?.ogDescription && metadata.ogDescription.length > 20 && !containsBlacklist(metadata.ogDescription)) {
    plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 1200));
  }

  let sun: string | null = null;
  let plant_spacing: string | null = null;
  let harvest_days: number | null = null;

  // 2. Technical Specs: div.pdp-specs grid (key-value pairs)
  const specsMatch = html.match(
    /<div[^>]*\bclass=["'][^"']*pdp-specs[^"']*["'][^>]*>([\s\S]{1,4000})/i
  );
  const specsBlock = specsMatch?.[1] ?? "";
  if (specsBlock) {
    const getValueAfterLabel = (label: string): string | null => {
      const escaped = label.replace(/\s+/g, "\\s+");
      const afterLabel = new RegExp(escaped + "[\\s\\S]*?</[^>]+>\\s*<[^>]+[^>]*>([^<]*)</", "i");
      const m = specsBlock.match(afterLabel);
      if (m?.[1]) return stripHtmlAndDecode(m[1]).trim();
      const inline = new RegExp(escaped + "\\s*[:\\s]*([^<\n]{1,80})", "i");
      const m2 = specsBlock.match(inline);
      return m2?.[1]?.trim() ?? null;
    };
    const sunVal = getValueAfterLabel("Sun");
    if (sunVal) sun = sunVal;
    const spacingVal = getValueAfterLabel("Plant Spacing");
    if (spacingVal) plant_spacing = spacingVal;
    const maturityVal = getValueAfterLabel("Days to Maturity");
    if (maturityVal) {
      const range = maturityVal.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (range) {
        const a = parseInt(range[1], 10);
        const b = parseInt(range[2], 10);
        if (!Number.isNaN(a) && !Number.isNaN(b)) harvest_days = Math.round((a + b) / 2);
      } else {
        const single = maturityVal.match(/(\d+)/);
        if (single?.[1]) {
          const n = parseInt(single[1], 10);
          if (!Number.isNaN(n)) harvest_days = n;
        }
      }
    }
  }

  if (harvest_days == null) harvest_days = extractFuzzyMaturityDays(html);
  if (plant_spacing == null) plant_spacing = extractFuzzyLabel(html, SPACING_KEYWORDS);

  // 4. Bodacious / Corn: Sowing Method → add to Vendor Profile Notes (critical for corn success)
  let growing_notes: string | null = extractSectionedGrowingGuides(html) ?? null;
  const sowingMatch = html.match(/Sowing\s+Method[\s\S]*?<\/[^>]+>\s*<[^>]+[^>]*>([^<]*)</i)
    ?? html.match(/Sowing\s+Method\s*[:\s]*([^\n<]{2,120})/i);
  if (sowingMatch?.[1]) {
    const sowingText = stripHtmlAndDecode(sowingMatch[1]).trim();
    if (sowingText.length > 0) {
      const sowingNote = `Sowing Method: ${sowingText}`;
      growing_notes = growing_notes ? `${growing_notes}\n\n${sowingNote}` : sowingNote;
    }
  }

  const result = {
    imageUrl,
    harvest_days,
    sun: sun ?? extractFuzzyLabel(html, SUN_KEYWORDS, 30) ?? (html.match(/\b(Full\s*Sun|Part\s*Sun|Partial\s*Shade)\b/i)?.[1]?.trim() ?? null),
    days_to_germination: extractFuzzyLabel(html, GERMINATION_KEYWORDS),
    plant_spacing,
    growing_notes,
    plant_description,
    latin_name: extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80),
    life_cycle: extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30),
    hybrid_status: extractFuzzyLabel(html, HYBRID_KEYWORDS, 30),
  };
  if (ogTitle) return { ...result, ogTitle };
  return result;
}

/** High Mowing (highmowingseeds.com): dl.additional-attributes for Days to Maturity + Sun/Shade; discard .woff or HTML in values. */
function parseHighMowing(html: string, pageOrigin: string, metadata?: OgMetadata | null): {
  imageUrl: string | null;
  harvest_days: number | null;
  sun: string | null;
  days_to_germination: string | null;
  plant_spacing: string | null;
  growing_notes: string | null;
  plant_description: string | null;
  latin_name: string | null;
  life_cycle: string | null;
  hybrid_status: string | null;
  vendor: string | null;
  category: string | null;
} {
  const imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);
  let harvest_days: number | null = null;
  let plant_spacing: string | null = null;
  let latin_name: string | null = null;
  let sun: string | null = null;
  const notesParts: string[] = [];

  function discardWoffOrHtml(s: string | null | undefined): string | null {
    if (!s || !s.trim()) return null;
    const t = stripHtmlAndDecode(s).trim();
    if (/\.woff|<|>/.test(t)) return null;
    return t.length > 0 ? t : null;
  }

  const dlMatch = html.match(/<dl[^>]*\bclass=["'][^"']*additional-attributes[^"']*["'][^>]*>([\s\S]{1,4000})<\/dl>/i);
  const dlBlock = dlMatch?.[1] ?? "";
  if (dlBlock) {
    const getDdForDt = (block: string, label: string): string | null => {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      const re = new RegExp(`<dt[^>]*>\\s*${escaped}\\s*</dt>\\s*<dd[^>]*>([\\s\\S]*?)</dd>`, "i");
      const m = block.match(re);
      return m?.[1] ? stripHtmlAndDecode(m[1]).trim() : null;
    };
    const maturityVal = discardWoffOrHtml(getDdForDt(dlBlock, "Days to Maturity"));
    if (maturityVal) {
      const range = maturityVal.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (range) {
        const a = parseInt(range[1], 10);
        const b = parseInt(range[2], 10);
        if (!Number.isNaN(a) && !Number.isNaN(b)) harvest_days = Math.round((a + b) / 2);
      } else {
        const single = maturityVal.match(/(\d+)/);
        if (single?.[1]) {
          const n = parseInt(single[1], 10);
          if (!Number.isNaN(n)) harvest_days = n;
        }
      }
    }
    const sunVal = discardWoffOrHtml(getDdForDt(dlBlock, "Sun/Shade"));
    if (sunVal) sun = sunVal;
  }

  // Vendor: og:site_name or div.product-single__vendor
  let vendor: string | null = metadata?.ogSiteName?.trim() ?? null;
  if (!vendor) {
    const vendorDiv = html.match(/<div[^>]*\bclass=["'][^"']*product-single__vendor[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    if (vendorDiv?.[1]) {
      const raw = stripHtmlAndDecode(vendorDiv[1]).trim();
      if (raw.length > 0 && raw.length <= 120) vendor = raw;
    }
  }

  // Type/category: nav.breadcrumb second-to-last item
  let category: string | null = null;
  const breadcrumbMatch = html.match(/<nav[^>]*\bclass=["'][^"']*breadcrumb[^"']*["'][^>]*>([\s\S]{1,2000})<\/nav>/i);
  if (breadcrumbMatch?.[1]) {
    const links = breadcrumbMatch[1].match(/<a[^>]*>([\s\S]*?)<\/a>/gi) ?? [];
    const items = links.map((a) => stripHtmlAndDecode(a.replace(/<[^>]+>/g, "")).trim()).filter(Boolean);
    if (items.length >= 2) {
      const secondToLast = items[items.length - 2];
      if (secondToLast) category = sanitizePlantType(secondToLast) || secondToLast.trim();
    } else if (items.length === 1 && items[0]) {
      category = sanitizePlantType(items[0]) || items[0].trim();
    }
  }

  const optionsBottom = html.match(/<div[^>]*\bclass=["'][^"']*product-options-bottom[^"']*["'][^>]*>([\s\S]{1,6000})/i)?.[1] ?? "";
  const specContainer = html.match(/<div[^>]*\bclass=["'][^"']*attribute[^"']*specification[^"']*["'][^>]*>([\s\S]{1,6000})/i)?.[1] ?? "";
  const specsHtml = optionsBottom + specContainer || html;
  const getDataTh = (haystack: string, label: string): string | null => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const re = new RegExp(`data-th=["']${escaped}["'][^>]*>([\\s\\S]*?)</(?:div|td)>`, "i");
    const m = haystack.match(re);
    if (m?.[1]) return discardWoffOrHtml(m[1]);
    return null;
  };

  if (harvest_days == null) {
    const maturityVal = getDataTh(specsHtml, "Days to Maturity");
    if (maturityVal) {
      const range = maturityVal.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (range) {
        const a = parseInt(range[1], 10);
        const b = parseInt(range[2], 10);
        if (!Number.isNaN(a) && !Number.isNaN(b)) harvest_days = Math.round((a + b) / 2);
      } else {
        const single = maturityVal.match(/(\d+)/);
        if (single?.[1]) {
          const n = parseInt(single[1], 10);
          if (!Number.isNaN(n)) harvest_days = n;
        }
      }
    }
  }
  if (!sun) sun = getDataTh(specsHtml, "Sun/Shade");
  if (plant_spacing == null) {
    const spacingVal = getDataTh(specsHtml, "Plant Spacing");
    if (spacingVal) plant_spacing = spacingVal;
  }
  const depthVal = getDataTh(specsHtml, "Seeding Depth");
  if (depthVal) notesParts.push(`Seeding Depth: ${depthVal}`);

  const scientificMatch = html.match(/<div[^>]*\bclass=["'][^"']*product-scientific-name[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
  if (scientificMatch?.[1]) {
    const raw = stripHtmlAndDecode(scientificMatch[1]).trim();
    if (raw.length >= 2 && raw.length <= 80 && /^[A-Za-z]+\s+[a-z]+/.test(raw)) latin_name = raw;
  }

  const growingInfoMatch = html.match(/<div[^>]*\bid=["']growing-information["'][^>]*>([\s\S]{1,5000})/i) ?? html.match(/id=["']growing-information["'][^>]*>([\s\S]{1,5000})/i);
  const growingBlock = growingInfoMatch?.[1] ?? "";
  if (growingBlock && !sun) {
    const blockText = stripHtmlAndDecode(growingBlock);
    const sunMatch = blockText.match(/(?:Sun|Heat)[\s:]*([^\n.]{2,60})/i) ?? blockText.match(/\b(Full\s*Sun|Part\s*Sun|Partial\s*Shade|Heat\s*tolerant)\b/i);
    if (sunMatch?.[1]) sun = discardWoffOrHtml(sunMatch[1].trim());
    else if (sunMatch?.[0]) sun = discardWoffOrHtml(sunMatch[0].trim());
    if (blockText.length > 40) notesParts.push(blockText.slice(0, 1500).trim());
  }

  if (harvest_days == null) harvest_days = extractFuzzyMaturityDays(html);
  if (plant_spacing == null) plant_spacing = extractFuzzyLabel(html, SPACING_KEYWORDS);
  if (!sun) sun = discardWoffOrHtml(extractFuzzyLabel(html, SUN_KEYWORDS, 30)) ?? discardWoffOrHtml(html.match(/\b(Full\s*Sun|Part\s*Sun|Partial\s*Shade)\b/i)?.[1]?.trim() ?? null);
  if (!latin_name) latin_name = extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80);

  let plant_description: string | null = null;
  if (metadata?.ogDescription && metadata.ogDescription.length > 20 && !containsBlacklist(metadata.ogDescription)) {
    plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 1200));
  }

  const growing_notes = notesParts.length > 0 ? notesParts.join("\n\n") : (extractSectionedGrowingGuides(html) ?? null);

  return {
    imageUrl,
    harvest_days,
    sun,
    days_to_germination: extractFuzzyLabel(html, GERMINATION_KEYWORDS),
    plant_spacing,
    growing_notes,
    plant_description,
    latin_name,
    life_cycle: extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30),
    hybrid_status: extractFuzzyLabel(html, HYBRID_KEYWORDS, 30),
    vendor,
    category,
  };
}

/** Botanical Interests (botanicalinterests.com): span.product-scientific-name, .product-attributes .attribute-item (Exposure, Days to Emerge), div.tab-content#growing-instructions for Spacing. */
function parseBotanicalInterests(html: string, pageOrigin: string, metadata?: OgMetadata | null): {
  imageUrl: string | null;
  harvest_days: number | null;
  sun: string | null;
  days_to_germination: string | null;
  plant_spacing: string | null;
  growing_notes: string | null;
  plant_description: string | null;
  latin_name: string | null;
  life_cycle: string | null;
  hybrid_status: string | null;
} {
  const imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);
  let sun: string | null = null;
  let days_to_germination: string | null = null;
  let plant_spacing: string | null = null;
  let latin_name: string | null = null;

  const scientificMatch = html.match(/<span[^>]*\bclass=["'][^"']*product-scientific-name[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);
  if (scientificMatch?.[1]) {
    const raw = stripHtmlAndDecode(scientificMatch[1]).trim();
    if (raw.length >= 2 && raw.length <= 80 && /^[A-Za-z]+\s+[a-z]+/.test(raw)) latin_name = raw;
  }

  const attrsMatch = html.match(/<[^>]*\bclass=["'][^"']*product-attributes[^"']*["'][^>]*>([\s\S]{1,4000})/i);
  const attrsBlock = attrsMatch?.[1] ?? "";
  if (attrsBlock) {
    const getAttributeItemValue = (label: string): string | null => {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      const afterLabel = new RegExp(`${escaped}[\\s\\S]*?</[^>]+>\\s*<[^>]+>([^<]*)</`, "i");
      const m = attrsBlock.match(afterLabel);
      if (m?.[1]) return stripHtmlAndDecode(m[1]).trim();
      const itemBlocks = attrsBlock.match(/attribute-item[\s\S]*?<\/div>/gi) ?? [];
      for (const item of itemBlocks) {
        if (!new RegExp(escaped, "i").test(item)) continue;
        const text = stripHtmlAndDecode(item);
        const val = text.replace(new RegExp(`.*${escaped}\\s*[:\\s]*`, "i"), "").trim().slice(0, 80);
        if (val) return val;
      }
      return null;
    };
    const exposureVal = getAttributeItemValue("Exposure");
    if (exposureVal) sun = exposureVal;
    const emergeVal = getAttributeItemValue("Days to Emerge");
    if (emergeVal) days_to_germination = emergeVal;
  }

  const growingTabMatch = html.match(/<div[^>]*\b(?:class=["'][^"']*tab-content[^"']*["'][^>]*\bid=["']growing-instructions["']|id=["']growing-instructions["'][^>]*\bclass=["'][^"']*tab-content[^"']*["'])[^>]*>([\s\S]{1,6000})/i)
    ?? html.match(/id=["']growing-instructions["'][^>]*>([\s\S]{1,6000})/i);
  const growingBlock = growingTabMatch?.[1] ?? "";
  if (growingBlock && !plant_spacing) {
    const spacingMatch = growingBlock.match(/Spacing\s*[:\s]*(\d+)\s*[-–]\s*(\d+)\s*(?:[""]|inches?)?/i)
      ?? growingBlock.match(/Spacing\s*[:\s]*(\d+)\s*(?:[""]|inches?)?/i);
    if (spacingMatch?.[1]) {
      plant_spacing = spacingMatch[2] ? `${spacingMatch[1]}–${spacingMatch[2]}"` : `${spacingMatch[1]}"`;
    }
  }

  if (!sun) sun = extractFuzzyLabel(html, SUN_KEYWORDS, 30) ?? (html.match(/\b(Full\s*Sun|Part\s*Sun|Partial\s*Shade)\b/i)?.[1]?.trim() ?? null);
  if (!days_to_germination) days_to_germination = extractFuzzyLabel(html, GERMINATION_KEYWORDS);
  if (!plant_spacing) plant_spacing = extractFuzzyLabel(html, SPACING_KEYWORDS);
  if (!latin_name) latin_name = extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80);

  let plant_description: string | null = null;
  if (metadata?.ogDescription && metadata.ogDescription.length > 20 && !containsBlacklist(metadata.ogDescription)) {
    plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 1200));
  }

  return {
    imageUrl,
    harvest_days: extractFuzzyMaturityDays(html),
    sun,
    days_to_germination,
    plant_spacing,
    growing_notes: extractSectionedGrowingGuides(html) ?? null,
    plant_description,
    latin_name,
    life_cycle: extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30),
    hybrid_status: extractFuzzyLabel(html, HYBRID_KEYWORDS, 30),
  };
}

/** Outside Pride (outsidepride.com): table#product_stats — Light Required→Sun, Sowing Rate→Spacing; reject values starting with it-id=. */
function parseOutsidePride(html: string, pageOrigin: string, metadata?: OgMetadata | null): {
  imageUrl: string | null;
  harvest_days: number | null;
  sun: string | null;
  days_to_germination: string | null;
  plant_spacing: string | null;
  growing_notes: string | null;
  plant_description: string | null;
  latin_name: string | null;
  life_cycle: string | null;
  hybrid_status: string | null;
} {
  const imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);
  let sun: string | null = null;
  let plant_spacing: string | null = null;
  let days_to_germination: string | null = null;
  let plant_description: string | null = null;

  function rejectItId(s: string | null | undefined): string | null {
    if (!s || !s.trim()) return null;
    const t = stripHtmlAndDecode(s).trim();
    if (/^it-id=/i.test(t)) return null;
    return isValidSpecValue(t) ? t : null;
  }

  const tableMatch = html.match(/<table[^>]*\bid=["']product_stats["'][^>]*>([\s\S]{1,4000})<\/table>/i) ?? html.match(/id=["']product_stats["'][^>]*>([\s\S]{1,4000})/i);
  const tableBlock = tableMatch?.[1] ?? "";
  if (tableBlock) {
    const getCellForHeader = (label: string): string | null => {
      const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
      const re = new RegExp(`<t[hd][^>]*>\\s*${escaped}\\s*</t[hd]>\\s*<t[hd][^>]*>([\\s\\S]*?)</t[hd]>`, "i");
      const m = tableBlock.match(re);
      return m?.[1] ? stripHtmlAndDecode(m[1]).trim() : null;
    };
    const lightVal = getCellForHeader("Light Required");
    if (lightVal) sun = rejectItId(lightVal);
    const sowingVal = getCellForHeader("Sowing Rate");
    if (sowingVal) plant_spacing = rejectItId(sowingVal);
  }
  if (!sun || !plant_spacing) {
    const specsMatch = html.match(
      /<div[^>]*\bclass=["'][^"']*pdp-specs-container[^"']*["'][^>]*>([\s\S]{1,4000})/i
    );
    const specsBlock = specsMatch?.[1] ?? "";
    if (specsBlock) {
      const getValueForLabel = (label: string): string | null => {
        const escaped = label.replace(/\s+/g, "\\s+");
        const re = new RegExp(escaped + "[\\s\\S]*?</[^>]+>\\s*<[^>]+[^>]*>([^<]*)</", "i");
        const m = specsBlock.match(re);
        if (m?.[1]) return stripHtmlAndDecode(m[1]).trim();
        const inline = new RegExp(escaped + "\\s*[:\\s]*([^<\n]{1,80})", "i");
        const m2 = specsBlock.match(inline);
        return m2?.[1]?.trim() ?? null;
      };
      if (!sun) { const envVal = getValueForLabel("ENVIRONMENT"); if (envVal) sun = rejectItId(envVal); }
      if (!plant_spacing) { const spacingVal = getValueForLabel("PLANT SPACING"); if (spacingVal) plant_spacing = rejectItId(spacingVal); }
    }
  }

  const prodDescMatch = html.match(
    /<div[^>]*\bclass=["'][^"']*product-description[^"']*["'][^>]*>([\s\S]{1,10000})/i
  );
  if (prodDescMatch?.[1]) {
    let block = prodDescMatch[1];
    block = block.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>\s*<p/gi, "\n\n");
    const raw = stripHtmlAndDecode(block).trim();
    if (raw.length > 20 && !containsBlacklist(raw)) {
      plant_description = filterSurgicalDescription(stripTemplatePlaceholders(raw.slice(0, 4000)));
    }
    const germWeeks = block.match(/sprout\s+in\s+(\d+)\s*[-–]\s*(\d+)\s*weeks?/i)
      ?? raw.match(/sprout\s+in\s+(\d+)\s*[-–]\s*(\d+)\s*weeks?/i);
    if (germWeeks?.[1] && germWeeks[2]) {
      days_to_germination = `${germWeeks[1]}–${germWeeks[2]} weeks`;
    }
  }

  if (days_to_germination == null) days_to_germination = extractFuzzyLabel(html, GERMINATION_KEYWORDS);
  if (plant_spacing == null) plant_spacing = rejectItId(extractFuzzyLabel(html, SPACING_KEYWORDS));
  if (!sun) {
    sun = rejectItId(extractFuzzyLabel(html, SUN_KEYWORDS, 30))
      ?? rejectItId(html.match(/\b(Full\s*Sun|Part\s*Sun|Partial\s*Shade|Full\s*Shade)\b/i)?.[1]?.trim() ?? null);
  }
  if (!plant_description && metadata?.ogDescription && metadata.ogDescription.length > 20 && !containsBlacklist(metadata.ogDescription)) {
    plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 800));
  }

  return {
    imageUrl,
    harvest_days: extractFuzzyMaturityDays(html),
    sun,
    days_to_germination,
    plant_spacing,
    growing_notes: extractSectionedGrowingGuides(html) ?? null,
    plant_description,
    latin_name: extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80),
    life_cycle: extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30),
    hybrid_status: extractFuzzyLabel(html, HYBRID_KEYWORDS, 30),
  };
}

/** Territorial Seed Company (territorialseed.com): div#growing-info (Sun/Water/From Seed table), div.product-single__description (first p, maturity), div.product-single__photos (data-zoom/src). */
function parseTerritorial(html: string, pageOrigin: string, metadata?: OgMetadata | null): {
  imageUrl: string | null;
  harvest_days: number | null;
  sun: string | null;
  water: string | null;
  days_to_germination: string | null;
  plant_spacing: string | null;
  growing_notes: string | null;
  plant_description: string | null;
  latin_name: string | null;
  life_cycle: string | null;
  hybrid_status: string | null;
} {
  // Image: first img in div.product-single__photos; prefer data-zoom for highest resolution
  let imageUrl: string | null = null;
  const photosIdx = html.indexOf("product-single__photos");
  if (photosIdx !== -1) {
    const afterPhotos = html.slice(photosIdx, photosIdx + 6000);
    const imgTag = afterPhotos.match(/<img[\s\S]*?>/i);
    if (imgTag?.[0]) {
      const zoomMatch = imgTag[0].match(/\bdata-zoom=["']([^"']+)["']/i);
      const srcMatch = imgTag[0].match(/(?:data-src|src)=["']([^"']+)["']/i);
      const candidate = zoomMatch?.[1] ?? srcMatch?.[1];
      if (candidate?.trim() && !candidate.startsWith("data:")) {
        imageUrl = resolveImageUrl(candidate.trim(), pageOrigin);
      }
    }
  }
  if (!imageUrl) imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);

  let plant_description: string | null = null;
  let harvest_days: number | null = null;

  // Content only: div.product-single__description or div.rte, first paragraph / <p> blocks to avoid layout text
  const descMatch = html.match(
    /<div[^>]*\bclass=["'][^"']*product-single__description[^"']*["'][^>]*>([\s\S]{1,6000})/i
  );
  const rteMatch = html.match(/<div[^>]*\bclass=["'][^"']*rte[^"']*["'][^>]*>([\s\S]{1,4000})/i);
  const descBlock = descMatch?.[1] ?? rteMatch?.[1];
  if (descBlock) {
    const firstP = descBlock.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (firstP?.[1]) {
      const raw = stripHtmlAndDecode(firstP[1]).trim();
      if (raw.length > 20 && !containsBlacklist(raw)) {
        plant_description = filterSurgicalDescription(stripTemplatePlaceholders(raw));
      }
    }
    const daysInBold = descBlock.match(/<(?:b|strong)[^>]*>(\d+)\s*days?\.?<\/(?:b|strong)>/i)
      ?? descBlock.match(/<(?:b|strong)[^>]*>(\d+)\s*days?/i);
    if (daysInBold?.[1]) {
      const n = parseInt(daysInBold[1], 10);
      if (!Number.isNaN(n)) harvest_days = n;
    }
    if (harvest_days == null) {
      const leadingDays = descBlock.match(/>\s*(\d+)\s*days?\.?\s*</i) ?? descBlock.match(/^[\s\S]*?(\d+)\s*days?\.?\s*</i);
      if (leadingDays?.[1]) {
        const n = parseInt(leadingDays[1], 10);
        if (!Number.isNaN(n)) harvest_days = n;
      }
    }
  }

  let sun: string | null = null;
  let water: string | null = null;
  let plant_spacing: string | null = null;
  let days_to_germination: string | null = null;

  function territorialSanitize(s: string | null | undefined): string | null {
    if (!s || !s.trim()) return null;
    const t = stripHtmlAndDecode(s).trim();
    if (/<|>|">|<\/?img/i.test(t)) return null;
    return isValidSpecValue(t) ? t : null;
  }

  const tabMatch = html.match(/<[^>]*\bid=["']tab-growing-culture["'][^>]*>([\s\S]{1,8000})/i) ?? html.match(/id=["']tab-growing-culture["'][^>]*>([\s\S]{1,8000})/i);
  const plantingInfoMatch = html.match(/<div[^>]*\bclass=["'][^"']*planting-info[^"']*["'][^>]*>([\s\S]{1,8000})/i);
  const preferredBlock = (tabMatch?.[1] ?? plantingInfoMatch?.[1] ?? "").slice(0, 8000);

  const growingMatch = html.match(
    /<div[^>]*\bid=["']growing-info["'][^>]*>([\s\S]{1,8000})/i
  ) ?? html.match(/id=["']growing-info["'][^>]*>([\s\S]{1,8000})/i);
  const growingBlock = preferredBlock || (growingMatch?.[1] ?? "");
  if (growingBlock) {
    const sunIdx = growingBlock.search(/Sunlight\s+Requirements/i);
    if (sunIdx !== -1) {
      const sunSlice = growingBlock.slice(sunIdx, sunIdx + 600);
      const sunText = stripHtmlAndDecode(sunSlice)
        .replace(/Sunlight\s+Requirements\s*/i, "")
        .trim();
      const firstLine = sunText.split(/\n/)[0]?.trim().slice(0, 80);
      if (firstLine && firstLine.length > 2) sun = territorialSanitize(firstLine);
    }
    const waterIdx = growingBlock.search(/Watering\s+Requirements/i);
    if (waterIdx !== -1) {
      const waterSlice = growingBlock.slice(waterIdx, waterIdx + 600);
      const waterText = stripHtmlAndDecode(waterSlice)
        .replace(/Watering\s+Requirements\s*/i, "")
        .trim();
      const firstLine = waterText.split(/\n/)[0]?.trim().slice(0, 80);
      if (firstLine && firstLine.length > 2) water = territorialSanitize(firstLine);
    }
    const fromSeedIdx = growingBlock.search(/From\s+Seed/i);
    if (fromSeedIdx !== -1) {
      const tableBlock = growingBlock.slice(fromSeedIdx, fromSeedIdx + 2500);
      const seedSpacingMatch = tableBlock.match(/Seed\s+Spacing[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i)
        ?? tableBlock.match(/Seed\s+Spacing\s*[:\s]*([^\n<]+)/i);
      const rowSpacingMatch = tableBlock.match(/Row\s+Spacing[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i)
        ?? tableBlock.match(/Row\s+Spacing\s*[:\s]*([^\n<]+)/i);
      const seedVal = territorialSanitize(seedSpacingMatch?.[1]);
      const rowVal = territorialSanitize(rowSpacingMatch?.[1]);
      if (seedVal || rowVal) {
        if (seedVal && rowVal) plant_spacing = `Seed: ${seedVal}, Row: ${rowVal}`;
        else if (seedVal) plant_spacing = seedVal;
        else if (rowVal) plant_spacing = rowVal;
      }
      const emergenceMatch = tableBlock.match(/Days\s+to\s+Emergence[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i)
        ?? tableBlock.match(/Days\s+to\s+Emergence\s*[:\s]*([^\n<]+)/i);
      const emergenceVal = territorialSanitize(emergenceMatch?.[1]);
      if (emergenceVal && emergenceVal.length <= 60) days_to_germination = emergenceVal;
    }
  }

  if (harvest_days == null) harvest_days = extractFuzzyMaturityDays(html);
  if (!plant_description && metadata?.ogDescription && metadata.ogDescription.length > 20 && !containsBlacklist(metadata.ogDescription)) {
    plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 800));
  }
  if (!sun) {
    sun = territorialSanitize(extractFuzzyLabel(html, SUN_KEYWORDS, 30));
  }
  if (!sun) {
    const m = html.match(/\b(Full\s*Sun|Part\s*Sun|Partial\s*Shade|Full\s*Shade)\b/i);
    if (m?.[1]) sun = territorialSanitize(m[1].trim());
  }
  if (plant_spacing == null) {
    plant_spacing = territorialSanitize(extractFuzzyLabel(html, SPACING_KEYWORDS));
  }
  if (days_to_germination == null) {
    days_to_germination = territorialSanitize(extractFuzzyLabel(html, GERMINATION_KEYWORDS));
  }

  return {
    imageUrl,
    harvest_days,
    sun,
    water,
    days_to_germination,
    plant_spacing,
    growing_notes: extractSectionedGrowingGuides(html) ?? null,
    plant_description,
    latin_name: extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80),
    life_cycle: extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30),
    hybrid_status: extractFuzzyLabel(html, HYBRID_KEYWORDS, 30),
  };
}

/** Keyword regex extraction for Shopify-style description blocks (Sun, Spacing, Germination). */
function extractShopifyKeywordSpecs(blockText: string): {
  sun: string | null;
  plant_spacing: string | null;
  days_to_germination: string | null;
  harvest_days: number | null;
} {
  const text = stripHtmlAndDecode(blockText);
  const sunMatch = text.match(/(Full Sun|Part Sun|Partial Shade|Full Shade|Shade)/i);
  const sun = sunMatch?.[1]?.trim() ?? null;
  const spacingMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*[""]?(?:\s*inches?)?/i) ?? text.match(/(\d+)\s*[""]?(?:\s*inches?)?/i);
  let plant_spacing: string | null = null;
  if (spacingMatch) {
    plant_spacing = spacingMatch[2] ? `${spacingMatch[1]}–${spacingMatch[2]}"` : `${spacingMatch[1]}"`;
  }
  const germMatch = text.match(/(\d+)\s*[-–]\s*(\d+)\s*days?/i);
  const days_to_germination = germMatch ? `${germMatch[1]}–${germMatch[2]} days` : null;
  const maturityMatch = text.match(/(\d+)\s*days?\s*(?:to\s+maturity|maturity)?/i);
  let harvest_days: number | null = null;
  if (maturityMatch?.[1]) {
    const n = parseInt(maturityMatch[1], 10);
    if (!Number.isNaN(n)) harvest_days = n;
  }
  return { sun, plant_spacing, days_to_germination, harvest_days };
}

/** Eden Brothers (edenbrothers.com): full h1 product title, Fast Facts/Quick Facts for Sun/Light; reject URL-slug specs. */
function parseEdenBrothers(html: string, pageOrigin: string, metadata?: OgMetadata | null): ReturnType<typeof parseUniversal> & { ogTitle?: string } {
  const imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);
  let plant_description: string | null = null;
  let sun: string | null = null;
  let plant_spacing: string | null = null;
  let days_to_germination: string | null = null;
  let harvest_days: number | null = null;
  let ogTitle: string | undefined = undefined;

  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match?.[1]) {
    const fullTitle = stripHtmlAndDecode(h1Match[1]).trim();
    if (fullTitle.length > 1) ogTitle = fullTitle;
  }
  if (!ogTitle && metadata?.ogTitle?.trim()) ogTitle = metadata.ogTitle.trim();

  const descMatch = html.match(/<div[^>]*\bclass=["'][^"']*product-details__description[^"']*["'][^>]*>([\s\S]{1,5000})/i);
  if (descMatch?.[1]) {
    const raw = stripHtmlAndDecode(descMatch[1]).trim();
    if (raw.length > 20 && !containsBlacklist(raw)) plant_description = filterSurgicalDescription(stripTemplatePlaceholders(raw.slice(0, 2000)));
  }

  const acceptSpec = (val: string | null): string | null => {
    if (!val || !val.trim()) return null;
    const t = val.trim();
    if (looksLikeUrlSlug(t)) return null;
    if (!isValidSpecValue(t)) return null;
    return t;
  };

  const fastFactsMatch = html.match(/(?:Fast\s+Facts|Quick\s+Facts)[\s\S]{0,200}?(?:<div[^>]*>|<ul[^>]*>|[\s\S]{0,100}?)([\s\S]{1,2500})/i);
  const factsBlock = fastFactsMatch?.[1] ?? "";
  if (factsBlock) {
    const getFromFacts = (label: string): string | null => {
      const re = new RegExp(`(?:${label.replace(/\s+/g, "[\\s\\S]*?")}[\\s\\S]*?[:\\s]*([^<\n]{2,80})`, "i");
      const m = factsBlock.match(re);
      const raw = m?.[1] ? stripHtmlAndDecode(m[1]).trim() : null;
      return acceptSpec(raw);
    };
    if (!sun) sun = getFromFacts("Light") ?? getFromFacts("Sun") ?? getFromFacts("Exposure");
    if (!plant_spacing) plant_spacing = getFromFacts("Spacing") ?? getFromFacts("Plant Spacing");
    if (!days_to_germination) days_to_germination = getFromFacts("Germination") ?? getFromFacts("Days to Emerge");
    if (harvest_days == null) {
      const maturityVal = getFromFacts("Days to Maturity") ?? getFromFacts("Maturity");
      if (maturityVal) {
        const num = maturityVal.match(/(\d+)/);
        if (num?.[1]) harvest_days = parseInt(num[1], 10) || null;
      }
    }
  }

  const listMatch = html.match(/<ul[^>]*\bclass=["'][^"']*product-details__list[^"']*["'][^>]*>([\s\S]{1,3000})/i);
  const listBlock = listMatch?.[1] ?? "";
  if (listBlock) {
    const getFromList = (label: string): string | null => {
      const re = new RegExp(`<li[^>]*>[\\s\\S]*?${label.replace(/\s+/g, "[\\s\\S]*?")}[\\s\\S]*?[:\\s]*([^<]+)`, "i");
      const m = listBlock.match(re);
      const raw = m?.[1] ? stripHtmlAndDecode(m[1]).trim() : null;
      return acceptSpec(raw);
    };
    if (!sun) sun = getFromList("Sun") ?? getFromList("Exposure") ?? getFromList("Light");
    if (!plant_spacing) plant_spacing = getFromList("Spacing") ?? getFromList("Plant Spacing");
    if (!days_to_germination) days_to_germination = getFromList("Germination") ?? getFromList("Days to Emerge");
    if (harvest_days == null) {
      const maturityVal = getFromList("Days to Maturity") ?? getFromList("Maturity");
      if (maturityVal) {
        const num = maturityVal.match(/(\d+)/);
        if (num?.[1]) harvest_days = parseInt(num[1], 10) || null;
      }
    }
  }

  if (!plant_description && metadata?.ogDescription?.trim()) plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 800));
  if (harvest_days == null) harvest_days = extractFuzzyMaturityDays(html);
  if (!sun) {
    const fromFuzzy = extractFuzzyLabel(html, SUN_KEYWORDS, 30) ?? (html.match(/\b(Full Sun|Part Sun|Partial Shade)\b/i)?.[1]?.trim() ?? null);
    sun = acceptSpec(fromFuzzy);
  }
  if (!plant_spacing) {
    const fromFuzzy = extractFuzzyLabel(html, SPACING_KEYWORDS);
    plant_spacing = acceptSpec(fromFuzzy);
  }
  if (!days_to_germination) {
    const fromFuzzy = extractFuzzyLabel(html, GERMINATION_KEYWORDS);
    days_to_germination = acceptSpec(fromFuzzy);
  }

  const result: ReturnType<typeof parseUniversal> & { ogTitle?: string } = {
    imageUrl,
    harvest_days,
    sun,
    days_to_germination,
    plant_spacing,
    growing_notes: extractSectionedGrowingGuides(html) ?? null,
    plant_description,
    latin_name: extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80),
    life_cycle: extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30),
    hybrid_status: extractFuzzyLabel(html, HYBRID_KEYWORDS, 30),
  };
  if (ogTitle) result.ogTitle = ogTitle;
  return result;
}

/** Park Seed (parkseed.com): JSON-LD first (like Burpee), secondary div.pdp-specs; description from div.pdp-details__description. */
function parseParkSeed(html: string, pageOrigin: string, metadata?: OgMetadata | null): ReturnType<typeof parseUniversal> {
  let imageUrl: string | null = null;
  let plant_description: string | null = null;
  let sun: string | null = null;
  let plant_spacing: string | null = null;
  let harvest_days: number | null = null;

  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonLdBlock: RegExpExecArray | null;
  while ((jsonLdBlock = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(jsonLdBlock[1]) as { "@type"?: string; image?: string | string[]; description?: string; "@graph"?: Array<{ "@type"?: string; image?: string | string[]; description?: string }> };
      const candidates: typeof data[] = [data];
      if (Array.isArray(data?.["@graph"])) candidates.push(...data["@graph"]);
      for (const node of candidates) {
        const typeRaw = node?.["@type"] as string | string[] | undefined;
        const typeStr = typeof typeRaw === "string" ? typeRaw : (Array.isArray(typeRaw) ? (typeRaw.find((t) => /Product/i.test(String(t))) ?? "") : "");
        if (!typeRaw || !/Product/i.test(typeStr)) continue;
        if (node.image && !imageUrl) {
          const img = Array.isArray(node.image) ? node.image[0] : node.image;
          if (typeof img === "string" && img.startsWith("http")) imageUrl = resolveImageUrl(img.trim(), pageOrigin);
        }
        if (node.description && typeof node.description === "string" && !plant_description && node.description.length > 20) {
          plant_description = filterSurgicalDescription(stripTemplatePlaceholders(node.description.slice(0, 2000)));
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (!imageUrl) imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);

  const detailsDesc = html.match(/<div[^>]*\bclass=["'][^"']*pdp-details__description[^"']*["'][^>]*>([\s\S]{1,4000})/i);
  if (detailsDesc?.[1] && !plant_description) {
    const raw = stripHtmlAndDecode(detailsDesc[1]).trim();
    if (raw.length > 20 && !containsBlacklist(raw)) plant_description = filterSurgicalDescription(raw.slice(0, 2000));
  }
  if (!plant_description && metadata?.ogDescription?.trim()) plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 800));

  const specsMatch = html.match(/<div[^>]*\bclass=["'][^"']*pdp-specs[^"']*["'][^>]*>([\s\S]{1,4000})/i);
  const specsBlock = specsMatch?.[1] ?? "";
  if (specsBlock) {
    const getVal = (label: string): string | null => {
      const esc = label.replace(/\s+/g, "\\s+");
      const m = specsBlock.match(new RegExp(esc + "[\\s\\S]*?</[^>]+>\\s*<[^>]+>([^<]*)</", "i"));
      if (m?.[1]) return stripHtmlAndDecode(m[1]).trim();
      const m2 = specsBlock.match(new RegExp(esc + "\\s*[:\\s]*([^<\n]{1,80})", "i"));
      return m2?.[1]?.trim() ?? null;
    };
    const s = getVal("Sun"); if (s) sun = s;
    const sp = getVal("Plant Spacing"); if (sp) plant_spacing = sp;
    const mat = getVal("Days to Maturity"); if (mat) {
      const r = mat.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (r) harvest_days = Math.round((parseInt(r[1], 10) + parseInt(r[2], 10)) / 2);
      else { const n = mat.match(/(\d+)/); if (n?.[1]) harvest_days = parseInt(n[1], 10) || null; }
    }
  }

  if (harvest_days == null) harvest_days = extractFuzzyMaturityDays(html);
  if (!sun) sun = extractFuzzyLabel(html, SUN_KEYWORDS, 30) ?? (html.match(/\b(Full Sun|Part Sun|Partial Shade)\b/i)?.[1]?.trim() ?? null);
  if (!plant_spacing) plant_spacing = extractFuzzyLabel(html, SPACING_KEYWORDS);

  return {
    imageUrl,
    harvest_days,
    sun,
    days_to_germination: extractFuzzyLabel(html, GERMINATION_KEYWORDS),
    plant_spacing,
    growing_notes: extractSectionedGrowingGuides(html) ?? null,
    plant_description,
    latin_name: extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80),
    life_cycle: extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30),
    hybrid_status: extractFuzzyLabel(html, HYBRID_KEYWORDS, 30),
  };
}

/** Swallowtail (swallowtailgardenseeds.com): div.main-content, ul items with 'Planting Depth' or 'Spacing'. */
function parseSwallowtail(html: string, pageOrigin: string, metadata?: OgMetadata | null): ReturnType<typeof parseUniversal> {
  const imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);
  let plant_spacing: string | null = null;
  let days_to_germination: string | null = null;
  let plant_description: string | null = null;

  const mainMatch = html.match(/<div[^>]*\bclass=["'][^"']*main-content[^"']*["'][^>]*>([\s\S]{1,8000})/i);
  const mainBlock = mainMatch?.[1] ?? "";
  if (mainBlock) {
    const ulBlocks = mainBlock.match(/<ul[^>]*>[\s\S]*?<\/ul>/gi) ?? [];
    for (const ul of ulBlocks) {
      const text = stripHtmlAndDecode(ul);
      if (/Planting\s+Depth/i.test(ul) || /Spacing/i.test(ul)) {
        const depthMatch = ul.match(/Planting\s+Depth[\s\S]*?[:>]\s*([^<\n]+)/i);
        if (depthMatch?.[1]) days_to_germination = days_to_germination ?? stripHtmlAndDecode(depthMatch[1]).trim().slice(0, 60);
        const spaceMatch = ul.match(/Spacing[\s\S]*?[:>]\s*([^<\n]+)/i);
        if (spaceMatch?.[1]) plant_spacing = plant_spacing ?? stripHtmlAndDecode(spaceMatch[1]).trim().slice(0, 60);
      }
    }
    if (mainBlock.length > 100 && !plant_description) {
      const raw = stripHtmlAndDecode(mainBlock).trim();
      if (raw.length > 40 && !containsBlacklist(raw)) plant_description = filterSurgicalDescription(raw.slice(0, 2000));
    }
  }

  if (!plant_description && metadata?.ogDescription?.trim()) plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 800));
  if (!plant_spacing) plant_spacing = extractFuzzyLabel(html, SPACING_KEYWORDS);
  if (!days_to_germination) days_to_germination = extractFuzzyLabel(html, GERMINATION_KEYWORDS);

  return {
    imageUrl,
    harvest_days: extractFuzzyMaturityDays(html),
    sun: extractFuzzyLabel(html, SUN_KEYWORDS, 30) ?? (html.match(/\b(Full Sun|Part Sun|Partial Shade)\b/i)?.[1]?.trim() ?? null),
    days_to_germination,
    plant_spacing,
    growing_notes: extractSectionedGrowingGuides(html) ?? null,
    plant_description,
    latin_name: extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80),
    life_cycle: extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30),
    hybrid_status: extractFuzzyLabel(html, HYBRID_KEYWORDS, 30),
  };
}

/** Hudson Valley Seed (hudsonvalleyseed.com): .product__description.rte, ALL <p> joined (full story, no truncation). */
function parseHudsonValley(html: string, pageOrigin: string, metadata?: OgMetadata | null): ReturnType<typeof parseUniversal> {
  const imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);
  let plant_description: string | null = null;
  let sun: string | null = null;
  let plant_spacing: string | null = null;
  let days_to_germination: string | null = null;
  let harvest_days: number | null = null;

  const descMatch = html.match(
    /<div[^>]*\bclass=["'][^"']*product__description[^"']*rte[^"']*["'][^>]*>([\s\S]{1,80000})/i
  ) ?? html.match(
    /<div[^>]*\bclass=["'][^"']*rte[^"']*product__description[^"']*["'][^>]*>([\s\S]{1,80000})/i
  );
  if (descMatch?.[1]) {
    const block = descMatch[1];
    const pBlocks = block.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? [];
    const pTexts = pBlocks
      .map((p) => {
        const inner = p.replace(/<p[^>]*>/i, "").replace(/<\/p>/i, "");
        return stripHtmlAndDecode(inner).trim();
      })
      .filter((t) => t.length > 0);
    const fullText = pTexts.join("\n\n").trim();
    if (fullText.length > 20 && !containsBlacklist(fullText)) {
      plant_description = filterSurgicalDescription(stripTemplatePlaceholders(fullText));
    }
    const specs = extractShopifyKeywordSpecs(block);
    if (specs.sun && isValidSpecValue(specs.sun)) sun = specs.sun;
    if (specs.plant_spacing && isValidSpecValue(specs.plant_spacing)) plant_spacing = specs.plant_spacing;
    if (specs.days_to_germination && isValidSpecValue(specs.days_to_germination)) days_to_germination = specs.days_to_germination;
    if (specs.harvest_days != null) harvest_days = specs.harvest_days;
  }

  if (!plant_description && metadata?.ogDescription?.trim()) plant_description = filterSurgicalDescription(stripTemplatePlaceholders(metadata.ogDescription.trim()));
  if (harvest_days == null) harvest_days = extractFuzzyMaturityDays(html);
  if (!sun) {
    const fromFuzzy = extractFuzzyLabel(html, SUN_KEYWORDS, 30);
    sun = fromFuzzy && isValidSpecValue(fromFuzzy) ? fromFuzzy : (html.match(/\b(Full Sun|Part Sun|Partial Shade)\b/i)?.[1]?.trim() ?? null);
  }
  if (!plant_spacing) {
    const fromFuzzy = extractFuzzyLabel(html, SPACING_KEYWORDS);
    plant_spacing = fromFuzzy && isValidSpecValue(fromFuzzy) ? fromFuzzy : null;
  }
  if (!days_to_germination) {
    const fromFuzzy = extractFuzzyLabel(html, GERMINATION_KEYWORDS);
    days_to_germination = fromFuzzy && isValidSpecValue(fromFuzzy) ? fromFuzzy : null;
  }

  return {
    imageUrl,
    harvest_days,
    sun,
    days_to_germination,
    plant_spacing,
    growing_notes: extractSectionedGrowingGuides(html) ?? null,
    plant_description,
    latin_name: extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80),
    life_cycle: extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30),
    hybrid_status: extractFuzzyLabel(html, HYBRID_KEYWORDS, 30),
  };
}

/** Shopify-group (Pinetree, Sow Right, San Diego, Victory): div.product-description / product__description / product-single__description + keyword regex. */
function parseShopifyKeyword(
  html: string,
  pageOrigin: string,
  descriptionSelector: string,
  metadata?: OgMetadata | null
): ReturnType<typeof parseUniversal> {
  const imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);
  let plant_description: string | null = null;
  let sun: string | null = null;
  let plant_spacing: string | null = null;
  let days_to_germination: string | null = null;
  let harvest_days: number | null = null;

  const classOrId = descriptionSelector.startsWith("#") ? "id" : "class";
  const selector = descriptionSelector.replace(/^#/, "").replace(/^\./, "");
  const re = classOrId === "id"
    ? new RegExp(`<div[^>]*\\bid=["']${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>([\\s\\S]{1,6000})`, "i")
    : new RegExp(`<div[^>]*\\bclass=["'][^"']*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"']*["'][^>]*>([\\s\\S]{1,6000})`, "i");
  const descMatch = html.match(re);
  if (descMatch?.[1]) {
    const block = descMatch[1];
    const raw = stripHtmlAndDecode(block).trim();
    if (raw.length > 20 && !containsBlacklist(raw)) plant_description = filterSurgicalDescription(stripTemplatePlaceholders(raw.slice(0, 2000)));
    const specs = extractShopifyKeywordSpecs(block);
    if (specs.sun) sun = specs.sun;
    if (specs.plant_spacing) plant_spacing = specs.plant_spacing;
    if (specs.days_to_germination) days_to_germination = specs.days_to_germination;
    if (specs.harvest_days != null) harvest_days = specs.harvest_days;
  }

  if (!plant_description && metadata?.ogDescription?.trim()) plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 800));
  if (harvest_days == null) harvest_days = extractFuzzyMaturityDays(html);
  if (!sun) sun = extractFuzzyLabel(html, SUN_KEYWORDS, 30) ?? (html.match(/\b(Full Sun|Part Sun|Partial Shade)\b/i)?.[1]?.trim() ?? null);
  if (!plant_spacing) plant_spacing = extractFuzzyLabel(html, SPACING_KEYWORDS);
  if (!days_to_germination) days_to_germination = extractFuzzyLabel(html, GERMINATION_KEYWORDS);

  return {
    imageUrl,
    harvest_days,
    sun,
    days_to_germination,
    plant_spacing,
    growing_notes: extractSectionedGrowingGuides(html) ?? null,
    plant_description,
    latin_name: extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80),
    life_cycle: extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30),
    hybrid_status: extractFuzzyLabel(html, HYBRID_KEYWORDS, 30),
  };
}

/** Old-school plain-text vendors (Fedco, Southern Exposure): full description div, first 3 sentences summary, regex for days/inches. */
function parseOldSchool(
  html: string,
  pageOrigin: string,
  descriptionSelector: string,
  metadata?: OgMetadata | null
): ReturnType<typeof parseUniversal> {
  const imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);
  let plant_description: string | null = null;
  let plant_spacing: string | null = null;
  let days_to_germination: string | null = null;
  let harvest_days: number | null = null;

  const isId = descriptionSelector.startsWith("#");
  const sel = descriptionSelector.replace(/^#/, "").replace(/^\./, "");
  const re = isId
    ? new RegExp(`<div[^>]*\\bid=["']${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>([\\s\\S]{1,12000})`, "i")
    : new RegExp(`<div[^>]*\\bclass=["'][^"']*${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^"']*["'][^>]*>([\\s\\S]{1,12000})`, "i");
  const descMatch = html.match(re);
  if (descMatch?.[1]) {
    const fullText = stripHtmlAndDecode(descMatch[1]).trim();
    const sentences = fullText.split(/(?<=[.!?])\s+/).filter(Boolean);
    const firstThree = sentences.slice(0, 3).join(" ").trim();
    if (firstThree.length > 20 && !containsBlacklist(firstThree)) plant_description = filterSurgicalDescription(firstThree);
    const daysMatch = fullText.match(/(\d+)\s*[-–]?\s*(\d+)?\s*days?/gi);
    if (daysMatch?.length) {
      const last = daysMatch[daysMatch.length - 1];
      const m = last.match(/(\d+)\s*[-–]?\s*(\d+)?\s*days?/i);
      if (m?.[2]) harvest_days = Math.round((parseInt(m[1], 10) + parseInt(m[2], 10)) / 2);
      else if (m?.[1]) harvest_days = parseInt(m[1], 10) || null;
    }
    const germMatch = fullText.match(/(\d+)\s*[-–]\s*(\d+)\s*days?/i);
    if (germMatch) days_to_germination = `${germMatch[1]}–${germMatch[2]} days`;
    const spaceMatch = fullText.match(/(\d+)\s*[-–]\s*(\d+)\s*inches?/i) ?? fullText.match(/(\d+)\s*[""]/i);
    if (spaceMatch) plant_spacing = spaceMatch[2] ? `${spaceMatch[1]}–${spaceMatch[2]} inches` : `${spaceMatch[1]}"`;
  }

  if (!plant_description && metadata?.ogDescription?.trim()) plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 800));
  if (harvest_days == null) harvest_days = extractFuzzyMaturityDays(html);
  if (!plant_spacing) plant_spacing = extractFuzzyLabel(html, SPACING_KEYWORDS);
  if (!days_to_germination) days_to_germination = extractFuzzyLabel(html, GERMINATION_KEYWORDS);

  return {
    imageUrl,
    harvest_days,
    sun: extractFuzzyLabel(html, SUN_KEYWORDS, 30) ?? (html.match(/\b(Full Sun|Part Sun|Partial Shade)\b/i)?.[1]?.trim() ?? null),
    days_to_germination,
    plant_spacing,
    growing_notes: extractSectionedGrowingGuides(html) ?? null,
    plant_description,
    latin_name: extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80),
    life_cycle: extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30),
    hybrid_status: extractFuzzyLabel(html, HYBRID_KEYWORDS, 30),
  };
}

/** San Diego Seed Co (sandiegoseedcompany.com): H1 for product title (avoid breadcrumb "Vegetables"); div.product-description with bolded labels (Sun:, Days to Harvest:, etc.). */
function parseSanDiegoBolded(html: string, pageOrigin: string, metadata?: OgMetadata | null): ReturnType<typeof parseUniversal> & { ogTitle?: string } {
  const imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);
  let ogTitle: string | undefined = undefined;
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match?.[1]) {
    const title = stripHtmlAndDecode(h1Match[1]).trim();
    if (title.length > 1) ogTitle = title;
  }
  if (!ogTitle && metadata?.ogTitle?.trim()) ogTitle = metadata.ogTitle.trim();

  let sun: string | null = null;
  let harvest_days: number | null = null;
  let plant_spacing: string | null = null;
  let days_to_germination: string | null = null;
  let plant_description: string | null = null;

  const descMatch = html.match(/<div[^>]*\bclass=["'][^"']*product-description[^"']*["'][^>]*>([\s\S]{1,6000})/i);
  const block = descMatch?.[1] ?? "";
  if (block) {
    const text = stripHtmlAndDecode(block);
    if (text.length > 20 && !containsBlacklist(text)) plant_description = filterSurgicalDescription(stripTemplatePlaceholders(text.slice(0, 2000)));
    const boldedLabel = (label: string): string | null => {
      const esc = label.replace(/\s+/g, "\\s+");
      const re = new RegExp(`<(?:b|strong)[^>]*>\\s*${esc}\\s*:?\\s*</(?:b|strong)>\\s*([^<\n]{0,80})`, "i");
      const m = block.match(re) ?? text.match(new RegExp(`${esc}\\s*:\\s*([^\\n]{0,80})`, "i"));
      return m?.[1] ? stripHtmlAndDecode(m[1]).trim() : null;
    };
    const sunVal = boldedLabel("Sun") ?? boldedLabel("Exposure"); if (sunVal) sun = sunVal;
    const harvestVal = boldedLabel("Days to Harvest") ?? boldedLabel("Days to Maturity"); if (harvestVal) {
      const n = harvestVal.match(/(\d+)/); if (n?.[1]) harvest_days = parseInt(n[1], 10) || null;
    }
    const spaceVal = boldedLabel("Spacing") ?? boldedLabel("Plant Spacing"); if (spaceVal) plant_spacing = spaceVal;
    const germVal = boldedLabel("Germination") ?? boldedLabel("Days to Emerge"); if (germVal) days_to_germination = germVal;
  }
  if (!plant_description && metadata?.ogDescription?.trim()) plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 800));
  if (harvest_days == null) harvest_days = extractFuzzyMaturityDays(html);
  if (!sun) sun = extractFuzzyLabel(html, SUN_KEYWORDS, 30) ?? (html.match(/\b(Full Sun|Part Sun|Partial Shade)\b/i)?.[1]?.trim() ?? null);
  if (!plant_spacing) plant_spacing = extractFuzzyLabel(html, SPACING_KEYWORDS);
  if (!days_to_germination) days_to_germination = extractFuzzyLabel(html, GERMINATION_KEYWORDS);

  const result: ReturnType<typeof parseUniversal> & { ogTitle?: string } = {
    imageUrl,
    harvest_days,
    sun,
    days_to_germination,
    plant_spacing,
    growing_notes: extractSectionedGrowingGuides(html) ?? null,
    plant_description,
    latin_name: extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80),
    life_cycle: extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30),
    hybrid_status: extractFuzzyLabel(html, HYBRID_KEYWORDS, 30),
  };
  if (ogTitle) result.ogTitle = ogTitle;
  return result;
}

/** Remove Floret footer nav text and arrow entities from description (e.g. "← Previous Product Next Product →"). */
function stripFloretFooterNav(text: string): string {
  if (!text || !text.trim()) return text;
  return text
    .replace(/\s*[←\u2190]\s*Previous\s+Product\s*/gi, " ")
    .replace(/\s*Next\s+Product\s*[→\u2192]\s*/gi, " ")
    .replace(/&\s*larr\s*;|&larr;/gi, " ")
    .replace(/&\s*rarr\s*;|&rarr;/gi, " ")
    .replace(/\s*Previous\s+Product\s*/gi, " ")
    .replace(/\s*Next\s+Product\s*/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Floret (floretflowers.com): content from .product-details__description p or div.rte only; Sun/Spacing max 50 chars or discard. */
function parseFloret(html: string, pageOrigin: string, metadata?: OgMetadata | null): ReturnType<typeof parseUniversal> {
  const imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);
  let plant_description: string | null = null;
  let plant_spacing: string | null = null;
  const notesParts: string[] = [];
  const MAX_SPEC_LEN = 50;

  function floretSpec(s: string | null | undefined): string | null {
    if (!s || !s.trim()) return null;
    const t = s.trim();
    if (t.length > MAX_SPEC_LEN) return null;
    return isValidSpecValue(t) ? t : null;
  }

  const descMatch = html.match(/<div[^>]*\bclass=["'][^"']*product-details__description[^"']*["'][^>]*>([\s\S]{1,12000})/i);
  const rteMatch = html.match(/<div[^>]*\bclass=["'][^"']*rte[^"']*["'][^>]*>([\s\S]{1,8000})/i);
  const contentBlock = descMatch?.[1] ?? rteMatch?.[1];
  if (contentBlock) {
    const pBlocks = contentBlock.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) ?? [];
    const pTexts = pBlocks
      .map((p) => {
        const inner = p.replace(/<p[^>]*>/i, "").replace(/<\/p>/i, "");
        return stripHtmlAndDecode(inner).trim();
      })
      .filter((t) => t.length > 10);
    const raw = pTexts.join("\n\n").trim();
    if (raw.length > 20 && !containsBlacklist(raw)) {
      const fullText = stripTemplatePlaceholders(raw);
      const noFooter = stripFloretFooterNav(fullText);
      plant_description = filterSurgicalDescription(noFooter.slice(0, 4000));
    }
    const plantingSection = contentBlock.match(/Planting\s+Instructions[\s\S]*?(?=<\/div>|<h[1-6]|$)/i)?.[0] ?? "";
    if (plantingSection) {
      const sectionText = stripHtmlAndDecode(plantingSection);
      const spacingMatch = sectionText.match(/Spacing\s*[:\s]*(\d+)\s*[-–]?\s*(\d+)?\s*(?:inches?|[""])?/i) ?? sectionText.match(/(\d+)\s*[-–]\s*(\d+)\s*inches?/i);
      if (spacingMatch) {
        const val = spacingMatch[2] ? `${spacingMatch[1]}–${spacingMatch[2]} inches` : `${spacingMatch[1]} inches`;
        plant_spacing = floretSpec(val) ? val : null;
      }
      const depthMatch = sectionText.match(/Depth\s*[:\s]*([^\n.]{2,60})/i);
      if (depthMatch?.[1] && isValidSpecValue(depthMatch[1])) notesParts.push(`Planting Depth: ${depthMatch[1].trim()}`);
    }
  }
  if (!plant_description && metadata?.ogDescription?.trim()) {
    const ogClean = stripFloretFooterNav(stripTemplatePlaceholders(metadata.ogDescription.trim()));
    plant_description = filterSurgicalDescription(ogClean.slice(0, 800));
  }
  if (!plant_spacing) plant_spacing = floretSpec(extractFuzzyLabel(html, SPACING_KEYWORDS));

  const rawSun = extractFuzzyLabel(html, SUN_KEYWORDS, 30) ?? (html.match(/\b(Full Sun|Part Sun|Partial Shade)\b/i)?.[1]?.trim() ?? null);
  const sun = floretSpec(rawSun);

  return {
    imageUrl,
    harvest_days: extractFuzzyMaturityDays(html),
    sun,
    days_to_germination: extractFuzzyLabel(html, GERMINATION_KEYWORDS),
    plant_spacing,
    growing_notes: notesParts.length > 0 ? notesParts.join("\n\n") : (extractSectionedGrowingGuides(html) ?? null),
    plant_description,
    latin_name: extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80),
    life_cycle: extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30),
    hybrid_status: extractFuzzyLabel(html, HYBRID_KEYWORDS, 30),
  };
}

/** Renee's Garden (reneesgarden.com): div.product-description, 'Planting and Growing' section. */
function parseReneesGarden(html: string, pageOrigin: string, metadata?: OgMetadata | null): ReturnType<typeof parseUniversal> {
  const imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);
  let plant_description: string | null = null;
  let sun: string | null = null;
  let plant_spacing: string | null = null;
  let days_to_germination: string | null = null;
  let harvest_days: number | null = null;

  const descMatch = html.match(/<div[^>]*\bclass=["'][^"']*product-description[^"']*["'][^>]*>([\s\S]{1,8000})/i);
  if (descMatch?.[1]) {
    const block = descMatch[1];
    const raw = stripHtmlAndDecode(block).trim();
    if (raw.length > 20 && !containsBlacklist(raw)) plant_description = filterSurgicalDescription(stripTemplatePlaceholders(raw.slice(0, 2000)));
    const section = block.match(/Planting\s+and\s+Growing[\s\S]*?(?=<\/div>|<h[1-6]|Planting\s+Tips|$)/i)?.[0] ?? raw.match(/Planting\s+and\s+Growing[\s\S]{0,1200}/i)?.[0] ?? "";
    if (section) {
      const sectionText = stripHtmlAndDecode(section);
      const specs = extractShopifyKeywordSpecs(section);
      if (specs.sun) sun = specs.sun;
      if (specs.plant_spacing) plant_spacing = specs.plant_spacing;
      if (specs.days_to_germination) days_to_germination = specs.days_to_germination;
      if (specs.harvest_days != null) harvest_days = specs.harvest_days;
    }
  }
  if (!plant_description && metadata?.ogDescription?.trim()) plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 800));
  if (harvest_days == null) harvest_days = extractFuzzyMaturityDays(html);
  if (!sun) sun = extractFuzzyLabel(html, SUN_KEYWORDS, 30) ?? (html.match(/\b(Full Sun|Part Sun|Partial Shade)\b/i)?.[1]?.trim() ?? null);
  if (!plant_spacing) plant_spacing = extractFuzzyLabel(html, SPACING_KEYWORDS);
  if (!days_to_germination) days_to_germination = extractFuzzyLabel(html, GERMINATION_KEYWORDS);

  return {
    imageUrl,
    harvest_days,
    sun,
    days_to_germination,
    plant_spacing,
    growing_notes: extractSectionedGrowingGuides(html) ?? null,
    plant_description,
    latin_name: extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80),
    life_cycle: extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30),
    hybrid_status: extractFuzzyLabel(html, HYBRID_KEYWORDS, 30),
  };
}

/** Extract pretreatment text (Smoke, Boiling Water, Stratify) for native seed vendors; save the sentence/phrase containing the keyword. */
function extractPretreatmentNotes(html: string): string | null {
  const body = stripHtmlAndDecode(html);
  const re = /[^.!?\n]{0,120}(?:smoke|boiling\s+water|stratif(?:y|ication)|cold\s+stratification|pre-?treatment)[^.!?\n]{0,150}[.!?]?/gi;
  const matches = body.match(re);
  if (!matches?.length) return null;
  const trimmed = matches.map((m) => m.trim()).filter((m) => m.length > 15);
  if (trimmed.length === 0) return null;
  const combined = Array.from(new Set(trimmed)).join(" ").replace(/\s{2,}/g, " ").trim().slice(0, 600);
  return combined || null;
}

/** Native plant vendors (Theodore Payne, Native West): standard extraction + pretreatment_notes when Smoke/Boiling Water/Stratify found. */
function parseNativePlantWithPretreatment(
  html: string,
  pageOrigin: string,
  metadata?: OgMetadata | null
): ReturnType<typeof parseUniversal> & { pretreatment_notes: string | null } {
  const base = parseUniversal(html, pageOrigin, metadata);
  const pretreatment_notes = extractPretreatmentNotes(html);
  return { ...base, pretreatment_notes };
}

/** Row 7 Seeds (row7seeds.com): h1 title strip "Seeds"; [Variety] [Plant] = last word plant, rest variety; specs via regex in description. */
function parseRow7(html: string, pageOrigin: string, metadata?: OgMetadata | null): ReturnType<typeof parseUniversal> & { ogTitle?: string } {
  let ogTitle: string | undefined = undefined;
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match?.[1]) {
    const raw = stripHtmlAndDecode(h1Match[1]).trim();
    const cleaned = raw.replace(/\bSeeds\s*$/i, "").trim();
    if (cleaned.length > 0) ogTitle = cleaned;
  }
  if (!ogTitle && metadata?.ogTitle?.trim()) ogTitle = metadata.ogTitle.replace(/\bSeeds\s*$/i, "").trim() || undefined;

  const base = parseUniversal(html, pageOrigin, metadata);
  let harvest_days: number | null = base.harvest_days;
  let plant_spacing: string | null = base.plant_spacing;
  let days_to_germination: string | null = base.days_to_germination;

  const descText = (metadata?.ogDescription ?? "") + " " + stripHtmlAndDecode(html).replace(/\s+/g, " ");
  const maturityMatch = descText.match(/Days to Maturity\s*(\d+)/i) ?? descText.match(/(\d+)\s*days to maturity/i);
  if (maturityMatch?.[1]) {
    const n = parseInt(maturityMatch[1], 10);
    if (Number.isFinite(n)) harvest_days = n;
  }
  const spacingMatch = descText.match(/Plant Spacing:\s*([\d"\-]+)/i);
  if (spacingMatch?.[1]) {
    const s = spacingMatch[1].trim();
    if (s.length > 0 && s.length < 50 && isValidSpecValue(s)) plant_spacing = s;
  }
  const germMatch = descText.match(/(\d+-\d+)\s*days to emergence/i);
  if (germMatch?.[1]) days_to_germination = germMatch[1].trim();

  const result: ReturnType<typeof parseUniversal> & { ogTitle?: string } = {
    ...base,
    harvest_days,
    plant_spacing,
    days_to_germination,
  };
  if (ogTitle) result.ogTitle = ogTitle;
  return result;
}

/** MIGardener (migardener.com): Sun and Spacing only from products-template__specs; discard any value containing class=, <, or >. */
function parseMIGardener(html: string, pageOrigin: string, metadata?: OgMetadata | null): ReturnType<typeof parseUniversal> {
  const base = parseUniversal(html, pageOrigin, metadata);
  function discardIfHtmlLike(s: string | null | undefined): string | null {
    if (!s || !s.trim()) return null;
    const t = s.trim();
    if (/class\s*=|<|>/.test(t)) return null;
    return t;
  }
  const specsIdx = html.indexOf("products-template__specs");
  let sun: string | null = null;
  let plant_spacing: string | null = null;
  if (specsIdx !== -1) {
    const specsChunk = html.slice(specsIdx, specsIdx + 3500);
    let rawSun = extractFuzzyLabel(specsChunk, SUN_KEYWORDS, 30);
    if (!rawSun) {
      const lightMatch = specsChunk.match(/\b(Full\s*Sun|Part\s*Sun|Sun|Partial\s*Shade|Full\s*Shade)\b/i);
      if (lightMatch?.[1]) rawSun = lightMatch[1].trim();
    }
    sun = discardIfHtmlLike(rawSun);
    plant_spacing = discardIfHtmlLike(extractFuzzyLabel(specsChunk, SPACING_KEYWORDS));
  } else {
    sun = discardIfHtmlLike(base.sun);
    plant_spacing = discardIfHtmlLike(base.plant_spacing);
  }
  return {
    ...base,
    sun: sun ?? null,
    plant_spacing: plant_spacing ?? null,
  };
}

/** Universal fuzzy extraction for any vendor (Territorial, Park Seed, Outside Pride, Swallowtail, etc.) */
function parseUniversal(html: string, pageOrigin: string, metadata?: OgMetadata | null): {
  imageUrl: string | null;
  harvest_days: number | null;
  sun: string | null;
  days_to_germination: string | null;
  plant_spacing: string | null;
  growing_notes: string | null;
  plant_description: string | null;
  latin_name: string | null;
  life_cycle: string | null;
  hybrid_status: string | null;
} {
  // Metadata first: og:image and og:description
  const imageUrl = extractImageUrl(html, pageOrigin, metadata?.ogImage ?? undefined);
  const harvest_days = extractFuzzyMaturityDays(html);
  const days_to_germination = extractFuzzyLabel(html, GERMINATION_KEYWORDS);
  const plant_spacing = extractFuzzyLabel(html, SPACING_KEYWORDS);
  const latin_name = extractFuzzyLabel(html, LATIN_NAME_KEYWORDS, 80);
  const life_cycle = extractFuzzyLabel(html, LIFE_CYCLE_KEYWORDS, 30);
  const hybrid_status = extractFuzzyLabel(html, HYBRID_KEYWORDS, 30);

  // Sun: fuzzy bucket ['sun', 'light', 'exposure']
  let sun: string | null = extractFuzzyLabel(html, SUN_KEYWORDS, 30);
  if (!sun) {
    const lightMatch = html.match(/\b(Full\s*Sun|Part\s*Sun|Sun|Partial\s*Shade|Full\s*Shade)\b/i);
    if (lightMatch?.[1]) sun = lightMatch[1].trim();
  }

  // Plant description: RareSeeds targets div.product-description; others use og:description then meta
  let plant_description: string | null = extractRareSeedsProductDescription(html);
  if (!plant_description && metadata?.ogDescription && metadata.ogDescription.length > 30 && !containsBlacklist(metadata.ogDescription)) {
    plant_description = filterSurgicalDescription(metadata.ogDescription.slice(0, 800));
  }
  if (!plant_description) {
    const metaDesc = html.match(/<meta[\s\S]*?\bname=["']description["'][\s\S]*?\bcontent=["']([^"']+)["']/i)
      ?? html.match(/<meta[\s\S]*?\bcontent=["']([^"']+)["'][\s\S]*?\bname=["']description["']/i);
    if (metaDesc?.[1]) {
      const raw = stripHtmlAndDecode(metaDesc[1].slice(0, 800)).trim();
      if (raw.length > 30 && !containsBlacklist(raw)) plant_description = filterSurgicalDescription(raw);
    }
  }

  const growing_notes = extractSectionedGrowingGuides(html);

  return {
    imageUrl,
    harvest_days,
    sun,
    days_to_germination,
    plant_spacing,
    growing_notes: growing_notes ?? null,
    plant_description,
    latin_name,
    life_cycle,
    hybrid_status,
  };
}

/** GET: health check so we can confirm the route is loaded (avoids 404 confusion when POST fails to compile). */
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "scrape-url is up. Use POST with body { url: string }.",
  });
}

export async function POST(request: Request) {
  let body: { url?: string; knownPlantTypes?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const urlString = typeof body.url === "string" ? body.url.trim() : "";
  const skipAiFallback = (body as { skipAiFallback?: boolean }).skipAiFallback === true;
  const knownPlantTypes =
    Array.isArray(body.knownPlantTypes) &&
    body.knownPlantTypes.every((t) => typeof t === "string")
      ? body.knownPlantTypes
      : undefined;
  if (!urlString) {
    return NextResponse.json({ error: "url is required." }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(urlString.startsWith("http") ? urlString : "https://" + urlString);
  } catch {
    return NextResponse.json({ error: "Invalid URL." }, { status: 400 });
  }

  if (!isAllowedUrl(url)) {
    return NextResponse.json(
      { error: "URL domain is not allowed for scraping." },
      { status: 400 }
    );
  }

  if (!process.env.TAVILY_API_KEY?.trim()) {
    console.error("CRITICAL ERROR: TAVILY_API_KEY is undefined in environment");
  }

  const SCRAPE_TIMEOUT_MS = 15_000;
  let fallbackMetadata: OgMetadata | null = null;
  let fallbackOrigin: string | null = null;

  /** Real-browser User-Agent (Chrome/Windows) so vendors treat request as human. */
  const REAL_BROWSER_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
  /** Chrome/Mac UA for Botanical Interests & Eden Brothers to reduce 404/blocker when they flag Windows bots. */
  const CHROME_MAC_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

  /** Big 4 = sun, plant_spacing, days_to_germination, harvest_days. Success = all four present and none from defaults. */
  function computeScrapeStatus(payload: Record<string, unknown>): "Success" | "Partial" {
    const sun = (payload.sun as string | null | undefined)?.trim();
    const plant_spacing = (payload.plant_spacing as string | null | undefined)?.trim();
    const days_to_germination = (payload.days_to_germination as string | null | undefined)?.trim();
    const harvest_days = payload.harvest_days != null;
    const anyDefault =
      payload.sunSource === "default" ||
      payload.plant_spacingSource === "default" ||
      payload.days_to_germinationSource === "default";
    const allFour = !!(sun && plant_spacing && days_to_germination && harvest_days);
    if (allFour && !anyDefault) return "Success";
    return "Partial";
  }

  /** Zone 10b maturity defaults (Vista, CA) when harvest_days is null/0; keyed by plant_name (case-insensitive). */
  const ZONE_10B_MATURITY_DAYS: Record<string, number> = {
    Celosia: 90,
    Tomato: 85,
    Pepper: 90,
    Zinnia: 75,
    Sunflower: 80,
    Squash: 55,
    Marigold: 60,
  };

  const ZONE_10B_DTM_NOTE = "Note: Using local Zone 10b default DTM.";

  function applyZone10bMaturityDefaults(payload: Record<string, unknown>): Record<string, unknown> {
    const harvest_days = payload.harvest_days;
    if (harvest_days != null && harvest_days !== 0) return payload;
    const plant_name = (payload.plant_name as string) ?? (payload.ogTitle as string) ?? "";
    const nameLower = typeof plant_name === "string" ? plant_name.trim().toLowerCase() : "";
    if (!nameLower) return payload;
    for (const [key, days] of Object.entries(ZONE_10B_MATURITY_DAYS)) {
      if (key.toLowerCase() === nameLower || nameLower.includes(key.toLowerCase())) {
        const existingNotes = (payload.growing_notes as string) ?? (payload.growing_info_from_source as string) ?? "";
        const note = existingNotes.trim() ? `${existingNotes.trim()}\n\n${ZONE_10B_DTM_NOTE}` : ZONE_10B_DTM_NOTE;
        return { ...payload, harvest_days: days, growing_notes: note };
      }
    }
    return payload;
  }

  /** Never return blank Sun when we have a schedule match; set REQUIRE_CONFIG when plant type could not be identified; never return null plant_name. */
  function applyBlankSunAndRequireConfig(payload: Record<string, unknown>): Record<string, unknown> {
    let plantName = (payload.plant_name as string)?.trim();
    const sun = (payload.sun as string)?.trim();
    let out = { ...payload };
    if (!plantName) {
      plantName = (payload.ogTitle as string)?.trim() || "General";
      out = { ...out, plant_name: plantName };
    }
    if (plantName) {
      const schedule = getZone10bScheduleForPlant(plantName);
      if (schedule?.sun && !sun) out = { ...out, sun: schedule.sun };
      if (plantName === "General") out = { ...out, REQUIRE_CONFIG: true };
    }
    return out;
  }

  function buildSuccessResponse(
    withDefaults: Record<string, unknown>,
    imageError: boolean | undefined,
    requestUrl: URL,
    metadata?: OgMetadata | null
  ): Response {
    const withStructured = {
      ...withDefaults,
      ...getStructuredNameVendor(withDefaults, requestUrl, metadata),
    };
    const withZone10b = applyZone10bMaturityDefaults(withStructured);
    const cleaned = cleanScrapedPayload(withZone10b);
    const withSafety = applyBlankSunAndRequireConfig(cleaned);
    return NextResponse.json({
      ...withSafety,
      scrape_status: computeScrapeStatus(cleaned),
      image_error: imageError || undefined,
    });
  }

  /** True when surgical scrape is Partial or any of sun, plant_spacing, days_to_germination, harvest_days is missing. */
  function shouldTriggerAiFallback(cleaned: Record<string, unknown>): boolean {
    const status = computeScrapeStatus(cleaned);
    if (status === "Partial") return true;
    const sun = (cleaned.sun as string | null | undefined)?.trim();
    const plant_spacing = (cleaned.plant_spacing as string | null | undefined)?.trim();
    const days_to_germination = (cleaned.days_to_germination as string | null | undefined)?.trim();
    const harvest_days = cleaned.harvest_days != null;
    return !(sun && plant_spacing && days_to_germination && harvest_days);
  }

  /** If scrape is Partial or missing Big 4, run AI search fallback and return payload with scrape_status 'AI_SEARCH'; otherwise return normal response. */
  async function maybeAiFallback(
    withDefaults: Record<string, unknown>,
    imageError: boolean | undefined,
    plantName: string,
    requestUrl: URL,
    metadata?: OgMetadata | null
  ): Promise<Response> {
    const withStructured = {
      ...withDefaults,
      ...getStructuredNameVendor(withDefaults, requestUrl, metadata),
    };
    const cleaned = cleanScrapedPayload(withStructured);
    if (!shouldTriggerAiFallback(cleaned)) {
      return buildSuccessResponse(withDefaults, imageError, requestUrl, metadata);
    }
    if (skipAiFallback) {
      return buildSuccessResponse(withDefaults, imageError, requestUrl, metadata);
    }
    const nameForSearch = plantName || "vegetable";
    console.log("Triggering AI Search for:", nameForSearch);
    const categoryKey = getPlantCategoryFromName(plantName);
    const aiPayload = await searchWebFallback(nameForSearch, categoryKey);
    if (!aiPayload) {
      // Save partial vendor data anyway; do not mark as Failed. Tavily (432, rate limit, etc.) is optional.
      return buildSuccessResponse(withDefaults, imageError, requestUrl, metadata);
    }
    const merged: Record<string, unknown> = { ...withDefaults };
    if (!(merged.sun as string)?.trim() && aiPayload.sun) merged.sun = aiPayload.sun;
    if (!(merged.plant_spacing as string)?.trim() && aiPayload.plant_spacing) merged.plant_spacing = aiPayload.plant_spacing;
    if (!(merged.days_to_germination as string)?.trim() && aiPayload.days_to_germination) merged.days_to_germination = aiPayload.days_to_germination;
    if (merged.harvest_days == null && aiPayload.harvest_days != null) merged.harvest_days = aiPayload.harvest_days;
    const withDefaultsAgain = applyPlantCategoryDefaults(merged, plantName);
    const aiWithStructured = {
      ...withDefaultsAgain,
      ...getStructuredNameVendor(withDefaultsAgain, requestUrl, metadata),
    };
    const withZone10b = applyZone10bMaturityDefaults(aiWithStructured);
    const finalCleaned = cleanScrapedPayload(withZone10b);
    const finalWithSafety = applyBlankSunAndRequireConfig(finalCleaned);
    return NextResponse.json({
      ...finalWithSafety,
      scrape_status: "AI_SEARCH" as const,
      image_error: imageError || undefined,
    });
  }

  function safetyMetadataResponse(
    metadata: OgMetadata,
    pageOrigin: string,
    requestUrl: URL,
    errorMessage?: string
  ): Response {
    const base: Record<string, unknown> = {
      plant_description: metadata.ogDescription ?? undefined,
      imageUrl: metadata.ogImage ? resolveImageUrl(metadata.ogImage, pageOrigin) : undefined,
      ogTitle: metadata.ogTitle ?? undefined,
      ...(errorMessage != null
        ? { scrape_status: "Failed" as const, scrape_error_log: errorMessage }
        : {}),
    };
    const { plant_name, variety_name, vendor_name } = getStructuredNameVendor(base, requestUrl, metadata);
    const withStructured = { ...base, plant_name, variety_name, vendor_name };
    const withZone10b = applyZone10bMaturityDefaults(withStructured);
    const withSafety = applyBlankSunAndRequireConfig(withZone10b);
    return NextResponse.json(withSafety);
  }

  /** Identify first: derive plant name and category from URL so we can short-circuit on 403/404 without Tavily. */
  const pathSegments = url.pathname.split("/").filter(Boolean);
  const slugFromUrl = pathSegments.pop() ?? "";
  const plantNameFromUrl = slugFromUrl
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\.(html?|aspx|php)$/i, "")
    .trim();
  const slugLooksUseful = plantNameFromUrl.length > 1 && !/^(product|products|seeds|seed|item|p)$/i.test(plantNameFromUrl);
  const categoryFromUrl = slugLooksUseful ? getPlantCategoryFromName(plantNameFromUrl) : null;

  const scrapePromise = (async (): Promise<Response> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);
    const res = await fetch(url.href, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        Referer: "https://www.google.com/",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      },
      next: { revalidate: 0 },
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const msg = `Page returned ${res.status}.`;
      const isBlock = res.status === 403 || res.status === 404;
      if (isBlock) {
        // Batch import: AI fallback runs automatically (no user confirmation) so the vault stays complete when vendor blocks.
        // Database-first: identify from URL. Title = clean URL path; no image (client shows 🌱 fallback).
        let plantName = slugLooksUseful ? plantNameFromUrl : "";
        if (!plantName) {
          try {
            const errHtml = await res.text();
            const errMeta = extractOgMetadata(errHtml);
            const ogTitle = (errMeta?.ogTitle ?? "").trim();
            const looksLikeErrorPage = /^(page\s*not\s*found|404\s*not\s*found|not\s*found|error)\b|page\s*not\s*found\s*[-–—]|floret\s*shop|^\d+\s*$/i.test(ogTitle) || ogTitle.length < 3;
            if (ogTitle && !looksLikeErrorPage) plantName = ogTitle;
          } catch {
            // ignore
          }
        }
        if (!plantName && plantNameFromUrl) plantName = plantNameFromUrl;
        if (!plantName) plantName = "vegetable";
        const categoryKey = categoryFromUrl ?? getPlantCategoryFromName(plantName);
        const base: Record<string, unknown> = {
          ogTitle: plantName,
          scrape_status: "AI_SEARCH" as const,
          scrape_error_log: msg,
          imageUrl: undefined,
        };
        if (categoryKey && PLANT_CATEGORY_DEFAULTS[categoryKey]) {
          const withDefaults = applyPlantCategoryDefaults(base, plantName);
          const withStructured = { ...withDefaults, ...getStructuredNameVendor(withDefaults, url, null) };
          const finalCleaned = cleanScrapedPayload(withStructured);
          const withSafety = applyBlankSunAndRequireConfig(finalCleaned);
          return NextResponse.json({
            ...withSafety,
            scrape_status: "AI_SEARCH" as const,
            scrape_error_log: msg,
          });
        }
        if (skipAiFallback) {
          const failDefaults = applyPlantCategoryDefaults(base, plantName);
          const failStructured = { ...failDefaults, ...getStructuredNameVendor(failDefaults, url, null) };
          const failCleaned = cleanScrapedPayload(failStructured);
          const failWithSafety = applyBlankSunAndRequireConfig(failCleaned);
          return NextResponse.json({
            ...failWithSafety,
            scrape_status: "Failed" as const,
            scrape_error_log: msg,
          });
        }
        console.log("Triggering AI Search for:", plantName, "(site returned 403/404, unknown category)");
        const aiPayload = await searchWebFallback(plantName, null);
        if (aiPayload) {
          base.sun = aiPayload.sun ?? undefined;
          base.plant_spacing = aiPayload.plant_spacing ?? undefined;
          base.days_to_germination = aiPayload.days_to_germination ?? undefined;
          base.harvest_days = aiPayload.harvest_days ?? undefined;
          const withDefaults = applyPlantCategoryDefaults(base, plantName);
          const withStructured = { ...withDefaults, ...getStructuredNameVendor(withDefaults, url, null) };
          const finalCleaned = cleanScrapedPayload(withStructured);
          const withSafety = applyBlankSunAndRequireConfig(finalCleaned);
          return NextResponse.json({
            ...withSafety,
            scrape_status: "AI_SEARCH" as const,
            scrape_error_log: msg,
          });
        }
        // Save URL-derived identity anyway; do not mark as Failed when Tavily fails (e.g. 432).
        const failDefaults = applyPlantCategoryDefaults(base, plantName);
        const failStructured = { ...failDefaults, ...getStructuredNameVendor(failDefaults, url, null) };
        const failCleaned = cleanScrapedPayload(failStructured);
        const failWithSafety = applyBlankSunAndRequireConfig(failCleaned);
        return NextResponse.json({
          ...failWithSafety,
          scrape_status: "Partial" as const,
          scrape_error_log: `${msg} (AI search unavailable or failed; URL identity saved.)`,
        });
      }
      return NextResponse.json(
        { error: msg, scrape_status: "Failed", scrape_error_log: msg },
        { status: 200 }
      );
    }

    let html = await res.text();
    html = stripStyleAndScriptFromHtml(html);
    const host = url.hostname.toLowerCase();
    const pageOrigin = url.origin;
    fallbackOrigin = pageOrigin;
    let imageError = false;
    const metadata = extractOgMetadata(html);
    fallbackMetadata = metadata;

    // Smart Scraping: try Gemini 1.5 Flash first, then Zone 10b / category defaults.
    const pageText = getPageTextForGemini(html, metadata);
    const geminiResult = await extractWithGemini(pageText, url);
    if (geminiResult) {
      const plantName =
        (metadata?.ogTitle ?? "").trim() ||
        (url.pathname.split("/").filter(Boolean).pop() ?? "Unknown");
      const schedule = getZone10bScheduleForPlant(plantName);
      const basePayload: Record<string, unknown> = {
        ogTitle: metadata?.ogTitle ?? undefined,
        plant_description: metadata?.ogDescription ?? undefined,
        imageUrl:
          metadata?.ogImage?.trim() ? resolveImageUrl(metadata.ogImage.trim(), pageOrigin) : undefined,
        variety_name: geminiResult.variety_name || undefined,
        sun: geminiResult.sun || undefined,
        plant_spacing: geminiResult.plant_spacing || undefined,
        harvest_days: geminiResult.harvest_days ?? undefined,
        days_to_germination: undefined,
      };
      if (schedule) {
        if (!basePayload.sun && schedule.sun) basePayload.sun = schedule.sun;
        if (!basePayload.plant_spacing && schedule.spacing) basePayload.plant_spacing = schedule.spacing;
        if (!basePayload.days_to_germination && schedule.germination_time)
          basePayload.days_to_germination = schedule.germination_time;
        if ((basePayload.harvest_days == null || basePayload.harvest_days === 0) && schedule.days_to_maturity) {
          const n = parseDaysToMaturityFromSchedule(schedule.days_to_maturity);
          if (n != null) basePayload.harvest_days = n;
        }
      }
      const withDefaults = applyPlantCategoryDefaults(basePayload, plantName);
      return buildSuccessResponse(withDefaults, imageError, url, metadata);
    }

    try {
      if (host.includes("johnnyseeds.com")) {
        const parsed = parseJohnnys(html, pageOrigin, metadata);
        if (parsed.imageUrl) {
          try {
            // Johnny's often blocks direct external requests; use proxy for image check (client also uses proxy for upload)
            const apiOrigin = new URL(request.url).origin;
            const proxyUrl = `${apiOrigin}/api/seed/proxy-image?url=${encodeURIComponent(parsed.imageUrl)}`;
            const imgRes = await fetch(proxyUrl, {
              method: "GET",
              headers: { "User-Agent": REAL_BROWSER_UA },
              next: { revalidate: 0 },
            });
            if (!imgRes.ok) imageError = true;
          } catch {
            imageError = true;
          }
        }
        const productTitle = parsed.ogTitle ?? metadata?.ogTitle ?? "";
        const payload = {
          imageUrl: parsed.imageUrl ?? undefined,
          harvest_days: parsed.harvest_days ?? undefined,
          sun: parsed.sun ?? undefined,
          days_to_germination: parsed.days_to_germination ?? undefined,
          plant_spacing: parsed.plant_spacing ?? undefined,
          growing_notes: parsed.growing_notes ?? undefined,
          plant_description: parsed.plant_description ?? undefined,
          latin_name: parsed.latin_name ?? undefined,
          life_cycle: parsed.life_cycle ?? undefined,
          hybrid_status: parsed.hybrid_status ?? undefined,
          ...(parsed.ogTitle && { ogTitle: parsed.ogTitle }),
        };
        const withDefaults = applyPlantCategoryDefaults(payload, productTitle);
        return await maybeAiFallback(withDefaults, imageError, productTitle, url, metadata);
      }

      if (host.includes("marysheirloomseeds.com")) {
        const parsed = parseMarysHeirloom(html, pageOrigin, metadata);
        if (parsed.imageUrl) {
          try {
            const imgRes = await fetch(parsed.imageUrl, {
              method: "HEAD",
              headers: { "User-Agent": REAL_BROWSER_UA },
              next: { revalidate: 0 },
            });
            if (!imgRes.ok) imageError = true;
          } catch {
            imageError = true;
          }
        }
        const payload = {
          imageUrl: parsed.imageUrl ?? undefined,
          harvest_days: parsed.harvest_days ?? undefined,
          sun: parsed.sun ?? undefined,
          water: parsed.water ?? undefined,
          days_to_germination: parsed.days_to_germination ?? undefined,
          plant_spacing: parsed.plant_spacing ?? undefined,
          growing_notes: parsed.growing_notes ?? undefined,
          plant_description: parsed.plant_description ?? undefined,
          latin_name: parsed.latin_name ?? undefined,
          life_cycle: parsed.life_cycle ?? undefined,
          hybrid_status: parsed.hybrid_status ?? undefined,
        };
        const withDefaults = applyPlantCategoryDefaults(payload, metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }

      if (host.includes("rareseeds.com")) {
        const parsed = parseBakerCreek(html, pageOrigin, metadata);
        if (parsed.imageUrl) {
          try {
            const imgRes = await fetch(parsed.imageUrl, {
              method: "HEAD",
              headers: { "User-Agent": REAL_BROWSER_UA },
              next: { revalidate: 0 },
            });
            if (!imgRes.ok) imageError = true;
          } catch {
            imageError = true;
          }
        }
        const payload = {
          imageUrl: parsed.imageUrl ?? undefined,
          harvest_days: parsed.harvest_days ?? undefined,
          sun: parsed.sun ?? undefined,
          days_to_germination: parsed.days_to_germination ?? undefined,
          plant_spacing: parsed.plant_spacing ?? undefined,
          growing_notes: parsed.growing_notes ?? undefined,
          plant_description: parsed.plant_description ?? undefined,
          latin_name: parsed.latin_name ?? undefined,
          life_cycle: parsed.life_cycle ?? undefined,
          hybrid_status: parsed.hybrid_status ?? undefined,
          ...(parsed.plant_name_from_breadcrumb && { plant_name_from_breadcrumb: parsed.plant_name_from_breadcrumb }),
        };
        const withDefaults = applyPlantCategoryDefaults(payload, metadata?.ogTitle ?? "");
        const response = await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
        if (knownPlantTypes !== undefined) {
          const slug = getRareseedsSlugFromUrl(url.href);
          if (slug) {
            const data = await response.clone().json();
            const result = rareseedsAutotreatment(slugToSpaced(slug), knownPlantTypes);
            data.plant_name = result.plant_name;
            data.variety_name = result.variety_name;
            return NextResponse.json(data);
          }
        }
        return response;
      }

      if (host.includes("territorialseed.com")) {
        const parsed = parseTerritorial(html, pageOrigin, metadata);
        if (parsed.imageUrl) {
          try {
            const imgRes = await fetch(parsed.imageUrl, {
              method: "HEAD",
              headers: { "User-Agent": REAL_BROWSER_UA },
              next: { revalidate: 0 },
            });
            if (!imgRes.ok) imageError = true;
          } catch {
            imageError = true;
          }
        }
        const payload = {
          imageUrl: parsed.imageUrl ?? undefined,
          harvest_days: parsed.harvest_days ?? undefined,
          sun: parsed.sun ?? undefined,
          water: parsed.water ?? undefined,
          days_to_germination: parsed.days_to_germination ?? undefined,
          plant_spacing: parsed.plant_spacing ?? undefined,
          growing_notes: parsed.growing_notes ?? undefined,
          plant_description: parsed.plant_description ?? undefined,
          latin_name: parsed.latin_name ?? undefined,
          life_cycle: parsed.life_cycle ?? undefined,
          hybrid_status: parsed.hybrid_status ?? undefined,
        };
        const withDefaults = applyPlantCategoryDefaults(payload, metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }

      if (host.includes("burpee.com")) {
        const parsed = parseBurpee(html, pageOrigin, metadata);
        if (parsed.imageUrl) {
          try {
            const imgRes = await fetch(parsed.imageUrl, {
              method: "HEAD",
              headers: { "User-Agent": REAL_BROWSER_UA },
              next: { revalidate: 0 },
            });
            if (!imgRes.ok) imageError = true;
          } catch {
            imageError = true;
          }
        }
        const productTitle = parsed.ogTitle ?? metadata?.ogTitle ?? "";
        const payload = {
          imageUrl: parsed.imageUrl ?? undefined,
          harvest_days: parsed.harvest_days ?? undefined,
          sun: parsed.sun ?? undefined,
          days_to_germination: parsed.days_to_germination ?? undefined,
          plant_spacing: parsed.plant_spacing ?? undefined,
          growing_notes: parsed.growing_notes ?? undefined,
          plant_description: parsed.plant_description ?? undefined,
          latin_name: parsed.latin_name ?? undefined,
          life_cycle: parsed.life_cycle ?? undefined,
          hybrid_status: parsed.hybrid_status ?? undefined,
          ...(parsed.ogTitle && { ogTitle: parsed.ogTitle }),
        };
        const withDefaults = applyPlantCategoryDefaults(payload, productTitle);
        return await maybeAiFallback(withDefaults, imageError, productTitle, url, metadata);
      }

      if (host.includes("highmowingseeds.com")) {
        const parsed = parseHighMowing(html, pageOrigin, metadata);
        if (parsed.imageUrl) {
          try {
            const imgRes = await fetch(parsed.imageUrl, {
              method: "HEAD",
              headers: { "User-Agent": REAL_BROWSER_UA },
              next: { revalidate: 0 },
            });
            if (!imgRes.ok) imageError = true;
          } catch {
            imageError = true;
          }
        }
        const payload = {
          imageUrl: parsed.imageUrl ?? undefined,
          harvest_days: parsed.harvest_days ?? undefined,
          sun: parsed.sun ?? undefined,
          days_to_germination: parsed.days_to_germination ?? undefined,
          plant_spacing: parsed.plant_spacing ?? undefined,
          growing_notes: parsed.growing_notes ?? undefined,
          plant_description: parsed.plant_description ?? undefined,
          latin_name: parsed.latin_name ?? undefined,
          life_cycle: parsed.life_cycle ?? undefined,
          hybrid_status: parsed.hybrid_status ?? undefined,
          vendor: parsed.vendor ?? undefined,
          category: parsed.category ?? undefined,
        };
        const withDefaults = applyPlantCategoryDefaults(
          payload,
          metadata?.ogTitle ?? "",
          parsed.category ?? undefined
        );
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }

      if (host.includes("botanicalinterests.com")) {
        const parsed = parseBotanicalInterests(html, pageOrigin, metadata);
        if (parsed.imageUrl) {
          try {
            const imgRes = await fetch(parsed.imageUrl, {
              method: "HEAD",
              headers: {
                "User-Agent": REAL_BROWSER_UA,
                Referer: "https://www.google.com/",
              },
              next: { revalidate: 0 },
            });
            if (!imgRes.ok) imageError = true;
          } catch {
            imageError = true;
          }
        }
        const payload = {
          imageUrl: parsed.imageUrl ?? undefined,
          harvest_days: parsed.harvest_days ?? undefined,
          sun: parsed.sun ?? undefined,
          days_to_germination: parsed.days_to_germination ?? undefined,
          plant_spacing: parsed.plant_spacing ?? undefined,
          growing_notes: parsed.growing_notes ?? undefined,
          plant_description: parsed.plant_description ?? undefined,
          latin_name: parsed.latin_name ?? undefined,
          life_cycle: parsed.life_cycle ?? undefined,
          hybrid_status: parsed.hybrid_status ?? undefined,
        };
        const withDefaults = applyPlantCategoryDefaults(payload, metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }

      if (host.includes("outsidepride.com")) {
        const parsed = parseOutsidePride(html, pageOrigin, metadata);
        if (parsed.imageUrl) {
          try {
            const imgRes = await fetch(parsed.imageUrl, {
              method: "HEAD",
              headers: { "User-Agent": REAL_BROWSER_UA },
              next: { revalidate: 0 },
            });
            if (!imgRes.ok) imageError = true;
          } catch {
            imageError = true;
          }
        }
        const payload = {
          imageUrl: parsed.imageUrl ?? undefined,
          harvest_days: parsed.harvest_days ?? undefined,
          sun: parsed.sun ?? undefined,
          days_to_germination: parsed.days_to_germination ?? undefined,
          plant_spacing: parsed.plant_spacing ?? undefined,
          growing_notes: parsed.growing_notes ?? undefined,
          plant_description: parsed.plant_description ?? undefined,
          latin_name: parsed.latin_name ?? undefined,
          life_cycle: parsed.life_cycle ?? undefined,
          hybrid_status: parsed.hybrid_status ?? undefined,
        };
        const withDefaults = applyPlantCategoryDefaults(payload, metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }

      const genericPayload = (p: ReturnType<typeof parseUniversal>) => ({
        imageUrl: p.imageUrl ?? undefined,
        harvest_days: p.harvest_days ?? undefined,
        sun: p.sun ?? undefined,
        days_to_germination: p.days_to_germination ?? undefined,
        plant_spacing: p.plant_spacing ?? undefined,
        growing_notes: p.growing_notes ?? undefined,
        plant_description: p.plant_description ?? undefined,
        latin_name: p.latin_name ?? undefined,
        life_cycle: p.life_cycle ?? undefined,
        hybrid_status: p.hybrid_status ?? undefined,
      });
      const genericImageCheck = async (imageUrl: string | null) => {
        if (!imageUrl) return;
        try {
          const imgRes = await fetch(imageUrl, { method: "HEAD", headers: { "User-Agent": REAL_BROWSER_UA }, next: { revalidate: 0 } });
          if (!imgRes.ok) imageError = true;
        } catch {
          imageError = true;
        }
      };

      if (host.includes("edenbrothers.com")) {
        const parsed = parseEdenBrothers(html, pageOrigin, metadata);
        await genericImageCheck(parsed.imageUrl);
        const productTitle = parsed.ogTitle ?? metadata?.ogTitle ?? "";
        const payload = { ...genericPayload(parsed), ...(parsed.ogTitle && { ogTitle: parsed.ogTitle }) };
        const withDefaults = applyPlantCategoryDefaults(payload, productTitle);
        return await maybeAiFallback(withDefaults, imageError, productTitle, url, metadata);
      }
      if (host.includes("parkseed.com")) {
        const parsed = parseParkSeed(html, pageOrigin, metadata);
        await genericImageCheck(parsed.imageUrl);
        const withDefaults = applyPlantCategoryDefaults(genericPayload(parsed), metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }
      if (host.includes("swallowtailgardenseeds.com")) {
        const parsed = parseSwallowtail(html, pageOrigin, metadata);
        await genericImageCheck(parsed.imageUrl);
        const withDefaults = applyPlantCategoryDefaults(genericPayload(parsed), metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }
      if (host.includes("superseeds.com")) {
        const parsed = parseShopifyKeyword(html, pageOrigin, "product-description", metadata);
        await genericImageCheck(parsed.imageUrl);
        const withDefaults = applyPlantCategoryDefaults(genericPayload(parsed), metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }
      if (host.includes("sowrightseeds.com")) {
        const parsed = parseShopifyKeyword(html, pageOrigin, "product__description", metadata);
        await genericImageCheck(parsed.imageUrl);
        const withDefaults = applyPlantCategoryDefaults(genericPayload(parsed), metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }
      if (host.includes("sandiegoseedcompany.com")) {
        const parsed = parseSanDiegoBolded(html, pageOrigin, metadata);
        await genericImageCheck(parsed.imageUrl);
        const productTitle = parsed.ogTitle ?? metadata?.ogTitle ?? "";
        const payload = { ...genericPayload(parsed), ...(parsed.ogTitle && { ogTitle: parsed.ogTitle }) };
        const withDefaults = applyPlantCategoryDefaults(payload, productTitle);
        return await maybeAiFallback(withDefaults, imageError, productTitle, url, metadata);
      }
      if (host.includes("floretflowers.com")) {
        const parsed = parseFloret(html, pageOrigin, metadata);
        await genericImageCheck(parsed.imageUrl);
        const withDefaults = applyPlantCategoryDefaults(genericPayload(parsed), metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }
      if (host.includes("reneesgarden.com")) {
        const parsed = parseReneesGarden(html, pageOrigin, metadata);
        await genericImageCheck(parsed.imageUrl);
        const withDefaults = applyPlantCategoryDefaults(genericPayload(parsed), metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }
      if (host.includes("theodorepayne.org")) {
        const parsed = parseNativePlantWithPretreatment(html, pageOrigin, metadata);
        await genericImageCheck(parsed.imageUrl);
        const payload = { ...genericPayload(parsed), pretreatment_notes: parsed.pretreatment_notes ?? undefined };
        const withDefaults = applyPlantCategoryDefaults(payload, metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }
      if (host.includes("nativewest.com")) {
        const parsed = parseNativePlantWithPretreatment(html, pageOrigin, metadata);
        await genericImageCheck(parsed.imageUrl);
        const payload = { ...genericPayload(parsed), pretreatment_notes: parsed.pretreatment_notes ?? undefined };
        const withDefaults = applyPlantCategoryDefaults(payload, metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }
      if (host.includes("victoryseeds.com")) {
        const parsed = parseShopifyKeyword(html, pageOrigin, "product-description", metadata);
        await genericImageCheck(parsed.imageUrl);
        const withDefaults = applyPlantCategoryDefaults(genericPayload(parsed), metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }
      if (host.includes("hudsonvalleyseed.com")) {
        const parsed = parseHudsonValley(html, pageOrigin, metadata);
        await genericImageCheck(parsed.imageUrl);
        const withDefaults = applyPlantCategoryDefaults(genericPayload(parsed), metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }
      if (host.includes("southernexposure.com")) {
        const parsed = parseOldSchool(html, pageOrigin, "#product-description", metadata);
        await genericImageCheck(parsed.imageUrl);
        const withDefaults = applyPlantCategoryDefaults(genericPayload(parsed), metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }
      if (host.includes("fedcoseeds.com")) {
        const parsed = parseOldSchool(html, pageOrigin, "product-description", metadata);
        await genericImageCheck(parsed.imageUrl);
        const withDefaults = applyPlantCategoryDefaults(genericPayload(parsed), metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }
      if (host.includes("migardener.com")) {
        const parsed = parseMIGardener(html, pageOrigin, metadata);
        if (parsed.imageUrl) {
          try {
            const imgRes = await fetch(parsed.imageUrl, {
              method: "HEAD",
              headers: { "User-Agent": REAL_BROWSER_UA },
              next: { revalidate: 0 },
            });
            if (!imgRes.ok) imageError = true;
          } catch {
            imageError = true;
          }
        }
        const payload = {
          imageUrl: parsed.imageUrl ?? undefined,
          harvest_days: parsed.harvest_days ?? undefined,
          sun: parsed.sun ?? undefined,
          days_to_germination: parsed.days_to_germination ?? undefined,
          plant_spacing: parsed.plant_spacing ?? undefined,
          growing_notes: parsed.growing_notes ?? undefined,
          plant_description: parsed.plant_description ?? undefined,
          latin_name: parsed.latin_name ?? undefined,
          life_cycle: parsed.life_cycle ?? undefined,
          hybrid_status: parsed.hybrid_status ?? undefined,
        };
        const withDefaults = applyPlantCategoryDefaults(payload, metadata?.ogTitle ?? "");
        return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
      }
      if (host.includes("row7seeds.com")) {
        const parsed = parseRow7(html, pageOrigin, metadata);
        if (parsed.imageUrl) {
          try {
            const imgRes = await fetch(parsed.imageUrl, {
              method: "HEAD",
              headers: { "User-Agent": REAL_BROWSER_UA },
              next: { revalidate: 0 },
            });
            if (!imgRes.ok) imageError = true;
          } catch {
            imageError = true;
          }
        }
        const productTitle = parsed.ogTitle ?? metadata?.ogTitle ?? "";
        const payload = {
          imageUrl: parsed.imageUrl ?? undefined,
          harvest_days: parsed.harvest_days ?? undefined,
          sun: parsed.sun ?? undefined,
          days_to_germination: parsed.days_to_germination ?? undefined,
          plant_spacing: parsed.plant_spacing ?? undefined,
          growing_notes: parsed.growing_notes ?? undefined,
          plant_description: parsed.plant_description ?? undefined,
          latin_name: parsed.latin_name ?? undefined,
          life_cycle: parsed.life_cycle ?? undefined,
          hybrid_status: parsed.hybrid_status ?? undefined,
          ...(parsed.ogTitle && { ogTitle: parsed.ogTitle }),
        };
        const withDefaults = applyPlantCategoryDefaults(payload, productTitle);
        return await maybeAiFallback(withDefaults, imageError, productTitle, url, metadata);
      }

      const parsed = parseUniversal(html, pageOrigin, metadata);
      if (parsed.imageUrl) {
        try {
          const imgRes = await fetch(parsed.imageUrl, {
            method: "HEAD",
            headers: { "User-Agent": REAL_BROWSER_UA },
            next: { revalidate: 0 },
          });
          if (!imgRes.ok) imageError = true;
        } catch {
          imageError = true;
        }
      }
      const payload = {
        imageUrl: parsed.imageUrl ?? undefined,
        harvest_days: parsed.harvest_days ?? undefined,
        sun: parsed.sun ?? undefined,
        days_to_germination: parsed.days_to_germination ?? undefined,
        plant_spacing: parsed.plant_spacing ?? undefined,
        growing_notes: parsed.growing_notes ?? undefined,
        plant_description: parsed.plant_description ?? undefined,
        latin_name: parsed.latin_name ?? undefined,
        life_cycle: parsed.life_cycle ?? undefined,
        hybrid_status: parsed.hybrid_status ?? undefined,
      };
      const withDefaults = applyPlantCategoryDefaults(payload, metadata?.ogTitle ?? "");
      return await maybeAiFallback(withDefaults, imageError, metadata?.ogTitle ?? "", url, metadata);
    } catch (parseError) {
      console.log("Scraper failed for:", url.href, parseError);
      return safetyMetadataResponse(metadata, pageOrigin, url, String(parseError));
    }
  })();

  const timeoutPromise = new Promise<Response>((_, reject) => {
    setTimeout(() => reject(new Error("SCRAPER_TIMEOUT")), SCRAPE_TIMEOUT_MS);
  });

  try {
    return await Promise.race([scrapePromise, timeoutPromise]);
  } catch (e) {
    const isTimeout = e instanceof Error && e.message === "SCRAPER_TIMEOUT";
    const isAbort = e instanceof Error && e.name === "AbortError";
    if (isTimeout || isAbort) {
      if (skipAiFallback) {
        if (fallbackMetadata && fallbackOrigin) {
          return safetyMetadataResponse(fallbackMetadata, fallbackOrigin, url, "Request timed out (15s).");
        }
        return NextResponse.json(
          {
            error: "Request timed out (15s).",
            scrape_status: "Failed",
            scrape_error_log: "Request timed out (15s).",
            imageUrl: undefined,
            plant_description: undefined,
            ogTitle: undefined,
            plant_name: "",
            variety_name: "",
            vendor_name: "",
          },
          { status: 200 }
        );
      }
      console.log("Scraper timed out; trying AI fallback for batch/vault completeness.");
      const timeoutPlantName = slugLooksUseful ? plantNameFromUrl : (plantNameFromUrl || "vegetable");
      const categoryKey = categoryFromUrl ?? getPlantCategoryFromName(timeoutPlantName);
      const aiPayload = await searchWebFallback(timeoutPlantName, categoryKey);
      if (aiPayload) {
        const base: Record<string, unknown> = {
          ogTitle: timeoutPlantName,
          sun: aiPayload.sun ?? undefined,
          plant_spacing: aiPayload.plant_spacing ?? undefined,
          days_to_germination: aiPayload.days_to_germination ?? undefined,
          harvest_days: aiPayload.harvest_days ?? undefined,
        };
        const withDefaults = applyPlantCategoryDefaults(base, timeoutPlantName);
        const withStructured = { ...withDefaults, ...getStructuredNameVendor(withDefaults, url, fallbackMetadata ?? null) };
        const finalCleaned = cleanScrapedPayload(withStructured);
        const withSafety = applyBlankSunAndRequireConfig(finalCleaned);
        return NextResponse.json({
          ...withSafety,
          scrape_status: "AI_SEARCH" as const,
          scrape_error_log: "Request timed out (15s); used AI search.",
        });
      }
      if (fallbackMetadata && fallbackOrigin) {
        return safetyMetadataResponse(fallbackMetadata, fallbackOrigin, url, "Request timed out (15s).");
      }
      return NextResponse.json(
        {
          error: "Request timed out (15s).",
          scrape_status: "Failed",
          scrape_error_log: "Request timed out (15s).",
          imageUrl: undefined,
          plant_description: undefined,
          ogTitle: undefined,
          plant_name: "",
          variety_name: "",
          vendor_name: "",
        },
        { status: 200 }
      );
    }
    console.log("Scraper failed for:", url.href, e);
    const message = e instanceof Error ? e.message : "Failed to fetch URL.";
    return NextResponse.json({ error: message, scrape_status: "Failed", scrape_error_log: message }, { status: 502 });
  }
}
