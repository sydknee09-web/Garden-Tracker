"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { compressImage } from "@/lib/compressImage";

type PermanentPlant = {
  id: string;
  name: string;
  variety_name: string | null;
  primary_image_path: string | null;
  hero_image_url: string | null;
  hero_image_path: string | null;
  status: string | null;
  profile_type: string;
  created_at: string;
  care_count: number;
  journal_count: number;
};

export function MyPlantsView({
  refetchTrigger,
  searchQuery = "",
  openAddModal: openAddModalProp,
  onCloseAddModal,
  categoryFilter = null,
  onCategoryChipsLoaded,
  onFilteredCountChange,
}: {
  refetchTrigger: number;
  searchQuery?: string;
  openAddModal?: boolean;
  onCloseAddModal?: () => void;
  categoryFilter?: string | null;
  onCategoryChipsLoaded?: (chips: { type: string; count: number }[]) => void;
  onFilteredCountChange?: (count: number) => void;
}) {
  const { user } = useAuth();
  const [plants, setPlants] = useState<PermanentPlant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Add form
  const [addName, setAddName] = useState("");
  const [addVariety, setAddVariety] = useState("");
  const [addNotes, setAddNotes] = useState("");
  const [addPhoto, setAddPhoto] = useState<File | null>(null);
  const [addPhotoPreview, setAddPhotoPreview] = useState<string | null>(null);
  const [addSaving, setAddSaving] = useState(false);

  const fetchPlants = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    const { data: profiles } = await supabase
      .from("plant_profiles")
      .select("id, name, variety_name, primary_image_path, hero_image_url, hero_image_path, status, profile_type, created_at")
      .eq("user_id", user.id)
      .eq("profile_type", "permanent")
      .is("deleted_at", null)
      .order("name", { ascending: true });

    if (!profiles || profiles.length === 0) {
      setPlants([]);
      setLoading(false);
      return;
    }

    const profileIds = profiles.map((p) => p.id);

    // Count care schedules and journal entries
    const [careRes, journalRes] = await Promise.all([
      supabase.from("care_schedules").select("plant_profile_id").in("plant_profile_id", profileIds).eq("is_active", true).eq("user_id", user.id),
      supabase.from("journal_entries").select("plant_profile_id").in("plant_profile_id", profileIds).eq("user_id", user.id),
    ]);

    const careCounts = new Map<string, number>();
    (careRes.data ?? []).forEach((c: { plant_profile_id: string | null }) => {
      if (c.plant_profile_id) careCounts.set(c.plant_profile_id, (careCounts.get(c.plant_profile_id) ?? 0) + 1);
    });
    const journalCounts = new Map<string, number>();
    (journalRes.data ?? []).forEach((j: { plant_profile_id: string | null }) => {
      if (j.plant_profile_id) journalCounts.set(j.plant_profile_id, (journalCounts.get(j.plant_profile_id) ?? 0) + 1);
    });

    setPlants(profiles.map((p) => ({
      ...p,
      profile_type: p.profile_type ?? "permanent",
      care_count: careCounts.get(p.id) ?? 0,
      journal_count: journalCounts.get(p.id) ?? 0,
    })));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchPlants(); }, [fetchPlants, refetchTrigger]);

  const categoryChips = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of plants) {
      const first = (p.name ?? "").trim().split(/\s+/)[0]?.trim() || "Other";
      map.set(first, (map.get(first) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => a.type.localeCompare(b.type, undefined, { sensitivity: "base" }));
  }, [plants]);

  const filteredPlants = useMemo(() => {
    if (!categoryFilter) return plants;
    return plants.filter((p) => {
      const first = (p.name ?? "").trim().split(/\s+/)[0]?.trim() || "Other";
      return first === categoryFilter;
    });
  }, [plants, categoryFilter]);

  const q = (searchQuery ?? "").trim().toLowerCase();
  const filteredBySearch = useMemo(() => {
    if (!q) return filteredPlants;
    return filteredPlants.filter((p) => {
      const name = (p.name ?? "").toLowerCase();
      const variety = (p.variety_name ?? "").toLowerCase();
      return name.includes(q) || variety.includes(q);
    });
  }, [filteredPlants, q]);

  useEffect(() => {
    onCategoryChipsLoaded?.(categoryChips);
  }, [categoryChips, onCategoryChipsLoaded]);

  useEffect(() => {
    onFilteredCountChange?.(filteredBySearch.length);
  }, [filteredBySearch.length, onFilteredCountChange]);

  // When parent asks to open Add modal (e.g. from FAB), open it and clear the request
  useEffect(() => {
    if (openAddModalProp) {
      setShowAddModal(true);
      onCloseAddModal?.();
    }
  }, [openAddModalProp, onCloseAddModal]);

  const handleAddPlant = useCallback(async () => {
    if (!user?.id || !addName.trim()) return;
    setAddSaving(true);

    let imagePath: string | null = null;
    if (addPhoto) {
      const { blob, fileName } = await compressImage(addPhoto);
      const path = `${user.id}/plant-${Date.now()}-${fileName}`;
      const { error: uploadErr } = await supabase.storage.from("journal-photos").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (!uploadErr) imagePath = path;
    }

    const { error } = await supabase.from("plant_profiles").insert({
      user_id: user.id,
      name: addName.trim(),
      variety_name: addVariety.trim() || null,
      profile_type: "permanent",
      status: "active",
      growing_notes: addNotes.trim() || null,
      hero_image_path: imagePath,
    });

    setAddSaving(false);
    setAddName(""); setAddVariety(""); setAddNotes(""); setAddPhoto(null); setAddPhotoPreview(null);
    setShowAddModal(false);
    onCloseAddModal?.();
    if (error) return;
    await fetchPlants();
  }, [user?.id, addName, addVariety, addNotes, addPhoto, fetchPlants, onCloseAddModal]);

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAddPhoto(file);
      const reader = new FileReader();
      reader.onload = () => setAddPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  }, []);

  const getImageUrl = (plant: PermanentPlant) => {
    if (plant.hero_image_url) return plant.hero_image_url;
    if (plant.hero_image_path) return supabase.storage.from("journal-photos").getPublicUrl(plant.hero_image_path).data.publicUrl;
    if (plant.primary_image_path) return supabase.storage.from("seed-packets").getPublicUrl(plant.primary_image_path).data.publicUrl;
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl bg-white border border-black/10 p-4 animate-pulse h-24" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {plants.length === 0 ? (
        <div className="rounded-2xl bg-white border border-black/10 p-8 text-center" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
          <span className="text-4xl mb-3 block" aria-hidden>🌳</span>
          <p className="text-black/70 font-medium mb-1">No permanent plants yet</p>
          <p className="text-sm text-black/50 mb-4">Add your fruit trees, avocados, bushes, and other perennial plants here.</p>
          <button type="button" onClick={() => setShowAddModal(true)} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">Add First Plant</button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-black/50">{filteredBySearch.length} plant{filteredBySearch.length !== 1 ? "s" : ""}</p>
            <button type="button" onClick={() => setShowAddModal(true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700">+ Add Plant</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredBySearch.map((plant) => {
              const imgUrl = getImageUrl(plant);
              return (
                <Link key={plant.id} href={`/vault/${plant.id}`} className="group rounded-xl bg-white border border-black/10 overflow-hidden hover:border-emerald-300 hover:shadow-md transition-all" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  <div className="aspect-[16/10] bg-neutral-100 relative overflow-hidden">
                    {imgUrl ? (
                      <img src={imgUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-4xl opacity-40" aria-hidden>🌳</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-neutral-900 text-sm truncate">{plant.name}</h3>
                    {plant.variety_name && <p className="text-xs text-neutral-500 truncate">{plant.variety_name}</p>}
                    <div className="flex items-center gap-3 mt-2 text-xs text-neutral-400">
                      {plant.care_count > 0 && <span>{plant.care_count} care task{plant.care_count !== 1 ? "s" : ""}</span>}
                      {plant.journal_count > 0 && <span>{plant.journal_count} journal entr{plant.journal_count !== 1 ? "ies" : "y"}</span>}
                      {plant.care_count === 0 && plant.journal_count === 0 && <span>No activity yet</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Add Plant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex-shrink-0 p-5 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900">Add Permanent Plant</h2>
              <p className="text-sm text-neutral-500 mt-1">Trees, bushes, vines, and other perennials</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
              <div>
                <label htmlFor="plant-name" className="block text-sm font-medium text-neutral-700 mb-1">Plant Name *</label>
                <input id="plant-name" type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. Avocado Tree" className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm focus:ring-emerald-500 focus:border-emerald-500" autoFocus />
              </div>
              <div>
                <label htmlFor="plant-variety" className="block text-sm font-medium text-neutral-700 mb-1">Variety (optional)</label>
                <input id="plant-variety" type="text" value={addVariety} onChange={(e) => setAddVariety(e.target.value)} placeholder="e.g. Hass, Meyer" className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label htmlFor="plant-notes" className="block text-sm font-medium text-neutral-700 mb-1">Notes (optional)</label>
                <textarea id="plant-notes" rows={3} value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="Where it's planted, age, any notes..." className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm focus:ring-emerald-500 focus:border-emerald-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Photo</label>
                <input type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="text-sm" />
                {addPhotoPreview && (
                  <div className="mt-2 max-w-[200px] rounded-lg overflow-hidden bg-neutral-100">
                    <img src={addPhotoPreview} alt="Preview" className="w-full h-auto object-cover" />
                  </div>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 flex gap-3 justify-end p-4 border-t border-neutral-200">
              <button type="button" onClick={() => { setShowAddModal(false); setAddName(""); setAddVariety(""); setAddNotes(""); setAddPhoto(null); setAddPhotoPreview(null); onCloseAddModal?.(); }} className="min-h-[44px] px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50">Cancel</button>
              <button type="button" onClick={handleAddPlant} disabled={addSaving || !addName.trim()} className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 disabled:opacity-50">{addSaving ? "Saving..." : "Add Plant"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
