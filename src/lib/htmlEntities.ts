/**
 * Decode HTML entities for display (e.g. &#40; → "(", &amp; → "&").
 * Use for UI display only; apply at ingestion or render so stored data mapping is not broken.
 */
export function decodeHtmlEntities(s: string | null | undefined): string {
  if (s == null || typeof s !== "string") return "";
  let out = s.trim();
  if (!out) return "";
  // Numeric decimal (with or without semicolon so &#41 and &#41; both decode)
  out = out.replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
  out = out.replace(/&#x([0-9a-fA-F]+);?/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  const named: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
  };
  for (const [ent, ch] of Object.entries(named)) {
    const re = new RegExp(ent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    out = out.replace(re, ch);
  }
  return out;
}

/**
 * Strip HTML tags and attribute fragments for safe display (e.g. scientific name).
 * Removes tags, class/id/data-*="..." and any attr="value", so scraped fragments
 * like `"-tulips" class="header__menu-item list-menu__item focus-inset"` become "-tulips".
 */
export function stripHtmlForDisplay(s: string | null | undefined): string {
  if (s == null || typeof s !== "string") return "";
  let out = s
    .replace(/<[^>]*>/g, "")
    // Remove any HTML attribute: space optional before attr, then attr="..." or attr='...'
    .replace(/\s*[a-zA-Z][a-zA-Z0-9_-]*\s*=\s*["'][^"']*["']/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return decodeHtmlEntities(out);
}

/**
 * True only when the string looks like a plausible scientific name (e.g. Latin binomial),
 * not scraped HTML/code. Use to avoid showing junk like `"-tulips" class="header__..."`.
 */
export function looksLikeScientificName(s: string | null | undefined): boolean {
  const raw = s?.trim() ?? "";
  if (raw.length < 2 || raw.length > 120) return false;
  if (/class\s*=\s*["']|id\s*=\s*["']|__|<\s*\w|>\s*\w/i.test(raw)) return false;
  const stripped = stripHtmlForDisplay(raw);
  if (stripped.length < 2) return false;
  if (/class\s*=|__|<\w|>\w/i.test(stripped)) return false;
  if (/^"[^"]*"$/.test(stripped)) return false;
  if (!stripped.includes(" ") && (stripped.startsWith('"') || stripped.startsWith("-"))) return false;
  return true;
}
