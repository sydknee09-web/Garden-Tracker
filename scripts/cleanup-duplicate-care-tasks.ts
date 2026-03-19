/**
 * One-time cleanup: remove duplicate care tasks.
 *
 * 1. OVERDUE duplicates: For each care schedule, keep only the EARLIEST overdue task
 *    (due_date closest to past). Soft-delete the rest.
 * 2. FUTURE duplicates: When a schedule has an overdue pending task, soft-delete
 *    any future pending tasks for that same schedule.
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
  console.log("Logic: (1) Keep only earliest overdue per schedule; (2) Remove future when overdue exists.\n");

  // 1. Fetch all overdue pending tasks
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

  const overdueRows = (overdueTasks ?? []) as TaskRow[];
  if (overdueRows.length === 0) {
    console.log("No overdue pending tasks. Nothing to clean up.");
    return;
  }

  // 2. Overdue duplicates: per schedule, keep earliest (due_date asc), delete the rest
  const overdueBySchedule = new Map<string, TaskRow[]>();
  for (const t of overdueRows) {
    const sid = t.care_schedule_id!;
    if (!overdueBySchedule.has(sid)) overdueBySchedule.set(sid, []);
    overdueBySchedule.get(sid)!.push(t);
  }
  const overdueToDelete: TaskRow[] = [];
  for (const [, arr] of overdueBySchedule) {
    arr.sort((a, b) => a.due_date.localeCompare(b.due_date));
    overdueToDelete.push(...arr.slice(1)); // keep first (earliest), delete rest
  }

  // 3. Future duplicates: for schedules with overdue, delete all future pending tasks
  const scheduleIdsWithOverdue = [...overdueBySchedule.keys()];
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

  const futureToDelete = (futureTasks ?? []) as TaskRow[];
  const allToDelete = [...overdueToDelete, ...futureToDelete];

  if (allToDelete.length === 0) {
    console.log("No duplicate tasks found. Nothing to clean up.");
    return;
  }

  console.log(`Found ${scheduleIdsWithOverdue.length} schedule(s) with overdue pending tasks.`);
  if (overdueToDelete.length > 0) {
    console.log(`Overdue duplicates to remove (keep earliest per schedule): ${overdueToDelete.length}`);
  }
  if (futureToDelete.length > 0) {
    console.log(`Future duplicates to remove: ${futureToDelete.length}`);
  }
  console.log(`Total to remove: ${allToDelete.length}\n`);
  allToDelete.slice(0, 20).forEach((t) => {
    const kind = t.due_date < today ? "overdue" : "future";
    console.log(`  - ${t.due_date} | ${t.title ?? "—"} | ${kind} | schedule ${t.care_schedule_id}`);
  });
  if (allToDelete.length > 20) {
    console.log(`  ... and ${allToDelete.length - 20} more.`);
  }

  if (!confirm) {
    console.log("\nThis was a DRY RUN. No changes made.");
    console.log("To soft-delete these duplicate tasks, run:");
    console.log("  npm run cleanup-duplicate-care-tasks -- --confirm\n");
    return;
  }

  const now = new Date().toISOString();
  const ids = allToDelete.map((t) => t.id);
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
