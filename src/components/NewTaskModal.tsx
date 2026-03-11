"use client";

import { useState, useEffect, useCallback } from "react";
import { ICON_MAP } from "@/lib/styleDictionary";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useModalBackClose } from "@/hooks/useModalBackClose";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { SubmitLoadingOverlay } from "@/components/SubmitLoadingOverlay";
import type { TaskType } from "@/types/garden";

const QUICK_CATEGORIES: { value: TaskType; label: string }[] = [
  { value: "maintenance", label: "Maintenance" },
  { value: "fertilize", label: "Fertilize" },
  { value: "prune", label: "Prune" },
  { value: "general", label: "General" },
];

export interface NewTaskModalProps {
  open: boolean;
  onClose: () => void;
  /** Called after task is created successfully */
  onSuccess?: () => void;
  /** Optional initial due date (YYYY-MM-DD) */
  initialDueDate?: string;
  /** When provided, show back arrow to return to FAB menu (parent closes this and re-opens Universal Add Menu) */
  onBackToMenu?: () => void;
}

export function NewTaskModal({ open, onClose, onSuccess, initialDueDate, onBackToMenu }: NewTaskModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState<TaskType>("maintenance");
  const [profileId, setProfileId] = useState("");
  const [growId, setGrowId] = useState("");
  const [profiles, setProfiles] = useState<{ id: string; name: string; variety_name: string | null }[]>([]);
  const [growInstances, setGrowInstances] = useState<{ id: string; sown_date: string; location: string | null; status: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringIntervalDays, setRecurringIntervalDays] = useState(30);
  const [recurringEndDate, setRecurringEndDate] = useState("");

  useModalBackClose(open, onClose);

  useEffect(() => {
    if (open) {
      setDue(initialDueDate ?? new Date().toISOString().slice(0, 10));
    }
  }, [open, initialDueDate]);

  useEffect(() => {
    if (!open || !user?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("plant_profiles")
        .select("id, name, variety_name")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("name");
      if (!cancelled && data) setProfiles(data as { id: string; name: string; variety_name: string | null }[]);
    })();
    return () => { cancelled = true; };
  }, [open, user?.id]);

  useEffect(() => {
    if (!open || !user?.id || !profileId) {
      setGrowInstances([]);
      setGrowId("");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("grow_instances")
        .select("id, sown_date, location, status")
        .eq("plant_profile_id", profileId)
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .in("status", ["growing", "pending"])
        .order("sown_date", { ascending: false });
      if (!cancelled) {
        setGrowInstances((data ?? []) as { id: string; sown_date: string; location: string | null; status: string }[]);
        setGrowId(data?.length === 1 ? data[0].id : "");
      }
    })();
    return () => { cancelled = true; };
  }, [open, user?.id, profileId]);

  const resetForm = useCallback(() => {
    setTitle("");
    setDue(new Date().toISOString().slice(0, 10));
    setCategory("maintenance");
    setProfileId("");
    setGrowId("");
    setIsRecurring(false);
    setRecurringIntervalDays(30);
    setRecurringEndDate("");
    setError(null);
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!user?.id) return;
      const titleTrim = title.trim();
      if (!titleTrim) {
        setError("Title is required.");
        hapticError();
        return;
      }
      setError(null);
      setSaving(true);
      const savedDue = due;
      const savedCategory = category;
      const savedProfileId = profileId || null;
      const savedGrowId = growId || null;
      const savedRecurring = isRecurring;
      const savedIntervalDays = recurringIntervalDays;
      const savedEndDate = recurringEndDate.trim() || null;

      try {
        if (savedRecurring) {
          const { data: scheduleRow, error: schedErr } = await supabase
            .from("care_schedules")
            .insert({
              user_id: user.id,
              plant_profile_id: savedProfileId,
              grow_instance_id: savedGrowId,
              title: titleTrim,
              category: savedCategory,
              recurrence_type: "interval",
              interval_days: savedIntervalDays,
              next_due_date: savedDue,
              end_date: savedEndDate,
              is_active: true,
              is_template: false,
            })
            .select("id")
            .single();

          if (schedErr || !scheduleRow) {
            setError(schedErr?.message ?? "Failed to create recurring schedule.");
            hapticError();
            return;
          }

          await supabase.from("tasks").insert({
            user_id: user.id,
            plant_profile_id: savedProfileId,
            grow_instance_id: savedGrowId,
            category: savedCategory,
            due_date: savedDue,
            title: titleTrim,
            care_schedule_id: scheduleRow.id,
          });
        } else {
          const { error: insertErr } = await supabase.from("tasks").insert({
            user_id: user.id,
            plant_profile_id: savedProfileId,
            grow_instance_id: savedGrowId,
            category: savedCategory,
            due_date: savedDue,
            title: titleTrim,
          });
          if (insertErr) {
            setError(insertErr.message);
            hapticError();
            return;
          }
        }
        hapticSuccess();
        resetForm();
        onClose();
        onSuccess?.();
      } finally {
        setSaving(false);
      }
    },
    [
      user?.id,
      title,
      due,
      category,
      profileId,
      growId,
      isRecurring,
      recurringIntervalDays,
      recurringEndDate,
      resetForm,
      onClose,
      onSuccess,
    ]
  );

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" aria-hidden onClick={onClose} />
      <div
        className="fixed left-4 right-4 bottom-20 z-50 max-h-[85vh] overflow-y-auto rounded-3xl bg-white p-6 border border-neutral-200/80 max-w-md mx-auto"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-task-title"
      >
        <div className="relative">
          <SubmitLoadingOverlay show={saving} message="Saving task…" />
          <div className="flex items-center gap-2 mb-4">
            {onBackToMenu ? (
              <button
                type="button"
                onClick={onBackToMenu}
                className="p-2 rounded-xl text-neutral-600 hover:bg-neutral-100 -ml-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Back to add menu"
              >
                <ICON_MAP.Back stroke="currentColor" className="w-5 h-5" />
              </button>
            ) : (
              <div className="w-11 shrink-0" aria-hidden />
            )}
            <h2 id="new-task-title" className="text-xl font-bold text-neutral-900 flex-1 text-center">
              New Task
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="task-title" className="block text-sm font-medium text-black/80 mb-1">
                Title *
              </label>
              <input
                id="task-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Water Hillside"
                className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
              />
            </div>
            <div>
              <label htmlFor="task-due" className="block text-sm font-medium text-black/80 mb-1">
                Due date *
              </label>
              <input
                id="task-due"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
                className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
              />
            </div>
            <div>
              <label htmlFor="task-category" className="block text-sm font-medium text-black/80 mb-1">
                Category *
              </label>
              <select
                id="task-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskType)}
                className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
              >
                {QUICK_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setIsRecurring((r) => !r)}
              className={`w-full min-h-[44px] flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors ${
                isRecurring ? "bg-emerald-50 border-emerald-300 text-emerald-800" : "bg-white border-black/10 text-black/70 hover:bg-black/[0.02]"
              }`}
            >
              <span className="text-sm font-medium">Recurring</span>
              <span
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isRecurring ? "bg-emerald-500" : "bg-black/20"}`}
                aria-hidden
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${isRecurring ? "translate-x-6" : "translate-x-1"}`}
                />
              </span>
            </button>

            {isRecurring && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="recurring-interval" className="text-sm font-medium text-black/80 shrink-0">
                    Repeat every
                  </label>
                  <input
                    id="recurring-interval"
                    type="number"
                    min={1}
                    max={365}
                    value={recurringIntervalDays}
                    onChange={(e) => setRecurringIntervalDays(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-20 rounded-xl border border-black/10 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-emerald/40"
                  />
                  <span className="text-sm text-black/60">days</span>
                </div>
                <div>
                  <label htmlFor="recurring-end" className="block text-sm font-medium text-black/80 mb-1">
                    End date <span className="text-black/40 font-normal">(optional)</span>
                  </label>
                  <input
                    id="recurring-end"
                    type="date"
                    value={recurringEndDate}
                    onChange={(e) => setRecurringEndDate(e.target.value)}
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald/40"
                  />
                </div>
                {profileId && (
                  <p className="text-xs text-emerald-700 flex items-start gap-1.5">
                    <span aria-hidden>🔗</span>
                    <span>This will also appear in the linked plant&apos;s Care schedule.</span>
                  </p>
                )}
              </div>
            )}

            <div>
              <label htmlFor="task-profile" className="block text-sm font-medium text-black/80 mb-1">
                Link to plant (optional)
              </label>
              <select
                id="task-profile"
                value={profileId}
                onChange={(e) => {
                  setProfileId(e.target.value);
                  setGrowId("");
                }}
                className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
              >
                <option value="">None</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{p.variety_name ? ` (${p.variety_name})` : ""}
                  </option>
                ))}
              </select>
            </div>
            {growInstances.length > 0 && (
              <div>
                <label htmlFor="task-grow" className="block text-sm font-medium text-black/80 mb-1">
                  Active planting (optional)
                </label>
                <select
                  id="task-grow"
                  value={growId}
                  onChange={(e) => setGrowId(e.target.value)}
                  className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
                >
                  <option value="">Any / not specific</option>
                  {growInstances.map((g) => (
                    <option key={g.id} value={g.id}>
                      Sown {g.sown_date}{g.location ? ` · ${g.location}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {error && <p className="text-sm text-citrus font-medium">{error}</p>}
            <div className="space-y-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl bg-emerald text-white font-semibold shadow-soft disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                {saving ? "Saving…" : isRecurring ? "Save Recurring Task" : "Save Task"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl border border-neutral-200 text-neutral-600 font-medium min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

