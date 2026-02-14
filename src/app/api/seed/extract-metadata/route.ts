import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  extractFromUrl,
  varietySlugFromUrl,
  getBlockedTagsForRequest,
  filterBlockedTags,
  cleanVarietyForDisplay,
  inferSpecificPlantFromVariety,
  stripPlantFromVariety,
  plantFromUrlSlug,
  plantFromSegmentBeforeProduct,
  plantFromProductSlug,
  isGenericSegmentForPlant,
} from "../extract/route";
import { decodeHtmlEntities } from "@/lib/htmlEntities";
import { identityKeyFromVariety, isGenericTrapName } from "@/lib/identityKey";
import { parseSeedFromImportUrl } from "@/lib/parseSeedFromImportUrl";
import { getVendorFromUrl, normalizeVendorKey } from "@/lib/vendorNormalize";
import type { ExtractResponse } from "../extract/route";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const maxDuration = 30;

const PASS1_TIMEOUT_MS = 20_000;
const PAGE_FETCH_TIMEOUT_MS = 8_000;
/** Timeout for scrape-url when used as canonical extractor (same as bulk-scrape / cache). */
const SCRAPE_URL_TIMEOUT_MS = 22_000;
const IMAGE_CHECK_TIMEOUT_MS = 5_000;

function qualityRank(q: string): number {
  const rank: Record<string, number> = { full: 3, partial: 2, ai_only: 1, failed: 0 };
  return rank[q] ?? -1;
}

async function checkImageAccessible(url: string): Promise<boolean> {
  if (!url?.startsWith("http")) return false;
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), IMAGE_CHECK_TIMEOUT_MS);
    const res = await fetch(url, { method: "HEAD", signal: controller.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/** Realistic, up-to-date User-Agents (Chrome 131) to reduce vendor blocks; pick by URL so same site gets consistent UA. */
const SCRAPER_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
];

function pickUserAgentForUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    const hash = host.split("").reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
    const index = Math.abs(hash) % SCRAPER_USER_AGENTS.length;
    return SCRAPER_USER_AGENTS[index] ?? SCRAPER_USER_AGENTS[0];
  } catch {
    return SCRAPER_USER_AGENTS[0];
  }
}

function resolveImageUrl(raw: string, baseUrl: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    return new URL(trimmed, baseUrl).href;
  } catch {
    return trimmed;
  }
}

/** Generic/category terms that must not be used as variety name (trigger fallback or AI). */
const JUNK_TITLE_TERMS = new Set([
  "vegetables", "seeds", "herbs", "flowers", "home", "products", "shop", "catalog",
  "seed", "vegetable", "herb", "flower", "product", "store", "cart", "account",
]);

function isJunkTitle(title: string | null | undefined): boolean {
  const t = (title ?? "").trim();
  if (t.length < 2) return true;
  const lower = t.toLowerCase();
  if (JUNK_TITLE_TERMS.has(lower)) return true;
  if (/^(all|view\s+all|shop\s+all|see\s+all)$/i.test(lower)) return true;
  return false;
}

/** Strip vendor suffix from <title> (e.g. "Product Name | Johnny's Seeds" → "Product Name"). */
function stripVendorSuffixFromTitle(title: string, url: string): string {
  let s = title.trim();
  const pipeIdx = s.indexOf("|");
  const dashIdx = s.indexOf(" – ");
  const dashIdx2 = s.indexOf(" - ");
  let cut = s.length;
  if (pipeIdx > 0) cut = Math.min(cut, pipeIdx);
  if (dashIdx > 0) cut = Math.min(cut, dashIdx);
  if (dashIdx2 > 0) cut = Math.min(cut, dashIdx2);
  s = s.slice(0, cut).trim();
  const vendorSuffixes = [
    /\|?\s*Johnny'?s?\s+(?:Selected\s+)?Seeds?/i,
    /\|?\s*San\s+Diego\s+Seed\s+Company/i,
    /\|?\s*Baker\s+Creek/i,
    /\|?\s*Burpee/i,
    /\|?\s*Rare\s+Seeds?/i,
    /\|?\s*Seeds?\s+Company/i,
    /\|?\s*-\s*Buy\s+Seeds?/i,
  ];
  for (const re of vendorSuffixes) {
    s = s.replace(re, "").trim();
  }
  return s;
}

/** Blacklist: element opening tag has class or id containing breadcrumb, nav, or category. */
const BREADCRUMB_NAV_CATEGORY = /(?:^|\s)(?:class|id)=["'][^"']*(?:breadcrumb|nav|category)[^"']*["']/i;

function elementHasBreadcrumbNavOrCategoryInClassOrId(openTag: string): boolean {
  return BREADCRUMB_NAV_CATEGORY.test(openTag);
}

/** Return true if the character range before an <h1> suggests the h1 is inside nav/header/breadcrumb. */
function isH1InsideNavHeaderOrBreadcrumb(html: string, h1Index: number): boolean {
  const before = html.slice(Math.max(0, h1Index - 400), h1Index);
  const openTagMatches = before.match(/<(\w+)[^>]*(\bclass=["'][^"']*["'])?[^>]*>/g);
  if (!openTagMatches?.length) return false;
  const lastOpen = openTagMatches[openTagMatches.length - 1];
  if (!lastOpen) return false;
  const tagName = lastOpen.match(/<(\w+)/)?.[1]?.toLowerCase();
  if (tagName === "nav" || tagName === "header") return true;
  if (lastOpen.includes('class=') && /breadcrumb/i.test(lastOpen)) return true;
  return false;
}

/**
 * Extract page title with strict priority. Rejects generic/junk terms and falls back to next source.
 * Primary: meta[property='og:title']
 * Secondary: main <h1> (exclude h1 inside nav, header, or breadcrumb)
 * Tertiary: <title> stripped of vendor suffix
 */
function getTitleFromHtml(html: string, url: string): string | null {
  const tryCandidate = (raw: string | null | undefined): string | null => {
    const t = (raw ?? "").trim();
    if (t.length < 2 || t.length > 200) return null;
    if (isJunkTitle(t)) return null;
    if (isGenericTrapName(t)) return null; // Never use breadcrumb/nav as variety (Vegetables, Seeds, Cool Season, Shop)
    return t;
  };

  // Primary: og:title
  const ogTitleMatch =
    html.match(/<meta[\s\S]*?\bproperty=["']og:title["'][\s\S]*?\bcontent=["']([^"']+)["']/i) ??
    html.match(/<meta[\s\S]*?\bcontent=["']([^"']+)["'][\s\S]*?\bproperty=["']og:title["']/i);
  if (ogTitleMatch?.[1]) {
    const candidate = tryCandidate(ogTitleMatch[1]);
    if (candidate) return candidate;
  }

  // Secondary: <h1> not inside nav/header/breadcrumb; blacklist h1 with breadcrumb/nav/category in class or id
  const h1Regex = /<h1[^>]*>([\s\S]*?)<\/h1>/gi;
  let h1Match;
  while ((h1Match = h1Regex.exec(html)) !== null) {
    const openTag = h1Match[0].slice(0, h1Match[0].indexOf(">"));
    if (elementHasBreadcrumbNavOrCategoryInClassOrId(openTag)) continue;
    if (isH1InsideNavHeaderOrBreadcrumb(html, h1Match.index)) continue;
    const inner = h1Match[1].replace(/<[^>]+>/g, "").trim();
    if (inner.length < 2 || inner.length > 200) continue;
    const candidate = tryCandidate(inner);
    if (candidate) return candidate;
  }

  // Tertiary: <title> stripped of vendor suffix
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch?.[1]) {
    const raw = titleMatch[1].replace(/<[^>]+>/g, "").trim();
    const stripped = stripVendorSuffixFromTitle(raw, url);
    const candidate = tryCandidate(stripped);
    if (candidate) return candidate;
  }

  return null;
}

/** Result of product page fetch: always includes raw HTTP status for diagnostics (403=vendor blocking, 404=URL typo, 200=check selectors). */
type ProductImageResult =
  | { linkDead: true; productPageStatus: number }
  | { rateLimited: true; productPageStatus: number }
  | { productPageStatus: number; imageUrl: string | null };

type PageFetchResult = { pageResult: ProductImageResult; titleFromPage: string | null };

/**
 * Fetch product page HTML and extract a hero image URL and page title (h1/og:title). Returns object with productPageStatus in all cases.
 */
async function productImageFromPage(url: string): Promise<PageFetchResult> {
  let html: string;
  let pageStatus = 0;
  let titleFromPage: string | null = null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PAGE_FETCH_TIMEOUT_MS);
    const userAgent = pickUserAgentForUrl(url);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    clearTimeout(timeout);
    pageStatus = res.status;
    if (res.status === 404) {
      console.log("[PASS 1] Link not found (404):", url.slice(0, 50) + "...");
      return { pageResult: { linkDead: true, productPageStatus: 404 }, titleFromPage: null };
    }
    if (res.status === 403 || res.status === 429) {
      console.log("[PASS 1] Rate limited:", res.status, url.slice(0, 50) + "...");
      return { pageResult: { rateLimited: true, productPageStatus: res.status }, titleFromPage: null };
    }
    if (!res.ok) {
      console.log("[PASS 1] Product page fetch not OK:", res.status, url.slice(0, 50) + "...");
      return { pageResult: { productPageStatus: res.status, imageUrl: null }, titleFromPage: null };
    }
    html = await res.text();
    titleFromPage = getTitleFromHtml(html, url);
  } catch (e) {
    console.log("[PASS 1] Product page fetch failed:", (e instanceof Error ? e.message : String(e)), url.slice(0, 50) + "...");
    return { pageResult: { productPageStatus: pageStatus || 0, imageUrl: null }, titleFromPage: null };
  }
  try {
    const origin = new URL(url).origin;
    const host = new URL(url).hostname.toLowerCase();
    const ogMatch =
      html.match(
        /<meta[\s\S]*?\bproperty=["']og:image["'][\s\S]*?\bcontent=["']([^"']+)["']/i
      ) ??
      html.match(
        /<meta[\s\S]*?\bcontent=["']([^"']+)["'][\s\S]*?\bproperty=["']og:image["']/i
      );
    if (ogMatch?.[1]) {
      const u = resolveImageUrl(ogMatch[1], origin);
      if (u.startsWith("http")) return { pageResult: { productPageStatus: pageStatus, imageUrl: u }, titleFromPage };
    }
    if (host.includes("superseeds.com")) {
      const superseedsSelectors = [
        /<img[\s\S]*?(?:data-src|data-srcset|src)=["']([^"']+)["'][\s\S]*?(?:class|id)=["'][^"']*(?:product|gallery|main|featured)[^"']*["']/i,
        /(?:class|id)=["'][^"']*(?:product|gallery|main)[^"']*["'][\s\S]*?<img[\s\S]*?(?:data-src|data-srcset|src)=["']([^"']+)["']/i,
        /<img[\s\S]*?src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)["']/i,
      ];
      for (const re of superseedsSelectors) {
        const m = html.match(re);
        const src = m?.[1]?.trim();
        if (src) {
          const u = resolveImageUrl(src.split(/[\s,]/)[0], origin);
          if (u.startsWith("http") && !/\.(?:svg|gif|ico)(?:\?|$)/i.test(u)) {
            return { pageResult: { productPageStatus: pageStatus, imageUrl: u }, titleFromPage };
          }
        }
      }
    }
    const mainImgMatch = html.match(
      /<img[\s\S]*?\bdata-main-image[\s\S]*?(?:data-src|src)=["']([^"']+)["']/i
    ) ?? html.match(
      /<img[\s\S]*?(?:data-src|src)=["']([^"']+)["'][\s\S]*?\bdata-main-image/i
    );
    if (mainImgMatch?.[1]) {
      const u = resolveImageUrl(mainImgMatch[1], origin);
      if (u.startsWith("http")) return { pageResult: { productPageStatus: pageStatus, imageUrl: u }, titleFromPage };
    }
    const productImgMatch = html.match(
      /<img[\s\S]*?(?:id|class)=["'][^"']*(?:product|main|primary)[^"']*["'][\s\S]*?(?:data-src|data-lazy|src)=["']([^"']+)["']/i
    ) ?? html.match(
      /<img[\s\S]*?(?:data-src|data-lazy|src)=["']([^"']+)["'][\s\S]*?(?:id|class)=["'][^"']*(?:product|main|primary)[^"']*["']/i
    );
    if (productImgMatch?.[1]) {
      const u = resolveImageUrl(productImgMatch[1], origin);
      if (u.startsWith("http")) return { pageResult: { productPageStatus: pageStatus, imageUrl: u }, titleFromPage };
    }
    const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let jsonLdBlock;
    let count = 0;
    while ((jsonLdBlock = jsonLdRegex.exec(html)) !== null && count++ < 15) {
      try {
        const parsed = JSON.parse(jsonLdBlock[1]) as { image?: string | string[]; "@graph"?: Array<{ image?: string | string[] }> };
        const candidates: (string | string[] | undefined)[] = [parsed?.image];
        if (Array.isArray(parsed?.["@graph"])) {
          for (const node of parsed["@graph"]) candidates.push(node?.image);
        }
        for (const img of candidates) {
          const u = Array.isArray(img) ? img[0] : typeof img === "string" ? img : null;
          if (u && typeof u === "string" && u.startsWith("http")) {
            const resolved = resolveImageUrl(u, origin);
            if (resolved.startsWith("http")) return { pageResult: { productPageStatus: pageStatus, imageUrl: resolved }, titleFromPage };
          }
        }
      } catch {
        /* ignore */
      }
    }
  } catch {
    // ignore
  }
  console.log("[PASS 1] No product image in HTML (og:image / JSON-LD / product img):", url.slice(0, 50) + "...");
  if (pageStatus === 200 && typeof html === "string") {
    console.log("[PASS 1] 200 OK but empty/no image — first 500 chars of HTML (check for Cloudflare challenge):", url.slice(0, 80) + "...", "\n", html.slice(0, 500));
  }
  return { pageResult: { productPageStatus: pageStatus, imageUrl: null }, titleFromPage };
}

/** Hosts where we prioritize page title for variety; if title is generic trap, force Pass 2/3 immediately. */
const TITLE_PRIORITY_HOSTS = ["johnny", "outsidepride", "sandiegoseed"];

/** Pass 1: Metadata only. Returns quickly with variety/vendor; failed: true triggers Pass 2 rescue. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const url = typeof body?.url === "string" ? body.url.trim() : "";
    const batchIndex = typeof body?.batchIndex === "number" ? body.batchIndex : undefined;
    const batchTotal = typeof body?.batchTotal === "number" ? body.batchTotal : undefined;
    const isFirstInBatch = body?.isFirstInBatch === true;
    const skipProductPageFetch = body?.skipProductPageFetch === true;

    if (!url) {
      return NextResponse.json({ error: "url required" }, { status: 400 });
    }

    // Tier 0 cache: global_plant_cache (shared, pre-populated by bulk scraper — no user_id needed)
    const authHeader = req.headers.get("authorization");
    const cacheToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (cacheToken) {
      try {
        const sbGlobal = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${cacheToken}` } },
        });
        const { data: globalCached } = await sbGlobal
          .from("global_plant_cache")
          .select("extract_data, hero_storage_path, original_hero_url")
          .eq("source_url", url)
          .limit(1)
          .maybeSingle();
        if (globalCached?.extract_data) {
          const ed = globalCached.extract_data as Record<string, unknown>;
          const heroUrl = (ed.hero_image_url as string) ?? (globalCached.original_hero_url as string) ?? "";
          const sunReq = (ed.sun_requirement as string) ?? (ed.sun as string);
          const spacingVal = (ed.spacing as string) ?? (ed.plant_spacing as string);
          const daysToMaturity = (ed.days_to_maturity as string) ?? undefined;
          const harvestDaysNum = typeof ed.harvest_days === "number" && Number.isFinite(ed.harvest_days)
            ? ed.harvest_days
            : daysToMaturity != null
              ? parseInt(String(daysToMaturity).replace(/^(\d+).*/, "$1"), 10)
              : undefined;
          const harvestDays =
            typeof harvestDaysNum === "number" && harvestDaysNum > 0 && harvestDaysNum < 365 ? harvestDaysNum : undefined;
          console.log(`[PASS 1] Tier 0 global cache hit for ${url.slice(0, 60)}...`);
          return NextResponse.json({
            type: (ed.type as string) ?? "Imported seed",
            variety: (ed.variety as string) ?? "",
            vendor: (ed.vendor as string) ?? "",
            tags: (ed.tags as string[]) ?? [],
            source_url: (ed.source_url as string) ?? url,
            sowing_depth: (ed.sowing_depth as string) ?? undefined,
            spacing: spacingVal ?? undefined,
            sun_requirement: sunReq ?? undefined,
            days_to_germination: (ed.days_to_germination as string) ?? undefined,
            days_to_maturity: daysToMaturity,
            scientific_name: (ed.scientific_name as string) ?? undefined,
            plant_description: (ed.plant_description as string) ?? undefined,
            hero_image_url: heroUrl || undefined,
            stock_photo_url: heroUrl || undefined,
            failed: false,
            cached: true,
            productPageStatus: 200,
            // scrape-url shape so import flow and zone10b merge get sun, plant_spacing, harvest_days, water
            sun: sunReq ?? undefined,
            plant_spacing: spacingVal ?? undefined,
            harvest_days: harvestDays,
            water: (ed.water as string)?.trim() || undefined,
          });
        }
      } catch (e) {
        console.log("[PASS 1] Tier 0 global cache check failed, proceeding:", (e instanceof Error ? e.message : String(e)));
      }
    }

    // Tier 1 cache: user-specific plant_extract_cache (exact URL match per user)
    if (cacheToken) {
      try {
        const sbCache = createClient(supabaseUrl, supabaseAnonKey, {
          global: { headers: { Authorization: `Bearer ${cacheToken}` } },
        });
        const { data: { user: cacheUser } } = await sbCache.auth.getUser(cacheToken);
        if (cacheUser?.id) {
          const { data: cached } = await sbCache
            .from("plant_extract_cache")
            .select("extract_data, hero_storage_path, original_hero_url")
            .eq("user_id", cacheUser.id)
            .eq("source_url", url)
            .limit(1)
            .maybeSingle();
          if (cached?.extract_data) {
            const ed = cached.extract_data as Record<string, unknown>;
            let heroUrl = (ed.hero_image_url as string) ?? (cached.original_hero_url as string) ?? "";
            if (cached.hero_storage_path) {
              const { data: pubUrl } = sbCache.storage.from("journal-photos").getPublicUrl(cached.hero_storage_path as string);
              if (pubUrl?.publicUrl) heroUrl = pubUrl.publicUrl;
            }
            const sunReq = (ed.sun_requirement as string) ?? (ed.sun as string);
            const spacingVal = (ed.spacing as string) ?? (ed.plant_spacing as string);
            const daysToMaturity = (ed.days_to_maturity as string) ?? undefined;
            const harvestDaysNum = typeof ed.harvest_days === "number" && Number.isFinite(ed.harvest_days)
              ? ed.harvest_days
              : daysToMaturity != null
                ? parseInt(String(daysToMaturity).replace(/^(\d+).*/, "$1"), 10)
                : undefined;
            const harvestDays =
              typeof harvestDaysNum === "number" && harvestDaysNum > 0 && harvestDaysNum < 365 ? harvestDaysNum : undefined;
            console.log(`[PASS 1] Tier 1 cache hit for ${url.slice(0, 60)}...`);
            return NextResponse.json({
              type: (ed.type as string) ?? "Imported seed",
              variety: (ed.variety as string) ?? "",
              vendor: (ed.vendor as string) ?? "",
              tags: (ed.tags as string[]) ?? [],
              source_url: (ed.source_url as string) ?? url,
              sowing_depth: (ed.sowing_depth as string) ?? undefined,
              spacing: spacingVal ?? undefined,
              sun_requirement: sunReq ?? undefined,
              days_to_germination: (ed.days_to_germination as string) ?? undefined,
              days_to_maturity: daysToMaturity,
              scientific_name: (ed.scientific_name as string) ?? undefined,
              plant_description: (ed.plant_description as string) ?? undefined,
              hero_image_url: heroUrl || undefined,
              stock_photo_url: heroUrl || undefined,
              failed: false,
              cached: true,
              productPageStatus: 200,
              sun: sunReq ?? undefined,
              plant_spacing: spacingVal ?? undefined,
              harvest_days: harvestDays,
              water: (ed.water as string)?.trim() || undefined,
            });
          }
        }
      } catch (e) {
        // Cache miss or error — fall through to normal extraction
        console.log("[PASS 1] Tier 1 cache check failed, proceeding normally:", (e instanceof Error ? e.message : String(e)));
      }
    }

    // Tier 0.5: identity + vendor lookup (same plant+variety from same vendor in cache; most specific match)
    // When URL cache misses, try URL-derived type/variety/vendor so we can reuse cache from another URL.
    if (cacheToken) {
      try {
        const prefill = parseSeedFromImportUrl(url);
        const vendor = (prefill.vendor ?? getVendorFromUrl(url)).trim();
        const name = (prefill.name ?? "").trim() || "Imported seed";
        const variety = (prefill.variety ?? "").trim();
        const identityKey = identityKeyFromVariety(name, variety);
        if (identityKey && vendor) {
          const sbGlobal = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${cacheToken}` } },
          });
          const { data: rows, error: tier05Error } = await sbGlobal
            .from("global_plant_cache")
            .select("id, extract_data, original_hero_url, vendor, scrape_quality, updated_at")
            .eq("identity_key", identityKey)
            .limit(10);
          if (!tier05Error && rows?.length) {
            const vendorKey = normalizeVendorKey(vendor);
            const filtered =
              vendorKey && rows.length > 1
                ? rows.filter((r: { vendor?: string | null }) => normalizeVendorKey((r.vendor ?? "")) === vendorKey)
                : rows;
            const toSort = filtered.length > 0 ? filtered : rows;
            const sorted = [...toSort].sort((a, b) => {
              const qA = qualityRank((a as { scrape_quality?: string }).scrape_quality ?? "");
              const qB = qualityRank((b as { scrape_quality?: string }).scrape_quality ?? "");
              if (qB !== qA) return qB - qA;
              const tA = new Date((a as { updated_at?: string }).updated_at ?? 0).getTime();
              const tB = new Date((b as { updated_at?: string }).updated_at ?? 0).getTime();
              return tB - tA;
            });
            const row = sorted[0] as { extract_data: Record<string, unknown>; original_hero_url?: string | null };
            const ed = row.extract_data ?? {};
            const heroFromRow =
              (row.original_hero_url as string)?.trim() ||
              (typeof ed.hero_image_url === "string" && ed.hero_image_url.trim()) ||
              "";
            let heroUrl = heroFromRow.startsWith("http") ? heroFromRow : "";
            if (heroUrl && !(await checkImageAccessible(heroUrl))) heroUrl = "";
            const sunReq = (ed.sun_requirement as string) ?? (ed.sun as string);
            const spacingVal = (ed.spacing as string) ?? (ed.plant_spacing as string);
            const daysToMaturity = (ed.days_to_maturity as string) ?? undefined;
            const harvestDaysNum =
              typeof ed.harvest_days === "number" && Number.isFinite(ed.harvest_days)
                ? ed.harvest_days
                : daysToMaturity != null
                  ? parseInt(String(daysToMaturity).replace(/^(\d+).*/, "$1"), 10)
                  : undefined;
            const harvestDays =
              typeof harvestDaysNum === "number" && harvestDaysNum > 0 && harvestDaysNum < 365 ? harvestDaysNum : undefined;
            console.log(`[PASS 1] Tier 0.5 identity+vendor cache hit for ${url.slice(0, 60)}...`);
            return NextResponse.json({
              type: (ed.type as string) ?? "Imported seed",
              variety: (ed.variety as string) ?? "",
              vendor: (ed.vendor as string) ?? vendor,
              tags: (ed.tags as string[]) ?? [],
              source_url: url,
              sowing_depth: (ed.sowing_depth as string) ?? undefined,
              spacing: spacingVal ?? undefined,
              sun_requirement: sunReq ?? undefined,
              days_to_germination: (ed.days_to_germination as string) ?? undefined,
              days_to_maturity: daysToMaturity,
              scientific_name: (ed.scientific_name as string) ?? undefined,
              plant_description: (ed.plant_description as string) ?? undefined,
              hero_image_url: heroUrl || undefined,
              stock_photo_url: heroUrl || undefined,
              failed: false,
              cached: true,
              productPageStatus: 200,
              sun: sunReq ?? undefined,
              plant_spacing: spacingVal ?? undefined,
              harvest_days: harvestDays,
              water: (ed.water as string)?.trim() || undefined,
            });
          }
        }
      } catch (e) {
        console.log("[PASS 1] Tier 0.5 identity+vendor check failed, proceeding:", (e instanceof Error ? e.message : String(e)));
      }
    }

    // Canonical extractor: scrape-url (same logic as bulk-scrape / cache) so link import matches cache
    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      (typeof process.env.VERCEL_URL === "string" ? `https://${process.env.VERCEL_URL}` : null) ||
      (() => {
        try {
          return new URL(req.url).origin;
        } catch {
          return "http://localhost:3000";
        }
      })();
    const scrapeUrlEndpoint = `${origin}/api/seed/scrape-url`;
    let scrapeResult: Record<string, unknown> | null = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SCRAPE_URL_TIMEOUT_MS);
      const scrapeRes = await fetch(scrapeUrlEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (scrapeRes.ok) {
        const data = (await scrapeRes.json().catch(() => null)) as Record<string, unknown> | null;
        if (data && !data.error) {
          const type = (data.plant_name ?? data.type ?? "") as string;
          const variety = (data.variety_name ?? data.variety ?? "") as string;
          const vendor = (data.vendor_name ?? data.vendor ?? "") as string;
          if (type?.trim() || variety?.trim()) {
            scrapeResult = data;
            console.log(`[PASS 1] Canonical scrape-url success for ${url.slice(0, 60)}...`);
          }
        }
      }
    } catch (e) {
      console.log("[PASS 1] scrape-url attempt failed, falling back to AI extraction:", (e instanceof Error ? e.message : String(e)));
    }

    if (scrapeResult) {
      const type = String(scrapeResult.plant_name ?? scrapeResult.type ?? "Imported seed").trim() || "Imported seed";
      const variety = String(scrapeResult.variety_name ?? scrapeResult.variety ?? "").trim();
      const vendor = String(scrapeResult.vendor_name ?? scrapeResult.vendor ?? "").trim();
      const sunReq = (scrapeResult.sun_requirement ?? scrapeResult.sun) as string | undefined;
      const spacing = (scrapeResult.spacing ?? scrapeResult.plant_spacing) as string | undefined;
      const harvestDays = scrapeResult.harvest_days as number | undefined;
      const daysToMaturity = harvestDays != null && Number.isFinite(harvestDays) ? String(harvestDays) : undefined;
      const heroUrl = (scrapeResult.hero_image_url ?? scrapeResult.stock_photo_url ?? scrapeResult.imageUrl) as string | undefined;
      const blocked = await getBlockedTagsForRequest(req);
      const tags = filterBlockedTags((Array.isArray(scrapeResult.tags) ? scrapeResult.tags : []) as string[], blocked);
      return NextResponse.json({
        type,
        variety,
        vendor: vendor || undefined,
        tags,
        source_url: url,
        sowing_depth: (scrapeResult.sowing_depth as string) ?? undefined,
        spacing: spacing ?? undefined,
        sun_requirement: sunReq ?? undefined,
        days_to_germination: (scrapeResult.days_to_germination as string) ?? undefined,
        days_to_maturity: daysToMaturity,
        scientific_name: (scrapeResult.scientific_name as string) ?? undefined,
        plant_description: (scrapeResult.plant_description as string) ?? undefined,
        hero_image_url: heroUrl?.startsWith("http") ? heroUrl : undefined,
        stock_photo_url: heroUrl?.startsWith("http") ? heroUrl : undefined,
        failed: false,
        cached: false,
        productPageStatus: 200,
        sun: sunReq ?? undefined,
        plant_spacing: spacing ?? undefined,
        harvest_days: harvestDays,
        water: (scrapeResult.water as string)?.trim() || undefined,
      } as ExtractResponse & { failed: false; cached: boolean; productPageStatus?: number });
    }

    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: "GOOGLE_GENERATIVE_AI_API_KEY not configured" },
        { status: 503 }
      );
    }

    if (isFirstInBatch && batchTotal != null) {
      console.log(`[PASS 1] Scraping ${batchTotal} links...`);
    }
    const batchLabel =
      batchTotal != null && batchIndex != null
        ? ` ${batchIndex + 1}/${batchTotal}`
        : "";
    console.log(`[PASS 1] Scraping link${batchLabel}: ${url.slice(0, 60)}... (AI fallback)`);

    let pageFetch: PageFetchResult | null = null;
    let result: Awaited<ReturnType<typeof extractFromUrl>> = null;

    if (skipProductPageFetch) {
      result = await Promise.race([
        extractFromUrl(apiKey, url),
        new Promise<null>((_, reject) =>
          setTimeout(() => reject(new Error("PASS1_TIMEOUT")), PASS1_TIMEOUT_MS)
        ),
      ]).catch(() => null);
    } else {
      const [fetchResult, extractResult] = await Promise.all([
        productImageFromPage(url),
        Promise.race([
          extractFromUrl(apiKey, url),
          new Promise<null>((_, reject) =>
            setTimeout(() => reject(new Error("PASS1_TIMEOUT")), PASS1_TIMEOUT_MS)
          ),
        ]).catch(() => null),
      ]);
      pageFetch = fetchResult;
      result = extractResult;
    }

    const pageResult = pageFetch?.pageResult ?? null;
    const titleFromPage = pageFetch?.titleFromPage ?? null;

    const productPageStatus =
      pageResult && typeof pageResult === "object" && "productPageStatus" in pageResult
        ? (pageResult as { productPageStatus: number }).productPageStatus
        : null;

    if (pageResult && typeof pageResult === "object" && "linkDead" in pageResult) {
      return NextResponse.json(
        { error: "LINK_NOT_FOUND", status: 404, productPageStatus: productPageStatus ?? 404 },
        { status: 404 }
      );
    }
    if (pageResult && typeof pageResult === "object" && "rateLimited" in pageResult) {
      return NextResponse.json(
        { error: "RATE_LIMITED", status: 429, productPageStatus: productPageStatus ?? 429 },
        { status: 429 }
      );
    }

    /*
     * Order of operations (see SEED_RULES.md). Insert new steps in the right place.
     * 1. Decode HTML entities (vendor, type, variety)
     * 2. Vendor overrides (Rare Seeds)
     * 3. Blocked tags
     * 4. Generic flower inference
     * 5. Host
     * 6. Renee's Garden (title → type/variety)
     * 7. Outside Pride / San Diego (plantFromSegmentBeforeProduct; if segment is generic e.g. Silver, use plantFromProductSlug; else plantFromUrlSlug for OP when type empty)
     * 7.5. Generic flower + URL segment (if type still generic flower, set from plantFromSegmentBeforeProduct when segment not generic)
     * 8. Strip plant from variety (boundary-only)
     * 9. Catalog number strip
     * 10. Hudson Valley vendor
     * 11. Title-priority hosts (Johnny's, Outside Pride, San Diego)
     * 11.5. Final scrub: strip plant from variety again (so title override never leaves variety starting/ending with plant name)
     * 12. cleanVarietyForDisplay
     * 13. Generic trap / junk variety
     * 14. Hero image from page
     * 15. Return
     */
    if (result) {
      result.vendor = decodeHtmlEntities(result.vendor ?? "") || (result.vendor ?? "");
      result.type = decodeHtmlEntities(result.type ?? "") || (result.type ?? "") || "Imported seed";
      result.variety = decodeHtmlEntities(result.variety ?? "") || (result.variety ?? "");

      const urlVendor = getVendorFromUrl(url);
      if (urlVendor !== "Vendor") result.vendor = urlVendor;
      const blocked = await getBlockedTagsForRequest(req);
      result.tags = filterBlockedTags(result.tags ?? [], blocked);
      const typeLower = (result.type ?? "").trim().toLowerCase();
      const isGenericFlower =
        typeLower === "flower" ||
        typeLower === "flower seed" ||
        typeLower === "flowers" ||
        (typeLower.startsWith("flower") && typeLower.length <= 20);
      if (isGenericFlower) {
        const specific = inferSpecificPlantFromVariety(result.variety ?? "");
        if (specific) result.type = specific;
      }
      const host = (() => {
        try {
          return new URL(url).hostname.toLowerCase();
        } catch {
          return "";
        }
      })();

      if (host.includes("reneesgarden.com") && titleFromPage?.trim()) {
        const parts = titleFromPage.trim().split(/\s+/);
        if (parts.length >= 1) {
          result.type = (result.type || parts[0]) ?? "";
          if (parts.length > 1) result.variety = (result.variety || parts.slice(1).join(" ").trim()) || "";
        }
      }
      if (host.includes("outsidepride.com") || host.includes("sandiegoseed")) {
        const fromSegment = plantFromSegmentBeforeProduct(url);
        let typeFromUrl = fromSegment;
        if (fromSegment && isGenericSegmentForPlant(fromSegment)) {
          const fromProduct = plantFromProductSlug(url);
          if (fromProduct) typeFromUrl = fromProduct;
        }
        if (typeFromUrl) {
          result.type = (result.type ?? "").trim() || typeFromUrl;
        } else if (host.includes("outsidepride.com") && !(result.type ?? "").trim()) {
          const fromSlug = plantFromUrlSlug(url);
          if (fromSlug) result.type = fromSlug;
        }
      }
      // Before Step 8: if type is still generic flower (e.g. variety had no plant name), try URL segment so stripPlantFromVariety gets the right type (e.g. Sweet Pea from .../sweet-pea/...).
      const typeStillGenericFlower =
        (result.type ?? "").trim().toLowerCase() === "flower" ||
        (result.type ?? "").trim().toLowerCase() === "flower seed" ||
        (result.type ?? "").trim().toLowerCase() === "flowers" ||
        ((result.type ?? "").trim().toLowerCase().startsWith("flower") && (result.type ?? "").trim().length <= 20);
      if (typeStillGenericFlower) {
        const fromUrlSegment = plantFromSegmentBeforeProduct(url);
        const urlSegmentLower = fromUrlSegment.trim().toLowerCase().replace(/\s+/g, " ");
        const genericSlug = /^(flower|flowers|flower\s+seed|flower\s+seeds)$/;
        if (fromUrlSegment.trim() && !genericSlug.test(urlSegmentLower)) {
          result.type = fromUrlSegment.trim();
        }
      }

      result.variety = stripPlantFromVariety(result.variety ?? "", result.type ?? "");
      result.variety = (result.variety ?? "").replace(/\s+\d{3,4}$/, "").trim();

      const useTitlePriority = TITLE_PRIORITY_HOSTS.some((h) => host.includes(h));
      // Host-based override: Johnny's / San Diego — if getTitleFromHtml returned a generic trap name, force Pass 2/3
      if (useTitlePriority && titleFromPage?.trim() && isGenericTrapName(titleFromPage)) {
        return NextResponse.json({
          ...result,
          variety: result.variety ?? titleFromPage.trim() ?? varietySlugFromUrl(url),
          failed: true,
          triggerAiSearchForName: true,
          productPageStatus: productPageStatus ?? undefined,
        } as ExtractResponse & { failed: true; triggerAiSearchForName?: boolean; productPageStatus?: number });
      }
      if (useTitlePriority && titleFromPage?.trim()) {
        if (!isJunkTitle(titleFromPage)) {
          result.variety = titleFromPage.trim();
        } else {
          if (isJunkTitle(result.variety) || !(result.variety ?? "").trim()) {
            return NextResponse.json({
              ...result,
              variety: result.variety ?? varietySlugFromUrl(url),
              failed: true,
              triggerAiSearchForName: true,
              productPageStatus: productPageStatus ?? undefined,
            } as ExtractResponse & { failed: true; triggerAiSearchForName?: boolean; productPageStatus?: number });
          }
        }
      }
      // Final scrub: variety must not start/end with plant name after any vendor/title override (Step 11.5)
      result.variety = stripPlantFromVariety(result.variety ?? "", result.type ?? "");
      const { cleanedVariety, tagsToAdd } = cleanVarietyForDisplay(result.variety ?? "", result.type ?? "");
      result.variety = cleanedVariety;
      if (tagsToAdd.length > 0) {
        result.tags = Array.from(new Set([...(result.tags ?? []), ...tagsToAdd]));
      }
      if (isGenericTrapName(result.variety)) {
        return NextResponse.json({
          ...result,
          failed: true,
          triggerAiSearchForName: true,
          productPageStatus: productPageStatus ?? undefined,
        } as ExtractResponse & { failed: true; triggerAiSearchForName?: boolean; productPageStatus?: number });
      }
      if (isJunkTitle(result.variety)) {
        const slugVariety = varietySlugFromUrl(url);
        if (slugVariety && !isJunkTitle(slugVariety)) {
          result.variety = slugVariety;
        } else {
          return NextResponse.json({
            ...result,
            variety: result.variety ?? slugVariety,
            failed: true,
            triggerAiSearchForName: true,
            productPageStatus: productPageStatus ?? undefined,
          } as ExtractResponse & { failed: true; triggerAiSearchForName?: boolean; productPageStatus?: number });
        }
      }
      const imageUrl =
        pageResult && typeof pageResult === "object" && "imageUrl" in pageResult
          ? (pageResult as { imageUrl: string | null }).imageUrl
          : null;
      if (typeof imageUrl === "string" && imageUrl.startsWith("http")) {
        result.hero_image_url = imageUrl;
        result.stock_photo_url = imageUrl;
      }
      return NextResponse.json({
        ...result,
        failed: false,
        productPageStatus: productPageStatus ?? undefined,
      } as ExtractResponse & { failed: false; productPageStatus?: number });
    }

    const variety = varietySlugFromUrl(url);
    const vendor = getVendorFromUrl(url);
    const fallback: ExtractResponse & { failed: true } = {
      failed: true,
      vendor,
      type: "Imported seed",
      variety,
      tags: [],
      source_url: url,
    };
    return NextResponse.json({ ...fallback, productPageStatus: productPageStatus ?? undefined });
  } catch (e) {
    console.error("[PASS 1] extract-metadata error:", e);
    const message = e instanceof Error ? e.message : "Metadata extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
