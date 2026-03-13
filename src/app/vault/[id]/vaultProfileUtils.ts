import { supabase } from "@/lib/supabase";

/** Sync identity-key-keyed cache row when a profile's name/variety/hero changes. */
export function syncExtractCache(
  userId: string,
  identityKey: string,
  updates: { extractDataPatch?: Record<string, unknown>; heroStoragePath?: string | null; originalHeroUrl?: string | null },
  oldIdentityKey?: string,
): void {
  (async () => {
    try {
      const lookupKey = oldIdentityKey || identityKey;
      const { data: rows } = await supabase
        .from("plant_extract_cache")
        .select("id, extract_data, hero_storage_path, original_hero_url")
        .eq("user_id", userId)
        .eq("identity_key", lookupKey);
      if (!rows?.length) return;
      for (const row of rows) {
        const merged = { ...(row.extract_data as Record<string, unknown>), ...(updates.extractDataPatch ?? {}) };
        await supabase.from("plant_extract_cache").update({
          ...(oldIdentityKey ? { identity_key: identityKey } : {}),
          extract_data: merged,
          ...(updates.heroStoragePath !== undefined ? { hero_storage_path: updates.heroStoragePath } : {}),
          ...(updates.originalHeroUrl !== undefined ? { original_hero_url: updates.originalHeroUrl } : {}),
          updated_at: new Date().toISOString(),
        }).eq("id", row.id).eq("user_id", userId);
      }
    } catch (e) { console.error("[syncExtractCache] failed:", e instanceof Error ? e.message : String(e)); }
  })();
}

export function toDateInputValue(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDisplayDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatVendorDetails(
  plantDescription: string | null,
  growingInfo: string | null
): { title: string; body: string }[] {
  const combined = [plantDescription, growingInfo].filter(Boolean).join("\n\n").trim();
  if (!combined) return [];
  const sections: { title: string; body: string }[] = [];
  const headings = [
    "Harvesting", "Vase Life", "How to Grow", "How to Harvest", "Detailed Specs",
    "Planting Instructions", "Growing Info", "Sunlight", "Watering", "Soil",
    "Care Tips", "From Seed", "Direct Sowing",
  ];
  const parts = combined.split(/\n\s*\n/);
  let currentBody: string[] = [];
  let currentTitle = "Details";
  for (const p of parts) {
    const trimmed = p.trim();
    if (!trimmed) continue;
    const isHeading = headings.some(
      (h) =>
        trimmed.startsWith(h) ||
        new RegExp(`^${h}\\s*[:–-]`, "i").test(trimmed)
    );
    if (isHeading && trimmed.length < 120) {
      if (currentBody.length > 0) {
        sections.push({ title: currentTitle, body: currentBody.join("\n\n").trim() });
        currentBody = [];
      }
      currentTitle = trimmed.replace(/\s*[:–-]\s*$/, "").trim();
    } else {
      currentBody.push(trimmed);
    }
  }
  if (currentBody.length > 0) {
    sections.push({ title: currentTitle, body: currentBody.join("\n\n").trim() });
  }
  if (sections.length === 0) sections.push({ title: "Details", body: combined });
  return sections;
}

/** Collect all packet image URLs (primary, packet_photo, packet_images) in display order. */
export function getPacketImageUrls(
  pkt: { primary_image_path?: string | null; packet_photo_path?: string | null },
  extraImages: { image_path: string }[]
): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  const add = (path: string | null | undefined) => {
    const p = path?.trim();
    if (p && !seen.has(p)) {
      seen.add(p);
      urls.push(supabase.storage.from("seed-packets").getPublicUrl(p).data.publicUrl);
    }
  };
  add(pkt.primary_image_path);
  add(pkt.packet_photo_path);
  for (const { image_path } of extraImages) add(image_path);
  return urls;
}
