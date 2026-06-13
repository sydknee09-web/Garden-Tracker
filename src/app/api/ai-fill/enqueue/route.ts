import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getSupabaseUser, unauthorized } from "@/app/api/import/auth";
import type { SupabaseClient } from "@supabase/supabase-js";

// The background continuation runs the full enrichment pipeline (self-fetch of
// fill-blanks-for-profile, whose own budget is 60s) AFTER the response is sent,
// and waitUntil work counts toward this function's lifetime. 120 anchored to
// settings/fill-in-blanks.
export const maxDuration = 120;

/**
 * AI Fill backgrounding: enqueue a durable job row and return immediately; the
 * enrichment pipeline runs in this invocation's background continuation
 * (waitUntil), so it completes regardless of client navigation/disconnect. The
 * client tracks the row via realtime (AiFillJobsContext) for button-spinner
 * state + the completion toast.
 *
 * Worker choice rationale (vs Vercel cron / Supabase Edge Function): the whole
 * pipeline is user-Bearer-token-driven and lives in Next.js TypeScript — a
 * deferred external worker would run with a possibly-expired token and force a
 * service-role rewrite (or a Deno port). In-invocation processing uses the
 * token NOW and reuses the existing route unchanged (one pipeline, no duplicate
 * path). A daily cron handles only stale-job sweeping + 7-day cleanup.
 */

type JobResultSummary = {
  fieldsFilled: number;
  notFound: boolean;
  enriched: boolean;
  error?: string;
  plantName: string;
};

/** waitUntil throws outside a Vercel request context (e.g. next dev); the floating promise still runs there. */
function safeWaitUntil(promise: Promise<unknown>) {
  try {
    waitUntil(promise);
  } catch {
    // next dev / tests: persistent Node process keeps the floating promise alive.
  }
}

async function runJob(args: {
  supabase: SupabaseClient;
  userId: string;
  jobId: string;
  profileId: string;
  overwrite: boolean;
  token: string;
  plantName: string;
}) {
  const { supabase, userId, jobId, profileId, overwrite, token, plantName } = args;
  try {
    let summary: JobResultSummary;
    try {
      const base = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const origin = base.startsWith("http") ? base : `https://${base}`;
      // Byte-identical body to the old foreground handlers (Fill Blanks / Overwrite):
      // forceRefresh bypasses both caches per the explicit-AI-button semantics.
      const res = await fetch(`${origin}/api/seed/fill-blanks-for-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ profileId, useGemini: true, forceRefresh: true, ...(overwrite ? { overwrite: true } : {}) }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        enriched?: boolean;
        fieldsFilled?: number;
        notFound?: boolean;
        error?: string;
      };
      summary = {
        fieldsFilled: typeof data.fieldsFilled === "number" ? data.fieldsFilled : 0,
        notFound: Boolean(data.notFound),
        enriched: data.enriched === true,
        ...(res.ok ? {} : { error: data.error || `HTTP_${res.status}` }),
        ...(res.ok && data.error ? { error: data.error } : {}),
        plantName,
      };
    } catch (e) {
      console.warn("ai-fill enqueue: pipeline fetch failed:", e instanceof Error ? e.message : e);
      summary = { fieldsFilled: 0, notFound: false, enriched: false, error: "AI_UNREACHABLE", plantName };
    }

    const failed = Boolean(summary.error) && summary.fieldsFilled === 0 && !summary.notFound;
    const { error: updateError } = await supabase
      .from("ai_fill_jobs")
      .update({
        status: failed ? "failed" : "complete",
        completed_at: new Date().toISOString(),
        result_summary: summary,
      })
      .eq("id", jobId)
      .eq("user_id", userId);
    if (updateError) console.error("ai-fill enqueue: job completion write failed:", updateError.message);
  } finally {
    // Hero lifecycle: creation paths (AddVarietyModal / QuickAddSeed) set
    // hero_image_pending=true at insert for the Library card "Researching…" pulse;
    // fill-blanks-for-profile runs find-hero-photo but never touches this flag, so
    // the job worker owns the reset. finally guarantees it even if the job-row write
    // throws (anchor: background-hero-for-profile/route.ts finally). Profile-page
    // button jobs never set it true → this is a harmless no-op for them.
    const { error: heroResetError } = await supabase
      .from("plant_profiles")
      .update({ hero_image_pending: false })
      .eq("id", profileId)
      .eq("user_id", userId);
    if (heroResetError) console.error("ai-fill enqueue: hero_image_pending reset failed:", heroResetError.message);
  }
}

export async function POST(req: Request) {
  try {
    const auth = await getSupabaseUser(req);
    if (!auth) return unauthorized();
    const { supabase, user } = auth;
    const token = req.headers.get("authorization")!.slice(7).trim();

    const body = await req.json().catch(() => ({}));
    const profileId = typeof body?.profileId === "string" ? body.profileId.trim() : "";
    const overwrite = Boolean(body?.overwrite);
    if (!profileId) return NextResponse.json({ error: "profileId required" }, { status: 400 });

    // Ownership check + toast subject (variety preferred: "Cherokee Purple profile updated").
    const { data: profile, error: profileError } = await supabase
      .from("plant_profiles")
      .select("id, name, variety_name")
      .eq("id", profileId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError || !profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    const plantName =
      ((profile as { variety_name?: string | null }).variety_name ?? "").trim() ||
      ((profile as { name?: string | null }).name ?? "").trim();

    // One active job per profile (DB partial unique index backs this against races).
    const { data: existing } = await supabase
      .from("ai_fill_jobs")
      .select("id, status")
      .eq("plant_profile_id", profileId)
      .in("status", ["pending", "running"])
      .maybeSingle();
    if (existing) return NextResponse.json({ jobId: existing.id, alreadyRunning: true });

    const { data: inserted, error: insertError } = await supabase
      .from("ai_fill_jobs")
      .insert({ user_id: user.id, plant_profile_id: profileId, status: "pending", overwrite })
      .select("id")
      .single();
    if (insertError || !inserted) {
      // Unique-violation race: another enqueue won — return its job.
      if (insertError?.code === "23505") {
        const { data: winner } = await supabase
          .from("ai_fill_jobs")
          .select("id")
          .eq("plant_profile_id", profileId)
          .in("status", ["pending", "running"])
          .maybeSingle();
        if (winner) return NextResponse.json({ jobId: winner.id, alreadyRunning: true });
      }
      console.error("ai-fill enqueue: job insert failed:", insertError?.message);
      return NextResponse.json({ error: "Could not start AI fill" }, { status: 500 });
    }

    const jobId = inserted.id as string;
    // Mark running before responding so the client's first realtime/initial-fetch
    // snapshot already reads as active (pending→running is sub-second here).
    await supabase.from("ai_fill_jobs").update({ status: "running" }).eq("id", jobId).eq("user_id", user.id);

    safeWaitUntil(runJob({ supabase, userId: user.id, jobId, profileId, overwrite, token, plantName }));

    return NextResponse.json({ jobId });
  } catch (e) {
    console.error("ai-fill enqueue:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Enqueue failed" }, { status: 500 });
  }
}
