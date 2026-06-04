"use client";

import { useEffect, useLayoutEffect, useState, useMemo, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { LoadingState } from "@/components/LoadingState";

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
const QuickLogModal = dynamic(
  () => import("@/components/QuickLogModal").then((m) => ({ default: m.QuickLogModal })),
  { ssr: false }
);
import { supabase } from "@/lib/supabase";
import { ICON_MAP } from "@/lib/styleDictionary";
import { useAuth } from "@/contexts/AuthContext";
import { useUniversalAddModals } from "@/contexts/UniversalAddContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { OwnerBadge } from "@/components/OwnerBadge";
import { completeTask } from "@/lib/completeSowTask";
import { generateCareTasks } from "@/lib/generateCareTasks";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { isPlantableInMonthSimple } from "@/lib/plantingWindowSimple";
import type { Task } from "@/types/garden";
import { useModalBackClose } from "@/hooks/useModalBackClose";
import { useRowSwipe } from "@/hooks/useRowSwipe";
import { useToast } from "@/hooks/useToast";
import { useUserPlantingZone, isReferenceZone } from "@/hooks/useUserPlantingZone";
import { qtyStatusToLabel } from "@/lib/packetQtyLabels";
import { getCachedTasks, setCachedTasks } from "@/lib/calendarTasksCache";
import { localDateString, firstDayOfMonth, lastDayOfMonth } from "@/lib/calendarDate";

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
  const { toast, showToast } = useToast();
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [batchAddSeedOpen, setBatchAddSeedOpen] = useState(false);
  const [batchAddSupplyOpen, setBatchAddSupplyOpen] = useState(false);
  const [purchaseOrderOpen, setPurchaseOrderOpen] = useState(false);
  const {
    addMenuOpen,
    setAddMenuOpen,
    activeModal,
    addPlantDefaultType,
    setAddPlantDefaultType,
    openMenu,
    closeMenu,
    openShed,
    shedInitialName,
    openTask,
    closeActiveModal,
    backToMenu,
    closeAll,
    openMenuOnScreen,
  } = useUniversalAddModals();
  const [purchaseOrderMode, setPurchaseOrderMode] = useState<"seed" | "supply">("seed");
  const [purchaseOrderAddPlantMode, setPurchaseOrderAddPlantMode] = useState(false);
  const [batchAddPlantMode, setBatchAddPlantMode] = useState(false);
  const skipPopOnNavigateRef = useRef(false);
  /** When true, next fetch skips generateCareTasks (e.g. after delete — otherwise it recreates deleted tasks) */
  const skipGenerateCareTasksRef = useRef(false);
  const [harvestCelebration, setHarvestCelebration] = useState<string | null>(null);
  const [plantingCelebration, setPlantingCelebration] = useState<string | null>(null);
  const [plantableProfiles, setPlantableProfiles] = useState<{ id: string; name: string; variety_name: string | null }[]>([]);
  const [plantableExpanded, setPlantableExpanded] = useState(false);
  const { zone: userPlantingZone, loaded: userPlantingZoneLoaded } = useUserPlantingZone();
  const showZoneMismatchNote = userPlantingZoneLoaded && !isReferenceZone(userPlantingZone);
  const [plantableInventoryPlantType, setPlantableInventoryPlantType] = useState<{ plantType: string; profiles: { id: string; name: string; variety_name: string | null }[] } | null>(null);
  const [inventoryPackets, setInventoryPackets] = useState<{ plant_profile_id: string; vendor_name: string | null; qty_status: number }[]>([]);
  const [inventoryPacketsLoading, setInventoryPacketsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const swipeStartX = useRef<number | null>(null);
  /** Collapsible date groups: which dates are expanded. Start with today expanded if it has tasks. */
  const [expandedDateGroups, setExpandedDateGroups] = useState<Set<string>>(new Set());
  /** Overdue tasks consolidated by (title, plant_profile_id, grow_instance_id, user_id). Multi-task groups can be expanded; this Set tracks which group keys are open. */
  const [expandedOverdueGroups, setExpandedOverdueGroups] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchActionOpen, setBatchActionOpen] = useState<"reschedule" | "delete" | null>(null);
  const [batchDate, setBatchDate] = useState(() => localDateString());
  const [batchSaving, setBatchSaving] = useState(false);
  /** When true, deactivate care schedules and cascade to all their tasks (for recurring care tasks). "selected" = delete only selected tasks; "all_future" = delete schedule + all its tasks. */
  const [deleteScope, setDeleteScope] = useState<"selected" | "all_future">("selected");
  /** Task shown in detail popup (tap task → popup instead of navigating) */
  const [taskDetailTask, setTaskDetailTask] = useState<(Task & { plant_name?: string; user_id?: string | null; supply_profile_id?: string | null }) | null>(null);
  const [taskDetailSupplyName, setTaskDetailSupplyName] = useState<string | null>(null);
  /** True while generateCareTasks runs after first paint (calendar lists already shown). */
  const [careTasksSyncing, setCareTasksSyncing] = useState(false);
  /** When selectMode, FAB opens this menu (Reschedule / Delete / Edit / Exit) instead of add menu */
  const [batchMenuOpen, setBatchMenuOpen] = useState(false);
  /** Task to edit in NewTaskModal (set when user chooses Edit from batch menu with one task selected) */
  const [editTask, setEditTask] = useState<(Task & { plant_name?: string; user_id?: string | null }) | null>(null);
  /** Apply-all action on a consolidated overdue group (Snooze all / Mark all done). Kept separate from selectMode batch-flow to preserve the long-press multi-select UX. */
  const [groupAction, setGroupAction] = useState<{
    kind: "snooze" | "complete";
    tasks: (Task & { plant_name?: string; user_id?: string | null })[];
  } | null>(null);
  const [groupSnoozeDate, setGroupSnoozeDate] = useState(() => localDateString());
  const [groupActionSaving, setGroupActionSaving] = useState(false);

  const todayStr = localDateString();

  useModalBackClose(newTaskOpen, () => setNewTaskOpen(false));
  useModalBackClose(!!batchActionOpen, () => setBatchActionOpen(null));
  useModalBackClose(!!groupAction, () => setGroupAction(null));
  useModalBackClose(addMenuOpen, closeMenu, skipPopOnNavigateRef);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
    setBatchActionOpen(null);
    setBatchMenuOpen(false);
  }, []);

  useModalBackClose(selectMode, exitSelectMode);

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

    async function loadTaskRows(): Promise<boolean> {
      // Fetch overdue tasks (due_date < today, completed_at = null)
      let overdueQuery = supabase
        .from("tasks")
        .select("id, plant_profile_id, category, due_date, completed_at, created_at, grow_instance_id, title, care_schedule_id, user_id, supply_profile_id")
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
        .select("id, plant_profile_id, category, due_date, completed_at, created_at, grow_instance_id, title, care_schedule_id, user_id, supply_profile_id")
        .is("deleted_at", null)
        .gte("due_date", todayStr)
        .lte("due_date", futureLimit)
        .order("due_date");
      if (viewMode !== "family") tasksQuery = tasksQuery.eq("user_id", userId);
      const { data: taskRows, error: e } = await tasksQuery;

      if (cancelled) return false;
      if (e) {
        setError(e.message);
        setTasks([]);
        setOverdueTasks([]);
        setLoading(false);
        return false;
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
      return true;
    }

    async function fetchTasks() {
      // 1) Load lists immediately (overdue + upcoming) so UI is not blocked by generateCareTasks
      const ok = await loadTaskRows();
      if (!ok || cancelled) return;

      // 2) Generate/regenerate care tasks, then refresh lists so new rows and cleanups appear
      if (!skipGenerateCareTasksRef.current) {
        setCareTasksSyncing(true);
        try {
          await generateCareTasks(userId);
        } finally {
          setCareTasksSyncing(false);
        }
      } else {
        skipGenerateCareTasksRef.current = false;
      }

      if (cancelled) return;
      await loadTaskRows();
    }

    fetchTasks();
    return () => {
      cancelled = true;
    };
  }, [user?.id, refetch, householdViewMode]);

  // Fetch completed tasks for displayed month (by completed_at) — used for calendar dots
  useEffect(() => {
    if (!user?.id) {
      setCompletedTasksForMonth([]);
      return;
    }
    const viewMode = householdViewMode ?? "personal";
    let cancelled = false;
    const firstDay = firstDayOfMonth(month.year, month.month);
    const lastDay = lastDayOfMonth(month.year, month.month);
    const startOfMonth = `${firstDay}T00:00:00.000Z`;
    const endOfMonth = `${lastDay}T23:59:59.999Z`;
    (async () => {
      let query = supabase
        .from("tasks")
        .select("id, plant_profile_id, category, due_date, completed_at, created_at, grow_instance_id, title, care_schedule_id, user_id, supply_profile_id")
        .is("deleted_at", null)
        .not("completed_at", "is", null)
        .gte("completed_at", startOfMonth)
        .lte("completed_at", endOfMonth)
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
        .select("id, plant_profile_id, category, due_date, completed_at, created_at, grow_instance_id, title, care_schedule_id, user_id, supply_profile_id")
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

  // Fetch linked supply name: from task row, or from care_schedules when legacy tasks lack supply_profile_id
  useEffect(() => {
    if (!taskDetailTask) {
      setTaskDetailSupplyName(null);
      return;
    }
    let cancelled = false;
    (async () => {
      let supplyId = taskDetailTask.supply_profile_id?.trim() || null;
      if (!supplyId && taskDetailTask.care_schedule_id) {
        const { data: sched } = await supabase
          .from("care_schedules")
          .select("supply_profile_id")
          .eq("id", taskDetailTask.care_schedule_id)
          .maybeSingle();
        const sid = (sched as { supply_profile_id?: string | null } | null)?.supply_profile_id?.trim();
        if (sid) supplyId = sid;
      }
      if (!supplyId) {
        if (!cancelled) setTaskDetailSupplyName(null);
        return;
      }
      const { data } = await supabase.from("supply_profiles").select("name").eq("id", supplyId).maybeSingle();
      if (!cancelled && data) setTaskDetailSupplyName((data as { name?: string }).name ?? null);
      else if (!cancelled) setTaskDetailSupplyName(null);
    })();
    return () => { cancelled = true; };
  }, [taskDetailTask?.id, taskDetailTask?.supply_profile_id, taskDetailTask?.care_schedule_id]);

  async function handleComplete(t: Task & { plant_name?: string }) {
    if (!user || t.completed_at) return;
    const isHarvest = t.category === "harvest";
    const isSow = isSowTask(t.category);
    const plantLabel = t.plant_name ?? t.title ?? "Plant";

    if (isSow) {
      setPlantingCelebration(plantLabel);
      if (navigator.vibrate) navigator.vibrate(50);
    }

    // Optimistic update: remove from list and add to completed so UI updates immediately
    const now = new Date().toISOString();
    const completedTask = { ...t, completed_at: now, due_date: todayStr };
    const wasOverdue = t.due_date < todayStr;
    if (wasOverdue) {
      setOverdueTasks((prev) => prev.filter((x) => x.id !== t.id));
    } else {
      const newTasks = tasks.filter((x) => x.id !== t.id);
      setTasks(newTasks);
      setCachedTasks(user.id, householdViewMode ?? "personal", newTasks);
    }
    setCompletedTasksForMonth((prev) => [...prev, completedTask]);
    if (selectedDate === todayStr) {
      setCompletedTasksForSelectedDay((prev) => [...prev, completedTask]);
    }
    hapticSuccess();
    showToast("Task completed");
    if (taskDetailTask?.id === t.id) setTaskDetailTask(null);

    const ok = await completeTask(t, (t as Task & { user_id?: string | null }).user_id ?? user.id);
    if (!ok) {
      // Revert on error
      if (wasOverdue) {
        setOverdueTasks((prev) => [...prev, t]);
      } else {
        setTasks((prev) => [...prev, t]);
        setCachedTasks(user.id, householdViewMode ?? "personal", tasks);
      }
      setCompletedTasksForMonth((prev) => prev.filter((x) => x.id !== t.id));
      if (selectedDate === todayStr) {
        setCompletedTasksForSelectedDay((prev) => prev.filter((x) => x.id !== t.id));
      }
      showToast("Could not complete task");
      return;
    }
    // Defer refetch so optimistic UI paints first
    setTimeout(() => setRefetch((r) => r + 1), 0);

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
    const wasOverdue = oldDate < todayStr;
    const snoozedTask = { ...t, due_date: newDueDate };

    if (taskDetailTask?.id === t.id) setTaskDetailTask(null);
    // Optimistic update: move task from overdue/current to new date
    if (wasOverdue) {
      setOverdueTasks((prev) => prev.filter((x) => x.id !== t.id));
    }
    setTasks((prev) => {
      const without = prev.filter((x) => x.id !== t.id);
      return [...without, snoozedTask].sort((a, b) => a.due_date.localeCompare(b.due_date));
    });
    setCachedTasks(
      user.id,
      householdViewMode ?? "personal",
      [...tasks.filter((x) => x.id !== t.id), snoozedTask].sort((a, b) => a.due_date.localeCompare(b.due_date))
    );

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
    setTimeout(() => setRefetch((r) => r + 1), 0);
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

  /** Normalize to YYYY-MM-DD so keys match calendar cell dateStr and selectedDate */
  const toDateKey = (value: string | undefined | null) =>
    value ? value.slice(0, 10) : "";

  const byDate: Record<string, (Task & { plant_name?: string; user_id?: string | null })[]> = {};
  tasks
    .filter((t) => !t.completed_at)
    .forEach((t) => {
      const d = toDateKey(t.due_date) || t.due_date;
      if (!d) return;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(t);
    });

  const completedByDate = useMemo(() => {
    const out: Record<string, (Task & { plant_name?: string; user_id?: string | null })[]> = {};
    completedTasksForMonth.forEach((t) => {
      const d = t.completed_at ? toDateKey(new Date(t.completed_at).toISOString().slice(0, 10)) : (toDateKey(t.due_date) || t.due_date);
      if (!d) return;
      if (!out[d]) out[d] = [];
      out[d].push(t);
    });
    return out;
  }, [completedTasksForMonth]);

  const firstDayOfMonthStr = firstDayOfMonth(month.year, month.month);
  const lastDayOfMonthStr = lastDayOfMonth(month.year, month.month);
  const isTodayInMonth = todayStr >= firstDayOfMonthStr && todayStr <= lastDayOfMonthStr;
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

  const toggleOverdueGroup = useCallback((key: string) => {
    setExpandedOverdueGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  /** All section keys ("overdue" + each date with content) used by the master expand-all toggle. */
  const allDateKeys = useMemo(() => {
    const keys: string[] = [];
    if (overdueTasks.length > 0) keys.push("overdue");
    Object.keys(byDate).forEach((k) => keys.push(k));
    if (isTodayInMonth && completedForToday.length > 0 && !keys.includes(todayStr)) {
      keys.push(todayStr);
    }
    return keys;
  }, [overdueTasks.length, byDate, isTodayInMonth, completedForToday.length, todayStr]);

  const isAllExpanded = allDateKeys.length > 0 && allDateKeys.every((k) => expandedDateGroups.has(k));

  const handleToggleAll = useCallback(() => {
    setExpandedDateGroups((prev) => {
      const allOpen = allDateKeys.length > 0 && allDateKeys.every((k) => prev.has(k));
      return allOpen ? new Set() : new Set(allDateKeys);
    });
  }, [allDateKeys]);

  /** Consolidate overdue tasks by (title, plant_profile_id, grow_instance_id, user_id). user_id is in the key so household members' identical tasks don't merge in family view. */
  const overdueGroups = useMemo(() => {
    const groupMap = new Map<string, typeof overdueTasks>();
    for (const t of overdueTasks) {
      const key = [
        t.title ?? "",
        t.plant_profile_id ?? "",
        t.grow_instance_id ?? "",
        t.user_id ?? "",
      ].join("|");
      const existing = groupMap.get(key);
      if (existing) existing.push(t);
      else groupMap.set(key, [t]);
    }
    const result: { key: string; tasks: typeof overdueTasks }[] = [];
    for (const [key, ts] of groupMap.entries()) {
      const sorted = [...ts].sort((a, b) => a.due_date.localeCompare(b.due_date));
      result.push({ key, tasks: sorted });
    }
    result.sort((a, b) => a.tasks[0].due_date.localeCompare(b.tasks[0].due_date));
    return result;
  }, [overdueTasks]);

  const handleSelectAllInGroup = useCallback((groupTasks: (Task & { user_id?: string | null })[]) => {
    setSelectMode(true);
    setSelectedIds(new Set(groupTasks.map((t) => t.id)));
    setBatchMenuOpen(true);
  }, []);

  /** Apply-all "Mark done" on a consolidated overdue group. Optimistic UI, single toast, single refetch. */
  const handleCompleteAllInGroup = useCallback(async () => {
    if (!user || !groupAction || groupAction.kind !== "complete") return;
    setGroupActionSaving(true);
    const groupTasks = groupAction.tasks;
    const ids = new Set(groupTasks.map((t) => t.id));

    const now = new Date().toISOString();
    const completed = groupTasks.map((t) => ({ ...t, completed_at: now, due_date: todayStr }));
    setOverdueTasks((prev) => prev.filter((t) => !ids.has(t.id)));
    setCompletedTasksForMonth((prev) => [...prev, ...completed]);
    if (selectedDate === todayStr) {
      setCompletedTasksForSelectedDay((prev) => [...prev, ...completed]);
    }
    hapticSuccess();
    showToast(`${groupTasks.length} task${groupTasks.length !== 1 ? "s" : ""} completed`);
    setGroupAction(null);

    const results = await Promise.all(
      groupTasks.map((t) => completeTask(t, t.user_id ?? user.id))
    );
    setGroupActionSaving(false);
    if (results.some((ok) => !ok)) {
      showToast("Some tasks could not be completed");
    }
    setTimeout(() => setRefetch((r) => r + 1), 0);
  }, [user, groupAction, todayStr, selectedDate, showToast]);

  /** Apply-all "Snooze" on a consolidated overdue group. Optimistic UI, single toast, single refetch. Transplant→harvest cascade preserved per-task. */
  const handleSnoozeAllInGroup = useCallback(async (newDate: string) => {
    if (!user || !groupAction || groupAction.kind !== "snooze") return;
    setGroupActionSaving(true);
    const groupTasks = groupAction.tasks;
    const ids = new Set(groupTasks.map((t) => t.id));

    const snoozed = groupTasks.map((t) => ({ ...t, due_date: newDate }));
    setOverdueTasks((prev) => prev.filter((t) => !ids.has(t.id)));
    setTasks((prev) => {
      const without = prev.filter((t) => !ids.has(t.id));
      return [...without, ...snoozed].sort((a, b) => a.due_date.localeCompare(b.due_date));
    });
    setCachedTasks(
      user.id,
      householdViewMode ?? "personal",
      [...tasks.filter((t) => !ids.has(t.id)), ...snoozed].sort((a, b) => a.due_date.localeCompare(b.due_date))
    );
    hapticSuccess();
    showToast(`${groupTasks.length} task${groupTasks.length !== 1 ? "s" : ""} snoozed`);
    setGroupAction(null);

    await Promise.all(
      groupTasks.map((t) => {
        const ownerId = t.user_id ?? user.id;
        return supabase.from("tasks").update({ due_date: newDate }).eq("id", t.id).eq("user_id", ownerId);
      })
    );

    // Transplant-harvest cascade: if any task in the group is a transplant with a grow_instance,
    // shift its paired harvest task by the same delta. Mirrors handleSnooze's per-task logic.
    for (const t of groupTasks) {
      if (t.category === "transplant" && t.grow_instance_id) {
        const deltaDays = Math.round(
          (new Date(newDate).getTime() - new Date(t.due_date).getTime()) / (24 * 60 * 60 * 1000)
        );
        if (deltaDays !== 0) {
          const ownerId = t.user_id ?? user.id;
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
            await supabase.from("tasks").update({ due_date: newHarvestDate }).eq("id", (harvestTask as { id: string }).id).eq("user_id", ownerId);
            await supabase.from("grow_instances").update({ expected_harvest_date: newHarvestDate }).eq("id", t.grow_instance_id).eq("user_id", ownerId);
          }
        }
      }
    }

    setGroupActionSaving(false);
    setTimeout(() => setRefetch((r) => r + 1), 0);
  }, [user, groupAction, tasks, householdViewMode, showToast]);

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

  const handleBatchReschedule = useCallback(async (newDate: string) => {
    if (!user) return;
    const ids = Array.from(selectedIds);
    const allTasks = [...tasks, ...overdueTasks];
    const toReschedule = ids.map((id) => allTasks.find((t) => t.id === id)).filter(Boolean) as (Task & { user_id?: string | null })[];

    // Optimistic update: move tasks to new date immediately
    const updatedTasks = toReschedule.map((t) => ({ ...t, due_date: newDate }));
    setOverdueTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
    setTasks((prev) => {
      const without = prev.filter((t) => !ids.includes(t.id));
      return [...without, ...updatedTasks].sort((a, b) => a.due_date.localeCompare(b.due_date));
    });
    setCachedTasks(
      user.id,
      householdViewMode ?? "personal",
      [...tasks.filter((t) => !ids.includes(t.id)), ...updatedTasks].sort((a, b) => a.due_date.localeCompare(b.due_date))
    );
    setBatchSaving(false);
    setSelectMode(false);
    setSelectedIds(new Set());
    setBatchActionOpen(null);
    hapticSuccess();

    await Promise.all(ids.map((id) => {
      const task = allTasks.find((t) => t.id === id);
      const ownerId = (task as { user_id?: string | null })?.user_id ?? user.id;
      return supabase.from("tasks").update({ due_date: newDate }).eq("id", id).eq("user_id", ownerId);
    }));
    setTimeout(() => setRefetch((r) => r + 1), 0);
  }, [user, selectedIds, tasks, overdueTasks, householdViewMode]);

  const handleBatchDelete = useCallback(async () => {
    if (!user) return;
    const ids = Array.from(selectedIds);
    const allTasks = [...tasks, ...overdueTasks];
    const selectedTasks = ids.map((id) => allTasks.find((t) => t.id === id)).filter(Boolean) as (Task & { user_id?: string | null; care_schedule_id?: string | null })[];
    const careScheduleIds = deleteScope === "all_future"
      ? [...new Set(selectedTasks.map((t) => t.care_schedule_id).filter(Boolean))] as string[]
      : [];

    // Determine which task IDs we're deleting (selected only, or all for schedule)
    const idsToDelete = new Set<string>(ids);
    if (careScheduleIds.length > 0) {
      for (const t of allTasks) {
        const sid = (t as { care_schedule_id?: string | null }).care_schedule_id;
        if (sid && careScheduleIds.includes(sid)) idsToDelete.add(t.id);
      }
    }

    // Optimistic update: remove from UI immediately
    if (taskDetailTask && idsToDelete.has(taskDetailTask.id)) setTaskDetailTask(null);
    setTasks((prev) => prev.filter((t) => !idsToDelete.has(t.id)));
    setOverdueTasks((prev) => prev.filter((t) => !idsToDelete.has(t.id)));
    setCachedTasks(user.id, householdViewMode ?? "personal", tasks.filter((t) => !idsToDelete.has(t.id)));
    setBatchSaving(false);
    setSelectMode(false);
    setSelectedIds(new Set());
    setBatchActionOpen(null);
    setDeleteScope("selected");
    hapticSuccess();

    const now = new Date().toISOString();
    try {
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
        for (const id of remainingIds) {
          const task = allTasks.find((t) => t.id === id);
          const ownerId = (task as { user_id?: string | null })?.user_id ?? user.id;
          await supabase.from("tasks").update({ deleted_at: now }).eq("id", id).eq("user_id", ownerId);
        }
      } else {
        for (const id of ids) {
          const task = allTasks.find((t) => t.id === id);
          const ownerId = (task as { user_id?: string | null })?.user_id ?? user.id;
          await supabase.from("tasks").update({ deleted_at: now }).eq("id", id).eq("user_id", ownerId);
        }
      }
      skipGenerateCareTasksRef.current = true; // Prevent generateCareTasks from recreating deleted tasks
      setRefetch((r) => r + 1);
    } catch (err) {
      console.error("Batch delete failed:", err);
      showToast("Could not delete tasks");
      setRefetch((r) => r + 1); // Revert by refetching
    }
  }, [user, selectedIds, tasks, overdueTasks, deleteScope, householdViewMode, taskDetailTask]);

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

  const SWIPE_MIN_DELTA = 25;
  const SWIPE_THRESHOLD = 50;

  return (
    <div className="px-6 pt-2 pb-6 xl:flex xl:gap-6 xl:items-start">
      {/* LEFT COLUMN — month nav, plantable, calendar grid (sticky at xl:) */}
      <div className="xl:w-[640px] xl:flex-shrink-0 xl:sticky xl:top-12 xl:self-start">
      <div
        className="flex items-center justify-center gap-2 mb-2 touch-pan-y pl-6 pr-6"
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
          if (Math.abs(delta) < SWIPE_MIN_DELTA) return;
          if (delta < -SWIPE_THRESHOLD) nextMonth();
          else if (delta > SWIPE_THRESHOLD) prevMonth();
        }}
      >
        <button
          type="button"
          onClick={prevMonth}
          className="flex min-w-[44px] min-h-[44px] items-center justify-center text-black/80"
          aria-label="Previous month"
        >
          <ICON_MAP.ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-semibold text-black text-base min-w-[140px] text-center">{monthLabel}</span>
        <button
          type="button"
          onClick={nextMonth}
          className="flex min-w-[44px] min-h-[44px] items-center justify-center text-black/80"
          aria-label="Next month"
        >
          <ICON_MAP.ChevronRight className="w-5 h-5" />
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
              Plant this month ({plantableProfiles.length})
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
                  title="See plants for this month in Vault"
                  aria-label="See plants for this month in Vault"
                >
                  ∞
                </button>
              </div>
              {showZoneMismatchNote && (
                <p className="mt-3 text-sm text-neutral-600 italic">
                  Showing plants with empty windows defaulted from Zone 10b. Edit a plant&apos;s profile to set a custom window.
                </p>
              )}
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
                {plantableInventoryPlantType.plantType} – Seed Inventory
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
                <LoadingState message="Loading packets…" className="py-2" />
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
        <LoadingState message="Loading…" />
      ) : error ? (
        <div className="rounded-2xl bg-white p-6 shadow-card border border-black/5">
          <p className="text-citrus font-medium">Could not load tasks</p>
          <p className="text-sm text-black/60 mt-1">{error}</p>
        </div>
      ) : (
        <div
          className="rounded-2xl bg-white shadow-card border border-black/5 overflow-hidden pl-6 pr-6 touch-pan-y"
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
            if (Math.abs(delta) < SWIPE_MIN_DELTA) return;
            if (delta < -SWIPE_THRESHOLD) nextMonth();
            else if (delta > SWIPE_THRESHOLD) prevMonth();
          }}
        >
          {careTasksSyncing && (
            <div className="-mx-6 px-4 py-2 text-xs text-emerald-900 bg-emerald-50/90 border-b border-emerald-100 flex items-center gap-2" role="status">
              <span className="inline-block w-3.5 h-3.5 border-2 border-emerald-700 border-t-transparent rounded-full animate-spin shrink-0" aria-hidden />
              Updating care tasks…
            </div>
          )}
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
              // cell.dateStr is null for adjacent-month pad cells; selectedDate defaults to null too,
              // so a naive === would mark every pad cell as "selected" and apply the emerald ring.
              const isSelected = cell.dateStr != null && cell.dateStr === selectedDate;
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
                cell.dateStr ? "bg-white" : "bg-neutral-100"
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
      </div>

      {/* RIGHT COLUMN — task list */}
      <div className="mt-4 xl:mt-0 xl:flex-1 xl:min-w-0 xl:max-w-[720px]">
      {!loading && !error && (
        <div className="rounded-2xl bg-white shadow-card border border-black/5 overflow-hidden">
          <div className="relative px-4 py-4 flex items-center justify-center border-b border-black/10">
            <h2 className="text-base font-bold text-black text-center">
              {selectedDate
                ? `Tasks for ${new Date(selectedDate + "T12:00:00").toLocaleDateString("default", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}`
                : "Upcoming tasks"}
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
            {!selectedDate && allDateKeys.length > 0 && (
              <button
                type="button"
                onClick={handleToggleAll}
                className="absolute right-4 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] flex items-center justify-center text-emerald-600 hover:bg-emerald-50 rounded-lg"
                aria-label={isAllExpanded ? "Collapse all sections" : "Expand all sections"}
                aria-expanded={isAllExpanded}
              >
                <ICON_MAP.ChevronDown className={`w-5 h-5 transition-transform duration-200 ease-out ${isAllExpanded ? "rotate-180" : "rotate-0"}`} />
              </button>
            )}
          </div>
          {!selectedDate &&
          overdueTasks.length === 0 &&
          Object.keys(byDate).length === 0 &&
          !(isTodayInMonth && completedForToday.length > 0) ? (
            <div className="p-6 text-center">
              <p className="text-black/60 text-sm font-medium">
                Nothing scheduled right now.
              </p>
              <p className="text-sm text-black/50 mt-2">
                Tasks show up as your plants grow. Tap + to add one yourself.
              </p>
            </div>
          ) : selectedDate ? (
            (() => {
              // Only show tasks that belong to this day: upcoming by due_date, completed by completed_at
              const upcomingForDate = (byDate[selectedDate] ?? []).filter(
                (t) => toDateKey(t.due_date) === selectedDate
              );
              const completedForDate = completedTasksForSelectedDay.filter((t) => {
                if (!t.completed_at) return false;
                const completedDay = toDateKey(new Date(t.completed_at).toISOString());
                return completedDay === selectedDate;
              });
              const hasAny = upcomingForDate.length > 0 || completedForDate.length > 0;
              if (!hasAny) {
                return (
                  <div className="p-6 text-center">
                    <p className="text-black/50 text-sm">
                      Nothing on {new Date(selectedDate + "T12:00:00").toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" })}.
                    </p>
                    <p className="text-xs text-black/40 mt-1">Tap another day to see what&rsquo;s scheduled, or tap + to add a task.</p>
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
                        onTaskTap={() => setTaskDetailTask(t)}
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
                            onTaskTap={() => setTaskDetailTask(t)}
                            ownerBadge={householdViewMode === "family" && t.user_id ? getShorthandForUser(t.user_id) : null}
                            canEdit={false}
                            displayDateOverride={selectedDate ?? undefined}
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
                  <div
                    className="grid transition-[grid-template-rows] duration-200 ease-out"
                    style={{ gridTemplateRows: expandedDateGroups.has("overdue") ? "1fr" : "0fr" }}
                  >
                    <div className="overflow-hidden min-h-0">
                    <div className="px-4 pb-4 space-y-2 bg-amber-50/30">
                      {overdueGroups.map(({ key, tasks: groupTasks }) => {
                        if (groupTasks.length === 1) {
                          const t = groupTasks[0];
                          return (
                            <CalendarTaskRow
                              key={t.id}
                              task={t}
                              onComplete={() => handleComplete(t)}
                              onSnooze={(newDue) => handleSnooze(t, newDue)}
                              selectMode={selectMode}
                              isSelected={selectedIds.has(t.id)}
                              onLongPress={() => handleLongPressTask(t.id)}
                              onToggleSelect={() => toggleTaskSelect(t.id)}
                              onTaskTap={() => setTaskDetailTask(t)}
                              ownerBadge={householdViewMode === "family" && t.user_id ? getShorthandForUser(t.user_id) : null}
                              canEdit={!t.user_id || canEditPage(t.user_id, "garden")}
                            />
                          );
                        }
                        const isGroupExpanded = expandedOverdueGroups.has(key);
                        const first = groupTasks[0];
                        const oldestDateLabel = new Date(first.due_date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });
                        const categoryLabel = TASK_LABELS[first.category] ?? first.category ?? "";
                        const primaryLabel = (first.title ?? categoryLabel).trim() || categoryLabel;
                        const plantName = first.plant_name?.trim();
                        const showPlant = plantName && plantName !== "Unknown" && !primaryLabel.includes(plantName);
                        return (
                          <div key={key} className="rounded-xl bg-white border border-amber-300/70 shadow-sm overflow-hidden">
                            <ConsolidatedOverdueHeader
                              groupTasks={groupTasks}
                              primaryLabel={primaryLabel}
                              showPlant={showPlant}
                              plantName={plantName}
                              oldestDateLabel={oldestDateLabel}
                              isGroupExpanded={isGroupExpanded}
                              onToggleExpand={() => toggleOverdueGroup(key)}
                              onSnoozeAll={() => {
                                setGroupSnoozeDate(localDateString());
                                setGroupAction({ kind: "snooze", tasks: groupTasks });
                              }}
                              onCompleteAll={() => setGroupAction({ kind: "complete", tasks: groupTasks })}
                            />
                            {isGroupExpanded && (
                              <div className="border-t border-amber-200/60 px-3 py-2 space-y-2 bg-amber-50/20">
                                {!selectMode && (
                                  <div className="flex justify-end -mt-0.5 -mb-1">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectAllInGroup(groupTasks)}
                                      className="text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded-md px-2 py-1 min-h-[32px]"
                                      aria-label={`Select all ${groupTasks.length} ${primaryLabel} tasks`}
                                    >
                                      Select all {groupTasks.length}
                                    </button>
                                  </div>
                                )}
                                {groupTasks.map((t) => (
                                  <CalendarTaskRow
                                    key={t.id}
                                    task={t}
                                    onComplete={() => handleComplete(t)}
                                    onSnooze={(newDue) => handleSnooze(t, newDue)}
                                    selectMode={selectMode}
                                    isSelected={selectedIds.has(t.id)}
                                    onLongPress={() => handleLongPressTask(t.id)}
                                    onToggleSelect={() => toggleTaskSelect(t.id)}
                                    onTaskTap={() => setTaskDetailTask(t)}
                                    ownerBadge={householdViewMode === "family" && t.user_id ? getShorthandForUser(t.user_id) : null}
                                    canEdit={!t.user_id || canEditPage(t.user_id, "garden")}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    </div>
                  </div>
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
                        className="w-full min-h-[44px] flex items-center justify-between gap-2 px-4 py-3 text-left bg-emerald-50/40 hover:bg-emerald-50/70 transition-colors"
                        aria-expanded={isExpanded}
                      >
                        <span className="text-sm font-semibold text-black/85">
                          {dateLabel} ({summary})
                        </span>
                        <span className="text-emerald-600 text-sm shrink-0">{isExpanded ? "Hide" : "Show"}</span>
                      </button>
                      <div
                        className="grid transition-[grid-template-rows] duration-200 ease-out"
                        style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
                      >
                        <div className="overflow-hidden min-h-0">
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
                              onTaskTap={() => setTaskDetailTask(t)}
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
                                  onTaskTap={() => setTaskDetailTask(t)}
                                  ownerBadge={householdViewMode === "family" && t.user_id ? getShorthandForUser(t.user_id) : null}
                                  canEdit={false}
                                  displayDateOverride={date}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        </div>
                      </div>
                    </li>
                  );
                });
              })()}
            </ul>
          )}
        </div>
      )}

      </div>

      {/* Batch action menu (B7): FAB opens this when in select mode — Reschedule / Delete / Edit / Exit */}
      {selectMode && batchMenuOpen && (
        <>
          <div className="fixed inset-0 z-[99] bg-black/20" aria-hidden onClick={() => setBatchMenuOpen(false)} />
          <div
            className="fixed bottom-[calc(5rem+80px+env(safe-area-inset-bottom,0px))] right-6 z-[100] bg-white rounded-2xl shadow-xl border border-neutral-200 py-2 min-w-[200px]"
            role="menu"
            aria-label="Task actions"
          >
            <div className="px-4 py-2 border-b border-neutral-100 text-sm font-medium text-neutral-600">
              {selectedIds.size} task{selectedIds.size !== 1 ? "s" : ""} selected
            </div>
            <button
              type="button"
              disabled={selectedIds.size === 0 || batchSaving}
              onClick={() => { setBatchDate(new Date().toISOString().slice(0, 10)); setBatchActionOpen("reschedule"); setBatchMenuOpen(false); }}
              className="w-full min-h-[44px] px-4 py-2 text-left text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              role="menuitem"
            >
              Reschedule
            </button>
            <button
              type="button"
              disabled={selectedIds.size === 0 || batchSaving}
              onClick={() => { setBatchActionOpen("delete"); setBatchMenuOpen(false); }}
              className="w-full min-h-[44px] px-4 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              role="menuitem"
            >
              Delete
            </button>
            <button
              type="button"
              disabled={selectedIds.size !== 1 || batchSaving}
              onClick={() => {
                const id = Array.from(selectedIds)[0];
                const t = tasks.find((x) => x.id === id) ?? overdueTasks.find((x) => x.id === id);
                if (t) { setEditTask(t); setNewTaskOpen(true); setBatchMenuOpen(false); }
              }}
              className="w-full min-h-[44px] px-4 py-2 text-left text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
              role="menuitem"
            >
              Edit Task
            </button>
            <button
              type="button"
              onClick={() => { exitSelectMode(); setBatchMenuOpen(false); }}
              className="w-full min-h-[44px] px-4 py-2 text-left text-sm font-medium text-neutral-500 hover:bg-neutral-50 border-t border-neutral-100"
              role="menuitem"
            >
              Exit select mode
            </button>
          </div>
        </>
      )}

      {/* Batch reschedule sheet */}
      {batchActionOpen === "reschedule" && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" onClick={() => setBatchActionOpen(null)} />
          <div className="fixed bottom-0 left-0 right-0 z-[100] bg-cream rounded-t-3xl px-4 pt-5 pb-10 space-y-3 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]">
            <h3 className="text-base font-bold text-black">Reschedule {selectedIds.size} Task{selectedIds.size !== 1 ? "s" : ""}</h3>
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
          <div className="fixed inset-0 z-[100] bg-black/40" onClick={() => { setBatchActionOpen(null); setDeleteScope("selected"); }} aria-hidden />
          <div
            className="fixed bottom-0 left-0 right-0 z-[100] bg-cream rounded-t-3xl px-4 pt-5 pb-10 space-y-4 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
            style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
            role="dialog"
            aria-labelledby="delete-dialog-title"
            aria-describedby="delete-dialog-desc"
          >
            <h3 id="delete-dialog-title" className="text-base font-bold text-black">
              Delete {selectedIds.size} Task{selectedIds.size !== 1 ? "s" : ""}?
            </h3>
            <p id="delete-dialog-desc" className="text-sm text-black/60">This cannot be undone.</p>
            {Array.from(selectedIds).some((id) => {
              const t = tasks.find((x) => x.id === id) ?? overdueTasks.find((x) => x.id === id);
              return (t as { care_schedule_id?: string | null })?.care_schedule_id != null;
            }) && (
              <div className="space-y-2" role="radiogroup" aria-labelledby="delete-scope-label">
                <p id="delete-scope-label" className="text-sm font-medium text-black/80">One or more selected tasks are recurring. Delete:</p>
                <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
                  <input
                    type="radio"
                    name="delete-scope"
                    checked={deleteScope === "selected"}
                    onChange={() => setDeleteScope("selected")}
                    className="border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-black/80">Only this instance (selected task{selectedIds.size !== 1 ? "s" : ""})</span>
                </label>
                <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
                  <input
                    type="radio"
                    name="delete-scope"
                    checked={deleteScope === "all_future"}
                    onChange={() => setDeleteScope("all_future")}
                    className="border-neutral-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-black/80">All future tasks (stop recurring schedule)</span>
                </label>
              </div>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={() => { setBatchActionOpen(null); setDeleteScope("selected"); }}
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

      {/* Group apply-all: Mark all done? confirmation */}
      {groupAction?.kind === "complete" && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" onClick={() => !groupActionSaving && setGroupAction(null)} aria-hidden />
          <div
            className="fixed bottom-0 left-0 right-0 z-[100] bg-cream rounded-t-3xl px-4 pt-5 space-y-4 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
            style={{ paddingBottom: "max(2.5rem, env(safe-area-inset-bottom))" }}
            role="dialog"
            aria-labelledby="group-complete-title"
            aria-describedby="group-complete-desc"
          >
            <h3 id="group-complete-title" className="text-base font-bold text-black">
              Mark All {groupAction.tasks.length} as Done?
            </h3>
            <p id="group-complete-desc" className="text-sm text-black/60">
              All {groupAction.tasks.length} overdue tasks in this group will be marked complete.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={groupActionSaving}
                onClick={() => setGroupAction(null)}
                className="flex-1 py-3 rounded-3xl border border-teal-gus/40 text-teal-gus font-medium min-h-[44px] hover:bg-teal-gus/10 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={groupActionSaving}
                onClick={handleCompleteAllInGroup}
                className="flex-1 py-3 rounded-3xl bg-emerald text-white text-sm font-semibold min-h-[44px] disabled:opacity-40"
              >
                {groupActionSaving ? "Saving…" : "Mark Done"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Group apply-all: Snooze all N tasks sheet */}
      {groupAction?.kind === "snooze" && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" onClick={() => !groupActionSaving && setGroupAction(null)} aria-hidden />
          <div
            className="fixed bottom-0 left-0 right-0 z-[100] bg-cream rounded-t-3xl px-4 pt-5 pb-10 space-y-3 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
            role="dialog"
            aria-labelledby="group-snooze-title"
          >
            <h3 id="group-snooze-title" className="text-base font-bold text-black">
              Snooze All {groupAction.tasks.length} Task{groupAction.tasks.length !== 1 ? "s" : ""}
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {([{ label: "Tomorrow", days: 1 }, { label: "In 3 days", days: 3 }, { label: "Next week", days: 7 }] as { label: string; days: number }[]).map(({ label, days }) => {
                const d = new Date(); d.setDate(d.getDate() + days);
                const dateStr = d.toISOString().slice(0, 10);
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={groupActionSaving}
                    onClick={() => handleSnoozeAllInGroup(dateStr)}
                    className="py-3 rounded-3xl border border-teal-gus/40 text-teal-gus text-sm font-medium hover:bg-teal-gus/10 disabled:opacity-40 min-h-[44px]"
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 items-center pt-1">
              <input
                type="date"
                value={groupSnoozeDate}
                onChange={(e) => setGroupSnoozeDate(e.target.value)}
                className="flex-1 rounded-3xl border border-black/10 px-3 py-2 text-sm"
              />
              <button
                type="button"
                disabled={groupActionSaving}
                onClick={() => handleSnoozeAllInGroup(groupSnoozeDate)}
                className="px-4 py-2 rounded-3xl bg-emerald text-white text-sm font-medium min-h-[44px] disabled:opacity-40"
              >
                {groupActionSaving ? "Saving…" : "Apply"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Task detail popup (B10): tap task → show details + View Plant Profile */}
      {taskDetailTask && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/40" aria-hidden onClick={() => setTaskDetailTask(null)} />
          <div
            className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[101] bg-white rounded-2xl shadow-xl p-5 max-w-sm mx-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-detail-title"
          >
            <h2 id="task-detail-title" className="font-semibold text-neutral-900 text-base mb-3">
              {TASK_LABELS[taskDetailTask.category] ?? taskDetailTask.category ?? "Task"}
              {taskDetailTask.title?.trim() ? `: ${taskDetailTask.title.trim()}` : ""}
            </h2>
            <dl className="space-y-2 text-sm mb-4">
              <div>
                <dt className="text-neutral-500">Due</dt>
                <dd>{new Date(taskDetailTask.due_date + "T12:00:00").toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</dd>
              </div>
              {taskDetailTask.completed_at && (
                <div>
                  <dt className="text-neutral-500">Completed</dt>
                  <dd>{new Date(taskDetailTask.completed_at).toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</dd>
                </div>
              )}
              {taskDetailTask.plant_name && taskDetailTask.plant_name !== "Unknown" && (
                <div>
                  <dt className="text-neutral-500">Plant</dt>
                  <dd>{taskDetailTask.plant_name}</dd>
                </div>
              )}
              {(taskDetailTask.supply_profile_id || taskDetailTask.care_schedule_id) && (
                <div>
                  <dt className="text-neutral-500">Linked product</dt>
                  <dd>{taskDetailSupplyName ?? "—"}</dd>
                </div>
              )}
            </dl>
            <div className="space-y-2">
              {taskDetailTask.plant_profile_id && taskDetailTask.care_schedule_id && (
                <button
                  type="button"
                  onClick={() => {
                    const pid = taskDetailTask.plant_profile_id;
                    const sid = taskDetailTask.care_schedule_id;
                    const gid = taskDetailTask.grow_instance_id;
                    setTaskDetailTask(null);
                    // Instance-scoped care tasks deep-link to GrowInstanceModal Care tab; profile-scoped
                    // (no grow_instance_id) deep-link to the Vault profile Care tab.
                    if (gid) {
                      router.push(`/garden?grow=${gid}&instanceTab=care&schedule=${sid}`);
                    } else {
                      router.push(`/vault/${pid}?tab=care&from=calendar&date=${taskDetailTask.due_date}&schedule=${sid}`);
                    }
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700"
                >
                  Manage Schedule
                </button>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTaskDetailTask(null)}
                  className="flex-1 min-h-[44px] rounded-xl border border-neutral-300 text-neutral-700 font-medium text-sm"
                >
                  Close
                </button>
                {taskDetailTask.plant_profile_id && (
                  <button
                    type="button"
                    onClick={() => {
                      setTaskDetailTask(null);
                      router.push(`/vault/${taskDetailTask.plant_profile_id}?tab=care&from=calendar&date=${taskDetailTask.due_date}`);
                    }}
                    className={`flex-1 min-h-[44px] rounded-xl font-medium text-sm ${taskDetailTask.care_schedule_id ? "border border-neutral-300 text-neutral-700" : "bg-emerald-600 text-white hover:bg-emerald-700"}`}
                  >
                    View Plant Profile
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {toast}

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
          if (selectMode) {
            setBatchMenuOpen(true);
            return;
          }
          if (addMenuOpen) {
            closeMenu();
          } else if (newTaskOpen) {
            setNewTaskOpen(false);
          } else {
            setAddMenuOpen(true);
          }
        }}
        className={`fixed right-6 z-30 w-14 h-14 rounded-full shadow-card flex items-center justify-center hover:opacity-90 transition-all ${
          selectMode ? "bg-amber-500 text-white hover:bg-amber-600" : addMenuOpen || newTaskOpen ? "bg-emerald-700 text-white" : "bg-emerald text-white"
        }`}
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        aria-label={selectMode ? "Task options" : addMenuOpen || newTaskOpen ? "Close" : "Add"}
        aria-expanded={selectMode ? batchMenuOpen : addMenuOpen || newTaskOpen}
      >
        {selectMode ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-slide-in-chevron" aria-hidden>
            <path d="M7 6l4 6-4 6" />
            <path d="M13 6l4 6-4 6" />
          </svg>
        ) : (
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`transition-transform duration-200 ${addMenuOpen || newTaskOpen ? "rotate-45" : "rotate-0"}`}
            aria-hidden
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        )}
      </button>

      {addMenuOpen && (
        <UniversalAddMenu
          open={addMenuOpen}
          onClose={closeMenu}
          pathname={pathname ?? "/calendar"}
          addPlantDefaultType={addPlantDefaultType}
          setAddPlantDefaultType={setAddPlantDefaultType}
          onAddPlantPurchaseOrder={() => {
            closeAll();
            setPurchaseOrderMode("seed");
            setPurchaseOrderAddPlantMode(true);
            setPurchaseOrderOpen(true);
          }}
          onAddPlantPhotoImport={() => {
            closeAll();
            setBatchAddPlantMode(true);
            setBatchAddSeedOpen(true);
          }}
          onSeedOpenBatch={() => {
            closeAll();
            setBatchAddPlantMode(false);
            setBatchAddSeedOpen(true);
          }}
          onSeedStartManualImport={() => {
            skipPopOnNavigateRef.current = true;
            closeAll();
            router.push("/vault/import/manual");
          }}
          onSeedOpenPurchaseOrder={() => {
            skipPopOnNavigateRef.current = true;
            closeAll();
            setPurchaseOrderMode("seed");
            setPurchaseOrderAddPlantMode(false);
            setPurchaseOrderOpen(true);
          }}
          onSupplyOpenPurchaseOrder={() => {
            skipPopOnNavigateRef.current = true;
            closeAll();
            setPurchaseOrderMode("supply");
            setPurchaseOrderOpen(true);
          }}
          onSupplyOpenBatchPhotoImport={() => {
            skipPopOnNavigateRef.current = true;
            closeAll();
            setBatchAddSupplyOpen(true);
          }}
        />
      )}

      {activeModal === "journal" && (
        <QuickLogModal
          open
          onClose={closeActiveModal}
          onJournalAdded={() => {
            showToast("Entry saved");
            router.refresh();
            closeActiveModal();
          }}
          onAddSupplyFromEmptyState={(searchString) => {
            closeActiveModal();
            openShed(searchString);
          }}
        />
      )}

      {activeModal === "task" && (
        <NewTaskModal
          open
          onClose={closeActiveModal}
          onSuccess={() => { showToast("Task added"); setRefetch((r) => r + 1); }}
        />
      )}

      {activeModal === "seed" && (
        <QuickAddSeed
          open
          onClose={closeActiveModal}
          onSuccess={(opts) => {
            if (opts?.newProfileId) {
              closeActiveModal();
              router.push(`/vault/${opts.newProfileId}?added=1`);
              return;
            }
            setRefetch((r) => r + 1);
          }}
          onOpenBatch={() => {
            closeActiveModal();
            setBatchAddPlantMode(false);
            setBatchAddSeedOpen(true);
          }}
          onStartManualImport={() => {
            skipPopOnNavigateRef.current = true;
            closeActiveModal();
            router.push("/vault/import/manual");
          }}
          onOpenPurchaseOrder={() => {
            skipPopOnNavigateRef.current = true;
            closeActiveModal();
            setPurchaseOrderMode("seed");
            setPurchaseOrderAddPlantMode(false);
            setPurchaseOrderOpen(true);
          }}
        />
      )}

      {/* Unconditional mount so React.lazy (next/dynamic) pre-resolves on page hydration —
          eliminates the Suspense first-render gap when chip-tap flips open=true. */}
      <BatchAddSeed
        open={batchAddSeedOpen}
        onClose={() => setBatchAddSeedOpen(false)}
        onBack={() => {
          setBatchAddSeedOpen(false);
          openMenuOnScreen(batchAddPlantMode ? "add-plant" : "seed");
        }}
        onSuccess={() => setRefetch((r) => r + 1)}
        onNavigateToHero={() => {
          skipPopOnNavigateRef.current = true;
          setBatchAddSeedOpen(false);
          router.push("/vault/import/photos/hero");
        }}
        addPlantMode={batchAddPlantMode}
        defaultProfileType={batchAddPlantMode ? (addPlantDefaultType === "permanent" ? "permanent" : "seed") : undefined}
      />

      {activeModal === "shed" && (
        <QuickAddSupply
          open
          onClose={closeActiveModal}
          onSuccess={() => setRefetch((r) => r + 1)}
          initialName={shedInitialName}
          onOpenPurchaseOrder={() => {
            skipPopOnNavigateRef.current = true;
            closeActiveModal();
            setPurchaseOrderMode("supply");
            setPurchaseOrderOpen(true);
          }}
          onOpenBatchPhotoImport={() => {
            skipPopOnNavigateRef.current = true;
            closeActiveModal();
            setBatchAddSupplyOpen(true);
          }}
        />
      )}

      <BatchAddSupply
        open={batchAddSupplyOpen}
        onClose={() => setBatchAddSupplyOpen(false)}
        onBack={() => {
          setBatchAddSupplyOpen(false);
          openMenuOnScreen("shed");
        }}
        onSuccess={() => setRefetch((r) => r + 1)}
      />

      {activeModal === "plant" && (
        <AddPlantModal
          open
          onClose={closeActiveModal}
          onBackToMenu={backToMenu}
          onSuccess={() => { closeActiveModal(); setRefetch((r) => r + 1); }}
          defaultPlantType={addPlantDefaultType}
          stayInGarden={false}
        />
      )}

      <PurchaseOrderImport
        open={purchaseOrderOpen}
        onClose={() => setPurchaseOrderOpen(false)}
        onBack={() => {
          setPurchaseOrderOpen(false);
          openMenuOnScreen(
            purchaseOrderMode === "supply"
              ? "shed"
              : purchaseOrderAddPlantMode
                ? "add-plant"
                : "seed"
          );
        }}
        mode={purchaseOrderMode}
        defaultProfileType={purchaseOrderAddPlantMode ? (addPlantDefaultType === "permanent" ? "permanent" : "seed") : purchaseOrderMode === "seed" ? "seed" : undefined}
        addPlantMode={purchaseOrderMode === "seed" ? purchaseOrderAddPlantMode : false}
      />

      {newTaskOpen && (
        <NewTaskModal
          open={newTaskOpen}
          onClose={() => { setNewTaskOpen(false); setEditTask(null); }}
          onBackToMenu={() => {
            setNewTaskOpen(false);
            setEditTask(null);
            openMenu();
          }}
          onSuccess={() => { showToast("Task added"); setRefetch((r) => r + 1); setEditTask(null); exitSelectMode(); }}
          editTask={editTask}
        />
      )}
    </div>
  );
}

/**
 * Header strip of a consolidated overdue-group row. Layout: [title+count] [Snooze][Done] [Chevron].
 * Snooze + Done are hidden on phone-portrait (`hidden md:flex`) — phone uses swipe (left = complete-all,
 * right = snooze-all). iPad-portrait+ shows visible buttons alongside swipe (Walter persona served).
 * The chevron is always visible and toggles expansion.
 */
function ConsolidatedOverdueHeader({
  groupTasks,
  primaryLabel,
  showPlant,
  plantName,
  oldestDateLabel,
  isGroupExpanded,
  onToggleExpand,
  onSnoozeAll,
  onCompleteAll,
}: {
  groupTasks: { id: string; category: string | null }[];
  primaryLabel: string;
  showPlant: boolean | "" | undefined;
  plantName: string | undefined;
  oldestDateLabel: string;
  isGroupExpanded: boolean;
  onToggleExpand: () => void;
  onSnoozeAll: () => void;
  onCompleteAll: () => void;
}) {
  const { rowRef, swipeOffsetX, isSwiping } = useRowSwipe({
    enabled: true,
    onSwipeLeft: onCompleteAll,
    onSwipeRight: onSnoozeAll,
  });
  const showSwipeReveal = swipeOffsetX !== 0;
  // All tasks in a group share the same (title, plant, grow_instance) so the first task's
  // category determines whether this is a sow group (renders "Plant" label) or generic.
  const firstSow = groupTasks.length > 0 && isSowTask(groupTasks[0].category);

  return (
    <div className="relative overflow-hidden">
      {showSwipeReveal && (
        <div className="absolute inset-0 flex pointer-events-none" aria-hidden>
          <div className="flex-1 bg-amber-100 flex items-center justify-start px-5">
            <svg
              width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-amber-700"
              style={{ opacity: Math.max(0, Math.min(1, swipeOffsetX / 80)) }}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
              <path d="M4 22l2-2M20 22l-2-2M22 4l-2 2M2 4l2 2" />
            </svg>
          </div>
          <div className="flex-1 bg-emerald-100 flex items-center justify-end px-5">
            <svg
              width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className="text-emerald-700"
              style={{ opacity: Math.max(0, Math.min(1, -swipeOffsetX / 80)) }}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>
      )}
      <div
        ref={rowRef}
        style={{
          transform: `translateX(${swipeOffsetX}px)`,
          transition: isSwiping ? "none" : "transform 0.2s ease-out",
        }}
        className="relative flex items-stretch min-h-[44px] bg-white"
      >
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 text-left hover:bg-amber-50/40"
          aria-expanded={isGroupExpanded}
          aria-label={`${primaryLabel}${showPlant ? ` ${plantName}` : ""} — ${groupTasks.length} overdue, oldest ${oldestDateLabel}. ${isGroupExpanded ? "Collapse" : "Expand"}.`}
        >
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-black break-words">
              {primaryLabel}{showPlant ? ` · ${plantName}` : ""}
            </div>
            <div className="text-xs text-amber-800 mt-0.5">
              {groupTasks.length} overdue · oldest {oldestDateLabel}
            </div>
          </div>
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onSnoozeAll(); }}
          className="hidden md:flex min-w-[44px] items-center justify-center text-black/60 hover:text-emerald-600 hover:bg-emerald/10"
          aria-label={`Snooze all ${groupTasks.length} ${primaryLabel} tasks`}
          title={`Snooze all ${groupTasks.length}`}
        >
          <SnoozeIcon />
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCompleteAll(); }}
          className={
            firstSow
              ? "hidden md:flex min-h-[44px] px-4 my-1 mx-1 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 items-center justify-center"
              : "hidden md:flex min-w-[44px] my-1 mx-1 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          }
          aria-label={`${firstSow ? "Plant" : "Mark complete"} all ${groupTasks.length} ${primaryLabel} tasks`}
          title={`Mark all ${groupTasks.length} ${firstSow ? "planted" : "complete"}`}
        >
          {firstSow ? (
            "Plant"
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleExpand(); }}
          className="min-w-[44px] flex items-center justify-center text-amber-700 hover:bg-amber-50/40"
          aria-label={isGroupExpanded ? "Collapse" : "Expand"}
        >
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform ${isGroupExpanded ? "rotate-180" : ""}`}
            aria-hidden
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>
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
  displayDateOverride,
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
  /** When set (e.g. selectedDate), show this date in the label so it matches the section header */
  displayDateOverride?: string;
}) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeDate, setSnoozeDate] = useState(task.due_date);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const categoryLabel = TASK_LABELS[task.category] ?? task.category ?? "";
  const primaryLabel = (task.title ?? categoryLabel).trim() || categoryLabel;
  const plantName = task.plant_name?.trim();
  const showPlant = plantName && plantName !== "Unknown" && !primaryLabel.includes(plantName);
  // Completed tasks: show completion date (or displayDateOverride so label matches "Tasks for [date]"); upcoming: show due date
  const dateLabel = displayDateOverride
    ? new Date(displayDateOverride + "T12:00:00").toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" })
    : task.completed_at
      ? new Date(task.completed_at).toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" })
      : new Date(task.due_date + "T12:00:00").toLocaleDateString(undefined, { month: "numeric", day: "numeric", year: "numeric" });
  const displayLine = `${primaryLabel}${showPlant ? ` · ${plantName}` : ""} (${dateLabel})`;

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

  // Swipe-to-act on touch devices: swipe-left = mark complete, swipe-right = open snooze.
  // Per VISION.md Principle 9 (narrowed 2026-05-17 for Walter persona): phone-portrait is
  // swipe-only; iPad-portrait+ AND desktop show inline buttons (`hidden md:flex` below)
  // alongside swipe. Swipe logic lives in useRowSwipe hook (shared with the consolidated
  // overdue-group header row).
  const isOptimistic = task.id.startsWith("opt-");
  const swipeEligible = !task.completed_at && !selectMode && !isOptimistic && canEdit;
  const openSnooze = useCallback(() => setSnoozeOpen(true), []);
  const { rowRef, swipeOffsetX, isSwiping } = useRowSwipe({
    enabled: swipeEligible,
    onSwipeLeft: onComplete,
    onSwipeRight: openSnooze,
  });

  const showSwipeReveal = swipeOffsetX !== 0;

  return (
    <>
      <div className="relative overflow-hidden rounded-xl">
        {showSwipeReveal && (
          <div className="absolute inset-0 flex pointer-events-none" aria-hidden>
            <div className="flex-1 bg-amber-100 flex items-center justify-start px-5">
              <svg
                width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="text-amber-700"
                style={{ opacity: Math.max(0, Math.min(1, swipeOffsetX / 80)) }}
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
                <path d="M4 22l2-2M20 22l-2-2M22 4l-2 2M2 4l2 2" />
              </svg>
            </div>
            <div className="flex-1 bg-emerald-100 flex items-center justify-end px-5">
              <svg
                width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="text-emerald-700"
                style={{ opacity: Math.max(0, Math.min(1, -swipeOffsetX / 80)) }}
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
        )}
        <div
          ref={rowRef}
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{
            transform: `translateX(${swipeOffsetX}px)`,
            transition: isSwiping ? "none" : "transform 0.2s ease-out",
          }}
          className={`relative flex flex-wrap items-start gap-2 py-3 px-4 rounded-xl text-sm border transition-colors ${
            selectMode && isSelected
              ? "bg-emerald-50 border-emerald-400"
              : task.completed_at
                ? "bg-slate-50 border-slate-200/80 text-slate-500"
                : "bg-white border-emerald-200/60 text-black shadow-sm hover:border-emerald-300/70"
          } ${isOptimistic ? "opacity-60 animate-pulse" : ""} ${selectMode ? "cursor-pointer select-none" : ""}`}
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
            <span className="hidden md:flex items-center gap-1 shrink-0">
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
        </div>
      </div>
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
    </>
  );
}
