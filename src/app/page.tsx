"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { AddItemModal } from "@/components/AddItemModal";
import { useAuth } from "@/contexts/AuthContext";
import { useSync } from "@/contexts/SyncContext";
import { useEscapeKey } from "@/hooks/useEscapeKey";
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
import { completeTask } from "@/lib/completeSowTask";
import { generateCareTasks } from "@/lib/generateCareTasks";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { buildForecastUrl, weatherCodeToCondition, weatherCodeToIcon } from "@/lib/weatherSnapshot";
import type { Task } from "@/types/garden";
import type { ShoppingListItem } from "@/types/garden";
import { PlantPlaceholderIcon } from "@/components/PlantPlaceholderIcon";

type TaskWithPlant = Task & { plant_name?: string };
type ShoppingItemWithName = ShoppingListItem & {
  name?: string;
  variety_name?: string | null;
  supply_profile_id?: string | null;
  supply_name?: string;
  supply_deleted_at?: string | null;
};
type WeatherDay = { date: string; high: number; low: number; code: number };
type WeatherData = {
  temp: number;
  condition: string;
  code: number;
  daily: WeatherDay[];
  sunrise?: string; // ISO time for today, e.g. "2024-02-22T06:12"
  sunset?: string;
  humidity?: number; // 0–100
} | null;

/** Format ISO time to short local time, e.g. "6:12 AM" */
function formatSunTime(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return "—";
  }
}

type UserSettingsRow = {
  planting_zone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  location_name?: string | null;
};

export default function HomePage() {
  const { user } = useAuth();
  const { setSyncing } = useSync();
  const [pendingTasks, setPendingTasks] = useState<TaskWithPlant[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItemWithName[]>([]);
  const [weather, setWeather] = useState<WeatherData>(null);
  const [loadingTasksAndList, setLoadingTasksAndList] = useState(true);
  const [markingPurchasedId, setMarkingPurchasedId] = useState<string | null>(null);
  const [markingTaskDoneId, setMarkingTaskDoneId] = useState<string | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettingsRow | null>(null);
  const [insightDismissed, setInsightDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("home-insight-dismissed") === "1";
    } catch {
      return false;
    }
  });
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);
  const [shoppingListRefreshKey, setShoppingListRefreshKey] = useState(0);
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
  const [newTaskModalOpen, setNewTaskModalOpen] = useState(false);
  const [quickLogOpen, setQuickLogOpen] = useState(false);
  const skipPopOnNavigateRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  useEscapeKey(universalAddMenuOpen, () => setUniversalAddMenuOpen(false));

  useEffect(() => {
    if (!user) { setLoadingTasksAndList(false); return; }
    let cancelled = false;

    async function load() {
      generateCareTasks(user!.id); // Run in background, don't block

      // Fetch settings first (needed for weather URL), then run tasks + list + weather in parallel
      const settingsRes = await supabase.from("user_settings").select("planting_zone, latitude, longitude, timezone, location_name").eq("user_id", user!.id).maybeSingle();
      const settings = settingsRes.data as UserSettingsRow | null;
      if (!cancelled) setUserSettings(settings);

      const forecastUrl = buildForecastUrl(settings ? { latitude: settings.latitude, longitude: settings.longitude, timezone: settings.timezone } : null);

      const [tasksRes, listRes, weatherRes] = await Promise.all([
        supabase.from("tasks").select("id, plant_profile_id, category, due_date, completed_at, created_at, grow_instance_id, title").eq("user_id", user!.id).is("deleted_at", null).is("completed_at", null).order("due_date", { ascending: true }).limit(5),
        supabase.from("shopping_list").select("id, user_id, plant_profile_id, supply_profile_id, created_at, placeholder_name, placeholder_variety").eq("user_id", user!.id).eq("is_purchased", false).order("created_at", { ascending: false }).limit(15),
        fetch(forecastUrl).then((r) => r.json()).catch(() => null),
      ]);

      const taskRows = Array.isArray(tasksRes.data) ? tasksRes.data : [];
      const listRows = listRes.data ?? [];

      // Batch 2: Resolve names — collect all profile IDs and fetch
      const profileIds = taskRows.map((t: { plant_profile_id?: string | null }) => t.plant_profile_id).filter((id): id is string => Boolean(id));
      const listPlantIds = Array.from(new Set(listRows.map((r: { plant_profile_id: string | null }) => r.plant_profile_id).filter(Boolean) as string[]));
      const listSupplyIds = Array.from(new Set(listRows.map((r: { supply_profile_id?: string | null }) => r.supply_profile_id).filter(Boolean) as string[]));
      const allProfileIds = Array.from(new Set([...profileIds, ...listPlantIds]));

      const profilesRes = allProfileIds.length > 0 ? await supabase.from("plant_profiles").select("id, name, variety_name").in("id", allProfileIds).is("deleted_at", null) : { data: [] };
      const profiles = profilesRes.data ?? [];
      const names: Record<string, string> = {};
      profiles.forEach((p: { id: string; name: string; variety_name: string | null }) => {
        names[p.id] = p.variety_name?.trim() ? `${p.name} (${p.variety_name})` : p.name;
      });

      const listNames: Record<string, { name: string; variety_name: string | null }> = {};
      profiles.forEach((x: { id: string; name: string; variety_name: string | null }) => { listNames[x.id] = { name: x.name, variety_name: x.variety_name }; });

      const suppliesRes = listSupplyIds.length > 0 ? await supabase.from("supply_profiles").select("id, name, brand, deleted_at").in("id", listSupplyIds) : { data: [] };
      const supplies = suppliesRes.data ?? [];
      const supplyNames: Record<string, { name: string; deleted_at: string | null }> = {};
      supplies.forEach((s: { id: string; name: string; brand?: string | null; deleted_at?: string | null }) => {
        supplyNames[s.id] = { name: s.brand?.trim() ? `${s.brand} — ${s.name}` : s.name, deleted_at: s.deleted_at ?? null };
      });

      const withNames: TaskWithPlant[] = taskRows.map((t: Task & { plant_profile_id?: string | null }) => {
        const linkId = t.plant_profile_id;
        return { ...t, plant_name: linkId ? names[linkId] ?? "Unknown" : undefined };
      });
      if (!cancelled) setPendingTasks(withNames);

      if (!cancelled) setShoppingList(
        listRows.map((r: { id: string; user_id: string; plant_profile_id: string | null; supply_profile_id?: string | null; created_at: string; placeholder_name?: string | null; placeholder_variety?: string | null }) => {
          if (r.supply_profile_id) {
            const supply = supplyNames[r.supply_profile_id];
            return {
              ...r,
              name: supply?.name ?? "Unknown supply",
              variety_name: null,
              supply_name: supply?.name,
              supply_deleted_at: supply?.deleted_at ?? null,
            };
          }
          return {
            ...r,
            name: r.plant_profile_id ? (listNames[r.plant_profile_id]?.name ?? "Unknown") : (r.placeholder_name ?? "Wishlist"),
            variety_name: r.plant_profile_id ? (listNames[r.plant_profile_id]?.variety_name ?? null) : (r.placeholder_variety ?? null),
          };
        })
      );

      if (!cancelled) setLoadingTasksAndList(false);

      // Weather (fetched in parallel with tasks/list above)
      try {
        const data = weatherRes;
        if (!cancelled && data?.current) {
          const cur = data.current;
          const daily = data.daily;
          const days: WeatherDay[] = (daily?.time ?? []).slice(0, 7).map((date: string, i: number) => ({
            date,
            high: Number(daily?.temperature_2m_max?.[i]) ?? 0,
            low: Number(daily?.temperature_2m_min?.[i]) ?? 0,
            code: Number(daily?.weather_code?.[i]) ?? 0,
          }));
          const sunrise = daily?.sunrise?.[0];
          const sunset = daily?.sunset?.[0];
          const humidityRaw = cur.relative_humidity_2m;
          const humidity = typeof humidityRaw === "number" && humidityRaw >= 0 && humidityRaw <= 100 ? Math.round(humidityRaw) : undefined;
          setWeather({
            temp: Number(cur.temperature_2m),
            condition: weatherCodeToCondition(Number(cur.weather_code)),
            code: Number(cur.weather_code),
            daily: days,
            sunrise: typeof sunrise === "string" ? sunrise : undefined,
            sunset: typeof sunset === "string" ? sunset : undefined,
            humidity,
          });
        } else if (!cancelled) setWeather(null);
      } catch {
        if (!cancelled) setWeather(null);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [user?.id, shoppingListRefreshKey]);

  const currentTemp = weather?.temp ?? null;
  const heatAlert = currentTemp != null && currentTemp > 90;

  // Frost alert: check if any of the next 3 days have a low <= 32F
  const frostDays = useMemo(() => {
    if (!weather?.daily) return [];
    return weather.daily.filter((d) => d.low <= 32);
  }, [weather?.daily]);
  const frostAlert = frostDays.length > 0;
  const sowingOk = currentTemp != null && currentTemp >= 40 && currentTemp <= 90 && !frostAlert;

  const locationLabel = userSettings?.location_name?.trim() || "Vista, CA";

  async function handleMarkPurchased(item: ShoppingItemWithName) {
    if (!user?.id) return;
    const removed = item;
    setShoppingList((prev) => prev.filter((i) => i.id !== item.id));
    setMarkingPurchasedId(item.id);
    setSyncing(true);
    try {
      const { error } = await updateWithOfflineQueue("shopping_list", { is_purchased: true }, { id: item.id, user_id: user.id });
      if (error) {
        hapticError();
        setShoppingList((prev) => [...prev, removed].sort((a, b) => (a.created_at > b.created_at ? -1 : 1)));
      } else {
        hapticSuccess();
      }
    } finally { setMarkingPurchasedId(null); setSyncing(false); }
  }

  async function handleMarkTaskDone(t: TaskWithPlant) {
    if (!user?.id || t.completed_at) return;
    setMarkingTaskDoneId(t.id);
    setSyncing(true);
    try {
      await completeTask(t, user.id);
      setPendingTasks((prev) => prev.filter((x) => x.id !== t.id));
    } finally { setMarkingTaskDoneId(null); setSyncing(false); }
  }

  return (
    <div className="px-6 pt-2 pb-6 max-w-2xl mx-auto">
      {/* ---- Frost Alert Banner ---- */}
      {frostAlert && (
        <div className="mb-4 rounded-2xl bg-blue-50 border border-blue-200 p-4">
          <p className="text-sm font-semibold text-blue-800">Frost Warning</p>
          {frostDays.map((d) => (
            <p key={d.date} className="text-sm text-blue-700">
              {new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} – expected low of {Math.round(d.low)}°F. Protect tender plants!
            </p>
          ))}
        </div>
      )}

      {/* ---- Insight Banner (dismissible, compact) ---- */}
      {weather && sowingOk && !heatAlert && !insightDismissed && (
        <div className="mb-3 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-3 py-2 shadow-card-soft flex items-center gap-2">
          <span className="shrink-0 flex items-center justify-center"><PlantPlaceholderIcon size="sm" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium text-emerald-100 uppercase tracking-wide">Insight of the day</p>
            <p className="text-sm font-semibold text-white truncate">Great weather for sowing!</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setInsightDismissed(true);
              try {
                localStorage.setItem("home-insight-dismissed", "1");
              } catch {}
            }}
            className="shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center -m-2 rounded-lg text-white/90 hover:bg-white/20 hover:text-white transition-colors"
            aria-label="Dismiss insight"
          >
            <span className="text-lg font-bold leading-none">×</span>
          </button>
        </div>
      )}

      {/* ---- Weather (compact, mesh gradient) ---- */}
      <section className="rounded-xl bg-gradient-to-br from-sky-50 via-blue-50/50 to-amber-50/30 p-5 shadow-card-soft border border-black/5 mb-6">
        <h2 className="text-base font-bold text-black/90 mb-3 text-center pb-2 border-b border-black/5">Weather &amp; Forecast, {locationLabel}</h2>
        {weather ? (
          <>
            <div className="flex items-center justify-center gap-3 mb-2">
              <span className="text-2xl" aria-hidden>{weatherCodeToIcon(weather.code)}</span>
              <div>
                <p className="text-xl font-semibold text-black">{Math.round(weather.temp)}°F</p>
                <p className="text-xs text-black/60">{weather.condition}</p>
              </div>
            </div>
            {(weather.sunrise || weather.sunset) && (
              <div className="flex items-center justify-center gap-6 text-sm text-black/70 mb-2">
                <span className="flex items-center gap-1.5">
                  <span className="text-base" aria-hidden>🌅</span>
                  <span className="tabular-nums">{formatSunTime(weather.sunrise)}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="text-base" aria-hidden>🌇</span>
                  <span className="tabular-nums">{formatSunTime(weather.sunset)}</span>
                </span>
              </div>
            )}
            {weather.humidity != null && (
              <div className="flex items-center justify-center text-sm text-black/70 mb-2">
                <span className="flex items-center gap-1.5">
                  <span className="text-base" aria-hidden>💧</span>
                  <span>Humidity: {weather.humidity}%</span>
                </span>
              </div>
            )}
            {weather.daily.length > 0 && (
              <div className="flex flex-nowrap gap-0 overflow-x-auto py-1">
                {weather.daily.map((d, i) => (
                  <div
                    key={d.date}
                    className={`text-center min-w-[3.5rem] flex-shrink-0 py-0.5 ${i > 0 ? "border-l border-black/10" : ""}`}
                  >
                    <p className="text-[10px] text-black/60">{new Date(d.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short" })}</p>
                    <span className="text-base" aria-hidden>{weatherCodeToIcon(d.code)}</span>
                    <p className="text-[10px] text-black/80">{Math.round(d.high)}°/{Math.round(d.low)}°</p>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 pt-2 border-t border-black/5 space-y-1">
              {heatAlert && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-100 text-amber-800">
                  Extreme Heat: Check irrigation.
                </span>
              )}
            </div>
          </>
        ) : (
          <p className="text-black/50 text-sm">Loading weather...</p>
        )}
      </section>

      {/* ---- Planting Schedule (zone reference guide; separate from vault) ---- */}
      <section className="mb-6 rounded-xl bg-white p-4 shadow-card-soft border border-black/5">
        <h2 className="text-base font-bold text-black mb-3 pb-2 border-b border-black/5">Planting Schedule</h2>
        <p className="text-xs text-black/50 mb-3">Zone 10b reference guide — when to start indoors or plant outside. Not your vault.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/schedule?view=action"
            prefetch={false}
            className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100/80 px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            Action now
          </Link>
          <Link
            href="/schedule?view=heatmap"
            prefetch={false}
            className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-sky-50 border border-sky-100/80 px-4 py-3 text-sm font-semibold text-sky-800 hover:bg-sky-100 transition-colors"
          >
            Monthly pulse
          </Link>
          <Link
            href="/schedule?view=roadmap"
            prefetch={false}
            className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-100/80 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
          >
            Annual roadmap
          </Link>
        </div>
        <p className="text-xs text-black/50 mt-2 text-center">
          <Link href="/schedule" prefetch={false} className="text-emerald-600 font-medium hover:underline">
            View full schedule &rarr;
          </Link>
          {" · "}
          <Link href="/resources" prefetch={false} className="text-emerald-600 font-medium hover:underline">
            Zone charts & resources &rarr;
          </Link>
        </p>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* ---- Shopping List ---- */}
        <section className="rounded-xl bg-white p-4 shadow-card-soft border border-black/5">
          <h2 className="text-base font-bold text-black mb-3 pb-2 border-b border-black/5">Shopping list</h2>
          {loadingTasksAndList ? (
            <LoadingState message="Loading…" className="py-4" />
          ) : shoppingList.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-black/15" aria-hidden>
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <p className="text-xs text-black/50 text-center">No items on your shopping list yet.</p>
              <button
                type="button"
                onClick={() => setAddItemModalOpen(true)}
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                Add item
              </button>
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {shoppingList.map((item) => {
                  const label = `${item.name}${item.variety_name ? ` (${item.variety_name})` : ""}`;
                  const isPlaceholder = item.plant_profile_id == null && item.supply_profile_id == null;
                  const isSupply = item.supply_profile_id != null;
                  const supplyLinkDisabled = isSupply && !!item.supply_deleted_at;

                  if (isPlaceholder) {
                    return (
                      <li key={item.id} className="flex items-center gap-3 group">
                        <span className="flex-1 text-sm text-black/90 min-w-0">{label}</span>
                        <button
                          type="button"
                          onClick={() => handleMarkPurchased(item)}
                          disabled={markingPurchasedId === item.id}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          aria-label="Mark as purchased"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMarkPurchased(item)}
                          disabled={markingPurchasedId === item.id}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg border border-black/15 text-neutral-600 hover:bg-black/5 disabled:opacity-50"
                          aria-label="Remove from list"
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </li>
                    );
                  }

                  return (
                    <li key={item.id} className="flex items-center gap-3 group">
                      <input
                        type="checkbox"
                        id={`purchased-${item.id}`}
                        checked={false}
                        onChange={() => handleMarkPurchased(item)}
                        disabled={markingPurchasedId === item.id}
                        className="min-w-[44px] min-h-[44px] w-[44px] h-[44px] rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500 shrink-0 cursor-pointer"
                        aria-label={`Mark ${label} as purchased`}
                      />
                      <label htmlFor={`purchased-${item.id}`} className="flex-1 cursor-pointer text-sm text-black/90 min-w-0">
                        {isSupply ? (
                          supplyLinkDisabled ? (
                            <span>{label}</span>
                          ) : (
                            <Link href={`/vault/shed/${item.supply_profile_id}`} className="hover:text-emerald" onClick={(e) => e.stopPropagation()}>
                              {label}
                            </Link>
                          )
                        ) : (
                          <Link href={`/vault/${item.plant_profile_id}`} className="hover:text-emerald" onClick={(e) => e.stopPropagation()}>
                            {label}
                          </Link>
                        )}
                      </label>
                    </li>
                  );
                })}
              </ul>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3">
                <Link href="/shopping-list" className="text-sm text-emerald-600 font-medium hover:underline">
                  View full list &rarr;
                </Link>
                <button type="button" onClick={() => setAddItemModalOpen(true)} className="text-sm text-emerald-600 font-medium hover:underline">
                  Add item
                </button>
              </div>
            </>
          )}
        </section>

        <AddItemModal
          open={addItemModalOpen}
          onClose={() => setAddItemModalOpen(false)}
          onSuccess={() => setShoppingListRefreshKey((k) => k + 1)}
        />

        {/* ---- Tasks ---- */}
        <section className="rounded-xl bg-white p-4 shadow-card-soft border border-black/5">
          <h2 className="text-base font-bold text-black mb-1 pb-2 border-b border-black/5">At a glance</h2>
          <p className="text-xs text-black/50 mb-3">Tasks (pending)</p>
          {loadingTasksAndList ? (
            <LoadingState message="Loading…" className="py-4" />
          ) : (
            <div className="space-y-3">
              <div>
                {pendingTasks.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-black/15" aria-hidden>
                      <path d="M9 11l3 3L22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                    <p className="text-xs text-black/50 text-center">No pending tasks.</p>
                    <Link href="/calendar" className="text-xs font-medium text-emerald-600 hover:underline">View calendar →</Link>
                  </div>
                ) : (
                  <>
                  <ul className="space-y-1">
                    {pendingTasks.map((t) => {
                      const vaultId = t.plant_profile_id;
                      const taskHref = vaultId ? `/vault/${vaultId}` : "/calendar";
                      const isMarking = markingTaskDoneId === t.id;
                      return (
                        <li key={t.id} className="flex items-center justify-between gap-2">
                          <Link href={taskHref} className="text-sm text-black/90 hover:text-emerald flex-1 min-w-0 truncate">
                            {(() => {
                              const label = t.title ?? t.category ?? "";
                              const showPlant = t.plant_name && !label.includes(t.plant_name);
                              return `${label}${showPlant ? ` · ${t.plant_name}` : ""} (${new Date(t.due_date).toLocaleDateString()})`;
                            })()}
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleMarkTaskDone(t)}
                            disabled={isMarking}
                            className="shrink-0 min-w-[44px] min-h-[44px] px-2 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 disabled:opacity-50"
                          >
                            {isMarking ? "…" : "Done"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <Link href="/calendar" className="inline-block mt-2 text-xs font-medium text-emerald-600 hover:underline">View calendar →</Link>
                  </>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* FAB: Universal Add Menu */}
      <button
        type="button"
        onClick={() => setUniversalAddMenuOpen((o) => !o)}
        className={`fixed right-6 z-30 w-14 h-14 rounded-full shadow-card flex items-center justify-center hover:opacity-90 transition-all ${
          universalAddMenuOpen ? "bg-emerald-700 text-white" : "bg-emerald text-white"
        }`}
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        aria-label={universalAddMenuOpen ? "Close add menu" : "Add"}
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
          className={`transition-transform duration-200 ${universalAddMenuOpen ? "rotate-45" : "rotate-0"}`}
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
          pathname={pathname ?? "/"}
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
            router.push("/vault/plant?from=home");
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
            setNewTaskModalOpen(true);
          }}
          onAddJournal={() => {
            setUniversalAddMenuOpen(false);
            setQuickLogOpen(true);
          }}
        />
      )}

      {quickLogOpen && (
        <QuickLogModal
          open={quickLogOpen}
          onClose={() => setQuickLogOpen(false)}
          onJournalAdded={() => {
            router.refresh();
            setQuickLogOpen(false);
          }}
        />
      )}

      {newTaskModalOpen && (
        <NewTaskModal
          open={newTaskModalOpen}
          onClose={() => setNewTaskModalOpen(false)}
          onBackToMenu={() => {
            setNewTaskModalOpen(false);
            setUniversalAddMenuOpen(true);
          }}
          onSuccess={() => setShoppingListRefreshKey((k) => k + 1)}
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
          onSuccess={(opts) => {
            if (opts?.newProfileId) {
              setQuickAddSeedOpen(false);
              router.push(`/vault/${opts.newProfileId}`);
              return;
            }
            setShoppingListRefreshKey((k) => k + 1);
          }}
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
          onSuccess={() => setShoppingListRefreshKey((k) => k + 1)}
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
          onSuccess={() => setShoppingListRefreshKey((k) => k + 1)}
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
          onSuccess={() => setShoppingListRefreshKey((k) => k + 1)}
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

      {showAddPlantModal && (
        <AddPlantModal
          open={showAddPlantModal}
          onClose={() => setShowAddPlantModal(false)}
          defaultPlantType={addPlantDefaultType}
          stayInGarden={false}
          onSuccess={() => {
            setShowAddPlantModal(false);
            setShoppingListRefreshKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
