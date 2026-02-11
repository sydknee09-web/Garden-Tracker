/**
 * Bulk-test seed scrapers against local /api/seed/scrape-url.
 * Run: npx ts-node scripts/test-scrapers.ts
 * Ensure dev server is running: npm run dev
 */

const BASE_URL = process.env.SCRAPE_TEST_BASE_URL ?? "http://localhost:3000";
const API_PATH = "/api/seed/scrape-url";

/**
 * URL_LIST: Paste this into scripts/test-scrapers.ts
 * Includes diverse vendors for stress-testing the Surgical Scraper (Plan A)
 * and the AI Search Fallback (Plan B).
 */
const URL_LIST: string[] = [
  "https://www.rareseeds.com/marigold-kilimanjaro-white",
  "https://www.johnnyseeds.com/vegetables/tomatoes/cherry-tomatoes/sun-gold-f1-tomato-seed-770.html",
  "https://www.burpee.com/corn-bodacious-hybrid-prod000669.html",
  "https://territorialseed.com/products/carrot-napoli",
  "https://www.marysheirloomseeds.com/collections/heirloom-beets/products/bulls-blood-beet",
  "https://www.growitalian.com/tomato-san-marzano-redorta-106-94/",
  "https://www.outsidepride.com/seed/fruit-seed/banana-velutina.html",
  "https://www.highmowingseeds.com/organic-non-gmo-burgundy-okra.html",
  "https://www.botanicalinterests.com/products/zinnia-benarys-giant-mix-seeds",
  "https://www.edenbrothers.com/products/sunflower-seeds-autumn-beauty",
  "https://sandiegoseedcompany.com/product/vegetables/cool-season-vegetables/beets/bulls-blood-beet-seeds/",
  "https://migardener.com/products/tomato-brad-s-atomic-grape",
  "https://www.superseeds.com/products/black-beauty-zucchini-squash",
  "https://www.seedsavers.org/painted-lady-organic-bean",
  "https://sowrightseeds.com/products/cucumber-marketmore-76-seeds",
  "https://www.victoryseeds.com/tomato_dwarf-giant.html",
  "https://www.selectseeds.com/sweet-peas/sweet_pea_cupani_original_seeds.aspx",
  "https://www.fedcoseeds.com/seeds/king-of-the-north-sweet-pepper-3313",
  "https://hudsonvalleyseed.com/products/kaleidoscope-carrots",
  "https://www.floretflowers.com/product/zinnia-mazurkia/"
];

/** Scraped fields we care about for "fields found" column. */
const SCRAPED_FIELDS = [
  "sun",
  "water",
  "plant_spacing",
  "days_to_germination",
  "harvest_days",
  "plant_description",
  "growing_notes",
  "imageUrl",
  "latin_name",
  "life_cycle",
  "hybrid_status",
  "ogTitle",
] as const;

type ScrapeStatus = "Success" | "Partial" | "AI_SEARCH" | "Failed";

interface Row {
  url: string;
  vendor: string;
  status: ScrapeStatus;
  fieldsFound: string;
  note?: string;
}

function getVendor(urlString: string): string {
  try {
    const host = new URL(urlString).hostname.toLowerCase().replace(/^www\./, "");
    return host;
  } catch {
    return "?";
  }
}

function truncateUrl(url: string, maxLen: number = 56): string {
  if (url.length <= maxLen) return url;
  return url.slice(0, maxLen - 3) + "...";
}

function collectFieldsFound(data: Record<string, unknown>): string[] {
  const found: string[] = [];
  for (const key of SCRAPED_FIELDS) {
    const v = data[key];
    if (v == null) continue;
    if (typeof v === "string" && v.trim()) found.push(key);
    if (typeof v === "number" && !Number.isNaN(v)) found.push(key);
    if (typeof v === "object" && key === "imageUrl" && v) found.push(key);
  }
  return found;
}

function is404Block(data: Record<string, unknown>, res: { status: number }): boolean {
  const msg = [data.error, data.scrape_error_log].filter(Boolean).join(" ");
  return res.status === 404 || /Page returned 404|404|blocked|forbidden/i.test(String(msg));
}

function printTable(rows: Row[]): void {
  const colUrl = "URL";
  const colVendor = "Vendor";
  const colStatus = "Status";
  const colFields = "Fields found";
  const colNote = "Note";

  const maxUrl = Math.max(colUrl.length, ...rows.map((r) => truncateUrl(r.url).length), 20);
  const maxVendor = Math.max(colVendor.length, ...rows.map((r) => r.vendor.length), 10);
  const maxStatus = Math.max(colStatus.length, ...rows.map((r) => r.status.length), 9);
  const maxFields = Math.max(colFields.length, ...rows.map((r) => r.fieldsFound.length), 12);
  const maxNote = Math.max(colNote.length, ...rows.map((r) => (r.note ?? "").length), 10);

  const pad = (s: string, n: number) => s.padEnd(n);
  const sep = "  ";

  console.log("\n" + pad(colUrl, maxUrl) + sep + pad(colVendor, maxVendor) + sep + pad(colStatus, maxStatus) + sep + pad(colFields, maxFields) + (maxNote > 0 ? sep + colNote : ""));
  console.log("-".repeat(maxUrl + sep.length * 3 + maxVendor + maxStatus + maxFields + (maxNote > 0 ? maxNote + sep.length : 0)));

  for (const r of rows) {
    const urlCell = truncateUrl(r.url, 60);
    const noteCell = r.note ?? "";
    console.log(
      pad(urlCell, maxUrl) +
        sep +
        pad(r.vendor, maxVendor) +
        sep +
        pad(r.status, maxStatus) +
        sep +
        pad(r.fieldsFound || "—", maxFields) +
        (maxNote > 0 ? sep + noteCell : "")
    );
  }
  console.log("");
}

async function testOne(urlString: string): Promise<Row> {
  const vendor = getVendor(urlString);
  const url = urlString.trim();
  if (!url.startsWith("http")) {
    return { url: truncateUrl(url), vendor, status: "Failed", fieldsFound: "", note: "Invalid URL (missing http)" };
  }

  try {
    const res = await fetch(BASE_URL + API_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const apiStatus = data.scrape_status as string | undefined;
    const status: ScrapeStatus =
      apiStatus === "Success" || apiStatus === "Partial" || apiStatus === "AI_SEARCH"
        ? apiStatus
        : res.ok
          ? "Partial"
          : "Failed";
    const fieldsFound = res.ok ? collectFieldsFound(data).join(", ") : "";
    const effectiveStatus: ScrapeStatus = !res.ok ? "Failed" : status;

    let note: string | undefined;
    if (effectiveStatus === "Failed") {
      const errMsg = [data.error, data.scrape_error_log].filter(Boolean).join(" ").trim() || `HTTP ${res.status}`;
      note = errMsg;
      if (is404Block(data, res) || /Page returned 404|404/.test(errMsg)) {
        note += " [Possible block/404: consider adjusting User-Agent for this vendor in route.ts]";
      }
    }

    return {
      url: truncateUrl(url),
      vendor,
      status: effectiveStatus,
      fieldsFound,
      note,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const isRefused = /ECONNREFUSED|fetch failed/i.test(message);
    return {
      url: truncateUrl(url),
      vendor,
      status: "Failed",
      fieldsFound: "",
      note: isRefused ? "Connection refused. Is the dev server running (npm run dev)?" : message,
    };
  }
}

async function main(): Promise<void> {
  const urls = URL_LIST.filter((u) => typeof u === "string" && u.trim().length > 0);
  if (urls.length === 0) {
    console.log("No URLs in URL_LIST. Edit scripts/test-scrapers.ts and add your URLs (e.g. from Excel).");
    console.log("Example: const URL_LIST = [ \"https://www.johnnyseeds.com/...\", ];");
    process.exit(1);
  }

  console.log(`Testing ${urls.length} URL(s) against ${BASE_URL}${API_PATH}\n`);

  const PROGRESS_WIDTH = 100;
  const rows: Row[] = [];
  for (let i = 0; i < urls.length; i++) {
    const progressMsg = `[${String(i + 1).padStart(2)}/${urls.length}] ${truncateUrl(urls[i], 70)}`;
    process.stderr.write("\r" + " ".repeat(PROGRESS_WIDTH) + "\r" + progressMsg.padEnd(PROGRESS_WIDTH));
    const row = await testOne(urls[i]);
    rows.push(row);
  }
  process.stderr.write("\r" + " ".repeat(PROGRESS_WIDTH) + "\r");

  printTable(rows);

  const success = rows.filter((r) => r.status === "Success").length;
  const partial = rows.filter((r) => r.status === "Partial").length;
  const aiSearch = rows.filter((r) => r.status === "AI_SEARCH").length;
  const failed = rows.filter((r) => r.status === "Failed").length;
  console.log(`Summary: ${success} Success, ${partial} Partial, ${aiSearch} AI_SEARCH, ${failed} Failed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
