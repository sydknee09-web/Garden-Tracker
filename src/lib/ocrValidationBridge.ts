/**
 * OCR Validation Bridge: clean messy seed packet text from Mary's Heirloom, Baker Creek, etc.
 * Use after Tesseract OCR and before parseNameAndVarietyFromOcr / getTagsFromText.
 */

const NOISE_LINE =
  /^(copyright|®|™|all rights reserved|www\.|http|\.com|\.org|product of|packed for|organic|non[- ]?gmo|heirloom|open pollinated|seed count|approx\.?|approximately|\d+\s*seeds?|batch\s*#|lot\s*#|best by|sell by|use by|\d{1,2}\/\d{1,2}\/\d{2,4})$/i;
/** Phrases to strip from lines (noise that shouldn't influence Vendor/Plant/Variety). */
const NOISE_PHRASES = /\b(packed for|heirloom|non-?gmo|organic|open pollinated)\b/gi;
/** Line looks like a street address: starts with digits or contains "St|Ave|Blvd|Rd|Dr|City|, [A-Z]{2}\s+\d{5}". */
const ADDRESS_LINE = /^\d+\s+[\w\s]+(?:street|st\.?|avenue|ave\.?|blvd\.?|road|rd\.?|drive|dr\.?|lane|ln\.?|way|place|pl\.?)\b|,\s*[A-Z]{2}\s+\d{5}(-\d{4})?\s*$/i;
const URL_OR_EMAIL = /https?:\/\/[^\s]+|\S+@\S+\.\S+/g;
const HTML_TAG = /<[^>]+>/g;
const MULTI_SPACE = /\s{2,}/g;
const LEADING_SPECIAL = /^[\s\-_.#|*]+|[\s\-_.#|*]+$/g;

/**
 * Clean raw OCR text from seed packets for reliable name/variety extraction.
 * - Strips URLs, emails, HTML-like fragments
 * - Removes lines that are clearly noise (copyright, batch#, etc.)
 * - Normalizes whitespace and trims junk characters
 * - Preserves line structure for first-line = name, rest = variety
 */
export function cleanOcrSeedPacketText(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let t = raw
    .replace(URL_OR_EMAIL, " ")
    .replace(HTML_TAG, " ")
    .replace(MULTI_SPACE, " ")
    .trim();
  const lines = t
    .split(/\r?\n/)
    .map((line) => line.replace(LEADING_SPECIAL, "").replace(MULTI_SPACE, " ").trim())
    .filter((line) => line.length > 0);
  const kept = lines.filter((line) => !NOISE_LINE.test(line) && line.length < 200);
  return kept.join("\n").replace(MULTI_SPACE, " ").trim();
}

/**
 * Strip common noise and address lines from OCR text before sending to LLM extraction.
 * Removes: "Packed for", "Heirloom", "Non-GMO", address lines, and other boilerplate
 * so the AI receives only label content relevant to Vendor, Plant Type, and Variety.
 */
export function stripNoiseForOcrExtraction(raw: string): string {
  if (!raw || typeof raw !== "string") return "";
  let t = raw
    .replace(URL_OR_EMAIL, " ")
    .replace(HTML_TAG, " ")
    .replace(MULTI_SPACE, " ")
    .trim();
  const lines = t
    .split(/\r?\n/)
    .map((line) =>
      line.replace(LEADING_SPECIAL, "").replace(NOISE_PHRASES, "").replace(MULTI_SPACE, " ").trim()
    )
    .filter((line) => line.length > 0 && !NOISE_LINE.test(line) && !ADDRESS_LINE.test(line) && line.length < 200);
  return lines.join("\n").replace(MULTI_SPACE, " ").trim();
}
