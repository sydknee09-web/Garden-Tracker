import { supabase } from "@/lib/supabase";

/**
 * Generate tasks from due care_schedules.
 * Prevents duplicates via care_schedule_id on the tasks table.
 * Should be called on dashboard load and Active Garden load.
 */
export async function generateCareTasks(userId: string): Promise<number> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    let created = 0;

    // Fetch all active due schedules (both template and non-template)
    const { data: allSchedules, error: fetchErr } = await supabase
      .from("care_schedules")
      .select("id, plant_profile_id, grow_instance_id, title, category, next_due_date, end_date, recurrence_type, interval_days, is_template")
      .eq("user_id", userId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .lte("next_due_date", today);

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

      const { data: existingTasks } = await supabase
        .from("tasks")
        .select("id")
        .eq("user_id", userId)
        .eq("care_schedule_id", s.id)
        .is("completed_at", null)
        .is("deleted_at", null)
        .limit(1);

      if (existingTasks && existingTasks.length > 0) continue;

      const { error } = await supabase.from("tasks").insert({
        user_id: userId,
        plant_profile_id: s.plant_profile_id,
        plant_variety_id: s.plant_profile_id,
        grow_instance_id: s.grow_instance_id,
        category: s.category as "maintenance" | "fertilize" | "prune" | "general",
        due_date: s.next_due_date,
        title: s.title,
        care_schedule_id: s.id,
      });

      if (!error) created++;
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
  } catch (err) {
    console.error("copyCareTemplatesToInstance: unexpected error", err);
  }
}
