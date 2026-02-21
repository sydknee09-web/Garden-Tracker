"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { compressImage } from "@/lib/compressImage";
import { hapticError, hapticSuccess } from "@/lib/haptics";
import { useEscapeKey } from "@/hooks/useEscapeKey";

type ProfileOption = { id: string; name: string; variety_name: string | null };

export function AddStoreBoughtPlantModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);
  useEscapeKey(open, onClose);
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [plantType, setPlantType] = useState("");
  const [variety, setVariety] = useState("");
  const [vendor, setVendor] = useState("");
  const [nursery, setNursery] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [plantedDate, setPlantedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichmentFailed, setEnrichmentFailed] = useState(false);
  const [createdProfileId, setCreatedProfileId] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("plant_profiles")
      .select("id, name, variety_name")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .limit(150);
    setProfiles((data ?? []) as ProfileOption[]);
    if ((data ?? []).length > 0 && !selectedProfileId) setSelectedProfileId((data as ProfileOption[])[0].id);
  }, [user?.id]);

  useEffect(() => {
    if (open && user?.id) loadProfiles();
  }, [open, user?.id, loadProfiles]);

  useEffect(() => {
    const urls = photoFiles.map((f) => URL.createObjectURL(f));
    setPhotoPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photoFiles]);

  const addPhoto = useCallback((file: File | null) => {
    if (!file) return;
    setPhotoFiles((prev) => [...prev, file]);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }, []);

  const removePhoto = useCallback((index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const resetForm = useCallback(() => {
    setMode("new");
    setSelectedProfileId("");
    setPlantType("");
    setVariety("");
    setVendor("");
    setNursery("");
    setPhotoFiles([]);
    setPlantedDate(new Date().toISOString().slice(0, 10));
    setLocation("");
    setError(null);
    setEnrichmentFailed(false);
    setCreatedProfileId(null);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
    resetForm();
  }, [onClose, resetForm]);

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
        const name = plantType.trim();
        if (!name) {
          setError("Plant type is required.");
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
            profile_type: "seed",
            purchase_vendor: vendor.trim() || null,
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

        const { data: growRow, error: growInsertErr } = await supabase
          .from("grow_instances")
          .insert({
            user_id: user.id,
            plant_profile_id: profileId,
            plant_variety_id: profileId,
            sown_date: plantedDate,
            expected_harvest_date: null,
            status: "growing",
            seed_packet_id: null,
            location: location.trim() || null,
          })
          .select("id")
          .single();
        if (growInsertErr) {
          setError(growInsertErr.message);
          setSubmitting(false);
          return;
        }
        const growInstanceIdNew = (growRow as { id: string }).id;
        await supabase.from("plant_profiles").update({ status: "active" }).eq("id", profileId).eq("user_id", user.id);

        if (photoFiles.length > 0) {
          for (let i = 0; i < photoFiles.length; i++) {
            const file = photoFiles[i];
            const { blob } = await compressImage(file);
            const isFirst = i === 0;
            const path = isFirst
              ? `${user.id}/hero-${profileId}.jpg`
              : `${user.id}/${crypto.randomUUID()}.jpg`;
            const { error: uploadErr } = await supabase.storage
              .from("journal-photos")
              .upload(path, blob, { contentType: "image/jpeg", upsert: isFirst });
            if (uploadErr) continue;
            if (isFirst) {
              await supabase
                .from("plant_profiles")
                .update({ hero_image_path: path, hero_image_url: null })
                .eq("id", profileId)
                .eq("user_id", user.id);
            }
            await supabase.from("journal_entries").insert({
              user_id: user.id,
              plant_profile_id: profileId,
              plant_variety_id: profileId,
              grow_instance_id: growInstanceIdNew,
              seed_packet_id: null,
              note: isFirst ? "Planted (store-bought)." : null,
              entry_type: isFirst ? "planting" : "growth",
              image_file_path: path,
            });
          }
        }

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
            body: JSON.stringify({ name, variety: variety.trim(), vendor: "" }),
          });
          const heroData = (await heroRes.json()) as { hero_image_url?: string; error?: string };
          const heroUrl = heroData.hero_image_url?.trim();
          if (heroUrl) {
            await supabase
              .from("plant_profiles")
              .update({ hero_image_url: heroUrl, hero_image_path: null })
              .eq("id", profileId)
              .eq("user_id", user.id);
          }
        }

        if (needsEnrichment && !enriched) setEnrichmentFailed(true);
      }

      if (mode === "existing") {
        const { error: growErr } = await supabase.from("grow_instances").insert({
          user_id: user.id,
          plant_profile_id: profileId,
          plant_variety_id: profileId,
          sown_date: plantedDate,
          expected_harvest_date: null,
          status: "growing",
          seed_packet_id: null,
          location: location.trim() || null,
        });
        if (growErr) {
          setError(growErr.message);
          setSubmitting(false);
          return;
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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-labelledby="store-bought-title">
        <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
          <div className="flex-shrink-0 p-4 border-b border-neutral-200">
            <h2 id="store-bought-title" className="text-lg font-semibold text-neutral-900">Add store-bought plant</h2>
            <p className="text-sm text-neutral-500 mt-1">No seed packet — add a plant you bought (starts, potted, etc.).</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${mode === "existing" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
              >
                Link to existing variety
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border ${mode === "new" ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}
              >
                Create new profile
              </button>
            </div>

            {mode === "existing" ? (
              <div>
                <label htmlFor="store-bought-profile" className="block text-sm font-medium text-neutral-700 mb-1">Variety</label>
                <select
                  id="store-bought-profile"
                  value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.variety_name?.trim() ? `${p.name} — ${p.variety_name}` : p.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="store-bought-plant-type" className="block text-sm font-medium text-neutral-700 mb-1">Plant *</label>
                  <input
                    id="store-bought-plant-type"
                    type="text"
                    value={plantType}
                    onChange={(e) => setPlantType(e.target.value)}
                    placeholder="e.g. Tomato, Basil"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="store-bought-variety" className="block text-sm font-medium text-neutral-700 mb-1">Variety</label>
                  <input
                    id="store-bought-variety"
                    type="text"
                    value={variety}
                    onChange={(e) => setVariety(e.target.value)}
                    placeholder="e.g. Cherokee Purple, Genovese"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="store-bought-vendor" className="block text-sm font-medium text-neutral-700 mb-1">Vendor</label>
                  <input
                    id="store-bought-vendor"
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="e.g. Bonnie Plants, Burpee"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label htmlFor="store-bought-nursery" className="block text-sm font-medium text-neutral-700 mb-1">Nursery</label>
                  <input
                    id="store-bought-nursery"
                    type="text"
                    value={nursery}
                    onChange={(e) => setNursery(e.target.value)}
                    placeholder="e.g. Armstrong, Home Depot"
                    className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <p className="text-xs text-neutral-500 mt-1">Vendor and nursery are for your records. We use plant + variety only to find details and a photo.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Photos (optional)</label>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    aria-label="Take or add photo"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) addPhoto(f);
                      e.target.value = "";
                    }}
                  />
                  <div className="flex flex-wrap gap-2">
                    {photoPreviews.map((url, i) => (
                      <div key={i} className="relative">
                        <img src={url} alt="" className="h-20 w-20 object-cover rounded-lg border border-neutral-200" />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center leading-none"
                          aria-label="Remove photo"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="min-h-[80px] w-20 flex items-center justify-center rounded-xl border-2 border-dashed border-neutral-300 text-neutral-500 hover:border-emerald-500 hover:text-emerald-600 text-2xl"
                      aria-label="Take or add another photo"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-neutral-500 mt-1">Take one or more photos. First becomes the profile hero; all appear in the journal. Submit when ready.</p>
                </div>
              </>
            )}

            <div>
              <label htmlFor="store-bought-date" className="block text-sm font-medium text-neutral-700 mb-1">Planted date</label>
              <input
                id="store-bought-date"
                type="date"
                value={plantedDate}
                onChange={(e) => setPlantedDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="store-bought-location" className="block text-sm font-medium text-neutral-700 mb-1">Location (optional)</label>
              <input
                id="store-bought-location"
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
            <button type="button" onClick={handleClose} disabled={submitting} className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50 min-h-[44px]">
              {submitting ? "Adding…" : "Add to Garden"}
            </button>
          </div>
        </div>
      </div>

      {enrichmentFailed && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true" aria-labelledby="enrichment-failed-title">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6">
            <h2 id="enrichment-failed-title" className="text-lg font-semibold text-neutral-900 mb-2">Details couldn’t be loaded</h2>
            <p className="text-sm text-neutral-600 mb-4">
              We couldn’t find growing details for this plant. You can add them now or edit the profile later.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setEnrichmentFailed(false);
                  if (createdProfileId) router.push(`/vault/${createdProfileId}`);
                  handleClose();
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700"
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
                className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50"
              >
                I’ll do it later
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
