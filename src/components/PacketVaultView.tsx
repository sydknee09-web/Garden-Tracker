"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { OwnerBadge } from "@/components/OwnerBadge";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { decodeHtmlEntities } from "@/lib/htmlEntities";
import { PlantPlaceholderIcon } from "@/components/PlantPlaceholderIcon";

/** Minimal sow-month check without loading zone10b_schedule (avoids "ep" init error in chunk). */
function isPlantableInMonthSimple(plantingWindow: string | null | undefined, monthIndex: number): boolean {
  const w = plantingWindow?.trim();
  if (!w) return true;
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const abbrev = months[monthIndex];
  if (!abbrev) return false;
  if (new RegExp(abbrev, "i").test(w)) return true;
  const rangeMatch = w.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s*[-–—]\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  if (rangeMatch) {
    const start = months.indexOf(rangeMatch[1]!.toLowerCase());
    const end = months.indexOf(rangeMatch[2]!.toLowerCase());
    if (start >= 0 && end >= 0) return monthIndex >= Math.min(start, end) && monthIndex <= Math.max(start, end);
  }
  return false;
}
import { StarRating } from "@/components/StarRating";
import { qtyStatusToLabel } from "@/lib/packetQtyLabels";
import { VaultListSkeleton } from "@/components/PageSkeleton";
import { NoMatchCard } from "@/components/NoMatchCard";
import type { PacketStatusFilter } from "@/types/vault";
import { getEffectiveSeedTypes, isSeedTypeTag, SEED_TYPE_TAGS } from "@/constants/seedTypes";

export type { PacketStatusFilter };
export type PacketVaultItem = {
  id: string;
  plant_profile_id: string;
  profile_name: string;
  variety_name: string | null;
  vendor_name: string | null;
  purchase_date: string | null;
  qty_status: number;
  is_archived: boolean | null;
  packet_rating: number | null;
  primary_image_path: string | null;
  /** Law 7: plant profile hero (preferred over packet photo) */
  hero_image_url?: string | null;
  hero_image_path?: string | null;
  planting_window: string | null;
  owner_user_id: string | null;
  created_at: string | null;
  /** Derived: profile has active grow in garden */
  isActive: boolean;
  /** From plant_profiles for filtering */
  tags?: string[] | null;
  sun?: string | null;
  plant_spacing?: string | null;
  days_to_germination?: string | null;
  harvest_days?: number | null;
};

const LONG_PRESS_MS = 500;

export function PacketVaultView({
  refetchTrigger = 0,
  searchQuery = "",
  statusFilter = "",
  vendorFilter = null,
  sortBy = "date",
  sortDirection = "desc",
  sowMonth = null,
  batchSelectMode = false,
  selectedPacketIds,
  onTogglePacketSelection,
  onLongPressPacket,
  onFilteredPacketIdsChange,
  onFilteredCountChange,
  onEmptyStateChange,
  onOpenScanner,
  onAddFirst,
  scrollContainerRef,
  onPacketStatusChipsLoaded,
  onPacketVendorChipsLoaded,
  tagFilters = [],
  seedTypeFilters = [],
  sunFilter = null,
  spacingFilter = null,
  germinationFilter = null,
  maturityFilter = null,
  onPacketTagsLoaded,
  onPacketSeedTypeChipsLoaded,
  onPacketRefineChipsLoaded,
}: {
  refetchTrigger?: number;
  searchQuery?: string;
  statusFilter?: PacketStatusFilter;
  vendorFilter?: string | null;
  sortBy?: "date" | "variety" | "vendor" | "qty" | "rating";
  sortDirection?: "asc" | "desc";
  sowMonth?: string | null;
  batchSelectMode?: boolean;
  selectedPacketIds?: Set<string>;
  onTogglePacketSelection?: (packetId: string) => void;
  onLongPressPacket?: (packetId: string) => void;
  onFilteredPacketIdsChange?: (packetIds: string[]) => void;
  onFilteredCountChange?: (count: number) => void;
  onEmptyStateChange?: (isEmpty: boolean) => void;
  onOpenScanner?: () => void;
  onAddFirst?: () => void;
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  onPacketStatusChipsLoaded?: (chips: { value: PacketStatusFilter; label: string; count: number }[]) => void;
  onPacketVendorChipsLoaded?: (chips: { value: string; count: number }[]) => void;
  tagFilters?: string[];
  seedTypeFilters?: string[];
  sunFilter?: string | null;
  spacingFilter?: string | null;
  germinationFilter?: string | null;
  maturityFilter?: string | null;
  onPacketTagsLoaded?: (tags: string[]) => void;
  onPacketSeedTypeChipsLoaded?: (chips: { value: string; count: number }[]) => void;
  onPacketRefineChipsLoaded?: (chips: { sun: { value: string; count: number }[]; spacing: { value: string; count: number }[]; germination: { value: string; count: number }[]; maturity: { value: string; count: number }[] }) => void;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { viewMode: householdViewMode, getShorthandForUser, canEditPage } = useHousehold();
  const [packets, setPackets] = useState<PacketVaultItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pullRefetch, setPullRefetch] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [imageErrorIds, setImageErrorIds] = useState<Set<string>>(new Set());
  const [imageLoadedIds, setImageLoadedIds] = useState<Set<string>>(new Set());
  const [selectedOwnerFilter, setSelectedOwnerFilter] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFiredRef = useRef(false);
  const isOnline = useOnlineStatus();

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const getLongPressHandlers = useCallback(
    (pkt: PacketVaultItem) => ({
      onTouchStart: () => {
        longPressFiredRef.current = false;
        clearLongPressTimer();
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          longPressFiredRef.current = true;
          onLongPressPacket?.(pkt.id);
        }, LONG_PRESS_MS);
      },
      onTouchMove: clearLongPressTimer,
      onTouchEnd: clearLongPressTimer,
      onTouchCancel: clearLongPressTimer,
      handleClick: () => {
        if (longPressFiredRef.current) {
          longPressFiredRef.current = false;
          return;
        }
        router.push(`/vault/${pkt.plant_profile_id}`);
      },
    }),
    [onLongPressPacket, clearLongPressTimer, router]
  );

  const markThumbError = useCallback((packetId: string) => {
    setImageErrorIds((prev) => (prev.has(packetId) ? prev : new Set(prev).add(packetId)));
  }, []);

  const markThumbLoaded = useCallback((packetId: string) => {
    setImageLoadedIds((prev) => (prev.has(packetId) ? prev : new Set(prev).add(packetId)));
  }, []);

  /** Law 7: hero_image_url → hero_image_path → packet primary_image_path → sprout */
  const getThumbUrl = useCallback((pkt: PacketVaultItem): string | null => {
    if (imageErrorIds.has(pkt.id)) return null;
    const heroUrl = (pkt.hero_image_url ?? "").trim();
    if (heroUrl && heroUrl.startsWith("http")) {
      if (heroUrl.includes("supabase.co")) return heroUrl;
      return `/api/seed/proxy-image?url=${encodeURIComponent(heroUrl)}`;
    }
    const heroPath = (pkt.hero_image_path ?? "").trim();
    if (heroPath) return supabase.storage.from("journal-photos").getPublicUrl(heroPath).data.publicUrl;
    const path = pkt.primary_image_path?.trim();
    if (!path) return null;
    return supabase.storage.from("seed-packets").getPublicUrl(path).data.publicUrl;
  }, [imageErrorIds]);

  const sowMonthIndex = useMemo(() => {
    if (sowMonth && /^\d{4}-\d{2}$/.test(sowMonth)) {
      const [, m] = sowMonth.split("-").map(Number);
      return (m ?? 1) - 1;
    }
    return new Date().getMonth();
  }, [sowMonth]);

  const maturityRange = (days: number | null | undefined): string => {
    if (days == null || !Number.isFinite(days)) return "";
    if (days < 60) return "<60";
    if (days <= 90) return "60-90";
    return "90+";
  };

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      setPackets([]);
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("You're offline. Your packets will appear when you're back online.");
      setPackets([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const isFamilyView = householdViewMode === "family";

    async function fetchPackets() {
      let packetsQuery = supabase
        .from("seed_packets")
        .select("id, plant_profile_id, user_id, vendor_name, purchase_date, qty_status, is_archived, packet_rating, primary_image_path, created_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (!isFamilyView) packetsQuery = packetsQuery.eq("user_id", user!.id);

      const { data: packetData, error: packetErr } = await packetsQuery;

      if (cancelled) return;
      if (packetErr) {
        setError(packetErr.message);
        setPackets([]);
        setLoading(false);
        return;
      }

      const profileIds = Array.from(new Set((packetData ?? []).map((p: { plant_profile_id: string }) => p.plant_profile_id)));
      if (profileIds.length === 0) {
        setPackets([]);
        setLoading(false);
        return;
      }

      let growsQuery = supabase
        .from("grow_instances")
        .select("plant_profile_id")
        .in("plant_profile_id", profileIds)
        .in("status", ["pending", "growing"])
        .is("deleted_at", null);
      if (!isFamilyView && user?.id) growsQuery = growsQuery.eq("user_id", user.id);

      const [profilesRes, growsRes] = await Promise.all([
        supabase
          .from("plant_profiles")
          .select("id, name, variety_name, planting_window, hero_image_url, hero_image_path, tags, sun, plant_spacing, days_to_germination, harvest_days")
          .in("id", profileIds)
          .is("deleted_at", null),
        growsQuery,
      ]);

      if (cancelled) return;

      const profiles = profilesRes.data ?? [];
      const activeGrows = growsRes.data ?? [];
      const activeProfileIds = new Set(activeGrows.map((g: { plant_profile_id: string }) => g.plant_profile_id));

      type ProfileRow = { id: string; name: string; variety_name: string | null; planting_window: string | null; hero_image_url?: string | null; hero_image_path?: string | null; tags?: string[] | null; sun?: string | null; plant_spacing?: string | null; days_to_germination?: string | null; harvest_days?: number | null };
      const profileMap: Record<string, { name: string; variety_name: string | null; planting_window: string | null; hero_image_url?: string | null; hero_image_path?: string | null; tags?: string[] | null; sun?: string | null; plant_spacing?: string | null; days_to_germination?: string | null; harvest_days?: number | null }> = {};
      profiles.forEach((p: ProfileRow) => {
        profileMap[p.id] = {
          name: p.name ?? "Unknown",
          variety_name: p.variety_name ?? null,
          planting_window: p.planting_window ?? null,
          hero_image_url: p.hero_image_url ?? null,
          hero_image_path: p.hero_image_path ?? null,
          tags: p.tags ?? null,
          sun: p.sun ?? null,
          plant_spacing: p.plant_spacing ?? null,
          days_to_germination: p.days_to_germination ?? null,
          harvest_days: p.harvest_days ?? null,
        };
      });

      const items: PacketVaultItem[] = (packetData ?? [])
        .filter((p) => profileMap[p.plant_profile_id])
        .map((p: {
        id: string;
        plant_profile_id: string;
        user_id: string;
        vendor_name: string | null;
        purchase_date: string | null;
        qty_status: number;
        is_archived: boolean | null;
        packet_rating: number | null;
        primary_image_path: string | null;
        created_at?: string;
      }) => {
        const prof = profileMap[p.plant_profile_id]!;
        return {
          id: p.id,
          plant_profile_id: p.plant_profile_id,
          profile_name: prof.name ?? "Unknown",
          variety_name: prof.variety_name ?? null,
          vendor_name: p.vendor_name,
          purchase_date: p.purchase_date,
          qty_status: p.qty_status ?? 100,
          is_archived: p.is_archived ?? (p.qty_status <= 0),
          packet_rating: p.packet_rating,
          primary_image_path: p.primary_image_path,
          hero_image_url: prof.hero_image_url ?? null,
          hero_image_path: prof.hero_image_path ?? null,
          planting_window: prof.planting_window ?? null,
          owner_user_id: isFamilyView ? p.user_id : null,
          created_at: (p as { created_at?: string }).created_at ?? null,
          isActive: activeProfileIds.has(p.plant_profile_id),
          tags: prof.tags ?? null,
          sun: prof.sun ?? null,
          plant_spacing: prof.plant_spacing ?? null,
          days_to_germination: prof.days_to_germination ?? null,
          harvest_days: prof.harvest_days ?? null,
        };
      });

      setPackets(items);
      setLoading(false);
    }

    fetchPackets();
    return () => { cancelled = true; };
  }, [user?.id, refetchTrigger, householdViewMode, pullRefetch]);

  useEffect(() => {
    setImageErrorIds(new Set());
  }, [refetchTrigger]);

  usePullToRefresh({
    onRefresh: async () => {
      setPullRefetch((r) => r + 1);
    },
    disabled: loading,
    containerRef: scrollContainerRef,
  });

  const q = searchQuery.trim().toLowerCase();

  const filteredPackets = useMemo(() => {
    return packets.filter((pkt) => {
      if (q) {
        const name = (pkt.profile_name ?? "").toLowerCase();
        const variety = (pkt.variety_name ?? "").toLowerCase();
        const vendor = (pkt.vendor_name ?? "").toLowerCase();
        if (!name.includes(q) && !variety.includes(q) && !vendor.includes(q)) return false;
      }
      if (vendorFilter != null && vendorFilter !== "") {
        const v = (pkt.vendor_name ?? "").trim();
        if (v !== vendorFilter) return false;
      }
      if (sowMonth && /^\d{4}-\d{2}$/.test(sowMonth)) {
        if (!isPlantableInMonthSimple(pkt.planting_window, sowMonthIndex)) return false;
      }
      if (tagFilters.length > 0) {
        const packetTagFilters = tagFilters.filter((t) => !isSeedTypeTag(t));
        if (packetTagFilters.length > 0) {
          const seedTags = pkt.tags ?? [];
          if (!packetTagFilters.some((t) => seedTags.includes(t))) return false;
        }
      }
      if (seedTypeFilters.length > 0) {
        const effective = getEffectiveSeedTypes(pkt.tags, pkt.profile_name);
        if (!seedTypeFilters.some((t) => effective.includes(t))) return false;
      }
      if (sunFilter != null && sunFilter !== "") {
        const sun = (pkt.sun ?? "").trim();
        if (sun !== sunFilter) return false;
      }
      if (spacingFilter != null && spacingFilter !== "") {
        const sp = (pkt.plant_spacing ?? "").trim();
        if (sp !== spacingFilter) return false;
      }
      if (germinationFilter != null && germinationFilter !== "") {
        const g = (pkt.days_to_germination ?? "").trim();
        if (g !== germinationFilter) return false;
      }
      if (maturityFilter != null && maturityFilter !== "") {
        const m = maturityRange(pkt.harvest_days ?? null);
        if (m !== maturityFilter) return false;
      }
      if (statusFilter === "vault") {
        if (pkt.is_archived || (pkt.qty_status ?? 0) <= 0) return false;
        if (pkt.isActive) return false;
      }
      if (statusFilter === "active") {
        if (!pkt.isActive) return false;
      }
      if (statusFilter === "low_inventory") {
        const qty = pkt.qty_status ?? 100;
        if (qty > 20 || pkt.is_archived) return false;
      }
      if (statusFilter === "archived") {
        if (!pkt.is_archived && (pkt.qty_status ?? 100) > 0) return false;
      }
      return true;
    });
  }, [packets, q, vendorFilter, sowMonth, sowMonthIndex, statusFilter, tagFilters, seedTypeFilters, sunFilter, spacingFilter, germinationFilter, maturityFilter]);

  const sortedPackets = useMemo(() => {
    const list = [...filteredPackets];
    const mult = sortDirection === "asc" ? 1 : -1;
    list.sort((a, b) => {
      if (sortBy === "variety") {
        const va = (a.profile_name + (a.variety_name ?? "")).toLowerCase();
        const vb = (b.profile_name + (b.variety_name ?? "")).toLowerCase();
        return mult * va.localeCompare(vb, undefined, { sensitivity: "base" });
      }
      if (sortBy === "vendor") {
        const va = (a.vendor_name ?? "").toLowerCase();
        const vb = (b.vendor_name ?? "").toLowerCase();
        return mult * va.localeCompare(vb, undefined, { sensitivity: "base" });
      }
      if (sortBy === "qty") return mult * ((b.qty_status ?? 0) - (a.qty_status ?? 0));
      if (sortBy === "rating") {
        const ra = a.packet_rating ?? -1;
        const rb = b.packet_rating ?? -1;
        return mult * (rb - ra);
      }
      const da = a.purchase_date ? new Date(a.purchase_date).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
      const db = b.purchase_date ? new Date(b.purchase_date).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
      return mult * (da - db);
    });
    return list;
  }, [filteredPackets, sortBy, sortDirection]);

  const filteredPacketIds = useMemo(
    () => sortedPackets.filter((p) => !selectedOwnerFilter || p.owner_user_id === selectedOwnerFilter).map((p) => p.id),
    [sortedPackets, selectedOwnerFilter]
  );

  const packetStatusChips = useMemo(() => {
    const statuses: { value: PacketStatusFilter; label: string }[] = [
      { value: "", label: "All" },
      { value: "vault", label: "In storage" },
      { value: "active", label: "Active" },
      { value: "low_inventory", label: "Low inventory" },
      { value: "archived", label: "Archived" },
    ];
    return statuses.map(({ value, label }) => {
      let count = 0;
      if (value === "") count = packets.length;
      else if (value === "vault") count = packets.filter((p) => !p.is_archived && (p.qty_status ?? 0) > 0 && !p.isActive).length;
      else if (value === "active") count = packets.filter((p) => p.isActive).length;
      else if (value === "low_inventory") count = packets.filter((p) => (p.qty_status ?? 100) <= 20 && !p.is_archived).length;
      else if (value === "archived") count = packets.filter((p) => p.is_archived || (p.qty_status ?? 0) <= 0).length;
      return { value, label, count };
    });
  }, [packets]);

  const packetVendorChips = useMemo(() => {
    const map = new Map<string, number>();
    packets.forEach((p) => {
      const v = (p.vendor_name ?? "").trim() || "—";
      map.set(v, (map.get(v) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" }));
  }, [packets]);

  const packetTags = useMemo(() => {
    const all = new Set<string>();
    packets.forEach((p) => (p.tags ?? []).forEach((t) => all.add(t)));
    return Array.from(all).sort();
  }, [packets]);

  const packetSeedTypeChips = useMemo(() => {
    const map = new Map<string, number>();
    packets.forEach((p) => {
      const types = getEffectiveSeedTypes(p.tags, p.profile_name);
      types.forEach((t) => map.set(t, (map.get(t) ?? 0) + 1));
    });
    return SEED_TYPE_TAGS.filter((t) => (map.get(t) ?? 0) > 0)
      .map((value) => ({ value, count: map.get(value) ?? 0 }))
      .sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" }));
  }, [packets]);

  const packetRefineChips = useMemo(() => {
    const sunMap = new Map<string, number>();
    const spacingMap = new Map<string, number>();
    const germinationMap = new Map<string, number>();
    const maturityMap = new Map<string, number>();
    packets.forEach((p) => {
      const sun = (p.sun ?? "").trim() || "—";
      if (sun) sunMap.set(sun, (sunMap.get(sun) ?? 0) + 1);
      const sp = (p.plant_spacing ?? "").trim() || "—";
      if (sp) spacingMap.set(sp, (spacingMap.get(sp) ?? 0) + 1);
      const g = (p.days_to_germination ?? "").trim() || "—";
      if (g) germinationMap.set(g, (germinationMap.get(g) ?? 0) + 1);
      const m = maturityRange(p.harvest_days ?? null);
      if (m) maturityMap.set(m, (maturityMap.get(m) ?? 0) + 1);
    });
    return {
      sun: Array.from(sunMap.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" })),
      spacing: Array.from(spacingMap.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" })),
      germination: Array.from(germinationMap.entries()).map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value, undefined, { sensitivity: "base" })),
      maturity: (["<60", "60-90", "90+"] as const).filter((k) => maturityMap.has(k)).map((value) => ({ value, count: maturityMap.get(value) ?? 0 })),
    };
  }, [packets]);

  const showMemberPills = householdViewMode === "family";
  const householdMembers = useHousehold().householdMembers;

  const filteredPacketCount = sortedPackets.filter((p) => !selectedOwnerFilter || p.owner_user_id === selectedOwnerFilter).length;

  useEffect(() => {
    onFilteredPacketIdsChange?.(filteredPacketIds);
  }, [filteredPacketIds, onFilteredPacketIdsChange]);

  useEffect(() => {
    onFilteredCountChange?.(filteredPacketCount);
  }, [filteredPacketCount, onFilteredCountChange]);

  useEffect(() => {
    onPacketStatusChipsLoaded?.(packetStatusChips);
  }, [packetStatusChips, onPacketStatusChipsLoaded]);

  useEffect(() => {
    onPacketVendorChipsLoaded?.(packetVendorChips);
  }, [packetVendorChips, onPacketVendorChipsLoaded]);

  useEffect(() => {
    onPacketTagsLoaded?.(packetTags);
  }, [packetTags, onPacketTagsLoaded]);

  useEffect(() => {
    onPacketSeedTypeChipsLoaded?.(packetSeedTypeChips);
  }, [packetSeedTypeChips, onPacketSeedTypeChipsLoaded]);

  useEffect(() => {
    onPacketRefineChipsLoaded?.(packetRefineChips);
  }, [packetRefineChips, onPacketRefineChipsLoaded]);

  useEffect(() => {
    // Use packets.length (unfiltered), not sortedPackets.length — toolbar must stay visible when search/filters return 0 so user can clear
    onEmptyStateChange?.(packets.length === 0 && !loading);
  }, [packets.length, loading, onEmptyStateChange]);

  const goToProfile = useCallback((profileId: string) => {
    router.push(`/vault/${profileId}`);
  }, [router]);

  const handleRowClick = useCallback((pkt: PacketVaultItem) => {
    if (batchSelectMode && onTogglePacketSelection) {
      onTogglePacketSelection(pkt.id);
    } else {
      goToProfile(pkt.plant_profile_id);
    }
  }, [batchSelectMode, onTogglePacketSelection, goToProfile]);

  if (loading && packets.length === 0) {
    return (
      <div className="relative z-10 pt-2">
        <VaultListSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-card-lg bg-white p-6 shadow-card border border-black/5 text-center max-w-md mx-auto">
        <p className="text-slate-600 mb-4">{isOnline ? error : "You're offline. Your packets will appear when you're back online."}</p>
      </div>
    );
  }

  if (sortedPackets.length === 0) {
    const hasFilters = !!(q || statusFilter || vendorFilter || (sowMonth && /^\d{4}-\d{2}$/.test(sowMonth)) || tagFilters.length > 0 || seedTypeFilters.length > 0 || sunFilter || spacingFilter || germinationFilter || maturityFilter);
    if (hasFilters) {
      return <NoMatchCard message="No packets match your search or filters." />;
    }
    return (
      <div className="rounded-2xl bg-white p-8 shadow-card border border-black/10 text-center max-w-md mx-auto" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
        <p className="text-black/70 font-medium mb-4">No packets yet. Add your first packet to get started.</p>
        {onAddFirst && (
          <button
            type="button"
            onClick={onAddFirst}
            className="min-h-[44px] min-w-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
          >
            Add your first packet
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative z-10 space-y-2">
      {showMemberPills && householdMembers.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap pb-1">
          <button
            type="button"
            onClick={() => setSelectedOwnerFilter(null)}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${selectedOwnerFilter === null ? "bg-emerald-600 text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"}`}
          >
            All
          </button>
          {householdMembers.map((m) => {
            const shorthand = getShorthandForUser(m.user_id);
            const isSelected = selectedOwnerFilter === m.user_id;
            return (
              <button
                key={m.user_id}
                type="button"
                onClick={() => setSelectedOwnerFilter(isSelected ? null : m.user_id)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${isSelected ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100"}`}
              >
                {shorthand}
              </button>
            );
          })}
        </div>
      )}

      {/* Mobile compact list */}
      <div className="sm:hidden rounded-xl border border-black/10 bg-white overflow-hidden">
        <ul className="divide-y divide-black/5" role="list">
          {sortedPackets
            .filter((pkt) => !selectedOwnerFilter || pkt.owner_user_id === selectedOwnerFilter)
            .map((pkt) => {
              const lp = onLongPressPacket ? getLongPressHandlers(pkt) : null;
              const thumbUrl = getThumbUrl(pkt);
              const showSeedling = !thumbUrl || imageErrorIds.has(pkt.id);
              const varietyDisplay = pkt.variety_name?.trim() ? ` (${pkt.variety_name})` : "";
              const ownerBadge = pkt.owner_user_id ? getShorthandForUser(pkt.owner_user_id) : null;
              const isSelected = selectedPacketIds?.has(pkt.id);
              const isArchived = pkt.is_archived || (pkt.qty_status ?? 0) <= 0;

              return (
                <li key={pkt.id}>
                  <button
                    type="button"
                    onClick={() => batchSelectMode ? onTogglePacketSelection?.(pkt.id) : (lp ? lp.handleClick() : goToProfile(pkt.plant_profile_id))}
                    className={`w-full flex items-center gap-3 px-3 py-3 text-left min-h-[44px] hover:bg-gray-50 transition-colors ${batchSelectMode && isSelected ? "bg-emerald/5 border-2 border-emerald-500" : ""}`}
                    {...(lp && !batchSelectMode ? { onTouchStart: lp.onTouchStart, onTouchMove: lp.onTouchMove, onTouchEnd: lp.onTouchEnd, onTouchCancel: lp.onTouchCancel } : {})}
                  >
                    {batchSelectMode && (
                      <span className="shrink-0 flex items-center min-w-[44px] min-h-[44px] justify-center">
                        <span className={`w-6 h-6 rounded-full border-2 flex items-center justify-center bg-white ${isSelected ? "border-emerald-500" : "border-black/20"}`} aria-hidden>
                          {isSelected ? <span className="w-3 h-3 rounded-full bg-emerald-600" /> : null}
                        </span>
                      </span>
                    )}
                    <span className="shrink-0 relative w-10 h-10 rounded-lg overflow-hidden bg-white flex items-center justify-center">
                      {showSeedling ? (
                        <PlantPlaceholderIcon size="lg" className="object-contain" />
                      ) : (
                        <img src={thumbUrl!} alt="" className="w-full h-full object-cover transition-opacity duration-200" style={{ opacity: imageLoadedIds.has(pkt.id) ? 1 : 0 }} loading="lazy" onLoad={() => markThumbLoaded(pkt.id)} onError={() => markThumbError(pkt.id)} />
                      )}
                      {ownerBadge && (
                        <span className="absolute top-0.5 right-0.5 z-10 pointer-events-none">
                          <OwnerBadge shorthand={ownerBadge} canEdit={pkt.owner_user_id ? canEditPage(pkt.owner_user_id ?? "", "seed_vault") : true} size="xs" />
                        </span>
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-neutral-900 truncate">{decodeHtmlEntities(pkt.profile_name)}{varietyDisplay}</span>
                      {pkt.vendor_name?.trim() && (
                        <span className="block text-xs text-neutral-500 truncate">{pkt.vendor_name.trim()}</span>
                      )}
                    </span>
                    <span className="shrink-0 inline-flex items-center">
                      {isArchived ? (
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">Out</span>
                      ) : (
                        <span className="inline-flex items-center justify-center min-w-[1.75rem] px-1.5 py-0.5 rounded text-xs font-medium bg-black/10 text-neutral-700">{qtyStatusToLabel(pkt.qty_status)}</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
        </ul>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-black/10 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
              <th className="px-4 py-3">Variety</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Rating</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {sortedPackets
              .filter((pkt) => !selectedOwnerFilter || pkt.owner_user_id === selectedOwnerFilter)
              .map((pkt) => {
                const qtyColor = pkt.qty_status > 50 ? "text-emerald-600" : pkt.qty_status > 20 ? "text-amber-600" : "text-red-600";
                const varietyDisplay = pkt.variety_name?.trim() ? ` (${pkt.variety_name})` : "";
                const isArchived = pkt.is_archived || (pkt.qty_status ?? 0) <= 0;
                const isSelected = selectedPacketIds?.has(pkt.id);

                return (
                  <tr
                    key={pkt.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleRowClick(pkt)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRowClick(pkt);
                      }
                    }}
                    className={`hover:bg-neutral-50 cursor-pointer transition-colors ${pkt.is_archived ? "opacity-50" : ""} ${batchSelectMode && isSelected ? "bg-emerald/5 ring-2 ring-emerald-500" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-neutral-800">
                        {decodeHtmlEntities(pkt.profile_name)}{varietyDisplay}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-600">{pkt.vendor_name?.trim() || "--"}</td>
                    <td className="px-4 py-3 text-neutral-500">{pkt.purchase_date ? new Date(pkt.purchase_date).toLocaleDateString() : "--"}</td>
                    <td className={`px-4 py-3 font-medium ${isArchived ? "text-neutral-500" : qtyColor}`}>
                      {isArchived ? "Out" : qtyStatusToLabel(pkt.qty_status)}
                    </td>
                    <td className="px-4 py-3">
                      {isArchived ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500">Archived</span>
                      ) : pkt.isActive ? (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Active</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-100 text-neutral-500">In storage</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StarRating value={pkt.packet_rating} size="sm" />
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
