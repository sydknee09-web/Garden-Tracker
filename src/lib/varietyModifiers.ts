/**
 * Known modifiers to strip from variety names for "core variety" matching.
 * Used so "Bulls Blood F1" and "Bulls Blood Organic" match the same profile.
 */
export const VARIETY_MODIFIERS = [
  "f1",
  "f2",
  "organic",
  "heirloom",
  "open pollinated",
  "open-pollinated",
  "hybrid",
  "non-gmo",
  "non gmo",
] as const;

const MODIFIER_PATTERN = new RegExp(
  `\\b(${VARIETY_MODIFIERS.join("|")})\\b`,
  "gi"
);

/**
 * Strip known modifiers from a variety string and return clean core name + extracted tags.
 * e.g. "Bulls Blood F1 Organic" -> { coreVariety: "Bulls Blood", tags: ["F1", "Organic"] }
 */
export function parseVarietyWithModifiers(variety: string | null | undefined): {
  coreVariety: string;
  tags: string[];
} {
  const raw = (variety ?? "").trim();
  if (!raw) return { coreVariety: "", tags: [] };

  const tags: string[] = [];
  let core = raw;

  let m: RegExpExecArray | null;
  const re = new RegExp(MODIFIER_PATTERN.source, "gi");
  while ((m = re.exec(raw)) !== null) {
    const tag = m[1]!;
    const normalized = tag.toLowerCase();
    if (normalized === "open-pollinated" || normalized === "open pollinated") {
      if (!tags.some((t) => t.toLowerCase() === "open pollinated")) tags.push("Open Pollinated");
    } else if (!tags.some((t) => t.toLowerCase() === normalized)) {
      tags.push(tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase());
    }
  }

  core = raw
    .replace(MODIFIER_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { coreVariety: core, tags };
}

/** Normalize for DB comparison: trim, lower case. */
export function normalizeForMatch(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}
