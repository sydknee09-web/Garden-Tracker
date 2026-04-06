"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/useToast";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { compressImage } from "@/lib/compressImage";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useDesktopPhotoCapture } from "@/hooks/useDesktopPhotoCapture";
import { ICON_MAP, QUICK_ACTIONS_GRID_CLASS } from "@/lib/styleDictionary";

export type BatchLogBatch = {
  id: string;
  plant_profile_id: string;
  profile_name: string;
  profile_variety_name: string | null;
  seeds_sown?: number | null;
  seeds_sprouted?: number | null;
  plant_count?: number | null;
  location?: string | null;
  user_id?: string | null;
};

type ActionId =
  | "fertilize"
  | "spray"
  | "germination"
  | "plant_count"
  | "transplant"
  | "harvest"
  | "note"
  | "photo";

interface BatchLogSheetProps {
  open: boolean;
  batches: BatchLogBatch[];
  onClose: () => void;
  onSaved: () => void;
  onLogHarvest: (batch: BatchLogBatch) => void;
  onQuickCare: (batch: BatchLogBatch, action: "water" | "fertilize" | "spray") => void;
  onBulkQuickCare?: (batches: BatchLogBatch[], action: "water" | "fertilize" | "spray", note?: string) => void;
  /** When true, hide seed-specific actions (e.g. Log germination) for permanent plants. */
  isPermanent?: boolean;
}

const CARE_NOTES: Record<string, string> = { water: "Watered", fertilize: "Fertilized", spray: "Sprayed" };
const MAX_JOURNAL_PHOTOS = 10;

type PhotoItem = { id: string; file: File; previewUrl: string };

function formatLastAction(iso: string | null): string {
  if (!iso) return "Last: Never";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "Last: Never";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay ? `Last: ${d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : `Last: ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

export function BatchLogSheet({
  open,
  batches,
  onClose,
  onSaved,
  onLogHarvest,
  onQuickCare,
  onBulkQuickCare,
  isPermanent = false,
}: BatchLogSheetProps) {
  const { user } = useAuth();
  const { showErrorToast } = useToast();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [selectedActions, setSelectedActions] = useState<Set<ActionId>>(new Set());
  const [seedsSprouted, setSeedsSprouted] = useState("");
  const [plantCount, setPlantCount] = useState("");
  const [transplantLocation, setTransplantLocation] = useState("");
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [careNote, setCareNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [growthMilestonesOpen, setGrowthMilestonesOpen] = useState(false);
  const [lastFertilize, setLastFertilize] = useState<string | null>(null);
  const [lastSpray, setLastSpray] = useState<string | null>(null);
  const [bulkCareNote, setBulkCareNote] = useState("");

  const isBulk = batches.length > 1;
  const firstBatch = batches[0];

  useEscapeKey(open, onClose);

  // Reset form state when sheet closes so it opens fresh next time
  useEffect(() => {
    if (!open) {
      setSelectedActions(new Set());
      setSeedsSprouted("");
      setPlantCount("");
      setTransplantLocation("");
      setNote("");
      setPhotos((prev) => {
        prev.forEach((p) => { if (p.previewUrl.startsWith("blob:")) URL.revokeObjectURL(p.previewUrl); });
        return [];
      });
      setCareNote("");
      setGrowthMilestonesOpen(false);
      setLastFertilize(null);
      setLastSpray(null);
      setBulkCareNote("");
    }
  }, [open]);

  // Fetch last water/fertilize/spray for single batch
  useEffect(() => {
    if (!open || !firstBatch?.id || isBulk) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("journal_entries")
        .select("note, created_at")
        .eq("grow_instance_id", firstBatch.id)
        .eq("entry_type", "quick")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled || !data) return;
      const n = (note: string | null) => (note ?? "").toLowerCase();
      let f: string | null = null;
      let s: string | null = null;
      for (const row of data as { note: string | null; created_at: string }[]) {
        const noteStr = n(row.note);
        if (!f && noteStr.includes("fertilized")) f = row.created_at;
        if (!s && noteStr.includes("sprayed")) s = row.created_at;
      }
      if (!cancelled) {
        setLastFertilize(f);
        setLastSpray(s);
      }
    })();
    return () => { cancelled = true; };
  }, [open, firstBatch?.id, isBulk]);

  const toggleAction = useCallback((id: ActionId) => {
    setSelectedActions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleQuickCareTap = useCallback(
    (action: "water" | "fertilize" | "spray") => {
      if (isBulk && onBulkQuickCare) {
        onBulkQuickCare(batches, action, bulkCareNote.trim() || undefined);
      } else if (firstBatch) {
        onQuickCare(firstBatch, action);
      }
      onSaved();
      onClose();
    },
    [isBulk, batches, firstBatch, bulkCareNote, onBulkQuickCare, onQuickCare, onSaved, onClose],
  );

  const handleHarvest = useCallback(() => {
    if (firstBatch) {
      onLogHarvest(firstBatch);
      onClose();
    }
  }, [firstBatch, onLogHarvest, onClose]);

  const handleSave = useCallback(async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const weather = await fetchWeatherSnapshot();
      const batch = firstBatch!;
      const batchOwnerId = batch.user_id ?? user.id;

      // Germination: update seeds_sprouted + plant_count + sprout_date (RLS allows when owner or has edit grant)
      if (selectedActions.has("germination") && seedsSprouted.trim()) {
        const sprouted = parseInt(seedsSprouted, 10);
        if (!Number.isNaN(sprouted) && sprouted >= 0) {
          const today = new Date().toISOString().slice(0, 10);
          const { error: germErr } = await supabase
            .from("grow_instances")
            .update({
              seeds_sprouted: sprouted,
              plant_count: sprouted,
              sprout_date: today,
            })
            .eq("id", batch.id)
            .eq("user_id", batchOwnerId);
          if (germErr) { showErrorToast("Could not save germination. Try again."); setSaving(false); return; }
        }
      }

      // Plant count
      if (selectedActions.has("plant_count") && plantCount.trim()) {
        const count = parseInt(plantCount, 10);
        if (!Number.isNaN(count) && count >= 0) {
          const { error: pcErr } = await supabase.from("grow_instances").update({ plant_count: count }).eq("id", batch.id).eq("user_id", batchOwnerId);
          if (pcErr) { showErrorToast("Could not save plant count. Try again."); setSaving(false); return; }
        }
      }

      // Transplant: plant count + location; set status to growing if currently pending
      if (selectedActions.has("transplant")) {
        const count = plantCount.trim() ? parseInt(plantCount, 10) : null;
        const updates: Record<string, unknown> = {};
        if (count != null && !Number.isNaN(count) && count >= 0) updates.plant_count = count;
        if (transplantLocation.trim()) updates.location = transplantLocation.trim();
        // When transplanting from pending (e.g. pot up), set status to growing
        const { data: current, error: selErr } = await supabase.from("grow_instances").select("status").eq("id", batch.id).eq("user_id", batchOwnerId).single();
        if (selErr) { showErrorToast("Could not load plant status. Try again."); setSaving(false); return; }
        if (current?.status === "pending") updates.status = "growing";
        if (Object.keys(updates).length > 0) {
          const { error: transErr } = await supabase.from("grow_instances").update(updates).eq("id", batch.id).eq("user_id", batchOwnerId);
          if (transErr) { showErrorToast("Could not save transplant. Try again."); setSaving(false); return; }
        }
      }

      // Fertilize / Spray with optional note
      if (selectedActions.has("fertilize") || selectedActions.has("spray")) {
        const action = selectedActions.has("fertilize") ? "fertilize" : "spray";
        const noteText = careNote.trim() || CARE_NOTES[action];
        await supabase.from("journal_entries").insert({
          user_id: user.id,
          plant_profile_id: batch.plant_profile_id,
          grow_instance_id: batch.id,
          note: noteText,
          entry_type: "quick",
          weather_snapshot: weather ?? undefined,
        });
      }

      // Note / Photo journal entry — single batch or all batches in bulk
      const uploadedPaths: string[] = [];
      for (const p of photos) {
        const { blob } = await compressImage(p.file);
        const path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from("journal-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
        if (!upErr) uploadedPaths.push(path);
      }
      const firstPath = uploadedPaths[0] ?? null;
      const noteTrim = note.trim() || null;
      if (noteTrim || firstPath) {
        if (batches.length === 1) {
          const b = batches[0];
          const { data: entry, error: insErr } = await supabase.from("journal_entries").insert({
            user_id: user.id,
            plant_profile_id: b.plant_profile_id,
            grow_instance_id: b.id,
            note: noteTrim ?? "Growth update",
            entry_type: "growth" as const,
            image_file_path: firstPath,
            weather_snapshot: weather ?? undefined,
          }).select("id").single();
          if (!insErr && entry) {
            const entryId = (entry as { id: string }).id;
            await supabase.from("journal_entry_plants").insert({ journal_entry_id: entryId, plant_profile_id: b.plant_profile_id, user_id: user.id });
            if (uploadedPaths.length > 0) {
              await supabase.from("journal_entry_photos").insert(uploadedPaths.map((path, i) => ({ journal_entry_id: entryId, image_file_path: path, sort_order: i, user_id: user.id })));
            }
          }
        } else {
          const { data: entry, error: insErr } = await supabase.from("journal_entries").insert({
            user_id: user.id,
            plant_profile_id: null,
            grow_instance_id: null,
            note: noteTrim ?? "Growth update",
            entry_type: "growth" as const,
            image_file_path: firstPath,
            weather_snapshot: weather ?? undefined,
          }).select("id").single();
          if (!insErr && entry) {
            const entryId = (entry as { id: string }).id;
            await supabase.from("journal_entry_plants").insert(batches.map((b) => ({ journal_entry_id: entryId, plant_profile_id: b.plant_profile_id, user_id: user.id })));
            if (uploadedPaths.length > 0) {
              await supabase.from("journal_entry_photos").insert(uploadedPaths.map((path, i) => ({ journal_entry_id: entryId, image_file_path: path, sort_order: i, user_id: user.id })));
            }
          }
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error("BatchLogSheet save error", err);
      showErrorToast("Something went wrong. Try again.");
    } finally {
      setSaving(false);
    }
  }, [
    user?.id,
    firstBatch,
    batches,
    selectedActions,
    seedsSprouted,
    plantCount,
    transplantLocation,
    careNote,
    note,
    photos,
    onSaved,
    onClose,
    showErrorToast,
  ]);

  const handleCameraPhoto = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && photos.length < MAX_JOURNAL_PHOTOS) {
      setPhotos((prev) => [...prev, { id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }]);
    }
    e.target.value = "";
  }, [photos.length]);

  const handleGalleryPhotos = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) {
      const toAdd = Array.from(files)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, MAX_JOURNAL_PHOTOS - photos.length);
      setPhotos((prev) => [...prev, ...toAdd.map((f) => ({ id: crypto.randomUUID(), file: f, previewUrl: URL.createObjectURL(f) }))]);
    }
    e.target.value = "";
  }, [photos.length]);

  const addPhotoFromFile = useCallback((file: File) => {
    setPhotos((prev) => (prev.length >= MAX_JOURNAL_PHOTOS ? prev : [...prev, { id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) }]));
  }, []);
  const batchLogWebcam = useDesktopPhotoCapture(addPhotoFromFile);
  const handleTakePhotoClick = useCallback(() => {
    if (batchLogWebcam.isMobile) cameraInputRef.current?.click();
    else batchLogWebcam.startWebcam();
  }, [batchLogWebcam.isMobile, batchLogWebcam.startWebcam]);

  const hasContentToSave = isBulk
    ? (selectedActions.has("note") && note.trim()) || (selectedActions.has("photo") && photos.length > 0)
    : (selectedActions.has("germination") && seedsSprouted.trim()) ||
      (selectedActions.has("plant_count") && plantCount.trim()) ||
      (selectedActions.has("transplant") && (plantCount.trim() || transplantLocation.trim())) ||
      (selectedActions.has("fertilize") || selectedActions.has("spray")) ||
      note.trim() ||
      photos.length > 0;

  const displayName = !firstBatch
    ? ""
    : firstBatch.profile_variety_name?.trim()
      ? `${firstBatch.profile_name} (${firstBatch.profile_variety_name})`
      : firstBatch.profile_name;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center pb-20 sm:pb-4 sm:items-center sm:p-4 bg-black/40" aria-modal="true" role="dialog">
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-lg border border-black/10 w-full max-w-md max-h-[70vh] sm:max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between p-4 border-b border-black/10 shrink-0">
          <h2 className="text-lg font-semibold text-black">
            {isBulk ? `Log for ${batches.length} plants` : "Log"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-black/60 hover:bg-black/5"
            aria-label="Close"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </header>

        {!isBulk && firstBatch && (
          <div className="px-4 pb-2">
            <p className="text-sm text-black/60">{displayName}</p>
            {firstBatch.location?.trim() && (
              <p className="text-xs text-black/50 mt-0.5">{firstBatch.location.trim()}</p>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 pt-6 space-y-6">
          {/* Hidden file inputs — always in DOM so refs work in both single and bulk */}
          <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraPhoto} aria-hidden />
          <input ref={galleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryPhotos} aria-hidden />
          {/* 1. Quick Actions row — 2-row grid so all icons visible on mobile without scroll */}
          <div>
            <span className="block text-xs font-medium text-black/60 mb-2">Quick action</span>
            <div className={QUICK_ACTIONS_GRID_CLASS}>
              <button
                type="button"
                onClick={() => handleQuickCareTap("water")}
                className="min-w-[44px] min-h-[44px] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100 text-sm font-medium py-2"
              >
                <ICON_MAP.Water className="w-5 h-5" />
                <span className="text-[10px]">Water</span>
              </button>
              <button
                type="button"
                onClick={() => (isBulk ? handleQuickCareTap("fertilize") : toggleAction("fertilize"))}
                className={`min-w-[44px] min-h-[44px] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-xl border text-sm font-medium py-2 ${
                  selectedActions.has("fertilize") ? "border-amber-300 bg-amber-100 text-amber-700" : "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
                }`}
              >
                <ICON_MAP.Fertilize className="w-5 h-5" />
                <span className="text-[10px]">Fertilize</span>
                {!isBulk && <span className="text-[10px] font-normal text-black/50">{formatLastAction(lastFertilize)}</span>}
              </button>
              <button
                type="button"
                onClick={() => (isBulk ? handleQuickCareTap("spray") : toggleAction("spray"))}
                className={`min-w-[44px] min-h-[44px] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-xl border text-sm font-medium py-2 ${
                  selectedActions.has("spray") ? "border-purple-300 bg-purple-100 text-purple-700" : "border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100"
                }`}
              >
                <ICON_MAP.Spray className="w-5 h-5" />
                <span className="text-[10px]">Spray</span>
                {!isBulk && <span className="text-[10px] font-normal text-black/50">{formatLastAction(lastSpray)}</span>}
              </button>
              <button
                type="button"
                onClick={handleHarvest}
                className="min-w-[44px] min-h-[44px] shrink-0 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-sm font-medium py-2"
              >
                <ICON_MAP.Harvest className="w-5 h-5" />
                <span className="text-[10px]">Harvest</span>
              </button>
            </div>
          </div>

          {isBulk && (
            <div>
              <label className="block text-xs font-medium text-black/60 mb-1">Optional note (for Fertilize/Spray)</label>
              <input
                type="text"
                value={bulkCareNote}
                onChange={(e) => setBulkCareNote(e.target.value)}
                placeholder="e.g. Watered all 3, With fish emulsion"
                className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
              />
            </div>
          )}

          {!isBulk && (
            <>
              {/* Growth milestones — collapsible */}
              {!isPermanent && (
                <div>
                  <button
                    type="button"
                    onClick={() => setGrowthMilestonesOpen((o) => !o)}
                    className="w-full min-h-[44px] flex items-center justify-between px-0 py-3 text-sm font-medium text-black/80 hover:text-black border-b border-black/5"
                  >
                    <span>Growth milestones</span>
                    <span aria-hidden>{growthMilestonesOpen ? "▴" : "▾"}</span>
                  </button>
                  {growthMilestonesOpen && (
                    <div className="pt-2 space-y-1 divide-y divide-black/5">
                      {/* Log germination */}
                      <div className="pt-3 first:pt-0">
                        <button
                          type="button"
                          onClick={() => toggleAction("germination")}
                          className={`w-full min-h-[44px] flex items-center justify-between px-0 py-2 text-sm font-medium ${
                            selectedActions.has("germination") ? "text-emerald-700" : "text-black/80 hover:text-black"
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            Log germination
                            {firstBatch?.seeds_sprouted != null ? (
                              <span className="text-xs font-normal text-emerald-600">✓ Logged</span>
                            ) : (
                              <span className="text-xs font-normal text-black/50">Not yet logged</span>
                            )}
                          </span>
                          <span aria-hidden>{selectedActions.has("germination") ? "▴" : "▾"}</span>
                        </button>
                        {selectedActions.has("germination") && (
                          <div className="mt-2">
                            <label className="block text-xs font-medium text-black/60 mb-1">How many sprouted?</label>
                            <input
                              type="number"
                              min={0}
                              value={seedsSprouted}
                              onChange={(e) => setSeedsSprouted(e.target.value)}
                              placeholder={firstBatch?.seeds_sown != null ? `of ${firstBatch.seeds_sown}` : "e.g. 10"}
                              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                            />
                          </div>
                        )}
                      </div>

                      {/* Update plant count */}
                      <div className="pt-3">
                        <button
                          type="button"
                          onClick={() => toggleAction("plant_count")}
                          className={`w-full min-h-[44px] flex items-center justify-between px-0 py-2 text-sm font-medium ${
                            selectedActions.has("plant_count") ? "text-emerald-700" : "text-black/80 hover:text-black"
                          }`}
                        >
                          Update plant count
                          <span aria-hidden>{selectedActions.has("plant_count") ? "▴" : "▾"}</span>
                        </button>
                        {selectedActions.has("plant_count") && (
                          <div className="mt-2">
                            <label className="block text-xs font-medium text-black/60">How many plants now?</label>
                            <input
                              type="number"
                              min={0}
                              value={plantCount}
                              onChange={(e) => setPlantCount(e.target.value)}
                              placeholder="e.g. Thinned to 5, gave 2 away"
                              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                            />
                          </div>
                        )}
                      </div>

                      {/* Transplant */}
                      <div className="pt-3">
                        <button
                          type="button"
                          onClick={() => toggleAction("transplant")}
                          className={`w-full min-h-[44px] flex items-center justify-between px-0 py-2 text-sm font-medium ${
                            selectedActions.has("transplant") ? "text-emerald-700" : "text-black/80 hover:text-black"
                          }`}
                        >
                          Transplant
                          <span aria-hidden>{selectedActions.has("transplant") ? "▴" : "▾"}</span>
                        </button>
                        {selectedActions.has("transplant") && (
                          <div className="mt-2 space-y-2">
                            <input
                              type="number"
                              min={0}
                              value={plantCount}
                              onChange={(e) => setPlantCount(e.target.value)}
                              placeholder="Plant count"
                              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                            />
                            <input
                              type="text"
                              value={transplantLocation}
                              onChange={(e) => setTransplantLocation(e.target.value)}
                              placeholder="New location"
                              className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Care note (when fertilize/spray selected) */}
              {(selectedActions.has("fertilize") || selectedActions.has("spray")) && (
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1">Optional note</label>
                  <input
                    type="text"
                    value={careNote}
                    onChange={(e) => setCareNote(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm"
                  />
                </div>
              )}

              {/* Harvest — secondary milestone, always visible */}
              <button
                type="button"
                onClick={handleHarvest}
                className="w-full min-h-[44px] flex items-center gap-2 px-0 py-3 rounded-lg border-b border-black/5 text-emerald-700 hover:bg-emerald-50/50 text-sm font-medium"
              >
                <ICON_MAP.Harvest className="w-5 h-5" /> Harvest
              </button>

              {/* 2. Quick memo */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1">Quick memo</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Growth update, note…"
                    rows={2}
                    className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm resize-none"
                  />
                </div>
                {/* 3. Photo row */}
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1">Photo (max {MAX_JOURNAL_PHOTOS})</label>
                  {batchLogWebcam.webcamActive ? (
                    <div className="space-y-2">
                      <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                        <video ref={batchLogWebcam.videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={batchLogWebcam.captureFromWebcam} className="min-h-[44px] min-w-[44px] py-2.5 px-4 rounded-xl bg-emerald text-white text-sm font-medium flex items-center gap-2">
                          <ICON_MAP.Camera className="w-5 h-5" />
                          Capture
                        </button>
                        <button type="button" onClick={batchLogWebcam.stopWebcam} className="min-h-[44px] py-2.5 px-4 rounded-xl border border-black/10 text-sm font-medium text-black/80">Cancel</button>
                      </div>
                    </div>
                  ) : photos.length > 0 ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {photos.map((p) => (
                          <div key={p.id} className="relative w-20 h-20 rounded-lg overflow-hidden bg-black/5">
                            <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setPhotos((prev) => { const x = prev.find((i) => i.id === p.id); if (x?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(x.previewUrl); return prev.filter((i) => i.id !== p.id); })}
                              className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                      {photos.length < MAX_JOURNAL_PHOTOS && (
                        <div className="flex gap-2">
                          <button type="button" onClick={handleTakePhotoClick} className="min-h-[44px] py-2 px-3 rounded-xl border border-black/10 text-black/80 text-sm font-medium flex items-center gap-2">
                            <ICON_MAP.Camera className="w-5 h-5" />
                            Take photo
                          </button>
                          <button type="button" onClick={() => galleryInputRef.current?.click()} className="min-h-[44px] py-2 px-3 rounded-xl bg-emerald text-white text-sm font-medium flex items-center gap-2">
                            <ICON_MAP.Gallery className="w-5 h-5" />
                            From gallery
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {batchLogWebcam.webcamError && <p className="text-sm text-amber-600">{batchLogWebcam.webcamError}</p>}
                      <div className="flex gap-2">
                        <button type="button" onClick={handleTakePhotoClick} className="min-w-[44px] min-h-[44px] flex-1 py-4 rounded-xl border border-black/10 text-black/60 hover:bg-black/5 text-sm font-medium flex items-center justify-center gap-2">
                          <ICON_MAP.Camera className="w-5 h-5" />
                          Take photo
                        </button>
                        <button type="button" onClick={() => galleryInputRef.current?.click()} className="min-w-[44px] min-h-[44px] flex-1 py-4 rounded-xl border border-black/10 text-black/60 hover:bg-black/5 text-sm font-medium flex items-center justify-center gap-2">
                          <ICON_MAP.Gallery className="w-5 h-5" />
                          From gallery
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </>
          )}

          {isBulk && (
            <div className="space-y-1 divide-y divide-black/5">
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => toggleAction("note")}
                  className={`w-full min-h-[44px] flex items-center justify-between px-0 py-2 text-sm font-medium ${
                    selectedActions.has("note") ? "text-emerald-700" : "text-black/80 hover:text-black"
                  }`}
                >
                  Add note
                  <span aria-hidden>{selectedActions.has("note") ? "▴" : "▾"}</span>
                </button>
                {selectedActions.has("note") && (
                  <div className="mt-2">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Note for all selected…"
                      rows={3}
                      className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm resize-none"
                    />
                  </div>
                )}
              </div>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => toggleAction("photo")}
                  className={`w-full min-h-[44px] flex items-center justify-between px-0 py-2 text-sm font-medium ${
                    selectedActions.has("photo") ? "text-emerald-700" : "text-black/80 hover:text-black"
                  }`}
                >
                  Add photo
                  <span aria-hidden>{selectedActions.has("photo") ? "▴" : "▾"}</span>
                </button>
                {selectedActions.has("photo") && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-black/60 mb-1">Photo (max {MAX_JOURNAL_PHOTOS})</label>
                    {batchLogWebcam.webcamActive ? (
                      <div className="space-y-2">
                        <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                          <video ref={batchLogWebcam.videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        </div>
                        <div className="flex gap-2">
                          <button type="button" onClick={batchLogWebcam.captureFromWebcam} className="min-h-[44px] min-w-[44px] py-2.5 px-4 rounded-xl bg-emerald text-white text-sm font-medium">Capture</button>
                          <button type="button" onClick={batchLogWebcam.stopWebcam} className="min-h-[44px] py-2.5 px-4 rounded-xl border border-black/10 text-sm font-medium text-black/80">Cancel</button>
                        </div>
                      </div>
                    ) : photos.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {photos.map((p) => (
                            <div key={p.id} className="relative w-20 h-20 rounded-lg overflow-hidden bg-black/5">
                              <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                              <button type="button" onClick={() => setPhotos((prev) => { const x = prev.find((i) => i.id === p.id); if (x?.previewUrl.startsWith("blob:")) URL.revokeObjectURL(x.previewUrl); return prev.filter((i) => i.id !== p.id); })} className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">×</button>
                            </div>
                          ))}
                        </div>
                        {photos.length < MAX_JOURNAL_PHOTOS && (
                          <div className="flex gap-2">
                            <button type="button" onClick={handleTakePhotoClick} className="min-h-[44px] py-2 px-3 rounded-lg border border-black/10 text-black/80 text-sm font-medium">
                              <ICON_MAP.Camera className="w-5 h-5" />
                              Take photo
                            </button>
                            <button type="button" onClick={() => galleryInputRef.current?.click()} className="min-h-[44px] py-2 px-3 rounded-lg bg-emerald text-white text-sm font-medium">
                              <ICON_MAP.Gallery className="w-5 h-5" />
                              From gallery
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {batchLogWebcam.webcamError && <p className="text-sm text-amber-600">{batchLogWebcam.webcamError}</p>}
                        <div className="flex gap-2">
                          <button type="button" onClick={handleTakePhotoClick} className="min-w-[44px] min-h-[44px] flex-1 py-4 rounded-xl border border-black/10 text-black/60 hover:bg-black/5 text-sm font-medium flex items-center justify-center gap-2">
                            <ICON_MAP.Camera className="w-5 h-5" />
                            Take photo
                          </button>
                          <button type="button" onClick={() => galleryInputRef.current?.click()} className="min-w-[44px] min-h-[44px] flex-1 py-4 rounded-xl border border-black/10 text-black/60 hover:bg-black/5 text-sm font-medium flex items-center justify-center gap-2">
                            <ICON_MAP.Gallery className="w-5 h-5" />
                            From gallery
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
        {/* Save button — when we have content to save */}
        {hasContentToSave && (
          <footer className="p-4 border-t border-black/10 shrink-0">
            <button
              type="button"
              disabled={saving || !hasContentToSave}
              onClick={handleSave}
              className="w-full min-h-[48px] rounded-xl bg-emerald text-white font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Log"}
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
