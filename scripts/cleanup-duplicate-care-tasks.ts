/**
 * One-time cleanup: remove duplicate care tasks.
 *
 * When a care schedule has an overdue pending task (due_date < today, not completed),
 * this script soft-deletes any future pending tasks for that same schedule.
 * Those future tasks were created by the old generateCareTasks logic before we fixed
 * the "don't create new tasks when overdue exists" behavior.
 *
 * Prerequisites: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Run:
 *   npm run cleanup-duplicate-care-tasks              (dry run: list duplicates, no changes)
 *   npm run cleanup-duplicate-care-tasks -- --confirm  (soft-delete duplicates)
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

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

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
const SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

function localDateString(d?: Date): string {
  const x = d ?? new Date();
  return x.toISOString().slice(0, 10);
}

interface TaskRow {
  id: string;
  care_schedule_id: string | null;
  due_date: string;
  title: string | null;
  user_id: string | null;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const confirm = args.includes("--confirm");

  const today = localDateString();
  console.log("\n🧹 Cleanup duplicate care tasks (one-time)\n");
  console.log("Today:", today);
  console.log("Logic: For schedules with an overdue pending task, soft-delete future pending tasks.\n");

  // 1. Find care_schedule_ids that have at least one overdue pending task
  const { data: overdueTasks, error: overdueErr } = await admin
    .from("tasks")
    .select("id, care_schedule_id, due_date, title, user_id")
    .is("deleted_at", null)
    .is("completed_at", null)
    .lt("due_date", today)
    .not("care_schedule_id", "is", null);

  if (overdueErr) {
    console.error("Failed to fetch overdue tasks:", overdueErr.message);
    process.exit(1);
  }

  const scheduleIdsWithOverdue = [...new Set((overdueTasks ?? []).map((t) => (t as TaskRow).care_schedule_id!).filter(Boolean))] as string[];
  if (scheduleIdsWithOverdue.length === 0) {
    console.log("No schedules with overdue pending tasks. Nothing to clean up.");
    return;
  }

  // 2. Find future pending tasks for those schedules
  const { data: futureTasks, error: futureErr } = await admin
    .from("tasks")
    .select("id, care_schedule_id, due_date, title, user_id")
    .is("deleted_at", null)
    .is("completed_at", null)
    .gte("due_date", today)
    .in("care_schedule_id", scheduleIdsWithOverdue);

  if (futureErr) {
    console.error("Failed to fetch future tasks:", futureErr.message);
    process.exit(1);
  }

  const toDelete = (futureTasks ?? []) as TaskRow[];
  if (toDelete.length === 0) {
    console.log("No duplicate future tasks found. Nothing to clean up.");
    return;
  }

  console.log(`Found ${scheduleIdsWithOverdue.length} schedule(s) with overdue pending tasks.`);
  console.log(`Found ${toDelete.length} future pending task(s) to remove (duplicates):\n`);
  toDelete.slice(0, 15).forEach((t) => {
    console.log(`  - ${t.due_date} | ${t.title ?? "—"} | schedule ${t.care_schedule_id}`);
  });
  if (toDelete.length > 15) {
    console.log(`  ... and ${toDelete.length - 15} more.`);
  }

  if (!confirm) {
    console.log("\nThis was a DRY RUN. No changes made.");
    console.log("To soft-delete these duplicate tasks, run:");
    console.log("  npm run cleanup-duplicate-care-tasks -- --confirm\n");
    return;
  }

  const now = new Date().toISOString();
  const ids = toDelete.map((t) => t.id);
  const BATCH = 100;
  let deleted = 0;
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { error: updateErr } = await admin
      .from("tasks")
      .update({ deleted_at: now })
      .in("id", batch);
    if (updateErr) {
      console.error("Failed to soft-delete batch:", updateErr.message);
      process.exit(1);
    }
    deleted += batch.length;
  }
  console.log(`\nSoft-deleted ${deleted} duplicate task(s).`);
  console.log("Done.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
