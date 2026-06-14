"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { compressImage } from "@/lib/compressImage";
import { SubmitLoadingOverlay } from "@/components/SubmitLoadingOverlay";
import { ICON_MAP, QUICK_ACTIONS_GRID_CLASS } from "@/lib/styleDictionary";
import { ModalCloseButton } from "@/components/ModalCloseButton";
import { localDateString } from "@/lib/calendarDate";
import { formatAddFlowError } from "@/lib/addFlowError";
import { hapticSuccess, hapticError } from "@/lib/haptics";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { SearchableMultiSelect } from "@/components/SearchableMultiSelect";
import { FormError } from "@/components/FormError";
import { logClientMetrics } from "@/lib/logClientMetrics";
import { logEvent } from "@/lib/debugLog";

type ProfileOption = { id: string; name: string; variety_name: string | null };
type SupplyOption = { id: string; name: string; brand: string | null };

type QuickActionType =
  | "sow"
  | "sprout"
  | "pot_up"
  | "plant_out"
  | "water"
  | "fertilize"
  | "spray"
  | "cold_stratify"
  | "note"
  | "growth"
  | "prune"
  | "harvest"
  | "pest";

const QUICK_ACTIONS: {
  id: QuickActionType;
  label: string;
  icon: keyof typeof ICON_MAP;
  entryType: string;
  /** When set, used as note when user leaves memo empty (seed-starting milestones) or prefixed with user input. */
  defaultNote?: string;
}[] = [
  // Row 1: Milestones (Creation)
  { id: "sow", label: "Sow", icon: "Seed", entryType: "planting", defaultNote: "Sowed" },
  { id: "sprout", label: "Sprout", icon: "Sprout", entryType: "growth", defaultNote: "First sprouts" },
  { id: "pot_up", label: "Pot up", icon: "PotUp", entryType: "care", defaultNote: "Potted up" },
  { id: "plant_out", label: "Plant out", icon: "Shovel", entryType: "care", defaultNote: "Planted out" },
  // Row 2: Routine (Maintenance)
  { id: "water", label: "Water", icon: "Water", entryType: "quick", defaultNote: "Watered" },
  { id: "fertilize", label: "Fertilize", icon: "Fertilize", entryType: "quick", defaultNote: "Fertilized" },
  { id: "spray", label: "Spray", icon: "Spray", entryType: "quick", defaultNote: "Sprayed" },
  { id: "cold_stratify", label: "Cold stratify", icon: "ColdStratify", entryType: "cold_stratify", defaultNote: "Cold stratified" },
  // Row 3: Status (Outcome/Health) — Pest has no defaultNote, requires custom note
  { id: "growth", label: "Growth", icon: "Plant", entryType: "growth" },
  { id: "prune", label: "Prune", icon: "Prune", entryType: "prune", defaultNote: "Pruned" },
  { id: "harvest", label: "Harvest", icon: "Harvest", entryType: "harvest" },
  { id: "pest", label: "Pest", icon: "Pest", entryType: "pest" },
];

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const mobileKeywords = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  return (hasTouch && mobileKeywords.test(ua)) || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export interface JournalEntryFormProps {
  /** Called both after successful save AND when the Cancel button / Close X is tapped. */
  onClose: () => void;
  /** When set (e.g. from vault/[id] Plantings tab), pre-select this plant. */
  preSelectedProfileId?: string | null;
  /** When set (e.g. from Plantings tab), attach journal entry to this grow instance for Life Story. */
  preSelectedGrowInstanceId?: string | null;
  /** When set (e.g. from the profile Packets tab journal action), link the entry to this seed packet. */
  preSelectedPacketId?: string | null;
  /** When set (e.g. from shed/[id] "I used this today"), pre-select this supply in the Supply Used dropdown. Do not pre-fill note. */
  preSelectedSupplyId?: string | null;
  /** When opening with a supply, default quick action (e.g. fertilize, spray). */
  defaultActionType?: QuickActionType;
  /** Called after a journal entry is saved successfully; parent can router.refresh(). */
  onJournalAdded?: () => void;
  /** When supply search has no results, show "+ Add New Supply" and call this with current search string for pre-fill. Parent opens QuickAddSupply. */
  onAddSupplyFromEmptyState?: (searchString?: string) => void;
  /** When this changes, refetch supplies (e.g. after user adds a supply via QuickAddSupply). */
  suppliesRefreshKey?: number;
  /** When provided, renders a Back arrow in the header (instead of the Close X). */
  onBack?: () => void;
}

/**
 * JournalEntryForm — pure form body for creating a journal entry (Quick Log).
 *
 * Two mount paths:
 *  1. Inside the <QuickLogModal> standalone shell — for non-add-button callers
 *     (vault/[id] Plantings tab, shed/[id] "I used this today", etc.). Shell provides
 *     backdrop + panel + focus trap + body scroll lock.
 *  2. Inside the <UniversalAddMenu> "journal" sub-screen (the add-button flow). Menu
 *     provides its own dialog context; no separate focus trap needed.
 *
 * The form does NOT call useBodyScrollLock — that belongs to the surrounding shell/menu
 * (single-source-of-truth).
 */
export function JournalEntryForm({
  onClose,
  preSelectedProfileId,
  preSelectedGrowInstanceId,
  preSelectedPacketId,
  preSelectedSupplyId,
  defaultActionType,
  onJournalAdded,
  onAddSupplyFromEmptyState,
  suppliesRefreshKey,
  onBack,
}: JournalEntryFormProps) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [supplies, setSupplies] = useState<SupplyOption[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [suppliesLoading, setSuppliesLoading] = useState(false);
  const [selectedSupplyIds, setSelectedSupplyIds] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<{ id: string; file: File; previewUrl: string }[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedQuickAction, setSelectedQuickAction] = useState<QuickActionType>("note");
  const [entryDate, setEntryDate] = useState(() => localDateString());
  const [isMobile, setIsMobile] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const cameraMobileRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  useEffect(() => {
    setEntryDate(localDateString());
    setNote("");
    setPhotos([]);
    setSubmitError(null);
    setSelectedSupplyIds(preSelectedSupplyId?.trim() ? new Set([preSelectedSupplyId.trim()]) : new Set());
    if (defaultActionType && (defaultActionType === "note" || QUICK_ACTIONS.some((a) => a.id === defaultActionType))) {
      setSelectedQuickAction(defaultActionType as QuickActionType);
    } else {
      setSelectedQuickAction("note");
    }
    if (preSelectedProfileId) {
      setSelectedProfileIds(new Set([preSelectedProfileId]));
    } else {
      setSelectedProfileIds(new Set());
    }
  }, [preSelectedProfileId, preSelectedGrowInstanceId, preSelectedSupplyId, defaultActionType]);

  useEffect(() => {
    if (!user?.id) {
      setProfiles([]);
      setProfilesLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setProfilesLoading(true);
      const { data } = await supabase
        .from("plant_profiles")
        .select("id, name, variety_name")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("name");
      if (!cancelled && data) setProfiles(data as ProfileOption[]);
      if (!cancelled) setProfilesLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setSupplies([]);
      setSuppliesLoading(false);
      return;
    }
    let cancelled = false;
    setSuppliesLoading(true);
    (async () => {
      const { data } = await supabase
        .from("supply_profiles")
        .select("id, name, brand")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("name");
      if (!cancelled && data) setSupplies(data as SupplyOption[]);
      if (!cancelled) setSuppliesLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user?.id, suppliesRefreshKey]);

  const stopWebcamStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setWebcamActive(false);
    setWebcamError(null);
  }, []);

  const startDesktopWebcam = useCallback(() => {
    setWebcamError(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user" }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        setWebcamActive(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => {
        setWebcamError("Camera access denied. Choose a file instead.");
        streamRef.current = null;
        fileInputRef.current?.click();
      });
  }, []);

  const handleImageSelected = useCallback((files: File | File[] | null) => {
    if (!files) {
      setPhotos([]);
      return;
    }
    const arr = Array.isArray(files) ? files : [files];
    setPhotos((prev) => {
      const next = [...prev];
      for (const f of arr) {
        next.push({ id: crypto.randomUUID(), file: f, previewUrl: URL.createObjectURL(f) });
      }
      return next;
    });
  }, []);

  const removePhoto = useCallback((id: string) => {
    setPhotos((prev) => {
      const item = prev.find((p) => p.id === id);
      if (item) URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const captureFromWebcam = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
          handleImageSelected(file);
        }
      },
      "image/jpeg",
      0.9
    );
  }, [handleImageSelected]);

  function buildNoteForEntry(quickAction: { defaultNote?: string } | undefined, noteTrim: string | null): string | null {
    const base = quickAction?.defaultNote;
    if (base && noteTrim) return `${base}. ${noteTrim}`;
    if (base) return base;
    return noteTrim ?? null;
  }

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      logEvent("form", "submit", { name: "add_journal" });
      const sessionUserId = user?.id;
      if (!sessionUserId) {
        setSubmitError("You must be signed in to save journal entries.");
        hapticError();
        return;
      }
      const noteTrim = note.trim() || null;
      const quickAction = QUICK_ACTIONS.find((a) => a.id === selectedQuickAction);
      const hasDefaultNote = quickAction?.defaultNote != null;
      if (!noteTrim && photos.length === 0 && !hasDefaultNote) {
        setSubmitError("Add a note or photo.");
        hapticError();
        return;
      }
      setSaving(true);
      setSubmitError(null);
      const weatherSnapshot = await fetchWeatherSnapshot();
      const profileIds = Array.from(selectedProfileIds);
      const plantProfileId = profileIds.length === 1 ? profileIds[0]! : profileIds.length > 0 ? profileIds[0]! : null;
      try {
        const uploadedPaths: string[] = [];
        if (photos.length > 0) {
          setUploadingPhoto(true);
          for (const p of photos) {
            const { blob } = await compressImage(p.file);
            const path = `${sessionUserId}/${crypto.randomUUID()}.jpg`;
            const { error: uploadErr } = await supabase.storage
              .from("journal-photos")
              .upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
            if (!uploadErr) uploadedPaths.push(path);
          }
          setUploadingPhoto(false);
        }
        const firstPath = uploadedPaths[0] ?? null;
        const entryType = (quickAction?.entryType ?? "note") as string;
        const noteForEntry = buildNoteForEntry(quickAction, noteTrim);
        const supplyIds = Array.from(selectedSupplyIds).filter(Boolean);
        const singleSupplyId = supplyIds.length === 1 ? supplyIds[0]! : supplyIds.length > 0 ? supplyIds[0]! : null;
        const { data: entry, error: insertErr } = await supabase
          .from("journal_entries")
          .insert({
            user_id: sessionUserId,
            plant_profile_id: plantProfileId,
            grow_instance_id: preSelectedGrowInstanceId ?? null,
            seed_packet_id: preSelectedPacketId ?? null,
            supply_profile_id: singleSupplyId ?? undefined,
            note: noteForEntry || null,
            entry_type: entryType,
            image_file_path: firstPath,
            weather_snapshot: weatherSnapshot ?? undefined,
            created_at: new Date(`${entryDate}T12:00:00Z`).toISOString(),
          } as Record<string, unknown>)
          .select("id")
          .single();
        if (insertErr) {
          logEvent("form", "error", { name: "add_journal", message: insertErr.message });
          setSubmitError(formatAddFlowError(insertErr));
          hapticError();
          return;
        }
        const entryId = (entry as { id: string })?.id;
        if (entryId && uploadedPaths.length > 0) {
          await supabase
            .from("journal_entry_photos")
            .insert(uploadedPaths.map((path, i) => ({
              journal_entry_id: entryId,
              image_file_path: path,
              sort_order: i,
              user_id: sessionUserId,
            })));
        }
        if (entryId && profileIds.length > 0) {
          const jepRows = profileIds.map((pid) => ({
            journal_entry_id: entryId,
            plant_profile_id: pid,
            user_id: sessionUserId,
          }));
          await supabase.from("journal_entry_plants").insert(jepRows);
        }
        if (entryId && supplyIds.length > 0) {
          const jesRows = supplyIds.map((sid) => ({
            journal_entry_id: entryId,
            supply_profile_id: sid,
            user_id: sessionUserId,
          }));
          const jesStart = performance.now();
          await supabase.from("journal_entry_supplies").insert(jesRows);
          logClientMetrics("journal_entry_supplies_insert", performance.now() - jesStart, { row_count: jesRows.length });
        }
        logEvent("form", "success", { name: "add_journal" });
        hapticSuccess();
        onJournalAdded?.();
        onClose();
      } catch (err) {
        logEvent("form", "error", { name: "add_journal", message: err instanceof Error ? err.message : String(err) });
        setSubmitError(formatAddFlowError(err));
        hapticError();
      } finally {
        setSaving(false);
      }
    },
    [user?.id, note, photos, selectedProfileIds, selectedQuickAction, entryDate, selectedSupplyIds, preSelectedGrowInstanceId, preSelectedPacketId, onJournalAdded, onClose]
  );

  const supplyOptions = supplies.map((s) => ({
    id: s.id,
    label: s.brand?.trim() ? `${s.name} (${s.brand})` : s.name,
  }));
  const profileOptions = profiles.map((p) => ({
    id: p.id,
    label: p.variety_name?.trim() ? `${p.name} (${p.variety_name})` : p.name,
  }));

  const canSubmit =
    (selectedQuickAction !== null && selectedQuickAction !== "note") ||
    note.trim() !== "" ||
    photos.length > 0 ||
    selectedProfileIds.size > 0;

  return (
    <form onSubmit={handleSubmit} className="relative flex-1 min-h-0 flex flex-col">
      <div className="flex-shrink-0 px-6 pt-6 pb-4">
        <div className="flex items-center gap-2">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-neutral-600 hover:bg-neutral-100"
              aria-label="Back"
            >
              <ICON_MAP.Back stroke="currentColor" className="w-5 h-5" />
            </button>
          ) : (
            <div className="w-11 shrink-0" aria-hidden />
          )}
          <h2 id="quicklog-title" className="text-xl font-bold text-neutral-900 flex-1 text-center">Add Journal</h2>
          <ModalCloseButton onClick={onClose} />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-4">
        <input
          ref={cameraMobileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          aria-label="Take photo (mobile)"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImageSelected(f);
            e.target.value = "";
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Choose file"
          multiple
          onChange={(e) => {
            const files = e.target.files;
            if (files?.length) handleImageSelected(Array.from(files));
            e.target.value = "";
          }}
        />

        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1">Date</label>
          <input
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            className="w-full rounded-xl border border-black/10 px-3 py-2 pr-12 text-sm min-h-[44px]"
          />
        </div>

        <div>
          <span className="block text-sm font-medium text-black/80 mb-2">Quick action</span>
          <div className={QUICK_ACTIONS_GRID_CLASS}>
            {QUICK_ACTIONS.map((action) => {
              const Icon = ICON_MAP[action.icon];
              const isSelected = selectedQuickAction === action.id;
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => setSelectedQuickAction(action.id)}
                  className={`min-w-[44px] min-h-[44px] shrink-0 inline-flex flex-col items-center justify-center gap-0.5 py-2 px-3 rounded-xl border text-sm font-medium transition-colors ${
                    isSelected ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-black/10 text-black/70 hover:bg-black/5"
                  }`}
                >
                  {Icon && <Icon className="w-5 h-5" />}
                  <span className="text-[10px] leading-tight">{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label htmlFor="quicklog-note" className="block text-sm font-medium text-black/80 mb-1">Quick memo</label>
          <textarea
            id="quicklog-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              selectedQuickAction === "pest"
                ? "Identify pest (e.g., Aphids, Scale) and severity..."
                : selectedQuickAction === "cold_stratify"
                  ? "Optional: duration, location (e.g., fridge, 6 weeks)…"
                  : "Notes for your entry (optional for most quick actions)…"
            }
            rows={3}
            className="w-full rounded-xl border border-black/10 px-3 py-2 text-base resize-none focus:outline-none focus:ring-2 focus:ring-emerald/40 min-h-[44px]"
          />
        </div>

        <div>
          {profilesLoading ? (
            <p className="text-sm text-neutral-500">Loading plants…</p>
          ) : (
            <SearchableMultiSelect
              options={profileOptions}
              selectedIds={selectedProfileIds}
              onChange={setSelectedProfileIds}
              placeholder="Type to search plants…"
              label="Linked plants"
              preSelectedIds={preSelectedProfileId ? [preSelectedProfileId] : undefined}
              dropdownZIndex={110}
            />
          )}
        </div>

        <div>
          <SearchableMultiSelect
            options={supplyOptions}
            selectedIds={selectedSupplyIds}
            onChange={setSelectedSupplyIds}
            placeholder="Type to search supplies…"
            label="Supply used"
            preSelectedIds={preSelectedSupplyId?.trim() ? [preSelectedSupplyId.trim()] : undefined}
            dropdownZIndex={120}
            emptyStateAction={onAddSupplyFromEmptyState ? { label: "+ Add new supply", onClick: (searchString) => onAddSupplyFromEmptyState(searchString) } : undefined}
          />
          {suppliesLoading && supplies.length === 0 && <p className="text-xs text-neutral-500 mt-1">Loading supplies…</p>}
        </div>

        <div>
          <span className="block text-sm font-medium text-black/80 mb-2">Photo</span>
          {webcamActive ? (
            <div className="space-y-2">
              <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={captureFromWebcam} className="min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-sm font-medium">
                  <ICON_MAP.Camera className="w-5 h-5 inline mr-1" /> Capture
                </button>
                <button type="button" onClick={stopWebcamStream} className="min-h-[44px] py-2.5 px-4 rounded-xl border border-teal-gus/40 text-teal-gus text-sm font-medium hover:bg-teal-gus/10">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {photos.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {photos.map((p) => (
                    <div key={p.id} className="relative w-20 h-20 rounded-lg overflow-hidden bg-black/5 flex-shrink-0">
                      <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => removePhoto(p.id)} className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold" aria-label="Remove photo">×</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => (isMobile ? cameraMobileRef.current?.click() : startDesktopWebcam())}
                  className="min-h-[44px] py-3 px-4 rounded-xl border border-teal-gus/40 text-teal-gus text-sm font-medium inline-flex items-center gap-2 hover:bg-teal-gus/10"
                >
                  <ICON_MAP.Camera className="w-5 h-5" /> Take Photo
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="min-h-[44px] py-3 px-4 rounded-xl border border-teal-gus/40 text-teal-gus text-sm font-medium inline-flex items-center gap-2 hover:bg-teal-gus/10">
                  <ICON_MAP.Gallery className="w-5 h-5" /> From Gallery
                </button>
              </div>
            </>
          )}
          {webcamError && <p className="text-xs text-amber-600 mt-1">{webcamError}</p>}
        </div>

        {submitError && <FormError>{submitError}</FormError>}
      </div>
      <div className="flex-shrink-0 px-6 py-4 border-t border-neutral-200 flex gap-2.5 justify-end">
        <button type="button" onClick={onClose} disabled={saving || uploadingPhoto} className="min-h-[44px] px-4 py-2 rounded-3xl border border-teal-gus/40 text-teal-gus font-medium hover:bg-teal-gus/10 disabled:opacity-50">
          Cancel
        </button>
        <button type="submit" disabled={saving || uploadingPhoto || !canSubmit} className="min-h-[44px] px-4 py-2 rounded-3xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {uploadingPhoto ? "Uploading…" : saving ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
              Adding…
            </>
          ) : "Add Entry"}
        </button>
      </div>
      <SubmitLoadingOverlay show={uploadingPhoto} message="Uploading…" />
    </form>
  );
}

export interface QuickLogModalProps {
  open: boolean;
  onClose: () => void;
  /** When set (e.g. from vault/[id] Plantings tab), pre-select this plant. */
  preSelectedProfileId?: string | null;
  /** When set (e.g. from Plantings tab), attach journal entry to this grow instance for Life Story. */
  preSelectedGrowInstanceId?: string | null;
  /** When set (e.g. from the profile Packets tab journal action), link the entry to this seed packet. */
  preSelectedPacketId?: string | null;
  /** When set (e.g. from shed/[id] "I used this today"), pre-select this supply in the Supply Used dropdown. Do not pre-fill note. */
  preSelectedSupplyId?: string | null;
  /** When opening with a supply, default quick action (e.g. fertilize, spray). */
  defaultActionType?: QuickActionType;
  /** Called after a journal entry is saved successfully; parent can router.refresh(). */
  onJournalAdded?: () => void;
  /** When supply search has no results, show "+ Add New Supply" and call this with current search string for pre-fill. Parent opens QuickAddSupply. */
  onAddSupplyFromEmptyState?: (searchString?: string) => void;
  /** When this changes, refetch supplies (e.g. after user adds a supply via QuickAddSupply). */
  suppliesRefreshKey?: number;
  /** When provided, renders a back-arrow that returns to the FAB menu (instead of the Close X). */
  onBackToMenu?: () => void;
}

export function QuickLogModal({ open, onClose, preSelectedProfileId, preSelectedGrowInstanceId, preSelectedPacketId, preSelectedSupplyId, defaultActionType, onJournalAdded, onAddSupplyFromEmptyState, suppliesRefreshKey, onBackToMenu }: QuickLogModalProps) {
  const trapRef = useFocusTrap(open);
  useBodyScrollLock(open);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 pb-20 sm:pb-4 bg-black/20"
      onClick={onClose}
    >
      <div
        ref={trapRef}
        className="relative rounded-3xl bg-white border border-neutral-200/80 max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.1)] animate-modal-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quicklog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <JournalEntryForm
          onClose={onClose}
          preSelectedProfileId={preSelectedProfileId}
          preSelectedGrowInstanceId={preSelectedGrowInstanceId}
          preSelectedPacketId={preSelectedPacketId}
          preSelectedSupplyId={preSelectedSupplyId}
          defaultActionType={defaultActionType}
          onJournalAdded={onJournalAdded}
          onAddSupplyFromEmptyState={onAddSupplyFromEmptyState}
          suppliesRefreshKey={suppliesRefreshKey}
          onBack={onBackToMenu}
        />
      </div>
    </div>
  );
}
