/**
 * Human-readable "age" of a planting from a sow/plant date to an end date (or now).
 *
 * Accepts BOTH date-only ("2025-03-15") and full-ISO ("2025-03-15T00:00:00+00:00") inputs.
 * The earlier inline version blindly appended "T12:00:00", so a sown_date already containing a
 * "T" produced an Invalid Date → "NaN yr" (the bug Syd hit on Snow Pea Beauregarde, 2026-06-10).
 * Returns "—" (em dash, GT empty-cell convention) for empty or unparseable input.
 */
export function formatAge(sowDate: string, endDate?: string | null): string {
  if (!sowDate || !String(sowDate).trim()) return "—";
  const toDate = (v: string) => new Date(v.includes("T") ? v : v + "T12:00:00");
  const start = toDate(sowDate);
  const finish = endDate ? toDate(endDate) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(finish.getTime())) return "—";
  const diffMs = finish.getTime() - start.getTime();
  if (diffMs < 0) return "Not yet planted";
  const days = Math.floor(diffMs / 86400000);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 60) return `${Math.floor(days / 7)} wk${Math.floor(days / 7) === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30.44);
  if (months < 24) return `${months} mo`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths > 0 ? `${years} yr ${remMonths} mo` : `${years} yr`;
}
