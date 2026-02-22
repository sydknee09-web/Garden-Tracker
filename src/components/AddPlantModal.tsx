"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { compressImage } from "@/lib/compressImage";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { copyCareTemplatesToInstance } from "@/lib/generateCareTasks";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useFocusTrap } from "@/hooks/useFocusTrap";

type ProfileOption = { id: string; name: string; variety_name: string | null; profile_type: string };
type PacketOption = { id: string; vendor_name: string | null; qty_status: number; is_archived?: boolean };

export function AddPlantModal({
  open,
  onClose,
  onSuccess,
  /** When set, pre-selects plant type and filters "Link to existing" by that type. */
  defaultPlantType = "seasonal",
  /** When true, do not redirect to vault after add (e.g. when opened from Garden). */
  stayInGarden = false,
  /** When true, hide the Permanent/Seasonal toggle (e.g. when opened from Garden — type is inferred from tab). */
  hidePlantTypeToggle = false,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  defaultPlantType?: "permanent" | "seasonal";
  stayInGarden?: boolean;
  hidePlantTypeToggle?: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useFocusTrap(open);
  useEscapeKey(open, onClose);

  const [plantType, setPlantType] = useState<"permanent" | "seasonal">(defaultPlantType);
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [plantName, setPlantName] = useState("");
  const [variety, setVariety] = useState("");
  const [vendor, setVendor] = useState("");
  const [nursery, setNursery] = useState("");
  const [notes, setNotes] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [plantedDate, setPlantedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [quantity, setQuantity] = useState(1);
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichmentFailed, setEnrichmentFailed] = useState(false);
  const [createdProfileId, setCreatedProfileId] = useState<string | null>(null);

  // Packet selection for "link existing" seasonal
  const [packetsForProfile, setPacketsForProfile] = useState<PacketOption[]>([]);
  const [selectedPacketId, setSelectedPacketId] = useState<string>("");
  const [showAddPacketInline, setShowAddPacketInline] = useState(false);
  const [addPacketVendor, setAddPacketVendor] = useState("");
  const [addPacketSaving, setAddPacketSaving] = useState(false);

  const profileTypeFilter = plantType === "permanent" ? "permanent" : "seed";

  const loadProfiles = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("plant_profiles")
      .select("id, name, variety_name, profile_type")
      .eq("user_id", user.id)
      .eq("profile_type", profileTypeFilter)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(150);
    setProfiles((data ?? []) as ProfileOption[]);
    setSelectedProfileId((data ?? []).length > 0 ? (data as ProfileOption[])[0].id : "");
  }, [user?.id, profileTypeFilter]);

  useEffect(() => {
    if (open && user?.id) loadProfiles();
  }, [open, user?.id, loadProfiles]);

  useEffect(() => {
    setPlantType(defaultPlantType);
  }, [defaultPlantType, open]);

  const loadPacketsForProfile = useCallback(async (profileId: string) => {
    if (!user?.id || plantType !== "seasonal") return;
    const { data } = await supabase
      .from("seed_packets")
      .select("id, vendor_name, qty_status, is_archived")
      .eq("plant_profile_id", profileId)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .or("is_archived.eq.false,is_archived.is.null")
      .order("created_at", { ascending: true });
    const list = (data ?? []) as PacketOption[];
    setPacketsForProfile(list);
    setSelectedPacketId(list.length > 0 ? list[0].id : "");
    setShowAddPacketInline(false);
  }, [user?.id, plantType]);

  useEffect(() => {
    if (selectedProfileId && plantType === "seasonal") loadPacketsForProfile(selectedProfileId);
    else { setPacketsForProfile([]); setSelectedPacketId(""); setShowAddPacketInline(false); }
  }, [selectedProfileId, plantType, loadPacketsForProfile]);

  useEffect(() => {
    const urls = photoFiles.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photoFiles]);

  const addPhoto = useCallback((files: FileList | null) => {
    if (!files?.length) return;
    setPhotoFiles((prev) => [...prev, ...Array.from(files)]);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }, []);

  const removePhoto = useCallback((index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const resetForm = useCallback(() => {
    setMode("new");
    setSelectedProfileId("");
    setPacketsForProfile([]);
    setSelectedPacketId("");
    setShowAddPacketInline(false);
    setAddPacketVendor("");
    setPlantName("");
    setVariety("");
    setVendor("");
    setNursery("");
    setNotes("");
    setPhotoFiles([]);
    setPlantedDate(new Date().toISOString().slice(0, 10));
    setQuantity(1);
    setLocation("");
    setError(null);
    setEnrichmentFailed(false);
    setCreatedProfileId(null);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    resetForm();
  }, [onClose, resetForm]);

  const handleAddPacketInline = useCallback(async () => {
    if (!user?.id || !selectedProfileId) return;
    setAddPacketSaving(true);
    const vendor = addPacketVendor.trim() || null;
    const { data: newPkt, error } = await supabase
      .from("seed_packets")
      .insert({ user_id: user.id, plant_profile_id: selectedProfileId, qty_status: 100, vendor_name: vendor })
      .select("id, vendor_name, qty_status")
      .single();
    setAddPacketSaving(false);
    if (error) { setError(error.message); return; }
    const pkt = newPkt as PacketOption;
    setPacketsForProfile((prev) => [...prev, pkt]);
    setSelectedPacketId(pkt.id);
    setAddPacketVendor("");
    setShowAddPacketInline(false);
  }, [user?.id, selectedProfileId, addPacketVendor]);

  const handleSubmit = async () => {
    if (!user?.id) return;
    setError(null);
    setSubmitting(true);

    try {
      let profileId: string;

      if (mode === "existing") {
        if (!selectedProfileId) {
          setError("Select a variety.");
          setSubmitting(false);
          hapticError();
          return;
        }
        profileId = selectedProfileId;
      } else {
        const name = plantName.trim();
        if (!name) {
          setError("Plant name is required.");
          setSubmitting(false);
          hapticError();
          return;
        }
        const { data: insertRow, error: insertErr } = await supabase
          .from("plant_profiles")
          .insert({
            user_id: user.id,
            name,
            variety_name: variety.trim() || null,
            profile_type: plantType,
            status: "active",
            growing_notes: notes.trim() || null,
            purchase_date: plantedDate || null,
            purchase_vendor: plantType === "seasonal" ? (vendor.trim() || null) : null,
            purchase_nursery: nursery.trim() || null,
          })
          .select("id")
          .single();
        if (insertErr) {
          setError(insertErr.message);
          setSubmitting(false);
          return;
        }
        profileId = (insertRow as { id: string }).id;
        setCreatedProfileId(profileId);

        const plantCount = plantType === "permanent" ? Math.max(1, parseInt(String(quantity), 10) || 1) : 1;
        const { data: growRow, error: growInsertErr } = await supabase
          .from("grow_instances")
          .insert({
            user_id: user.id,
            plant_profile_id: profileId,
            sown_date: plantedDate,
            expected_harvest_date: null,
            status: "growing",
            seed_packet_id: null,
            location: location.trim() || null,
            plant_count: plantCount,
          })
          .select("id")
          .single();
        if (growInsertErr) {
          setError(growInsertErr.message);
          setSubmitting(false);
          return;
        }
        const growInstanceIdNew = (growRow as { id: string }).id;

        // Upload photos: first sets hero; all create journal entries (Law 7, no overwrite)
        let heroPath: string | null = null;
        for (let i = 0; i < photoFiles.length; i++) {
          const file = photoFiles[i];
          const { blob } = await compressImage(file);
          const path = `${user.id}/plant-${profileId}-${crypto.randomUUID().slice(0, 8)}.jpg`;
          const { error: uploadErr } = await supabase.storage
            .from("journal-photos")
            .upload(path, blob, { contentType: "image/jpeg", upsert: false });
          if (uploadErr) continue;
          if (i === 0) heroPath = path;
          await supabase.from("journal_entries").insert({
            user_id: user.id,
            plant_profile_id: profileId,
            grow_instance_id: growInstanceIdNew,
            seed_packet_id: null,
            note: i === 0 ? (plantType === "permanent" ? "Planted (permanent plant)." : "Planted (store-bought).") : null,
            entry_type: i === 0 ? "planting" : "growth",
            image_file_path: path,
          });
        }
        if (heroPath) {
          await supabase.from("plant_profiles").update({ hero_image_path: heroPath, hero_image_url: null }).eq("id", profileId).eq("user_id", user.id);
        }

        if (plantType === "seasonal") {
          await copyCareTemplatesToInstance(profileId, growInstanceIdNew, user.id, plantedDate);
          const { data: pRow } = await supabase.from("plant_profiles").select("harvest_days").eq("id", profileId).single();
          const hDays = (pRow as { harvest_days?: number | null })?.harvest_days;
          const expHarvest = hDays != null && hDays > 0 ? new Date(new Date(plantedDate).getTime() + hDays * 86400000).toISOString().slice(0, 10) : null;
          const displayNameNew = variety.trim() ? `${name} (${variety.trim()})` : name;
          await supabase.from("tasks").insert({
            user_id: user.id,
            plant_profile_id: profileId,
            grow_instance_id: growInstanceIdNew,
            category: "sow",
            due_date: plantedDate,
            completed_at: new Date().toISOString(),
            title: `Sow ${displayNameNew}`,
          });
          if (expHarvest) {
            await supabase.from("tasks").insert({
              user_id: user.id,
              plant_profile_id: profileId,
              grow_instance_id: growInstanceIdNew,
              category: "harvest",
              due_date: expHarvest,
              title: `Harvest ${displayNameNew}`,
            });
          }
        }

        // Enrichment for new seasonal profiles (sun, spacing, etc.)
        if (plantType === "seasonal") {
          const needsEnrichment = true;
          const needsHero = photoFiles.length === 0;
          let enriched = false;

          if (needsEnrichment) {
            const enrichRes = await fetch("/api/seed/enrich-from-name", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, variety: variety.trim() }),
            });
            const enrichData = (await enrichRes.json()) as { enriched?: boolean; sun?: string; plant_spacing?: string; days_to_germination?: string; harvest_days?: number; sowing_depth?: string; source_url?: string };
            if (enrichData.enriched && enrichData) {
              enriched = true;
              const updates: Record<string, unknown> = {};
              if (enrichData.sun != null) updates.sun = enrichData.sun;
              if (enrichData.plant_spacing != null) updates.plant_spacing = enrichData.plant_spacing;
              if (enrichData.days_to_germination != null) updates.days_to_germination = enrichData.days_to_germination;
              if (enrichData.harvest_days != null) updates.harvest_days = enrichData.harvest_days;
              if (enrichData.sowing_depth != null) updates.sowing_method = enrichData.sowing_depth;
              if (Object.keys(updates).length > 0) {
                await supabase.from("plant_profiles").update(updates).eq("id", profileId).eq("user_id", user.id);
              }
            }
          }

          if (needsHero) {
            const heroRes = await fetch("/api/seed/find-hero-photo", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name, variety: variety.trim(), vendor: vendor.trim() }),
            });
            const heroData = (await heroRes.json()) as { hero_image_url?: string; error?: string };
            const heroUrl = heroData.hero_image_url?.trim();
            if (heroUrl) {
              await supabase.from("plant_profiles").update({ hero_image_url: heroUrl }).eq("id", profileId).eq("user_id", user.id);
            }
          }

          if (needsEnrichment && !enriched) setEnrichmentFailed(true);
        }
      }

      if (mode === "existing") {
        const plantCount = plantType === "permanent" ? Math.max(1, parseInt(String(quantity), 10) || 1) : Math.max(1, parseInt(String(quantity), 10) || 1);
        let primaryPacketId: string | null = null;

        if (plantType === "seasonal") {
          if (packetsForProfile.length > 0 && selectedPacketId) {
            primaryPacketId = selectedPacketId;
          } else if (packetsForProfile.length === 0) {
            const { data: newPkt, error: pktErr } = await supabase
              .from("seed_packets")
              .insert({ user_id: user.id, plant_profile_id: profileId, qty_status: 100, vendor_name: null })
              .select("id")
              .single();
            if (pktErr || !newPkt) {
              setError(pktErr?.message ?? "Could not create seed packet.");
              setSubmitting(false);
              return;
            }
            primaryPacketId = (newPkt as { id: string }).id;
            await supabase.from("seed_packets").update({ qty_status: 0, is_archived: true }).eq("id", primaryPacketId).eq("user_id", user.id);
          }
        }

        const { data: profileRow } = await supabase.from("plant_profiles").select("harvest_days").eq("id", profileId).single();
        const harvestDays = (profileRow as { harvest_days?: number | null })?.harvest_days;
        const expectedHarvestDate = harvestDays != null && harvestDays > 0
          ? new Date(new Date(plantedDate).getTime() + harvestDays * 86400000).toISOString().slice(0, 10)
          : null;

        const { data: growRow, error: growErr } = await supabase.from("grow_instances").insert({
          user_id: user.id,
          plant_profile_id: profileId,
          sown_date: plantedDate,
          expected_harvest_date: expectedHarvestDate,
          status: "growing",
          seed_packet_id: primaryPacketId,
          location: location.trim() || null,
          plant_count: plantCount,
        }).select("id").single();
        if (growErr || !growRow) {
          setError(growErr?.message ?? "Could not create planting.");
          setSubmitting(false);
          return;
        }
        const growId = (growRow as { id: string }).id;

        if (primaryPacketId && plantType === "seasonal" && packetsForProfile.length > 0) {
          await supabase.from("seed_packets").update({ qty_status: 0, is_archived: true }).eq("id", primaryPacketId).eq("user_id", user.id);
        }

        const weather = await fetchWeatherSnapshot();
        const profile = profiles.find((p) => p.id === profileId);
        const displayName = profile?.variety_name?.trim() ? `${profile.name} (${profile.variety_name})` : profile?.name ?? "Planted";
        await supabase.from("journal_entries").insert({
          user_id: user.id,
          plant_profile_id: profileId,
          grow_instance_id: growId,
          note: `Planted ${displayName}`,
          entry_type: "planting",
          weather_snapshot: weather ?? undefined,
        });

        if (plantType === "seasonal") {
          await copyCareTemplatesToInstance(profileId, growId, user.id, plantedDate);
        }

        const nowIso = new Date().toISOString();
        await supabase.from("tasks").insert({
          user_id: user.id,
          plant_profile_id: profileId,
          grow_instance_id: growId,
          category: "sow",
          due_date: plantedDate,
          completed_at: nowIso,
          title: `Sow ${displayName}`,
        });
        if (expectedHarvestDate) {
          await supabase.from("tasks").insert({
            user_id: user.id,
            plant_profile_id: profileId,
            grow_instance_id: growId,
            category: "harvest",
            due_date: expectedHarvestDate,
            title: `Harvest ${displayName}`,
          });
        }

        await supabase.from("plant_profiles").update({ status: "active" }).eq("id", profileId).eq("user_id", user.id);
      }

      hapticSuccess();
      onSuccess?.();
      if (enrichmentFailed) {
        setSubmitting(false);
        return;
      }
      handleClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      hapticError();
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-labelledby="add-plant-title">
        <div ref={modalRef} className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden" tabIndex={-1}>
          <div className="flex-shrink-0 p-4 border-b border-neutral-200">
            <h2 id="add-plant-title" className="text-lg font-semibold text-neutral-900">{hidePlantTypeToggle ? (plantType === "permanent" ? "Add permanent plant" : "Add to Active Garden") : "Add Plant"}</h2>
            <p className="text-sm text-neutral-500 mt-1">{hidePlantTypeToggle ? (plantType === "permanent" ? "Add trees, perennials, or other long-lived plants." : "Link to an existing variety or add a new one.") : "Add a new plant — permanent (trees, perennials) or seasonal (annuals)."}</p>
            {!hidePlantTypeToggle && (
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setPlantType("permanent")}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${plantType === "permanent" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
                >
                  Permanent
                </button>
                <button
                  type="button"
                  onClick={() => setPlantType("seasonal")}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${plantType === "seasonal" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
                >
                  Seasonal
                </button>
              </div>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${mode === "existing" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
              >
                Link to existing
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${mode === "new" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
              >
                Create new
              </button>
            </div>

            {mode === "existing" ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="add-plant-profile" className="block text-sm font-medium text-neutral-700 mb-1">Variety</label>
                  <select
                    id="add-plant-profile"
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.variety_name?.trim() ? `${p.name} — ${p.variety_name}` : p.name}
                      </option>
                    ))}
                    {profiles.length === 0 && <option value="">No {plantType === "permanent" ? "permanent" : "seasonal"} plants yet</option>}
                  </select>
                </div>
                {plantType === "seasonal" && selectedProfileId && (
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Seed packet</label>
                    {packetsForProfile.length > 0 ? (
                      <div className="space-y-2">
                        <select
                          value={selectedPacketId}
                          onChange={(e) => setSelectedPacketId(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                        >
                          {packetsForProfile.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.vendor_name?.trim() || "Unnamed"} ({p.qty_status}%)
                            </option>
                          ))}
                        </select>
                        {!showAddPacketInline ? (
                          <button type="button" onClick={() => setShowAddPacketInline(true)} className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                            + Add packet
                          </button>
                        ) : (
                          <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50 space-y-2">
                            <input
                              type="text"
                              value={addPacketVendor}
                              onChange={(e) => setAddPacketVendor(e.target.value)}
                              placeholder="Vendor (optional)"
                              className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm"
                            />
                            <div className="flex gap-2">
                              <button type="button" onClick={() => { setShowAddPacketInline(false); setAddPacketVendor(""); }} className="text-sm text-neutral-600">Cancel</button>
                              <button type="button" onClick={handleAddPacketInline} disabled={addPacketSaving} className="text-sm font-medium text-emerald-600">{addPacketSaving ? "Adding…" : "Add"}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-neutral-500">No packets. Add one to track this planting.</p>
                        {!showAddPacketInline ? (
                          <button type="button" onClick={() => setShowAddPacketInline(true)} className="min-h-[44px] px-3 py-2 rounded-lg border border-emerald-300 text-emerald-700 font-medium text-sm hover:bg-emerald-50">
                            + Add packet
                          </button>
                        ) : (
                          <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50 space-y-2">
                            <input
                              type="text"
                              value={addPacketVendor}
                              onChange={(e) => setAddPacketVendor(e.target.value)}
                              placeholder="Vendor (optional)"
                              className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm"
                            />
                            <div className="flex gap-2">
                              <button type="button" onClick={() => { setShowAddPacketInline(false); setAddPacketVendor(""); }} className="text-sm text-neutral-600">Cancel</button>
                              <button type="button" onClick={handleAddPacketInline} disabled={addPacketSaving} className="text-sm font-medium text-emerald-600">{addPacketSaving ? "Adding…" : "Add"}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="add-plant-name" className="block text-sm font-medium text-neutral-700 mb-1">Plant name *</label>
                  <input
                    id="add-plant-name"
                    type="text"
                    value={plantName}
                    onChange={(e) => setPlantName(e.target.value)}
                    placeholder={plantType === "permanent" ? "e.g. Avocado Tree, Rose" : "e.g. Tomato, Basil"}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="add-plant-variety" className="block text-sm font-medium text-neutral-700 mb-1">Variety</label>
                  <input
                    id="add-plant-variety"
                    type="text"
                    value={variety}
                    onChange={(e) => setVariety(e.target.value)}
                    placeholder={plantType === "permanent" ? "e.g. Hass, Cecile Brunner" : "e.g. Cherokee Purple, Genovese"}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                {plantType === "seasonal" && (
                  <div>
                    <label htmlFor="add-plant-vendor" className="block text-sm font-medium text-neutral-700 mb-1">Vendor</label>
                    <input
                      id="add-plant-vendor"
                      type="text"
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      placeholder="e.g. Bonnie Plants, Burpee"
                      className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                    />
                  </div>
                )}
                <div>
                  <label htmlFor="add-plant-nursery" className="block text-sm font-medium text-neutral-700 mb-1">Nursery</label>
                  <input
                    id="add-plant-nursery"
                    type="text"
                    value={nursery}
                    onChange={(e) => setNursery(e.target.value)}
                    placeholder={plantType === "permanent" ? "e.g. Briggs Tree Nursery, Home Depot" : "e.g. Armstrong, Home Depot"}
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  {plantType === "seasonal" && <p className="text-xs text-neutral-500 mt-1">Vendor and nursery are for your records. We use plant + variety only to find details and a photo.</p>}
                </div>
                <div>
                  <label htmlFor="add-plant-notes" className="block text-sm font-medium text-neutral-700 mb-1">Notes (optional)</label>
                  <textarea
                    id="add-plant-notes"
                    rows={3}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Where it's planted, age, any notes..."
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Photos (optional)</label>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    className="hidden"
                    aria-label="Take or add photo"
                    onChange={(e) => addPhoto(e.target.files)}
                  />
                  <div className="flex flex-wrap gap-2">
                    {photoPreviews.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} alt="" className="h-20 w-20 object-cover rounded-lg border border-neutral-200" />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute -top-1 -right-1 min-w-[44px] min-h-[44px] rounded-full bg-red-500 text-white text-xs flex items-center justify-center leading-none -m-2 p-2"
                          aria-label="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="min-h-[80px] w-20 flex items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 text-neutral-500 hover:border-emerald-500 hover:text-emerald-600 text-2xl min-w-[44px]"
                      aria-label="Take or add another photo"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">First photo becomes the profile hero. All appear in the journal.</p>
                </div>
              </>
            )}

            <div>
              <label htmlFor="add-plant-date" className="block text-sm font-medium text-neutral-700 mb-1">{plantType === "seasonal" ? "Purchase date" : "Date planted"}</label>
              <input
                id="add-plant-date"
                type="date"
                value={plantedDate}
                onChange={(e) => setPlantedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            {(plantType === "permanent" || mode === "existing") && (
              <div>
                <label htmlFor="add-plant-qty" className="block text-sm font-medium text-neutral-700 mb-1">Quantity</label>
                <input
                  id="add-plant-qty"
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                  aria-label="Number of plants"
                />
              </div>
            )}
            <div>
              <label htmlFor="add-plant-location" className="block text-sm font-medium text-neutral-700 mb-1">Location (optional)</label>
              <input
                id="add-plant-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Bed 2, Patio"
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
          </div>
          <div className="flex-shrink-0 p-4 border-t border-neutral-200 flex gap-3 justify-end">
            <button type="button" onClick={handleClose} disabled={submitting} className="min-h-[44px] px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting || (mode === "new" && !plantName.trim())} className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50">
              {submitting ? "Adding…" : "Add Plant"}
            </button>
          </div>
        </div>
      </div>

      {enrichmentFailed && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-labelledby="enrichment-failed-title">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
            <h2 id="enrichment-failed-title" className="text-lg font-semibold text-neutral-900 mb-2">Details couldn&apos;t be loaded</h2>
            <p className="text-sm text-neutral-600 mb-4">
              We couldn&apos;t find growing details for this plant. You can add them now or edit the profile later.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setEnrichmentFailed(false);
                  if (createdProfileId && !stayInGarden) router.push(`/vault/${createdProfileId}`);
                  handleClose();
                }}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700"
              >
                Add details now
              </button>
              <button
                type="button"
                onClick={() => {
                  setEnrichmentFailed(false);
                  handleClose();
                  router.refresh();
                }}
                className="min-h-[44px] px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50"
              >
                I&apos;ll do it later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
