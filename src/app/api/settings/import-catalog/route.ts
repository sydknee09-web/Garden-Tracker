import { NextResponse } from "next/server";
import { getSupabaseUser, unauthorized } from "@/app/api/import/auth";
import { createRequire } from "module";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { parseCatalogWithGemini, toCacheRow } from "@/lib/importPdfCatalog";
import { logApiUsageAsync } from "@/lib/logApiUsage";

export const maxDuration = 120;

const require = createRequire(import.meta.url);

/**
 * POST /api/settings/import-catalog
 * Body: FormData with "vendor" (string) and "file" (PDF File).
 * Requires auth. Writes to global_plant_cache via service role.
 * Admin-only in practice; public restrictions can be added later.
 */
export async function POST(req: Request) {
  try {
    const auth = await getSupabaseUser(req);
    if (!auth) return unauthorized();
    const { user } = auth;

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { error: "Server not configured for cache writes (missing SUPABASE_SERVICE_ROLE_KEY)" },
        { status: 503 }
      );
    }

    const formData = await req.formData();
    const vendor = (formData.get("vendor") ?? "").toString().trim();
    const file = formData.get("file");

    if (!vendor) {
      return NextResponse.json({ error: "Vendor name is required" }, { status: 400 });
    }
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "A PDF file is required" }, { status: 400 });
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length < 100) {
      return NextResponse.json({ error: "PDF file is too small or empty" }, { status: 400 });
    }

    const pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text?: string; numpages?: number }>;
    const data = await pdfParse(buffer);
    const text = (data.text ?? "").trim();
    const numpages = data.numpages ?? 0;

    if (!text || text.length < 50) {
      return NextResponse.json(
        { error: "PDF produced too little text. It may be image-only (scanned); try OCR first or use a text-based PDF." },
        { status: 400 }
      );
    }

    const rawRows = await parseCatalogWithGemini(text.slice(0, 280000), vendor);
    const chunkCount = Math.ceil(Math.min(text.length, 280000) / 45000) || 1;
    for (let i = 0; i < chunkCount; i++) {
      logApiUsageAsync({ userId: user.id, provider: "gemini", operation: "import-catalog" });
    }
    let inserted = 0;
    let skipped = 0;

    for (const raw of rawRows) {
      const row = toCacheRow(raw, vendor);
      if (!row) {
        skipped++;
        continue;
      }
      // global_plant_cache not in generated DB types; cast to allow upsert
      const adminClient = admin as unknown as { from: (table: string) => { upsert: (data: object, opts: { onConflict: string }) => Promise<{ error: { message?: string } | null }> } };
      const { error } = await adminClient.from("global_plant_cache").upsert(
        {
          source_url: row.source_url,
          identity_key: row.identity_key,
          vendor,
          extract_data: row.extract_data,
          original_hero_url: null,
          scraped_fields: row.scraped_fields,
          scrape_quality: "catalog_import",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "source_url" }
      );
      if (!error) inserted++;
    }

    return NextResponse.json({
      ok: true,
      inserted,
      skipped,
      parsed: rawRows.length,
      pages: numpages,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
