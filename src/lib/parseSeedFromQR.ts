/**
 * Parses scanned QR code data (URL or JSON) into seed form fields.
 * Supports: URL query params (?name=Tomato&variety=Cherry&vendor=...&harvest_days=90)
 * or JSON: { name, variety, vendor, harvest_days }
 */
export interface SeedQRPrefill {
  name?: string;
  variety?: string;
  vendor?: string;
  harvest_days?: string;
}

export function parseSeedFromQR(text: string): SeedQRPrefill {
  const trimmed = text.trim();
  if (!trimmed) return {};

  const out: SeedQRPrefill = {};

  try {
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
      const url = new URL(trimmed);
      const p = url.searchParams;
      if (p.has("name")) out.name = p.get("name") ?? undefined;
      if (p.has("variety")) out.variety = p.get("variety") ?? undefined;
      if (p.has("vendor")) out.vendor = p.get("vendor") ?? undefined;
      if (p.has("harvest_days")) out.harvest_days = p.get("harvest_days") ?? undefined;
      return out;
    }

    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof parsed.name === "string") out.name = parsed.name;
    if (typeof parsed.variety === "string") out.variety = parsed.variety;
    if (typeof parsed.vendor === "string") out.vendor = parsed.vendor;
    if (parsed.harvest_days != null) out.harvest_days = String(parsed.harvest_days);
    return out;
  } catch {
    return out;
  }
}
