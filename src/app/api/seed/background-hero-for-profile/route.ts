import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const maxDuration = 35;

/** Call find-hero-photo for a plant, forwarding the user's auth token so cache lookups work. */
async function findHeroPhotoUrl(
  name: string,
  variety: string,
  vendor: string,
  profileId: string,
  identityKey: string,
  authToken: string
): Promise<{ url: string; path: string | null }> {
  const envUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL;
  const base =
    envUrl && !envUrl.startsWith("http")
      ? `https://${envUrl}`
      : (envUrl || "http://localhost:3000");
  try {
    const res = await fetch(`${base}/api/seed/find-hero-photo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Pass auth token so cache lookups (plant_extract_cache, global_plant_cache) work
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        name: name || "plant",
        variety,
        vendor,
        profile_id: profileId,
        identity_key: identityKey,
      }),
    });
    const data = (await res.json()) as { hero_image_url?: string; hero_image_path?: string };
    return {
      url: (data.hero_image_url ?? "").trim(),
      path: (data.hero_image_path ?? "").trim() || null,
    };
  } catch {
    return { url: "", path: null };
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token =
      authHeader != null && authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : null;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const profileId = typeof body?.profileId === "string" ? body.profileId.trim() : "";
    if (!profileId) {
      return NextResponse.json({ error: "profileId required" }, { status: 400 });
    }

    const maxRetries = 3;
    const retryDelayMs = 500;
    let profile: unknown = null;
    let profileErr: unknown = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await supabase
        .from("plant_profiles")
        .select("id, name, variety_name, user_id, hero_image_url, hero_image_path")
        .eq("id", profileId)
        .eq("user_id", user.id)
        .maybeSingle();
      profile = result.data;
      profileErr = result.error;
      if (!profileErr && profile) break;
      if (attempt < maxRetries) await new Promise((r) => setTimeout(r, retryDelayMs));
    }

    if (profileErr || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const p = profile as {
      id: string;
      name: string;
      variety_name: string | null;
      user_id: string;
      hero_image_url?: string | null;
      hero_image_path?: string | null;
    };

    // Skip if already has a real hero (path or non-placeholder URL)
    const existingPath = (p.hero_image_path ?? "").trim();
    const existingUrl = (p.hero_image_url ?? "").trim();
    if (existingPath || (existingUrl && !existingUrl.endsWith("seedling-icon.svg"))) {
      return NextResponse.json({ ok: true, updated: false });
    }

    await supabase
      .from("plant_profiles")
      .update({ hero_image_pending: true })
      .eq("id", profileId)
      .eq("user_id", user.id);

    try {
      const { data: packets } = await supabase
        .from("seed_packets")
        .select("vendor_name, primary_image_path")
        .eq("plant_profile_id", profileId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(1);
      const firstPacket = Array.isArray(packets) && packets.length > 0 ? packets[0] : null;
      const vendor = (firstPacket as { vendor_name?: string | null } | null)?.vendor_name?.trim() ?? "";
      const packetPath = (firstPacket as { primary_image_path?: string | null } | null)?.primary_image_path?.trim();

      const name = (p.name ?? "").trim() || "plant";
      const variety = (p.variety_name ?? "").trim();

      // Build identity key for cache lookups
      const { identityKeyFromVariety } = await import("@/lib/identityKey");
      const identityKey = identityKeyFromVariety(name, variety) ?? "";

      // Find hero — pass auth token so cache tiers work and we skip AI when possible
      const { url: heroUrl, path: heroPath } = await findHeroPhotoUrl(
        name,
        variety,
        vendor,
        profileId,
        identityKey,
        token
      );

      let updates: Record<string, string | null> = {};
      if (heroPath) {
        // Stored in our own bucket — never breaks
        const { data: pubUrl } = supabase.storage.from("journal-photos").getPublicUrl(heroPath);
        updates = { hero_image_path: heroPath, hero_image_url: (pubUrl?.publicUrl ?? heroUrl) || null };
      } else if (heroUrl) {
        updates = { hero_image_url: heroUrl };
      } else if (packetPath) {
        // Fallback to packet image
        const { data: urlData } = supabase.storage.from("seed-packets").getPublicUrl(packetPath);
        const packetUrl = urlData?.publicUrl ?? "";
        if (packetUrl) updates = { hero_image_url: packetUrl };
      }

      if (Object.keys(updates).length === 0) {
        return NextResponse.json({ ok: true, updated: false });
      }

      await supabase
        .from("plant_profiles")
        .update({ ...updates, hero_image_pending: false })
        .eq("id", profileId)
        .eq("user_id", user.id);

      return NextResponse.json({ ok: true, updated: true });
    } finally {
      await supabase
        .from("plant_profiles")
        .update({ hero_image_pending: false })
        .eq("id", profileId)
        .eq("user_id", user.id);
    }
  } catch (e) {
    console.error("Background hero for profile error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
