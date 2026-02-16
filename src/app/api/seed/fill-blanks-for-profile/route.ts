import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { identityKeyFromVariety } from "@/lib/identityKey";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildUpdatesFromCacheRow,
  getBestCacheRow,
  writeEnrichToGlobalCache,
  type EnrichDataForCache,
} from "@/lib/fillBlanksCache";

export const maxDuration = 60;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function findHeroPhotoWithToken(
  token: string,
  name: string,
  variety: string,
  vendor: string,
  identityKey?: string,
  scientificName?: string
): Promise<string> {
  const base = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const url = base.startsWith("http") ? base : `https://${base}`;
  try {
    const res = await fetch(`${url}/api/seed/find-hero-photo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name,
        variety,
        vendor,
        identity_key: identityKey ?? undefined,
        scientific_name: scientificName ?? "",
      }),
    });
    const data = (await res.json()) as { hero_image_url?: string };
    return (data.hero_image_url ?? "").trim();
  } catch {
    return "";
  }
}

/**
 * Fill blanks for a single profile: cache lookup (global_plant_cache) then optional AI (hero + enrich).
 * When AI is used, hero is written to cache by find-hero-photo; we write AI enrich data to global_plant_cache here.
 * Used after import save so new profiles never persist with empty cells; also callable from Developer.
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!token) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const profileId = typeof body?.profileId === "string" ? body.profileId.trim() : "";
    const useGemini = Boolean(body?.useGemini);
    if (!profileId) {
      return NextResponse.json({ error: "profileId required" }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("plant_profiles")
      .select(
        "id, name, variety_name, scientific_name, sun, plant_spacing, days_to_germination, harvest_days, plant_description, growing_notes, water, sowing_depth, sowing_method, planting_window, hero_image_url, hero_image_path"
      )
      .eq("id", profileId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { data: packets } = await supabase
      .from("seed_packets")
      .select("vendor_name, purchase_url")
      .eq("plant_profile_id", profileId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    const vendor =
      (packets?.[0] as { vendor_name?: string | null } | undefined)?.vendor_name?.trim() ?? "";
    const purchaseUrl = (packets?.[0] as { purchase_url?: string | null } | undefined)?.purchase_url?.trim();

    const name = (profile.name ?? "").trim() || "Imported seed";
    const variety = (profile.variety_name ?? "").trim();
    const identityKey = identityKeyFromVariety(name, variety);
    if (!identityKey) {
      return NextResponse.json({ error: "Could not derive identity key from name/variety" }, { status: 400 });
    }

    const bestRow = await getBestCacheRow(supabase, identityKey, purchaseUrl ?? null, vendor);
    const updates = bestRow
      ? await buildUpdatesFromCacheRow(profile as Parameters<typeof buildUpdatesFromCacheRow>[0], bestRow)
      : {};

    let fromCache = false;
    let fromAi = false;

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("plant_profiles")
        .update(updates)
        .eq("id", profileId)
        .eq("user_id", user.id);
      if (!updateError) fromCache = true;
    }

    const hadNoHero =
      !(profile.hero_image_path ?? "").trim() &&
      (!(profile.hero_image_url ?? "").trim() ||
        (profile.hero_image_url ?? "").trim().toLowerCase().endsWith("seedling-icon.svg"));
    const hadNoDescription = !(profile.plant_description ?? "").trim() && !(profile.growing_notes ?? "").trim();
    const stillMissingHero = hadNoHero && !(updates as Record<string, unknown>).hero_image_url;
    const stillMissingDescription =
      hadNoDescription &&
      !(updates as Record<string, unknown>).plant_description &&
      !(updates as Record<string, unknown>).growing_notes;
    const needAi = useGemini && (stillMissingHero || stillMissingDescription);

    if (needAi) {
      if (stillMissingHero) {
        const aiHero = await findHeroPhotoWithToken(
          token,
          name,
          variety,
          vendor,
          identityKey,
          (profile as { scientific_name?: string | null }).scientific_name ?? undefined
        );
        if (aiHero) {
          await supabase
            .from("plant_profiles")
            .update({ hero_image_url: aiHero })
            .eq("id", profileId)
            .eq("user_id", user.id);
          fromAi = true;
        }
      }

      if (stillMissingDescription || (!fromCache && (profile.plant_description ?? "").trim() === "")) {
        const base = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
        const origin = base.startsWith("http") ? base : `https://${base}`;
        try {
          const enrichRes = await fetch(`${origin}/api/seed/enrich-from-name`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name, variety }),
          });
          if (enrichRes.ok) {
            const data = (await enrichRes.json()) as {
              plant_description?: string;
              growing_notes?: string;
              sun_requirement?: string;
              spacing?: string;
              days_to_germination?: string;
              days_to_maturity?: string;
              sowing_depth?: string;
              water?: string;
              sowing_method?: string;
              planting_window?: string;
            };
            const aiDesc = (data.plant_description ?? "").trim();
            const aiNotes = (data.growing_notes ?? "").trim();
            if (aiDesc || aiNotes) {
              const aiUpdates: Record<string, unknown> = { description_source: "ai" };
              if (aiDesc) aiUpdates.plant_description = aiDesc;
              if (aiNotes) aiUpdates.growing_notes = aiNotes;
              const { error: aiErr } = await supabase
                .from("plant_profiles")
                .update(aiUpdates)
                .eq("id", profileId)
                .eq("user_id", user.id);
              if (!aiErr) {
                fromAi = true;
                const admin = getSupabaseAdmin();
                if (admin) {
                  const enrichData: EnrichDataForCache = {
                    plant_description: aiDesc || undefined,
                    growing_notes: aiNotes || undefined,
                    sun_requirement: data.sun_requirement ?? undefined,
                    spacing: data.spacing ?? undefined,
                    days_to_germination: data.days_to_germination ?? undefined,
                    days_to_maturity: data.days_to_maturity ?? undefined,
                    sowing_depth: data.sowing_depth ?? undefined,
                    water: data.water ?? undefined,
                    sowing_method: data.sowing_method ?? undefined,
                    planting_window: data.planting_window ?? undefined,
                  };
                  await writeEnrichToGlobalCache(admin, identityKey, vendor, name, variety, enrichData);
                }
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }

    return NextResponse.json({
      ok: true,
      fromCache,
      fromAi,
    });
  } catch (e) {
    console.error("[fill-blanks-for-profile]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fill failed" },
      { status: 500 }
    );
  }
}
