/**
 * recompress-storage-images.ts — One-time script to recompress existing images
 * in Supabase Storage to reduce cached egress (500 KB / 1000px targets).
 *
 * Prerequisites: .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *
 * Run:
 *   npm run recompress-storage-images           (dry run: list files, no changes)
 *   npm run recompress-storage-images -- --confirm   (recompress and re-upload)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

if (!SUPABASE_URL || SUPABASE_URL.includes("YOUR_PROJECT_REF")) {
  console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL missing or placeholder. Set it in .env.local");
  process.exit(1);
}
if (!SERVICE_ROLE_KEY) {
  console.error("ERROR: SUPABASE_SERVICE_ROLE_KEY not set. Set it in .env.local");
  process.exit(1);
}

const CONFIRM = process.argv.includes("--confirm");
const MAX_LONG_EDGE = 1000;
const MAX_SIZE_KB = 500;
const SKIP_IF_UNDER_KB = 400;
const DELAY_MS = 200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isImagePath(p: string): boolean {
  const lower = p.toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp")
  );
}

async function recompressBuffer(
  input: Buffer,
  mimeType: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const isJpeg =
    mimeType.includes("jpeg") || mimeType.includes("jpg");
  const isPng = mimeType.includes("png");
  const isWebp = mimeType.includes("webp");

  let pipeline = sharp(input);
  const meta = await pipeline.metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const scale =
    w > h
      ? Math.min(1, MAX_LONG_EDGE / w)
      : Math.min(1, MAX_LONG_EDGE / h);
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);

  pipeline = pipeline.resize(cw, ch, { fit: "inside", withoutEnlargement: true });

  pipeline = pipeline.jpeg({ quality: 85 });

  let buffer = await pipeline.toBuffer();
  if (buffer.length > MAX_SIZE_KB * 1024) {
    pipeline = sharp(input)
      .resize(cw, ch, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 70 });
    buffer = await pipeline.toBuffer();
  }

  return { buffer, contentType: "image/jpeg" };
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  type PathWithBucket = { path: string; bucket: string };
  const paths: PathWithBucket[] = [];
  const seen = new Set<string>();

  function add(bucket: string, p: string | null) {
    const trimmed = (p ?? "").trim();
    if (!trimmed || !isImagePath(trimmed)) return;
    const key = `${bucket}:${trimmed}`;
    if (seen.has(key)) return;
    seen.add(key);
    paths.push({ path: trimmed, bucket });
  }

  console.log("Collecting image paths from database...\n");

  const [jepRes, jeRes, ppRes, spRes, piRes, supRes, ufRes] = await Promise.all([
    supabase.from("journal_entry_photos").select("image_file_path"),
    supabase.from("journal_entries").select("image_file_path").not("image_file_path", "is", null).is("deleted_at", null),
    supabase.from("plant_profiles").select("hero_image_path").not("hero_image_path", "is", null).is("deleted_at", null),
    supabase.from("seed_packets").select("primary_image_path").not("primary_image_path", "is", null).is("deleted_at", null),
    supabase.from("packet_images").select("image_path"),
    supabase.from("supply_profiles").select("primary_image_path").not("primary_image_path", "is", null).is("deleted_at", null),
    supabase.from("user_feedback").select("screenshot_path").not("screenshot_path", "is", null),
  ]);

  for (const row of jepRes.data ?? []) add("journal-photos", (row as { image_file_path: string }).image_file_path);
  for (const row of jeRes.data ?? []) add("journal-photos", (row as { image_file_path: string }).image_file_path);
  for (const row of ppRes.data ?? []) add("journal-photos", (row as { hero_image_path: string }).hero_image_path);
  for (const row of spRes.data ?? []) add("seed-packets", (row as { primary_image_path: string }).primary_image_path);
  for (const row of piRes.data ?? []) add("seed-packets", (row as { image_path: string }).image_path);
  for (const row of supRes.data ?? []) add("journal-photos", (row as { primary_image_path: string }).primary_image_path);
  for (const row of ufRes.data ?? []) add("journal-photos", (row as { screenshot_path: string }).screenshot_path);

  console.log(`Found ${paths.length} unique image paths.\n`);

  if (paths.length === 0) {
    console.log("Nothing to process.");
    return;
  }

  if (!CONFIRM) {
    console.log("DRY RUN. Use --confirm to recompress and re-upload.\n");
  }

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let totalSaved = 0;

  for (let i = 0; i < paths.length; i++) {
    const { path: filePath, bucket } = paths[i];
    process.stdout.write(`[${i + 1}/${paths.length}] ${bucket}/${filePath}... `);

    try {
      const { data: blob, error: dlErr } = await supabase.storage
        .from(bucket)
        .download(filePath);

      if (dlErr || !blob) {
        console.log(`DOWNLOAD FAILED: ${dlErr?.message ?? "no data"}`);
        failed++;
        continue;
      }

      const origSize = blob.size;
      if (origSize < SKIP_IF_UNDER_KB * 1024) {
        console.log(`skip (already small: ${(origSize / 1024).toFixed(1)} KB)`);
        skipped++;
        continue;
      }

      const buf = Buffer.from(await blob.arrayBuffer());
      const mimeType = blob.type || "image/jpeg";

      const { buffer: outBuf } = await recompressBuffer(buf, mimeType);
      const newSize = outBuf.length;

      if (newSize >= origSize) {
        console.log(`skip (no savings: ${(origSize / 1024).toFixed(1)} KB)`);
        skipped++;
        continue;
      }

      if (CONFIRM) {
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(filePath, outBuf, {
            contentType: "image/jpeg",
            upsert: true,
          });

        if (upErr) {
          console.log(`UPLOAD FAILED: ${upErr.message}`);
          failed++;
          continue;
        }
      }

      const saved = origSize - newSize;
      totalSaved += saved;
      console.log(
        `${(origSize / 1024).toFixed(1)} KB -> ${(newSize / 1024).toFixed(1)} KB (saved ${(saved / 1024).toFixed(1)} KB)${CONFIRM ? "" : " [dry run]"}`
      );
      processed++;
    } catch (e) {
      console.log(`ERROR: ${e instanceof Error ? e.message : String(e)}`);
      failed++;
    }

    if (i < paths.length - 1) await sleep(DELAY_MS);
  }

  console.log("\n--- Done ---");
  console.log(`Processed: ${processed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total saved: ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);
  if (!CONFIRM && processed > 0) {
    console.log("\nRun with --confirm to apply changes.");
  }
}

main().catch((e) => {
  console.error("Script failed:", e);
  process.exit(1);
});
