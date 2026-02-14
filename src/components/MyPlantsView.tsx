"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { compressImage } from "@/lib/compressImage";
import { hapticSuccess } from "@/lib/haptics";

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
  purchase_date: string | null;
  care_count: number;
  journal_count: number;
};

function formatPlantedAgo(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  const years = Math.floor((now.getTime() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  if (years < 1) {
    const months = Math.floor((now.getTime() - d.getTime()) / (30.44 * 24 * 60 * 60 * 1000));
    if (months < 1) return "Planted this month";
    return `Planted ${months} month${months !== 1 ? "s" : ""} ago`;
  }
  return `Planted ${years} year${years !== 1 ? "s" : ""} ago`;
}

export function MyPlantsView({
  refetchTrigger,
  searchQuery = "",
  openAddModal: openAddModalProp,
  onCloseAddModal,
  categoryFilter = null,
  onCategoryChipsLoaded,
  onFilteredCountChange,
  onEmptyStateChange,
  onAddClick,
  onPermanentPlantAdded,
}: {
  refetchTrigger: number;
  searchQuery?: string;
  openAddModal?: boolean;
  onCloseAddModal?: () => void;
  onPermanentPlantAdded?: () => void;
  categoryFilter?: string | null;
  onCategoryChipsLoaded?: (chips: { type: string; count: number }[]) => void;
  onFilteredCountChange?: (count: number) => void;
  onEmptyStateChange?: (isEmpty: boolean) => void;
  onAddClick?: () => void;
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
  const [addDatePlanted, setAddDatePlanted] = useState(() => new Date().toISOString().slice(0, 10));
  const [addSaving, setAddSaving] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const fetchPlants = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    const { data: profiles } = await supabase
      .from("plant_profiles")
      .select("id, name, variety_name, primary_image_path, hero_image_url, hero_image_path, status, profile_type, created_at, purchase_date")
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

  useEffect(() => {
    if (!loading) onEmptyStateChange?.(plants.length === 0);
  }, [loading, plants.length, onEmptyStateChange]);

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
      purchase_date: addDatePlanted || null,
    });

    setAddSaving(false);
    setAddName(""); setAddVariety(""); setAddNotes(""); setAddPhoto(null); setAddPhotoPreview(null); setAddDatePlanted(new Date().toISOString().slice(0, 10));
    setShowAddModal(false);
    onCloseAddModal?.();
    if (error) return;
    await fetchPlants();
    hapticSuccess();
    onPermanentPlantAdded?.();
  }, [user?.id, addName, addVariety, addNotes, addPhoto, addDatePlanted, fetchPlants, onCloseAddModal, onPermanentPlantAdded]);

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
        <div className="rounded-2xl bg-white border border-black/10 p-8 text-center max-w-md mx-auto" style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.06)" }}>
          <div className="flex justify-center mb-4" aria-hidden>
            <svg width="96" height="96" viewBox="0 0 64 64" fill="none" className="text-emerald-400" aria-hidden>
              <path d="M32 60v-12" stroke="#78716c" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M32 48c-10 0-18-8-18-18s8-18 18-18 18 8 18 18-8 18-18 18z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <path d="M32 36c-5 0-9-4-9-9s4-9 9-9 9 4 9 9-4 9-9 9z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.7" />
            </svg>
          </div>
          <p className="text-black/70 font-medium mb-2">No permanent plants yet</p>
          <p className="text-sm text-black/50 mb-6">Add your fruit trees, bushes, and other perennial plants here.</p>
          <button
            type="button"
            onClick={() => onAddClick?.()}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-6 py-3 rounded-xl bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors shadow-sm"
          >
            Add a Perennial
          </button>
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
                <Link key={plant.id} href={`/vault/${plant.id}`} className="group rounded-xl bg-white border border-emerald-100 overflow-hidden hover:border-emerald-300 hover:shadow-md transition-all" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                  <div className="aspect-[16/10] bg-emerald-50/50 relative overflow-hidden">
                    {imgUrl ? (
                      <img src={imgUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg width="40" height="40" viewBox="0 0 64 64" fill="none" className="text-emerald-300" aria-hidden>
                          <path d="M32 60v-12" stroke="#78716c" strokeWidth="2" strokeLinecap="round" />
                          <path d="M32 48c-10 0-18-8-18-18s8-18 18-18 18 8 18 18-8 18-18 18z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                      </div>
                    )}
                    <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-emerald-100/90 text-emerald-800 text-[10px] font-medium" aria-hidden>
                      Perennial
                    </span>
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-neutral-900 text-sm truncate">{plant.name}</h3>
                    {plant.variety_name && <p className="text-xs text-neutral-500 truncate">{plant.variety_name}</p>}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-2 text-xs text-neutral-500">
                      {formatPlantedAgo(plant.purchase_date) && <span>{formatPlantedAgo(plant.purchase_date)}</span>}
                      {plant.care_count > 0 && <span>{plant.care_count} care task{plant.care_count !== 1 ? "s" : ""}</span>}
                      {plant.journal_count > 0 && <span>{plant.journal_count} journal entr{plant.journal_count !== 1 ? "ies" : "y"}</span>}
                      {plant.care_count === 0 && plant.journal_count === 0 && !formatPlantedAgo(plant.purchase_date) && <span>No activity yet</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Add Plant Modal - portaled to body so it shows when opened from Active Garden tab */}
      {showAddModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex-shrink-0 p-5 border-b border-neutral-200">
              <h2 className="text-lg font-semibold text-neutral-900">Add Permanent Plant</h2>
              <p className="text-sm font-medium text-neutral-600 mt-1">Trees, bushes, vines, and other perennials</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
              <div>
                <label htmlFor="plant-name" className="block text-sm font-medium text-neutral-700 mb-1">Plant Name *</label>
                <input id="plant-name" type="text" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="e.g. Avocado Tree" className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" autoFocus />
              </div>
              <div>
                <label htmlFor="plant-variety" className="block text-sm font-medium text-neutral-700 mb-1">Variety</label>
                <input id="plant-variety" type="text" value={addVariety} onChange={(e) => setAddVariety(e.target.value)} placeholder="e.g. Hass, Meyer" className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label htmlFor="plant-date" className="block text-sm font-medium text-neutral-700 mb-1">Date Planted</label>
                <input id="plant-date" type="date" value={addDatePlanted} onChange={(e) => setAddDatePlanted(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label htmlFor="plant-notes" className="block text-sm font-medium text-neutral-700 mb-1">Notes (optional)</label>
                <textarea id="plant-notes" rows={4} value={addNotes} onChange={(e) => setAddNotes(e.target.value)} placeholder="Where it's planted, age, any notes..." className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-neutral-900 text-sm focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 resize-none min-h-[4.5rem]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Photo</label>
                <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoChange} className="hidden" aria-label="Take or add photo" />
                {addPhotoPreview ? (
                  <div className="relative">
                    <img src={addPhotoPreview} alt="Preview" className="w-full h-32 object-cover rounded-xl border border-neutral-200" />
                    <button type="button" onClick={() => { setAddPhoto(null); setAddPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = ""; }} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-sm" aria-label="Remove photo">×</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => photoInputRef.current?.click()} className="w-full min-h-[120px] flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 text-neutral-500 hover:border-emerald-500 hover:text-emerald-600 hover:bg-emerald-50/30 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                    <span className="text-sm font-medium">Take photo or choose file</span>
                  </button>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 flex gap-3 justify-end p-4 border-t border-neutral-200">
              <button type="button" onClick={() => { setShowAddModal(false); setAddName(""); setAddVariety(""); setAddNotes(""); setAddPhoto(null); setAddPhotoPreview(null); setAddDatePlanted(new Date().toISOString().slice(0, 10)); onCloseAddModal?.(); }} className="min-h-[44px] px-4 py-2 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50">Cancel</button>
              <button type="button" onClick={handleAddPlant} disabled={addSaving || !addName.trim()} className="min-h-[44px] px-5 py-2 rounded-lg bg-emerald-600 text-white font-medium shadow-sm hover:bg-emerald-700 disabled:opacity-50">{addSaving ? "Saving..." : "Add Plant"}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
