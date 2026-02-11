import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const maxDuration = 35;

/** Server-side call to find-hero-photo logic; returns hero_image_url or empty. */
async function findHeroPhotoUrl(name: string, variety: string, vendor: string): Promise<string> {
  const envUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL;
  const base =
    envUrl && !envUrl.startsWith("http")
      ? `https://${envUrl}`
      : (envUrl || "http://localhost:3000");
  try {
    const res = await fetch(`${base}/api/seed/find-hero-photo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name || "plant", variety, vendor }),
    });
    const data = (await res.json()) as { hero_image_url?: string };
    return (data.hero_image_url ?? "").trim();
  } catch {
    return "";
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
        .select("id, name, variety_name, user_id, hero_image_url")
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

    const p = profile as { id: string; name: string; variety_name: string | null; user_id: string; hero_image_url?: string | null };
    if ((p.hero_image_url ?? "").trim()) {
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
    const heroUrl = await findHeroPhotoUrl(name, variety, vendor);

    let urlToSet: string;
    if (heroUrl) {
      urlToSet = heroUrl;
    } else if (packetPath) {
      const { data: urlData } = supabase.storage.from("seed-packets").getPublicUrl(packetPath);
      urlToSet = urlData?.publicUrl ?? "";
    } else {
      urlToSet = "";
    }

    if (!urlToSet) return NextResponse.json({ ok: true, updated: false });

    await supabase
      .from("plant_profiles")
      .update({ hero_image_url: urlToSet, hero_image_pending: false })
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
