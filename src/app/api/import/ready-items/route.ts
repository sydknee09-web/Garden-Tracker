import { NextResponse } from "next/server";
import { getSupabaseUser, unauthorized } from "../auth";
import type { ReviewImportItem } from "@/lib/reviewImportStorage";

export const dynamic = "force-dynamic";

/** GET /api/import/ready-items — list of items ready for review (from all ready batches). */
export async function GET(request: Request) {
  const auth = await getSupabaseUser(request);
  if (!auth) return unauthorized();
  const { supabase, user } = auth;

  const { data: batches } = await supabase
    .from("pending_import_batches")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "ready");

  if (!batches?.length) {
    return NextResponse.json({ items: [] });
  }

  const batchIds = (batches as { id: string }[]).map((b) => b.id);
  const { data: rows } = await supabase
    .from("pending_import_items")
    .select("id, result")
    .in("batch_id", batchIds)
    .eq("status", "ready")
    .order("order_index", { ascending: true });

  const items: ReviewImportItem[] = [];
  for (const row of rows ?? []) {
    const r = row as { id: string; result: unknown };
    if (r.result && typeof r.result === "object" && r.result !== null) {
      const obj = r.result as Record<string, unknown>;
      items.push({
        id: r.id,
        imageBase64: (obj.imageBase64 as string) ?? "",
        fileName: (obj.fileName as string) ?? "",
        vendor: (obj.vendor as string) ?? "",
        type: (obj.type as string) ?? "Imported seed",
        variety: (obj.variety as string) ?? "",
        tags: Array.isArray(obj.tags) ? (obj.tags as string[]) : [],
        purchaseDate: (obj.purchaseDate as string) ?? new Date().toISOString().slice(0, 10),
        sowing_depth: obj.sowing_depth as string | undefined,
        spacing: obj.spacing as string | undefined,
        sun_requirement: obj.sun_requirement as string | undefined,
        days_to_germination: obj.days_to_germination as string | undefined,
        days_to_maturity: obj.days_to_maturity as string | undefined,
        source_url: obj.source_url as string | undefined,
        hero_image_url: obj.hero_image_url as string | undefined,
        stock_photo_url: obj.stock_photo_url as string | undefined,
        useStockPhotoAsHero: obj.useStockPhotoAsHero as boolean | undefined,
        storagePath: obj.storagePath as string | undefined,
      } as ReviewImportItem & { storagePath?: string });
    }
  }

  return NextResponse.json({ items });
}
