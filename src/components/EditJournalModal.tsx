"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ICON_MAP } from "@/lib/styleDictionary";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useSync } from "@/contexts/SyncContext";
import { compressImage } from "@/lib/compressImage";
import { updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { SubmitLoadingOverlay } from "@/components/SubmitLoadingOverlay";
import type { JournalEntry } from "@/types/garden";

type ProfileOption = { id: string; name: string; variety_name: string | null };

export type EditJournalEntry = JournalEntry & {
  plant_display_name?: string;
  plant_display_names?: string[];
  plant_profile_ids?: string[];
  photo_paths?: string[];
};

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const mobileKeywords = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  const narrowScreen = typeof window !== "undefined" && window.innerWidth < 768;
  return (hasTouch && mobileKeywords.test(ua)) || narrowScreen || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}


function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

type PhotoItem =
  | { type: "existing"; path: string; previewUrl: string }
  | { type: "new"; id: string; file: File; previewUrl: string };

type EditJournalModalProps = {
  entry: EditJournalEntry;
  onClose: () => void;
  onSaved: () => void;
  canEdit: boolean;
};

export function EditJournalModal({ entry, onClose, onSaved, canEdit }: EditJournalModalProps) {
  const { user } = useAuth();
  const { setSyncing } = useSync();
  const [note, setNote] = useState(entry.note ?? "");
  const [photos, setPhotos] = useState<PhotoItem[]>(() => {
    const paths = entry.photo_paths ?? (entry.image_file_path ? [entry.image_file_path] : []);
    return paths.map((path) => ({
      type: "existing" as const,
      path,
      previewUrl: supabase.storage.from("journal-photos").getPublicUrl(path).data.publicUrl,
    }));
  });
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(() => {
    const ids = entry.plant_profile_ids ?? (entry.plant_profile_id ? [entry.plant_profile_id] : []);
    return new Set(ids);
  });
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [plantSearch, setPlantSearch] = useState("");
  const cameraMobileRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const isPlantingEntry = (entry.entry_type ?? "").toLowerCase() === "planting";

  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  useEffect(() => {
    if (!user) {
      setProfiles([]);
      setProfilesLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("plant_profiles")
        .select("id, name, variety_name")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("name");
      if (!cancelled && data) setProfiles(data as ProfileOption[]);
      if (!cancelled) setProfilesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
    if (!files) return;
    const arr = Array.isArray(files) ? files : [files];
    setPhotos((prev) => {
      const next = [...prev];
      for (const f of arr) {
        const url = URL.createObjectURL(f);
        next.push({ type: "new", id: crypto.randomUUID(), file: f, previewUrl: url });
      }
      return next;
    });
  }, []);

  const removePhoto = useCallback((item: PhotoItem) => {
    setPhotos((prev) => {
      if (item.type === "new") URL.revokeObjectURL(item.previewUrl);
      return prev.filter((p) => {
        if (item.type === "existing") return p.type !== "existing" || p.path !== item.path;
        return p.type !== "new" || p.id !== item.id;
      });
    });
  }, []);

  const movePhoto = useCallback((item: PhotoItem, direction: "left" | "right") => {
    const key = item.type === "existing" ? item.path : item.id;
    setPhotos((prev) => {
      const i = prev.findIndex((p) => (p.type === "existing" ? p.path === key : p.id === key));
      if (i < 0) return prev;
      const j = direction === "left" ? i - 1 : i + 1;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }, []);

  const captureFromWebcam = useCallback(() => {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `journal-${Date.now()}.jpg`, { type: "image/jpeg" });
        handleImageSelected(file);
        stopWebcamStream();
      },
      "image/jpeg",
      0.9
    );
  }, [handleImageSelected, stopWebcamStream]);

  useEffect(() => {
    if (!webcamActive || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    return () => {
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [webcamActive]);

  const toggleProfile = (id: string) => {
    if (isPlantingEntry) return;
    setSelectedProfileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredProfiles = plantSearch.trim()
    ? profiles.filter(
        (p) =>
          p.name.toLowerCase().includes(plantSearch.trim().toLowerCase()) ||
          (p.variety_name ?? "").toLowerCase().includes(plantSearch.trim().toLowerCase())
      )
    : profiles;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !canEdit) return;
    setSubmitError(null);

    const { data: { session } } = await supabase.auth.getSession();
    const sessionUserId = session?.user?.id ?? user.id;
    if (!sessionUserId) {
      setSubmitError("You must be signed in to save.");
      return;
    }

    const noteTrim = note.trim() || null;

    if (!noteTrim && photos.length === 0) {
      setSubmitError("Add a note or photo.");
      return;
    }

    setSaving(true);
    setSyncing(true);
    try {
      const { error: updateErr } = await updateWithOfflineQueue(
        "journal_entries",
        { note: noteTrim },
        { id: entry.id, user_id: entry.user_id }
      );
      if (updateErr) {
        setSubmitError(updateErr.message);
        return;
      }

      const uploadedPaths: string[] = [];
      const newPhotos = photos.filter((p): p is PhotoItem & { type: "new" } => p.type === "new");
      if (newPhotos.length > 0) {
        setUploadingPhoto(true);
        for (const p of newPhotos) {
          const { blob } = await compressImage(p.file);
          const path = `${sessionUserId}/${crypto.randomUUID()}.jpg`;
          const { error: uploadErr } = await supabase.storage
            .from("journal-photos")
            .upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
          if (uploadErr) {
            setSubmitError(uploadErr.message);
            setUploadingPhoto(false);
            return;
          }
          uploadedPaths.push(path);
        }
        setUploadingPhoto(false);
      }

      let newIdx = 0;
      const finalPaths: string[] = photos.map((p) =>
        p.type === "existing" ? p.path : uploadedPaths[newIdx++] ?? ""
      ).filter(Boolean);

      const { error: delErr } = await supabase
        .from("journal_entry_photos")
        .delete()
        .eq("journal_entry_id", entry.id)
        .eq("user_id", entry.user_id);
      if (delErr) {
        setSubmitError(delErr.message);
        return;
      }

      if (finalPaths.length > 0) {
        const photoRows = finalPaths.map((path, i) => ({
          journal_entry_id: entry.id,
          image_file_path: path,
          sort_order: i,
          user_id: entry.user_id,
        }));
        const { error: photoErr } = await supabase.from("journal_entry_photos").insert(photoRows);
        if (photoErr) {
          setSubmitError(photoErr.message);
          return;
        }
      }

      if (!isPlantingEntry) {
        const { error: delJepErr } = await supabase
          .from("journal_entry_plants")
          .delete()
          .eq("journal_entry_id", entry.id)
          .eq("user_id", entry.user_id);
        if (delJepErr) {
          setSubmitError(delJepErr.message);
          return;
        }

        const profileIds = Array.from(selectedProfileIds);
        if (profileIds.length > 0) {
          const jepRows = profileIds.map((pid) => ({
            journal_entry_id: entry.id,
            plant_profile_id: pid,
            user_id: entry.user_id,
          }));
          const { error: jepErr } = await supabase.from("journal_entry_plants").insert(jepRows);
          if (jepErr) {
            setSubmitError(jepErr.message);
            return;
          }
        }
      }

      onSaved();
      onClose();
    } finally {
      setSyncing(false);
      setSaving(false);
    }
  }

  const plantDisplayNames = entry.plant_display_names ?? (entry.plant_display_name ? [entry.plant_display_name] : ["General"]);
  const plantProfileIds = entry.plant_profile_ids ?? (entry.plant_profile_id ? [entry.plant_profile_id] : []);

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/40"
        aria-hidden
        onClick={onClose}
      />
      <div
        className="fixed left-4 right-4 top-1/2 z-[101] -translate-y-1/2 rounded-2xl bg-white shadow-xl max-h-[85vh] flex flex-col max-w-md mx-auto overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-journal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex-shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-b border-black/10">
          <h2 id="edit-journal-title" className="text-lg font-semibold text-black">Edit entry</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-black/60 hover:bg-black/5 hover:text-black"
            aria-label="Close"
          >
            <span className="text-xl leading-none" aria-hidden>×</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="relative">
            <SubmitLoadingOverlay show={uploadingPhoto} message="Uploading…" />
            <form onSubmit={handleSubmit} className="space-y-5">
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
                <span className="block text-sm font-medium text-black/80 mb-2">Photos (optional)</span>
                {webcamActive ? (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                      <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={captureFromWebcam}
                        className="min-w-[44px] min-h-[44px] inline-flex items-center gap-2 py-2.5 px-4 rounded-xl bg-emerald text-white text-sm font-medium"
                      >
                        <ICON_MAP.Camera stroke="currentColor" className="w-[18px] h-[18px]" />
                        Capture
                      </button>
                      <button type="button" onClick={stopWebcamStream} className="min-h-[44px] py-2.5 px-4 rounded-xl border border-black/10 text-sm font-medium text-black/80">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {photos.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {photos.map((p, idx) => (
                          <div key={p.type === "existing" ? p.path : p.id} className="relative group">
                            <img src={p.previewUrl} alt="" className="w-20 h-20 rounded-lg object-cover bg-black/5" loading="lazy" />
                            {canEdit && (
                              <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 bg-black/40 rounded-lg transition-opacity">
                                <button type="button" onClick={() => movePhoto(p, "left")} disabled={idx === 0} className="min-w-[32px] min-h-[32px] rounded bg-white/90 text-black text-xs font-bold disabled:opacity-40" aria-label="Move left">‹</button>
                                <button type="button" onClick={() => removePhoto(p)} className="min-w-[32px] min-h-[32px] rounded bg-red-500 text-white text-xs font-bold" aria-label="Remove">×</button>
                                <button type="button" onClick={() => movePhoto(p, "right")} disabled={idx === photos.length - 1} className="min-w-[32px] min-h-[32px] rounded bg-white/90 text-black text-xs font-bold disabled:opacity-40" aria-label="Move right">›</button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {canEdit && (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (isMobile) cameraMobileRef.current?.click();
                            else startDesktopWebcam();
                          }}
                          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-black/10 text-sm font-medium text-black/80 hover:bg-black/5"
                        >
                          <ICON_MAP.Camera stroke="currentColor" className="w-[18px] h-[18px]" />
                          Take Photo
                        </button>
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-black/10 text-sm font-medium text-black/80 hover:bg-black/5"
                        >
                          <UploadIcon />
                          Choose from Files
                        </button>
                      </div>
                    )}
                  </>
                )}
                {webcamError && <p className="text-xs text-citrus mt-1">{webcamError}</p>}
              </div>

              <div>
                <label htmlFor="edit-journal-note" className="block text-sm font-medium text-black/80 mb-1">Note</label>
                <textarea
                  id="edit-journal-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Transplants, slope progress, weather…"
                  rows={3}
                  disabled={!canEdit}
                  className="w-full rounded-xl border border-black/10 px-3 py-2 text-base resize-none focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px] disabled:opacity-70 disabled:cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-black/80 mb-2">
                  {isPlantingEntry ? "Plants (linked at planting — read-only)" : "Plants (optional — link this entry to one or more)"}
                </label>
                {isPlantingEntry ? (
                  <div className="flex flex-wrap gap-1">
                    {plantDisplayNames.map((name, i) => (
                      <span
                        key={plantProfileIds[i] ?? i}
                        className="inline-flex items-center justify-center px-2 py-1 rounded-full bg-emerald/10 text-emerald-800 text-xs font-medium min-h-[44px]"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : profilesLoading ? (
                  <p className="text-sm text-black/50">Loading plants…</p>
                ) : profiles.length === 0 ? (
                  <p className="text-sm text-black/50">No varieties in vault.</p>
                ) : (
                  <>
                    <input
                      type="search"
                      value={plantSearch}
                      onChange={(e) => setPlantSearch(e.target.value)}
                      placeholder="Search plants…"
                      disabled={!canEdit}
                      className="w-full rounded-xl border border-black/10 px-3 py-2 text-base mb-2 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald disabled:opacity-70"
                      aria-label="Search plants"
                    />
                    <div className="max-h-[220px] overflow-y-auto overscroll-behavior-contain rounded-xl border border-black/10 divide-y divide-black/5">
                      {filteredProfiles.map((p) => (
                        <label
                          key={p.id}
                          className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-black/5 min-h-[44px]"
                        >
                          <input
                            type="checkbox"
                            checked={selectedProfileIds.has(p.id)}
                            onChange={() => toggleProfile(p.id)}
                            disabled={!canEdit}
                            className="rounded border-black/20 w-5 h-5 disabled:opacity-70"
                            aria-label={`Link to ${p.name}${p.variety_name ? ` ${p.variety_name}` : ""}`}
                          />
                          <span className="text-sm text-black">
                            {p.name}
                            {p.variety_name?.trim() ? ` — ${p.variety_name}` : ""}
                          </span>
                        </label>
                      ))}
                      {filteredProfiles.length === 0 && plantSearch.trim() && (
                        <p className="px-3 py-3 text-sm text-black/50">No plants match.</p>
                      )}
                    </div>
                    {selectedProfileIds.size > 0 && (
                      <p className="text-xs text-black/50 mt-1">
                        {selectedProfileIds.size} plant{selectedProfileIds.size !== 1 ? "s" : ""} selected.
                      </p>
                    )}
                  </>
                )}
              </div>

              {submitError && <p className="text-sm text-citrus font-medium">{submitError}</p>}

              {canEdit && (
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-black/10 text-black/80 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || uploadingPhoto}
                    className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-emerald text-white font-medium shadow-soft disabled:opacity-60"
                  >
                    {uploadingPhoto ? "Uploading…" : saving ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" aria-hidden />
                        Saving…
                      </span>
                    ) : "Save"}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
