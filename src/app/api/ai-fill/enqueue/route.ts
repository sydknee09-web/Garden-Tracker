import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { getSupabaseUser, unauthorized } from "@/app/api/import/auth";
import { buildTierLadder, type ResearchProfileTags } from "@/lib/researchVariety";
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

/** Result of one fill-blanks-for-profile pass (the slice the job worker acts on). */
type PassResult = {
  fieldsFilled: number;
  notFound: boolean;
  enriched: boolean;
  error?: string;
};

/**
 * Run one fill-blanks-for-profile pass. `forceRefresh` bypasses both caches per the
 * explicit-AI-button semantics (byte-identical to the old foreground Fill Blanks /
 * Overwrite handlers). `skipHero` is used by the tag-aware second pass so it only
 * re-fills metadata (hero was already handled by the first pass).
 */
async function fillBlanksPass(
  origin: string,
  token: string,
  profileId: string,
  opts: { overwrite?: boolean; skipHero?: boolean } = {}
): Promise<PassResult> {
  const res = await fetch(`${origin}/api/seed/fill-blanks-for-profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      profileId,
      useGemini: true,
      forceRefresh: true,
      ...(opts.overwrite ? { overwrite: true } : {}),
      ...(opts.skipHero ? { skipHero: true } : {}),
    }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    enriched?: boolean;
    fieldsFilled?: number;
    notFound?: boolean;
    error?: string;
  };
  return {
    fieldsFilled: typeof data.fieldsFilled === "number" ? data.fieldsFilled : 0,
    notFound: Boolean(data.notFound),
    enriched: data.enriched === true,
    ...(res.ok ? {} : { error: data.error || `HTTP_${res.status}` }),
    ...(res.ok && data.error ? { error: data.error } : {}),
  };
}

/**
 * Creation-from-blank tag-aware re-fill (Sprint 6 follow-up — Characteristics gap).
 *
 * A profile created via Add to Library / Quick Add Seed has NO classification tags
 * (buildProfileInsertFromName writes only functional tags), so the first enrich runs
 * the UNTAGGED tier ladder → variety-first framing (buildTierLadder). That framing
 * hunts a "seed variety product page", which is sparse on the variable Characteristics
 * for woody perennials + specialty plants (Apple cultivars, finger lime, etc.) — the
 * exact shapes the variety framing is documented to break on. The first pass infers +
 * writes the classification tags as a side effect, so re-running with those tags now
 * gets the correct cultivar/species framing and fills the still-blank Characteristics.
 * This automates the manual second "Fill Blanks" the user otherwise does by hand
 * (NORTH_STAR §2 — take mental load off the user); net AI cost is unchanged vs that
 * manual workaround, and the gate skips it entirely for plants whose framing wouldn't
 * change (common seed-grown annuals like Tomato).
 *
 * Returns the second pass result, or null when no re-fill was warranted (framing
 * unchanged) or the tag re-read failed.
 */
async function maybeTagAwareRefill(
  supabase: SupabaseClient,
  userId: string,
  profileId: string,
  name: string,
  variety: string,
  origin: string,
  token: string
): Promise<PassResult | null> {
  let tags: ResearchProfileTags;
  try {
    const { data } = await supabase
      .from("plant_profiles")
      .select("lifecycle, growth_form, plant_category")
      .eq("id", profileId)
      .eq("user_id", userId)
      .maybeSingle();
    const row = (data ?? {}) as {
      lifecycle?: string | null;
      growth_form?: string | null;
      plant_category?: string | null;
    };
    tags = {
      lifecycle: row.lifecycle ?? "",
      growth_form: row.growth_form ?? "",
      plant_category: row.plant_category ?? "",
    };
  } catch {
    return null;
  }
  // Did the now-inferred tags change the tier-1 framing vs the untagged guess the
  // first pass used? If not, the first pass already used the right framing → no re-fill.
  const untaggedFraming = buildTierLadder(name, variety, null)[0]?.framing;
  const taggedFraming = buildTierLadder(name, variety, tags)[0]?.framing;
  if (!taggedFraming || untaggedFraming === taggedFraming) return null;
  return fillBlanksPass(origin, token, profileId, { skipHero: true });
}

async function runJob(args: {
  supabase: SupabaseClient;
  userId: string;
  jobId: string;
  profileId: string;
  overwrite: boolean;
  token: string;
  plantName: string;
  /** Profile had no classification tags at enqueue time (a fresh creation). */
  wasUntagged: boolean;
  /** Raw name + variety for the tier-framing comparison in the re-fill gate. */
  name: string;
  variety: string;
}) {
  const { supabase, userId, jobId, profileId, overwrite, token, plantName, wasUntagged, name, variety } = args;
  try {
    let summary: JobResultSummary;
    try {
      const base = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const origin = base.startsWith("http") ? base : `https://${base}`;
      const pass1 = await fillBlanksPass(origin, token, profileId, { overwrite });
      let fieldsFilled = pass1.fieldsFilled;
      let enriched = pass1.enriched;

      // Tag-aware second pass — only for a fresh (untagged) creation that found data.
      // The spinner stays "running" through both passes (job completion writes once
      // below), so the user sees a single completion toast.
      if (wasUntagged && !overwrite && pass1.enriched && !pass1.notFound) {
        const refill = await maybeTagAwareRefill(supabase, userId, profileId, name, variety, origin, token);
        if (refill) {
          fieldsFilled += refill.fieldsFilled;
          enriched = enriched || refill.enriched;
        }
      }

      summary = {
        fieldsFilled,
        notFound: pass1.notFound,
        enriched,
        ...(pass1.error ? { error: pass1.error } : {}),
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
    // Classification tags drive the tag-aware re-fill gate in runJob (Characteristics fix).
    const { data: profile, error: profileError } = await supabase
      .from("plant_profiles")
      .select("id, name, variety_name, lifecycle, growth_form, plant_category")
      .eq("id", profileId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (profileError || !profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    const profileRow = profile as {
      name?: string | null;
      variety_name?: string | null;
      lifecycle?: string | null;
      growth_form?: string | null;
      plant_category?: string | null;
    };
    const profileName = (profileRow.name ?? "").trim();
    const profileVariety = (profileRow.variety_name ?? "").trim();
    const plantName = profileVariety || profileName;
    // A fresh creation has no classification tags yet → its first enrich runs the
    // untagged (variety-first) framing; runJob may need a tag-aware re-fill once the
    // tags are inferred. Profile-page button jobs run on already-tagged profiles → false.
    const wasUntagged =
      !(profileRow.lifecycle ?? "").trim() &&
      !(profileRow.growth_form ?? "").trim() &&
      !(profileRow.plant_category ?? "").trim();

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

    safeWaitUntil(
      runJob({
        supabase,
        userId: user.id,
        jobId,
        profileId,
        overwrite,
        token,
        plantName,
        wasUntagged,
        name: profileName,
        variety: profileVariety,
      })
    );

    return NextResponse.json({ jobId });
  } catch (e) {
    console.error("ai-fill enqueue:", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : "Enqueue failed" }, { status: 500 });
  }
}
