/**
 * Filter plant type suggestions from global_plant_cache so junk (e.g. "?", ".")
 * never appears in Quick Add / Batch Add / Review Import comboboxes.
 * Keeps only strings that contain at least one letter, sorted alphabetically
 * (case-insensitive) so callers can render directly without re-sorting.
 */
export function filterValidPlantTypes(types: string[]): string[] {
  return types
    .filter((t) => {
      const s = (t ?? "").trim();
      if (!s) return false;
      return /[a-zA-Z]/.test(s);
    })
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}
