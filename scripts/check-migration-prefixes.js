#!/usr/bin/env node
/**
 * Migration prefix collision guard.
 *
 * Supabase migration files use a 14-digit timestamp prefix (YYYYMMDDHHMMSS).
 * Two files sharing the same prefix cause undefined migration order on apply
 * and have historically produced silent-skip bugs on prod (U24 root cause).
 *
 * This script enforces uniqueness as a mechanical guard. Run locally via
 * `npm run migration:check` and in CI on every PR/push.
 *
 * Plain Node (no deps, no TS compile) so it runs identically in any CI/local
 * environment with Node 18+. Deviates from the scripts/ directory's tsx
 * convention because it has zero logic complexity and benefits from being
 * dependency-free.
 *
 * Exit codes:
 *   0 — no collisions (clean)
 *   1 — collision detected; output lists the offending file pairs
 *
 * Ships R1.6 from .claude/plans/supabase_library_load_audit.md.
 */

const fs = require("fs");
const path = require("path");

const MIGRATIONS_DIR = path.join(__dirname, "..", "supabase", "migrations");
const PREFIX_PATTERN = /^(\d{14})_/;

/**
 * Known historical collisions that are already applied on the remote database
 * and cannot be renamed without coordinated migration_history repair.
 *
 * Each entry MUST include the date it was added and a one-line reason so a
 * future reader can decide whether it's safe to remove.
 *
 * To add a new entry: confirm both colliding files ARE already applied on
 * remote (`supabase migration list --linked`), document the timestamp here,
 * and open a separate ship to resolve the underlying collision. The allowlist
 * is the safety valve, not the answer.
 */
const KNOWN_HISTORICAL_COLLISIONS = new Set([
  // 2026-05-28 — grow_instances_status_collapse + plant_profiles_planting_window_zone
  // shipped same-day in two parallel chats; both applied on remote. Renaming
  // either would orphan a migration_history row. R1.6 ships the guard so
  // future collisions are caught at PR time; resolving this doublet is a
  // separate ship (`supabase migration repair` after rename).
  "20260528120000",
]);

function main() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.error(`[migration:check] migrations directory not found: ${MIGRATIONS_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql"));
  const prefixMap = new Map();
  const malformed = [];

  for (const file of files) {
    const match = file.match(PREFIX_PATTERN);
    if (!match) {
      malformed.push(file);
      continue;
    }
    const prefix = match[1];
    if (!prefixMap.has(prefix)) {
      prefixMap.set(prefix, []);
    }
    prefixMap.get(prefix).push(file);
  }

  if (malformed.length > 0) {
    console.warn(
      `[migration:check] ${malformed.length} migration file(s) without a 14-digit prefix (ignored): ${malformed.join(", ")}`,
    );
  }

  const collisions = [];
  for (const [prefix, fileList] of prefixMap.entries()) {
    if (fileList.length > 1 && !KNOWN_HISTORICAL_COLLISIONS.has(prefix)) {
      collisions.push({ prefix, files: fileList });
    }
  }

  if (collisions.length === 0) {
    console.log(
      `[migration:check] OK — ${files.length} migration files, ${prefixMap.size} unique prefixes, ${KNOWN_HISTORICAL_COLLISIONS.size} known historical collision(s) exempted.`,
    );
    process.exit(0);
  }

  console.error("");
  console.error("[migration:check] FAIL — duplicate migration timestamp prefix(es) detected:");
  console.error("");
  for (const { prefix, files: fileList } of collisions) {
    console.error(`  ${prefix}:`);
    for (const file of fileList) {
      console.error(`    - ${file}`);
    }
  }
  console.error("");
  console.error(
    "Duplicate prefixes cause undefined migration order on `supabase db push` and can silently skip one of the files (U24 root cause).",
  );
  console.error("");
  console.error("To fix: rename one of the colliding files to a fresh YYYYMMDDHHMMSS prefix that doesn't already exist.");
  console.error("If both files are ALREADY APPLIED on remote, see scripts/check-migration-prefixes.js for the allowlist mechanism.");
  console.error("");
  process.exit(1);
}

main();
