/**
 * Shared title-case utility.
 * Capitalizes the first letter of each word: "chocolate sunflower" → "Chocolate Sunflower".
 */
export function toTitleCase(s: string): string {
  if (!s || !s.trim()) return s;
  return s.trim().replace(/(^|\s)(\w)/g, (_, before, letter) => before + letter.toUpperCase());
}
