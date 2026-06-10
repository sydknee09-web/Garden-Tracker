"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
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
import { SEED_PACKET_PROFILE_SELECT } from "@/lib/seedPackets";
import { useVaultPacketHandlers } from "@/app/vault/[id]/useVaultPacketHandlers";
import { getPacketImageUrls, toDateInputValue, formatDisplayDate } from "@/app/vault/[id]/vaultProfileUtils";
import type { SeedPacket, GrowInstance, VendorSpecs } from "@/types/garden";

/** The 5 single-line vendor-spec fields. plant_description (multi-line) is handled separately. */
const VENDOR_SPEC_FIELDS: { key: keyof VendorSpecs; label: string; placeholder: string }[] = [
  { key: "sowing_depth", label: "Sowing depth", placeholder: "e.g. ¼ inch deep" },
  { key: "spacing", label: "Spacing", placeholder: "e.g. 18 in apart" },
  { key: "sun_requirement", label: "Sun", placeholder: "e.g. Full sun" },
  { key: "days_to_germination", label: "Days to germination", placeholder: "e.g. 7–14 days" },
  { key: "days_to_maturity", label: "Days to maturity", placeholder: "e.g. 60–80 days" },
];

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
  const [growInstances, setGrowInstances] = useState<GrowInstance[]>([]);
  const [extraImages, setExtraImages] = useState<{ image_path: string }[]>([]);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [heroFailed, setHeroFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [plantFromPacketOpen, setPlantFromPacketOpen] = useState(false);

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
    updatePacketVendorSpec,
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
      supabase.from("plant_profiles").select("name, variety_name, hero_image_path, primary_image_path").eq("id", row.plant_profile_id).maybeSingle(),
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

    const p = prof as { name?: string; variety_name?: string | null; hero_image_path?: string | null; primary_image_path?: string | null } | null;
    setProfileName(p?.name ?? "");
    setProfileVariety(p?.variety_name?.trim() ?? "");
    setProfileHeroPath(p?.hero_image_path?.trim() || null);
    setProfilePrimaryPath(p?.primary_image_path?.trim() || null);
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
  const vs = (pkt.vendor_specs ?? {}) as VendorSpecs;
  const hasAnyVendorSpec = VENDOR_SPEC_FIELDS.some(({ key }) => vs[key]?.trim()) || !!vs.plant_description?.trim();
  const isArchived = pkt.is_archived || (pkt.qty_status ?? 0) <= 0;
  const journal = journalByPacketId[pkt.id] ?? [];

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
    <div className="px-6 pb-10 max-w-2xl mx-auto">
      <Link href={backHref} className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4">
        ← Back
      </Link>

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
          <Link
            href={`/vault/${pkt.plant_profile_id}`}
            className="inline-flex items-center gap-1 mt-2 text-sm text-emerald-600 font-medium hover:underline"
          >
            View Plant Profile
            <ICON_MAP.ChevronRight className="w-3.5 h-3.5" aria-hidden />
          </Link>
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

      {/* Vendor recommendations (vendor-specific facts for THIS packet) */}
      <div className="rounded-xl bg-white border border-black/10 p-4 mb-4">
        <h2 className="text-sm font-semibold text-neutral-700 mb-1">Vendor Recommendations</h2>
        <p className="text-xs text-neutral-500 mb-3">What this vendor says about growing this variety.</p>
        {canEdit ? (
          <div className="space-y-3">
            {!hasAnyVendorSpec && (
              <p className="text-sm text-neutral-600 italic">No vendor info captured yet — add it below.</p>
            )}
            {VENDOR_SPEC_FIELDS.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-neutral-500 mb-1">{label}</label>
                <input
                  type="text"
                  value={vs[key] ?? ""}
                  onChange={(e) => updatePacketVendorSpec(pkt.id, key, e.target.value, { persist: false })}
                  onBlur={(e) => updatePacketVendorSpec(pkt.id, key, e.target.value, { persist: true })}
                  placeholder={placeholder}
                  className="w-full px-2 py-1.5 text-sm rounded border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                  aria-label={label}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Vendor description</label>
              <textarea
                value={vs.plant_description ?? ""}
                onChange={(e) => updatePacketVendorSpec(pkt.id, "plant_description", e.target.value, { persist: false })}
                onBlur={(e) => updatePacketVendorSpec(pkt.id, "plant_description", e.target.value, { persist: true })}
                placeholder="What the vendor's listing says about this variety"
                rows={3}
                className="w-full px-2 py-1.5 text-sm rounded border border-neutral-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 min-h-[44px]"
                aria-label="Vendor description"
              />
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
            {VENDOR_SPEC_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <dt className="text-xs text-neutral-500">{label}</dt>
                <dd className="text-sm text-neutral-900 font-medium">{vs[key]?.trim() || "—"}</dd>
              </div>
            ))}
            {vs.plant_description?.trim() && (
              <div className="col-span-2 mt-1">
                <dt className="text-xs text-neutral-500">Vendor description</dt>
                <dd className="text-sm text-neutral-700 whitespace-pre-wrap">{vs.plant_description}</dd>
              </div>
            )}
          </dl>
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
                    href={`/garden/grow/${gi.id}`}
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
    </div>
  );
}
