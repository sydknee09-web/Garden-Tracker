/**
 * cleanup-bad-heroes.ts — Remove hero images from stock photo sites
 * that have watermarks (Shutterstock, Alamy, Dreamstime, etc.)
 *
 * Run:  npx tsx scripts/cleanup-bad-heroes.ts
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
const projectRoot = path.join(__dirname, "..");
const envPath = path.join(projectRoot, ".env.local");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (key && !process.env[key]) process.env[key] = value;
  }
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const USER_ID = (process.env.NEXT_PUBLIC_DEV_USER_ID ?? "").trim();

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !USER_ID) {
  console.error("ERROR: Missing SUPABASE_URL, SERVICE_ROLE_KEY, or DEV_USER_ID");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const BAD_DOMAINS = [
  "shutterstock.com",
  "alamy.com",
  "dreamstime.com",
  "istockphoto.com",
  "gettyimages.com",
  "123rf.com",
  "depositphotos.com",
  "stock.adobe.com",
];

async function main() {
  console.log("Scanning for hero images from watermarked stock photo sites...\n");

  const { data: profiles, error } = await supabase
    .from("plant_profiles")
    .select("id, name, variety_name, hero_image_url")
    .eq("user_id", USER_ID)
    .is("deleted_at", null)
    .not("hero_image_url", "is", null);

  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  const bad = (profiles ?? []).filter((p) => {
    const url = (p.hero_image_url ?? "").toLowerCase();
    return BAD_DOMAINS.some((domain) => url.includes(domain));
  });

  console.log(`Found ${profiles?.length ?? 0} profiles with hero URLs, ${bad.length} from bad stock photo sites.\n`);

  if (bad.length === 0) {
    console.log("Nothing to clean up.");
    return;
  }

  for (const p of bad) {
    const label = `${p.name}${p.variety_name ? ` - ${p.variety_name}` : ""}`;
    const domain = BAD_DOMAINS.find((d) => (p.hero_image_url ?? "").toLowerCase().includes(d)) ?? "unknown";
    const { error: updateErr } = await supabase
      .from("plant_profiles")
      .update({ hero_image_url: null })
      .eq("id", p.id)
      .eq("user_id", USER_ID);
    if (updateErr) {
      console.log(`  FAILED: ${label} — ${updateErr.message}`);
    } else {
      console.log(`  Cleared: ${label} (was ${domain})`);
    }
  }

  console.log(`\nDone. Cleared ${bad.length} watermarked stock photos.`);
}

main().catch((e) => {
  console.error("Script failed:", e);
  process.exit(1);
});
