import { supabase } from "@/lib/supabase";

/**
 * Generate tasks from due care_schedules.
 * Prevents duplicates via care_schedule_id on the tasks table.
 * Should be called on dashboard load and Active Garden load.
 */
export async function generateCareTasks(userId: string): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  let created = 0;

  // Get all active, non-template schedules with a next_due_date <= today
  const { data: dueSchedules } = await supabase
    .from("care_schedules")
    .select("id, plant_profile_id, grow_instance_id, title, category, next_due_date, recurrence_type, interval_days")
    .eq("user_id", userId)
    .eq("is_active", true)
    .eq("is_template", false)
    .lte("next_due_date", today);

  if (!dueSchedules?.length) return 0;

  for (const schedule of dueSchedules) {
    const s = schedule as {
      id: string;
      plant_profile_id: string | null;
      grow_instance_id: string | null;
      title: string;
      category: string;
      next_due_date: string;
      recurrence_type: string;
      interval_days: number | null;
    };

    // Check if a task already exists for this schedule and due date (prevent duplicates)
    const { data: existingTasks } = await supabase
      .from("tasks")
      .select("id")
      .eq("user_id", userId)
      .eq("care_schedule_id", s.id)
      .is("completed_at", null)
      .limit(1);

    if (existingTasks && existingTasks.length > 0) continue;

    // Create the task
    const { error } = await supabase.from("tasks").insert({
      user_id: userId,
      plant_profile_id: s.plant_profile_id,
      plant_variety_id: s.plant_profile_id, // for compatibility
      grow_instance_id: s.grow_instance_id,
      category: s.category as "maintenance" | "fertilize" | "prune" | "general",
      due_date: s.next_due_date,
      title: s.title,
      care_schedule_id: s.id,
    });

    if (!error) created++;
  }

  return created;
}

/**
 * After completing a care task, advance the schedule's next_due_date
 * and record the completion.
 */
export async function advanceCareSchedule(
  scheduleId: string,
  userId: string,
): Promise<void> {
  const { data: schedule } = await supabase
    .from("care_schedules")
    .select("id, recurrence_type, interval_days, next_due_date, months, day_of_month")
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
  };

  const now = new Date();
  let nextDue: string | null = null;

  if (s.recurrence_type === "interval" && s.interval_days) {
    const next = new Date(now.getTime() + s.interval_days * 86400000);
    nextDue = next.toISOString().slice(0, 10);
  } else if (s.recurrence_type === "monthly" && s.day_of_month) {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, s.day_of_month);
    nextDue = next.toISOString().slice(0, 10);
  } else if (s.recurrence_type === "yearly" && s.months?.length) {
    const currentMonth = now.getMonth() + 1;
    const futureMonths = s.months.filter((m) => m > currentMonth);
    const nextMonth = futureMonths.length > 0 ? futureMonths[0] : s.months[0];
    const nextYear = futureMonths.length > 0 ? now.getFullYear() : now.getFullYear() + 1;
    nextDue = new Date(nextYear, nextMonth - 1, s.day_of_month ?? 1).toISOString().slice(0, 10);
  } else if (s.recurrence_type === "one_off") {
    // One-off: deactivate after completion
    await supabase
      .from("care_schedules")
      .update({ is_active: false, last_completed_at: now.toISOString() })
      .eq("id", scheduleId)
      .eq("user_id", userId);
    return;
  }

  await supabase
    .from("care_schedules")
    .update({
      next_due_date: nextDue,
      last_completed_at: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", scheduleId)
    .eq("user_id", userId);
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
  const { data: templates } = await supabase
    .from("care_schedules")
    .select("*")
    .eq("plant_profile_id", profileId)
    .eq("user_id", userId)
    .eq("is_template", true)
    .eq("is_active", true);

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

    // Calculate first due date based on sow date
    let nextDue: string | null = null;
    if (tmpl.recurrence_type === "interval" && tmpl.interval_days) {
      const first = new Date(new Date(sowDate).getTime() + tmpl.interval_days * 86400000);
      nextDue = first.toISOString().slice(0, 10);
    } else if (tmpl.recurrence_type === "monthly" && tmpl.day_of_month) {
      const sow = new Date(sowDate);
      nextDue = new Date(sow.getFullYear(), sow.getMonth() + 1, tmpl.day_of_month).toISOString().slice(0, 10);
    }

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
}
