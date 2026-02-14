"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ActiveGardenView } from "@/components/ActiveGardenView";
import { MyPlantsView } from "@/components/MyPlantsView";
import { HarvestModal } from "@/components/HarvestModal";
import { AddStoreBoughtPlantModal } from "@/components/AddStoreBoughtPlantModal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWeatherSnapshot } from "@/lib/weatherSnapshot";
import { decodeHtmlEntities } from "@/lib/htmlEntities";
import { compressImage } from "@/lib/compressImage";

type GrowingBatchForLog = { id: string; plant_profile_id: string; profile_name: string; profile_variety_name: string | null };

function GardenPageInner() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<"active" | "plants">("active");
  const [refetchTrigger, setRefetchTrigger] = useState(0);
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [plantsSearchQuery, setPlantsSearchQuery] = useState("");
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string | null>(null);
  const [activeCategoryChips, setActiveCategoryChips] = useState<{ type: string; count: number }[]>([]);
  const [activeFilteredCount, setActiveFilteredCount] = useState(0);
  const [plantsCategoryFilter, setPlantsCategoryFilter] = useState<string | null>(null);
  const [plantsCategoryChips, setPlantsCategoryChips] = useState<{ type: string; count: number }[]>([]);
  const [plantsFilteredCount, setPlantsFilteredCount] = useState(0);
  const [plantsHasItems, setPlantsHasItems] = useState(false);
  const [activeHasItems, setActiveHasItems] = useState(false);
  const [refineByOpen, setRefineByOpen] = useState(false);
  const [refineBySection, setRefineBySection] = useState<"plantType" | null>(null);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [openBulkJournalForActive, setOpenBulkJournalForActive] = useState(false);
  const [addedToMyPlantsToast, setAddedToMyPlantsToast] = useState(false);
  const [showStoreBoughtModal, setShowStoreBoughtModal] = useState(false);
  const [showAddPermanentPlantModal, setShowAddPermanentPlantModal] = useState(false);

  const [logGrowthBatch, setLogGrowthBatch] = useState<GrowingBatchForLog | null>(null);
  const [logGrowthNote, setLogGrowthNote] = useState("");
  const [logGrowthFile, setLogGrowthFile] = useState<File | null>(null);
  const [logGrowthPreview, setLogGrowthPreview] = useState<string | null>(null);
  const [logGrowthSaving, setLogGrowthSaving] = useState(false);
  const fileInputLogGrowthRef = useRef<HTMLInputElement>(null);
  const [logHarvestBatch, setLogHarvestBatch] = useState<GrowingBatchForLog | null>(null);
  const [endCropConfirmBatch, setEndCropConfirmBatch] = useState<GrowingBatchForLog | null>(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "active" || tab === "plants") setViewMode(tab);
    if (tab === "active") setRefetchTrigger((t) => t + 1);
  }, [searchParams]);

  const handleActiveCategoryChipsLoaded = useCallback((chips: { type: string; count: number }[]) => {
    setActiveCategoryChips(chips);
  }, []);
  const handlePlantsCategoryChipsLoaded = useCallback((chips: { type: string; count: number }[]) => {
    setPlantsCategoryChips(chips);
  }, []);

  const openLogGrowth = useCallback((batch: GrowingBatchForLog) => {
    setLogGrowthBatch(batch);
    setLogGrowthNote("");
    setLogGrowthFile(null);
    setLogGrowthPreview(null);
  }, []);

  const openLogHarvest = useCallback((batch: GrowingBatchForLog) => {
    setLogHarvestBatch(batch);
  }, []);

  const handleEndCrop = useCallback((batch: GrowingBatchForLog) => {
    setEndCropConfirmBatch(batch);
  }, []);

  const confirmEndCrop = useCallback(async () => {
    if (!user?.id || !endCropConfirmBatch) return;
    const { error } = await supabase
      .from("grow_instances")
      .update({ status: "archived", ended_at: new Date().toISOString() })
      .eq("id", endCropConfirmBatch.id)
      .eq("user_id", user.id);
    setEndCropConfirmBatch(null);
    if (error) return;
    setRefetchTrigger((t) => t + 1);
  }, [user?.id, endCropConfirmBatch]);

  const handleLogGrowthSubmit = useCallback(async () => {
    if (!user?.id || !logGrowthBatch) return;
    setLogGrowthSaving(true);
    let imagePath: string | null = null;
    if (logGrowthFile) {
      const { blob } = await compressImage(logGrowthFile);
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage.from("journal-photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upErr) {
        setLogGrowthSaving(false);
        return;
      }
      imagePath = path;
    }
    const weatherSnapshot = await fetchWeatherSnapshot();
    const noteTrim = logGrowthNote.trim() || null;
    const { error: journalErr } = await supabase.from("journal_entries").insert({
      user_id: user.id,
      plant_profile_id: logGrowthBatch.plant_profile_id,
      grow_instance_id: logGrowthBatch.id,
      note: noteTrim,
      entry_type: "growth",
      image_file_path: imagePath,
      weather_snapshot: weatherSnapshot ?? undefined,
    });
    setLogGrowthSaving(false);
    if (journalErr) return;
    setLogGrowthBatch(null);
    setRefetchTrigger((t) => t + 1);
  }, [user?.id, logGrowthBatch, logGrowthNote, logGrowthFile]);

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 pt-2 pb-4">
        <div className="flex justify-center mb-3">
          <div className="inline-flex rounded-xl p-1 bg-neutral-100 gap-0.5" role="tablist" aria-label="View">
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "active"}
              onClick={() => setViewMode("active")}
              className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "active" ? "bg-white text-emerald-700 shadow-sm" : "text-black/60 hover:text-black"
              }`}
            >
              Active Garden
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "plants"}
              onClick={() => setViewMode("plants")}
              className={`min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === "plants" ? "bg-white text-emerald-700 shadow-sm" : "text-black/60 hover:text-black"
              }`}
            >
              My Plants
            </button>
          </div>
        </div>

        {((viewMode === "active" && activeHasItems) || (viewMode === "plants" && plantsHasItems)) && (
          <>
            <div className="flex gap-2 mb-2">
              <div className="flex-1 relative">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/40 pointer-events-none" aria-hidden>
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="search"
                  value={viewMode === "active" ? activeSearchQuery : plantsSearchQuery}
                  onChange={(e) => (viewMode === "active" ? setActiveSearchQuery(e.target.value) : setPlantsSearchQuery(e.target.value))}
                  placeholder={viewMode === "active" ? "Search batches…" : "Search plants…"}
                  className="w-full rounded-xl bg-neutral-100 border-0 pl-10 pr-4 py-2.5 text-black placeholder:text-black/40 focus:outline-none focus:ring-2 focus:ring-emerald/40 focus:ring-inset"
                  aria-label={viewMode === "active" ? "Search batches" : "Search plants"}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 mb-2">
              <button
                type="button"
                onClick={() => { setRefineByOpen(true); setRefineBySection(null); }}
                className="min-h-[44px] min-w-[44px] rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium text-black/80 hover:bg-black/5 flex items-center gap-2"
                aria-label="Refine by plant type"
              >
                Refine by
                {(viewMode === "active" && activeCategoryFilter !== null) || (viewMode === "plants" && plantsCategoryFilter !== null) ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald text-white text-xs font-semibold">1</span>
                ) : null}
              </button>
              <span className="text-sm text-black/50">
                {viewMode === "active" ? activeFilteredCount : plantsFilteredCount} item{(viewMode === "active" ? activeFilteredCount : plantsFilteredCount) !== 1 ? "s" : ""}
              </span>
            </div>
          </>
        )}

        {refineByOpen && (
          <>
            <button type="button" className="fixed inset-0 z-20 bg-black/20" aria-label="Close" onClick={() => { setRefineByOpen(false); setRefineBySection(null); }} />
            <div className="fixed left-4 right-4 top-1/2 -translate-y-1/2 z-30 bg-white rounded-2xl shadow-lg border border-black/10 flex flex-col max-h-[70vh]">
              <header className="flex items-center justify-between p-4 border-b border-black/10">
                <h2 id="refine-by-title" className="text-lg font-semibold text-black">Refine by</h2>
                <button type="button" onClick={() => { setRefineByOpen(false); setRefineBySection(null); }} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-black/60 hover:bg-black/5" aria-label="Close">
                  <span className="text-xl leading-none" aria-hidden>×</span>
                </button>
              </header>
              <div className="flex-1 overflow-y-auto">
                <div className="border-b border-black/5">
                  <button
                    type="button"
                    onClick={() => setRefineBySection((s) => (s === "plantType" ? null : "plantType"))}
                    className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px] text-sm font-medium text-black hover:bg-black/[0.03]"
                    aria-expanded={refineBySection === "plantType"}
                  >
                    <span>Plant type</span>
                    <span className="text-black/50 shrink-0 ml-2" aria-hidden>{refineBySection === "plantType" ? "▴" : "▾"}</span>
                  </button>
                  {refineBySection === "plantType" && (
                    <div className="px-4 pb-3 pt-0 max-h-[220px] overflow-y-auto space-y-0.5">
                      <button
                        type="button"
                        onClick={() => (viewMode === "active" ? setActiveCategoryFilter(null) : setPlantsCategoryFilter(null))}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm bg-emerald/10 text-emerald-800 font-medium"
                      >
                        All
                      </button>
                      {(viewMode === "active" ? activeCategoryChips : plantsCategoryChips).map(({ type, count }) => {
                        const selected = viewMode === "active" ? activeCategoryFilter === type : plantsCategoryFilter === type;
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => (viewMode === "active" ? setActiveCategoryFilter(type) : setPlantsCategoryFilter(type))}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm ${selected ? "bg-emerald/10 text-emerald-800 font-medium" : "text-black/80 hover:bg-black/5"}`}
                          >
                            {type} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <footer className="flex-shrink-0 border-t border-black/10 px-4 py-3">
                <button
                  type="button"
                  onClick={() => { setRefineByOpen(false); setRefineBySection(null); }}
                  className="w-full min-h-[48px] rounded-xl bg-emerald text-white font-medium text-sm"
                >
                  Show results ({viewMode === "active" ? activeFilteredCount : plantsFilteredCount})
                </button>
              </footer>
            </div>
          </>
        )}

        {viewMode === "active" && (
          <div className="pt-2">
            <ActiveGardenView
              refetchTrigger={refetchTrigger}
              searchQuery={activeSearchQuery}
              onLogGrowth={openLogGrowth}
              onLogHarvest={openLogHarvest}
              onEndCrop={handleEndCrop}
              categoryFilter={activeCategoryFilter}
              onCategoryChipsLoaded={handleActiveCategoryChipsLoaded}
              onFilteredCountChange={setActiveFilteredCount}
              onEmptyStateChange={(empty) => setActiveHasItems(!empty)}
              openBulkJournalRequest={openBulkJournalForActive}
              onBulkJournalRequestHandled={() => setOpenBulkJournalForActive(false)}
            />
          </div>
        )}

        {(viewMode === "plants" || showAddPermanentPlantModal) && (
          <div className={`pt-2 ${viewMode !== "plants" ? "sr-only" : ""}`}>
            <MyPlantsView
              refetchTrigger={refetchTrigger}
              searchQuery={plantsSearchQuery}
              openAddModal={showAddPermanentPlantModal}
              onCloseAddModal={() => setShowAddPermanentPlantModal(false)}
              onPermanentPlantAdded={() => {
                if (viewMode === "active") {
                  setViewMode("plants");
                  setAddedToMyPlantsToast(true);
                  setTimeout(() => setAddedToMyPlantsToast(false), 2500);
                }
              }}
              categoryFilter={plantsCategoryFilter}
              onCategoryChipsLoaded={handlePlantsCategoryChipsLoaded}
              onFilteredCountChange={setPlantsFilteredCount}
              onEmptyStateChange={(empty) => setPlantsHasItems(!empty)}
              onAddClick={() => setShowAddPermanentPlantModal(true)}
            />
          </div>
        )}
      </div>

      {logGrowthBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" aria-modal="true" role="dialog">
          <div className="bg-white rounded-2xl shadow-lg border border-black/10 max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b border-black/10">
              <h2 className="text-lg font-semibold text-black">Log Growth</h2>
              <p className="text-sm text-black/60 mt-1">{logGrowthBatch.profile_variety_name?.trim() ? `${decodeHtmlEntities(logGrowthBatch.profile_name)} (${decodeHtmlEntities(logGrowthBatch.profile_variety_name)})` : decodeHtmlEntities(logGrowthBatch.profile_name)}</p>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <div>
                <label className="block text-xs font-medium text-black/60 mb-1">Photo (optional)</label>
                <input
                  ref={fileInputLogGrowthRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setLogGrowthFile(f);
                      setLogGrowthPreview(URL.createObjectURL(f));
                    }
                    e.target.value = "";
                  }}
                />
                {logGrowthPreview ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-black/5">
                    <img src={logGrowthPreview} alt="" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => { setLogGrowthFile(null); setLogGrowthPreview(null); }} className="absolute top-2 right-2 py-1 px-2 rounded bg-black/60 text-white text-xs">Remove</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileInputLogGrowthRef.current?.click()} className="min-w-[44px] min-h-[44px] w-full py-4 rounded-xl border border-black/10 text-black/60 hover:bg-black/5 text-sm">Choose photo or take one</button>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-black/60 mb-1">Note</label>
                <textarea value={logGrowthNote} onChange={(e) => setLogGrowthNote(e.target.value)} placeholder="Growth update, note…" rows={3} className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm resize-none" />
              </div>
            </div>
            <div className="p-4 border-t border-black/10 flex gap-2 justify-end">
              <button type="button" onClick={() => { setLogGrowthBatch(null); if (logGrowthPreview) URL.revokeObjectURL(logGrowthPreview); setLogGrowthPreview(null); }} className="px-4 py-2 rounded-lg border border-black/10 text-sm font-medium text-black/80">Cancel</button>
              <button type="button" disabled={logGrowthSaving} onClick={handleLogGrowthSubmit} className="px-4 py-2 rounded-lg bg-emerald text-white text-sm font-medium disabled:opacity-60">{logGrowthSaving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      <HarvestModal
        open={!!logHarvestBatch}
        onClose={() => setLogHarvestBatch(null)}
        onSaved={() => { setRefetchTrigger((p: number) => p + 1); setLogHarvestBatch(null); }}
        profileId={logHarvestBatch?.plant_profile_id ?? ""}
        growInstanceId={logHarvestBatch?.id ?? ""}
        displayName={logHarvestBatch ? (logHarvestBatch.profile_variety_name?.trim() ? `${decodeHtmlEntities(logHarvestBatch.profile_name)} (${decodeHtmlEntities(logHarvestBatch.profile_variety_name)})` : decodeHtmlEntities(logHarvestBatch.profile_name)) : ""}
      />

      {endCropConfirmBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" aria-modal="true" role="dialog">
          <div className="bg-white rounded-2xl shadow-lg border border-black/10 max-w-md w-full p-4">
            <h2 className="text-lg font-semibold text-black">End Crop?</h2>
            <p className="text-sm text-black/70 mt-2">
              {endCropConfirmBatch.profile_variety_name?.trim() ? `${decodeHtmlEntities(endCropConfirmBatch.profile_name)} (${decodeHtmlEntities(endCropConfirmBatch.profile_variety_name)})` : decodeHtmlEntities(endCropConfirmBatch.profile_name)} will move to Settings → Archived Plantings.
            </p>
            <div className="flex gap-2 justify-end mt-4">
              <button type="button" onClick={() => setEndCropConfirmBatch(null)} className="px-4 py-2 rounded-lg border border-black/10 text-sm font-medium text-black/80">Cancel</button>
              <button type="button" onClick={confirmEndCrop} className="px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700">End Crop</button>
            </div>
          </div>
        </div>
      )}

      {fabMenuOpen && (
        <>
          <button type="button" className="fixed inset-0 z-20" aria-label="Close menu" onClick={() => setFabMenuOpen(false)} />
          <div className="fixed right-6 z-30 flex flex-col gap-0.5 rounded-xl border border-neutral-200 bg-white p-1.5 shadow-lg" style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px) + 4rem)" }}>
            <button type="button" onClick={() => { router.push("/vault"); setFabMenuOpen(false); }} className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-left text-sm font-medium text-neutral-800 hover:bg-neutral-50 min-h-[44px] w-full">
              <span className="text-lg" aria-hidden>🌿</span>
              <span>Plant from Seed Vault</span>
            </button>
            <button type="button" onClick={() => { setShowStoreBoughtModal(true); setFabMenuOpen(false); }} className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-left text-sm font-medium text-neutral-800 hover:bg-neutral-50 min-h-[44px] w-full">
              <span className="text-lg" aria-hidden>🏷️</span>
              <span>Add store-bought plant</span>
            </button>
            <button type="button" onClick={() => { setShowAddPermanentPlantModal(true); setFabMenuOpen(false); }} className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-left text-sm font-medium text-neutral-800 hover:bg-neutral-50 min-h-[44px] w-full">
              <span className="text-lg" aria-hidden>🌳</span>
              <span>Add permanent plant</span>
            </button>
            <button type="button" onClick={() => { if (viewMode === "active") setOpenBulkJournalForActive(true); else router.push("/journal"); setFabMenuOpen(false); }} className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-left text-sm font-medium text-neutral-800 hover:bg-neutral-50 min-h-[44px] w-full">
              <span className="text-lg" aria-hidden>📖</span>
              <span>Add journal entry</span>
            </button>
          </div>
        </>
      )}

      <button
        type="button"
        onClick={() => setFabMenuOpen((o) => !o)}
        className={`fixed right-6 z-30 w-14 h-14 rounded-full shadow-card flex items-center justify-center hover:opacity-90 transition-all ${
          fabMenuOpen ? "bg-emerald-700 text-white" : "bg-emerald text-white"
        }`}
        style={{ bottom: "calc(5rem + env(safe-area-inset-bottom, 0px))", boxShadow: "0 10px 30px rgba(0,0,0,0.08)" }}
        aria-label={fabMenuOpen ? "Close menu" : "Add to garden"}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-transform duration-200 ${fabMenuOpen ? "rotate-45" : "rotate-0"}`}
          aria-hidden
        >
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>

      {addedToMyPlantsToast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium shadow-lg animate-fade-in" role="status">
          Added to My Plants
        </div>
      )}

      <AddStoreBoughtPlantModal open={showStoreBoughtModal} onClose={() => setShowStoreBoughtModal(false)} onSuccess={() => setRefetchTrigger((t) => t + 1)} />
    </div>
  );
}

export default function GardenPage() {
  return (
    <Suspense fallback={<div className="p-6 text-neutral-600">Loading…</div>}>
      <GardenPageInner />
    </Suspense>
  );
}
