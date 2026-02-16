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
 * Strip HTML tags and common attribute fragments for safe display (e.g. scientific name).
 * Use when data may contain scraped HTML or fragments like `"-tulips" class="header__menu-item"`.
 */
export function stripHtmlForDisplay(s: string | null | undefined): string {
  if (s == null || typeof s !== "string") return "";
  let out = s
    .replace(/<[^>]*>/g, "")
    .replace(/\s+class\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s+id\s*=\s*["'][^"']*["']/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  return decodeHtmlEntities(out);
}
