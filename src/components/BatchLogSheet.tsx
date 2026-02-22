"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { compressImage } from "@/lib/compressImage";
import { useEscapeKey } from "@/hooks/useEscapeKey";

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
  | "water"
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
  onEndBatch: (batch: BatchLogBatch) => void;
  onDeleteBatch: (batch: BatchLogBatch) => void;
  onQuickCare: (batch: BatchLogBatch, action: "water" | "fertilize" | "spray") => void;
  onBulkQuickCare?: (batches: BatchLogBatch[], action: "water" | "fertilize" | "spray") => void;
  /** When true, hide seed-specific actions (e.g. Log germination) for permanent plants. */
  isPermanent?: boolean;
}

const CARE_NOTES: Record<string, string> = { water: "Watered", fertilize: "Fertilized", spray: "Sprayed" };

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
  onEndBatch,
  onDeleteBatch,
  onQuickCare,
  onBulkQuickCare,
  isPermanent = false,
}: BatchLogSheetProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const endBatchLongPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedActions, setSelectedActions] = useState<Set<ActionId>>(new Set());
  const [seedsSprouted, setSeedsSprouted] = useState("");
  const [plantCount, setPlantCount] = useState("");
  const [transplantLocation, setTransplantLocation] = useState("");
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [careNote, setCareNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [growthMilestonesOpen, setGrowthMilestonesOpen] = useState(false);
  const [lastWater, setLastWater] = useState<string | null>(null);
  const [lastFertilize, setLastFertilize] = useState<string | null>(null);
  const [lastSpray, setLastSpray] = useState<string | null>(null);

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
      setPhoto(null);
      setPhotoPreview(null);
      setCareNote("");
      setGrowthMilestonesOpen(false);
      setLastWater(null);
      setLastFertilize(null);
      setLastSpray(null);
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
      let w: string | null = null;
      let f: string | null = null;
      let s: string | null = null;
      for (const row of data as { note: string | null; created_at: string }[]) {
        const noteStr = n(row.note);
        if (!w && noteStr.includes("watered")) w = row.created_at;
        if (!f && noteStr.includes("fertilized")) f = row.created_at;
        if (!s && noteStr.includes("sprayed")) s = row.created_at;
      }
      if (!cancelled) {
        setLastWater(w);
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
        onBulkQuickCare(batches, action);
      } else if (firstBatch) {
        onQuickCare(firstBatch, action);
      }
      onSaved();
      onClose();
    },
    [isBulk, batches, firstBatch, onBulkQuickCare, onQuickCare, onSaved, onClose],
  );

  const handleHarvest = useCallback(() => {
    if (firstBatch) {
      onLogHarvest(firstBatch);
      onClose();
    }
  }, [firstBatch, onLogHarvest, onClose]);

  const handleEndBatch = useCallback(() => {
    if (firstBatch) {
      onEndBatch(firstBatch);
      onClose();
    }
  }, [firstBatch, onEndBatch, onClose]);

  const END_BATCH_LONG_PRESS_MS = 500;
  const startEndBatchLongPress = useCallback(() => {
    if (endBatchLongPressRef.current) return;
    endBatchLongPressRef.current = setTimeout(() => {
      endBatchLongPressRef.current = null;
      handleEndBatch();
    }, END_BATCH_LONG_PRESS_MS);
  }, [handleEndBatch]);
  const cancelEndBatchLongPress = useCallback(() => {
    if (endBatchLongPressRef.current) {
      clearTimeout(endBatchLongPressRef.current);
      endBatchLongPressRef.current = null;
    }
  }, []);

  const handleDeleteBatch = useCallback(() => {
    if (firstBatch) {
      onDeleteBatch(firstBatch);
      onClose();
    }
  }, [firstBatch, onDeleteBatch, onClose]);

  const handleSave = useCallback(async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const weather = await fetchWeatherSnapshot();
      const batch = firstBatch!;

      // Germination: update seeds_sprouted + plant_count (RLS allows when owner or has edit grant)
      if (selectedActions.has("germination") && seedsSprouted.trim()) {
        const sprouted = parseInt(seedsSprouted, 10);
        if (!Number.isNaN(sprouted) && sprouted >= 0) {
          await supabase
            .from("grow_instances")
            .update({ seeds_sprouted: sprouted, plant_count: sprouted })
            .eq("id", batch.id);
        }
      }

      // Plant count
      if (selectedActions.has("plant_count") && plantCount.trim()) {
        const count = parseInt(plantCount, 10);
        if (!Number.isNaN(count) && count >= 0) {
          await supabase.from("grow_instances").update({ plant_count: count }).eq("id", batch.id);
        }
      }

      // Transplant: plant count + location
      if (selectedActions.has("transplant")) {
        const count = plantCount.trim() ? parseInt(plantCount, 10) : null;
        const updates: Record<string, unknown> = {};
        if (count != null && !Number.isNaN(count) && count >= 0) updates.plant_count = count;
        if (transplantLocation.trim()) updates.location = transplantLocation.trim();
        if (Object.keys(updates).length > 0) {
          await supabase.from("grow_instances").update(updates).eq("id", batch.id);
        }
      }

      // Water / Fertilize / Spray with optional note
      if (selectedActions.has("water") || selectedActions.has("fertilize") || selectedActions.has("spray")) {
        const action = selectedActions.has("water") ? "water" : selectedActions.has("fertilize") ? "fertilize" : "spray";
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
      let imagePath: string | null = null;
      if (photo) {
        const { blob } = await compressImage(photo);
        const path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage.from("journal-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (!upErr) imagePath = path;
      }
      const noteTrim = note.trim() || null;
      if (noteTrim || imagePath) {
        const entries = batches.map((b) => ({
          user_id: user.id,
          plant_profile_id: b.plant_profile_id,
          grow_instance_id: b.id,
          note: noteTrim ?? "Growth update",
          entry_type: "growth" as const,
          image_file_path: imagePath,
          weather_snapshot: weather ?? undefined,
        }));
        await supabase.from("journal_entries").insert(entries);
      }

      onSaved();
      onClose();
    } catch (err) {
      console.error("BatchLogSheet save error", err);
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
    photo,
    onSaved,
    onClose,
  ]);

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhoto(file);
      const reader = new FileReader();
      reader.onload = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  }, []);

  const hasContentToSave = isBulk
    ? (selectedActions.has("note") && note.trim()) || (selectedActions.has("photo") && photo)
    : (selectedActions.has("germination") && seedsSprouted.trim()) ||
      (selectedActions.has("plant_count") && plantCount.trim()) ||
      (selectedActions.has("transplant") && (plantCount.trim() || transplantLocation.trim())) ||
      (selectedActions.has("water") || selectedActions.has("fertilize") || selectedActions.has("spray")) ||
      note.trim() ||
      !!photo;

  if (!open) return null;

  const displayName = firstBatch
    ? (firstBatch.profile_variety_name?.trim() ? `${firstBatch.profile_name} (${firstBatch.profile_variety_name})` : firstBatch.profile_name)
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4 bg-black/40" aria-modal="true" role="dialog">
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-lg border border-black/10 w-full max-w-md max-h-[85vh] flex flex-col"
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
          {/* Primary actions — Water, Fertilize, Spray */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => (isBulk ? handleQuickCareTap("water") : toggleAction("water"))}
              className="min-w-[44px] min-h-[44px] flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 hover:bg-blue-100 text-sm font-medium py-2"
            >
              <span className="flex items-center gap-1.5"><span>💧</span> Water</span>
              {!isBulk && <span className="text-[10px] font-normal text-black/50">{formatLastAction(lastWater)}</span>}
            </button>
            <button
              type="button"
              onClick={() => (isBulk ? handleQuickCareTap("fertilize") : toggleAction("fertilize"))}
              className="min-w-[44px] min-h-[44px] flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 text-sm font-medium py-2"
            >
              <span className="flex items-center gap-1.5"><span>🌿</span> Fertilize</span>
              {!isBulk && <span className="text-[10px] font-normal text-black/50">{formatLastAction(lastFertilize)}</span>}
            </button>
            <button
              type="button"
              onClick={() => (isBulk ? handleQuickCareTap("spray") : toggleAction("spray"))}
              className="min-w-[44px] min-h-[44px] flex-1 flex flex-col items-center justify-center gap-0.5 rounded-xl border border-purple-200 bg-purple-50 text-purple-600 hover:bg-purple-100 text-sm font-medium py-2"
            >
              <span className="flex items-center gap-1.5"><span>🧴</span> Spray</span>
              {!isBulk && <span className="text-[10px] font-normal text-black/50">{formatLastAction(lastSpray)}</span>}
            </button>
          </div>

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

              {/* Care note (when water/fertilize/spray selected) */}
              {(selectedActions.has("water") || selectedActions.has("fertilize") || selectedActions.has("spray")) && (
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
                <span>🧺</span> Harvest
              </button>

              {/* Quick memo + Add photo — always visible, no accordion */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-black/60 mb-1">Quick memo</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Growth update, note…"
                    rows={2}
                    className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm resize-none"
                  />
                </div>
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoChange} />
                  {photoPreview ? (
                    <div className="relative aspect-video rounded-lg overflow-hidden bg-black/5">
                      <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setPhoto(null);
                          setPhotoPreview(null);
                        }}
                        className="absolute top-2 right-2 py-1 px-2 rounded bg-black/60 text-white text-xs"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="min-w-[44px] min-h-[44px] w-full py-4 rounded-xl border border-black/10 text-black/60 hover:bg-black/5 text-sm font-medium flex items-center justify-center gap-2"
                    >
                      <span>📷</span> Add photo
                    </button>
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
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                    {photoPreview ? (
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-black/5">
                        <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            setPhoto(null);
                            setPhotoPreview(null);
                          }}
                          className="absolute top-2 right-2 py-1 px-2 rounded bg-black/60 text-white text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="min-w-[44px] min-h-[44px] w-full py-4 rounded-lg border border-black/10 text-black/60 hover:bg-black/5 text-sm"
                      >
                        Choose photo
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Administrative — End batch (long-press), Delete — single only */}
          {!isBulk && firstBatch && (
            <div className="pt-6 mt-6 border-t border-black/10 space-y-2">
              <button
                type="button"
                onTouchStart={startEndBatchLongPress}
                onTouchEnd={cancelEndBatchLongPress}
                onTouchCancel={cancelEndBatchLongPress}
                onMouseDown={startEndBatchLongPress}
                onMouseUp={cancelEndBatchLongPress}
                onMouseLeave={cancelEndBatchLongPress}
                className="w-full min-h-[44px] flex items-center gap-2 px-0 py-3 rounded-lg border border-red-200/60 text-red-600 hover:bg-red-50 text-sm font-medium"
              >
                <span>📦</span> End batch <span className="text-xs text-black/50">(hold to confirm)</span>
              </button>
              <button
                type="button"
                onClick={handleDeleteBatch}
                className="w-full min-h-[44px] flex items-center gap-2 px-0 py-3 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 text-sm font-medium"
              >
                <span>🗑</span> Delete
              </button>
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
