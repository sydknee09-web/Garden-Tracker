/**
 * discover-urls.ts — Crawl all 27 supported vendors to discover product page URLs.
 *
 * Strategy priority per vendor:
 *   1. Shopify /products.json  (fast, structured, zero HTML parsing)
 *   2. Sitemap.xml parsing     (filter for product paths)
 *   3. Catalog page crawl      (follow category links, extract <a> hrefs)
 *
 * Output: data/vendor-urls.json
 *
 * Run:  npx ts-node scripts/discover-urls.ts
 *       npx ts-node scripts/discover-urls.ts --vendor rareseeds.com
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Vendor list (mirrors ALLOWED_HOST_ROOTS in scrape-url/route.ts) ──────────
const VENDORS = [
  "johnnyseeds.com",
  "rareseeds.com",
  "marysheirloomseeds.com",
  "territorialseed.com",
  "burpee.com",
  "highmowingseeds.com",
  "botanicalinterests.com",
  "edenbrothers.com",
  "parkseed.com",
  "outsidepride.com",
  "swallowtailgardenseeds.com",
  "superseeds.com",
  "sowrightseeds.com",
  "sandiegoseedcompany.com",
  "victoryseeds.com",
  "hudsonvalleyseed.com",
  "southernexposure.com",
  "fedcoseeds.com",
  "floretflowers.com",
  "reneesgarden.com",
  "theodorepayne.org",
  "nativewest.com",
  "growitalian.com",
  "migardener.com",
  "row7seeds.com",
  "seedsavers.org",
  "selectseeds.com",
];

// ── User agents (consistent with scraper) ────────────────────────────────────
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
];

function pickUA(domain: string): string {
  const hash = domain.split("").reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0);
  return USER_AGENTS[Math.abs(hash) % USER_AGENTS.length]!;
}

/** Jittered delay: base + random additional ms */
function jitteredDelay(baseMs: number, jitterMs: number): Promise<void> {
  const ms = baseMs + Math.random() * jitterMs;
  return new Promise((r) => setTimeout(r, ms));
}

// ── Path heuristics: filter out non-product URLs ─────────────────────────────
const JUNK_PATH_PATTERNS = [
  /\/cart/i, /\/account/i, /\/blog/i, /\/pages\//i, /\/policies\//i,
  /\/gift[-_]?card/i, /\/merch/i, /\/apparel/i, /\/tool/i, /\/book/i,
  /\/workshop/i, /\/class/i, /\/event/i, /\/subscription/i,
  /\.pdf$/i, /\.jpg$/i, /\.png$/i, /\.xml$/i,
  /\/collections\/?$/i, /\/products\/?$/i,
  // Articles, how-to, resources (not seed product pages)
  /\/resources\//i, /\/how-to[- ]/i, /\/growing-milkweed-from-seed/i,
  /\/gallery/i, /\/seed-swap/i, /\/ask-the-experts/i,
  // Floret directory (Farmer-Florist Collective, etc.) — informative, not product
  /\/directory\//i,
  // Floret-style blog/editorial slugs (no /blog/ prefix)
  /\/the-seasonal-flower/i, /\/this-moment-/i, /\/pretty-in-pink/i,
  /\/super-green-love/i, /\/behind-the-scenes/i, /\/reasons-love/i, /\/bouquet-mania/i,
  // Non-seed products: merch, soap, hat, tunnel, mushroom kit, display, recipe book, apron, grow bags, broadfork, fertilizer
  /\/liquid-hand-soap/i, /\/trucker-mesh-hat/i, /\/easy-net-tunnel/i,
  /\/mushroom-fruiting/i, /\/wholesale-display-stand/i,
  /\/botanical-teas-recipe-book/i, /\/pickled-pantry/i, /\/find-me-in-the-garden-apron/i,
  /\/grow-bags-lined/i, /\/broadfork/i, /\/digital-gift-card/i,
  /\/vegetable-garden-mix-mini/i,
  // Mary's / general merch: shirts, trays, earrings, gift baskets, plant markers, coffee combo, seed box gift, books
  /\/shirt/i, /\/v-neck/i, /\/germination-tray/i, /\/earring/i, /\/gift-basket/i,
  /\/plant-marker/i, /\/fermented-vegetables/i, /\/cup-coffee-combo/i,
  /\/seed-box-gift-pack/i,
  // Territorial / other: hanging basket, hose nozzle
  /\/hanging-basket/i, /\/hose-nozzle/i,
];

function isProductUrl(urlStr: string, domain: string): boolean {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(domain.replace(/^www\./, ""))) return false;
    const p = u.pathname.toLowerCase();
    if (p === "/" || p === "") return false;
    if (JUNK_PATH_PATTERNS.some((rx) => rx.test(p))) return false;
    // Must look like a product page (has a slug segment)
    const segments = p.split("/").filter(Boolean);
    if (segments.length === 0) return false;
    return true;
  } catch {
    return false;
  }
}

/** Normalize URL: strip trailing slash, strip query params, lowercase */
function normalizeUrl(urlStr: string): string {
  try {
    const u = new URL(urlStr);
    u.search = "";
    u.hash = "";
    let p = u.pathname;
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    u.pathname = p;
    return u.href.toLowerCase();
  } catch {
    return urlStr.toLowerCase().replace(/\/$/, "");
  }
}

// ── Fetch helper ─────────────────────────────────────────────────────────────
async function safeFetch(
  url: string,
  domain: string,
  timeoutMs = 15_000
): Promise<{ ok: boolean; status: number; text: string; headers: Headers }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": pickUA(domain),
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://www.google.com/",
      },
    });
    const text = await res.text();
    clearTimeout(timer);
    return { ok: res.ok, status: res.status, text, headers: res.headers };
  } catch (err) {
    clearTimeout(timer);
    return { ok: false, status: 0, text: "", headers: new Headers() };
  }
}

// ── Strategy 1: Shopify /products.json ───────────────────────────────────────
async function tryShopifyJson(domain: string): Promise<string[] | null> {
  const baseUrl = `https://www.${domain}`;
  const testUrl = `${baseUrl}/products.json?limit=1&page=1`;
  const probe = await safeFetch(testUrl, domain, 10_000);

  // Check if it's actually Shopify JSON
  if (!probe.ok) return null;
  try {
    const json = JSON.parse(probe.text);
    if (!json.products || !Array.isArray(json.products)) return null;
  } catch {
    return null;
  }

  console.log(`  [Shopify JSON] Detected for ${domain}, paginating...`);
  const urls: string[] = [];
  let page = 1;
  const LIMIT = 250;

  while (true) {
    const pageUrl = `${baseUrl}/products.json?limit=${LIMIT}&page=${page}`;
    if (page > 1) await jitteredDelay(1500, 1500);

    const res = await safeFetch(pageUrl, domain, 20_000);
    if (!res.ok) break;

    let products: { handle?: string }[] = [];
    try {
      const json = JSON.parse(res.text);
      products = json.products ?? [];
    } catch {
      break;
    }

    if (products.length === 0) break;

    for (const p of products) {
      if (p.handle) {
        const productUrl = `${baseUrl}/products/${p.handle}`;
        if (isProductUrl(productUrl, domain)) {
          urls.push(normalizeUrl(productUrl));
        }
      }
    }

    console.log(`    Page ${page}: ${products.length} products (${urls.length} total)`);

    if (products.length < LIMIT) break;
    page++;

    // Safety cap: 100 pages = 25,000 products max
    if (page > 100) {
      console.log(`    Hit safety cap (100 pages) for ${domain}`);
      break;
    }
  }

  return urls.length > 0 ? urls : null;
}

// ── Strategy 2: Sitemap XML ──────────────────────────────────────────────────
const SITEMAP_PATHS = [
  "/sitemap.xml",
  "/sitemap_products_1.xml",
  "/sitemap_products.xml",
  "/sitemap-products.xml",
  "/sitemap_index.xml",
];

/** Simple regex-based XML URL extractor (no XML parser dep needed) */
function extractUrlsFromXml(xml: string): string[] {
  const urls: string[] = [];
  const locRegex = /<loc>\s*(https?:\/\/[^<]+?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = locRegex.exec(xml)) !== null) {
    urls.push(match[1]!);
  }
  return urls;
}

async function trySitemap(domain: string): Promise<string[] | null> {
  const baseUrl = `https://www.${domain}`;
  let allSitemapUrls: string[] = [];

  for (const sitemapPath of SITEMAP_PATHS) {
    const sitemapUrl = `${baseUrl}${sitemapPath}`;
    await jitteredDelay(1500, 1500);
    const res = await safeFetch(sitemapUrl, domain, 15_000);
    if (!res.ok) continue;

    const extracted = extractUrlsFromXml(res.text);
    if (extracted.length === 0) continue;

    // Check if this is a sitemap index (contains references to other sitemaps)
    const childSitemaps = extracted.filter((u) => u.endsWith(".xml"));
    const productUrls = extracted.filter((u) => !u.endsWith(".xml"));

    allSitemapUrls.push(...productUrls);

    // Follow child sitemaps (up to 20)
    for (const childUrl of childSitemaps.slice(0, 20)) {
      await jitteredDelay(1500, 1500);
      const childRes = await safeFetch(childUrl, domain, 15_000);
      if (childRes.ok) {
        allSitemapUrls.push(...extractUrlsFromXml(childRes.text));
      }
    }

    if (allSitemapUrls.length > 0) {
      console.log(`  [Sitemap] Found ${allSitemapUrls.length} raw URLs from ${sitemapPath}`);
      break; // Use the first sitemap that works
    }
  }

  if (allSitemapUrls.length === 0) return null;

  // Filter for product-like URLs
  const productUrls = allSitemapUrls
    .map(normalizeUrl)
    .filter((u) => isProductUrl(u, domain));

  const deduped = [...new Set(productUrls)];
  console.log(`  [Sitemap] ${deduped.length} product URLs after filtering`);
  return deduped.length > 0 ? deduped : null;
}

// ── Strategy 3: Catalog page crawl (fallback) ────────────────────────────────
const CATALOG_PATHS = [
  "/collections", "/collections/all", "/products", "/shop",
  "/seeds", "/seed", "/vegetables", "/flowers", "/herbs",
  "/catalog", "/store",
];

function extractLinksFromHtml(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRegex.exec(html)) !== null) {
    const href = match[1]!;
    try {
      const absolute = new URL(href, baseUrl).href;
      urls.push(absolute);
    } catch {
      // skip malformed
    }
  }
  return urls;
}

async function tryCatalogCrawl(domain: string): Promise<string[] | null> {
  const baseUrl = `https://www.${domain}`;
  const allUrls = new Set<string>();

  for (const catalogPath of CATALOG_PATHS) {
    const catalogUrl = `${baseUrl}${catalogPath}`;
    await jitteredDelay(1500, 1500);
    const res = await safeFetch(catalogUrl, domain, 15_000);
    if (!res.ok) continue;

    const links = extractLinksFromHtml(res.text, catalogUrl);
    const productLinks = links
      .map(normalizeUrl)
      .filter((u) => isProductUrl(u, domain));

    for (const u of productLinks) allUrls.add(u);

    if (productLinks.length > 0) {
      console.log(`  [Catalog] ${catalogPath}: ${productLinks.length} product links`);

      // Check for pagination (page=2, page=3, etc.)
      for (let pg = 2; pg <= 20; pg++) {
        const pageUrl = `${catalogUrl}?page=${pg}`;
        await jitteredDelay(1500, 1500);
        const pgRes = await safeFetch(pageUrl, domain, 15_000);
        if (!pgRes.ok) break;

        const pgLinks = extractLinksFromHtml(pgRes.text, pageUrl)
          .map(normalizeUrl)
          .filter((u) => isProductUrl(u, domain));

        if (pgLinks.length === 0) break;
        for (const u of pgLinks) allUrls.add(u);
        console.log(`    Page ${pg}: ${pgLinks.length} links (${allUrls.size} total)`);
      }
    }
  }

  const deduped = [...allUrls];
  console.log(`  [Catalog] ${deduped.length} product URLs total`);
  return deduped.length > 0 ? deduped : null;
}

// ── robots.txt check ─────────────────────────────────────────────────────────
async function checkRobotsTxt(domain: string): Promise<string[]> {
  const url = `https://www.${domain}/robots.txt`;
  const res = await safeFetch(url, domain, 8_000);
  if (!res.ok) return [];

  const disallowed: string[] = [];
  let inUserAgent = false;
  for (const line of res.text.split("\n")) {
    const trimmed = line.trim().toLowerCase();
    if (trimmed.startsWith("user-agent:")) {
      const agent = trimmed.slice("user-agent:".length).trim();
      inUserAgent = agent === "*";
    } else if (inUserAgent && trimmed.startsWith("disallow:")) {
      const path = trimmed.slice("disallow:".length).trim();
      if (path) disallowed.push(path);
    }
  }
  return disallowed;
}

function isDisallowed(urlStr: string, disallowed: string[]): boolean {
  if (disallowed.length === 0) return false;
  try {
    const p = new URL(urlStr).pathname.toLowerCase();
    return disallowed.some((d) => p.startsWith(d));
  } catch {
    return false;
  }
}

// ── Main discovery for one vendor ────────────────────────────────────────────
async function discoverVendor(domain: string): Promise<{ discovered: number; urls: string[]; strategy: string }> {
  console.log(`\n📦 ${domain}`);

  // Check robots.txt first
  const disallowed = await checkRobotsTxt(domain);
  if (disallowed.length > 0) {
    console.log(`  [robots.txt] ${disallowed.length} disallowed paths`);
  }

  // Try strategies in priority order
  let urls: string[] | null = null;
  let strategy = "none";

  // 1. Shopify JSON
  urls = await tryShopifyJson(domain);
  if (urls) {
    strategy = "shopify_json";
  }

  // 2. Sitemap
  if (!urls) {
    urls = await trySitemap(domain);
    if (urls) strategy = "sitemap";
  }

  // 3. Catalog crawl
  if (!urls) {
    urls = await tryCatalogCrawl(domain);
    if (urls) strategy = "catalog_crawl";
  }

  if (!urls) {
    console.log(`  ⚠ No product URLs found for ${domain}`);
    return { discovered: 0, urls: [], strategy: "none" };
  }

  // Filter out robots.txt disallowed paths
  const allowed = urls.filter((u) => !isDisallowed(u, disallowed));
  if (allowed.length < urls.length) {
    console.log(`  [robots.txt] Filtered ${urls.length - allowed.length} disallowed URLs`);
  }

  // Final dedup
  const deduped = [...new Set(allowed)];
  console.log(`  ✅ ${deduped.length} product URLs via ${strategy}`);
  return { discovered: deduped.length, urls: deduped, strategy };
}

// ── CLI + main ───────────────────────────────────────────────────────────────
interface VendorResult {
  discovered: number;
  urls: string[];
  strategy: string;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const vendorFlag = args.indexOf("--vendor");
  const targetVendor = vendorFlag >= 0 ? args[vendorFlag + 1] : undefined;

  const vendors = targetVendor
    ? VENDORS.filter((v) => v.includes(targetVendor))
    : VENDORS;

  if (vendors.length === 0) {
    console.error(`No vendor matching "${targetVendor}". Available: ${VENDORS.join(", ")}`);
    process.exit(1);
  }

  console.log(`\n🔍 Discovering product URLs for ${vendors.length} vendor(s)...\n`);

  // Load existing results to merge with (incremental runs)
  const outDir = path.join(__dirname, "..", "data");
  const outFile = path.join(outDir, "vendor-urls.json");

  let existing: Record<string, VendorResult> = {};
  try {
    if (fs.existsSync(outFile)) {
      existing = JSON.parse(fs.readFileSync(outFile, "utf-8"));
    }
  } catch {
    existing = {};
  }

  const results: Record<string, VendorResult> = { ...existing };
  let totalUrls = 0;

  for (const domain of vendors) {
    try {
      const result = await discoverVendor(domain);
      results[domain] = result;
      totalUrls += result.discovered;
    } catch (err) {
      console.error(`  ❌ Error for ${domain}:`, err instanceof Error ? err.message : String(err));
      results[domain] = { discovered: 0, urls: [], strategy: "error" };
    }
  }

  // Write output
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2), "utf-8");

  // Summary
  console.log("\n" + "=".repeat(70));
  console.log("DISCOVERY SUMMARY");
  console.log("=".repeat(70));

  const colDomain = "Vendor".padEnd(35);
  const colCount = "URLs".padStart(8);
  const colStrategy = "Strategy".padEnd(15);
  console.log(`${colDomain} ${colCount}  ${colStrategy}`);
  console.log("-".repeat(62));

  for (const domain of vendors) {
    const r = results[domain];
    if (!r) continue;
    console.log(
      `${domain.padEnd(35)} ${String(r.discovered).padStart(8)}  ${r.strategy.padEnd(15)}`
    );
  }

  console.log("-".repeat(62));
  console.log(`${"TOTAL".padEnd(35)} ${String(totalUrls).padStart(8)}`);
  console.log(`\nOutput: ${outFile}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
