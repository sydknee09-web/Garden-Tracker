"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { completeTask } from "@/lib/completeSowTask";
import type { Task, TaskType } from "@/types/garden";

const TASK_LABELS: Record<string, string> = {
  sow: "Sow",
  start_seed: "Start Seed",
  transplant: "Transplant",
  direct_sow: "Direct Sow",
  harvest: "Harvest",
  maintenance: "Maintenance",
  fertilize: "Fertilize",
  prune: "Prune",
  general: "General",
};

const QUICK_CATEGORIES: { value: TaskType; label: string }[] = [
  { value: "maintenance", label: "Maintenance" },
  { value: "fertilize", label: "Fertilize" },
  { value: "prune", label: "Prune" },
  { value: "general", label: "General" },
];

export default function CalendarPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<(Task & { plant_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetch, setRefetch] = useState(0);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDue, setNewTaskDue] = useState(() => new Date().toISOString().slice(0, 10));
  const [newTaskCategory, setNewTaskCategory] = useState<TaskType>("maintenance");
  const [newTaskPlantId, setNewTaskPlantId] = useState<string>("");
  const [varieties, setVarieties] = useState<{ id: string; name: string; variety_name: string | null }[]>([]);
  const [savingTask, setSavingTask] = useState(false);
  const [newTaskError, setNewTaskError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "overview">("list");
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<(Task & { plant_name?: string }) | null>(null);
  const [plantableProfiles, setPlantableProfiles] = useState<{ id: string; name: string; variety_name: string | null }[]>([]);
  const [plantableExpanded, setPlantableExpanded] = useState(false);

  // Fetch schedule_defaults + user profiles to compute "Plantable this month"
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const monthIndex = month.month; // 0-based
      const monthCol = (["sow_jan","sow_feb","sow_mar","sow_apr","sow_may","sow_jun","sow_jul","sow_aug","sow_sep","sow_oct","sow_nov","sow_dec"] as const)[monthIndex];
      const [{ data: schedules }, { data: profiles }] = await Promise.all([
        supabase.from("schedule_defaults").select("plant_type, " + monthCol).eq("user_id", user.id),
        supabase.from("plant_profiles").select("id, name, variety_name").eq("user_id", user.id),
      ]);
      if (cancelled) return;
      const plantTypes = new Set(
        (schedules ?? [])
          .filter((s) => typeof s === "object" && s !== null && !("error" in s) && (s as Record<string, unknown>)[monthCol] === true)
          .map((s: { plant_type: string }) => s.plant_type.trim().toLowerCase())
      );
      const matches = (profiles ?? []).filter((p: { name: string }) => {
        const n = (p.name ?? "").trim().toLowerCase();
        const first = n.split(/\s+/)[0];
        return plantTypes.has(n) || plantTypes.has(first ?? "") || Array.from(plantTypes).some((t) => n.includes(t) || t.includes(n));
      }) as { id: string; name: string; variety_name: string | null }[];
      setPlantableProfiles(matches);
    })();
    return () => { cancelled = true; };
  }, [user?.id, month.month]);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }
    const userId = user.id;
    let cancelled = false;

    async function fetchTasks() {
      const start = new Date(month.year, month.month, 1).toISOString().slice(0, 10);
      const end = new Date(month.year, month.month + 1, 0).toISOString().slice(0, 10);

      const { data: taskRows, error: e } = await supabase
        .from("tasks")
        .select("id, plant_profile_id, plant_variety_id, category, due_date, completed_at, created_at, grow_instance_id, title")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .gte("due_date", start)
        .lte("due_date", end)
        .order("due_date");

      if (cancelled) return;
      if (e) {
        setError(e.message);
        setTasks([]);
        setLoading(false);
        return;
      }

      const varietyIds = [...new Set((taskRows ?? []).map((t: { plant_variety_id: string | null }) => t.plant_variety_id).filter(Boolean))] as string[];
      const profileIds = [...new Set((taskRows ?? []).map((t: { plant_profile_id?: string | null }) => t.plant_profile_id).filter(Boolean))] as string[];
      const names: Record<string, string> = {};
      if (varietyIds.length > 0) {
        const { data: varieties } = await supabase.from("plant_varieties").select("id, name").in("id", varietyIds);
        (varieties ?? []).forEach((v: { id: string; name: string }) => { names[v.id] = v.name; });
      }
      if (profileIds.length > 0) {
        const { data: profiles } = await supabase.from("plant_profiles").select("id, name, variety_name").in("id", profileIds);
        (profiles ?? []).forEach((p: { id: string; name: string; variety_name: string | null }) => {
          names[p.id] = p.variety_name?.trim() ? `${p.name} (${p.variety_name})` : p.name;
        });
      }

      const withNames = (taskRows ?? []).map((t: Task) => ({
        ...t,
        plant_name: (t.plant_profile_id ? names[t.plant_profile_id] : t.plant_variety_id ? names[t.plant_variety_id] : null) ?? "Unknown",
      }));
      setTasks(withNames);
      setLoading(false);
    }

    fetchTasks();
    return () => {
      cancelled = true;
    };
  }, [user?.id, month.year, month.month, refetch]);

  async function handleComplete(t: Task & { plant_name?: string }) {
    if (!user || t.completed_at) return;
    await completeTask(t, user.id);
    setRefetch((r) => r + 1);
  }

  function requestDeleteTask(t: Task & { plant_name?: string }) {
    setDeleteConfirmTask(t);
  }

  async function confirmDeleteTask() {
    if (!user || !deleteConfirmTask) return;
    const t = deleteConfirmTask;
    setDeleteConfirmTask(null);
    const { error: e } = await supabase.from("tasks").delete().eq("id", t.id).eq("user_id", user.id);
    if (e) {
      setError(e.message);
      return;
    }
    setRefetch((r) => r + 1);
  }

  async function handleSnooze(t: Task & { plant_name?: string }, newDueDate: string) {
    if (!user || t.completed_at) return;
    const oldDate = t.due_date;
    const deltaDays = Math.round((new Date(newDueDate).getTime() - new Date(oldDate).getTime()) / (24 * 60 * 60 * 1000));
    await supabase.from("tasks").update({ due_date: newDueDate }).eq("id", t.id).eq("user_id", user.id);
    if (t.category === "transplant" && t.grow_instance_id && deltaDays !== 0) {
      const { data: harvestTask } = await supabase
        .from("tasks")
        .select("id, due_date")
        .eq("grow_instance_id", t.grow_instance_id)
        .eq("category", "harvest")
        .maybeSingle();
      if (harvestTask) {
        const d = new Date((harvestTask as { due_date: string }).due_date + "T12:00:00");
        d.setDate(d.getDate() + deltaDays);
        const newHarvestDate = d.toISOString().slice(0, 10);
        await supabase.from("tasks").update({ due_date: newHarvestDate }).eq("id", (harvestTask as { id: string }).id).eq("user_id", user.id);
        await supabase.from("grow_instances").update({ expected_harvest_date: newHarvestDate }).eq("id", t.grow_instance_id).eq("user_id", user.id);
      }
    }
    setRefetch((r) => r + 1);
  }

  const prevMonth = () => {
    setMonth((m) =>
      m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 }
    );
  };
  const nextMonth = () => {
    setMonth((m) =>
      m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 }
    );
  };
  const monthLabel = new Date(month.year, month.month).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const byDate: Record<string, (Task & { plant_name?: string })[]> = {};
  tasks.forEach((t) => {
    const d = t.due_date;
    if (!byDate[d]) byDate[d] = [];
    byDate[d].push(t);
  });
  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(month.year, month.month, 1).getDay();
  const totalCells = Math.ceil((firstDayOfWeek + daysInMonth) / 7) * 7;
  const overviewDays: { dateStr: string | null; dayNum: number | null }[] = [];
  for (let i = 0; i < totalCells; i++) {
    if (i < firstDayOfWeek) {
      overviewDays.push({ dateStr: null, dayNum: null });
    } else {
      const dayNum = i - firstDayOfWeek + 1;
      if (dayNum <= daysInMonth) {
        const dateStr = `${month.year}-${String(month.month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
        overviewDays.push({ dateStr, dayNum });
      } else {
        overviewDays.push({ dateStr: null, dayNum: null });
      }
    }
  }
  const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  useEffect(() => {
    if (!user || !newTaskOpen) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("plant_varieties")
        .select("id, name, variety_name")
        .eq("user_id", user.id)
        .eq("status", "Active on Hillside")
        .order("name");
      if (!cancelled && data) setVarieties(data);
    })();
    return () => { cancelled = true; };
  }, [user?.id, newTaskOpen]);

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const titleTrim = newTaskTitle.trim();
    if (!titleTrim) {
      setNewTaskError("Title is required.");
      return;
    }
    setNewTaskError(null);
    setSavingTask(true);
    const { error: err } = await supabase.from("tasks").insert({
      user_id: user.id,
      plant_variety_id: newTaskPlantId || null,
      grow_instance_id: null,
      category: newTaskCategory,
      due_date: newTaskDue,
      title: titleTrim,
    });
    setSavingTask(false);
    if (err) {
      setNewTaskError(err.message);
      return;
    }
    setNewTaskOpen(false);
    setNewTaskTitle("");
    setNewTaskDue(new Date().toISOString().slice(0, 10));
    setNewTaskCategory("maintenance");
    setNewTaskPlantId("");
    setRefetch((r) => r + 1);
  }

  return (
    <div className="px-6 pt-8 pb-6">
      <h1 className="text-2xl font-semibold text-black mb-1">Calendar</h1>
      <p className="text-muted text-sm mb-4">Tasks by due date</p>

      <div className="flex justify-center mb-4">
        <div className="inline-flex rounded-xl p-1 border border-black/10 bg-white shadow-soft" role="tablist" aria-label="Calendar view">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "list"}
            onClick={() => setViewMode("list")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "list" ? "bg-emerald text-white" : "text-black/60 hover:text-black"}`}
          >
            List
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "overview"}
            onClick={() => setViewMode("overview")}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "overview" ? "bg-emerald text-white" : "text-black/60 hover:text-black"}`}
          >
            Overview
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <button
          type="button"
          onClick={prevMonth}
          className="py-2 px-3 rounded-xl border border-black/10 text-black/80 text-sm font-medium"
        >
          ←
        </button>
        <span className="font-medium text-black">{monthLabel}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="py-2 px-3 rounded-xl border border-black/10 text-black/80 text-sm font-medium"
        >
          →
        </button>
      </div>

      {/* Plantable this month */}
      {plantableProfiles.length > 0 && (
        <div className="mb-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 overflow-hidden">
          <button
            type="button"
            onClick={() => setPlantableExpanded((e) => !e)}
            className="w-full min-h-[44px] flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-sm font-semibold text-emerald-800">
              Plantable in {new Date(month.year, month.month).toLocaleString("default", { month: "long" })} ({plantableProfiles.length})
            </span>
            <span className="text-emerald-600 text-sm">{plantableExpanded ? "Hide" : "Show"}</span>
          </button>
          {plantableExpanded && (
            <div className="px-4 pb-4 flex flex-wrap gap-2">
              {plantableProfiles.map((p) => (
                <Link
                  key={p.id}
                  href={`/vault/${p.id}`}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-white border border-emerald-200 text-sm text-emerald-700 font-medium hover:bg-emerald-100 transition-colors"
                >
                  {p.variety_name?.trim() ? `${p.name} (${p.variety_name})` : p.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl bg-white p-8 shadow-card border border-black/5 text-center text-black/60">
          Loading...
        </div>
      ) : error ? (
        <div className="rounded-2xl bg-white p-6 shadow-card border border-black/5">
          <p className="text-citrus font-medium">Could not load tasks</p>
          <p className="text-sm text-black/60 mt-1">{error}</p>
        </div>
      ) : viewMode === "overview" ? (
        <div className="rounded-2xl bg-white shadow-card border border-black/5 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-black/10">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="p-2 text-center text-xs font-medium text-black/60 border-r border-black/5 last:border-r-0">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr">
            {overviewDays.map((cell, idx) => (
              <div
                key={idx}
                className={`min-h-[80px] p-2 border-b border-r border-black/5 last:border-r-0 ${cell.dateStr ? "bg-white" : "bg-black/[0.02]"}`}
              >
                {cell.dayNum != null && (
                  <>
                    <p className="text-xs font-medium text-black/70 mb-1">{cell.dayNum}</p>
                    {cell.dateStr && (byDate[cell.dateStr] ?? []).map((t) => (
                      <CalendarTaskRow
                        key={t.id}
                        task={t}
                        onComplete={() => handleComplete(t)}
                        onSnooze={(newDue) => handleSnooze(t, newDue)}
                        onDeleteRequest={() => requestDeleteTask(t)}
                      />
                    ))}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-white shadow-card border border-black/5 overflow-hidden">
          {tasks.length === 0 ? (
            <div className="p-8 text-center text-black/50 text-sm">
              No tasks this month. Start a new Sowing on a plant profile to generate tasks.
            </div>
          ) : (
            <ul className="divide-y divide-black/5">
              {Object.entries(byDate)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, dayTasks]) => (
                  <li key={date} className="p-4">
                    <p className="text-xs font-medium text-black/50 mb-2">
                      {new Date(date + "T12:00:00").toLocaleDateString("default", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                    {dayTasks.map((t) => (
                      <CalendarTaskRow
                        key={t.id}
                        task={t}
                        onComplete={() => handleComplete(t)}
                        onSnooze={(newDue) => handleSnooze(t, newDue)}
                        onDeleteRequest={() => requestDeleteTask(t)}
                      />
                    ))}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setNewTaskOpen(true);
          setNewTaskTitle("");
          setNewTaskDue(new Date().toISOString().slice(0, 10));
          setNewTaskCategory("maintenance");
          setNewTaskPlantId("");
          setNewTaskError(null);
        }}
        className="fixed right-6 bottom-24 z-30 w-14 h-14 rounded-full bg-emerald text-white shadow-card flex items-center justify-center text-2xl font-light hover:opacity-90 transition-opacity"
        style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        aria-label="New task"
      >
        +
      </button>

      {deleteConfirmTask && (
        <div
          className="fixed bottom-24 left-4 right-4 z-50 max-w-md mx-auto rounded-xl bg-white border border-black/10 shadow-lg p-4 flex items-center justify-between gap-3"
          role="dialog"
          aria-live="polite"
          aria-label="Confirm delete"
        >
          <p className="text-sm font-medium text-black/80">Delete this task?</p>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setDeleteConfirmTask(null)}
              className="min-w-[44px] min-h-[44px] px-4 rounded-lg border border-black/15 text-sm font-medium text-black/80"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDeleteTask}
              className="min-w-[44px] min-h-[44px] px-4 rounded-lg bg-citrus text-white text-sm font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {newTaskOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" aria-hidden onClick={() => setNewTaskOpen(false)} />
          <div
            className="fixed left-4 right-4 top-1/2 z-50 -translate-y-1/2 max-h-[85vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-card border border-black/5 max-w-md mx-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-task-title"
          >
            <h2 id="new-task-title" className="text-lg font-semibold text-black mb-4">
              New Task
            </h2>
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label htmlFor="task-title" className="block text-sm font-medium text-black/80 mb-1">
                  Title
                </label>
                <input
                  id="task-title"
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Water Hillside"
                  className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
                />
              </div>
              <div>
                <label htmlFor="task-due" className="block text-sm font-medium text-black/80 mb-1">
                  Due date
                </label>
                <input
                  id="task-due"
                  type="date"
                  value={newTaskDue}
                  onChange={(e) => setNewTaskDue(e.target.value)}
                  className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
                />
              </div>
              <div>
                <label htmlFor="task-category" className="block text-sm font-medium text-black/80 mb-1">
                  Category
                </label>
                <select
                  id="task-category"
                  value={newTaskCategory}
                  onChange={(e) => setNewTaskCategory(e.target.value as TaskType)}
                  className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
                >
                  {QUICK_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="task-plant" className="block text-sm font-medium text-black/80 mb-1">
                  Link to plant (optional)
                </label>
                <select
                  id="task-plant"
                  value={newTaskPlantId}
                  onChange={(e) => setNewTaskPlantId(e.target.value)}
                  className="w-full rounded-xl border border-black/10 px-4 py-2.5 text-black focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
                >
                  <option value="">None</option>
                  {varieties.length === 0 ? (
                    <option value="" disabled>No active plants found. Start a Sowing first.</option>
                  ) : (
                    varieties.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}{v.variety_name ? ` — ${v.variety_name}` : ""}
                      </option>
                    ))
                  )}
                </select>
              </div>
              {newTaskError && <p className="text-sm text-citrus font-medium">{newTaskError}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setNewTaskOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-black/10 text-black/80 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTask}
                  className="flex-1 py-2.5 rounded-xl bg-emerald text-white font-medium shadow-soft disabled:opacity-60"
                >
                  {savingTask ? "Saving…" : "Save task"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function CalendarTaskRow({
  task,
  onComplete,
  onSnooze,
  onDeleteRequest,
}: {
  task: Task & { plant_name?: string };
  onComplete: () => void;
  onSnooze: (newDueDate: string) => void;
  onDeleteRequest: () => void;
}) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState(task.due_date);
  const categoryLabel = TASK_LABELS[task.category] ?? task.category;
  const displayTitle = task.title ?? categoryLabel;
  const displaySub = task.title ? (task.plant_name ? ` — ${task.plant_name}` : ` (${categoryLabel})`) : (task.plant_name ?? "");

  return (
    <div
      className={`flex flex-wrap items-center gap-2 py-2 px-3 rounded-xl text-sm ${
        task.completed_at ? "bg-black/5 text-black/60" : "bg-emerald/10 text-black"
      }`}
    >
      <span className={`font-medium ${task.completed_at ? "line-through" : ""}`}>{displayTitle}</span>
      {displaySub && <span className="text-black/70">{displaySub}</span>}
      {task.completed_at ? (
        <span className="text-xs text-black/50 ml-auto">Done</span>
      ) : (
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setSnoozeOpen(true)}
            className="text-xs font-medium text-black/60 hover:text-emerald"
          >
            Snooze
          </button>
          <button
            type="button"
            onClick={onComplete}
            className="text-xs font-medium text-emerald hover:underline"
          >
            Complete
          </button>
        </span>
      )}
      <button
        type="button"
        onClick={onDeleteRequest}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-black/40 hover:text-citrus hover:bg-black/5 shrink-0"
        aria-label="Delete task"
      >
        <TrashIcon />
      </button>
      {snoozeOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSnoozeOpen(false)} />
          <div className="fixed left-4 right-4 top-1/2 z-50 -translate-y-1/2 rounded-2xl bg-white p-4 shadow-card border border-black/5 max-w-xs mx-auto">
            <p className="text-sm font-medium text-black mb-2">New due date</p>
            <input
              type="date"
              value={snoozeDate}
              onChange={(e) => setSnoozeDate(e.target.value)}
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm mb-3"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSnoozeOpen(false)}
                className="flex-1 py-2 rounded-xl border border-black/10 text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onSnooze(snoozeDate);
                  setSnoozeOpen(false);
                }}
                className="flex-1 py-2 rounded-xl bg-emerald text-white text-sm font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
