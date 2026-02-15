/**
 * Shared logic for importing a vendor PDF catalog into global_plant_cache.
 * Used by the CLI script (scripts/import-pdf-catalog.ts) and the Settings API route.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { stripPlantFromVariety, cleanVarietyForDisplay } from "@/lib/varietyNormalize";

function getGeminiKey(): string {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ??
    process.env.GEMINI_API_KEY?.trim() ??
    ""
  );
}

export function slug(vendor: string): string {
  return vendor
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Max chars of catalog text per Gemini call so the model's response (JSON array) doesn't truncate. */
const CHUNK_CHARS = 45_000;

/** Strip markdown code fences from model output so we can parse JSON. */
function stripJsonFences(raw: string): string {
  let s = raw.trim();
  const openFence = s.match(/^```(?:json)?\s*\n?/i);
  if (openFence) s = s.slice(openFence[0].length);
  const closeFence = s.match(/\n?```\s*$/);
  if (closeFence) s = s.slice(0, s.length - closeFence[0].length);
  return s.trim();
}

/**
 * Parse one chunk of catalog text with Gemini. Returns array of raw plant objects.
 */
async function parseOneChunk(
  catalogChunk: string,
  vendorName: string,
  chunkIndex: number,
  totalChunks: number
): Promise<Array<Record<string, unknown>>> {
  const key = getGeminiKey();
  if (!key) {
    throw new Error("GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY) not set");
  }
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const chunkNote =
    totalChunks > 1
      ? ` This is section ${chunkIndex + 1} of ${totalChunks} of the catalog. Extract only the products in this section.`
      : "";

  const prompt = `You are parsing a seed or plant catalog (price list / order form) from a company that has no website. The vendor name is: ${vendorName}.${chunkNote}

Extract every distinct seed or plant product into a list. For each product return a JSON object with these fields (use only the keys listed; omit any key if not found in the text):
- type: string — plant type (e.g. "Tomato", "Pepper", "Basil", "Lettuce", "Flower"). Never use "Imported seed" or "Unknown" if you can infer the plant from the line (e.g. "Brandywine" under a Tomatoes section -> type "Tomato").
- variety: string — variety or product name (e.g. "Brandywine", "Sweet Banana", "Genovese").
- plant_description: string (optional) — short description if present.
- days_to_maturity: string (optional) — e.g. "75 days", "80-90 days".
- days_to_germination: string (optional).
- sun_requirement: or sun: string (optional) — e.g. "Full Sun", "Part Shade".
- spacing: or plant_spacing: string (optional) — e.g. "18 inches", "24 in".
- sowing_depth: string (optional).
- scientific_name: string (optional) — Latin name if present.
- price: string (optional) — keep as shown (e.g. "$3.50") for reference only.
- catalog_number: or item_code: string (optional) — SKU/item id if present.

Rules:
- One object per product/variety. If the same variety appears in multiple packet sizes, you may make one row per size or collapse to one; prefer one row per distinct variety.
- Separate plant type from variety (e.g. "Cherokee Purple Tomato" -> type "Tomato", variety "Cherokee Purple").
- If a section header says "Tomatoes", use type "Tomato" for items under it unless the line clearly states another plant.
- Return ONLY a JSON array of objects. No markdown code fences, no explanation. Example: [{"type":"Tomato","variety":"Brandywine","days_to_maturity":"80 days"}, ...]`;

  const result = await model.generateContent([
    { text: prompt },
    { text: `Catalog text:\n\n${catalogChunk}` },
  ]);
  const raw = result.response.text().trim();
  const jsonStr = stripJsonFences(raw);
  let arr: unknown[];
  try {
    arr = JSON.parse(jsonStr);
  } catch {
    const salvaged = trySalvageTruncatedJson(jsonStr);
    if (salvaged !== null) {
      arr = salvaged;
    } else {
      throw new Error("Gemini did not return valid JSON. Raw: " + raw.slice(0, 500));
    }
  }
  if (!Array.isArray(arr)) {
    throw new Error("Gemini did not return a JSON array. Got: " + typeof arr);
  }
  return arr.filter(
    (item): item is Record<string, unknown> => item != null && typeof item === "object"
  );
}

/** If the model truncated the JSON array, try to parse up to the last complete object. */
function trySalvageTruncatedJson(jsonStr: string): unknown[] | null {
  const a = jsonStr.lastIndexOf("},\n");
  const b = jsonStr.lastIndexOf("},\r\n");
  const lastComplete = a === -1 ? b : b === -1 ? a : Math.max(a, b);
  if (lastComplete === -1) return null;
  const truncated = jsonStr.slice(0, lastComplete + 1) + "]";
  try {
    const parsed = JSON.parse(truncated);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Parse catalog text with Gemini into structured plant rows.
 * For large catalogs, splits text into chunks and merges results to avoid truncated JSON.
 */
export async function parseCatalogWithGemini(
  catalogText: string,
  vendorName: string
): Promise<Array<Record<string, unknown>>> {
  const text = catalogText.slice(0, 600_000);
  if (text.length <= CHUNK_CHARS) {
    return parseOneChunk(text, vendorName, 0, 1);
  }
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_CHARS) {
    chunks.push(text.slice(i, i + CHUNK_CHARS));
  }
  const all: Array<Record<string, unknown>> = [];
  const seen = new Set<string>();
  for (let i = 0; i < chunks.length; i++) {
    const rows = await parseOneChunk(chunks[i], vendorName, i, chunks.length);
    for (const row of rows) {
      const type = String(row.type ?? row.name ?? "").trim().toLowerCase();
      const variety = String(row.variety ?? "").trim().toLowerCase();
      const key = `${type}|${variety}`;
      if (key && !seen.has(key)) {
        seen.add(key);
        all.push(row);
      }
    }
  }
  return all;
}

export type ToCacheRowResult = {
  source_url: string;
  identity_key: string;
  extract_data: Record<string, unknown>;
  scraped_fields: string[];
};

/**
 * Build cache row from a raw parsed object. Returns null if row is unusable.
 */
export function toCacheRow(
  raw: Record<string, unknown>,
  vendor: string
): ToCacheRowResult | null {
  let type = String(raw.type ?? raw.name ?? "").trim() || "Imported seed";
  let variety = String(raw.variety ?? "").trim();
  if (!variety && !type) return null;
  if (!variety) variety = "Unknown";
  variety = stripPlantFromVariety(variety, type);
  const { cleanedVariety, tagsToAdd } = cleanVarietyForDisplay(variety, type);
  variety = cleanedVariety;
  const identityKey = identityKeyFromVariety(type, variety);
  if (!identityKey || identityKey === "unknown") return null;
  const vendorSlug = slug(vendor);
  const source_url = `catalog:${vendorSlug}#${identityKey}`;

  const extract_data: Record<string, unknown> = {
    type,
    variety,
    vendor,
    source_url,
    tags: tagsToAdd,
    sowing_depth: typeof raw.sowing_depth === "string" ? raw.sowing_depth.trim() || undefined : undefined,
    spacing: (typeof raw.spacing === "string" ? raw.spacing : typeof raw.plant_spacing === "string" ? raw.plant_spacing : undefined)?.trim() || undefined,
    sun_requirement: (typeof raw.sun_requirement === "string" ? raw.sun_requirement : typeof raw.sun === "string" ? raw.sun : undefined)?.trim() || undefined,
    days_to_germination: typeof raw.days_to_germination === "string" ? raw.days_to_germination.trim() || undefined : undefined,
    days_to_maturity: typeof raw.days_to_maturity === "string" ? raw.days_to_maturity.trim() || undefined : undefined,
    scientific_name: typeof raw.scientific_name === "string" ? raw.scientific_name.trim() || undefined : undefined,
    plant_description: typeof raw.plant_description === "string" ? raw.plant_description.trim() || undefined : undefined,
    water: typeof raw.water === "string" ? raw.water.trim() || undefined : undefined,
    sun: (typeof raw.sun === "string" ? raw.sun : typeof raw.sun_requirement === "string" ? raw.sun_requirement : undefined)?.trim() || undefined,
    plant_spacing: (typeof raw.plant_spacing === "string" ? raw.plant_spacing : typeof raw.spacing === "string" ? raw.spacing : undefined)?.trim() || undefined,
  };
  const scraped_fields = Object.keys(extract_data).filter(
    (k) => extract_data[k] != null && extract_data[k] !== ""
  );
  return { source_url, identity_key: identityKey, extract_data, scraped_fields };
}
