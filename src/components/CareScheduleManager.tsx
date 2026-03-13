"use client";

import { useState, useCallback, useEffect } from "react";
import { ICON_MAP } from "@/lib/styleDictionary";
import { supabase } from "@/lib/supabase";
import { formatAddFlowError } from "@/lib/addFlowError";
import { insertWithOfflineQueue, updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { useHousehold } from "@/contexts/HouseholdContext";
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
}

const SUPPLY_CATEGORY_LABELS: Record<string, string> = {
  fertilizer: "Fertilizer",
  pesticide: "Pesticide",
  soil_amendment: "Soil Amendment",
  other: "Other",
};

export function CareScheduleManager({ profileId, userId, schedules, onChanged, isTemplate = true, readOnly = false, growInstances = [], isPermanent = false, extraActions }: Props) {
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

  const handleSave = useCallback(async () => {
    if (!userId || !title.trim()) return;
    setSaving(true);
    setSaveError(null);

    try {
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
        is_template: editingId ? ((schedules.find((s) => s.id === editingId) as { is_template?: boolean })?.is_template ?? isTemplate) : isTemplate,
        supply_profile_id: supplyProfileId || null,
      };
      if (isPermanent && growInstances.length > 1) {
        payload.grow_instance_ids = selectedPlantIds.size > 0 ? [...selectedPlantIds] : null;
        payload.grow_instance_id = null;
      }

      const { error } = editingId
        ? await updateWithOfflineQueue("care_schedules", payload, { id: editingId, user_id: userId })
        : await insertWithOfflineQueue("care_schedules", payload);

      if (error) { setSaveError(formatAddFlowError(error)); setSaving(false); return; }

      resetForm();
      onChanged();
    } catch (err) {
      setSaveError(formatAddFlowError(err));
    } finally {
      setSaving(false);
    }
  }, [userId, profileId, title, category, recurrenceType, intervalDays, dayOfMonth, selectedMonths, nextDueDate, notes, supplyProfileId, editingId, isPermanent, growInstances.length, selectedPlantIds, schedules, isTemplate, resetForm, onChanged]);

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
              <div key={s.id} className="bg-white rounded-xl border border-neutral-100 p-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <span className="text-2xl shrink-0" aria-hidden>{getCategoryIcon(s.category ?? "other")}</span>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-neutral-900 text-sm">{s.title}</h4>
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
    </div>
  );
}
