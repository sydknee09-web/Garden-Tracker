"use client";

import { useEffect, useLayoutEffect, useState, useMemo, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const UniversalAddMenu = dynamic(
  () => import("@/components/UniversalAddMenu").then((m) => ({ default: m.UniversalAddMenu })),
  { ssr: false }
);
const QuickAddSeed = dynamic(
  () => import("@/components/QuickAddSeed").then((m) => ({ default: m.QuickAddSeed })),
  { ssr: false }
);
const BatchAddSeed = dynamic(
  () => import("@/components/BatchAddSeed").then((m) => ({ default: m.BatchAddSeed })),
  { ssr: false }
);
const QuickAddSupply = dynamic(
  () => import("@/components/QuickAddSupply").then((m) => ({ default: m.QuickAddSupply })),
  { ssr: false }
);
const BatchAddSupply = dynamic(
  () => import("@/components/BatchAddSupply").then((m) => ({ default: m.BatchAddSupply })),
  { ssr: false }
);
const AddPlantModal = dynamic(
  () => import("@/components/AddPlantModal").then((m) => ({ default: m.AddPlantModal })),
  { ssr: false }
);
const PurchaseOrderImport = dynamic(
  () => import("@/components/PurchaseOrderImport").then((m) => ({ default: m.PurchaseOrderImport })),
  { ssr: false }
);
const NewTaskModal = dynamic(
  () => import("@/components/NewTaskModal").then((m) => ({ default: m.NewTaskModal })),
  { ssr: false }
);
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { OwnerBadge } from "@/components/OwnerBadge";
import { completeTask } from "@/lib/completeSowTask";
import { generateCareTasks } from "@/lib/generateCareTasks";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { isPlantableInMonthSimple } from "@/lib/plantingWindowSimple";
import type { Task } from "@/types/garden";
import { useModalBackClose } from "@/hooks/useModalBackClose";
import { qtyStatusToLabel } from "@/lib/packetQtyLabels";
import { getCachedTasks, setCachedTasks } from "@/lib/calendarTasksCache";

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
  water: "Water",
  spray: "Spray",
};

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
  const { viewMode: householdViewMode, getShorthandForUser, canEditPage } = useHousehold();
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [tasks, setTasks] = useState<(Task & { plant_name?: string; user_id?: string | null })[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<(Task & { plant_name?: string; user_id?: string | null })[]>([]);
  const [completedTasksForMonth, setCompletedTasksForMonth] = useState<(Task & { plant_name?: string; user_id?: string | null })[]>([]);
  const [completedTasksForSelectedDay, setCompletedTasksForSelectedDay] = useState<(Task & { plant_name?: string; user_id?: string | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetch, setRefetch] = useState(0);
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [universalAddMenuOpen, setUniversalAddMenuOpen] = useState(false);
  const [quickAddSeedOpen, setQuickAddSeedOpen] = useState(false);
  const [batchAddSeedOpen, setBatchAddSeedOpen] = useState(false);
  const [shedQuickAddOpen, setShedQuickAddOpen] = useState(false);
  const [batchAddSupplyOpen, setBatchAddSupplyOpen] = useState(false);
  const [showAddPlantModal, setShowAddPlantModal] = useState(false);
  const [addPlantDefaultType, setAddPlantDefaultType] = useState<"permanent" | "seasonal">("seasonal");
  const [purchaseOrderOpen, setPurchaseOrderOpen] = useState(false);
  const [purchaseOrderMode, setPurchaseOrderMode] = useState<"seed" | "supply">("seed");
  const [purchaseOrderAddPlantMode, setPurchaseOrderAddPlantMode] = useState(false);
  const [batchAddPlantMode, setBatchAddPlantMode] = useState(false);
  const skipPopOnNavigateRef = useRef(false);
  const [harvestCelebration, setHarvestCelebration] = useState<string | null>(null);
  const [plantingCelebration, setPlantingCelebration] = useState<string | null>(null);
  const [plantableProfiles, setPlantableProfiles] = useState<{ id: string; name: string; variety_name: string | null }[]>([]);
  const [plantableExpanded, setPlantableExpanded] = useState(false);
  const [plantableInventoryPlantType, setPlantableInventoryPlantType] = useState<{ plantType: string; profiles: { id: string; name: string; variety_name: string | null }[] } | null>(null);
  const [inventoryPackets, setInventoryPackets] = useState<{ plant_profile_id: string; vendor_name: string | null; qty_status: number }[]>([]);
  const [inventoryPacketsLoading, setInventoryPacketsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const swipeStartX = useRef<number | null>(null);
  /** Collapsible date groups: which dates are expanded. Start with today expanded if it has tasks. */
  const [expandedDateGroups, setExpandedDateGroups] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchActionOpen, setBatchActionOpen] = useState<"reschedule" | "delete" | null>(null);
  const [batchDate, setBatchDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [batchSaving, setBatchSaving] = useState(false);
  /** When true, deactivate care schedules and cascade to all their tasks (for recurring care tasks) */
  const [removeScheduleToo, setRemoveScheduleToo] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  useModalBackClose(newTaskOpen, () => setNewTaskOpen(false));
  useModalBackClose(!!batchActionOpen, () => setBatchActionOpen(null));

  // Auto-open task form when navigating with ?openTask=1
  const openTaskHandledRef = useRef(false);
  useEffect(() => {
    if (openTaskHandledRef.current) return;
    if (searchParams.get("openTask") === "1") {
      openTaskHandledRef.current = true;
      setNewTaskOpen(true);
      window.history.replaceState(null, "", "/calendar");
    }
  }, [searchParams]);

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
        .select("id, name, variety_name, planting_window, status")
        .eq("user_id", user.id)
        .is("deleted_at", null);
      if (cancelled) return;
      const monthIndex = month.month;
      const matches = (profiles ?? []).filter((p: { name: string; planting_window?: string | null; status?: string | null }) =>
        isPlantableInMonthSimple(p.planting_window, monthIndex) && p.status !== "out_of_stock" && p.status !== "archived"
      ) as { id: string; name: string; variety_name: string | null }[];
      setPlantableProfiles(matches);
    })();
    return () => { cancelled = true; };
  }, [user?.id, month.month]);

  // Show cached data before paint when navigating back (avoids loading flash)
  useLayoutEffect(() => {
    if (!user) {
      setTasks([]);
      setOverdueTasks([]);
      setCompletedTasksForMonth([]);
      setCompletedTasksForSelectedDay([]);
      setLoading(false);
      return;
    }
    const cached = getCachedTasks(user.id, householdViewMode ?? "personal");
    if (cached) {
      setTasks(cached as (Task & { plant_name?: string; user_id?: string | null })[]);
      setOverdueTasks([]); // Overdue will load on fetch
      setLoading(false);
      setError(null);
    }
  }, [user?.id, householdViewMode]);

  useEffect(() => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }
    const userId = user.id;
    const viewMode = householdViewMode ?? "personal";
    let cancelled = false;

    async function fetchTasks() {
      // Generate any newly-due care tasks before fetching
      await generateCareTasks(userId);

      if (cancelled) return;

      // Fetch overdue tasks (due_date < today, completed_at = null)
      let overdueQuery = supabase
        .from("tasks")
        .select("id, plant_profile_id, category, due_date, completed_at, created_at, grow_instance_id, title, care_schedule_id, user_id")
        .is("deleted_at", null)
        .is("completed_at", null)
        .lt("due_date", todayStr)
        .order("due_date", { ascending: true });
      if (viewMode !== "family") overdueQuery = overdueQuery.eq("user_id", userId);
      const { data: overdueRows } = await overdueQuery;

      // Fetch all upcoming tasks (from today, up to 1 year out)
      const oneYearOut = new Date();
      oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
      const futureLimit = oneYearOut.toISOString().slice(0, 10);

      let tasksQuery = supabase
        .from("tasks")
        .select("id, plant_profile_id, category, due_date, completed_at, created_at, grow_instance_id, title, care_schedule_id, user_id")
        .is("deleted_at", null)
        .gte("due_date", todayStr)
        .lte("due_date", futureLimit)
        .order("due_date");
      if (viewMode !== "family") tasksQuery = tasksQuery.eq("user_id", userId);
      const { data: taskRows, error: e } = await tasksQuery;

      if (cancelled) return;
      if (e) {
        setError(e.message);
        setTasks([]);
        setOverdueTasks([]);
        setLoading(false);
        return;
      }

      const allProfileIds = [
        ...new Set([
          ...(taskRows ?? []).map((t: { plant_profile_id?: string | null }) => t.plant_profile_id).filter(Boolean),
          ...(overdueRows ?? []).map((t: { plant_profile_id?: string | null }) => t.plant_profile_id).filter(Boolean),
        ]),
      ] as string[];
      const names: Record<string, string> = {};
      if (allProfileIds.length > 0) {
        const { data: profiles } = await supabase.from("plant_profiles").select("id, name, variety_name").in("id", allProfileIds).is("deleted_at", null);
        (profiles ?? []).forEach((p: { id: string; name: string; variety_name: string | null }) => {
          names[p.id] = p.variety_name?.trim() ? `${p.name} (${p.variety_name})` : p.name;
        });
      }

      const withNames = (rows: unknown[]) =>
        (rows ?? []).map((t) => {
          const task = t as Task & { user_id?: string | null };
          return {
            ...task,
            plant_name: (task.plant_profile_id ? names[task.plant_profile_id] : null) ?? "Unknown",
          };
        });

      setOverdueTasks(withNames(overdueRows ?? []));
      const upcoming = withNames(taskRows ?? []);
      setTasks(upcoming);
      setCachedTasks(userId, viewMode, upcoming);
      setLoading(false);
    }

    fetchTasks();
    return () => {
      cancelled = true;
    };
  }, [user?.id, refetch, householdViewMode]);

  // Fetch completed tasks for displayed month (by due_date) — used for calendar dots
  useEffect(() => {
    if (!user?.id) {
      setCompletedTasksForMonth([]);
      return;
    }
    const viewMode = householdViewMode ?? "personal";
    let cancelled = false;
    const firstDayOfMonth = `${month.year}-${String(month.month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(month.year, month.month + 1, 0).getDate();
    const lastDayOfMonth = `${month.year}-${String(month.month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
    (async () => {
      let query = supabase
        .from("tasks")
        .select("id, plant_profile_id, category, due_date, completed_at, created_at, grow_instance_id, title, care_schedule_id, user_id")
        .is("deleted_at", null)
        .not("completed_at", "is", null)
        .gte("due_date", firstDayOfMonth)
        .lte("due_date", lastDayOfMonth)
        .order("completed_at", { ascending: false });
      if (viewMode !== "family") query = query.eq("user_id", user!.id);
      const { data: rows } = await query;
      if (cancelled) return;
      const allProfileIds = [...new Set((rows ?? []).map((t: { plant_profile_id?: string | null }) => t.plant_profile_id).filter(Boolean))] as string[];
      const names: Record<string, string> = {};
      if (allProfileIds.length > 0) {
        const { data: profiles } = await supabase.from("plant_profiles").select("id, name, variety_name").in("id", allProfileIds).is("deleted_at", null);
        (profiles ?? []).forEach((p: { id: string; name: string; variety_name: string | null }) => {
          names[p.id] = p.variety_name?.trim() ? `${p.name} (${p.variety_name})` : p.name;
        });
      }
      const withNames = (rows ?? []).map((t) => {
        const task = t as Task & { user_id?: string | null };
        return { ...task, plant_name: (task.plant_profile_id ? names[task.plant_profile_id] : null) ?? "Unknown" };
      });
      setCompletedTasksForMonth(withNames);
    })();
    return () => { cancelled = true; };
  }, [user?.id, refetch, householdViewMode, month.year, month.month]);

  // Fetch completed tasks for selected day (by completed_at) — used for list when date selected
  useEffect(() => {
    if (!user?.id || !selectedDate) {
      setCompletedTasksForSelectedDay([]);
      return;
    }
    const viewMode = householdViewMode ?? "personal";
    let cancelled = false;
    const startOfDay = `${selectedDate}T00:00:00.000Z`;
    const nextDay = new Date(selectedDate + "T12:00:00");
    nextDay.setDate(nextDay.getDate() + 1);
    const endOfDay = nextDay.toISOString().slice(0, 19) + "Z";
    (async () => {
      let query = supabase
        .from("tasks")
        .select("id, plant_profile_id, category, due_date, completed_at, created_at, grow_instance_id, title, care_schedule_id, user_id")
        .is("deleted_at", null)
        .not("completed_at", "is", null)
        .gte("completed_at", startOfDay)
        .lt("completed_at", endOfDay)
        .order("completed_at", { ascending: false });
      if (viewMode !== "family") query = query.eq("user_id", user!.id);
      const { data: rows } = await query;
      if (cancelled) return;
      const allProfileIds = [...new Set((rows ?? []).map((t: { plant_profile_id?: string | null }) => t.plant_profile_id).filter(Boolean))] as string[];
      const names: Record<string, string> = {};
      if (allProfileIds.length > 0) {
        const { data: profiles } = await supabase.from("plant_profiles").select("id, name, variety_name").in("id", allProfileIds).is("deleted_at", null);
        (profiles ?? []).forEach((p: { id: string; name: string; variety_name: string | null }) => {
          names[p.id] = p.variety_name?.trim() ? `${p.name} (${p.variety_name})` : p.name;
        });
      }
      const withNames = (rows ?? []).map((t) => {
        const task = t as Task & { user_id?: string | null };
        return { ...task, plant_name: (task.plant_profile_id ? names[task.plant_profile_id] : null) ?? "Unknown" };
      });
      setCompletedTasksForSelectedDay(withNames);
    })();
    return () => { cancelled = true; };
  }, [user?.id, refetch, householdViewMode, selectedDate]);

  async function handleComplete(t: Task & { plant_name?: string }) {
    if (!user || t.completed_at) return;
    const isHarvest = t.category === "harvest";
    const isSow = isSowTask(t.category);
    const plantLabel = t.plant_name ?? t.title ?? "Plant";

    if (isSow) {
      setPlantingCelebration(plantLabel);
      if (navigator.vibrate) navigator.vibrate(50);
    }

    await completeTask(t, (t as Task & { user_id?: string | null }).user_id ?? user.id);
    setRefetch((r) => r + 1);
    hapticSuccess();

    if (isHarvest) {
      setHarvestCelebration(plantLabel);
      setTimeout(() => setHarvestCelebration(null), 2500);
    } else if (isSow) {
      setTimeout(() => setPlantingCelebration(null), 800);
    }
  }

  async function handleSnooze(t: Task & { plant_name?: string; user_id?: string | null }, newDueDate: string) {
    if (!user || t.completed_at) return;
    const taskOwner = t.user_id ?? user.id;
    const oldDate = t.due_date;
    const deltaDays = Math.round((new Date(newDueDate).getTime() - new Date(oldDate).getTime()) / (24 * 60 * 60 * 1000));
    await supabase.from("tasks").update({ due_date: newDueDate }).eq("id", t.id).eq("user_id", taskOwner);
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
        await supabase.from("tasks").update({ due_date: newHarvestDate }).eq("id", (harvestTask as { id: string }).id).eq("user_id", taskOwner);
        await supabase.from("grow_instances").update({ expected_harvest_date: newHarvestDate }).eq("id", t.grow_instance_id).eq("user_id", taskOwner);
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

  const byDate: Record<string, (Task & { plant_name?: string; user_id?: string | null })[]> = {};
  tasks
    .filter((t) => !t.completed_at)
    .forEach((t) => {
      const d = t.due_date;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(t);
    });

  const completedByDate = useMemo(() => {
    const out: Record<string, (Task & { plant_name?: string; user_id?: string | null })[]> = {};
    completedTasksForMonth.forEach((t) => {
      const d = t.due_date;
      if (!out[d]) out[d] = [];
      out[d].push(t);
    });
    return out;
  }, [completedTasksForMonth]);

  const firstDayOfMonth = `${month.year}-${String(month.month + 1).padStart(2, "0")}-01`;
  const lastDayNum = new Date(month.year, month.month + 1, 0).getDate();
  const lastDayOfMonth = `${month.year}-${String(month.month + 1).padStart(2, "0")}-${String(lastDayNum).padStart(2, "0")}`;
  const isTodayInMonth = todayStr >= firstDayOfMonth && todayStr <= lastDayOfMonth;
  const completedForToday = isTodayInMonth ? (completedByDate[todayStr] ?? []) : [];

  const expandedInitRef = useRef(false);
  const lastMonthKey = useRef(`${month.year}-${month.month}`);
  useEffect(() => {
    const monthKey = `${month.year}-${month.month}`;
    if (lastMonthKey.current !== monthKey) {
      expandedInitRef.current = false;
      lastMonthKey.current = monthKey;
    }
    if (expandedInitRef.current || (tasks.length === 0 && overdueTasks.length === 0 && completedForToday.length === 0)) return;
    expandedInitRef.current = true;
    const next = new Set<string>();
    if (overdueTasks.length > 0) next.add("overdue");
    const todayTasks = tasks.filter((t) => t.due_date === todayStr);
    if (todayTasks.length > 0 || completedForToday.length > 0) next.add(todayStr);
    setExpandedDateGroups(next);
  }, [tasks, overdueTasks, todayStr, completedForToday.length, month.year, month.month]);

  const toggleDateGroup = useCallback((date: string) => {
    setExpandedDateGroups((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }, []);

  const handleLongPressTask = useCallback((taskId: string) => {
    setSelectMode(true);
    setSelectedIds(new Set([taskId]));
  }, []);

  const toggleTaskSelect = useCallback((taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBatchActionOpen(null);
  }, []);

  const handleBatchReschedule = useCallback(async (newDate: string) => {
    if (!user) return;
    setBatchSaving(true);
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map((id) => {
      const task = tasks.find((t) => t.id === id);
      const ownerId = (task as { user_id?: string | null })?.user_id ?? user.id;
      return supabase.from("tasks").update({ due_date: newDate }).eq("id", id).eq("user_id", ownerId);
    }));
    setBatchSaving(false);
    hapticSuccess();
    setSelectMode(false);
    setSelectedIds(new Set());
    setBatchActionOpen(null);
    setRefetch((r) => r + 1);
  }, [user, selectedIds, tasks]);

  const handleBatchDelete = useCallback(async () => {
    if (!user) return;
    setBatchSaving(true);
    const now = new Date().toISOString();
    const ids = Array.from(selectedIds);
    const selectedTasks = ids.map((id) => tasks.find((t) => t.id === id)).filter(Boolean) as (Task & { user_id?: string | null; care_schedule_id?: string | null })[];
    const careScheduleIds = removeScheduleToo
      ? [...new Set(selectedTasks.map((t) => t.care_schedule_id).filter(Boolean))] as string[]
      : [];

    if (careScheduleIds.length > 0) {
      for (const scheduleId of careScheduleIds) {
        const taskWithSchedule = selectedTasks.find((t) => t.care_schedule_id === scheduleId);
        const ownerId = taskWithSchedule?.user_id ?? user.id;
        await supabase
          .from("care_schedules")
          .update({ is_active: false, deleted_at: now })
          .eq("id", scheduleId)
          .eq("user_id", ownerId);
        await supabase
          .from("tasks")
          .update({ deleted_at: now })
          .eq("care_schedule_id", scheduleId)
          .eq("user_id", ownerId);
      }
      const idsFromSchedules = new Set(selectedTasks.filter((t) => t.care_schedule_id && careScheduleIds.includes(t.care_schedule_id)).map((t) => t.id));
      const remainingIds = ids.filter((id) => !idsFromSchedules.has(id));
      await Promise.all(remainingIds.map((id) => {
        const task = tasks.find((t) => t.id === id);
        const ownerId = (task as { user_id?: string | null })?.user_id ?? user.id;
        return supabase.from("tasks").update({ deleted_at: now }).eq("id", id).eq("user_id", ownerId);
      }));
    } else {
      await Promise.all(ids.map((id) => {
        const task = tasks.find((t) => t.id === id);
        const ownerId = (task as { user_id?: string | null })?.user_id ?? user.id;
        return supabase.from("tasks").update({ deleted_at: now }).eq("id", id).eq("user_id", ownerId);
      }));
    }
    setBatchSaving(false);
    hapticSuccess();
    setSelectMode(false);
    setSelectedIds(new Set());
    setBatchActionOpen(null);
    setRemoveScheduleToo(false);
    setRefetch((r) => r + 1);
  }, [user, selectedIds, tasks, removeScheduleToo]);

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

  return (
    <div className="px-6 pt-2 pb-6">
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
            className="fixed left-4 right-4 top-1/2 z-50 max-h-[85vh] -translate-y-1/2 overflow-hidden rounded-3xl bg-cream shadow-lg border border-black/10 max-w-md mx-auto flex flex-col"
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
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-3xl border border-teal-gus/40 text-teal-gus hover:bg-teal-gus/10"
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
                              <span>{qtyStatusToLabel(pkt.qty_status)}</span>
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
      ) : (
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
              const completedDay = cell.dateStr ? (completedByDate[cell.dateStr] ?? []) : [];
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selectedDate;
              const uniqueCategories = [...new Set(dayTasks.map((t) => t.category))];
              const hasUpcoming = dayTasks.length > 0;
              const hasCompletedOnly = !hasUpcoming && completedDay.length > 0;
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
                      {cell.dateStr && (hasUpcoming || hasCompletedOnly) && (
                        <div className="flex flex-wrap justify-center gap-0.5 mt-1">
                          {hasUpcoming ? (
                            <>
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
                            </>
                          ) : (
                            <span
                              className="w-1.5 h-1.5 rounded-full shrink-0 bg-slate-400"
                              title="Completed"
                              aria-hidden
                            />
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
                  onClick={() => setSelectedDate(cell.dateStr === selectedDate ? null : cell.dateStr!)}
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
      )}

      {!loading && !error && (
        <div className="mt-4 rounded-2xl bg-white shadow-card border border-black/5 overflow-hidden">
          <div className="relative px-4 py-4 flex items-center justify-center border-b border-black/10">
            <h2 className="text-base font-bold text-black text-center">
              {selectedDate
                ? `Tasks for ${new Date(selectedDate + "T12:00:00").toLocaleDateString("default", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}`
                : "Upcoming Tasks"}
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
          {!selectedDate &&
          overdueTasks.length === 0 &&
          Object.keys(byDate).length === 0 &&
          !(isTodayInMonth && completedForToday.length > 0) ? (
            <div className="p-6 text-center">
              <p className="text-black/60 text-sm font-medium">
                No upcoming tasks scheduled.
              </p>
              <p className="text-sm text-black/50 mt-2">
                Tap + to add a task, or plant from a profile to generate tasks automatically.
              </p>
            </div>
          ) : selectedDate ? (
            (() => {
              const upcomingForDate = byDate[selectedDate] ?? [];
              const completedForDate = completedTasksForSelectedDay;
              const hasAny = upcomingForDate.length > 0 || completedForDate.length > 0;
              if (!hasAny) {
                return (
                  <div className="p-6 text-center">
                    <p className="text-black/50 text-sm">
                      No tasks on {new Date(selectedDate + "T12:00:00").toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" })}.
                    </p>
                    <p className="text-xs text-black/40 mt-1">Tap another date to see its tasks.</p>
                  </div>
                );
              }
              return (
                <ul className="divide-y divide-black/5">
                  {upcomingForDate.map((t) => (
                    <li key={t.id} className="p-4">
                      <CalendarTaskRow
                        task={t}
                        onComplete={() => handleComplete(t)}
                        onSnooze={(newDue) => handleSnooze(t, newDue)}
                        selectMode={selectMode}
                        isSelected={selectedIds.has(t.id)}
                        onLongPress={() => handleLongPressTask(t.id)}
                        onToggleSelect={() => toggleTaskSelect(t.id)}
                        onTaskTap={t.plant_profile_id ? () => router.push(`/vault/${t.plant_profile_id}?tab=care&from=calendar&date=${t.due_date}`) : undefined}
                        ownerBadge={householdViewMode === "family" && t.user_id ? getShorthandForUser(t.user_id) : null}
                        canEdit={!t.user_id || canEditPage(t.user_id, "garden")}
                      />
                    </li>
                  ))}
                  {completedForDate.length > 0 && (
                    <li className="p-4 pt-2 border-t border-black/5">
                      <div className="space-y-2 bg-slate-50/30 rounded-lg px-3 py-2">
                        {completedForDate.map((t) => (
                          <CalendarTaskRow
                            key={t.id}
                            task={t}
                            onComplete={() => {}}
                            onSnooze={() => {}}
                            selectMode={false}
                            onTaskTap={t.plant_profile_id ? () => router.push(`/vault/${t.plant_profile_id}?tab=care&from=calendar&date=${t.due_date}`) : undefined}
                            ownerBadge={householdViewMode === "family" && t.user_id ? getShorthandForUser(t.user_id) : null}
                            canEdit={false}
                          />
                        ))}
                      </div>
                    </li>
                  )}
                </ul>
              );
            })()
          ) : (
            <ul className="divide-y divide-black/5">
              {overdueTasks.length > 0 && (
                <li className="border-b border-black/5">
                  <button
                    type="button"
                    onClick={() => toggleDateGroup("overdue")}
                    className="w-full min-h-[44px] flex items-center justify-between gap-2 px-4 py-3 text-left hover:bg-black/[0.02] transition-colors bg-amber-50/50"
                    aria-expanded={expandedDateGroups.has("overdue")}
                  >
                    <span className="text-sm font-medium text-amber-800">
                      Overdue ({overdueTasks.length} task{overdueTasks.length !== 1 ? "s" : ""})
                    </span>
                    <span className="text-amber-700 text-sm shrink-0">{expandedDateGroups.has("overdue") ? "Hide" : "Show"}</span>
                  </button>
                  {expandedDateGroups.has("overdue") && (
                    <div className="px-4 pb-4 space-y-2 bg-amber-50/30">
                      {overdueTasks.map((t) => (
                        <CalendarTaskRow
                          key={t.id}
                          task={t}
                          onComplete={() => handleComplete(t)}
                          onSnooze={(newDue) => handleSnooze(t, newDue)}
                          selectMode={selectMode}
                          isSelected={selectedIds.has(t.id)}
                          onLongPress={() => handleLongPressTask(t.id)}
                          onToggleSelect={() => toggleTaskSelect(t.id)}
                          onTaskTap={t.plant_profile_id ? () => router.push(`/vault/${t.plant_profile_id}?tab=care&from=calendar&date=${t.due_date}`) : undefined}
                          ownerBadge={householdViewMode === "family" && t.user_id ? getShorthandForUser(t.user_id) : null}
                          canEdit={!t.user_id || canEditPage(t.user_id, "garden")}
                        />
                      ))}
                    </div>
                  )}
                </li>
              )}
              {(() => {
                const datesToShow = [
                  ...new Set([
                    ...Object.keys(byDate),
                    ...(isTodayInMonth && completedForToday.length > 0 ? [todayStr] : []),
                  ]),
                ].sort((a, b) => a.localeCompare(b));
                return datesToShow.map((date) => {
                  const dayTasks = byDate[date] ?? [];
                  const completedForDate = completedByDate[date] ?? [];
                  const isExpanded = expandedDateGroups.has(date);
                  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("default", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  });
                  const sowCount = dayTasks.filter((t) =>
                    ["sow", "start_seed", "direct_sow", "transplant"].includes(t.category)
                  ).length;
                  const totalItems = dayTasks.length + completedForDate.length;
                  const summary =
                    sowCount > 0 && sowCount === dayTasks.length && completedForDate.length === 0
                      ? `${sowCount} sowing${sowCount !== 1 ? "s" : ""}`
                      : `${totalItems} item${totalItems !== 1 ? "s" : ""}`;
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
                              selectMode={selectMode}
                              isSelected={selectedIds.has(t.id)}
                              onLongPress={() => handleLongPressTask(t.id)}
                              onToggleSelect={() => toggleTaskSelect(t.id)}
                              onTaskTap={t.plant_profile_id ? () => router.push(`/vault/${t.plant_profile_id}?tab=care&from=calendar&date=${t.due_date}`) : undefined}
                              ownerBadge={householdViewMode === "family" && t.user_id ? getShorthandForUser(t.user_id) : null}
                              canEdit={!t.user_id || canEditPage(t.user_id, "garden")}
                            />
                          ))}
                          {completedForDate.length > 0 && (
                            <div className="pt-2 mt-2 border-t border-black/5 space-y-2 bg-slate-50/30 rounded-lg px-3 py-2">
                              {completedForDate.map((t) => (
                                <CalendarTaskRow
                                  key={t.id}
                                  task={t}
                                  onComplete={() => {}}
                                  onSnooze={() => {}}
                                  selectMode={false}
                                  onTaskTap={t.plant_profile_id ? () => router.push(`/vault/${t.plant_profile_id}?tab=care&from=calendar&date=${t.due_date}`) : undefined}
                                  ownerBadge={householdViewMode === "family" && t.user_id ? getShorthandForUser(t.user_id) : null}
                                  canEdit={false}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                });
              })()}
            </ul>
          )}
        </div>
      )}

      {/* Batch select action bar */}
      {selectMode && (
        <div className="fixed bottom-[88px] left-0 right-0 z-40 px-4 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-lg border border-black/10 px-4 py-3 flex items-center gap-3 pointer-events-auto">
            <span className="flex-1 text-sm font-semibold text-black">
              {selectedIds.size} selected
            </span>
            <button
              type="button"
              disabled={selectedIds.size === 0 || batchSaving}
              onClick={() => { setBatchDate(new Date().toISOString().slice(0, 10)); setBatchActionOpen("reschedule"); }}
              className="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-200 hover:bg-emerald-100 disabled:opacity-40 min-h-[44px]"
            >
              Reschedule
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0 || batchSaving}
              onClick={() => setBatchActionOpen("delete")}
              className="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 text-sm font-medium border border-red-200 hover:bg-red-100 disabled:opacity-40 min-h-[44px]"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={exitSelectMode}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-black/50 hover:text-black hover:bg-black/5"
              aria-label="Exit select mode"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Batch reschedule sheet */}
      {batchActionOpen === "reschedule" && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" onClick={() => setBatchActionOpen(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-[100] bg-cream rounded-t-3xl px-4 pt-5 pb-10 space-y-3 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
            <h3 className="text-base font-bold text-black">Reschedule {selectedIds.size} task{selectedIds.size !== 1 ? "s" : ""}</h3>
            <div className="grid grid-cols-3 gap-2">
              {([{ label: "Tomorrow", days: 1 }, { label: "In 3 days", days: 3 }, { label: "Next week", days: 7 }] as { label: string; days: number }[]).map(({ label, days }) => {
                const d = new Date(); d.setDate(d.getDate() + days);
                const dateStr = d.toISOString().slice(0, 10);
                return (
                  <button key={label} type="button" disabled={batchSaving} onClick={() => handleBatchReschedule(dateStr)}
                    className="py-3 rounded-3xl border border-teal-gus/40 text-teal-gus text-sm font-medium hover:bg-teal-gus/10 disabled:opacity-40 min-h-[44px]">
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 items-center pt-1">
              <input type="date" value={batchDate} onChange={(e) => setBatchDate(e.target.value)}
                className="flex-1 rounded-3xl border border-black/10 px-3 py-2 text-sm" />
              <button type="button" disabled={batchSaving} onClick={() => handleBatchReschedule(batchDate)}
                className="px-4 py-2 rounded-3xl bg-emerald text-white text-sm font-medium min-h-[44px] disabled:opacity-40">
                {batchSaving ? "Saving…" : "Apply"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Batch delete confirm sheet — single unified delete confirmation */}
      {batchActionOpen === "delete" && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" onClick={() => { setBatchActionOpen(null); setRemoveScheduleToo(false); }} aria-hidden />
          <div
            className="fixed bottom-0 left-0 right-0 z-[100] bg-cream rounded-t-3xl px-4 pt-5 pb-10 space-y-4 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
            style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
            role="dialog"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-desc"
          >
            <h3 id="delete-dialog-title" className="text-base font-bold text-black">
              Delete {selectedIds.size} task{selectedIds.size !== 1 ? "s" : ""}?
            </h3>
            <p id="delete-dialog-desc" className="text-sm text-black/60">This cannot be undone.</p>
            {Array.from(selectedIds).some((id) => {
              const t = tasks.find((x) => x.id === id) as { care_schedule_id?: string | null } | undefined;
              return t?.care_schedule_id != null;
            }) && (
              <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
                <input
                  type="checkbox"
                  checked={removeScheduleToo}
                  onChange={(e) => setRemoveScheduleToo(e.target.checked)}
                  className="rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                  aria-describedby="remove-schedule-desc"
                />
                <span id="remove-schedule-desc" className="text-sm text-black/80">
                  Also remove recurring schedule (stop future tasks)
                </span>
              </label>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setBatchActionOpen(null); setRemoveScheduleToo(false); }}
                className="flex-1 py-3 rounded-3xl border border-teal-gus/40 text-teal-gus font-medium min-h-[44px] hover:bg-teal-gus/10">
                Cancel
              </button>
              <button type="button" disabled={batchSaving} onClick={handleBatchDelete}
                className="flex-1 py-3 rounded-3xl bg-red-500 text-white text-sm font-semibold min-h-[44px] disabled:opacity-40">
                {batchSaving ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </>
      )}

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
          if (universalAddMenuOpen) {
            setUniversalAddMenuOpen(false);
          } else if (newTaskOpen) {
            setNewTaskOpen(false);
          } else {
            setUniversalAddMenuOpen(true);
          }
        }}
        className={`fixed right-6 z-30 w-14 h-14 rounded-full shadow-card flex items-center justify-center hover:opacity-90 transition-all ${universalAddMenuOpen || newTaskOpen ? "bg-emerald-700 text-white" : "bg-emerald text-white"}`}
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        aria-label={universalAddMenuOpen || newTaskOpen ? "Close" : "Add"}
        aria-expanded={universalAddMenuOpen || newTaskOpen}
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
          className={`transition-transform duration-200 ${universalAddMenuOpen || newTaskOpen ? "rotate-45" : "rotate-0"}`}
          aria-hidden
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {universalAddMenuOpen && (
        <UniversalAddMenu
          open={universalAddMenuOpen}
          onClose={() => setUniversalAddMenuOpen(false)}
          pathname={pathname ?? "/calendar"}
          onAddSeed={() => {
            setUniversalAddMenuOpen(false);
            setQuickAddSeedOpen(true);
          }}
          onAddPlantManual={(defaultType) => {
            setUniversalAddMenuOpen(false);
            setAddPlantDefaultType(defaultType);
            setShowAddPlantModal(true);
          }}
          onAddPlantFromVault={() => {
            skipPopOnNavigateRef.current = true;
            setUniversalAddMenuOpen(false);
            router.push("/vault/plant?from=calendar");
          }}
          onAddPlantPurchaseOrder={() => {
            setUniversalAddMenuOpen(false);
            setPurchaseOrderMode("seed");
            setPurchaseOrderAddPlantMode(true);
            setPurchaseOrderOpen(true);
          }}
          onAddPlantPhotoImport={() => {
            setUniversalAddMenuOpen(false);
            setBatchAddPlantMode(true);
            setBatchAddSeedOpen(true);
          }}
          onAddToShed={() => {
            setUniversalAddMenuOpen(false);
            setShedQuickAddOpen(true);
          }}
          onAddTask={() => {
            setUniversalAddMenuOpen(false);
            setNewTaskOpen(true);
          }}
          onAddJournal={() => {
            skipPopOnNavigateRef.current = true;
            setUniversalAddMenuOpen(false);
            router.push("/journal/new");
          }}
        />
      )}

      {quickAddSeedOpen && (
        <QuickAddSeed
          open={quickAddSeedOpen}
          onClose={() => setQuickAddSeedOpen(false)}
          onBackToMenu={() => {
            setQuickAddSeedOpen(false);
            setUniversalAddMenuOpen(true);
          }}
          onSuccess={() => setRefetch((r) => r + 1)}
          onOpenBatch={() => {
            setQuickAddSeedOpen(false);
            setBatchAddPlantMode(false);
            setBatchAddSeedOpen(true);
          }}
          onOpenLinkImport={() => {
            skipPopOnNavigateRef.current = true;
            setQuickAddSeedOpen(false);
            router.push("/vault/import?embed=1");
          }}
          onStartManualImport={() => {
            skipPopOnNavigateRef.current = true;
            setQuickAddSeedOpen(false);
            router.push("/vault/import/manual");
          }}
          onOpenPurchaseOrder={() => {
            skipPopOnNavigateRef.current = true;
            setQuickAddSeedOpen(false);
            setPurchaseOrderMode("seed");
            setPurchaseOrderAddPlantMode(false);
            setPurchaseOrderOpen(true);
          }}
        />
      )}

      {batchAddSeedOpen && (
        <BatchAddSeed
          open={batchAddSeedOpen}
          onClose={() => setBatchAddSeedOpen(false)}
          onSuccess={() => setRefetch((r) => r + 1)}
          onNavigateToHero={() => {
            skipPopOnNavigateRef.current = true;
            setBatchAddSeedOpen(false);
            router.push("/vault/import/photos/hero");
          }}
          addPlantMode={batchAddPlantMode}
        />
      )}

      {shedQuickAddOpen && (
        <QuickAddSupply
          open={shedQuickAddOpen}
          onClose={() => setShedQuickAddOpen(false)}
          onSuccess={() => setRefetch((r) => r + 1)}
          onBackToMenu={() => {
            setShedQuickAddOpen(false);
            setUniversalAddMenuOpen(true);
          }}
          onOpenPurchaseOrder={() => {
            skipPopOnNavigateRef.current = true;
            setShedQuickAddOpen(false);
            setPurchaseOrderMode("supply");
            setPurchaseOrderOpen(true);
          }}
          onOpenBatchPhotoImport={() => {
            skipPopOnNavigateRef.current = true;
            setShedQuickAddOpen(false);
            setBatchAddSupplyOpen(true);
          }}
        />
      )}

      {batchAddSupplyOpen && (
        <BatchAddSupply
          open={batchAddSupplyOpen}
          onClose={() => setBatchAddSupplyOpen(false)}
          onSuccess={() => setRefetch((r) => r + 1)}
        />
      )}

      {showAddPlantModal && (
        <AddPlantModal
          open={showAddPlantModal}
          onClose={() => setShowAddPlantModal(false)}
          onSuccess={() => setRefetch((r) => r + 1)}
          defaultPlantType={addPlantDefaultType}
          stayInGarden={false}
        />
      )}

      {purchaseOrderOpen && (
        <PurchaseOrderImport
          open={purchaseOrderOpen}
          onClose={() => setPurchaseOrderOpen(false)}
          mode={purchaseOrderMode}
          defaultProfileType={purchaseOrderMode === "seed" ? "seed" : undefined}
          addPlantMode={purchaseOrderMode === "seed" ? purchaseOrderAddPlantMode : false}
        />
      )}

      {newTaskOpen && (
        <NewTaskModal
          open={newTaskOpen}
          onClose={() => setNewTaskOpen(false)}
          onBackToMenu={() => {
            setNewTaskOpen(false);
            setUniversalAddMenuOpen(true);
          }}
          onSuccess={() => setRefetch((r) => r + 1)}
        />
      )}
    </div>
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
  selectMode = false,
  isSelected = false,
  onLongPress,
  onToggleSelect,
  onTaskTap,
  ownerBadge,
  canEdit = true,
}: {
  task: Task & { plant_name?: string };
  onComplete: () => void;
  onSnooze: (newDueDate: string) => void;
  selectMode?: boolean;
  isSelected?: boolean;
  onLongPress?: () => void;
  onToggleSelect?: () => void;
  /** When provided, short tap navigates (e.g. to plant profile Care tab) */
  onTaskTap?: () => void;
  ownerBadge?: string | null;
  /** When false, complete/snooze/delete buttons are hidden */
  canEdit?: boolean;
}) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState(task.due_date);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const categoryLabel = TASK_LABELS[task.category] ?? task.category ?? "";
  const primaryLabel = (task.title ?? categoryLabel).trim() || categoryLabel;
  const plantName = task.plant_name?.trim();
  const showPlant = plantName && plantName !== "Unknown" && !primaryLabel.includes(plantName);
  const displayLine = `${primaryLabel}${showPlant ? ` · ${plantName}` : ""} (${new Date(task.due_date).toLocaleDateString()})`;

  const handlePointerDown = () => {
    if (selectMode) return;
    longPressTimerRef.current = setTimeout(() => {
      onLongPress?.();
      longPressTimerRef.current = null;
    }, 500);
  };
  const handlePointerUp = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleClick = selectMode ? () => onToggleSelect?.() : onTaskTap;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className={`flex flex-wrap items-start gap-2 py-3 px-4 rounded-xl text-sm border transition-colors ${
        selectMode && isSelected
          ? "bg-emerald-50 border-emerald-400"
          : task.completed_at
            ? "bg-slate-50 border-slate-200/80 text-slate-500"
            : "bg-white border-emerald-200/60 text-black shadow-sm hover:border-emerald-300/70"
      } ${task.id.startsWith("opt-") ? "opacity-60 animate-pulse" : ""} ${selectMode ? "cursor-pointer select-none" : ""}`}
    >
      {selectMode && (
        <span
          className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
            isSelected ? "bg-emerald-500 border-emerald-500" : "border-black/30 bg-white"
          }`}
          aria-hidden
        >
          {isSelected && (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </span>
      )}
      <span className={`font-medium flex-1 min-w-0 break-words ${task.completed_at ? "line-through" : ""}`}>{displayLine}</span>
      {ownerBadge && (
        <span className="shrink-0">
          <OwnerBadge shorthand={ownerBadge} canEdit={canEdit} size="xs" />
        </span>
      )}
      {!task.completed_at && !selectMode && canEdit && (
        <span className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setSnoozeOpen(true); }}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-black/60 hover:text-emerald-600 hover:bg-emerald/10"
            aria-label="Snooze"
            title="Snooze"
          >
            <SnoozeIcon />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onComplete(); }}
            className={
              isSowTask(task.category)
                ? "min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 flex items-center justify-center"
                : "min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }
            aria-label={isSowTask(task.category) ? "Plant" : "Mark complete"}
          >
            {isSowTask(task.category) ? (
              "Plant"
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        </span>
      )}
      {snoozeOpen && !selectMode && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSnoozeOpen(false)} />
          <div className="fixed left-4 right-4 top-1/2 z-50 -translate-y-1/2 rounded-3xl bg-cream p-4 shadow-card border border-black/5 max-w-xs mx-auto">
            <p className="text-sm font-medium text-black mb-2">New due date</p>
            <input
              type="date"
              value={snoozeDate}
              onChange={(e) => setSnoozeDate(e.target.value)}
              className="w-full rounded-3xl border border-black/10 px-3 py-2 text-sm mb-3"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setSnoozeOpen(false)}
                className="flex-1 py-2 rounded-3xl border border-teal-gus/40 text-teal-gus font-medium">
                Cancel
              </button>
              <button type="button" onClick={() => { onSnooze(snoozeDate); setSnoozeOpen(false); }}
                className="flex-1 py-2 rounded-3xl bg-emerald text-white text-sm font-medium">
                Save
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
