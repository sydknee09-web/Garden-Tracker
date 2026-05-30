"use client";

import { useState, useCallback, useEffect } from "react";
import { ICON_MAP } from "@/lib/styleDictionary";
import { supabase } from "@/lib/supabase";
import { formatAddFlowError } from "@/lib/addFlowError";
import { insertWithOfflineQueue, updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { useHousehold } from "@/contexts/HouseholdContext";
import {
  applyRetroactiveCompletion,
  applyTemplateCreateCascade,
  applyTemplateEditCascade,
  buildOverdueOccurrenceDates,
  catchUpCareSchedule,
  countEditCascadeTargets,
  fetchEligibleInstanceIdsForProfile,
  generateCareTasks,
  isCopyLocallyEdited,
  skipNextCareOccurrence,
  type CascadeTemplateValues,
} from "@/lib/generateCareTasks";
import { localDateString } from "@/lib/calendarDate";
import { CareCascadeConfirm, type CascadeAction } from "@/components/CareCascadeConfirm";
import type { CareSchedule, GrowInstance, SupplyProfile } from "@/types/garden";

const CARE_CATEGORIES = ["fertilize", "prune", "water", "spray", "repot", "harvest", "mulch", "other"] as const;
const RECURRENCE_TYPES = [
  { value: "interval", label: "Every X days" },
  { value: "monthly", label: "Monthly (specific day)" },
  { value: "yearly", label: "Yearly (specific month)" },
  { value: "one_off", label: "One-time" },
] as const;
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

interface Props {
  profileId: string;
  userId: string;
  schedules: CareSchedule[];
  onChanged: () => void;
  /** False for permanent plants — schedules are active immediately, not copy-on-plant templates. */
  isTemplate?: boolean;
  /** When true, hides all add/edit/delete controls (e.g. for household members viewing someone else's profile). */
  readOnly?: boolean;
  /** For permanent plants: list of grow_instances (individual plants). When length > 1, show "Apply to" selector. */
  growInstances?: GrowInstance[];
  /** When true, this is a permanent plant profile (trees, perennials). */
  isPermanent?: boolean;
  /** Rendered next to the Add button (e.g. Get AI suggestions). */
  extraActions?: React.ReactNode;
  /** When set, scrolls the matching schedule into view once it's rendered (used for calendar deep-link). */
  focusScheduleId?: string;
  /** Instance-level mode: when set, new schedules attach to this grow_instance_id (NOT a template). */
  growInstanceId?: string;
  /** Instance-level mode: lookup map of source_template_id → original template values, for Inherited/Overridden badge logic. */
  templateLookup?: Map<string, CascadeTemplateValues>;
}

const SUPPLY_CATEGORY_LABELS: Record<string, string> = {
  fertilizer: "Fertilizer",
  pesticide: "Pesticide",
  soil_amendment: "Soil amendment",
  other: "Other",
};

export function CareScheduleManager({ profileId, userId, schedules, onChanged, isTemplate = true, readOnly = false, growInstances = [], isPermanent = false, extraActions, focusScheduleId, growInstanceId, templateLookup }: Props) {
  const { viewMode: householdViewMode } = useHousehold();
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [supplies, setSupplies] = useState<SupplyProfile[]>([]);

  // Form state
  const [title, setTitle] = useState("");
  const [supplyProfileId, setSupplyProfileId] = useState<string | null>(null);
  /** For permanent: null = all plants, [id1, id2] = specific plants. Only shown when growInstances.length > 1. */
  const [selectedPlantIds, setSelectedPlantIds] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<string>("fertilize");
  const [recurrenceType, setRecurrenceType] = useState<string>("interval");
  const [intervalDays, setIntervalDays] = useState("30");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [nextDueDate, setNextDueDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const resetForm = useCallback(() => {
    setTitle(""); setCategory("fertilize"); setRecurrenceType("interval");
    setIntervalDays("30"); setDayOfMonth("1"); setSelectedMonths([]);
    setNextDueDate(new Date().toISOString().slice(0, 10)); setNotes("");
    setSelectedPlantIds(new Set()); setSupplyProfileId(null);
    setShowAdd(false); setEditingId(null);
  }, []);

  const isFamilyView = householdViewMode === "family";
  const fetchSupplies = useCallback(async () => {
    if (!userId) return;
    let query = supabase
      .from("supply_profiles")
      .select("id, name, brand, category")
      .is("deleted_at", null)
      .order("name", { ascending: true });
    if (!isFamilyView) query = query.eq("user_id", userId);
    const { data } = await query;
    setSupplies((data ?? []) as SupplyProfile[]);
  }, [userId, isFamilyView]);
  useEffect(() => { fetchSupplies(); }, [fetchSupplies]);

  // Calendar deep-link: scroll the focused schedule into view once it's rendered.
  useEffect(() => {
    if (!focusScheduleId) return;
    if (!schedules.some((s) => s.id === focusScheduleId)) return;
    const el = document.getElementById(`schedule-${focusScheduleId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusScheduleId, schedules]);

  const openEdit = useCallback((s: CareSchedule) => {
    setEditingId(s.id);
    setTitle(s.title);
    setCategory(s.category ?? "other");
    setRecurrenceType(s.recurrence_type);
    setIntervalDays(String(s.interval_days ?? 30));
    setDayOfMonth(String(s.day_of_month ?? 1));
    setSelectedMonths(s.months ?? []);
    setNextDueDate(s.next_due_date ? s.next_due_date.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setNotes(s.notes ?? "");
    setSelectedPlantIds((s.grow_instance_ids?.length ? new Set(s.grow_instance_ids) : new Set()) as Set<string>);
    setSupplyProfileId(s.supply_profile_id ?? null);
    setShowAdd(true);
  }, []);

  const togglePlantId = useCallback((plantId: string) => {
    setSelectedPlantIds((prev) => {
      const next = new Set(prev);
      if (next.has(plantId)) next.delete(plantId);
      else next.add(plantId);
      return next;
    });
  }, []);

  const getPlantLabel = useCallback((gi: GrowInstance, idx: number) => gi.location?.trim() || `Plant ${idx + 1}`, []);

  const [saveError, setSaveError] = useState<string | null>(null);

  // C2+C3 cascade popup state — set after a template save succeeds with eligible existing instances.
  const [pendingCascade, setPendingCascade] = useState<{
    action: CascadeAction;
    template: CareSchedule;
    oldValues: CascadeTemplateValues | null;
    eligibleCount: number;
    locallyEditedCount: number;
  } | null>(null);

  const buildTemplateValues = useCallback((s: CareSchedule | undefined): CascadeTemplateValues | null => {
    if (!s) return null;
    return {
      title: s.title,
      category: s.category,
      recurrence_type: s.recurrence_type,
      interval_days: s.interval_days ?? null,
      months: s.months ?? null,
      day_of_month: s.day_of_month ?? null,
      custom_dates: s.custom_dates ?? null,
      notes: s.notes ?? null,
      supply_profile_id: s.supply_profile_id ?? null,
      end_date: s.end_date ?? null,
    };
  }, []);

  const handleSave = useCallback(async () => {
    if (!userId || !title.trim()) return;
    setSaving(true);
    setSaveError(null);

    try {
      const existingForEdit = editingId ? (schedules.find((s) => s.id === editingId) as CareSchedule | undefined) : undefined;
      const oldTemplateSnapshot = editingId ? buildTemplateValues(existingForEdit) : null;
      const effectiveIsTemplate = editingId
        ? (existingForEdit?.is_template ?? isTemplate)
        : isTemplate;

      // Pre-generate id for new rows so cascade can target them without a follow-up read.
      const newId = !editingId && typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : null;

      const payload: Record<string, unknown> = {
        plant_profile_id: profileId,
        user_id: userId,
        title: title.trim(),
        category,
        recurrence_type: recurrenceType,
        interval_days: (recurrenceType === "interval" || recurrenceType === "one_off") ? parseInt(intervalDays) || 30 : null,
        day_of_month: (recurrenceType === "monthly" || recurrenceType === "yearly") ? Math.min(parseInt(dayOfMonth) || 1, 28) : null,
        months: recurrenceType === "yearly" ? selectedMonths : null,
        next_due_date: recurrenceType === "one_off" ? null : (nextDueDate || null),
        notes: notes.trim() || null,
        is_active: true,
        is_template: effectiveIsTemplate,
        supply_profile_id: supplyProfileId || null,
      };
      if (!editingId && newId) payload.id = newId;
      if (isPermanent && growInstances.length > 1) {
        payload.grow_instance_ids = selectedPlantIds.size > 0 ? [...selectedPlantIds] : null;
        payload.grow_instance_id = null;
      } else if (!editingId && growInstanceId) {
        // Instance-level Add (Care tab on GrowInstanceModal): attach the new schedule to this instance only.
        payload.grow_instance_id = growInstanceId;
      }

      const { error } = editingId
        ? await updateWithOfflineQueue("care_schedules", payload, { id: editingId, user_id: userId })
        : await insertWithOfflineQueue("care_schedules", payload);

      if (error) { setSaveError(formatAddFlowError(error)); setSaving(false); return; }

      // Cascade detection — only fires for profile-level templates on permanent-not-with-instance-ids
      // (single-FK templates). Permanent-multi-instance schedules already write directly to instances via
      // grow_instance_ids and don't go through the copy-on-plant flow.
      const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
      const isMultiInstanceWrite = isPermanent && growInstances.length > 1;
      const canCascade = effectiveIsTemplate && !isMultiInstanceWrite && isOnline && profileId;

      if (canCascade) {
        const savedTemplate: CareSchedule = {
          id: editingId ?? (newId ?? ""),
          plant_profile_id: profileId,
          user_id: userId,
          title: title.trim(),
          category,
          recurrence_type: recurrenceType as CareSchedule["recurrence_type"],
          interval_days: (recurrenceType === "interval" || recurrenceType === "one_off") ? parseInt(intervalDays) || 30 : null,
          months: recurrenceType === "yearly" ? selectedMonths : null,
          day_of_month: (recurrenceType === "monthly" || recurrenceType === "yearly") ? Math.min(parseInt(dayOfMonth) || 1, 28) : null,
          custom_dates: existingForEdit?.custom_dates ?? null,
          next_due_date: recurrenceType === "one_off" ? null : (nextDueDate || null),
          notes: notes.trim() || null,
          supply_profile_id: supplyProfileId || null,
          end_date: existingForEdit?.end_date ?? null,
          is_active: true,
          is_template: true,
        };

        if (savedTemplate.id) {
          if (editingId && oldTemplateSnapshot) {
            const counts = await countEditCascadeTargets(savedTemplate.id, profileId, oldTemplateSnapshot, userId);
            if (counts.eligibleCount > 0) {
              setPendingCascade({
                action: "edit",
                template: savedTemplate,
                oldValues: oldTemplateSnapshot,
                eligibleCount: counts.eligibleCount,
                locallyEditedCount: counts.locallyEditedCount,
              });
              resetForm();
              setSaving(false);
              return;
            }
          } else if (!editingId) {
            const eligibleIds = await fetchEligibleInstanceIdsForProfile(profileId, userId);
            if (eligibleIds.length > 0) {
              setPendingCascade({
                action: "create",
                template: savedTemplate,
                oldValues: null,
                eligibleCount: eligibleIds.length,
                locallyEditedCount: 0,
              });
              resetForm();
              setSaving(false);
              return;
            }
          }
        }
      }

      resetForm();
      onChanged();
    } catch (err) {
      setSaveError(formatAddFlowError(err));
    } finally {
      setSaving(false);
    }
  }, [userId, profileId, title, category, recurrenceType, intervalDays, dayOfMonth, selectedMonths, nextDueDate, notes, supplyProfileId, editingId, isPermanent, growInstances.length, selectedPlantIds, schedules, isTemplate, resetForm, onChanged, buildTemplateValues]);

  // C5 — Skip-today / Catch-up / Retro-apply state. Only renders affordances when growInstanceId is set.
  const [skipConfirmId, setSkipConfirmId] = useState<string | null>(null);
  const [skipBusy, setSkipBusy] = useState(false);
  const [catchUpOpenId, setCatchUpOpenId] = useState<string | null>(null);
  const [catchUpDecisions, setCatchUpDecisions] = useState<Map<string, "complete" | "skip">>(() => new Map());
  const [catchUpBusy, setCatchUpBusy] = useState(false);
  const [retroOpenId, setRetroOpenId] = useState<string | null>(null);
  const [retroDate, setRetroDate] = useState<string>(() => localDateString());
  const [retroBusy, setRetroBusy] = useState(false);

  const handleSkipToday = useCallback(async () => {
    const id = skipConfirmId;
    if (!id || !userId) return;
    setSkipBusy(true);
    try {
      await skipNextCareOccurrence(id, userId);
      setSkipConfirmId(null);
      onChanged();
    } catch (err) {
      setSaveError(formatAddFlowError(err));
    } finally {
      setSkipBusy(false);
    }
  }, [skipConfirmId, userId, onChanged]);

  const openCatchUp = useCallback((s: CareSchedule) => {
    const today = localDateString();
    const dates = buildOverdueOccurrenceDates(s, today);
    const next = new Map<string, "complete" | "skip">();
    for (const d of dates) next.set(d, "complete");
    setCatchUpDecisions(next);
    setCatchUpOpenId(s.id);
    setRetroOpenId(null);
  }, []);

  const toggleCatchUpDecision = useCallback((date: string) => {
    setCatchUpDecisions((prev) => {
      const next = new Map(prev);
      next.set(date, prev.get(date) === "complete" ? "skip" : "complete");
      return next;
    });
  }, []);

  const setAllCatchUpDecisions = useCallback((action: "complete" | "skip") => {
    setCatchUpDecisions((prev) => {
      const next = new Map(prev);
      for (const k of next.keys()) next.set(k, action);
      return next;
    });
  }, []);

  const handleCatchUpApply = useCallback(async () => {
    const id = catchUpOpenId;
    if (!id || !userId) return;
    setCatchUpBusy(true);
    try {
      const decisions = [...catchUpDecisions.entries()].map(([date, action]) => ({ date, action }));
      await catchUpCareSchedule(id, userId, decisions);
      setCatchUpOpenId(null);
      setCatchUpDecisions(new Map());
      onChanged();
    } catch (err) {
      setSaveError(formatAddFlowError(err));
    } finally {
      setCatchUpBusy(false);
    }
  }, [catchUpOpenId, catchUpDecisions, userId, onChanged]);

  const openRetro = useCallback((s: CareSchedule) => {
    setRetroDate(s.next_due_date && s.next_due_date < localDateString() ? s.next_due_date : localDateString());
    setRetroOpenId(s.id);
    setCatchUpOpenId(null);
  }, []);

  const handleRetroApply = useCallback(async () => {
    const id = retroOpenId;
    if (!id || !userId || !retroDate) return;
    if (retroDate > localDateString()) {
      setSaveError("Pick today or a past date for a back-dated completion.");
      return;
    }
    setRetroBusy(true);
    try {
      await applyRetroactiveCompletion(id, userId, retroDate);
      setRetroOpenId(null);
      onChanged();
    } catch (err) {
      setSaveError(formatAddFlowError(err));
    } finally {
      setRetroBusy(false);
    }
  }, [retroOpenId, userId, retroDate, onChanged]);

  const handleCascadeCancel = useCallback(() => {
    setPendingCascade(null);
    onChanged();
  }, [onChanged]);

  const handleCascadeApply = useCallback(async (forceOverwrite: boolean) => {
    const cascade = pendingCascade;
    if (!cascade) return;
    if (cascade.action === "create") {
      const eligibleIds = await fetchEligibleInstanceIdsForProfile(profileId, userId);
      await applyTemplateCreateCascade(cascade.template, eligibleIds, userId);
    } else if (cascade.action === "edit" && cascade.oldValues) {
      await applyTemplateEditCascade(cascade.template, cascade.oldValues, userId, forceOverwrite);
    }
    await generateCareTasks(userId);
    setPendingCascade(null);
    onChanged();
  }, [pendingCascade, profileId, userId, onChanged]);

  const handleDelete = useCallback(async (scheduleId: string) => {
    if (!userId) return;
    const schedule = schedules.find((s) => s.id === scheduleId);
    const ownerId = (schedule as { user_id?: string })?.user_id ?? userId;
    try {
      const now = new Date().toISOString();
      const { error } = await updateWithOfflineQueue("care_schedules", { is_active: false, deleted_at: now }, { id: scheduleId, user_id: ownerId });
      if (error) { setSaveError(formatAddFlowError(error)); return; }
      // Cascade: soft-delete tasks generated from this schedule so they don't appear as ghosts on Calendar
      await supabase.from("tasks").update({ deleted_at: now }).eq("care_schedule_id", scheduleId).eq("user_id", ownerId);
      setSaveError(null);
      onChanged();
    } catch (err) {
      setSaveError(formatAddFlowError(err));
    }
  }, [userId, schedules, onChanged]);

  const toggleMonth = useCallback((month: number) => {
    setSelectedMonths((prev) => prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month].sort((a, b) => a - b));
  }, []);

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "fertilize": return "🌿";
      case "prune": return "✂️";
      case "water": return "💧";
      case "spray": return "🧴";
      case "repot": return "🪴";
      case "harvest": return "🧺";
      case "mulch": return "🍂";
      default: return "📋";
    }
  };

  const getRecurrenceLabel = (s: CareSchedule) => {
    if (s.recurrence_type === "interval") return `Every ${s.interval_days} days`;
    if (s.recurrence_type === "monthly") return `Monthly (day ${s.day_of_month})`;
    if (s.recurrence_type === "yearly") return `Yearly: ${(s.months ?? []).map((m) => MONTHS[m - 1]?.slice(0, 3)).join(", ")} (day ${s.day_of_month ?? 1})`;
    if (s.recurrence_type === "one_off" && s.interval_days) return `${s.interval_days} days after planting`;
    return "One-time";
  };

  const getInheritanceBadge = (s: CareSchedule): "inherited" | "overridden" | null => {
    if (!templateLookup) return null;
    const sourceId = s.source_template_id ?? null;
    if (!sourceId) return null;
    const tplValues = templateLookup.get(sourceId);
    if (!tplValues) return null;
    const copyValues: CascadeTemplateValues = {
      title: s.title,
      category: s.category,
      recurrence_type: s.recurrence_type,
      interval_days: s.interval_days ?? null,
      months: s.months ?? null,
      day_of_month: s.day_of_month ?? null,
      custom_dates: s.custom_dates ?? null,
      notes: s.notes ?? null,
      supply_profile_id: s.supply_profile_id ?? null,
      end_date: s.end_date ?? null,
    };
    return isCopyLocallyEdited(copyValues, tplValues) ? "overridden" : "inherited";
  };

  const getApplyToLabel = (s: CareSchedule) => {
    if (!isPermanent || !growInstances.length) return null;
    const ids = s.grow_instance_ids;
    if (!ids?.length) return "All plants";
    const labels = ids.map((id) => {
      const gi = growInstances.find((g) => g.id === id);
      const idx = growInstances.findIndex((g) => g.id === id);
      return gi ? getPlantLabel(gi, idx >= 0 ? idx : 0) : "?";
    });
    return labels.join(", ");
  };

  return (
    <div>
      {saveError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{saveError}</p>}
      {schedules.length === 0 && !showAdd ? (
        <div className="bg-white rounded-xl border border-neutral-100 shadow-sm p-8 text-center">
          <span className="text-3xl mb-3 block" aria-hidden>📋</span>
          <p className="text-neutral-800 font-medium text-sm mb-1">No care schedules yet</p>
          <p className="text-neutral-600 text-sm mb-6">Add recurring reminders like fertilize, prune, or water.</p>
          {readOnly ? null : (
            <div className="flex flex-wrap items-center justify-center gap-3">
              {extraActions}
              <button type="button" onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 bg-white font-medium hover:bg-neutral-50 min-h-[44px] min-w-[44px]">Add Manual</button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 mb-3">
            <p className="text-sm text-neutral-500">{schedules.length} schedule{schedules.length !== 1 ? "s" : ""}</p>
            {!readOnly && !showAdd && (
              <div className="flex items-center gap-2 shrink-0">
                {extraActions}
                <button type="button" onClick={() => setShowAdd(true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 min-h-[44px] min-w-[44px]">+ Add</button>
              </div>
            )}
          </div>
          <div className="space-y-2">
            {schedules.map((s) => (
              <div key={s.id} id={`schedule-${s.id}`} className="bg-white rounded-xl border border-neutral-100 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0" aria-hidden>{getCategoryIcon(s.category ?? "other")}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-neutral-900 text-sm">{s.title}</h4>
                      {(() => {
                        const badge = getInheritanceBadge(s);
                        if (badge === "inherited") return <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">Inherited</span>;
                        if (badge === "overridden") return <span className="text-[10px] font-medium uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">Overridden</span>;
                        return null;
                      })()}
                    </div>
                    <p className="text-xs text-neutral-500 mt-0.5">{getRecurrenceLabel(s)}</p>
                    {getApplyToLabel(s) && (
                      <p className="text-xs text-neutral-600 mt-0.5">Applies to: {getApplyToLabel(s)}</p>
                    )}
                    {s.next_due_date && (
                      <p className="text-xs text-neutral-400 mt-0.5">
                        Next: {new Date(s.next_due_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    )}
                    {s.supply_profile_id && (() => {
                      const supply = supplies.find((sp) => sp.id === s.supply_profile_id);
                      return supply ? (
                        <p className="text-xs text-emerald-600 mt-0.5">Product: {supply.brand?.trim() ? `${supply.name} (${supply.brand})` : supply.name}</p>
                      ) : null;
                    })()}
                  </div>
                  {!readOnly && (
                    <div className="flex gap-1 shrink-0">
                      <button type="button" onClick={() => openEdit(s)} className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50" aria-label="Edit">
                        <ICON_MAP.Edit stroke="currentColor" className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => handleDelete(s.id)} className="p-2 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50" aria-label="Delete">
                        <ICON_MAP.Trash stroke="currentColor" className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                {s.notes && (
                  <div className="mt-3 pt-3 border-t border-neutral-100 -mx-4 px-4">
                    <p className="text-sm text-neutral-600 whitespace-pre-wrap">{s.notes}</p>
                  </div>
                )}

                {growInstanceId && !readOnly && (() => {
                  const today = localDateString();
                  const overdueDates = buildOverdueOccurrenceDates(s, today);
                  const isOverdue = overdueDates.length > 0;
                  const isCatchUpOpen = catchUpOpenId === s.id;
                  const isRetroOpen = retroOpenId === s.id;
                  return (
                    <>
                      <div className="mt-3 pt-3 border-t border-neutral-100 flex flex-wrap items-center gap-2">
                        {isOverdue && (
                          <button
                            type="button"
                            onClick={() => (isCatchUpOpen ? setCatchUpOpenId(null) : openCatchUp(s))}
                            className="px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium hover:bg-amber-100 min-h-[44px]"
                            aria-expanded={isCatchUpOpen}
                            aria-controls={`catchup-${s.id}`}
                          >
                            {overdueDates.length} overdue · {isCatchUpOpen ? "Hide" : "Catch up"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setSkipConfirmId(s.id)}
                          className="px-3 py-1.5 rounded-lg bg-white text-neutral-600 border border-neutral-200 text-xs font-medium hover:bg-neutral-50 min-h-[44px]"
                        >
                          Skip Today
                        </button>
                        <button
                          type="button"
                          onClick={() => (isRetroOpen ? setRetroOpenId(null) : openRetro(s))}
                          className="px-3 py-1.5 rounded-lg bg-white text-neutral-600 border border-neutral-200 text-xs font-medium hover:bg-neutral-50 min-h-[44px]"
                          aria-expanded={isRetroOpen}
                          aria-controls={`retro-${s.id}`}
                        >
                          {isRetroOpen ? "Hide Log" : "Log Past Completion"}
                        </button>
                      </div>

                      {isCatchUpOpen && (
                        <div id={`catchup-${s.id}`} className="mt-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                            <p className="text-xs font-medium text-amber-800">Catch up on {overdueDates.length} missed {overdueDates.length === 1 ? "occurrence" : "occurrences"}</p>
                            <div className="flex gap-1 shrink-0">
                              <button type="button" onClick={() => setAllCatchUpDecisions("complete")} className="px-2 py-1 rounded-lg bg-white text-emerald-700 border border-emerald-200 text-xs font-medium hover:bg-emerald-50 min-h-[44px]">All Done</button>
                              <button type="button" onClick={() => setAllCatchUpDecisions("skip")} className="px-2 py-1 rounded-lg bg-white text-neutral-600 border border-neutral-200 text-xs font-medium hover:bg-neutral-50 min-h-[44px]">Skip All</button>
                            </div>
                          </div>
                          <ul className="space-y-1.5 mb-3">
                            {overdueDates.map((d) => {
                              const action = catchUpDecisions.get(d) ?? "complete";
                              return (
                                <li key={d} className="flex items-center justify-between gap-2 bg-white rounded-lg border border-neutral-200 px-3 py-2">
                                  <span className="text-xs text-neutral-700">{new Date(d + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                                  <button
                                    type="button"
                                    onClick={() => toggleCatchUpDecision(d)}
                                    className={`px-2 py-1 rounded-md text-xs font-medium min-h-[44px] min-w-[88px] ${action === "complete" ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-neutral-100 text-neutral-600 border border-neutral-200"}`}
                                    aria-label={`Mark ${d} as ${action === "complete" ? "done" : "skipped"} — tap to toggle`}
                                  >
                                    {action === "complete" ? "Done" : "Skip"}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                          <div className="flex gap-2 justify-end">
                            <button type="button" onClick={() => setCatchUpOpenId(null)} disabled={catchUpBusy} className="px-3 py-2 rounded-lg border border-neutral-300 text-neutral-700 text-xs font-medium hover:bg-neutral-50 min-h-[44px] disabled:opacity-50">Cancel</button>
                            <button type="button" onClick={handleCatchUpApply} disabled={catchUpBusy} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 min-h-[44px]">
                              {catchUpBusy ? "Applying…" : "Apply"}
                            </button>
                          </div>
                        </div>
                      )}

                      {isRetroOpen && (
                        <div id={`retro-${s.id}`} className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                          <label htmlFor={`retro-date-${s.id}`} className="block text-xs font-medium text-neutral-700 mb-1">Completion date</label>
                          <input
                            id={`retro-date-${s.id}`}
                            type="date"
                            value={retroDate}
                            max={localDateString()}
                            onChange={(e) => setRetroDate(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm min-h-[44px]"
                          />
                          <p className="text-[11px] text-neutral-500 mt-1">Schedule advances from this date.</p>
                          <div className="flex gap-2 justify-end mt-3">
                            <button type="button" onClick={() => setRetroOpenId(null)} disabled={retroBusy} className="px-3 py-2 rounded-lg border border-neutral-300 text-neutral-700 text-xs font-medium hover:bg-neutral-50 min-h-[44px] disabled:opacity-50">Cancel</button>
                            <button type="button" onClick={handleRetroApply} disabled={retroBusy || !retroDate} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 min-h-[44px]">
                              {retroBusy ? "Logging…" : "Log Completion"}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add/Edit Form */}
      {showAdd && !readOnly && (
        <div className="mt-4 bg-white rounded-xl border border-emerald-100 shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-900">{editingId ? "Edit Care Schedule" : "New Care Schedule"}</h3>

          <div>
            <label htmlFor="care-title" className="block text-xs font-medium text-neutral-600 mb-1">Title *</label>
            <input id="care-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Fertilize with 10-10-10" className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm" autoFocus />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="care-category" className="block text-xs font-medium text-neutral-600 mb-1">Category</label>
              <select id="care-category" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm">
                {CARE_CATEGORIES.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="care-recurrence" className="block text-xs font-medium text-neutral-600 mb-1">Recurrence</label>
              <select id="care-recurrence" value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm">
                {RECURRENCE_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>

          {recurrenceType === "interval" && (
            <div>
              <label htmlFor="care-interval" className="block text-xs font-medium text-neutral-600 mb-1">Every X days</label>
              <input id="care-interval" type="number" min="1" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
            </div>
          )}

          {recurrenceType === "monthly" && (
            <div>
              <label htmlFor="care-day" className="block text-xs font-medium text-neutral-600 mb-1">Day of month</label>
              <input id="care-day" type="number" min="1" max="28" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
            </div>
          )}

          {recurrenceType === "one_off" && (
            <div>
              <label htmlFor="care-days-after" className="block text-xs font-medium text-neutral-600 mb-1">Days after planting</label>
              <input id="care-days-after" type="number" min="1" value={intervalDays} onChange={(e) => setIntervalDays(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
            </div>
          )}

          {recurrenceType === "yearly" && (
            <>
              <div>
                <label htmlFor="care-day-yearly" className="block text-xs font-medium text-neutral-600 mb-1">Day of month</label>
                <input id="care-day-yearly" type="number" min="1" max="28" value={dayOfMonth} onChange={(e) => setDayOfMonth(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-600 mb-1">Months</label>
                <div className="flex flex-wrap gap-1.5">
                  {MONTHS.map((m, i) => (
                    <button key={m} type="button" onClick={() => toggleMonth(i + 1)} className={`px-2 py-1 rounded text-xs font-medium ${selectedMonths.includes(i + 1) ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-neutral-100 text-neutral-600 border border-neutral-200"}`}>{m.slice(0, 3)}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {recurrenceType !== "one_off" && (
            <div>
              <label htmlFor="care-next-due" className="block text-xs font-medium text-neutral-600 mb-1">Next due date</label>
              <input id="care-next-due" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
            </div>
          )}

          <div>
            <label htmlFor="care-supply" className="block text-xs font-medium text-neutral-600 mb-1">Product from shed (optional)</label>
            <select
              id="care-supply"
              value={supplyProfileId ?? ""}
              onChange={(e) => setSupplyProfileId(e.target.value || null)}
              className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm min-h-[44px]"
              aria-label="Select a product from your shed"
            >
              <option value="">None</option>
              {supplies.map((s) => {
                const displayName = s.brand?.trim() ? `${s.name} (${s.brand})` : s.name;
                const catLabel = SUPPLY_CATEGORY_LABELS[s.category] ?? s.category;
                return (
                  <option key={s.id} value={s.id}>
                    {displayName} — {catLabel}
                  </option>
                );
              })}
            </select>
            {supplies.length === 0 && (
              <p className="text-xs text-neutral-500 mt-1">Add products in the Shed to link them here.</p>
            )}
          </div>

          <div>
            <label htmlFor="care-notes" className="block text-xs font-medium text-neutral-600 mb-1">Notes (optional)</label>
            <textarea id="care-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional details..." className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm resize-none" />
          </div>

          {isPermanent && growInstances.length > 1 && (
            <div role="group" aria-labelledby="care-apply-to-label">
              <p id="care-apply-to-label" className="text-xs font-medium text-neutral-600 mb-2">Apply to</p>
              <div className="flex flex-wrap gap-2">
                {growInstances.map((gi, idx) => {
                  const label = getPlantLabel(gi, idx);
                  const checked = selectedPlantIds.has(gi.id);
                  return (
                    <label key={gi.id} className="flex items-center gap-2 min-h-[44px] px-3 py-2 rounded-lg border border-neutral-200 bg-white cursor-pointer hover:bg-neutral-50 has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-50">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePlantId(gi.id)}
                        className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                        aria-label={label}
                      />
                      <span className="text-sm font-medium text-neutral-800">{label}</span>
                    </label>
                  );
                })}
              </div>
              <p className="text-xs text-neutral-500 mt-1">Leave all unchecked for all plants.</p>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={resetForm} className="px-3 py-2 rounded-lg border border-neutral-300 text-neutral-700 text-sm font-medium hover:bg-neutral-50">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving || !title.trim()} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">{saving ? "Saving..." : editingId ? "Update" : "Add Schedule"}</button>
          </div>
        </div>
      )}

      <CareCascadeConfirm
        open={pendingCascade != null}
        action={pendingCascade?.action ?? "create"}
        eligibleCount={pendingCascade?.eligibleCount ?? 0}
        locallyEditedCount={pendingCascade?.locallyEditedCount ?? 0}
        onCancel={handleCascadeCancel}
        onApply={handleCascadeApply}
      />

      {skipConfirmId && (() => {
        const target = schedules.find((s) => s.id === skipConfirmId);
        const titleText = target?.title?.trim() || "this care task";
        return (
          <>
            <div className="fixed inset-0 z-[100] bg-black/40" aria-hidden onClick={() => skipBusy ? undefined : setSkipConfirmId(null)} />
            <div className="fixed left-4 right-4 bottom-4 z-[101] bg-white rounded-2xl shadow-xl p-5 mx-auto max-w-sm">
              <h2 className="font-semibold text-neutral-900 text-base mb-1">Skip Today&rsquo;s {titleText}?</h2>
              <p className="text-sm text-neutral-500 mb-4">The next occurrence advances on the schedule. Nothing is marked as completed.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSkipConfirmId(null)}
                  disabled={skipBusy}
                  className="flex-1 min-h-[44px] rounded-xl border border-teal-gus/40 text-teal-gus font-medium text-sm hover:bg-teal-gus/10 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSkipToday}
                  disabled={skipBusy}
                  className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {skipBusy && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />}
                  Skip Today
                </button>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
