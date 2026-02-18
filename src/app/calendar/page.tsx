"use client";

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { completeTask } from "@/lib/completeSowTask";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { isPlantableInMonth } from "@/lib/plantingWindow";
import type { Task, TaskType } from "@/types/garden";
import { useModalBackClose } from "@/hooks/useModalBackClose";

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

const SOW_CATEGORIES = ["sow", "start_seed", "direct_sow", "transplant"];

function isSowTask(category: string | null | undefined): boolean {
  return !!category && SOW_CATEGORIES.includes(category);
}

/** Dot color for at-a-glance calendar indicators */
function getCategoryDotColor(category: string): string {
  switch (category) {
    case "sow":
    case "start_seed":
    case "transplant":
    case "direct_sow":
      return "bg-emerald-500";
    case "harvest":
      return "bg-amber-500";
    case "maintenance":
    case "fertilize":
    case "prune":
      return "bg-sky-500";
    default:
      return "bg-neutral-400";
  }
}

export default function CalendarPage() {
  const { user } = useAuth();
  const router = useRouter();
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
  const [harvestCelebration, setHarvestCelebration] = useState<string | null>(null);
  const [plantingCelebration, setPlantingCelebration] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "overview">("overview");
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<(Task & { plant_name?: string }) | null>(null);
  const [plantableProfiles, setPlantableProfiles] = useState<{ id: string; name: string; variety_name: string | null }[]>([]);
  const [plantableExpanded, setPlantableExpanded] = useState(false);
  const [plantableInventoryPlantType, setPlantableInventoryPlantType] = useState<{ plantType: string; profiles: { id: string; name: string; variety_name: string | null }[] } | null>(null);
  const [inventoryPackets, setInventoryPackets] = useState<{ plant_profile_id: string; vendor_name: string | null; qty_status: number }[]>([]);
  const [inventoryPacketsLoading, setInventoryPacketsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const swipeStartX = useRef<number | null>(null);
  /** Collapsible date groups: which dates are expanded. Start with today expanded if it has tasks. */
  const [expandedDateGroups, setExpandedDateGroups] = useState<Set<string>>(new Set());

  const todayStr = new Date().toISOString().slice(0, 10);

  useModalBackClose(newTaskOpen, () => setNewTaskOpen(false));
  useModalBackClose(!!deleteConfirmTask, () => setDeleteConfirmTask(null));

  const plantTypesGrouped = useMemo(() => {
    const byType = new Map<string, { id: string; name: string; variety_name: string | null }[]>();
    for (const p of plantableProfiles) {
      const type = (p.name ?? "").trim().split(/\s+/)[0]?.trim() || p.name?.trim() || "Other";
      if (!byType.has(type)) byType.set(type, []);
      byType.get(type)!.push(p);
    }
    return Array.from(byType.entries()).map(([plantType, profiles]) => ({ plantType, profiles }));
  }, [plantableProfiles]);

  const fetchPacketsForProfileIds = useCallback(
    async (profileIds: string[]) => {
      if (!user?.id || profileIds.length === 0) {
        setInventoryPackets([]);
        return;
      }
      setInventoryPacketsLoading(true);
      const { data } = await supabase
        .from("seed_packets")
        .select("plant_profile_id, vendor_name, qty_status")
        .eq("user_id", user.id)
        .in("plant_profile_id", profileIds)
        .is("deleted_at", null);
      setInventoryPackets((data ?? []) as { plant_profile_id: string; vendor_name: string | null; qty_status: number }[]);
      setInventoryPacketsLoading(false);
    },
    [user?.id]
  );

  useEffect(() => {
    if (!plantableInventoryPlantType) return;
    const ids = plantableInventoryPlantType.profiles.map((p) => p.id);
    fetchPacketsForProfileIds(ids);
  }, [plantableInventoryPlantType, fetchPacketsForProfileIds]);

  // Fetch plant_profiles and compute "Plantable this month" from planting_window
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data: profiles } = await supabase
        .from("plant_profiles")
        .select("id, name, variety_name, planting_window")
        .eq("user_id", user.id)
        .is("deleted_at", null);
      if (cancelled) return;
      const monthIndex = month.month;
      const matches = (profiles ?? []).filter((p: { name: string; planting_window?: string | null }) =>
        isPlantableInMonth(p, monthIndex)
      ) as { id: string; name: string; variety_name: string | null }[];
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
        .select("id, plant_profile_id, plant_variety_id, category, due_date, completed_at, created_at, grow_instance_id, title, care_schedule_id")
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
    const isHarvest = t.category === "harvest";
    const isSow = isSowTask(t.category);
    const plantLabel = t.plant_name ?? t.title ?? "Plant";

    if (isSow) {
      setPlantingCelebration(plantLabel);
      if (navigator.vibrate) navigator.vibrate(50);
    }

    await completeTask(t, user.id);
    setRefetch((r) => r + 1);
    hapticSuccess();

    if (isHarvest) {
      setHarvestCelebration(plantLabel);
      setTimeout(() => setHarvestCelebration(null), 2500);
    } else if (isSow) {
      setTimeout(() => setPlantingCelebration(null), 800);
    }
  }

  function requestDeleteTask(t: Task & { plant_name?: string }) {
    setDeleteConfirmTask(t);
  }

  async function confirmDeleteTask() {
    if (!user || !deleteConfirmTask) return;
    const t = deleteConfirmTask;
    setDeleteConfirmTask(null);
    const { error: e } = await supabase.from("tasks").update({ deleted_at: new Date().toISOString() }).eq("id", t.id).eq("user_id", user.id);
    if (e) {
      setError(e.message);
      hapticError();
      return;
    }
    hapticSuccess();
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
  tasks
    .filter((t) => !t.completed_at)
    .forEach((t) => {
      const d = t.due_date;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(t);
    });

  const expandedInitRef = useRef(false);
  const lastMonthKey = useRef(`${month.year}-${month.month}`);
  useEffect(() => {
    const monthKey = `${month.year}-${month.month}`;
    if (lastMonthKey.current !== monthKey) {
      expandedInitRef.current = false;
      lastMonthKey.current = monthKey;
    }
    if (expandedInitRef.current || tasks.length === 0) return;
    expandedInitRef.current = true;
    const todayTasks = tasks.filter((t) => t.due_date === todayStr);
    setExpandedDateGroups(todayTasks.length > 0 ? new Set([todayStr]) : new Set());
  }, [tasks, todayStr, month.year, month.month]);

  const toggleDateGroup = useCallback((date: string) => {
    setExpandedDateGroups((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }, []);

  // Reminders view: only recurring (from care schedules) and not completed
  const remindersTasks = useMemo(
    () =>
      tasks.filter(
        (t) => (t as Task & { care_schedule_id?: string | null }).care_schedule_id != null && !t.completed_at
      ) as (Task & { plant_name?: string })[],
    [tasks]
  );
  const byDateReminders: Record<string, (Task & { plant_name?: string })[]> = {};
  remindersTasks.forEach((t) => {
    const d = t.due_date;
    if (!byDateReminders[d]) byDateReminders[d] = [];
    byDateReminders[d].push(t);
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
  const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

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
      hapticError();
      return;
    }
    setNewTaskError(null);
    const savedDue = newTaskDue;
    const savedCategory = newTaskCategory;
    const savedPlantId = newTaskPlantId;
    const plantName = savedPlantId ? varieties.find((v) => v.id === savedPlantId) : null;
    const displayName = plantName ? (plantName.variety_name?.trim() ? `${plantName.name} (${plantName.variety_name})` : plantName.name) : null;
    const optimisticId = `opt-${Date.now()}`;
    const optimisticTask: Task & { plant_name?: string } = {
      id: optimisticId,
      plant_variety_id: savedPlantId || null,
      plant_profile_id: null,
      grow_instance_id: null,
      category: savedCategory,
      due_date: savedDue,
      completed_at: null,
      created_at: new Date().toISOString(),
      title: titleTrim,
      plant_name: displayName ?? "Unknown",
    };
    setNewTaskOpen(false);
    setNewTaskTitle("");
    setNewTaskDue(new Date().toISOString().slice(0, 10));
    setNewTaskCategory("maintenance");
    setNewTaskPlantId("");
    setTasks((prev) => [...prev, optimisticTask]);
    const { error: err } = await supabase.from("tasks").insert({
      user_id: user.id,
      plant_variety_id: savedPlantId || null,
      grow_instance_id: null,
      category: savedCategory,
      due_date: savedDue,
      title: titleTrim,
    });
    if (err) {
      setTasks((prev) => prev.filter((t) => t.id !== optimisticId));
      setNewTaskOpen(true);
      setNewTaskTitle(titleTrim);
      setNewTaskPlantId(savedPlantId);
      setNewTaskDue(savedDue);
      setNewTaskCategory(savedCategory);
      setNewTaskError(err.message);
      hapticError();
      return;
    }
    hapticSuccess();
    setRefetch((r) => r + 1);
  }

  return (
    <div className="px-6 pt-2 pb-6">
      <div className="flex justify-center mb-3">
        <div className="inline-flex rounded-xl p-1 bg-neutral-100 gap-0.5" role="tablist" aria-label="Calendar view">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "overview"}
            onClick={() => setViewMode("overview")}
            className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "overview" ? "bg-white text-emerald-700 shadow-sm" : "text-black/60 hover:text-black"}`}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "list"}
            aria-label="Reminders view: recurring care tasks, excluding completed"
            onClick={() => setViewMode("list")}
            className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${viewMode === "list" ? "bg-white text-emerald-700 shadow-sm" : "text-black/60 hover:text-black"}`}
          >
            Reminders
          </button>
        </div>
      </div>

      <div
        className="flex items-center justify-center gap-2 mb-2 touch-pan-y"
        onTouchStart={(e) => {
          swipeStartX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = swipeStartX.current;
          swipeStartX.current = null;
          if (start == null) return;
          const end = e.changedTouches[0]?.clientX;
          if (end == null) return;
          const delta = end - start;
          if (delta < -50) nextMonth();
          else if (delta > 50) prevMonth();
        }}
      >
        <button
          type="button"
          onClick={prevMonth}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-black/10 text-black/80 text-sm font-medium hover:bg-black/5"
          aria-label="Previous month"
        >
          ←
        </button>
        <span className="font-semibold text-black text-base min-w-[140px] text-center">{monthLabel}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl border border-black/10 text-black/80 text-sm font-medium hover:bg-black/5"
          aria-label="Next month"
        >
          →
        </button>
      </div>

      {/* Plantable window: icons + infinity */}
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
            <div className="px-4 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                {plantTypesGrouped.map(({ plantType, profiles }) => (
                  <button
                    key={plantType}
                    type="button"
                    onClick={() => setPlantableInventoryPlantType({ plantType, profiles })}
                    className="min-h-[44px] px-3 py-2 flex items-center gap-1.5 rounded-xl bg-white border border-emerald-200 text-sm font-medium text-emerald-800 hover:bg-emerald-100 transition-colors"
                    title={`${plantType} – view seed inventory`}
                    aria-label={`View seed inventory for ${plantType}`}
                  >
                    <span>{plantType}</span>
                    {profiles.length > 1 && (
                      <span className="text-emerald-600">{profiles.length}</span>
                    )}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const sowParam = `${month.year}-${String(month.month + 1).padStart(2, "0")}`;
                    router.push(`/vault?sow=${sowParam}`);
                  }}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-white border border-emerald-300 text-emerald-700 font-bold hover:bg-emerald-100 transition-colors"
                  title="View plantable in Vault"
                  aria-label="View plantable for this month in Vault"
                >
                  ∞
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal: seed inventory for one plant type */}
      {plantableInventoryPlantType && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" aria-hidden onClick={() => setPlantableInventoryPlantType(null)} />
          <div
            className="fixed left-4 right-4 top-1/2 z-50 max-h-[85vh] -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-lg border border-black/10 max-w-md mx-auto flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="plantable-inventory-title"
          >
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-black/10">
              <h2 id="plantable-inventory-title" className="text-lg font-semibold text-black">
                {plantableInventoryPlantType.plantType} – Seed inventory
              </h2>
              <button
                type="button"
                onClick={() => setPlantableInventoryPlantType(null)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-black/10 text-black/60 hover:bg-black/5"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
              {inventoryPacketsLoading ? (
                <p className="text-sm text-black/50">Loading packets…</p>
              ) : (
                plantableInventoryPlantType.profiles.map((profile) => {
                  const packets = inventoryPackets.filter((p) => p.plant_profile_id === profile.id);
                  return (
                    <div key={profile.id} className="rounded-xl border border-black/10 p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-black">
                          {profile.variety_name?.trim() ? `${profile.name} (${profile.variety_name})` : profile.name}
                        </span>
                        <Link
                          href={`/vault/plant?ids=${profile.id}`}
                          className="shrink-0 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                        >
                          Plant
                        </Link>
                      </div>
                      {packets.length === 0 ? (
                        <p className="text-xs text-black/50">No packets</p>
                      ) : (
                        <ul className="space-y-1">
                          {packets.map((pkt, i) => (
                            <li key={i} className="text-sm text-black/70 flex justify-between">
                              <span>{pkt.vendor_name?.trim() || "—"}</span>
                              <span>{pkt.qty_status}%</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      <Link href={`/vault/${profile.id}`} className="text-xs text-emerald-600 hover:underline">
                        View profile →
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
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
        <div
          className="rounded-2xl bg-white shadow-card border border-black/5 overflow-hidden"
          onTouchStart={(e) => {
            swipeStartX.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            const start = swipeStartX.current;
            swipeStartX.current = null;
            if (start == null) return;
            const end = e.changedTouches[0]?.clientX;
            if (end == null) return;
            const delta = end - start;
            if (delta < -50) nextMonth();
            else if (delta > 50) prevMonth();
          }}
        >
          <div className="grid grid-cols-7 border-b border-black/10">
            {WEEKDAY_LABELS.map((label, i) => (
              <div key={i} className="p-1.5 text-center text-xs font-medium text-black/60 border-r border-black/5 last:border-r-0">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 auto-rows-fr">
            {overviewDays.map((cell, idx) => {
              const dayTasks = cell.dateStr ? (byDate[cell.dateStr] ?? []) : [];
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selectedDate;
              const uniqueCategories = [...new Set(dayTasks.map((t) => t.category))];
              const cellContent = (
                <>
                  {cell.dayNum != null && (
                    <>
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 ${
                          isToday
                            ? "bg-emerald-600 text-white"
                            : isSelected
                              ? "bg-emerald-100 text-emerald-800"
                              : "text-black/80"
                        }`}
                      >
                        {cell.dayNum}
                      </span>
                      {cell.dateStr && dayTasks.length > 0 && (
                        <div className="flex flex-wrap justify-center gap-0.5 mt-1">
                          {uniqueCategories.slice(0, 3).map((cat) => (
                            <span
                              key={cat}
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${getCategoryDotColor(cat)}`}
                              title={TASK_LABELS[cat] ?? cat}
                              aria-hidden
                            />
                          ))}
                          {uniqueCategories.length > 3 && (
                            <span className="text-[10px] text-black/50" aria-hidden>+</span>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              );
              const baseClass = `min-h-[56px] p-1.5 border-b border-r border-black/5 last:border-r-0 flex flex-col items-center justify-start ${
                cell.dateStr ? "bg-white" : "bg-black/[0.02]"
              } ${isSelected ? "ring-2 ring-inset ring-emerald/40" : ""}`;
              return cell.dateStr ? (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedDate(cell.dateStr!)}
                  className={`${baseClass} hover:bg-black/[0.02] cursor-pointer`}
                >
                  {cellContent}
                </button>
              ) : (
                <div key={idx} className={baseClass}>
                  {cellContent}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {!loading && !error && viewMode === "overview" && (
        <div className="mt-4 rounded-2xl bg-white shadow-card border border-black/5 overflow-hidden">
          <div className="relative px-4 py-4 flex items-center justify-center border-b border-black/10">
            <h2 className="text-base font-bold text-black text-center">
              {selectedDate
                ? `Tasks for ${new Date(selectedDate + "T12:00:00").toLocaleDateString("default", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}`
                : "Tasks this month"}
            </h2>
            {selectedDate && (
              <button
                type="button"
                onClick={() => setSelectedDate(null)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-600 hover:underline min-h-[44px] min-w-[44px] flex items-center justify-end"
              >
                Show all
              </button>
            )}
          </div>
          {tasks.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-black/60 text-sm font-medium">
                No tasks scheduled for {new Date(month.year, month.month).toLocaleString("default", { month: "long" })}.
              </p>
              <p className="text-sm text-black/50 mt-2">
                Add a reminder to start your spring seedlings, or plant from a profile to generate tasks.
              </p>
            </div>
          ) : selectedDate ? (
            (byDate[selectedDate] ?? []).length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-black/50 text-sm">
                  No tasks on {new Date(selectedDate + "T12:00:00").toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" })}.
                </p>
                <p className="text-xs text-black/40 mt-1">Tap another date to see its tasks.</p>
              </div>
            ) : (
              <ul className="divide-y divide-black/5">
                {(byDate[selectedDate] ?? []).map((t) => (
                  <li key={t.id} className="p-4">
                    <CalendarTaskRow
                      task={t}
                      onComplete={() => handleComplete(t)}
                      onSnooze={(newDue) => handleSnooze(t, newDue)}
                      onDeleteRequest={() => requestDeleteTask(t)}
                    />
                  </li>
                ))}
              </ul>
            )
          ) : (
            <ul className="divide-y divide-black/5">
              {Object.entries(byDate)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, dayTasks]) => {
                  const isExpanded = expandedDateGroups.has(date);
                  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("default", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  });
                  const sowCount = dayTasks.filter((t) =>
                    ["sow", "start_seed", "direct_sow", "transplant"].includes(t.category)
                  ).length;
                  const summary =
                    sowCount > 0 && sowCount === dayTasks.length
                      ? `${sowCount} sowing${sowCount !== 1 ? "s" : ""}`
                      : `${dayTasks.length} item${dayTasks.length !== 1 ? "s" : ""}`;
                  return (
                    <li key={date} className="border-b border-black/5 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => toggleDateGroup(date)}
                        className="w-full min-h-[44px] flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors"
                        aria-expanded={isExpanded}
                      >
                        <span className="text-sm font-medium text-black/80">
                          {dateLabel} ({summary})
                        </span>
                        <span className="text-emerald-600 text-sm shrink-0">{isExpanded ? "Hide" : "Show"}</span>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-2">
                          {dayTasks.map((t) => (
                            <CalendarTaskRow
                              key={t.id}
                              task={t}
                              onComplete={() => handleComplete(t)}
                              onSnooze={(newDue) => handleSnooze(t, newDue)}
                              onDeleteRequest={() => requestDeleteTask(t)}
                            />
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      )}

      {!loading && !error && viewMode === "list" ? (
        <div className="rounded-2xl bg-white shadow-card border border-black/5 overflow-hidden">
          {remindersTasks.length === 0 ? (
            <div className="p-8 text-center text-black/50 text-sm">
              No recurring reminders this month. Care schedules generate reminder tasks when you plant.
            </div>
          ) : (
            <ul className="divide-y divide-black/5">
              {Object.entries(byDateReminders)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([date, dayTasks]) => {
                  const isExpanded = expandedDateGroups.has(date);
                  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("default", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  });
                  return (
                    <li key={date} className="border-b border-black/5 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => toggleDateGroup(date)}
                        className="w-full min-h-[44px] flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors"
                        aria-expanded={isExpanded}
                      >
                        <span className="text-sm font-medium text-black/80">
                          {dateLabel} ({dayTasks.length} reminder{dayTasks.length !== 1 ? "s" : ""})
                        </span>
                        <span className="text-emerald-600 text-sm shrink-0">{isExpanded ? "Hide" : "Show"}</span>
                      </button>
                      {isExpanded && (
                        <div className="px-4 pb-4 space-y-2">
                          {dayTasks.map((t) => (
                            <CalendarTaskRow
                              key={t.id}
                              task={t}
                              onComplete={() => handleComplete(t)}
                              onSnooze={(newDue) => handleSnooze(t, newDue)}
                              onDeleteRequest={() => requestDeleteTask(t)}
                            />
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      ) : null}

      {harvestCelebration && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl bg-amber-500 text-white text-sm font-medium shadow-lg flex items-center gap-2 animate-fade-in" role="status">
          <span aria-hidden>🌿</span>
          <span>Harvest logged! {harvestCelebration}</span>
        </div>
      )}

      {plantingCelebration && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-emerald-500/90"
          role="status"
          aria-live="polite"
          aria-label="Planting saved"
        >
          <div className="flex flex-col items-center justify-center gap-2">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <span className="absolute text-4xl seedling-celebration-seed" aria-hidden>🌰</span>
              <span className="text-5xl seedling-celebration-sprout" aria-hidden>🌱</span>
            </div>
            <p className="text-white font-semibold text-lg">Planted!</p>
            <p className="text-white/90 text-sm">{plantingCelebration}</p>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          setNewTaskOpen(true);
          setNewTaskTitle("");
          setNewTaskDue(new Date().toISOString().slice(0, 10));
          setNewTaskCategory(viewMode === "list" ? "general" : "maintenance");
          setNewTaskPlantId("");
          setNewTaskError(null);
        }}
        className={`fixed right-6 z-30 w-14 h-14 rounded-full shadow-card flex items-center justify-center hover:opacity-90 transition-all ${newTaskOpen ? "bg-emerald-700 text-white" : "bg-emerald text-white"}`}
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        aria-label={newTaskOpen ? "Close" : "New task"}
        aria-expanded={newTaskOpen}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${newTaskOpen ? "rotate-45" : "rotate-0"}`}
          aria-hidden
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
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
            className="fixed left-4 right-4 bottom-20 z-50 max-h-[85vh] overflow-y-auto rounded-3xl bg-white p-6 border border-neutral-200/80 max-w-md mx-auto"
            style={{ boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-task-title"
          >
            <h2 id="new-task-title" className="text-xl font-bold text-center text-neutral-900 mb-4">
              {viewMode === "list" ? "New Reminder" : "New Task"}
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
              <div className="space-y-2 pt-2">
                <button
                  type="submit"
                  disabled={savingTask}
                  className="w-full py-3 rounded-xl bg-emerald text-white font-semibold shadow-soft disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                >
                  {savingTask ? "Saving…" : "Save task"}
                </button>
                <button
                  type="button"
                  onClick={() => setNewTaskOpen(false)}
                  className="w-full py-2.5 rounded-xl border border-neutral-200 text-neutral-600 font-medium min-h-[44px]"
                >
                  Cancel
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

function SnoozeIcon({ className }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
      <path d="M4 22l2-2M20 22l-2-2M22 4l-2 2M2 4l2 2" />
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
  const [showDelete, setShowDelete] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryLabel = TASK_LABELS[task.category] ?? task.category;
  const plantLabel = (task.plant_name ?? (task.title ?? "").replace(new RegExp(`^${categoryLabel}\\s*`, "i"), "").trim()) || null;
  const displayLine = plantLabel ? `${categoryLabel} – ${plantLabel}` : (task.title ?? categoryLabel);

  const handleDoubleClick = () => {
    setShowDelete(true);
    setTimeout(() => setShowDelete(false), 3000);
  };

  const handlePointerDown = () => {
    longPressTimerRef.current = setTimeout(() => {
      setShowDelete(true);
      setTimeout(() => setShowDelete(false), 3000);
      longPressTimerRef.current = null;
    }, 500);
  };
  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={`flex flex-wrap items-center gap-2 py-3 px-4 rounded-xl text-sm border transition-colors ${
        task.completed_at
          ? "bg-slate-50 border-slate-200/80 text-slate-500"
          : "bg-white border-emerald-200/60 text-black shadow-sm hover:border-emerald-300/70"
      } ${task.id.startsWith("opt-") ? "opacity-60 animate-pulse" : ""}`}
    >
      <span className={`font-medium flex-1 min-w-0 truncate ${task.completed_at ? "line-through" : ""}`}>{displayLine}</span>
      {!task.completed_at && (
        <span className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setSnoozeOpen(true)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-black/60 hover:text-emerald-600 hover:bg-emerald/10"
            aria-label="Snooze"
            title="Snooze"
          >
            <SnoozeIcon />
          </button>
          <button
            type="button"
            onClick={onComplete}
            className={
              isSowTask(task.category)
                ? "min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 flex items-center justify-center"
                : "text-xs font-medium text-emerald-600 hover:underline px-1 min-h-[44px] min-w-[44px] flex items-center justify-center"
            }
          >
            {isSowTask(task.category) ? "Plant" : "Complete"}
          </button>
        </span>
      )}
      {showDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDeleteRequest(); setShowDelete(false); }}
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 shrink-0"
          aria-label="Delete task"
        >
          <TrashIcon />
        </button>
      )}
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
