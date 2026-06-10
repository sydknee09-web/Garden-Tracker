import { NextResponse } from "next/server";
import { getSupabaseUser, unauthorized } from "@/app/api/import/auth";
import { checkRateLimit, DEFAULT_RATE_LIMIT } from "@/lib/rateLimit";
import { checkDailyAiCeiling } from "@/lib/aiDailyCeiling";
import { checkContentLength, MAX_URL_LENGTH } from "@/lib/requestValidation";
import { logRequestMetrics } from "@/lib/logRequestMetrics";

export const maxDuration = 30;

const ROUTE_ID = "seed-extract-single-url";

/**
 * Thin wrapper around /api/seed/extract-metadata for the in-FAB SeedPacketForm
 * inline Link import step. Returns a simplified shape with the fields the form
 * prefills directly (plant_name, variety, vendor, source_url, tags). Hero image
 * lookup is deferred to the existing enrichProfileFromName path that runs on
 * profile creation — no duplicate scrape pipeline here.
 *
 * This route does NOT touch /vault/import or its multi-pass batch processor.
 */

type SingleUrlExtractResult = {
  plant_name: string;
  variety: string;
  vendor: string;
  source_url: string;
  tags: string[];
};

function isUrlBlockedForSSRF(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "0.0.0.0") return true;
    if (host.startsWith("127.")) return true;
    if (host === "::1" || host === "[::1]") return true;
    if (host.startsWith("10.")) return true;
    if (host.startsWith("192.168.")) return true;
    if (/^172\.(1[6-9]|2[0-9]|3[0-1])(\.|$)/.test(host)) return true;
    if (host.startsWith("169.254.")) return true;
    return false;
  } catch {
    return true;
  }
}

function resolveOrigin(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv;
  if (typeof process.env.VERCEL_URL === "string" && process.env.VERCEL_URL.trim()) {
    return `https://${process.env.VERCEL_URL.trim()}`;
  }
  try {
    return new URL(req.url).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export async function POST(req: Request) {
  const startTime = Date.now();
  let statusCode = 500;
  try {
    const auth = await getSupabaseUser(req);
    if (!auth) {
      const res = unauthorized();
      statusCode = res.status;
      return res;
    }
    if (!checkRateLimit(auth.user.id, DEFAULT_RATE_LIMIT)) {
      statusCode = 429;
      return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
    }
    // Durable per-user daily ceiling on Gemini usage (leak audit 2026-06-10, Leak 3).
    const daily = await checkDailyAiCeiling(auth.user.id);
    if (!daily.allowed) {
      statusCode = 429;
      return NextResponse.json({ error: "DAILY_AI_LIMIT", limit: daily.limit }, { status: 429 });
    }

    const bodySizeErr = checkContentLength(req);
    if (bodySizeErr) {
      statusCode = 400;
      return NextResponse.json(bodySizeErr, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    if (!url || !url.startsWith("http")) {
      statusCode = 400;
      return NextResponse.json({ error: "url required and must be http(s)" }, { status: 400 });
    }
    if (url.length > MAX_URL_LENGTH) {
      statusCode = 400;
      return NextResponse.json({ error: "URL too long" }, { status: 400 });
    }
    if (isUrlBlockedForSSRF(url)) {
      statusCode = 400;
      return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
    }

    const authHeader = req.headers.get("authorization") ?? "";
    const origin = resolveOrigin(req);
    const upstreamUrl = `${origin}/api/seed/extract-metadata`;
    const upstreamRes = await fetch(upstreamUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ url, skipProductPageFetch: false }),
    });
    const upstreamData = (await upstreamRes.json().catch(() => null)) as Record<string, unknown> | null;
    if (!upstreamRes.ok || !upstreamData) {
      const errCode = (upstreamData?.error as string) ?? "EXTRACTION_FAILED";
      statusCode = upstreamRes.status || 502;
      return NextResponse.json({ error: errCode }, { status: statusCode });
    }
    if (upstreamData.failed === true) {
      statusCode = 422;
      return NextResponse.json(
        { error: "Could not extract data from link" },
        { status: 422 }
      );
    }

    const getStr = (k: string) => (typeof upstreamData[k] === "string" ? (upstreamData[k] as string).trim() : "");
    const tagsRaw = Array.isArray(upstreamData.tags) ? (upstreamData.tags as unknown[]) : [];
    const tags = tagsRaw.filter((t): t is string => typeof t === "string" && t.trim().length > 0);

    const result: SingleUrlExtractResult = {
      plant_name: getStr("type") || "Imported seed",
      variety: getStr("variety"),
      vendor: getStr("vendor"),
      source_url: getStr("source_url") || url,
      tags,
    };

    statusCode = 200;
    return NextResponse.json(result);
  } catch (e) {
    console.error("[seed/extract-single-url]", e);
    statusCode = 500;
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Extraction failed" },
      { status: 500 }
    );
  } finally {
    logRequestMetrics(ROUTE_ID, Date.now() - startTime, statusCode);
  }
}
