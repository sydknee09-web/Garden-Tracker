"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";
import { ICON_MAP } from "@/lib/styleDictionary";
import { PacketQtyOptions } from "@/components/PacketQtyOptions";
import { StarRating } from "@/components/StarRating";
import { PlantPlaceholderIcon } from "@/components/PlantPlaceholderIcon";
import { AddPlantModal } from "@/components/AddPlantModal";
import { EditPacketModal } from "@/components/EditPacketModal";
import { SEED_PACKET_PROFILE_SELECT } from "@/lib/seedPackets";
import { getSwipeOrder } from "@/lib/swipeOrder";
import { useVaultPacketHandlers } from "@/app/vault/[id]/useVaultPacketHandlers";
import { getPacketImageUrls, toDateInputValue, formatDisplayDate } from "@/app/vault/[id]/vaultProfileUtils";
import type { SeedPacket, GrowInstance } from "@/types/garden";

const PILL = "min-w-[44px] min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white text-emerald-800 hover:bg-neutral-50 font-medium text-sm px-3 shrink-0";

export default function VaultPacketDetailPage() {
  const { user } = useAuth();
  const { viewMode: householdViewMode, getShorthandForUser, canEditPage } = useHousehold();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params?.id as string | undefined;

  const fromParam = searchParams.get("from");
  const profileIdParam = searchParams.get("profileId");

  const [packets, setPackets] = useState<SeedPacket[]>([]);
  const [profileName, setProfileName] = useState<string>("");
  const [profileVariety, setProfileVariety] = useState<string>("");
  const [profileHeroPath, setProfileHeroPath] = useState<string | null>(null);
  const [profilePrimaryPath, setProfilePrimaryPath] = useState<string | null>(null);
  // Growing recs are profile-canonical (one set per variety); read-only here, edited on the profile.
  const [profileSun, setProfileSun] = useState<string | null>(null);
  const [profileSpacing, setProfileSpacing] = useState<string | null>(null);
  const [profileGermination, setProfileGermination] = useState<string | null>(null);
  const [profileMaturity, setProfileMaturity] = useState<number | null>(null);
  const [profileSowingDepth, setProfileSowingDepth] = useState<string | null>(null);
  const [profileDescription, setProfileDescription] = useState<string | null>(null);
  const [growInstances, setGrowInstances] = useState<GrowInstance[]>([]);
  const [extraImages, setExtraImages] = useState<{ image_path: string }[]>([]);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [heroFailed, setHeroFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [plantFromPacketOpen, setPlantFromPacketOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [orderedPacketIds, setOrderedPacketIds] = useState<string[]>([]);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);

  const pkt = packets[0] ?? null;

  const {
    fetchJournalForPacket,
    journalByPacketId,
    loadingJournalForPacket,
    updatePacketQty,
    updatePacketPurchaseDate,
    updatePacketNotes,
    updatePacketStorageLocation,
    updatePacketRating,
    deletePacket,
  } = useVaultPacketHandlers({
    userId: user?.id,
    profileId: pkt?.plant_profile_id ?? "",
    profileOwnerId: pkt?.user_id ?? "",
    packets,
    setPackets,
  });

  const loadPacket = useCallback(async () => {
    if (!id || !user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("seed_packets")
      .select(SEED_PACKET_PROFILE_SELECT)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error || !data) {
      setPackets([]);
      setLoading(false);
      return;
    }
    const row = data as SeedPacket;
    setPackets([row]);

    const [{ data: prof }, { data: grows }, { data: imgs }] = await Promise.all([
      supabase.from("plant_profiles").select("name, variety_name, hero_image_path, primary_image_path, sun, plant_spacing, days_to_germination, harvest_days, botanical_care_notes, plant_description").eq("id", row.plant_profile_id).maybeSingle(),
      supabase
        .from("grow_instances")
        .select("id, sown_date, location, seed_packet_id, seeds_sown, seeds_sprouted")
        .eq("seed_packet_id", id)
        .is("deleted_at", null)
        .order("sown_date", { ascending: false }),
      supabase
        .from("packet_images")
        .select("image_path, sort_order")
        .eq("seed_packet_id", id)
        .order("sort_order", { ascending: true }),
    ]);

    const p = prof as {
      name?: string; variety_name?: string | null; hero_image_path?: string | null; primary_image_path?: string | null;
      sun?: string | null; plant_spacing?: string | null; days_to_germination?: string | null; harvest_days?: number | null;
      botanical_care_notes?: unknown; plant_description?: string | null;
    } | null;
    setProfileName(p?.name ?? "");
    setProfileVariety(p?.variety_name?.trim() ?? "");
    setProfileHeroPath(p?.hero_image_path?.trim() || null);
    setProfilePrimaryPath(p?.primary_image_path?.trim() || null);
    setProfileSun(p?.sun?.trim() || null);
    setProfileSpacing(p?.plant_spacing?.trim() || null);
    setProfileGermination(p?.days_to_germination?.trim() || null);
    setProfileMaturity(p?.harvest_days ?? null);
    const bcn = p?.botanical_care_notes;
    setProfileSowingDepth(bcn && typeof bcn === "object" && typeof (bcn as { sowing_depth?: unknown }).sowing_depth === "string" ? (bcn as { sowing_depth: string }).sowing_depth.trim() || null : null);
    setProfileDescription(p?.plant_description?.trim() || null);
    setGrowInstances((grows ?? []) as GrowInstance[]);
    setExtraImages(((imgs ?? []) as { image_path: string }[]).map((r) => ({ image_path: r.image_path })));
    setLoading(false);
  }, [id, user?.id]);

  useEffect(() => {
    setActiveImageIdx(0);
    setHeroFailed(false);
    void loadPacket();
  }, [loadPacket]);

  useEffect(() => {
    if (id) void fetchJournalForPacket(id);
  }, [id, fetchJournalForPacket]);

  // Context-aware swipe set (Option A): from a profile → that variety's packets only (matching the
  // profile Packets-tab order: in-stock first, then newest); from the Vault list → all packets,
  // newest-first (the list's user-chosen sort isn't accessible here, so newest-first per the lock).
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      if (fromParam === "profile" && profileIdParam) {
        const { data } = await supabase
          .from("seed_packets")
          .select("id, qty_status, created_at")
          .eq("plant_profile_id", profileIdParam)
          .eq("user_id", user.id)
          .is("deleted_at", null);
        if (cancelled || !data) return;
        const sorted = [...(data as { id: string; qty_status: number | null; created_at?: string }[])].sort((a, b) => {
          const aHas = (a.qty_status ?? 0) > 0 ? 1 : 0;
          const bHas = (b.qty_status ?? 0) > 0 ? 1 : 0;
          if (bHas !== aHas) return bHas - aHas;
          return (b.created_at ?? "").localeCompare(a.created_at ?? "");
        });
        setOrderedPacketIds(sorted.map((r) => r.id));
      } else {
        // Prefer the filtered+sorted snapshot from the Vault Seed Packets list (so swipe follows
        // the user's filter/sort), falling back to newest-first for deep-links/other entry points.
        const snapshot = id ? getSwipeOrder("packets", id) : null;
        if (snapshot) {
          setOrderedPacketIds(snapshot);
          return;
        }
        const { data } = await supabase
          .from("seed_packets")
          .select("id")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("created_at", { ascending: false });
        if (cancelled || !data) return;
        setOrderedPacketIds((data as { id: string }[]).map((r) => r.id));
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id, fromParam, profileIdParam, id]);

  const imageUrls = useMemo(() => (pkt ? getPacketImageUrls(pkt, extraImages) : []), [pkt, extraImages]);

  // Hero: packet photo first; fall back to the plant profile's STORED photo (hero_image_path →
  // primary_image_path). The external hero_image_url is deliberately skipped — it can 404 /
  // hotlink-block (the 2026-06-08 broken-image class). Null → placeholder so the page is never sparse.
  const profileHeroUrl = useMemo(() => {
    if (profileHeroPath) return supabase.storage.from("journal-photos").getPublicUrl(profileHeroPath).data.publicUrl;
    if (profilePrimaryPath) return supabase.storage.from("seed-packets").getPublicUrl(profilePrimaryPath).data.publicUrl;
    return null;
  }, [profileHeroPath, profilePrimaryPath]);
  const heroDisplayUrl = imageUrls.length > 0 ? (imageUrls[activeImageIdx] ?? imageUrls[0]) : profileHeroUrl;

  const backHref =
    fromParam === "profile" && profileIdParam
      ? `/vault/${profileIdParam}?tab=packets`
      : "/vault?tab=list";

  const canEdit = pkt ? (pkt.user_id === user?.id ? true : canEditPage(pkt.user_id, "plant_vault")) : false;
  const isOwn = pkt?.user_id === user?.id;

  // Preserve entry context across swipes so the traversal set stays consistent.
  const contextQuery = fromParam === "profile" && profileIdParam ? `?from=profile&profileId=${profileIdParam}` : "";

  const { prevId, nextId } = useMemo(() => {
    if (!id || orderedPacketIds.length === 0) return { prevId: null as string | null, nextId: null as string | null };
    const idx = orderedPacketIds.indexOf(id);
    if (idx < 0) return { prevId: null, nextId: null };
    return {
      prevId: idx > 0 ? orderedPacketIds[idx - 1]! : null,
      nextId: idx < orderedPacketIds.length - 1 ? orderedPacketIds[idx + 1]! : null,
    };
  }, [id, orderedPacketIds]);

  const handleSwipeStart = useCallback((e: React.TouchEvent) => {
    swipeStartRef.current = { x: e.touches[0]?.clientX ?? 0, y: e.touches[0]?.clientY ?? 0 };
  }, []);
  const handleSwipeEnd = useCallback((e: React.TouchEvent) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    // Don't navigate while a modal/sheet is open.
    if (start == null || showDeleteConfirm || plantFromPacketOpen || editOpen) return;
    const end = e.changedTouches[0];
    if (!end) return;
    const dx = end.clientX - start.x;
    const dy = end.clientY - start.y;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < -50 && nextId) router.push(`/vault/packets/${nextId}${contextQuery}`); // swipe left → next
    else if (dx > 50 && prevId) router.push(`/vault/packets/${prevId}${contextQuery}`); // swipe right → previous
  }, [showDeleteConfirm, plantFromPacketOpen, editOpen, nextId, prevId, router, contextQuery]);

  const handleDelete = useCallback(async () => {
    if (!pkt) return;
    setDeleting(true);
    await deletePacket(pkt.id);
    router.push(backHref);
  }, [pkt, deletePacket, router, backHref]);

  if (loading || !pkt) {
    return (
      <div className="p-6">
        {!loading && !pkt ? (
          <div>
            <Link href={backHref} className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4">
              ← Back
            </Link>
            <p className="text-neutral-600">Packet not found.</p>
          </div>
        ) : (
          <p className="text-neutral-500">Loading…</p>
        )}
      </div>
    );
  }

  const year = pkt.purchase_date ? new Date(pkt.purchase_date).getFullYear() : null;
  const vendorLabel = pkt.vendor_name?.trim() || "Unknown vendor";
  const plantTitle = profileName ? (profileVariety ? `${profileName} (${profileVariety})` : profileName) : vendorLabel;
  const isArchived = pkt.is_archived || (pkt.qty_status ?? 0) <= 0;
  const journal = journalByPacketId[pkt.id] ?? [];

  // Description: a packet's own captured vendor description takes precedence; otherwise fall back
  // to the profile's canonical description WITH attribution so the source is transparent (Option C).
  const packetDescription = (pkt.vendor_specs as { plant_description?: string } | null)?.plant_description?.trim() || null;
  const descriptionText = packetDescription ?? profileDescription;
  const descriptionFromProfile = !packetDescription && !!profileDescription;

  // Growing recs come from the profile (canonical, one set per variety). Read-only here.
  const growingRows: { label: string; value: string }[] = [
    { label: "Sun", value: profileSun || "—" },
    { label: "Spacing", value: profileSpacing || "—" },
    { label: "Days to germination", value: profileGermination || "—" },
    { label: "Days to maturity", value: profileMaturity != null ? `${profileMaturity} days` : "—" },
    { label: "Sowing depth", value: profileSowingDepth || "—" },
  ];

  const withGermination = growInstances.filter(
    (gi) => gi.seeds_sown != null && gi.seeds_sprouted != null && gi.seeds_sown > 0,
  );
  const avgGerm =
    withGermination.length >= 2
      ? Math.round(
          withGermination.reduce((sum, gi) => sum + (100 * gi.seeds_sprouted! / gi.seeds_sown!), 0) /
            withGermination.length,
        )
      : null;

  return (
    <div className="px-6 pt-2 pb-10 max-w-2xl mx-auto">
      {/* Top bar: Back (left) + framed action pills (right) — matches GrowInstanceModal chrome strip
          (VISION §8 chrome-control-framing: framed = action chrome). */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <Link href={backHref} className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline">
          ← Back
        </Link>
        <div className="flex items-center gap-1">
          <Link href={`/vault/${pkt.plant_profile_id}`} className={PILL} aria-label="View plant profile">
            Profile
          </Link>
          {canEdit && (
            <button type="button" onClick={() => setEditOpen(true)} className={PILL} aria-label="Edit packet">
              <ICON_MAP.Edit className="w-4 h-4 shrink-0" aria-hidden />
              Edit
            </button>
          )}
        </div>
      </div>

      {/* Swipe left = next, right = previous; context-aware set. Desktop = arrow buttons. */}
      <div className="relative touch-pan-y" onTouchStart={handleSwipeStart} onTouchEnd={handleSwipeEnd}>
        {prevId && (
          <Link
            href={`/vault/packets/${prevId}${contextQuery}`}
            className="absolute left-0 top-[30%] z-10 min-w-[44px] min-h-[44px] hidden md:flex items-center justify-center rounded-full bg-white/90 border border-neutral-200 text-neutral-600 shadow-sm hover:bg-white hover:text-emerald-600 -translate-y-1/2"
            aria-label="Previous packet"
          >
            <ICON_MAP.ChevronLeft className="w-6 h-6" />
          </Link>
        )}
        {nextId && (
          <Link
            href={`/vault/packets/${nextId}${contextQuery}`}
            className="absolute right-0 top-[30%] z-10 min-w-[44px] min-h-[44px] hidden md:flex items-center justify-center rounded-full bg-white/90 border border-neutral-200 text-neutral-600 shadow-sm hover:bg-white hover:text-emerald-600 -translate-y-1/2"
            aria-label="Next packet"
          >
            <ICON_MAP.ChevronRight className="w-6 h-6" />
          </Link>
        )}

      {!isOwn && householdViewMode === "family" && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          Viewing {getShorthandForUser(pkt.user_id)}&apos;s packet
        </div>
      )}

      {/* Header: hero photo (packet → profile fallback → placeholder) + plant-primary title */}
      <div className="rounded-xl bg-white border border-black/10 overflow-hidden mb-4">
        <div className="aspect-video bg-white relative flex items-center justify-center">
          {heroDisplayUrl && !heroFailed ? (
            <img src={heroDisplayUrl} alt="" className="w-full h-full object-contain" loading="lazy" onError={() => setHeroFailed(true)} />
          ) : (
            <PlantPlaceholderIcon size="xl" className="object-contain" />
          )}
        </div>
        {imageUrls.length > 1 && (
          <div className="flex flex-wrap gap-2 p-3 pt-3">
            {imageUrls.map((url, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => { setActiveImageIdx(idx); setHeroFailed(false); }}
                className={`w-14 h-14 rounded-lg overflow-hidden shrink-0 min-w-[44px] min-h-[44px] border-2 ${idx === activeImageIdx ? "border-emerald-500" : "border-transparent"} bg-neutral-100 focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                aria-label={`View photo ${idx + 1} of ${imageUrls.length}`}
              >
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="p-4">
          {/* Plant is the primary label (matches profile header); vendor + year secondary */}
          <h1 className="text-2xl font-bold text-neutral-900 break-words">{plantTitle}</h1>
          <p className="text-sm text-neutral-500 mt-0.5">
            {vendorLabel}{year != null ? ` · ${year}` : ""}
          </p>
          <div className="mt-3">
            <StarRating
              value={pkt.packet_rating ?? null}
              interactive={canEdit}
              onChange={canEdit ? (rating) => updatePacketRating(pkt.id, rating) : undefined}
              size="sm"
              label="Packet rating"
            />
          </div>
        </div>
      </div>

      {/* Plant from this packet — primary CTA (hidden once the packet is empty/archived) */}
      {canEdit && !isArchived && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => setPlantFromPacketOpen(true)}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium min-h-[44px]"
          >
            <ICON_MAP.Sprout className="w-4 h-4" aria-hidden />
            Plant from This Packet
          </button>
        </div>
      )}

      {/* Inventory */}
      <div className="rounded-xl bg-white border border-black/10 p-4 mb-4">
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">Inventory</h2>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <input
            type="date"
            aria-label="Purchase date"
            value={pkt.purchase_date ? toDateInputValue(pkt.purchase_date) : ""}
            onChange={(e) => updatePacketPurchaseDate(pkt.id, e.target.value)}
            className="w-[8.5rem] px-2 py-1 text-sm rounded border border-neutral-300 focus:ring-emerald-500"
            disabled={!canEdit}
          />
          <PacketQtyOptions value={pkt.qty_status} onChange={(v) => updatePacketQty(pkt.id, v)} variant="remaining" disabled={!canEdit} />
        </div>
        {canEdit ? (
          <>
            <div className="mb-3">
              <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Storage location</p>
              <input
                type="text"
                value={pkt.storage_location ?? ""}
                onChange={(e) => updatePacketStorageLocation(pkt.id, e.target.value, { persist: false })}
                onBlur={(e) => updatePacketStorageLocation(pkt.id, e.target.value, { persist: true })}
                placeholder="e.g. Green box, drawer"
                className="w-full px-2 py-1.5 text-sm rounded border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                aria-label="Storage location"
              />
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Your notes</p>
              <textarea
                value={pkt.user_notes ?? ""}
                onChange={(e) => updatePacketNotes(pkt.id, e.target.value, { persist: false })}
                onBlur={(e) => updatePacketNotes(pkt.id, e.target.value, { persist: true })}
                placeholder="Optional notes for this packet"
                rows={2}
                className="w-full px-2 py-1.5 text-sm rounded border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                aria-label="Packet notes"
              />
            </div>
          </>
        ) : (
          <>
            {pkt.storage_location?.trim() && (
              <div className="mb-3">
                <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Storage location</p>
                <p className="text-sm text-neutral-700">{pkt.storage_location}</p>
              </div>
            )}
            {pkt.user_notes?.trim() && (
              <div>
                <p className="text-xs font-medium uppercase text-neutral-500 mb-1">Notes</p>
                <p className="text-sm text-neutral-700">{pkt.user_notes}</p>
              </div>
            )}
          </>
        )}
        {pkt.purchase_url?.trim() && (
          <a href={pkt.purchase_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm text-emerald-600 hover:underline">
            View Purchase Link →
          </a>
        )}
      </div>

      {/* How to Grow — the variety's canonical growing recs (from the profile, read-only here).
          One set per variety; edited on the plant profile (Profile pill). */}
      <div className="rounded-xl bg-white border border-black/10 p-4 mb-4">
        <h2 className="text-sm font-semibold text-neutral-700 mb-1">How to Grow</h2>
        <p className="text-xs text-neutral-500 mb-3">Growing info for this variety. Edit it on the plant profile.</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
          {growingRows.map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-neutral-500">{label}</dt>
              <dd className="text-sm text-neutral-900 font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        {descriptionText && (
          <div className="mt-3">
            <p className="text-xs text-neutral-500">Description</p>
            <p className="text-sm text-neutral-700 whitespace-pre-wrap">{descriptionText}</p>
            {descriptionFromProfile && (
              <p className="text-xs text-neutral-500 italic mt-1">From plant profile</p>
            )}
          </div>
        )}
      </div>

      {/* Used in Instance */}
      <div className="rounded-xl bg-white border border-black/10 p-4 mb-4">
        <h2 className="text-sm font-semibold text-neutral-700 mb-2">Used in Plantings</h2>
        {growInstances.length === 0 ? (
          <p className="text-sm text-neutral-400">No plantings have used this packet yet.</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {growInstances.map((gi) => {
              const germ =
                gi.seeds_sown != null && gi.seeds_sprouted != null && gi.seeds_sown > 0
                  ? `${gi.seeds_sprouted} of ${gi.seeds_sown} sprouted`
                  : null;
              return (
                <li key={gi.id}>
                  <Link
                    href={`/garden/grow/${gi.id}?from=packet&packetId=${pkt.id}`}
                    className="flex items-center justify-between gap-2 py-2.5 min-h-[44px] hover:text-emerald-600"
                  >
                    <span className="text-sm min-w-0">
                      <span className="text-neutral-700">{formatDisplayDate(gi.sown_date)}</span>
                      {gi.location && <span className="text-neutral-500"> · {gi.location}</span>}
                      {germ && <span className="text-emerald-600 font-medium"> · {germ}</span>}
                    </span>
                    <ICON_MAP.ChevronRight className="w-4 h-4 shrink-0 text-neutral-400" aria-hidden />
                  </Link>
                </li>
              );
            })}
            {avgGerm != null && (
              <li className="text-sm font-medium text-emerald-700 pt-2">Avg germination: {avgGerm}%</li>
            )}
          </ul>
        )}
      </div>

      {/* Journal linkage */}
      <div className="rounded-xl bg-white border border-black/10 p-4 mb-4">
        <h2 className="text-sm font-semibold text-neutral-700 mb-2">Used in Journal</h2>
        {loadingJournalForPacket.has(pkt.id) ? (
          <p className="text-sm text-neutral-400">Loading…</p>
        ) : journal.length > 0 ? (
          <ul className="space-y-1.5">
            {journal.map((entry) => (
              <li key={entry.id} className="text-sm">
                <span className="text-neutral-500">{formatDisplayDate(entry.created_at)}</span>
                {entry.note?.trim() && <span className="text-neutral-800"> — {entry.note.trim()}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-neutral-400">No journal entries linked to this packet yet.</p>
        )}
      </div>

      {/* Remove */}
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 min-h-[44px]"
            aria-label="Remove packet"
          >
            <ICON_MAP.Trash className="w-4 h-4" />
            Remove Packet
          </button>
        </div>
      )}

      {/* Remove confirmation (mirrors the Delete Plant Profile dialog pattern in vault/[id]) */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" role="alertdialog" aria-modal="true" aria-labelledby="delete-packet-title">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
            <h2 id="delete-packet-title" className="text-lg font-semibold text-neutral-900 mb-2">Remove Packet?</h2>
            <p className="text-sm text-neutral-600 mb-4">This removes this seed packet from your collection. This cannot be undone.</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowDeleteConfirm(false)} disabled={deleting} className="flex-1 min-h-[44px] px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 disabled:opacity-50">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={deleting} className="flex-1 min-h-[44px] px-4 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 disabled:opacity-50">{deleting ? "Removing…" : "Remove"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Plant from this packet — pre-selects this packet in the seasonal picker */}
      <AddPlantModal
        open={plantFromPacketOpen}
        onClose={() => setPlantFromPacketOpen(false)}
        onSuccess={() => { setPlantFromPacketOpen(false); void loadPacket(); }}
        profileId={pkt.plant_profile_id}
        profileDisplayName={plantTitle}
        defaultPlantType="seasonal"
        initialPacketId={pkt.id}
      />

      {/* Edit pill → full packet editor (vendor name, price, qty, rating, date, notes, storage, tags) */}
      {editOpen && (
        <EditPacketModal
          packetId={pkt.id}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); void loadPacket(); }}
        />
      )}
      </div>
    </div>
  );
}
