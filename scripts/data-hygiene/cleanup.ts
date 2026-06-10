/**
 * Sprint 2 Problem 1 — Data hygiene EXECUTOR.
 *
 * Two sweeps over plant_profiles (service-role; scoped writes by id+user_id):
 *   1. AI refresh of the hollow cohort (description_source IS NULL, non-E2E): FILL BLANK fields,
 *      stamp description_source='ai'.
 *   2. Corrupt-value sweep (all live profiles): OVERWRITE the specific corrupt fields with fresh AI.
 *
 * Safety guardrails:
 *   - Forces fresh AI (researchVariety / Gemini 2.5-flash + grounding); SKIPS the mixed-quality
 *     global_plant_cache so we never re-import a corrupt cached value.
 *   - Validates AI output against the SAME corrupt detectors before writing. If the AI value is
 *     also corrupt or empty, the field is set to NULL (cleared) — better empty than garbage
 *     (VISION §8 empty-cell convention: "—" beats a mangled fragment).
 *   - Fill-blanks NEVER overwrites an existing non-empty value; corrupt-fix only touches the
 *     specific flagged field. E2E test-plant stubs are skipped entirely.
 *   - Writes nothing under --dry-run.
 *
 * Detectors mirror scripts/data-hygiene/dry-run.ts (kept in sync by hand; tiny + stable).
 *
 * Run:  npx tsx scripts/data-hygiene/cleanup.ts --dry-run     (confirm worklist, no writes/AI)
 *       npx tsx scripts/data-hygiene/cleanup.ts                (LIVE)
 *       npx tsx scripts/data-hygiene/cleanup.ts --limit 5      (cap profiles processed)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { researchVariety } from "../../src/lib/researchVariety";
// Model: regular gemini-2.5-flash (full quality) via the shared researchVariety lib. Run piecemeal
// across calendar days as the free DAILY flash quota allows; the worklist is idempotent so each
// day's run resumes the remainder. (flash-lite was trialled 2026-06-09 then rejected — quality
// matters more than speed for a data-QUALITY cleanup.)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", "..", ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (k && !process.env[k]) process.env[k] = v;
  }
}

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
const GEMINI_KEY = (process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "").trim();
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = (() => { const i = process.argv.indexOf("--limit"); return i >= 0 ? parseInt(process.argv[i + 1], 10) || Infinity : Infinity; })();
const THROTTLE_MS = 2000;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) { console.error("ERROR: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY required."); process.exit(1); }
if (!GEMINI_KEY && !DRY_RUN) { console.error("ERROR: GOOGLE_GENERATIVE_AI_API_KEY required for a live run."); process.exit(1); }

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

// ---- detectors (mirror dry-run.ts) ----
const E2E_RE = /E2E Test Plant|Test Plant \d{10,}|Playwright/i;
const SUN_KW = ["sun", "shade", "light", "full", "partial", "bright", "indirect", "dappled"];
function sunCorrupt(v: string): boolean {
  const s = (v ?? "").trim();
  if (!s) return false;
  if (s.length < 5) return true;
  if (/^[^A-Za-z0-9]/.test(s)) return true;
  const low = s.toLowerCase();
  const hasKw = SUN_KW.some((k) => low.includes(k));
  if (!hasKw && s.length < 40) return true;
  if (/^[a-z]/.test(s) && !hasKw) return true;
  return false;
}
function germCorrupt(v: string): boolean {
  const s = (v ?? "").trim();
  if (!s) return false;
  if (!/\d/.test(s)) return true;
  if (/^[^A-Za-z0-9]/.test(s)) return true;
  return false;
}
function harvestCorrupt(n: number | null): boolean {
  return typeof n === "number" && n > 0 && (n < 10 || n > 400);
}
function isBlank(v: unknown): boolean { return v == null || (typeof v === "string" && v.trim() === ""); }
function parseDays(s: string | undefined): number | null {
  if (!s) return null;
  const m = s.replace(/,/g, "").match(/\d+/);
  const n = m ? parseInt(m[0], 10) : NaN;
  return Number.isFinite(n) ? n : null;
}
function toArr(s: string | undefined): string[] {
  return (s ?? "").split(",").map((x) => x.trim()).filter(Boolean);
}

type Profile = {
  id: string; user_id: string; name: string | null; variety_name: string | null;
  plant_description: string | null; growing_notes: string | null; description_source: string | null;
  sun: string | null; water: string | null; plant_spacing: string | null;
  days_to_germination: string | null; harvest_days: number | null; sowing_depth: string | null;
  sowing_method: string | null; planting_window: string | null; mature_height: string | null;
  mature_width: string | null; propagation_notes: string | null; seed_saving_notes: string | null;
  seed_propagation_context: string | null; companion_plants: string[] | null; avoid_plants: string[] | null;
};
const SELECT = "id,user_id,name,variety_name,plant_description,growing_notes,description_source,sun,water,plant_spacing,days_to_germination,harvest_days,sowing_depth,sowing_method,planting_window,mature_height,mature_width,propagation_notes,seed_saving_notes,seed_propagation_context,companion_plants,avoid_plants";

async function main() {
  console.log(`=== DATA HYGIENE CLEANUP ${DRY_RUN ? "(DRY RUN — no writes/AI)" : "(LIVE)"} ===\n`);

  // fetch all live profiles
  const all: Profile[] = [];
  let from = 0; const page = 1000;
  while (true) {
    const { data, error } = await admin.from("plant_profiles").select(SELECT).is("deleted_at", null).range(from, from + page - 1);
    if (error) { console.error("read failed:", error.message); process.exit(1); }
    const rows = (data ?? []) as Profile[];
    all.push(...rows);
    if (rows.length < page) break;
    from += page;
  }

  // build worklist: hollow (non-E2E) OR has >=1 corrupt field
  const corruptOf = (p: Profile) => ({
    sun: !isBlank(p.sun) && sunCorrupt(String(p.sun)),
    days_to_germination: !isBlank(p.days_to_germination) && germCorrupt(String(p.days_to_germination)),
    harvest_days: harvestCorrupt(p.harvest_days),
  });
  const worklist = all.filter((p) => {
    if (E2E_RE.test(p.name ?? "")) return false;
    const hollow = isBlank(p.description_source);
    const c = corruptOf(p);
    return hollow || c.sun || c.days_to_germination || c.harvest_days;
  }).slice(0, LIMIT);

  const hollowCount = worklist.filter((p) => isBlank(p.description_source)).length;
  const corruptCount = worklist.filter((p) => { const c = corruptOf(p); return c.sun || c.days_to_germination || c.harvest_days; }).length;
  console.log(`Worklist: ${worklist.length} profiles  (hollow=${hollowCount}, with-corrupt=${corruptCount}, overlap counted once)\n`);
  if (DRY_RUN) {
    worklist.forEach((p, i) => {
      const c = corruptOf(p);
      const tags = [isBlank(p.description_source) ? "HOLLOW" : "", c.sun ? "sun" : "", c.days_to_germination ? "germ" : "", c.harvest_days ? `harvest=${p.harvest_days}` : ""].filter(Boolean).join(",");
      console.log(`  [${i + 1}] "${[p.name, p.variety_name].filter(Boolean).join(" / ")}" -> ${tags}`);
    });
    console.log("\nDRY RUN complete — nothing written.");
    return;
  }

  // fetch vendor per profile (improves research query)
  const ids = worklist.map((p) => p.id);
  const vendorByProfile: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await admin.from("seed_packets").select("plant_profile_id,vendor_name").in("plant_profile_id", ids.slice(i, i + 200)).order("created_at", { ascending: true });
    (data ?? []).forEach((r: { plant_profile_id: string; vendor_name: string | null }) => {
      if (vendorByProfile[r.plant_profile_id] == null && (r.vendor_name ?? "").trim()) vendorByProfile[r.plant_profile_id] = r.vendor_name!.trim();
    });
  }

  let enriched = 0, corruptFixed = 0, fieldsCleared = 0, failed = 0, skipped = 0;
  const fixByField: Record<string, number> = { sun: 0, days_to_germination: 0, harvest_days: 0 };
  const clearByField: Record<string, number> = { sun: 0, days_to_germination: 0, harvest_days: 0 };
  const failures: string[] = [];

  for (let i = 0; i < worklist.length; i++) {
    const p = worklist[i];
    const name = (p.name ?? "").trim();
    const variety = (p.variety_name ?? "").trim();
    const label = [name, variety].filter(Boolean).join(" / ") || p.id;
    if (!name) { skipped++; failures.push(`SKIP (no name): ${p.id}`); continue; }

    const r = await researchVariety(GEMINI_KEY, name, variety, vendorByProfile[p.id] ?? "");
    if (!r) { failed++; failures.push(`AI FAIL: ${label}`); console.log(`  [${i + 1}/${worklist.length}] AI returned nothing: ${label}`); if (i < worklist.length - 1) await new Promise((res) => setTimeout(res, THROTTLE_MS)); continue; }

    const updates: Record<string, unknown> = {};
    const hollow = isBlank(p.description_source);
    const c = corruptOf(p);

    // ---- fill-blanks (hollow cohort): only empty fields ----
    if (hollow) {
      const fill = (col: keyof Profile, val: string | undefined) => { if (isBlank(p[col]) && val && val.trim()) updates[col] = val.trim(); };
      fill("sun", r.sun_requirement);
      fill("water", r.water);
      fill("plant_spacing", r.spacing);
      fill("days_to_germination", r.days_to_germination);
      fill("sowing_depth", r.sowing_depth);
      fill("sowing_method", r.sowing_method);
      fill("planting_window", r.planting_window);
      fill("mature_height", r.mature_height);
      fill("mature_width", r.mature_width);
      fill("plant_description", r.plant_description);
      fill("growing_notes", r.growing_notes);
      fill("propagation_notes", r.propagation_notes);
      fill("seed_saving_notes", r.seed_saving_notes);
      fill("seed_propagation_context", r.seed_propagation_context);
      if ((p.harvest_days == null || p.harvest_days === 0)) { const d = parseDays(r.days_to_maturity); if (d != null && d >= 10) updates.harvest_days = d; }
      if (isBlank(p.companion_plants) || (Array.isArray(p.companion_plants) && p.companion_plants.length === 0)) { const a = toArr(r.companion_plants); if (a.length) updates.companion_plants = a; }
      if (isBlank(p.avoid_plants) || (Array.isArray(p.avoid_plants) && p.avoid_plants.length === 0)) { const a = toArr(r.avoid_plants); if (a.length) updates.avoid_plants = a; }
      updates.description_source = "ai"; // stamp so the cohort exits description_source IS NULL
    }

    // ---- corrupt-fix: overwrite the flagged field (validate AI value; else clear to null) ----
    if (c.sun) {
      const v = (r.sun_requirement ?? "").trim();
      if (v && !sunCorrupt(v)) { updates.sun = v; fixByField.sun++; } else { updates.sun = null; clearByField.sun++; fieldsCleared++; }
    }
    if (c.days_to_germination) {
      const v = (r.days_to_germination ?? "").trim();
      if (v && !germCorrupt(v)) { updates.days_to_germination = v; fixByField.days_to_germination++; } else { updates.days_to_germination = null; clearByField.days_to_germination++; fieldsCleared++; }
    }
    if (c.harvest_days) {
      const d = parseDays(r.days_to_maturity);
      if (d != null && d >= 10 && d <= 400) { updates.harvest_days = d; fixByField.harvest_days++; } else { updates.harvest_days = null; clearByField.harvest_days++; fieldsCleared++; }
    }

    const wroteCorruptFix = c.sun || c.days_to_germination || c.harvest_days;
    if (Object.keys(updates).length === 0) { skipped++; continue; }

    const { error: upErr } = await admin.from("plant_profiles").update(updates).eq("id", p.id).eq("user_id", p.user_id);
    if (upErr) { failed++; failures.push(`WRITE FAIL: ${label} — ${upErr.message}`); console.log(`  [${i + 1}/${worklist.length}] write failed: ${label} — ${upErr.message}`); }
    else {
      if (hollow) enriched++;
      if (wroteCorruptFix) corruptFixed++;
      const what = [hollow ? `enriched(${Object.keys(updates).length}f)` : "", wroteCorruptFix ? "corrupt-fixed" : ""].filter(Boolean).join("+");
      console.log(`  [${i + 1}/${worklist.length}] ${what}: ${label}`);
    }
    if (i < worklist.length - 1) await new Promise((res) => setTimeout(res, THROTTLE_MS));
    if ((i + 1) % 20 === 0) console.log(`  ... progress ${i + 1}/${worklist.length} (enriched=${enriched}, corrupt-fixed=${corruptFixed}, failed=${failed})`);
  }

  console.log("\n---------- RESULTS ----------");
  console.log(`Hollow profiles enriched: ${enriched}`);
  console.log(`Profiles with corrupt fields fixed: ${corruptFixed}`);
  console.log(`  corrupt fields replaced w/ valid AI: sun=${fixByField.sun}, germ=${fixByField.days_to_germination}, harvest=${fixByField.harvest_days}`);
  console.log(`  corrupt fields CLEARED to null (AI also bad/empty): sun=${clearByField.sun}, germ=${clearByField.days_to_germination}, harvest=${clearByField.harvest_days}  (total ${fieldsCleared})`);
  console.log(`Skipped (no change/no name): ${skipped}`);
  console.log(`Failures: ${failed}`);
  if (failures.length) { console.log("  failure detail:"); failures.forEach((f) => console.log("    - " + f)); }
}

main().catch((e) => { console.error(e); process.exit(1); });
