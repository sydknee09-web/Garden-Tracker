"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { CareScheduleManager } from "@/components/CareScheduleManager";
import type { CascadeTemplateValues } from "@/lib/generateCareTasks";
import type { CareSchedule } from "@/types/garden";

interface Props {
  growInstanceId: string;
  profileId: string | null;
  userId: string;
  /** Hide all add/edit/delete controls (e.g. household-shared read view). */
  readOnly?: boolean;
  /** Care-tab deep-link: scrolls the matching care_schedule into view. */
  focusScheduleId?: string;
}

/**
 * Care tab content for a single grow_instance. Mounts CareScheduleManager in instance-mode:
 *  - Add creates an instance-only schedule (source_template_id null, grow_instance_id set)
 *  - Edit on inherited copy stays in-place (no template cascade back)
 *  - Inherited / Overridden badges render via templateLookup
 */
export function InstanceCareTab({ growInstanceId, profileId, userId, readOnly = false, focusScheduleId }: Props) {
  const [schedules, setSchedules] = useState<CareSchedule[]>([]);
  const [templateLookup, setTemplateLookup] = useState<Map<string, CascadeTemplateValues>>(() => new Map());
  const [loading, setLoading] = useState(true);

  const loadSchedules = useCallback(async () => {
    if (!userId || !growInstanceId) return;
    setLoading(true);

    // Instance-scoped schedules: grow_instance_id matches OR grow_instance_ids array includes this id.
    const { data: scopedRows } = await supabase
      .from("care_schedules")
      .select("*")
      .eq("user_id", userId)
      .eq("grow_instance_id", growInstanceId)
      .is("deleted_at", null);

    // Permanent multi-instance schedules: array contains this instance.
    const { data: arrayRows } = await supabase
      .from("care_schedules")
      .select("*")
      .eq("user_id", userId)
      .contains("grow_instance_ids", [growInstanceId])
      .is("deleted_at", null);

    const merged: CareSchedule[] = [];
    const seen = new Set<string>();
    for (const r of [...(scopedRows ?? []), ...(arrayRows ?? [])]) {
      const row = r as CareSchedule;
      if (!seen.has(row.id)) { seen.add(row.id); merged.push(row); }
    }
    // Q8 lock: sort by next_due_date ASC (nulls last).
    merged.sort((a, b) => {
      const av = a.next_due_date ?? "9999-99-99";
      const bv = b.next_due_date ?? "9999-99-99";
      return av.localeCompare(bv);
    });
    setSchedules(merged);

    // Fetch template values for badge logic (any schedule with source_template_id).
    const templateIds = [...new Set(merged.map((s) => s.source_template_id).filter(Boolean) as string[])];
    if (templateIds.length > 0) {
      const { data: tplRows } = await supabase
        .from("care_schedules")
        .select("id, title, category, recurrence_type, interval_days, months, day_of_month, custom_dates, notes, supply_profile_id, end_date")
        .in("id", templateIds)
        .is("deleted_at", null);
      const next = new Map<string, CascadeTemplateValues>();
      for (const r of tplRows ?? []) {
        const t = r as { id: string } & CascadeTemplateValues;
        next.set(t.id, {
          title: t.title,
          category: t.category,
          recurrence_type: t.recurrence_type,
          interval_days: t.interval_days ?? null,
          months: t.months ?? null,
          day_of_month: t.day_of_month ?? null,
          custom_dates: t.custom_dates ?? null,
          notes: t.notes ?? null,
          supply_profile_id: t.supply_profile_id ?? null,
          end_date: t.end_date ?? null,
        });
      }
      setTemplateLookup(next);
    } else {
      setTemplateLookup(new Map());
    }
    setLoading(false);
  }, [userId, growInstanceId]);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  if (loading && schedules.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
        <p className="text-sm text-neutral-500">Loading care schedules…</p>
      </div>
    );
  }

  // CareScheduleManager requires a non-null profileId for INSERT. If the instance has no
  // profile (rare — only legacy / orphan), fall back to a read-only message rather than crashing.
  if (!profileId) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
        <p className="text-sm text-neutral-500">No care schedules yet.</p>
        <p className="text-xs text-neutral-400 mt-1">Link this plant to a profile to add reminders.</p>
      </div>
    );
  }

  return (
    <CareScheduleManager
      profileId={profileId}
      userId={userId}
      schedules={schedules}
      onChanged={loadSchedules}
      isTemplate={false}
      readOnly={readOnly}
      growInstanceId={growInstanceId}
      templateLookup={templateLookup}
      focusScheduleId={focusScheduleId}
    />
  );
}
