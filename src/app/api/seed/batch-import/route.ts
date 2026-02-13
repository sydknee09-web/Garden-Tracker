import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { applyZone10bToProfile, toScheduleKey, getZone10bScheduleForPlant, getDefaultSowMonthsForZone10b } from "@/data/zone10b_schedule";
import { parseVarietyWithModifiers, normalizeForMatch } from "@/lib/varietyModifiers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export type BatchImportResultItem = {
  url: string;
  status: "success" | "fail";
  error?: string;
  plant_profile_id?: string;
  seed_packet_id?: string;
  matched_existing?: boolean;
  /** Non-blocking summary log lines for UI: e.g. "Scraped [Vendor].", "Sourced from Perenual.", "(New template added to Brain)." */
  logLines?: string[];
};

/**
 * Strict matching: exact Plant Name + Variety (case-insensitive trim).
 * If match → new SeedPacket only; do not overwrite profile bio unless empty.
 * If no match → new PlantProfile + new SeedPacket.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token =
    authHeader != null && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : null;

  if (!token) {
    return NextResponse.json(
      { error: "Authorization required. Send Bearer <access_token>." },
      { status: 401 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json(
      { error: "Invalid or expired token." },
      { status: 401 }
    );
  }

  const userId = user.id;

  let body: { urls?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const raw = Array.isArray(body.urls) ? body.urls : [];
  const urls: string[] = [];
  for (const u of raw) {
    const s = typeof u === "string" ? u.trim() : "";
    if (!s) continue;
    const withProtocol = s.startsWith("http") ? s : "https://" + s;
    try {
      new URL(withProtocol);
      urls.push(withProtocol);
    } catch {
      // skip invalid URL
    }
  }

  if (urls.length === 0) {
    return NextResponse.json(
      { error: "At least one valid URL is required." },
      { status: 400 }
    );
  }

  const origin = new URL(request.url).origin;
  const results: BatchImportResultItem[] = [];

  const { data: scheduleRows } = await supabase
    .from("schedule_defaults")
    .select("plant_type")
    .eq("user_id", userId);
  const knownPlantTypes = Array.from(new Set(
    (scheduleRows ?? []).map((r: { plant_type: string }) => toScheduleKey(r.plant_type || "")).filter(Boolean)
  ));

  for (const url of urls) {
    try {
      const isRareseeds = url.toLowerCase().includes("rareseeds.com");
      const scrapeRes = await fetch(`${origin}/api/seed/scrape-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          ...(isRareseeds && { knownPlantTypes }),
        }),
        cache: "no-store",
      });
      const data = (await scrapeRes.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;

      if (!scrapeRes.ok || (data.error as string | undefined)) {
        results.push({
          url,
          status: "fail",
          error:
            (data.error as string) ||
            (data.scrape_error_log as string) ||
            scrapeRes.statusText ||
            "Scrape failed",
        });
        continue;
      }

      const plantName =
        (typeof data.plant_name === "string" && data.plant_name.trim()) ||
        (typeof data.ogTitle === "string" && data.ogTitle.trim()) ||
        "Unknown";
      const rawVariety =
        typeof data.variety_name === "string" && data.variety_name.trim()
          ? data.variety_name.trim()
          : "";
      const { coreVariety, tags: packetTags } = parseVarietyWithModifiers(rawVariety);
      const varietyName = coreVariety || rawVariety || null;
      const vendorName =
        typeof data.vendor_name === "string" && data.vendor_name.trim()
          ? data.vendor_name.trim()
          : null;

      let primaryImagePath: string | null = null;
      const imageUrl =
        typeof data.imageUrl === "string" && data.imageUrl.trim()
          ? data.imageUrl.trim()
          : null;
      if (imageUrl) {
        try {
          const proxyRes = await fetch(
            `${origin}/api/seed/proxy-image?url=${encodeURIComponent(imageUrl)}`
          );
          if (proxyRes.ok) {
            const blob = await proxyRes.blob();
            if (blob.type.startsWith("image/")) {
              // TODO: Add server-side image compression (e.g. sharp) for Law 4 compliance
              const ext = blob.type.split("/")[1] || "jpg";
              const path = `${userId}/${crypto.randomUUID()}.${ext}`;
              const { error: uploadErr } = await supabase.storage
                .from("seed-packets")
                .upload(path, blob, {
                  contentType: blob.type,
                  upsert: false,
                });
              if (!uploadErr) primaryImagePath = path;
            }
          }
        } catch {
          // non-fatal
        }
      }

      const scrapedDetails = [
        data.plant_description,
        data.growing_notes,
      ]
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .join("\n\n")
        .trim() || null;

      const nameNorm = normalizeForMatch(plantName);
      const varietyNorm = normalizeForMatch(varietyName);

      const { data: allProfiles } = await supabase
        .from("plant_profiles")
        .select("id, name, variety_name")
        .eq("user_id", userId);
      const exact = (allProfiles ?? []).find(
        (p: { name: string; variety_name: string | null }) =>
          normalizeForMatch(p.name) === nameNorm && normalizeForMatch(p.variety_name) === varietyNorm
      );

      let profileId: string;
      let matched = false;
      if (exact) {
        profileId = exact.id;
        matched = true;
      } else {
        const zone10b = applyZone10bToProfile(plantName.trim(), {
          sun: typeof data.sun === "string" ? data.sun : null,
          plant_spacing: typeof data.plant_spacing === "string" ? data.plant_spacing : null,
          days_to_germination: data.days_to_germination != null ? (typeof data.days_to_germination === "string" ? data.days_to_germination : String(data.days_to_germination)) : null,
          harvest_days: typeof data.harvest_days === "number" ? data.harvest_days : null,
        });
        const updatePayload: Record<string, unknown> = {
          user_id: userId,
          name: plantName.trim(),
          variety_name: varietyName,
          ...(primaryImagePath && { primary_image_path: primaryImagePath }),
          ...(zone10b.sun != null && { sun: zone10b.sun }),
          ...(typeof data.water === "string" && data.water.trim() && { water: data.water.trim() }),
          ...(zone10b.plant_spacing != null && { plant_spacing: zone10b.plant_spacing }),
          ...(zone10b.days_to_germination != null && { days_to_germination: zone10b.days_to_germination }),
          ...(zone10b.harvest_days != null && { harvest_days: zone10b.harvest_days }),
          ...(zone10b.sowing_method != null && { sowing_method: zone10b.sowing_method }),
          ...(zone10b.planting_window != null && { planting_window: zone10b.planting_window }),
          ...(typeof data.pretreatment_notes === "string" && data.pretreatment_notes.trim() && { pretreatment_notes: data.pretreatment_notes.trim() }),
        };
        const { data: newProfile, error: profileErr } = await supabase
          .from("plant_profiles")
          .insert(updatePayload)
          .select("id")
          .single();
        if (profileErr) {
          results.push({ url, status: "fail", error: profileErr.message });
          continue;
        }
        profileId = (newProfile as { id: string }).id;
      }

      if (matched) {
        const { data: profileRow } = await supabase
          .from("plant_profiles")
          .select("sun, harvest_days, plant_spacing, days_to_germination, sowing_method, planting_window")
          .eq("id", profileId)
          .single();
        const p = profileRow as { sun?: string; harvest_days?: number; plant_spacing?: string; days_to_germination?: string; sowing_method?: string; planting_window?: string } | null;
        const zone10b = applyZone10bToProfile(plantName.trim(), {
          sun: typeof data.sun === "string" ? data.sun : p?.sun ?? null,
          plant_spacing: typeof data.plant_spacing === "string" ? data.plant_spacing : p?.plant_spacing ?? null,
          days_to_germination: data.days_to_germination != null ? String(data.days_to_germination).trim() : (p?.days_to_germination ?? null),
          harvest_days: typeof data.harvest_days === "number" ? data.harvest_days : (p?.harvest_days ?? null),
        });
        const updates: Record<string, unknown> = {};
        if (!p?.sun && zone10b.sun != null) updates.sun = zone10b.sun;
        if ((p?.harvest_days == null || p?.harvest_days === 0) && zone10b.harvest_days != null) updates.harvest_days = zone10b.harvest_days;
        if (!p?.plant_spacing && zone10b.plant_spacing != null) updates.plant_spacing = zone10b.plant_spacing;
        if (!p?.days_to_germination && zone10b.days_to_germination != null) updates.days_to_germination = zone10b.days_to_germination;
        if (zone10b.sowing_method != null) updates.sowing_method = zone10b.sowing_method;
        if (zone10b.planting_window != null) updates.planting_window = zone10b.planting_window;
        if (Object.keys(updates).length > 0) {
          await supabase.from("plant_profiles").update(updates).eq("id", profileId);
        }
      }

      const { data: packetRow, error: packetErr } = await supabase
        .from("seed_packets")
        .insert({
          plant_profile_id: profileId,
          user_id: userId,
          vendor_name: vendorName,
          purchase_url: url,
          purchase_date: new Date().toISOString().slice(0, 10),
          qty_status: 100,
          scraped_details: scrapedDetails,
          ...(primaryImagePath && { primary_image_path: primaryImagePath }),
          ...(packetTags.length > 0 && { tags: packetTags }),
        })
        .select("id")
        .single();

      if (packetErr) {
        results.push({ url, status: "fail", error: packetErr.message });
        continue;
      }

      const logLines: string[] = [];
      logLines.push(`Scraped ${vendorName || "vendor"}.`);

      try {
        const perenualRes = await fetch(
          `${origin}/api/seed/perenual-enrich?q=${encodeURIComponent(plantName.trim())}`,
          { cache: "no-store" }
        );
        if (perenualRes.ok) {
          const perenualData = (await perenualRes.json()) as {
            perenual_id?: number;
            scientific_name?: string | null;
            botanical_care_notes?: Record<string, unknown>;
          } | null;
          if (perenualData?.perenual_id) {
            await supabase
              .from("plant_profiles")
              .update({
                perenual_id: perenualData.perenual_id,
                ...(perenualData.scientific_name != null && { scientific_name: perenualData.scientific_name }),
                ...(perenualData.botanical_care_notes != null && { botanical_care_notes: perenualData.botanical_care_notes }),
              })
              .eq("id", profileId);
            logLines.push("Sourced from Perenual.");
          }
        }
      } catch {
        // non-fatal
      }

      const plantType = plantName.trim();
      if (plantType) {
        const { data: existingSchedule } = await supabase
          .from("schedule_defaults")
          .select("id")
          .eq("user_id", userId)
          .eq("plant_type", plantType)
          .maybeSingle();
        if (!existingSchedule) {
          const zone10b = getZone10bScheduleForPlant(plantType);
          const sowMonths = getDefaultSowMonthsForZone10b(zone10b?.planting_window);
          await supabase.from("schedule_defaults").upsert(
            {
              user_id: userId,
              plant_type: plantType,
              updated_at: new Date().toISOString(),
              ...sowMonths,
              water: null,
              sowing_depth: null,
            },
            { onConflict: "user_id,plant_type" }
          );
          logLines.push("(New template added to Brain).");
        }
      }

      results.push({
        url,
        status: "success",
        plant_profile_id: profileId,
        seed_packet_id: (packetRow as { id: string }).id,
        matched_existing: matched,
        logLines,
      });
    } catch (e) {
      results.push({
        url,
        status: "fail",
        error: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ results });
}
