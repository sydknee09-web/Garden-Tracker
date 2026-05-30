import { supabase } from "@/lib/supabase";
import { localDateString, addDays } from "@/lib/calendarDate";
import type { CareSchedule } from "@/types/garden";

type ScheduleForEffectiveIds = {
  grow_instance_ids?: string[] | null;
  grow_instance_id?: string | null;
};

/** Map care_schedules.category to tasks.category (DB CHECK allows a fixed set). */
function taskCategoryFromSchedule(category: string): "maintenance" | "fertilize" | "prune" | "general" | "sow" | "harvest" | "start_seed" | "transplant" | "direct_sow" {
  const c = (category ?? "").toLowerCase();
  const allowed = new Set([
    "sow",
    "harvest",
    "start_seed",
    "transplant",
    "direct_sow",
    "maintenance",
    "fertilize",
    "prune",
    "general",
  ]);
  if (allowed.has(c)) return c as "maintenance" | "fertilize" | "prune" | "general" | "sow" | "harvest" | "start_seed" | "transplant" | "direct_sow";
  if (c === "water" || c === "spray" || c === "repot" || c === "mulch") return "maintenance";
  return "general";
}

/**
 * Returns effective instance IDs for a schedule.
 * - grow_instance_ids non-empty -> those IDs (deduped)
 * - grow_instance_id set -> [id]
 * - else -> null (all plants)
 */
export function getEffectiveInstanceIds(schedule: ScheduleForEffectiveIds): string[] | null {
  const ids = schedule.grow_instance_ids;
  if (ids && ids.length > 0) return [...new Set(ids)];
  const single = schedule.grow_instance_id;
  if (single) return [single];
  return null;
}

/**
 * Generate tasks from due care_schedules.
 * Prevents duplicates via care_schedule_id on the tasks table.
 * Should be called on dashboard load and Active Garden load.
 */
/** Number of days ahead to pre-populate task rows for recurring schedules. */
const RECURRING_WINDOW_DAYS = 30;

export async function generateCareTasks(userId: string): Promise<number> {
  try {
    const today = localDateString();
    const oneYearOut = new Date();
    oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
    const futureLimit = localDateString(oneYearOut);
    let created = 0;

    // Fetch all active schedules due within the next year (so they appear on the calendar).
    // Previously we only fetched next_due_date <= today, which meant future care tasks
    // showed on Home (from care_schedules) but not on Calendar (which only shows tasks).
    const { data: allSchedules, error: fetchErr } = await supabase
      .from("care_schedules")
      .select("id, plant_profile_id, grow_instance_id, grow_instance_ids, title, category, next_due_date, end_date, recurrence_type, interval_days, is_template, supply_profile_id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .lte("next_due_date", futureLimit);

    if (fetchErr) { console.error("generateCareTasks: fetch schedules failed", fetchErr.message); return 0; }
    if (!allSchedules?.length) return 0;

    // Determine which plant profiles are "permanent" so their template schedules
    // (which never get copied to a grow instance) can still generate tasks.
    const templateProfileIds = [
      ...new Set(
        allSchedules
          .filter((s) => (s as { is_template: boolean }).is_template && !(s as { grow_instance_id: string | null }).grow_instance_id)
          .map((s) => (s as { plant_profile_id: string | null }).plant_profile_id)
          .filter(Boolean) as string[]
      ),
    ];

    const permanentProfileIds = new Set<string>();
    if (templateProfileIds.length > 0) {
      const { data: permanentProfiles } = await supabase
        .from("plant_profiles")
        .select("id")
        .in("id", templateProfileIds)
        .eq("profile_type", "permanent");
      (permanentProfiles ?? []).forEach((p: { id: string }) => permanentProfileIds.add(p.id));
    }

    // Include non-template schedules + template schedules on permanent plants with no grow instance
    // Also skip any schedules that have passed their end_date
    const dueSchedules = allSchedules.filter((s) => {
      const sc = s as {
        is_template: boolean;
        grow_instance_id: string | null;
        plant_profile_id: string | null;
        end_date: string | null;
      };
      // Skip schedules that have expired
      if (sc.end_date && sc.end_date < today) return false;
      if (!sc.is_template) return true;
      return !sc.grow_instance_id && sc.plant_profile_id != null && permanentProfileIds.has(sc.plant_profile_id);
    });

    if (!dueSchedules.length) return 0;

    // For permanent schedules with grow_instance_ids, fetch valid instance IDs (non-archived, belong to profile)
    const validInstanceIdsByProfile = new Map<string, Set<string>>();
    const instanceIdsToValidate = new Set<string>();
    for (const s of dueSchedules) {
      const ids = getEffectiveInstanceIds(s as ScheduleForEffectiveIds);
      if (ids?.length && (s as { plant_profile_id: string | null }).plant_profile_id) {
        ids.forEach((id) => instanceIdsToValidate.add(id));
      }
    }
    if (instanceIdsToValidate.size > 0) {
      const { data: instances } = await supabase
        .from("grow_instances")
        .select("id, plant_profile_id")
        .in("id", [...instanceIdsToValidate])
        .is("deleted_at", null)
        .or("status.eq.pending,status.eq.growing,status.eq.harvested");
      for (const inst of instances ?? []) {
        const i = inst as { id: string; plant_profile_id: string | null };
        if (i.plant_profile_id) {
          const set = validInstanceIdsByProfile.get(i.plant_profile_id) ?? new Set();
          set.add(i.id);
          validInstanceIdsByProfile.set(i.plant_profile_id, set);
        }
      }
    }

    // Clean up orphan tasks: schedules whose grow_instance is archived/dead but tasks still exist
    const orphanScheduleIds: string[] = [];
    for (const schedule of dueSchedules) {
      const s = schedule as {
        id: string;
        plant_profile_id: string | null;
        grow_instance_id: string | null;
        grow_instance_ids?: string[] | null;
      };
      const effectiveIds = getEffectiveInstanceIds(s);
      if (effectiveIds?.length && s.plant_profile_id) {
        const valid = validInstanceIdsByProfile.get(s.plant_profile_id);
        const allValid = effectiveIds.every((id) => valid?.has(id));
        if (!allValid) orphanScheduleIds.push(s.id);
      }
    }
    if (orphanScheduleIds.length > 0) {
      // Only clean up pending tasks; preserve completed tasks for care history
      await supabase
        .from("tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("user_id", userId)
        .in("care_schedule_id", orphanScheduleIds)
        .is("completed_at", null)
        .is("deleted_at", null);
    }

    // Pending tasks for dead, archived, or soft-deleted grow instances should not stay on calendar
    const { data: deadOrArchived } = await supabase
      .from("grow_instances")
      .select("id")
      .eq("user_id", userId)
      .eq("status", "archived")
      .is("deleted_at", null);
    const { data: trashedGrows } = await supabase
      .from("grow_instances")
      .select("id")
      .eq("user_id", userId)
      .not("deleted_at", "is", null);
    const badGrowIds = [
      ...new Set([
        ...(deadOrArchived ?? []).map((r: { id: string }) => r.id),
        ...(trashedGrows ?? []).map((r: { id: string }) => r.id),
      ]),
    ];
    if (badGrowIds.length > 0) {
      const nowTomb = new Date().toISOString();
      await supabase
        .from("tasks")
        .update({ deleted_at: nowTomb })
        .eq("user_id", userId)
        .in("grow_instance_id", badGrowIds)
        .is("completed_at", null)
        .is("deleted_at", null);
    }

    // Batch fetch existing tasks for all due schedules: (care_schedule_id, due_date) for pending tasks
    const scheduleIds = dueSchedules.map((s) => (s as { id: string }).id);
    const { data: existingTasks } = await supabase
      .from("tasks")
      .select("care_schedule_id, due_date")
      .eq("user_id", userId)
      .in("care_schedule_id", scheduleIds)
      .is("completed_at", null)
      .is("deleted_at", null);
    const existingByScheduleAndDate = new Map<string, Set<string>>();
    for (const t of existingTasks ?? []) {
      const row = t as { care_schedule_id: string | null; due_date: string };
      if (!row.care_schedule_id) continue;
      const set = existingByScheduleAndDate.get(row.care_schedule_id) ?? new Set();
      set.add(row.due_date);
      existingByScheduleAndDate.set(row.care_schedule_id, set);
    }

    for (const schedule of dueSchedules) {
      const s = schedule as {
        id: string;
        plant_profile_id: string | null;
        grow_instance_id: string | null;
        grow_instance_ids?: string[] | null;
        title: string;
        category: string;
        next_due_date: string;
        recurrence_type: string;
        interval_days: number | null;
        end_date: string | null;
        supply_profile_id?: string | null;
      };
      const taskCategory = taskCategoryFromSchedule(s.category);
      const supplyId = s.supply_profile_id?.trim() ? s.supply_profile_id.trim() : null;

      // For permanent with grow_instance_ids: skip if any instance is stale (archived/deleted)
      const effectiveIds = getEffectiveInstanceIds(s);
      if (effectiveIds?.length && s.plant_profile_id) {
        const valid = validInstanceIdsByProfile.get(s.plant_profile_id);
        const allValid = effectiveIds.every((id) => valid?.has(id));
        if (!allValid) continue;
      }

      const taskGrowInstanceId = effectiveIds?.length === 1 ? effectiveIds[0]! : null;
      const taskTitle = effectiveIds && effectiveIds.length > 1 ? `${s.title} (${effectiveIds.length} plants)` : s.title;

      const isRecurringInterval = s.recurrence_type === "interval" && s.interval_days != null && s.interval_days > 0;
      const existingDates = existingByScheduleAndDate.get(s.id) ?? new Set();
      // If there's any overdue pending task for this schedule, don't create new tasks.
      // Leave the overdue task in the outstanding section until the user completes it.
      const hasOverduePending = [...existingDates].some((d) => d < today);
      if (hasOverduePending) continue;

      const startFrom = s.next_due_date < today ? today : s.next_due_date;

      if (isRecurringInterval) {
        // Pre-populate next RECURRING_WINDOW_DAYS of task rows for this schedule
        const intervalDays: number = s.interval_days ?? 1;
        const toInsert: { due_date: string }[] = [];
        let cursor = startFrom;
        const windowEnd = addDays(today, RECURRING_WINDOW_DAYS);
        while (cursor <= windowEnd) {
          if (s.end_date && cursor > s.end_date) break;
          if (!existingDates.has(cursor)) toInsert.push({ due_date: cursor });
          cursor = addDays(cursor, intervalDays);
        }
        for (const { due_date: taskDueDate } of toInsert) {
          const { error } = await supabase.from("tasks").insert({
            user_id: userId,
            plant_profile_id: s.plant_profile_id,
            grow_instance_id: taskGrowInstanceId,
            category: taskCategory,
            due_date: taskDueDate,
            title: taskTitle,
            care_schedule_id: s.id,
            ...(supplyId ? { supply_profile_id: supplyId } : {}),
          });
          if (!error) created++;
        }
      } else {
        // One-off or non-interval: create single task at next_due_date if missing
        if (existingDates.has(startFrom)) continue;
        const taskDueDate = startFrom;
        const { error } = await supabase.from("tasks").insert({
          user_id: userId,
          plant_profile_id: s.plant_profile_id,
          grow_instance_id: taskGrowInstanceId,
          category: taskCategory,
          due_date: taskDueDate,
          title: taskTitle,
          care_schedule_id: s.id,
          ...(supplyId ? { supply_profile_id: supplyId } : {}),
        });
        if (!error) created++;
      }
    }

    return created;
  } catch (err) {
    console.error("generateCareTasks: unexpected error", err);
    return 0;
  }
}

/**
 * After completing a care task, advance the schedule's next_due_date
 * and record the completion.
 */
export async function advanceCareSchedule(
  scheduleId: string,
  userId: string,
): Promise<void> {
  try {
    const { data: schedule } = await supabase
      .from("care_schedules")
      .select("id, recurrence_type, interval_days, next_due_date, months, day_of_month, end_date")
      .eq("id", scheduleId)
      .eq("user_id", userId)
      .single();

    if (!schedule) return;

    const s = schedule as {
      recurrence_type: string;
      interval_days: number | null;
      next_due_date: string | null;
      months: number[] | null;
      day_of_month: number | null;
      end_date: string | null;
    };

    const now = new Date();
    let nextDue: string | null = null;

    if (s.recurrence_type === "interval" && s.interval_days != null && s.interval_days > 0) {
      const next = new Date(now.getTime() + s.interval_days * 86400000);
      nextDue = next.toISOString().slice(0, 10);
    } else if (s.recurrence_type === "monthly" && s.day_of_month) {
      const dom = Math.min(s.day_of_month, 28);
      const next = new Date(now.getFullYear(), now.getMonth() + 1, dom);
      nextDue = next.toISOString().slice(0, 10);
    } else if (s.recurrence_type === "yearly" && s.months?.length) {
      const currentMonth = now.getMonth() + 1;
      const futureMonths = s.months.filter((m) => m > currentMonth);
      const nextMonth = futureMonths.length > 0 ? futureMonths[0] : s.months[0];
      const nextYear = futureMonths.length > 0 ? now.getFullYear() : now.getFullYear() + 1;
      const dom = Math.min(s.day_of_month ?? 1, 28);
      nextDue = new Date(nextYear, nextMonth - 1, dom).toISOString().slice(0, 10);
    } else if (s.recurrence_type === "one_off") {
      await supabase
        .from("care_schedules")
        .update({ is_active: false, last_completed_at: now.toISOString() })
        .eq("id", scheduleId)
        .eq("user_id", userId);
      return;
    }

    // If the next due date would exceed the end_date, deactivate the schedule instead
    const isExpired = nextDue != null && s.end_date != null && nextDue > s.end_date;

    await supabase
      .from("care_schedules")
      .update({
        next_due_date: isExpired ? s.end_date : nextDue,
        last_completed_at: now.toISOString(),
        updated_at: now.toISOString(),
        ...(isExpired ? { is_active: false } : {}),
      })
      .eq("id", scheduleId)
      .eq("user_id", userId);

    // Only sweep and regenerate when the schedule is still active (not expired).
    if (!isExpired) {
      const today = localDateString();
      await supabase
        .from("tasks")
        .update({ deleted_at: now.toISOString() })
        .eq("care_schedule_id", scheduleId)
        .eq("user_id", userId)
        .is("completed_at", null)
        .gt("due_date", today)
        .is("deleted_at", null);
      // Regenerate all recurring schedules for this user to keep the calendar in sync.
      await generateCareTasks(userId);
    }
  } catch (err) {
    console.error("advanceCareSchedule: unexpected error", err);
  }
}

// ---------------------------------------------------------------------------
// Phase C C2+C3 — template cascade helpers
// ---------------------------------------------------------------------------

export type CascadeTemplateValues = {
  title: string;
  category: string;
  recurrence_type: string;
  interval_days: number | null;
  months: number[] | null;
  day_of_month: number | null;
  custom_dates: string[] | null;
  notes: string | null;
  supply_profile_id: string | null;
  end_date: string | null;
};

/** Fields compared between an instance-copy and its source template to detect "locally edited". */
const CASCADE_DIFF_FIELDS: ReadonlyArray<keyof CascadeTemplateValues> = [
  "title",
  "category",
  "recurrence_type",
  "interval_days",
  "day_of_month",
  "notes",
  "supply_profile_id",
  "end_date",
];

function arraysEqual(a: number[] | string[] | null, b: number[] | string[] | null): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Returns true when copy diverges from template values on any compared field. */
export function isCopyLocallyEdited(copy: CascadeTemplateValues, template: CascadeTemplateValues): boolean {
  for (const field of CASCADE_DIFF_FIELDS) {
    if ((copy[field] ?? null) !== (template[field] ?? null)) return true;
  }
  if (!arraysEqual(copy.months ?? null, template.months ?? null)) return true;
  if (!arraysEqual(copy.custom_dates ?? null, template.custom_dates ?? null)) return true;
  return false;
}

/** Compute next_due_date FROM TODAY for a freshly cascaded copy (Q3 = from today, not sow_date). */
export function computeCascadeNextDueDate(template: CascadeTemplateValues): string | null {
  const today = new Date();
  if (template.recurrence_type === "interval" && template.interval_days != null && template.interval_days > 0) {
    const next = new Date(today.getTime() + template.interval_days * 86400000);
    return localDateString(next);
  }
  if (template.recurrence_type === "monthly" && template.day_of_month) {
    const dom = Math.min(template.day_of_month, 28);
    const next = new Date(today.getFullYear(), today.getMonth() + 1, dom);
    return localDateString(next);
  }
  if (template.recurrence_type === "yearly" && template.months?.length) {
    const currentMonth = today.getMonth() + 1;
    const futureMonths = template.months.filter((m) => m > currentMonth);
    const nextMonth = futureMonths.length > 0 ? futureMonths[0]! : template.months[0]!;
    const nextYear = futureMonths.length > 0 ? today.getFullYear() : today.getFullYear() + 1;
    const dom = Math.min(template.day_of_month ?? 1, 28);
    return localDateString(new Date(nextYear, nextMonth - 1, dom));
  }
  if (template.recurrence_type === "one_off" && template.interval_days != null && template.interval_days > 0) {
    const next = new Date(today.getTime() + template.interval_days * 86400000);
    return localDateString(next);
  }
  return null;
}

/** Fetch grow_instance ids eligible for cascade on a profile: status active, not soft-deleted. */
export async function fetchEligibleInstanceIdsForProfile(profileId: string, userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("grow_instances")
    .select("id")
    .eq("plant_profile_id", profileId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("status", ["pending", "growing", "harvested"]);
  if (error) {
    console.error("fetchEligibleInstanceIdsForProfile: query failed", error.message);
    return [];
  }
  return (data ?? []).map((r) => (r as { id: string }).id);
}

/**
 * C2 — Apply a newly created profile template to existing eligible instances.
 * Returns the count of instance-copies created (excludes any that errored).
 * Skips instances that already have a copy of this template (defensive against double-apply).
 */
export async function applyTemplateCreateCascade(
  template: CareSchedule,
  eligibleInstanceIds: string[],
  userId: string,
): Promise<number> {
  if (!eligibleInstanceIds.length) return 0;

  const { data: existingCopies } = await supabase
    .from("care_schedules")
    .select("grow_instance_id")
    .eq("source_template_id", template.id)
    .eq("user_id", userId)
    .is("deleted_at", null);
  const alreadyCovered = new Set(
    (existingCopies ?? []).map((r) => (r as { grow_instance_id: string | null }).grow_instance_id).filter(Boolean) as string[],
  );

  const targets = eligibleInstanceIds.filter((id) => !alreadyCovered.has(id));
  if (!targets.length) return 0;

  const templateValues: CascadeTemplateValues = {
    title: template.title,
    category: template.category,
    recurrence_type: template.recurrence_type,
    interval_days: template.interval_days ?? null,
    months: template.months ?? null,
    day_of_month: template.day_of_month ?? null,
    custom_dates: template.custom_dates ?? null,
    notes: template.notes ?? null,
    supply_profile_id: template.supply_profile_id ?? null,
    end_date: template.end_date ?? null,
  };
  const nextDue = computeCascadeNextDueDate(templateValues);

  let created = 0;
  for (const instanceId of targets) {
    if (template.recurrence_type === "one_off" && !nextDue) continue;
    const { error } = await supabase.from("care_schedules").insert({
      plant_profile_id: template.plant_profile_id,
      grow_instance_id: instanceId,
      user_id: userId,
      title: templateValues.title,
      category: templateValues.category,
      recurrence_type: templateValues.recurrence_type,
      interval_days: templateValues.interval_days,
      months: templateValues.months,
      day_of_month: templateValues.day_of_month,
      custom_dates: templateValues.custom_dates,
      next_due_date: nextDue,
      is_active: true,
      is_template: false,
      notes: templateValues.notes,
      supply_profile_id: templateValues.supply_profile_id,
      end_date: templateValues.end_date,
      source_template_id: template.id,
    });
    if (!error) created++;
    else console.error("applyTemplateCreateCascade: insert failed", error.message);
  }
  return created;
}

/**
 * C3 — Apply an edited profile template to existing eligible instance-copies.
 * `oldTemplateValues` is the pre-edit snapshot used to detect locally-edited copies.
 * `forceOverwrite=true` updates ALL copies including locally-edited ones; default (false) preserves local edits.
 * Returns { updated, skippedLocallyEdited }.
 */
export async function applyTemplateEditCascade(
  template: CareSchedule,
  oldTemplateValues: CascadeTemplateValues,
  userId: string,
  forceOverwrite: boolean,
): Promise<{ updated: number; skippedLocallyEdited: number }> {
  const eligibleInstanceIds = template.plant_profile_id
    ? await fetchEligibleInstanceIdsForProfile(template.plant_profile_id, userId)
    : [];
  if (!eligibleInstanceIds.length) return { updated: 0, skippedLocallyEdited: 0 };

  const { data: copies, error: copiesErr } = await supabase
    .from("care_schedules")
    .select("id, title, category, recurrence_type, interval_days, months, day_of_month, custom_dates, notes, supply_profile_id, end_date, grow_instance_id")
    .eq("source_template_id", template.id)
    .eq("user_id", userId)
    .eq("is_template", false)
    .is("deleted_at", null);
  if (copiesErr) {
    console.error("applyTemplateEditCascade: copies fetch failed", copiesErr.message);
    return { updated: 0, skippedLocallyEdited: 0 };
  }

  const eligibleSet = new Set(eligibleInstanceIds);
  const eligibleCopies = (copies ?? []).filter((c) => {
    const giId = (c as { grow_instance_id: string | null }).grow_instance_id;
    return giId != null && eligibleSet.has(giId);
  });

  const newValues: CascadeTemplateValues = {
    title: template.title,
    category: template.category,
    recurrence_type: template.recurrence_type,
    interval_days: template.interval_days ?? null,
    months: template.months ?? null,
    day_of_month: template.day_of_month ?? null,
    custom_dates: template.custom_dates ?? null,
    notes: template.notes ?? null,
    supply_profile_id: template.supply_profile_id ?? null,
    end_date: template.end_date ?? null,
  };

  let updated = 0;
  let skippedLocallyEdited = 0;
  for (const copy of eligibleCopies) {
    const copyValues: CascadeTemplateValues = {
      title: (copy as { title: string }).title,
      category: (copy as { category: string }).category,
      recurrence_type: (copy as { recurrence_type: string }).recurrence_type,
      interval_days: (copy as { interval_days: number | null }).interval_days,
      months: (copy as { months: number[] | null }).months,
      day_of_month: (copy as { day_of_month: number | null }).day_of_month,
      custom_dates: (copy as { custom_dates: string[] | null }).custom_dates,
      notes: (copy as { notes: string | null }).notes,
      supply_profile_id: (copy as { supply_profile_id: string | null }).supply_profile_id,
      end_date: (copy as { end_date: string | null }).end_date,
    };
    const locallyEdited = isCopyLocallyEdited(copyValues, oldTemplateValues);
    if (locallyEdited && !forceOverwrite) {
      skippedLocallyEdited++;
      continue;
    }
    const { error } = await supabase
      .from("care_schedules")
      .update({
        title: newValues.title,
        category: newValues.category,
        recurrence_type: newValues.recurrence_type,
        interval_days: newValues.interval_days,
        months: newValues.months,
        day_of_month: newValues.day_of_month,
        custom_dates: newValues.custom_dates,
        notes: newValues.notes,
        supply_profile_id: newValues.supply_profile_id,
        end_date: newValues.end_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", (copy as { id: string }).id)
      .eq("user_id", userId);
    if (!error) updated++;
    else console.error("applyTemplateEditCascade: update failed", error.message);
  }
  return { updated, skippedLocallyEdited };
}

/**
 * C3 helper — count eligible copies + locally-edited copies for popup display, BEFORE running the cascade.
 * Uses the pre-edit `oldTemplateValues` snapshot to detect locally-edited.
 */
export async function countEditCascadeTargets(
  templateId: string,
  profileId: string | null,
  oldTemplateValues: CascadeTemplateValues,
  userId: string,
): Promise<{ eligibleCount: number; locallyEditedCount: number }> {
  if (!profileId) return { eligibleCount: 0, locallyEditedCount: 0 };
  const eligibleInstanceIds = await fetchEligibleInstanceIdsForProfile(profileId, userId);
  if (!eligibleInstanceIds.length) return { eligibleCount: 0, locallyEditedCount: 0 };

  const { data: copies } = await supabase
    .from("care_schedules")
    .select("id, title, category, recurrence_type, interval_days, months, day_of_month, custom_dates, notes, supply_profile_id, end_date, grow_instance_id")
    .eq("source_template_id", templateId)
    .eq("user_id", userId)
    .eq("is_template", false)
    .is("deleted_at", null);

  const eligibleSet = new Set(eligibleInstanceIds);
  const eligibleCopies = (copies ?? []).filter((c) => {
    const giId = (c as { grow_instance_id: string | null }).grow_instance_id;
    return giId != null && eligibleSet.has(giId);
  });

  let locallyEditedCount = 0;
  for (const copy of eligibleCopies) {
    const copyValues: CascadeTemplateValues = {
      title: (copy as { title: string }).title,
      category: (copy as { category: string }).category,
      recurrence_type: (copy as { recurrence_type: string }).recurrence_type,
      interval_days: (copy as { interval_days: number | null }).interval_days,
      months: (copy as { months: number[] | null }).months,
      day_of_month: (copy as { day_of_month: number | null }).day_of_month,
      custom_dates: (copy as { custom_dates: string[] | null }).custom_dates,
      notes: (copy as { notes: string | null }).notes,
      supply_profile_id: (copy as { supply_profile_id: string | null }).supply_profile_id,
      end_date: (copy as { end_date: string | null }).end_date,
    };
    if (isCopyLocallyEdited(copyValues, oldTemplateValues)) locallyEditedCount++;
  }
  return { eligibleCount: eligibleCopies.length, locallyEditedCount };
}

// ---------------------------------------------------------------------------
// Phase C C5 — Skip-today / Catch-up / Retro-apply helpers
// ---------------------------------------------------------------------------

type RecurrenceLite = {
  recurrence_type: string;
  interval_days?: number | null;
  months?: number[] | null;
  day_of_month?: number | null;
};

/**
 * Compute next_due_date from a baseline Date (today for skip; backdate for retro).
 * Mirrors advanceCareSchedule's recurrence math but parameterized so retro-apply can
 * recompute from a past completion date.
 */
function computeNextDueFromBaseline(s: RecurrenceLite, baseline: Date): string | null {
  if (s.recurrence_type === "interval" && s.interval_days != null && s.interval_days > 0) {
    const next = new Date(baseline.getTime() + s.interval_days * 86400000);
    return localDateString(next);
  }
  if (s.recurrence_type === "monthly" && s.day_of_month) {
    const dom = Math.min(s.day_of_month, 28);
    const next = new Date(baseline.getFullYear(), baseline.getMonth() + 1, dom);
    return localDateString(next);
  }
  if (s.recurrence_type === "yearly" && s.months?.length) {
    const currentMonth = baseline.getMonth() + 1;
    const futureMonths = s.months.filter((m) => m > currentMonth);
    const nextMonth = futureMonths.length > 0 ? futureMonths[0]! : s.months[0]!;
    const nextYear = futureMonths.length > 0 ? baseline.getFullYear() : baseline.getFullYear() + 1;
    const dom = Math.min(s.day_of_month ?? 1, 28);
    return localDateString(new Date(nextYear, nextMonth - 1, dom));
  }
  return null;
}

/**
 * Build the list of overdue occurrence dates for a schedule between its next_due_date
 * and today (inclusive of next_due_date, exclusive of today). Capped at `cap` (default 12)
 * so a year of missed weeklies doesn't explode the UI.
 */
export function buildOverdueOccurrenceDates(
  s: RecurrenceLite & { next_due_date?: string | null },
  today: string,
  cap = 12,
): string[] {
  if (!s.next_due_date || s.next_due_date >= today) return [];
  if (s.recurrence_type === "one_off") return [s.next_due_date];
  const dates: string[] = [];
  if (s.recurrence_type === "interval" && s.interval_days != null && s.interval_days > 0) {
    let cursor = s.next_due_date;
    while (cursor < today && dates.length < cap) {
      dates.push(cursor);
      cursor = addDays(cursor, s.interval_days);
    }
    return dates;
  }
  if (s.recurrence_type === "monthly" && s.day_of_month) {
    const dom = Math.min(s.day_of_month, 28);
    let cursor = new Date(s.next_due_date + "T12:00:00");
    const todayDate = new Date(today + "T12:00:00");
    while (cursor < todayDate && dates.length < cap) {
      dates.push(localDateString(cursor));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, dom);
    }
    return dates;
  }
  if (s.recurrence_type === "yearly" && s.months?.length) {
    let cursor = new Date(s.next_due_date + "T12:00:00");
    const todayDate = new Date(today + "T12:00:00");
    const dom = Math.min(s.day_of_month ?? 1, 28);
    while (cursor < todayDate && dates.length < cap) {
      dates.push(localDateString(cursor));
      cursor = new Date(cursor.getFullYear() + 1, cursor.getMonth(), dom);
    }
    return dates;
  }
  return [s.next_due_date];
}

/**
 * C5 Skip — soft-delete the soonest pending occurrence + advance next_due_date FROM TODAY.
 * Does NOT update last_completed_at (skip != complete).
 * one_off recurrence is deactivated outright per advanceCareSchedule precedent.
 */
export async function skipNextCareOccurrence(scheduleId: string, userId: string): Promise<void> {
  try {
    const { data: schedule } = await supabase
      .from("care_schedules")
      .select("id, recurrence_type, interval_days, next_due_date, months, day_of_month, end_date")
      .eq("id", scheduleId)
      .eq("user_id", userId)
      .single();
    if (!schedule) return;

    const s = schedule as RecurrenceLite & {
      next_due_date: string | null;
      end_date: string | null;
    };

    const now = new Date();
    const nowISO = now.toISOString();
    const today = localDateString();

    const { data: pendingTasks } = await supabase
      .from("tasks")
      .select("id, due_date")
      .eq("care_schedule_id", scheduleId)
      .eq("user_id", userId)
      .is("completed_at", null)
      .is("deleted_at", null)
      .order("due_date", { ascending: true })
      .limit(1);
    if (pendingTasks && pendingTasks.length > 0) {
      await supabase
        .from("tasks")
        .update({ deleted_at: nowISO })
        .eq("id", (pendingTasks[0] as { id: string }).id)
        .eq("user_id", userId);
    }

    if (s.recurrence_type === "one_off") {
      await supabase
        .from("care_schedules")
        .update({ is_active: false, updated_at: nowISO })
        .eq("id", scheduleId)
        .eq("user_id", userId);
      return;
    }

    const nextDue = computeNextDueFromBaseline(s, now);
    const isExpired = nextDue != null && s.end_date != null && nextDue > s.end_date;

    await supabase
      .from("care_schedules")
      .update({
        next_due_date: isExpired ? s.end_date : nextDue,
        updated_at: nowISO,
        ...(isExpired ? { is_active: false } : {}),
      })
      .eq("id", scheduleId)
      .eq("user_id", userId);

    if (!isExpired) {
      await supabase
        .from("tasks")
        .update({ deleted_at: nowISO })
        .eq("care_schedule_id", scheduleId)
        .eq("user_id", userId)
        .is("completed_at", null)
        .gt("due_date", today)
        .is("deleted_at", null);
      await generateCareTasks(userId);
    }
  } catch (err) {
    console.error("skipNextCareOccurrence: unexpected error", err);
  }
}

/**
 * C5 Catch-up — apply a per-occurrence list of complete/skip decisions for overdue dates,
 * then advance next_due_date FROM TODAY. Inserts backdated task rows with completed_at set
 * for "complete" decisions (preserves history). Skipped occurrences just bump the schedule.
 * Existing overdue pending tasks for this schedule are swept first to avoid double-up.
 */
export async function catchUpCareSchedule(
  scheduleId: string,
  userId: string,
  decisions: { date: string; action: "complete" | "skip" }[],
): Promise<{ completed: number; skipped: number }> {
  try {
    const { data: schedule } = await supabase
      .from("care_schedules")
      .select("id, plant_profile_id, grow_instance_id, grow_instance_ids, title, category, recurrence_type, interval_days, next_due_date, months, day_of_month, end_date, supply_profile_id")
      .eq("id", scheduleId)
      .eq("user_id", userId)
      .single();
    if (!schedule) return { completed: 0, skipped: 0 };

    const s = schedule as RecurrenceLite & {
      id: string;
      plant_profile_id: string | null;
      grow_instance_id: string | null;
      grow_instance_ids: string[] | null;
      title: string;
      category: string;
      next_due_date: string | null;
      end_date: string | null;
      supply_profile_id: string | null;
    };

    const now = new Date();
    const nowISO = now.toISOString();
    const today = localDateString();
    const taskCategory = taskCategoryFromSchedule(s.category);
    const supplyId = s.supply_profile_id?.trim() ? s.supply_profile_id.trim() : null;
    const effectiveIds = getEffectiveInstanceIds(s);
    const taskGrowInstanceId = effectiveIds?.length === 1 ? effectiveIds[0]! : null;
    const taskTitle = effectiveIds && effectiveIds.length > 1
      ? `${s.title} (${effectiveIds.length} plants)`
      : s.title;

    await supabase
      .from("tasks")
      .update({ deleted_at: nowISO })
      .eq("care_schedule_id", scheduleId)
      .eq("user_id", userId)
      .is("completed_at", null)
      .lt("due_date", today)
      .is("deleted_at", null);

    let completed = 0;
    let skipped = 0;
    let lastCompletedAt: string | null = null;
    for (const d of decisions) {
      if (d.action === "complete") {
        const completedAtISO = new Date(d.date + "T12:00:00").toISOString();
        const { error } = await supabase.from("tasks").insert({
          user_id: userId,
          plant_profile_id: s.plant_profile_id,
          grow_instance_id: taskGrowInstanceId,
          category: taskCategory,
          due_date: d.date,
          title: taskTitle,
          care_schedule_id: scheduleId,
          completed_at: completedAtISO,
          ...(supplyId ? { supply_profile_id: supplyId } : {}),
        });
        if (!error) {
          completed++;
          if (lastCompletedAt == null || completedAtISO > lastCompletedAt) lastCompletedAt = completedAtISO;
        } else {
          console.error("catchUpCareSchedule: insert failed", error.message);
        }
      } else {
        skipped++;
      }
    }

    if (s.recurrence_type === "one_off") {
      await supabase
        .from("care_schedules")
        .update({
          is_active: false,
          ...(lastCompletedAt ? { last_completed_at: lastCompletedAt } : {}),
          updated_at: nowISO,
        })
        .eq("id", scheduleId)
        .eq("user_id", userId);
      return { completed, skipped };
    }

    const nextDue = computeNextDueFromBaseline(s, now);
    const isExpired = nextDue != null && s.end_date != null && nextDue > s.end_date;
    await supabase
      .from("care_schedules")
      .update({
        next_due_date: isExpired ? s.end_date : nextDue,
        ...(lastCompletedAt ? { last_completed_at: lastCompletedAt } : {}),
        updated_at: nowISO,
        ...(isExpired ? { is_active: false } : {}),
      })
      .eq("id", scheduleId)
      .eq("user_id", userId);

    if (!isExpired) {
      await supabase
        .from("tasks")
        .update({ deleted_at: nowISO })
        .eq("care_schedule_id", scheduleId)
        .eq("user_id", userId)
        .is("completed_at", null)
        .gt("due_date", today)
        .is("deleted_at", null);
      await generateCareTasks(userId);
    }
    return { completed, skipped };
  } catch (err) {
    console.error("catchUpCareSchedule: unexpected error", err);
    return { completed: 0, skipped: 0 };
  }
}

/**
 * C5 Retro-apply — log a completion at a past date and recompute next_due_date FROM
 * the back-dated completion. Inserts a backdated completed task row for history.
 * one_off recurrence is deactivated (completion is the whole point of one_off).
 */
export async function applyRetroactiveCompletion(
  scheduleId: string,
  userId: string,
  completedDate: string,
): Promise<void> {
  try {
    const { data: schedule } = await supabase
      .from("care_schedules")
      .select("id, plant_profile_id, grow_instance_id, grow_instance_ids, title, category, recurrence_type, interval_days, next_due_date, months, day_of_month, end_date, supply_profile_id")
      .eq("id", scheduleId)
      .eq("user_id", userId)
      .single();
    if (!schedule) return;

    const s = schedule as RecurrenceLite & {
      id: string;
      plant_profile_id: string | null;
      grow_instance_id: string | null;
      grow_instance_ids: string[] | null;
      title: string;
      category: string;
      next_due_date: string | null;
      end_date: string | null;
      supply_profile_id: string | null;
    };

    const now = new Date();
    const nowISO = now.toISOString();
    const today = localDateString();
    const completedAtISO = new Date(completedDate + "T12:00:00").toISOString();
    const taskCategory = taskCategoryFromSchedule(s.category);
    const supplyId = s.supply_profile_id?.trim() ? s.supply_profile_id.trim() : null;
    const effectiveIds = getEffectiveInstanceIds(s);
    const taskGrowInstanceId = effectiveIds?.length === 1 ? effectiveIds[0]! : null;
    const taskTitle = effectiveIds && effectiveIds.length > 1
      ? `${s.title} (${effectiveIds.length} plants)`
      : s.title;

    await supabase.from("tasks").insert({
      user_id: userId,
      plant_profile_id: s.plant_profile_id,
      grow_instance_id: taskGrowInstanceId,
      category: taskCategory,
      due_date: completedDate,
      title: taskTitle,
      care_schedule_id: scheduleId,
      completed_at: completedAtISO,
      ...(supplyId ? { supply_profile_id: supplyId } : {}),
    });

    if (s.recurrence_type === "one_off") {
      await supabase
        .from("care_schedules")
        .update({ is_active: false, last_completed_at: completedAtISO, updated_at: nowISO })
        .eq("id", scheduleId)
        .eq("user_id", userId);
      return;
    }

    const baseline = new Date(completedDate + "T12:00:00");
    const nextDue = computeNextDueFromBaseline(s, baseline);
    const isExpired = nextDue != null && s.end_date != null && nextDue > s.end_date;

    await supabase
      .from("care_schedules")
      .update({
        next_due_date: isExpired ? s.end_date : nextDue,
        last_completed_at: completedAtISO,
        updated_at: nowISO,
        ...(isExpired ? { is_active: false } : {}),
      })
      .eq("id", scheduleId)
      .eq("user_id", userId);

    if (!isExpired) {
      await supabase
        .from("tasks")
        .update({ deleted_at: nowISO })
        .eq("care_schedule_id", scheduleId)
        .eq("user_id", userId)
        .is("completed_at", null)
        .gt("due_date", today)
        .is("deleted_at", null);
      await generateCareTasks(userId);
    }
  } catch (err) {
    console.error("applyRetroactiveCompletion: unexpected error", err);
  }
}

/**
 * Copy care_schedule templates from a profile to a new grow instance.
 * Called during the Plant flow.
 */
export async function copyCareTemplatesToInstance(
  profileId: string,
  growInstanceId: string,
  userId: string,
  sowDate: string,
): Promise<void> {
  try {
    const { data: templates } = await supabase
      .from("care_schedules")
      .select("*")
      .eq("plant_profile_id", profileId)
      .eq("user_id", userId)
      .eq("is_template", true)
      .eq("is_active", true)
      .is("deleted_at", null);

    if (!templates?.length) return;

    for (const t of templates) {
      const tmpl = t as {
        id: string;
        title: string;
        category: string;
        recurrence_type: string;
        interval_days: number | null;
        months: number[] | null;
        day_of_month: number | null;
        custom_dates: string[] | null;
        notes: string | null;
        supply_profile_id: string | null;
        end_date: string | null;
      };

      let nextDue: string | null = null;
      if (tmpl.recurrence_type === "interval" && tmpl.interval_days != null && tmpl.interval_days > 0) {
        const first = new Date(new Date(sowDate).getTime() + tmpl.interval_days * 86400000);
        nextDue = first.toISOString().slice(0, 10);
      } else if (tmpl.recurrence_type === "monthly" && tmpl.day_of_month) {
        const sow = new Date(sowDate);
        const dom = Math.min(tmpl.day_of_month, 28);
        nextDue = new Date(sow.getFullYear(), sow.getMonth() + 1, dom).toISOString().slice(0, 10);
      } else if (tmpl.recurrence_type === "one_off" && tmpl.interval_days != null && tmpl.interval_days > 0) {
        const first = new Date(new Date(sowDate).getTime() + tmpl.interval_days * 86400000);
        nextDue = first.toISOString().slice(0, 10);
      } else if (tmpl.recurrence_type === "yearly" && tmpl.months?.length) {
        const sow = new Date(sowDate);
        const sowMonth = sow.getMonth() + 1;
        const dom = Math.min(tmpl.day_of_month ?? 1, 28);
        const futureMonths = tmpl.months.filter((m) => m >= sowMonth);
        const nextMonth = futureMonths.length > 0 ? futureMonths[0]! : tmpl.months[0]!;
        const nextYear = futureMonths.length > 0 ? sow.getFullYear() : sow.getFullYear() + 1;
        nextDue = new Date(nextYear, nextMonth - 1, dom).toISOString().slice(0, 10);
      }

      if (tmpl.recurrence_type === "one_off" && !nextDue) continue;

      await supabase.from("care_schedules").insert({
        plant_profile_id: profileId,
        grow_instance_id: growInstanceId,
        user_id: userId,
        title: tmpl.title,
        category: tmpl.category,
        recurrence_type: tmpl.recurrence_type,
        interval_days: tmpl.interval_days,
        months: tmpl.months,
        day_of_month: tmpl.day_of_month,
        custom_dates: tmpl.custom_dates,
        next_due_date: nextDue,
        is_active: true,
        is_template: false,
        notes: tmpl.notes,
        supply_profile_id: tmpl.supply_profile_id,
        end_date: tmpl.end_date,
        source_template_id: tmpl.id,
      });
    }
  } catch (err) {
    console.error("copyCareTemplatesToInstance: unexpected error", err);
  }
}
