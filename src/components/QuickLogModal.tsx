"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { compressImage } from "@/lib/compressImage";
import { SubmitLoadingOverlay } from "@/components/SubmitLoadingOverlay";
import { ICON_MAP } from "@/lib/styleDictionary";
import { localDateString } from "@/lib/calendarDate";
import { hapticSuccess, hapticError } from "@/lib/haptics";

type ProfileOption = { id: string; name: string; variety_name: string | null };

type QuickActionType = "note" | "growth" | "planting" | "harvest" | "water" | "fertilize" | "spray" | "pest";

const QUICK_ACTIONS: { id: QuickActionType; label: string; icon: keyof typeof ICON_MAP; entryType: string }[] = [
  { id: "note", label: "Note", icon: "ManualEntry", entryType: "note" },
  { id: "growth", label: "Growth", icon: "Plant", entryType: "growth" },
  { id: "planting", label: "Planting", icon: "Plant", entryType: "planting" },
  { id: "harvest", label: "Harvest", icon: "Harvest", entryType: "harvest" },
  { id: "water", label: "Water", icon: "Water", entryType: "quick" },
  { id: "fertilize", label: "Fertilize", icon: "Fertilize", entryType: "quick" },
  { id: "spray", label: "Spray", icon: "Spray", entryType: "quick" },
  { id: "pest", label: "Pest", icon: "Pest", entryType: "pest" },
];

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const mobileKeywords = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  return (hasTouch && mobileKeywords.test(ua)) || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export interface QuickLogModalProps {
  open: boolean;
  onClose: () => void;
  /** When set (e.g. from vault/[id]), pre-select this plant and hide search. */
  preSelectedProfileId?: string | null;
  /** When set (e.g. from shed/[id] "I used this today"), pre-fill supply and link the created entry to this supply. */
  preSelectedSupplyId?: string | null;
  /** Optional supply display name for default note e.g. "Used Miracle-Gro". */
  preSelectedSupplyName?: string | null;
  /** When opening with a supply, default quick action (e.g. fertilize, spray). */
  defaultActionType?: QuickActionType;
  /** Called after a journal entry is saved successfully; parent can router.refresh(). */
  onJournalAdded?: () => void;
}

export function QuickLogModal({ open, onClose, preSelectedProfileId, preSelectedSupplyId, preSelectedSupplyName, defaultActionType, onJournalAdded }: QuickLogModalProps) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<{ id: string; file: File; previewUrl: string }[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [selectedQuickAction, setSelectedQuickAction] = useState<QuickActionType>("note");
  const [entryDate, setEntryDate] = useState(() => localDateString());
  const [plantSearch, setPlantSearch] = useState("");
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
    if (!open) return;
    setEntryDate(localDateString());
    setNote(preSelectedSupplyName?.trim() ? `Used ${preSelectedSupplyName.trim()}` : "");
    setPhotos([]);
    setSubmitError(null);
    if (defaultActionType && QUICK_ACTIONS.some((a) => a.id === defaultActionType)) {
      setSelectedQuickAction(defaultActionType);
    } else {
      setSelectedQuickAction("note");
    }
    if (preSelectedProfileId) {
      setSelectedProfileIds(new Set([preSelectedProfileId]));
    } else {
      setSelectedProfileIds(new Set());
    }
  }, [open, preSelectedProfileId, preSelectedSupplyName, defaultActionType]);

  useEffect(() => {
    if (!open || !user?.id) {
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
  }, [open, user?.id]);

  useEffect(() => {
    if (!open || !preSelectedProfileId || profiles.length === 0) return;
    const exists = profiles.some((p) => p.id === preSelectedProfileId);
    if (exists) setSelectedProfileIds(new Set([preSelectedProfileId]));
  }, [open, preSelectedProfileId, profiles]);

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

  const toggleProfile = useCallback((id: string) => {
    setSelectedProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const filteredProfiles = profiles.filter(
    (p) =>
      !plantSearch.trim() ||
      (p.name?.toLowerCase().includes(plantSearch.toLowerCase()) ?? false) ||
      (p.variety_name?.toLowerCase().includes(plantSearch.toLowerCase()) ?? false)
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const sessionUserId = user?.id;
      if (!sessionUserId) {
        setSubmitError("You must be signed in to save journal entries.");
        hapticError();
        return;
      }
      const noteTrim = note.trim() || null;
      if (!noteTrim && photos.length === 0) {
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
        let firstPath: string | null = null;
        if (photos.length > 0) {
          setUploadingPhoto(true);
          const { blob } = await compressImage(photos[0].file);
          const path = `${sessionUserId}/${crypto.randomUUID()}.jpg`;
          const { error: uploadErr } = await supabase.storage
            .from("journal-photos")
            .upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
          if (uploadErr) {
            setSubmitError(uploadErr.message);
            hapticError();
            return;
          }
          firstPath = path;
          setUploadingPhoto(false);
        }
        const quickAction = QUICK_ACTIONS.find((a) => a.id === selectedQuickAction);
        const entryType = (quickAction?.entryType ?? "note") as string;
        const isQuickCare = entryType === "quick";
        const noteForEntry = isQuickCare
          ? (selectedQuickAction === "water" ? "Watered" : selectedQuickAction === "fertilize" ? "Fertilized" : "Sprayed") + (noteTrim ? `. ${noteTrim}` : "")
          : noteTrim;
        const supplyId = preSelectedSupplyId?.trim() || null;
        const { data: entry, error: insertErr } = await supabase
          .from("journal_entries")
          .insert({
            user_id: sessionUserId,
            plant_profile_id: plantProfileId,
            grow_instance_id: null,
            seed_packet_id: null,
            supply_profile_id: supplyId ?? undefined,
            note: noteForEntry || null,
            entry_type: entryType,
            image_file_path: firstPath,
            weather_snapshot: weatherSnapshot ?? undefined,
            created_at: new Date(`${entryDate}T12:00:00Z`).toISOString(),
          } as Record<string, unknown>)
          .select("id")
          .single();
        if (insertErr) {
          setSubmitError(insertErr.message);
          hapticError();
          return;
        }
        const entryId = (entry as { id: string })?.id;
        if (entryId && profileIds.length > 0) {
          const jepRows = profileIds.map((pid) => ({
            journal_entry_id: entryId,
            plant_profile_id: pid,
            user_id: sessionUserId,
          }));
          await supabase.from("journal_entry_plants").insert(jepRows);
        }
        hapticSuccess();
        onJournalAdded?.();
        onClose();
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Failed to save");
        hapticError();
      } finally {
        setSaving(false);
      }
    },
    [user?.id, note, photos, selectedProfileIds, selectedQuickAction, entryDate, preSelectedSupplyId, onJournalAdded, onClose]
  );

  if (!open) return null;

  const hidePlantSearch = !!preSelectedProfileId && selectedProfileIds.size > 0;

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/20" aria-hidden onClick={onClose} />
      <div
        className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-[101] rounded-3xl bg-white border border-neutral-200/80 p-6 max-w-md mx-auto max-h-[85vh] overflow-y-auto shadow-[0_10px_30px_rgba(0,0,0,0.1)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quicklog-title"
      >
        <div className="flex items-center gap-2 mb-4">
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-neutral-600 hover:bg-neutral-100"
            aria-label="Close"
          >
            <ICON_MAP.Close className="w-5 h-5" />
          </button>
          <h2 id="quicklog-title" className="text-xl font-bold text-neutral-900 flex-1 text-center">Quick Log</h2>
        </div>

        <SubmitLoadingOverlay show={saving || uploadingPhoto} message="Saving…" />
        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm min-h-[44px]"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-black/80 mb-2">Quick action</span>
            <div className="grid grid-cols-4 gap-2">
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
              placeholder="Transplants, progress, weather…"
              rows={3}
              className="w-full rounded-xl border border-black/10 px-3 py-2 text-base resize-none focus:outline-none focus:ring-2 focus:ring-emerald/40 min-h-[44px]"
            />
          </div>

          <div>
            <span className="block text-sm font-medium text-black/80 mb-2">Photo (optional)</span>
            {webcamActive ? (
              <div className="space-y-2">
                <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={captureFromWebcam} className="min-h-[44px] py-2.5 px-4 rounded-xl bg-emerald-600 text-white text-sm font-medium">
                    <ICON_MAP.Camera className="w-5 h-5 inline mr-1" /> Capture
                  </button>
                  <button type="button" onClick={stopWebcamStream} className="min-h-[44px] py-2.5 px-4 rounded-xl border border-black/10 text-sm font-medium">
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
                    className="min-h-[44px] py-3 px-4 rounded-xl border border-black/10 text-sm font-medium inline-flex items-center gap-2"
                  >
                    <ICON_MAP.Camera className="w-5 h-5" /> Take Photo
                  </button>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="min-h-[44px] py-3 px-4 rounded-xl border border-black/10 text-sm font-medium inline-flex items-center gap-2">
                    <ICON_MAP.Gallery className="w-5 h-5" /> From gallery
                  </button>
                </div>
              </>
            )}
            {webcamError && <p className="text-xs text-amber-600 mt-1">{webcamError}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-black/80 mb-2">Linked plants</label>
            {profilesLoading ? (
              <p className="text-sm text-neutral-500">Loading…</p>
            ) : hidePlantSearch ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 px-3 py-2">
                {profiles.filter((p) => selectedProfileIds.has(p.id)).map((p) => (
                  <p key={p.id} className="text-sm text-emerald-900">
                    {p.name}{p.variety_name?.trim() ? ` (${p.variety_name})` : ""}
                  </p>
                ))}
              </div>
            ) : (
              <>
                <input
                  type="search"
                  value={plantSearch}
                  onChange={(e) => setPlantSearch(e.target.value)}
                  placeholder="Search plants…"
                  className="w-full rounded-xl border border-black/10 px-3 py-2 text-sm mb-2 min-h-[44px]"
                  aria-label="Search plants"
                />
                <div className="max-h-[160px] overflow-y-auto rounded-xl border border-black/10 divide-y divide-black/5">
                  {filteredProfiles.map((p) => (
                    <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-black/5 min-h-[44px]">
                      <input
                        type="checkbox"
                        checked={selectedProfileIds.has(p.id)}
                        onChange={() => toggleProfile(p.id)}
                        className="rounded border-black/20 w-5 h-5"
                      />
                      <span className="text-sm text-black">{p.name}{p.variety_name?.trim() ? ` — ${p.variety_name}` : ""}</span>
                    </label>
                  ))}
                  {filteredProfiles.length === 0 && plantSearch.trim() && <p className="px-3 py-3 text-sm text-neutral-500">No plants match.</p>}
                </div>
              </>
            )}
          </div>

          {submitError && <p className="text-sm text-red-600 font-medium" role="alert">{submitError}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-black/10 text-black/80 font-medium">
              Cancel
            </button>
            <button type="submit" disabled={saving || uploadingPhoto} className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-emerald-600 text-white font-medium disabled:opacity-60">
              {uploadingPhoto ? "Uploading…" : saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
