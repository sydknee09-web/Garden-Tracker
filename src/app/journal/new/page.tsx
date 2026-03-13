"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useSync } from "@/contexts/SyncContext";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { compressImage } from "@/lib/compressImage";
import { SubmitLoadingOverlay } from "@/components/SubmitLoadingOverlay";
import { ICON_MAP } from "@/lib/styleDictionary";

type ProfileOption = { id: string; name: string; variety_name: string | null };

type QuickActionType = "note" | "growth" | "planting" | "harvest" | "water" | "fertilize" | "spray" | "pest";

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const mobileKeywords = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  const narrowScreen = typeof window !== "undefined" && window.innerWidth < 768;
  return (hasTouch && mobileKeywords.test(ua)) || narrowScreen || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

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

export default function JournalNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromGarden = searchParams.get("from") === "garden";
  const { user } = useAuth();
  const { setSyncing } = useSync();
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [note, setNote] = useState("");
  type PhotoItem = { id: string; file: File; previewUrl: string };
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [webcamActive, setWebcamActive] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);
  const [plantSearch, setPlantSearch] = useState("");
  const [selectedQuickAction, setSelectedQuickAction] = useState<QuickActionType>("note");
  const cameraMobileRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  const plantIdFromUrl = searchParams.get("plant_id") ?? searchParams.get("profile") ?? null;

  useEffect(() => {
    if (!plantIdFromUrl || profiles.length === 0) return;
    const exists = profiles.some((p) => p.id === plantIdFromUrl);
    if (exists) setSelectedProfileIds(new Set([plantIdFromUrl]));
  }, [plantIdFromUrl, profiles]);

  const isPlantSpecific = !!plantIdFromUrl && selectedProfileIds.size > 0;

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
        const url = URL.createObjectURL(f);
        next.push({ id: crypto.randomUUID(), file: f, previewUrl: url });
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
    if (!user) return;
    setSubmitError(null);

    const { data: { session } } = await supabase.auth.getSession();
    const sessionUserId = session?.user?.id ?? user.id;
    if (!sessionUserId) {
      setSubmitError("You must be signed in to save journal entries.");
      return;
    }

    const noteTrim = note.trim() || null;

    if (!noteTrim && photos.length === 0) {
      setSubmitError("Add a note or photo.");
      return;
    }

    setSaving(true);
    setSyncing(true);
    const weatherSnapshot = await fetchWeatherSnapshot();
    const profileIds = Array.from(selectedProfileIds);
    const plantProfileId = profileIds.length === 1 ? profileIds[0] : null;
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
          if (uploadErr) {
            setSubmitError(uploadErr.message);
            setUploadingPhoto(false);
            return;
          }
          uploadedPaths.push(path);
        }
        setUploadingPhoto(false);
      }
      const firstPath = uploadedPaths[0] ?? null;
      const quickAction = QUICK_ACTIONS.find((a) => a.id === selectedQuickAction);
      const entryType = (quickAction?.entryType ?? "note") as string;
      const isQuickCare = entryType === "quick";
      const noteForEntry = isQuickCare
        ? (selectedQuickAction === "water" ? "Watered" : selectedQuickAction === "fertilize" ? "Fertilized" : "Sprayed") + (noteTrim ? `. ${noteTrim}` : "")
        : noteTrim;
      const { data: entry, error: insertErr } = await supabase
        .from("journal_entries")
        .insert({
          user_id: sessionUserId,
          plant_profile_id: plantProfileId,
          grow_instance_id: null,
          seed_packet_id: null,
          note: noteForEntry || null,
          entry_type: entryType,
          image_file_path: firstPath,
          weather_snapshot: weatherSnapshot ?? undefined,
        } as Record<string, unknown>)
        .select("id")
        .single();
      if (insertErr) {
        setSubmitError(insertErr.message);
        return;
      }
      const entryId = (entry as { id: string })?.id;
      if (entryId && profileIds.length > 0) {
        const jepRows = profileIds.map((pid) => ({
          journal_entry_id: entryId,
          plant_profile_id: pid,
          user_id: sessionUserId,
        }));
        const { error: jepErr } = await supabase.from("journal_entry_plants").insert(jepRows);
        if (jepErr) {
          setSubmitError(jepErr.message);
          return;
        }
      }
      if (entryId && uploadedPaths.length > 0) {
        const photoRows = uploadedPaths.map((path, i) => ({
          journal_entry_id: entryId,
          image_file_path: path,
          sort_order: i,
          user_id: sessionUserId,
        }));
        const { error: photoErr } = await supabase.from("journal_entry_photos").insert(photoRows);
        if (photoErr) {
          setSubmitError(photoErr.message);
          return;
        }
      }
    } finally {
      setSyncing(false);
      setSaving(false);
    }
    router.push(fromGarden ? "/garden" : "/journal");
  }

  if (!user) {
    return (
      <div className="px-6 py-8">
        <p className="text-black/70">Sign in to add journal entries.</p>
        <Link href={fromGarden ? "/garden" : "/journal"} className="text-emerald-600 font-medium mt-2 inline-block">
          ← Back to {fromGarden ? "Garden" : "Journal"}
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 pb-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <Link
          href={fromGarden ? "/garden" : "/journal"}
          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-black/10 text-black/80 font-medium"
          aria-label={fromGarden ? "Back to Garden" : "Back to Journal"}
        >
          ← {fromGarden ? "Garden" : "Journal"}
        </Link>
        <h1 className="text-xl font-semibold text-black">Add Journal Entry</h1>
      </div>
      <p className="text-sm text-neutral-500 mb-6">For a quick note, use <strong>Add → Add journal</strong> from any page.</p>

      <div className="relative">
        <SubmitLoadingOverlay show={saving || uploadingPhoto} message="Saving…" />
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

        {/* 1. Quick Actions row — 2-row grid so all icons visible on mobile without scroll */}
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

        {/* 2. Quick Memo */}
        <div>
          <label htmlFor="journal-note-new" className="block text-sm font-medium text-black/80 mb-1">
            Quick memo
          </label>
          <textarea
            id="journal-note-new"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Transplants, slope progress, weather…"
            rows={3}
            className="w-full rounded-xl border border-black/10 px-3 py-2 text-base resize-none focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald min-h-[44px]"
          />
        </div>

        {/* 3. Photo row */}
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
                  <ICON_MAP.Camera className="w-5 h-5" />
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
                  {photos.map((p) => (
                    <div key={p.id} className="relative w-20 h-20 rounded-lg overflow-hidden bg-black/5 flex-shrink-0">
                      <img src={p.previewUrl} alt="" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(p.id)}
                        className="absolute top-0.5 right-0.5 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold hover:bg-red-600"
                        aria-label="Remove photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (isMobile) cameraMobileRef.current?.click();
                    else startDesktopWebcam();
                  }}
                  className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-black/10 text-sm font-medium text-black/80 hover:bg-black/5"
                >
                  <ICON_MAP.Camera className="w-5 h-5" />
                  Take Photo
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-black/10 text-sm font-medium text-black/80 hover:bg-black/5"
                >
                  <ICON_MAP.Gallery className="w-5 h-5" />
                  From gallery
                </button>
              </div>
            </>
          )}
          {webcamError && <p className="text-xs text-citrus mt-1">{webcamError}</p>}
        </div>

        {/* 4. Linked Plants (at bottom) */}
        <div>
          <label className="block text-sm font-medium text-black/80 mb-2">Linked plants (optional)</label>
          {profilesLoading ? (
            <p className="text-sm text-black/50">Loading plants…</p>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-black/50">No varieties in vault. Add seeds first.</p>
          ) : isPlantSpecific ? (
            <div className="rounded-xl border border-black/10 px-3 py-2 bg-black/[0.02]">
              {profiles.filter((p) => selectedProfileIds.has(p.id)).map((p) => (
                <p key={p.id} className="text-sm text-black">
                  Linked: {p.name}{p.variety_name?.trim() ? ` (${p.variety_name})` : ""}
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
                className="w-full rounded-xl border border-black/10 px-3 py-2 text-base mb-2 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:border-emerald"
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
                      className="rounded border-black/20 w-5 h-5"
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
                  {selectedProfileIds.size} plant{selectedProfileIds.size !== 1 ? "s" : ""} selected — one entry will tag all plants.
                </p>
              )}
            </>
          )}
        </div>

        {submitError && <p className="text-sm text-citrus font-medium">{submitError}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push(fromGarden ? "/garden" : "/journal")}
            className="flex-1 min-h-[44px] py-2.5 rounded-xl border border-black/10 text-black/80 font-medium"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || uploadingPhoto}
            className="flex-1 min-h-[44px] py-2.5 rounded-xl bg-emerald text-white font-medium shadow-soft disabled:opacity-60"
          >
            {uploadingPhoto ? "Uploading…" : saving ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
      </div>
    </div>
  );
}
