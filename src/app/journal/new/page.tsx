"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { insertWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { useAuth } from "@/contexts/AuthContext";
import { useSync } from "@/contexts/SyncContext";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { compressImage } from "@/lib/compressImage";

type ProfileOption = { id: string; name: string; variety_name: string | null };

function isMobileDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  const mobileKeywords = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i;
  const narrowScreen = typeof window !== "undefined" && window.innerWidth < 768;
  return (hasTouch && mobileKeywords.test(ua)) || narrowScreen || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
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

export default function JournalNewPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { setSyncing } = useSync();
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(true);
  const [note, setNote] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [selectedProfileIds, setSelectedProfileIds] = useState<Set<string>>(new Set());
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

  const previewUrlRef = useRef<string | null>(null);
  const handleImageSelected = useCallback((f: File | null) => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setImageFile(f);
    if (f) {
      const url = URL.createObjectURL(f);
      previewUrlRef.current = url;
      setImagePreviewUrl(url);
    } else {
      setImagePreviewUrl(null);
    }
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
    let imagePath: string | null = null;

    if (imageFile) {
      setUploadingPhoto(true);
      const { blob } = await compressImage(imageFile);
      const path = `${sessionUserId}/${crypto.randomUUID()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("journal-photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });
      setUploadingPhoto(false);
      if (uploadErr) {
        setSubmitError(uploadErr.message);
        return;
      }
      imagePath = path;
    }

    if (!noteTrim && !imagePath) {
      setSubmitError("Add a note or photo.");
      return;
    }

    setSaving(true);
    setSyncing(true);
    const weatherSnapshot = await fetchWeatherSnapshot();
    const idsToInsert = selectedProfileIds.size > 0 ? Array.from(selectedProfileIds) : [null];
    let insertErr: { message: string } | null = null;
    try {
      for (const profileId of idsToInsert) {
        const { error } = await insertWithOfflineQueue("journal_entries", {
          user_id: sessionUserId,
          plant_profile_id: profileId,
          grow_instance_id: null,
          seed_packet_id: null,
          note: noteTrim,
          entry_type: "note",
          image_file_path: imagePath,
          weather_snapshot: weatherSnapshot ?? undefined,
        } as Record<string, unknown>);
        if (error) {
          insertErr = error;
          break;
        }
      }
    } finally {
      setSyncing(false);
      setSaving(false);
    }
    if (insertErr) {
      setSubmitError(insertErr.message);
      return;
    }
    router.push("/journal");
  }

  if (!user) {
    return (
      <div className="px-6 py-8">
        <p className="text-black/70">Sign in to add journal entries.</p>
        <Link href="/journal" className="text-emerald-600 font-medium mt-2 inline-block">
          ← Back to Journal
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 pb-8 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/journal"
          className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl border border-black/10 text-black/80 font-medium"
        >
          ←
        </Link>
        <h1 className="text-xl font-semibold text-black">Add Journal Entry</h1>
      </div>

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
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleImageSelected(f);
            e.target.value = "";
          }}
        />

        <div>
          <span className="block text-sm font-medium text-black/80 mb-2">Photo (optional)</span>
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
                  <CameraIcon />
                  Capture
                </button>
                <button type="button" onClick={stopWebcamStream} className="min-h-[44px] py-2.5 px-4 rounded-xl border border-black/10 text-sm font-medium text-black/80">
                  Cancel
                </button>
              </div>
            </div>
          ) : imageFile && imagePreviewUrl ? (
            <div className="space-y-2">
              <img src={imagePreviewUrl} alt="Preview" className="w-full rounded-xl object-cover h-40 bg-black/5" />
              <button type="button" onClick={() => handleImageSelected(null)} className="text-sm font-medium text-citrus hover:text-black/80 min-h-[44px]">
                Remove
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  if (isMobile) cameraMobileRef.current?.click();
                  else startDesktopWebcam();
                }}
                className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-black/10 text-sm font-medium text-black/80 hover:bg-black/5"
              >
                <CameraIcon />
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
          {webcamError && <p className="text-xs text-citrus mt-1">{webcamError}</p>}
        </div>

        <div>
          <label htmlFor="journal-note-new" className="block text-sm font-medium text-black/80 mb-1">
            Note
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

        <div>
          <label className="block text-sm font-medium text-black/80 mb-2">Plants (optional — link this entry to one or more)</label>
          {profilesLoading ? (
            <p className="text-sm text-black/50">Loading plants…</p>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-black/50">No varieties in vault. Add seeds first.</p>
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
                  {selectedProfileIds.size} plant{selectedProfileIds.size !== 1 ? "s" : ""} selected — one entry per plant will be created.
                </p>
              )}
            </>
          )}
        </div>

        {submitError && <p className="text-sm text-citrus font-medium">{submitError}</p>}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.push("/journal")}
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
  );
}
