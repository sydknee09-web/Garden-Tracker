/**
 * Canonical key for matching varieties across vendors (Select Seeds, Johnny's, Rare Seeds).
 * Strips everything that isn't a letter or number so "Benary's Giant", "benary-s-giant", and "Benarys Giant" all yield "benarysgiant".
 */
export function getCanonicalKey(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")  // Strips everything that isn't a letter or number
    .replace(/\s+/g, "");       // Removes all spaces
}
