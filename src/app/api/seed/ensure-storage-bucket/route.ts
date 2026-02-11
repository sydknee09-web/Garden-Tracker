import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const BUCKET_NAME = "seed-packets";

/**
 * POST: Ensure the seed-packets storage bucket exists. Creates it with public
 * read access if missing. Requires SUPABASE_SERVICE_ROLE_KEY.
 */
export async function POST() {
  try {
    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Server not configured for bucket creation (missing SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 503 }
      );
    }

    const { data: buckets, error: listErr } = await admin.storage.listBuckets();
    if (listErr) {
      console.error("ensure-storage-bucket list error:", listErr);
      return NextResponse.json(
        { error: listErr.message },
        { status: 502 }
      );
    }

    const exists = (buckets ?? []).some((b) => b.name === BUCKET_NAME);
    if (exists) {
      return NextResponse.json({ ok: true, bucket: BUCKET_NAME });
    }

    const { error: createErr } = await admin.storage.createBucket(BUCKET_NAME, {
      public: true,
    });

    if (createErr) {
      console.error("ensure-storage-bucket create error:", createErr);
      return NextResponse.json(
        { error: createErr.message },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, bucket: BUCKET_NAME, created: true });
  } catch (e) {
    console.error("ensure-storage-bucket error:", e);
    return NextResponse.json(
      { error: "Failed to ensure bucket" },
      { status: 500 }
    );
  }
}
