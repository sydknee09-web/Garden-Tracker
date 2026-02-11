"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import type { CareSchedule } from "@/types/garden";

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
}

export function CareScheduleManager({ profileId, userId, schedules, onChanged }: Props) {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [title, setTitle] = useState("");
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
    setShowAdd(false); setEditingId(null);
  }, []);

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
    setShowAdd(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!userId || !title.trim()) return;
    setSaving(true);

    const payload = {
      plant_profile_id: profileId,
      user_id: userId,
      title: title.trim(),
      category,
      recurrence_type: recurrenceType,
      interval_days: recurrenceType === "interval" ? parseInt(intervalDays) || 30 : null,
      day_of_month: recurrenceType === "monthly" ? parseInt(dayOfMonth) || 1 : null,
      months: recurrenceType === "yearly" ? selectedMonths : null,
      next_due_date: nextDueDate || null,
      notes: notes.trim() || null,
      is_active: true,
      is_template: true,
    };

    if (editingId) {
      await supabase.from("care_schedules").update(payload).eq("id", editingId).eq("user_id", userId);
    } else {
      await supabase.from("care_schedules").insert(payload);
    }

    setSaving(false);
    resetForm();
    onChanged();
  }, [userId, profileId, title, category, recurrenceType, intervalDays, dayOfMonth, selectedMonths, nextDueDate, notes, editingId, resetForm, onChanged]);

  const handleDelete = useCallback(async (scheduleId: string) => {
    if (!userId) return;
    await supabase.from("care_schedules").update({ is_active: false }).eq("id", scheduleId).eq("user_id", userId);
    onChanged();
  }, [userId, onChanged]);

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
    if (s.recurrence_type === "yearly") return `Yearly: ${(s.months ?? []).map((m) => MONTHS[m - 1]?.slice(0, 3)).join(", ")}`;
    return "One-time";
  };

  return (
    <div>
      {schedules.length === 0 && !showAdd ? (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center">
          <span className="text-3xl mb-2 block" aria-hidden>📋</span>
          <p className="text-neutral-500 text-sm">No care schedules yet.</p>
          <p className="text-neutral-400 text-xs mt-1 mb-4">Add recurring reminders like fertilize, prune, or water.</p>
          <button type="button" onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">Add Care Schedule</button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-neutral-500">{schedules.length} schedule{schedules.length !== 1 ? "s" : ""}</p>
            {!showAdd && <button type="button" onClick={() => setShowAdd(true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">+ Add</button>}
          </div>
          <div className="space-y-2">
            {schedules.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-neutral-200 p-4 flex items-start gap-3">
                <span className="text-2xl shrink-0" aria-hidden>{getCategoryIcon(s.category ?? "other")}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-neutral-900 text-sm">{s.title}</h4>
                  <p className="text-xs text-neutral-500 mt-0.5">{getRecurrenceLabel(s)}</p>
                  {s.next_due_date && (
                    <p className="text-xs text-neutral-400 mt-0.5">
                      Next: {new Date(s.next_due_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  )}
                  {s.notes && <p className="text-xs text-neutral-400 mt-1 italic">{s.notes}</p>}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => openEdit(s)} className="p-2 rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-50" aria-label="Edit">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                  </button>
                  <button type="button" onClick={() => handleDelete(s.id)} className="p-2 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50" aria-label="Delete">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add/Edit Form */}
      {showAdd && (
        <div className="mt-4 bg-white rounded-xl border border-emerald-200 p-4 space-y-3">
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

          {recurrenceType === "yearly" && (
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Months</label>
              <div className="flex flex-wrap gap-1.5">
                {MONTHS.map((m, i) => (
                  <button key={m} type="button" onClick={() => toggleMonth(i + 1)} className={`px-2 py-1 rounded text-xs font-medium ${selectedMonths.includes(i + 1) ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-neutral-100 text-neutral-600 border border-neutral-200"}`}>{m.slice(0, 3)}</button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label htmlFor="care-next-due" className="block text-xs font-medium text-neutral-600 mb-1">Next due date</label>
            <input id="care-next-due" type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
          </div>

          <div>
            <label htmlFor="care-notes" className="block text-xs font-medium text-neutral-600 mb-1">Notes (optional)</label>
            <textarea id="care-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional details..." className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm resize-none" />
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button type="button" onClick={resetForm} className="px-3 py-2 rounded-lg border border-neutral-300 text-neutral-700 text-sm font-medium hover:bg-neutral-50">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving || !title.trim()} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">{saving ? "Saving..." : editingId ? "Update" : "Add Schedule"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
