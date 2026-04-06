import { supabase } from "@/lib/supabase";
import { localDateString, addDays } from "@/lib/calendarDate";

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
      .in("status", ["dead", "archived"])
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
        title: string;
        category: string;
        recurrence_type: string;
        interval_days: number | null;
        months: number[] | null;
        day_of_month: number | null;
        custom_dates: string[] | null;
        notes: string | null;
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
      });
    }
  } catch (err) {
    console.error("copyCareTemplatesToInstance: unexpected error", err);
  }
}
