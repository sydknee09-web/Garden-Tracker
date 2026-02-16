import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const FETCH_TIMEOUT_MS = 15_000;

/**
 * Fetch an image from a URL and upload it to our storage, then return the path.
 * So the profile uses hero_image_path (our copy) and never breaks when the external URL dies or blocks.
 */
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!token) {
      return NextResponse.json({ error: "Authorization required" }, { status: 401 });
    }

    const anon = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: authError } = await anon.auth.getUser(token);
    if (authError || !user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const profile_id = typeof body?.profile_id === "string" ? body.profile_id.trim() : "";

    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "url required and must be http(s)" }, { status: 400 });
    }
    if (!profile_id) {
      return NextResponse.json({ error: "profile_id required" }, { status: 400 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; GardenTracker/1.0; +https://github.com/garden-tracker)",
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      return NextResponse.json(
        { error: `Image returned ${res.status}. Try another tile or Refresh photos.` },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("content-type") || "";
    const rawType = contentType.split(";")[0].trim().toLowerCase();
    const isImage = rawType.startsWith("image/");
    const isOctet = rawType === "application/octet-stream";
    if (!isImage && !isOctet) {
      return NextResponse.json(
        { error: "URL did not return an image. Try another tile or Refresh photos." },
        { status: 502 }
      );
    }

    const blob = await res.blob();
    const type = isImage ? (contentType.split(";")[0].trim() || "image/jpeg") : "image/jpeg";
    const ext = type.includes("png") ? "png" : "jpg";
    const path = `${user.id}/hero-${profile_id}-from-web-${crypto.randomUUID().slice(0, 8)}.${ext}`;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Server not configured for storage" }, { status: 503 });
    }

    const { error: uploadError } = await admin.storage
      .from("journal-photos")
      .upload(path, blob, { contentType: type, upsert: false });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    return NextResponse.json({ path });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json(
        { error: "Image took too long to load. Try another tile or Refresh photos." },
        { status: 504 }
      );
    }
    console.error("[save-hero-from-url]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save image." },
      { status: 500 }
    );
  }
}
