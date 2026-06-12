"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { updateWithOfflineQueue } from "@/lib/supabaseWithOffline";
import { compressImage } from "@/lib/compressImage";
import { coverEntryHasPhoto, type CoverEntryLike } from "@/lib/coverPhoto";
import type { CoverPhotoMode } from "@/types/garden";

/**
 * Cover Photo picker for a growing instance (Syd design lock 2026-06-11).
 * Opened from the Edit Plant menu's "Edit Photo" entry — the single edit path
 * (NORTH_STAR "No duplicate paths": pencil = edit, hero = display).
 *
 * Self-loading: fetches the grow's cover state, its journal photos (ALL of
 * them, including vault_add receipts — user agency; only AUTO skips receipts),
 * and the profile hero. Both hosts (instance page + Library Plantings tab)
 * get identical behavior with no host plumbing.
 *
 * Writes: cover_photo_mode + cover_photo_journal_entry_id on grow_instances.
 * "Upload New" picks from the photo library, creates a journal entry stub
 * ("Photo added") and pins it in one tap.
 */
export interface CoverPhotoSheetProps {
  growId: string;
  /** Row owner for RLS-safe writes (household-shared grows). */
  ownerId: string;
  /** Acting user — owns the uploaded file + the journal stub. */
  currentUserId: string;
  plantProfileId: string | null;
  onClose: () => void;
  /** Cover changed and committed — host refetches (sheet closes itself). */
  onChanged: () => void;
}

type PhotoEntry = CoverEntryLike & { id: string; created_at: string };

function isPlaceholderHeroUrl(url: string | null | undefined): boolean {
  const u = url?.trim();
  if (!u) return true;
  return u.endsWith("/seedling-icon.svg") || u.endsWith("/plant-placeholder.png");
}

function entryImageUrl(entry: PhotoEntry): string | null {
  if (entry.image_file_path?.trim()) {
    return supabase.storage.from("journal-photos").getPublicUrl(entry.image_file_path.trim()).data.publicUrl;
  }
  return entry.photo_url ?? null;
}

export function CoverPhotoSheet({ growId, ownerId, currentUserId, plantProfileId, onClose, onChanged }: CoverPhotoSheetProps) {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<CoverPhotoMode>("auto");
  const [pinnedEntryId, setPinnedEntryId] = useState<string | null>(null);
  const [photoEntries, setPhotoEntries] = useState<PhotoEntry[]>([]);
  const [profileHeroUrl, setProfileHeroUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: growData }, { data: entryData }, profileRes] = await Promise.all([
          supabase
            .from("grow_instances")
            .select("cover_photo_mode, cover_photo_journal_entry_id")
            .eq("id", growId)
            .single(),
          supabase
            .from("journal_entries")
            .select("id, image_file_path, photo_url, created_at, entry_type")
            .eq("grow_instance_id", growId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false }),
          plantProfileId
            ? supabase.from("plant_profiles").select("hero_image_path, hero_image_url").eq("id", plantProfileId).single()
            : Promise.resolve({ data: null }),
        ]);
        if (cancelled) return;
        const g = growData as { cover_photo_mode?: CoverPhotoMode | null; cover_photo_journal_entry_id?: string | null } | null;
        setMode(g?.cover_photo_mode ?? "auto");
        setPinnedEntryId(g?.cover_photo_journal_entry_id ?? null);
        setPhotoEntries(((entryData ?? []) as PhotoEntry[]).filter(coverEntryHasPhoto));
        const prof = profileRes.data as { hero_image_path?: string | null; hero_image_url?: string | null } | null;
        if (prof?.hero_image_path?.trim()) {
          setProfileHeroUrl(supabase.storage.from("journal-photos").getPublicUrl(prof.hero_image_path.trim()).data.publicUrl);
        } else if (!isPlaceholderHeroUrl(prof?.hero_image_url)) {
          setProfileHeroUrl(prof?.hero_image_url ?? null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [growId, plantProfileId]);

  const commit = useCallback(
    async (nextMode: CoverPhotoMode, entryId: string | null) => {
      setSaving(true);
      setErrorMsg(null);
      const { error } = await updateWithOfflineQueue(
        "grow_instances",
        { cover_photo_mode: nextMode, cover_photo_journal_entry_id: entryId },
        { id: growId, user_id: ownerId }
      );
      setSaving(false);
      if (error) { setErrorMsg("Couldn't update cover photo — please try again."); return; }
      onChanged();
    },
    [growId, ownerId, onChanged]
  );

  async function handleUpload(file: File) {
    setSaving(true);
    setErrorMsg(null);
    try {
      const { blob } = await compressImage(file);
      const path = `${currentUserId}/grow-cover-${growId.slice(0, 8)}-${crypto.randomUUID().slice(0, 8)}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("journal-photos")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false, cacheControl: "31536000" });
      if (uploadErr) { setErrorMsg(uploadErr.message); return; }
      // Journal entry stub: the photo lives in the planting's history, not in a
      // side bucket. No weather snapshot — a library-picked photo can be days
      // old; stamping "now" weather would be false data (divergence from
      // quick-add photo entries, deliberate).
      const { data: entry, error: insertErr } = await supabase
        .from("journal_entries")
        .insert({
          user_id: currentUserId,
          plant_profile_id: plantProfileId,
          grow_instance_id: growId,
          seed_packet_id: null,
          note: "Photo added",
          entry_type: "note",
          image_file_path: path,
        })
        .select("id")
        .single();
      if (insertErr || !entry) { setErrorMsg(insertErr?.message ?? "Couldn't save photo — please try again."); return; }
      const { error: pinErr } = await updateWithOfflineQueue(
        "grow_instances",
        { cover_photo_mode: "pinned_journal", cover_photo_journal_entry_id: (entry as { id: string }).id },
        { id: growId, user_id: ownerId }
      );
      if (pinErr) { setErrorMsg("Photo saved to journal, but couldn't set it as cover — please try again."); return; }
      onChanged();
    } finally {
      setSaving(false);
    }
  }

  const autoSelected = mode === "auto";
  const heroSelected = mode === "pinned_profile_hero";

  return (
    <>
      <div className="fixed inset-0 z-[100] bg-black/40" aria-hidden onClick={() => { if (!saving) onClose(); }} />
      <div className="fixed inset-0 z-[101] flex items-end md:items-center justify-center p-0 md:p-4 pointer-events-none">
        <div
          className="pointer-events-auto bg-white w-full max-w-md rounded-t-2xl md:rounded-2xl shadow-xl border border-neutral-200 max-h-[85vh] flex flex-col overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cover-photo-title"
        >
          <div className="flex-shrink-0 px-5 pt-5 pb-3 border-b border-neutral-200">
            <h2 id="cover-photo-title" className="text-lg font-semibold text-neutral-900">Cover Photo</h2>
            <p className="text-sm text-neutral-500 mt-0.5">Choose the photo that represents this planting.</p>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {loading ? (
              <div className="py-8 flex justify-center" aria-label="Loading">
                <span className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" aria-hidden />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => { if (!autoSelected) commit("auto", null); }}
                    disabled={saving}
                    aria-pressed={autoSelected}
                    className={`w-full min-h-[44px] p-3 rounded-xl text-left disabled:opacity-50 ${autoSelected ? "border-2 border-emerald-500" : "border border-neutral-300 hover:bg-neutral-50"}`}
                  >
                    <span className="block font-medium text-neutral-900">Auto-Update</span>
                    <span className="block text-xs text-neutral-500 mt-0.5">Uses your most recent journal photo. Receipts are skipped.</span>
                  </button>
                  {profileHeroUrl && (
                    <button
                      type="button"
                      onClick={() => { if (!heroSelected) commit("pinned_profile_hero", null); }}
                      disabled={saving}
                      aria-pressed={heroSelected}
                      className={`w-full min-h-[44px] p-3 rounded-xl text-left flex items-center gap-3 disabled:opacity-50 ${heroSelected ? "border-2 border-emerald-500" : "border border-neutral-300 hover:bg-neutral-50"}`}
                    >
                      <img src={profileHeroUrl} alt="" className="w-12 h-12 rounded-lg object-cover bg-neutral-100 flex-shrink-0" loading="lazy" />
                      <span>
                        <span className="block font-medium text-neutral-900">Use Profile Hero</span>
                        <span className="block text-xs text-neutral-500 mt-0.5">Keeps the Library photo, even as you add journal photos.</span>
                      </span>
                    </button>
                  )}
                </div>
                {photoEntries.length > 0 && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-neutral-500 mb-2">Journal photos</p>
                    <div className="grid grid-cols-3 gap-2">
                      {photoEntries.map((entry) => {
                        const src = entryImageUrl(entry);
                        if (!src) return null;
                        const selected = mode === "pinned_journal" && pinnedEntryId === entry.id;
                        return (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => { if (!selected) commit("pinned_journal", entry.id); }}
                            disabled={saving}
                            aria-pressed={selected}
                            className={`aspect-square rounded-lg overflow-hidden min-h-[44px] border-2 disabled:opacity-50 ${selected ? "border-emerald-500" : "border-transparent hover:border-emerald-500"} bg-neutral-100`}
                          >
                            <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving}
                  className="w-full min-h-[44px] py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 disabled:opacity-50"
                >
                  Upload New
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) handleUpload(file);
                  }}
                />
                {errorMsg && <p role="alert" className="text-sm font-medium italic text-red-600">{errorMsg}</p>}
              </>
            )}
          </div>
          <div className="flex-shrink-0 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-neutral-200">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="w-full py-2.5 rounded-xl border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 min-h-[44px] disabled:opacity-50"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
