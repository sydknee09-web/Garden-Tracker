"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useSync } from "@/contexts/SyncContext";
import { completeTask } from "@/lib/completeSowTask";
import { buildForecastUrl, weatherCodeToCondition, weatherCodeToIcon } from "@/lib/weatherSnapshot";
import type { Task } from "@/types/garden";
import type { ShoppingListItem } from "@/types/garden";

type TaskWithPlant = Task & { plant_name?: string };
type ShoppingItemWithName = ShoppingListItem & { name?: string; variety_name?: string | null };
type UpcomingCare = { id: string; title: string; category: string | null; next_due_date: string | null; plant_profile_id: string; plant_name: string };

type WeatherDay = { date: string; high: number; low: number; code: number };
type WeatherData = {
  temp: number;
  condition: string;
  code: number;
  daily: WeatherDay[];
} | null;

type UserSettingsRow = {
  planting_zone?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  location_name?: string | null;
};

/** Planting calendar references: Zone 9/10 primary (SDSC), other zones, Farmers' Almanac. */
const PLANTING_CALENDAR_LINKS = [
  { label: "Zone 9/10 Quick-Glance (San Diego Seed Co)", url: "https://sandiegoseedcompany.com/wp-content/uploads/2023/03/SDSC-Planting-Chart-2023.pdf", primary: true },
  { label: "Zone 8", url: "https://sandiegoseedcompany.com/growing/zone-8-planting-calendar/", primary: false },
  { label: "Zone 7", url: "https://sandiegoseedcompany.com/growing/zone-7-planting-calendar/", primary: false },
  { label: "Zone 6", url: "https://sandiegoseedcompany.com/planting/zone-6-planting-calendar/", primary: false },
  { label: "Zone 5", url: "https://sandiegoseedcompany.com/growing/zone-5-planting-calendar/", primary: false },
  { label: "Farmers' Almanac planting dates", url: "https://www.almanac.com/gardening/planting-calendar", primary: false },
] as const;

export default function HomePage() {
  const { user } = useAuth();
  const { setSyncing } = useSync();
  const [pendingTasks, setPendingTasks] = useState<TaskWithPlant[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingItemWithName[]>([]);
  const [weather, setWeather] = useState<WeatherData>(null);
  const [loading, setLoading] = useState(true);
  const [markingPurchasedId, setMarkingPurchasedId] = useState<string | null>(null);
  const [markingTaskDoneId, setMarkingTaskDoneId] = useState<string | null>(null);
  const [upcomingCare, setUpcomingCare] = useState<UpcomingCare[]>([]);
  const [userSettings, setUserSettings] = useState<UserSettingsRow | null>(null);
  const [insightDismissed, setInsightDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("home-insight-dismissed") === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;

    async function load() {
      const twoWeeksOut = new Date();
      twoWeeksOut.setDate(twoWeeksOut.getDate() + 14);

      // Batch 1: Fetch all independent data in parallel
      const [settingsRes, tasksRes, listRes, careRes] = await Promise.all([
        supabase.from("user_settings").select("planting_zone, latitude, longitude, timezone, location_name").eq("user_id", user!.id).maybeSingle(),
        supabase.from("tasks").select("id, plant_profile_id, plant_variety_id, category, due_date, completed_at, created_at, grow_instance_id, title").eq("user_id", user!.id).is("deleted_at", null).is("completed_at", null).order("due_date", { ascending: true }).limit(20),
        supabase.from("shopping_list").select("id, user_id, plant_profile_id, created_at, placeholder_name, placeholder_variety").eq("user_id", user!.id).eq("is_purchased", false).order("created_at", { ascending: false }),
        supabase.from("care_schedules").select("id, title, category, next_due_date, plant_profile_id").eq("user_id", user!.id).eq("is_active", true).lte("next_due_date", twoWeeksOut.toISOString().slice(0, 10)).order("next_due_date", { ascending: true }).limit(10),
      ]);

      const settings = settingsRes.data as UserSettingsRow | null;
      if (!cancelled) setUserSettings(settings);

      const taskRows = Array.isArray(tasksRes.data) ? tasksRes.data : [];
      const listRows = listRes.data ?? [];
      const careData = careRes.data ?? [];

      // Batch 2: Resolve names — collect all profile/variety IDs and fetch in parallel
      const profileIds = taskRows.map((t: { plant_profile_id?: string | null }) => t.plant_profile_id).filter((id): id is string => Boolean(id));
      const varietyIds = taskRows.map((t: { plant_variety_id?: string | null }) => t.plant_variety_id).filter((id): id is string => Boolean(id));
      const listIds = Array.from(new Set(listRows.map((r: { plant_profile_id: string | null }) => r.plant_profile_id).filter(Boolean) as string[]));
      const careProfileIds = careData.length > 0 ? Array.from(new Set(careData.map((c: { plant_profile_id: string }) => c.plant_profile_id))) : [];
      const allProfileIds = Array.from(new Set([...profileIds, ...listIds, ...careProfileIds]));

      const [profilesRes, varietiesRes] = await Promise.all([
        allProfileIds.length > 0 ? supabase.from("plant_profiles").select("id, name, variety_name").in("id", allProfileIds) : Promise.resolve({ data: [] }),
        varietyIds.length > 0 ? supabase.from("plant_varieties").select("id, name").in("id", Array.from(new Set(varietyIds))) : Promise.resolve({ data: [] }),
      ]);

      const profiles = profilesRes.data ?? [];
      const varieties = varietiesRes.data ?? [];
      const names: Record<string, string> = {};
      profiles.forEach((p: { id: string; name: string; variety_name: string | null }) => {
        names[p.id] = p.variety_name?.trim() ? `${p.name} (${p.variety_name})` : p.name;
      });
      varieties.forEach((v: { id: string; name: string }) => { names[v.id] = v.name; });

      const listNames: Record<string, { name: string; variety_name: string | null }> = {};
      profiles.forEach((x: { id: string; name: string; variety_name: string | null }) => { listNames[x.id] = { name: x.name, variety_name: x.variety_name }; });

      const withNames: TaskWithPlant[] = taskRows.map((t: Task & { plant_profile_id?: string | null; plant_variety_id?: string | null }) => {
        const linkId = t.plant_profile_id ?? t.plant_variety_id;
        return { ...t, plant_name: linkId ? names[linkId] ?? "Unknown" : undefined };
      });
      if (!cancelled) setPendingTasks(withNames);

      if (!cancelled) setShoppingList(
        listRows.map((r: { id: string; user_id: string; plant_profile_id: string | null; created_at: string; placeholder_name?: string | null; placeholder_variety?: string | null }) => ({
          ...r,
          name: r.plant_profile_id ? (listNames[r.plant_profile_id]?.name ?? "Unknown") : (r.placeholder_name ?? "Wishlist"),
          variety_name: r.plant_profile_id ? (listNames[r.plant_profile_id]?.variety_name ?? null) : (r.placeholder_variety ?? null),
        }))
      );

      if (careData.length > 0 && !cancelled) {
        setUpcomingCare(careData.map((c: { id: string; title: string; category: string | null; next_due_date: string | null; plant_profile_id: string }) => ({
          ...c,
          plant_name: names[c.plant_profile_id] ?? "Unknown",
        })));
      }

      // Weather -- use user coords if available (runs after batch 1 for settings)
      try {
        const forecastUrl = buildForecastUrl(settings ? { latitude: settings.latitude, longitude: settings.longitude, timezone: settings.timezone } : null);
        const res = await fetch(forecastUrl);
        const data = await res.json();
        if (!cancelled && data?.current) {
          const cur = data.current;
          const daily = data.daily;
          const days: WeatherDay[] = (daily?.time ?? []).slice(0, 7).map((date: string, i: number) => ({
            date,
            high: Number(daily?.temperature_2m_max?.[i]) ?? 0,
            low: Number(daily?.temperature_2m_min?.[i]) ?? 0,
            code: Number(daily?.weather_code?.[i]) ?? 0,
          }));
          setWeather({
            temp: Number(cur.temperature_2m),
            condition: weatherCodeToCondition(Number(cur.weather_code)),
            code: Number(cur.weather_code),
            daily: days,
          });
        } else if (!cancelled) setWeather(null);
      } catch {
        if (!cancelled) setWeather(null);
      }

      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [user?.id]);

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
    setMarkingPurchasedId(item.id);
    setSyncing(true);
    try {
      await supabase.from("shopping_list").update({ is_purchased: true }).eq("id", item.id).eq("user_id", user.id);
      setShoppingList((prev) => prev.filter((i) => i.id !== item.id));
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
          <span className="text-lg shrink-0" aria-hidden>🌱</span>
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
            className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-100/80 px-4 py-3 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            Action now
          </Link>
          <Link
            href="/schedule?view=heatmap"
            className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-sky-50 border border-sky-100/80 px-4 py-3 text-sm font-semibold text-sky-800 hover:bg-sky-100 transition-colors"
          >
            Monthly pulse
          </Link>
          <Link
            href="/schedule?view=roadmap"
            className="min-h-[44px] flex items-center justify-center gap-2 rounded-xl bg-amber-50 border border-amber-100/80 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
          >
            Annual roadmap
          </Link>
        </div>
        <p className="text-xs text-black/50 mt-2 text-center">
          <Link href="/schedule" className="text-emerald-600 font-medium hover:underline">
            View full schedule &rarr;
          </Link>
        </p>
      </section>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* ---- Shopping List ---- */}
        <section className="rounded-xl bg-white p-4 shadow-card-soft border border-black/5">
          <h2 className="text-base font-bold text-black mb-3 pb-2 border-b border-black/5">Shopping list</h2>
          {loading ? (
            <p className="text-black/50 text-sm">Loading...</p>
          ) : shoppingList.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-black/15" aria-hidden>
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
                <line x1="3" y1="6" x2="21" y2="6" />
                <path d="M16 10a4 4 0 0 1-8 0" />
              </svg>
              <p className="text-xs text-black/50 text-center">Nothing to buy.</p>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                <Link href="/vault" className="text-xs font-medium text-emerald-600 hover:underline">Add from Vault (out of stock)</Link>
                <Link href="/vault?open=quickadd" className="text-xs font-medium text-emerald-600 hover:underline">Add a variety I don&apos;t have</Link>
              </div>
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {shoppingList.map((item) => {
                  const label = `${item.name}${item.variety_name ? ` (${item.variety_name})` : ""}`;
                  const isPlaceholder = item.plant_profile_id == null;
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
                        {isPlaceholder ? (
                          <span>{label}</span>
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
              <Link href="/shopping-list" className="text-sm text-emerald-600 font-medium hover:underline mt-3 inline-block">
                View full list &rarr;
              </Link>
            </>
          )}
        </section>

        {/* ---- Tasks ---- */}
        <section className="rounded-xl bg-white p-4 shadow-card-soft border border-black/5">
          <h2 className="text-base font-bold text-black mb-1 pb-2 border-b border-black/5">At a glance</h2>
          <p className="text-xs text-black/50 mb-3">Tasks (pending)</p>
          {loading ? (
            <p className="text-black/50 text-sm">Loading...</p>
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
                  <ul className="space-y-1">
                    {pendingTasks.map((t) => {
                      const vaultId = t.plant_profile_id ?? t.plant_variety_id;
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
                            {isMarking ? "..." : "Done"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ---- Plant Care ---- */}
        {upcomingCare.length > 0 && (
          <section className="sm:col-span-2 rounded-xl bg-white p-4 shadow-card-soft border border-black/5">
            <h2 className="text-lg font-medium text-black mb-2 text-center">Plant Care</h2>
            <p className="text-xs text-black/50 mb-3">Upcoming care reminders for the next 2 weeks</p>
            <ul className="space-y-2">
              {upcomingCare.map((c) => {
                const isOverdue = c.next_due_date && new Date(c.next_due_date + "T00:00:00") < new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");
                const catIcon = c.category === "fertilize" ? "🌿" : c.category === "prune" ? "✂️" : c.category === "water" ? "💧" : c.category === "spray" ? "🧴" : c.category === "harvest" ? "🧺" : "📋";
                return (
                  <li key={c.id} className="flex items-center gap-3">
                    <span className="text-lg shrink-0" aria-hidden>{catIcon}</span>
                    <div className="flex-1 min-w-0">
                      <Link href={`/vault/${c.plant_profile_id}`} className="text-sm text-black/90 hover:text-emerald-600 font-medium truncate block">
                        {c.title}
                      </Link>
                      <p className="text-xs text-black/50">{c.plant_name}{c.next_due_date ? ` -- ${isOverdue ? "Overdue: " : ""}${new Date(c.next_due_date + "T00:00:00").toLocaleDateString()}` : ""}</p>
                    </div>
                    {isOverdue && <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-600 font-medium shrink-0">Overdue</span>}
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {/* ---- Planting Calendars (SDSC + Farmers' Almanac) ---- */}
      <section className="mt-6 rounded-xl bg-white p-4 shadow-card-soft border border-black/5">
        <h2 className="text-base font-bold text-black mb-3 pb-2 border-b border-black/5">Planting calendars</h2>
        <p className="text-xs text-black/50 mb-3">Zone charts and frost dates — open in a new tab to view or print. Or use our in-app <Link href="/schedule" className="text-emerald-600 font-medium hover:underline">Planting Schedule</Link> (Zone 10b reference).</p>
        <div className="space-y-3">
          {PLANTING_CALENDAR_LINKS.filter((c) => c.primary).map((cal) => (
            <a
              key={cal.url}
              href={cal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 min-w-[44px] min-h-[44px] w-full rounded-xl bg-emerald-50 border border-emerald-100/80 p-3 text-left hover:bg-emerald-100 transition-colors group"
            >
              <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700" aria-hidden>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-emerald-800 group-hover:text-emerald-900">{cal.label}</span>
                <span className="ml-1.5 text-xs text-emerald-600">(opens in new tab)</span>
              </div>
              <span className="shrink-0 text-emerald-600" aria-hidden>↗</span>
            </a>
          ))}
          <div className="pt-2 border-t border-black/5">
            <p className="text-xs font-medium text-black/70 mb-2">Other zones &amp; references</p>
            <ul className="flex flex-wrap gap-2">
              {PLANTING_CALENDAR_LINKS.filter((c) => !c.primary).map((cal) => (
                <li key={cal.url}>
                  <a
                    href={cal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 min-w-[44px] min-h-[44px] px-3 py-2 rounded-lg border border-black/10 bg-white text-sm text-black/80 hover:bg-black/5 hover:border-black/20 transition-colors"
                  >
                    {cal.label}
                    <span className="text-black/40" aria-hidden>↗</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
