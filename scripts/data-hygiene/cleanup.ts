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
  // Sprint 4 enrichment fields (re-enriched by the shallow-cohort sweep below)
  lifecycle: string | null; growth_form: string | null; plant_category: string | null; growth_habit: string | null;
  propagation_method: string[] | null; soil_preference: string | null; disease_susceptibility: string[] | null;
  pollination_requirements: string | null; toxicity: string | null; deer_rabbit_resistance: string | null;
  wildlife_value: string | null; invasiveness: string | null; native_origin: string | null;
  drought_salt_tolerance: string | null; synonyms: string[] | null; uses: string[] | null; special_features: string[] | null;
  water_summary: string | null; water_detail: string | null; sun_summary: string | null; sun_detail: string | null;
  harvest_season: string[] | null; spring_indoor_window: string | null; spring_outdoor_window: string | null;
  summer_window: string | null; fall_outdoor_window: string | null; planting_depth: number | null;
  family: string | null; genus: string | null; species: string | null;
};
const SELECT = "id,user_id,name,variety_name,plant_description,growing_notes,description_source,sun,water,plant_spacing,days_to_germination,harvest_days,sowing_depth,sowing_method,planting_window,mature_height,mature_width,propagation_notes,seed_saving_notes,seed_propagation_context,companion_plants,avoid_plants,lifecycle,growth_form,plant_category,growth_habit,propagation_method,soil_preference,disease_susceptibility,pollination_requirements,toxicity,deer_rabbit_resistance,wildlife_value,invasiveness,native_origin,drought_salt_tolerance,synonyms,uses,special_features,water_summary,water_detail,sun_summary,sun_detail,harvest_season,spring_indoor_window,spring_outdoor_window,summer_window,fall_outdoor_window,planting_depth,family,genus,species";

// Sprint 4 enrichment fields used by the shallow-cohort detector. A profile missing >=5 of these
// is "shallow" and gets a fresh-AI re-enrichment pass (fill-blanks only — idempotent across days).
const NEW_TEXT_FIELDS: (keyof Profile)[] = [
  "lifecycle", "growth_form", "plant_category", "growth_habit", "soil_preference",
  "pollination_requirements", "toxicity", "deer_rabbit_resistance", "wildlife_value", "invasiveness",
  "native_origin", "drought_salt_tolerance", "water_summary", "water_detail", "sun_summary", "sun_detail",
  "spring_indoor_window", "spring_outdoor_window", "summer_window", "fall_outdoor_window",
  "family", "genus", "species",
];
const NEW_ARR_FIELDS: (keyof Profile)[] = [
  "propagation_method", "disease_susceptibility", "synonyms", "uses", "special_features", "harvest_season",
];
function blankCount(v: unknown): number {
  if (v == null) return 1;
  if (typeof v === "string") return v.trim() === "" ? 1 : 0;
  if (Array.isArray(v)) return v.length === 0 ? 1 : 0;
  return 0;
}
const SHALLOW_THRESHOLD = 5;
function isShallow(p: Profile): boolean {
  let missing = 0;
  for (const k of NEW_TEXT_FIELDS) missing += blankCount(p[k]);
  for (const k of NEW_ARR_FIELDS) missing += blankCount(p[k]);
  if (p.planting_depth == null) missing += 1;
  return missing >= SHALLOW_THRESHOLD;
}
function parseInchesNumeric(s: string | undefined): number | null {
  if (!s?.trim()) return null;
  const m = s.trim().match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

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
    return hollow || c.sun || c.days_to_germination || c.harvest_days || isShallow(p);
  }).slice(0, LIMIT);

  const hollowCount = worklist.filter((p) => isBlank(p.description_source)).length;
  const corruptCount = worklist.filter((p) => { const c = corruptOf(p); return c.sun || c.days_to_germination || c.harvest_days; }).length;
  const shallowCount = worklist.filter((p) => isShallow(p)).length;
  console.log(`Worklist: ${worklist.length} profiles  (hollow=${hollowCount}, with-corrupt=${corruptCount}, shallow-new-fields=${shallowCount}, overlap counted once)\n`);
  if (DRY_RUN) {
    worklist.forEach((p, i) => {
      const c = corruptOf(p);
      const tags = [isBlank(p.description_source) ? "HOLLOW" : "", c.sun ? "sun" : "", c.days_to_germination ? "germ" : "", c.harvest_days ? `harvest=${p.harvest_days}` : "", isShallow(p) ? "SHALLOW-NEW" : ""].filter(Boolean).join(",");
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

  let enriched = 0, corruptFixed = 0, fieldsCleared = 0, failed = 0, skipped = 0, deepEnriched = 0;
  const fixByField: Record<string, number> = { sun: 0, days_to_germination: 0, harvest_days: 0 };
  const clearByField: Record<string, number> = { sun: 0, days_to_germination: 0, harvest_days: 0 };
  const failures: string[] = [];

  for (let i = 0; i < worklist.length; i++) {
    const p = worklist[i];
    const name = (p.name ?? "").trim();
    const variety = (p.variety_name ?? "").trim();
    const label = [name, variety].filter(Boolean).join(" / ") || p.id;
    if (!name) { skipped++; failures.push(`SKIP (no name): ${p.id}`); continue; }

    const outcome = await researchVariety(GEMINI_KEY, name, variety, vendorByProfile[p.id] ?? "");
    // Log the Gemini call per the api_usage_log observability pattern (non-fatal on failure).
    try { await admin.from("api_usage_log").insert({ user_id: p.user_id, provider: "gemini", operation: "cleanup-reenrich" }); } catch { /* non-fatal */ }
    // Exact-match-only contract (Chunk B): not-found → skip profile (honest empty, no species fill).
    const r = outcome && outcome.found ? outcome.data : null;
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

    // ---- shallow-cohort re-enrichment: fill EMPTY new Sprint 4 fields only (idempotent) ----
    const keysBefore = Object.keys(updates).length;
    const fillNew = (col: keyof Profile, val: string | undefined) => { if (isBlank(p[col]) && val && val.trim()) updates[col] = val.trim(); };
    const fillNewArr = (col: keyof Profile, csv: string | undefined) => {
      const empty = isBlank(p[col]) || (Array.isArray(p[col]) && (p[col] as unknown[]).length === 0);
      if (empty) { const a = toArr(csv); if (a.length) updates[col] = a; }
    };
    fillNew("lifecycle", r.lifecycle);
    fillNew("growth_form", r.growth_form);
    fillNew("plant_category", r.plant_category);
    fillNew("growth_habit", r.growth_habit);
    fillNew("soil_preference", r.soil_preference);
    fillNew("pollination_requirements", r.pollination_requirements);
    fillNew("toxicity", r.toxicity);
    fillNew("deer_rabbit_resistance", r.deer_rabbit_resistance);
    fillNew("wildlife_value", r.wildlife_value);
    fillNew("invasiveness", r.invasiveness);
    fillNew("native_origin", r.native_origin);
    fillNew("drought_salt_tolerance", r.drought_salt_tolerance);
    fillNew("water_summary", r.water);
    fillNew("water_detail", r.water_detail);
    fillNew("sun_summary", r.sun_requirement);
    fillNew("sun_detail", r.sun_detail);
    fillNew("spring_indoor_window", r.spring_indoor_window);
    fillNew("spring_outdoor_window", r.spring_outdoor_window);
    fillNew("summer_window", r.summer_window);
    fillNew("fall_outdoor_window", r.fall_outdoor_window);
    fillNew("family", r.family);
    fillNew("genus", r.genus);
    fillNew("species", r.species);
    if (p.planting_depth == null) { const d = parseInchesNumeric(r.planting_depth); if (d != null) updates.planting_depth = d; }
    fillNewArr("propagation_method", r.propagation_method);
    fillNewArr("disease_susceptibility", r.disease_susceptibility);
    fillNewArr("synonyms", r.synonyms);
    fillNewArr("uses", r.uses);
    fillNewArr("special_features", r.special_features);
    fillNewArr("harvest_season", r.harvest_season);
    const wroteDeepFields = Object.keys(updates).length > keysBefore;

    const wroteCorruptFix = c.sun || c.days_to_germination || c.harvest_days;
    if (Object.keys(updates).length === 0) { skipped++; continue; }

    const { error: upErr } = await admin.from("plant_profiles").update(updates).eq("id", p.id).eq("user_id", p.user_id);
    if (upErr) { failed++; failures.push(`WRITE FAIL: ${label} — ${upErr.message}`); console.log(`  [${i + 1}/${worklist.length}] write failed: ${label} — ${upErr.message}`); }
    else {
      if (hollow) enriched++;
      if (wroteCorruptFix) corruptFixed++;
      if (wroteDeepFields) deepEnriched++;
      const what = [hollow ? `enriched(${Object.keys(updates).length}f)` : "", wroteCorruptFix ? "corrupt-fixed" : "", wroteDeepFields ? "deep-fields" : ""].filter(Boolean).join("+");
      console.log(`  [${i + 1}/${worklist.length}] ${what}: ${label}`);
    }
    if (i < worklist.length - 1) await new Promise((res) => setTimeout(res, THROTTLE_MS));
    if ((i + 1) % 20 === 0) console.log(`  ... progress ${i + 1}/${worklist.length} (enriched=${enriched}, corrupt-fixed=${corruptFixed}, failed=${failed})`);
  }

  console.log("\n---------- RESULTS ----------");
  console.log(`Hollow profiles enriched: ${enriched}`);
  console.log(`Shallow profiles given new Sprint 4 fields: ${deepEnriched}`);
  console.log(`Profiles with corrupt fields fixed: ${corruptFixed}`);
  console.log(`  corrupt fields replaced w/ valid AI: sun=${fixByField.sun}, germ=${fixByField.days_to_germination}, harvest=${fixByField.harvest_days}`);
  console.log(`  corrupt fields CLEARED to null (AI also bad/empty): sun=${clearByField.sun}, germ=${clearByField.days_to_germination}, harvest=${clearByField.harvest_days}  (total ${fieldsCleared})`);
  console.log(`Skipped (no change/no name): ${skipped}`);
  console.log(`Failures: ${failed}`);
  if (failures.length) { console.log("  failure detail:"); failures.forEach((f) => console.log("    - " + f)); }
}

main().catch((e) => { console.error(e); process.exit(1); });
