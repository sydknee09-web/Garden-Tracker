/**
 * One-shot migration: plant_varieties + seed_stocks → plant_profiles + seed_packets.
 * Merges duplicates by (user_id, name, variety_name) into one PlantProfile with multiple SeedPackets.
 *
 * Prereqs: Run supabase/migrations/20250205700000_plant_profiles_seed_packets.sql first.
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx ts-node scripts/migrate-to-plant-packets.ts
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON key)");
  process.exit(1);
}

const supabase = createClient(url, key);

type PvRow = {
  id: string;
  user_id: string;
  name: string;
  variety_name: string | null;
  primary_image_path: string | null;
  sun: string | null;
  water: string | null;
  plant_spacing: string | null;
  days_to_germination: string | null;
  harvest_days: number | null;
  source_url: string | null;
  vendor: string | null;
  growing_notes: string | null;
  growing_info_from_source: string | null;
  plant_description: string | null;
  pretreatment_notes: string | null;
  tags: string[] | null;
  status: string | null;
};

function norm(s: string | null | undefined): string {
  return (s ?? "").trim();
}

function normKey(name: string, variety: string | null): string {
  return `${norm(name).toLowerCase()}::${norm(variety ?? "").toLowerCase()}`;
}

const VOLUME_TO_QTY: Record<string, number> = { full: 80, partial: 50, low: 20, empty: 0 };

async function main() {
  console.log("Fetching plant_varieties…");
  const { data: pvRows, error: pvErr } = await supabase
    .from("plant_varieties")
    .select("id, user_id, name, variety_name, primary_image_path, sun, water, plant_spacing, days_to_germination, harvest_days, source_url, vendor, growing_notes, growing_info_from_source, plant_description, pretreatment_notes, tags, status");
  if (pvErr) {
    console.error("plant_varieties", pvErr);
    process.exit(1);
  }
  const pvList = (pvRows ?? []) as PvRow[];
  if (pvList.length === 0) {
    console.log("No plant_varieties rows. Nothing to migrate.");
    return;
  }

  console.log("Fetching seed_stocks…");
  const { data: stocks } = await supabase.from("seed_stocks").select("plant_variety_id, volume");
  const volumeByPv = new Map<string, number>();
  for (const row of stocks ?? []) {
    const vol = (row as { volume?: string }).volume ?? "full";
    volumeByPv.set((row as { plant_variety_id: string }).plant_variety_id, VOLUME_TO_QTY[vol] ?? 50);
  }

  const groups = new Map<string, PvRow[]>();
  for (const pv of pvList) {
    const k = `${pv.user_id}::${normKey(pv.name, pv.variety_name)}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(pv);
  }

  const pvIdToProfileId = new Map<string, string>();

  for (const [, rows] of groups) {
    const first = rows[0];
    const merge = (get: (r: PvRow) => string | null | undefined) => {
      for (const r of rows) {
        const v = get(r);
        if (v != null && String(v).trim() !== "") return String(v).trim();
      }
      return null;
    };
    const { data: profile, error: insErr } = await supabase
      .from("plant_profiles")
      .insert({
        user_id: first.user_id,
        name: norm(first.name),
        variety_name: norm(first.variety_name) || null,
        primary_image_path: merge((r) => r.primary_image_path),
        sun: merge((r) => r.sun),
        water: merge((r) => r.water),
        plant_spacing: merge((r) => r.plant_spacing),
        days_to_germination: merge((r) => r.days_to_germination),
        harvest_days: (() => { for (const r of rows) { if (r.harvest_days != null) return r.harvest_days; } return null; })(),
        tags: first.tags ?? [],
        status: first.status ?? "vault",
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("insert plant_profiles", insErr);
      throw insErr;
    }
    const profileId = (profile as { id: string }).id;
    for (const pv of rows) {
      pvIdToProfileId.set(pv.id, profileId);
      const scraped = [pv.growing_info_from_source, pv.plant_description, pv.growing_notes, pv.pretreatment_notes]
        .filter(Boolean)
        .join("\n\n");
      const qty = volumeByPv.get(pv.id) ?? 50;
      await supabase.from("seed_packets").insert({
        plant_profile_id: profileId,
        user_id: pv.user_id,
        vendor_name: norm(pv.vendor) || null,
        purchase_url: norm(pv.source_url) || null,
        qty_status: qty,
        scraped_details: scraped || null,
        primary_image_path: pv.primary_image_path,
      });
    }
  }

  console.log("Updating tasks…");
  const { data: tasks } = await supabase.from("tasks").select("id, plant_variety_id");
  for (const t of tasks ?? []) {
    const tid = (t as { id: string }).id;
    const pvId = (t as { plant_variety_id: string | null }).plant_variety_id;
    const profileId = pvId ? pvIdToProfileId.get(pvId) : null;
    if (profileId) {
      await supabase.from("tasks").update({ plant_profile_id: profileId }).eq("id", tid);
    }
  }

  console.log("Updating grow_instances…");
  const { data: grows } = await supabase.from("grow_instances").select("id, plant_variety_id");
  for (const g of grows ?? []) {
    const gid = (g as { id: string }).id;
    const pvId = (g as { plant_variety_id: string }).plant_variety_id;
    const profileId = pvIdToProfileId.get(pvId);
    if (profileId) {
      await supabase.from("grow_instances").update({ plant_profile_id: profileId }).eq("id", gid);
    }
  }

  console.log("Updating journal_entries…");
  const { data: journals } = await supabase.from("journal_entries").select("id, plant_variety_id");
  for (const j of journals ?? []) {
    const jid = (j as { id: string }).id;
    const pvId = (j as { plant_variety_id: string | null }).plant_variety_id;
    const profileId = pvId ? pvIdToProfileId.get(pvId) : null;
    if (profileId) {
      await supabase.from("journal_entries").update({ plant_profile_id: profileId }).eq("id", jid);
    }
  }

  console.log("Updating shopping_list…");
  const { data: shop } = await supabase.from("shopping_list").select("id, plant_variety_id");
  for (const s of shop ?? []) {
    const sid = (s as { id: string }).id;
    const pvId = (s as { plant_variety_id: string }).plant_variety_id;
    const profileId = pvIdToProfileId.get(pvId);
    if (profileId) {
      await supabase.from("shopping_list").update({ plant_profile_id: profileId }).eq("id", sid);
    }
  }

  console.log("Done. Profiles:", groups.size, "Packets:", pvList.length);
  console.log("Next: run 20250205800000_plant_profiles_drop_legacy.sql to drop plant_variety_id columns and old tables (optional).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
