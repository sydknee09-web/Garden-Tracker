"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import type { TagSetting } from "@/types/garden";

const TAG_COLOR_PRESETS: { value: string; label: string }[] = [
  { value: "bg-amber-100 text-amber-800 border-amber-200", label: "Amber" },
  { value: "bg-emerald-100 text-emerald-800 border-emerald-200", label: "Emerald" },
  { value: "bg-violet-100 text-violet-800 border-violet-200", label: "Violet" },
  { value: "bg-teal-100 text-teal-800 border-teal-200", label: "Teal" },
  { value: "bg-sky-100 text-sky-800 border-sky-200", label: "Sky" },
  { value: "bg-rose-100 text-rose-800 border-rose-200", label: "Rose" },
  { value: "bg-neutral-100 text-neutral-700 border-neutral-200", label: "Neutral" },
];

const DISCOVERED_TAG_COLOR = "bg-neutral-100 text-neutral-700 border-neutral-200";

export default function VaultTagsPage() {
  const { user } = useAuth();
  const [tagSettings, setTagSettings] = useState<TagSetting[]>([]);
  const [vaultTagNames, setVaultTagNames] = useState<string[]>([]);
  const [tagCounts, setTagCounts] = useState<Record<string, number>>({});
  const [blockedTagNames, setBlockedTagNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLOR_PRESETS[0].value);
  const [tagSaving, setTagSaving] = useState(false);
  const [editingTagName, setEditingTagName] = useState<string | null>(null);
  const [editingTagColor, setEditingTagColor] = useState(TAG_COLOR_PRESETS[0].value);
  const [tagSaveError, setTagSaveError] = useState<string | null>(null);
  const [removingTag, setRemovingTag] = useState<string | null>(null);
  const [blockingTagName, setBlockingTagName] = useState<string | null>(null);
  const [unblockingTagName, setUnblockingTagName] = useState<string | null>(null);

  const loadTagSettings = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("tag_settings")
      .select("id, user_id, name, color, sort_order, created_at")
      .eq("user_id", user.id)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    setTagSettings((data ?? []) as TagSetting[]);
  }, [user?.id]);

  const loadVaultTags = useCallback(async () => {
    if (!user?.id) return;
    const [profilesRes, packetsRes] = await Promise.all([
      supabase.from("plant_profiles").select("tags").eq("user_id", user.id),
      supabase.from("seed_packets").select("tags").eq("user_id", user.id),
    ]);
    const all = new Set<string>();
    const counts: Record<string, number> = {};
    const countTag = (t: string) => {
      const s = String(t).trim();
      if (!s) return;
      all.add(s);
      counts[s] = (counts[s] ?? 0) + 1;
    };
    (profilesRes.data ?? []).forEach((r: { tags?: string[] | null }) => (r.tags ?? []).forEach(countTag));
    (packetsRes.data ?? []).forEach((r: { tags?: string[] | null }) => (r.tags ?? []).forEach(countTag));
    setVaultTagNames(Array.from(all).sort((a, b) => a.localeCompare(b)));
    setTagCounts(counts);
  }, [user?.id]);

  const loadBlockedTags = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("blocked_tags")
      .select("tag_name")
      .eq("user_id", user.id)
      .order("tag_name", { ascending: true });
    setBlockedTagNames((data ?? []).map((r: { tag_name: string }) => r.tag_name));
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    Promise.all([loadTagSettings(), loadVaultTags(), loadBlockedTags()]).then(() => setLoading(false));
  }, [user?.id, loadTagSettings, loadVaultTags, loadBlockedTags]);

  const removeTagFromAllPlants = useCallback(
    async (tagName: string) => {
      if (!user?.id) return;
      const [profilesRes, packetsRes] = await Promise.all([
        supabase.from("plant_profiles").select("id, tags").eq("user_id", user.id),
        supabase.from("seed_packets").select("id, tags").eq("user_id", user.id),
      ]);
      const toUpdateProfiles = (profilesRes.data ?? []).filter(
        (r: { tags?: string[] | null }) => Array.isArray(r.tags) && r.tags.includes(tagName)
      );
      const toUpdatePackets = (packetsRes.data ?? []).filter(
        (r: { tags?: string[] | null }) => Array.isArray(r.tags) && r.tags.includes(tagName)
      );
      const newTags = (tags: string[] | null) => (tags ?? []).filter((t) => t !== tagName);
      const uid = user.id;
      await Promise.all([
        ...toUpdateProfiles.map((p: { id: string; tags?: string[] | null }) =>
          supabase.from("plant_profiles").update({ tags: newTags(p.tags ?? null) }).eq("id", p.id).eq("user_id", uid)
        ),
        ...toUpdatePackets.map((p: { id: string; tags?: string[] | null }) =>
          supabase.from("seed_packets").update({ tags: newTags(p.tags ?? null) }).eq("id", p.id).eq("user_id", uid)
        ),
      ]);
      await loadVaultTags();
    },
    [user?.id, loadVaultTags]
  );

  const handleRemoveTag = useCallback(
    async (tagName: string) => {
      if (!user?.id) return;
      setRemovingTag(tagName);
      await removeTagFromAllPlants(tagName);
      await supabase.from("tag_settings").delete().eq("user_id", user.id).eq("name", tagName);
      await loadTagSettings();
      await loadVaultTags();
      setRemovingTag(null);
    },
    [user?.id, removeTagFromAllPlants, loadTagSettings, loadVaultTags]
  );

  const handleBlockTag = useCallback(
    async (tagName: string) => {
      if (!user?.id) return;
      setBlockingTagName(tagName);
      await removeTagFromAllPlants(tagName);
      await supabase.from("tag_settings").delete().eq("user_id", user.id).eq("name", tagName);
      await supabase.from("blocked_tags").upsert({ user_id: user.id, tag_name: tagName }, { onConflict: "user_id,tag_name" });
      await loadTagSettings();
      await loadVaultTags();
      await loadBlockedTags();
      setBlockingTagName(null);
    },
    [user?.id, removeTagFromAllPlants, loadTagSettings, loadVaultTags, loadBlockedTags]
  );

  const handleUnblockTag = useCallback(
    async (tagName: string) => {
      if (!user?.id) return;
      setUnblockingTagName(tagName);
      await supabase.from("blocked_tags").delete().eq("user_id", user.id).eq("tag_name", tagName);
      await loadBlockedTags();
      setUnblockingTagName(null);
    },
    [user?.id, loadBlockedTags]
  );

  const saveDiscoveredTag = useCallback(
    async (name: string, color: string) => {
      if (!user?.id || !name.trim()) return;
      setTagSaveError(null);
      setTagSaving(true);
      const { error } = await supabase.from("tag_settings").insert({
        user_id: user.id,
        name: name.trim(),
        color,
        sort_order: tagSettings.length,
      });
      if (error) {
        setTagSaveError(error.message ?? "Could not save tag");
        setTagSaving(false);
        return;
      }
      setEditingTagName(null);
      setTagSaving(false);
      await loadTagSettings();
    },
    [user?.id, tagSettings.length, loadTagSettings]
  );

  const addTag = useCallback(async () => {
    const name = newTagName.trim();
    if (!user?.id || !name || tagSaving) return;
    setTagSaving(true);
    const { error } = await supabase
      .from("tag_settings")
      .insert({ user_id: user.id, name, color: newTagColor, sort_order: tagSettings.length });
    if (!error) {
      setNewTagName("");
      await loadTagSettings();
    }
    setTagSaving(false);
  }, [user?.id, newTagName, newTagColor, tagSaving, tagSettings.length, loadTagSettings]);

  return (
    <div className="min-h-screen bg-neutral-50 px-6 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 text-neutral-600 hover:text-neutral-900 font-medium"
          >
            ← Back to Settings
          </Link>
          <span className="text-neutral-400">|</span>
          <Link href="/vault" className="inline-flex items-center gap-2 text-emerald-600 hover:text-emerald-700 font-medium">
            Back to Vault
          </Link>
        </div>

        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Tag HQ</h1>
        <p className="text-sm text-neutral-600 mb-6">
          Manage tags on your plants. Assign colors for the vault filter; Remove scrubs a tag from all plants; Block prevents AI from adding it again.
        </p>

        {loading ? (
          <p className="text-neutral-500 text-sm">Loading tags…</p>
        ) : (
          <>
            {tagSaveError && (
              <p className="text-sm text-red-600 mb-4 py-2 px-3 rounded-lg bg-red-50" role="alert">
                {tagSaveError}
              </p>
            )}

            {/* Blocked Tags – top */}
            <section className="mb-8" aria-label="Blocked tags">
              <h2 className="text-sm font-semibold text-neutral-700 mb-2">Blocked Tags</h2>
              <p className="text-xs text-neutral-500 mb-2">
                AI will not add these when extracting. Unblock does not add the tag back to existing plants.
              </p>
              {blockedTagNames.length === 0 ? (
                <p className="text-sm text-neutral-500 py-2">No blocked tags.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {blockedTagNames.map((tagName) => (
                    <li key={tagName} className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700">
                      <span>{tagName}</span>
                      <button
                        type="button"
                        onClick={() => handleUnblockTag(tagName)}
                        disabled={unblockingTagName === tagName}
                        className="min-w-[28px] min-h-[28px] flex items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-200 hover:text-neutral-800 disabled:opacity-50"
                        aria-label={`Unblock ${tagName}`}
                      >
                        {unblockingTagName === tagName ? "…" : "✕"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Active Tags – table */}
            <section className="mb-8" aria-label="Active vault tags">
              <h2 className="text-sm font-semibold text-neutral-700 mb-2">Active Vault Tags</h2>
              {vaultTagNames.length === 0 ? (
                <p className="text-sm text-neutral-500 py-4 px-4 rounded-xl border border-neutral-200 bg-white">
                  No tags on your plants yet. Add one below or import seeds to discover tags.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                  <table className="w-full text-sm border-collapse" aria-label="Active tags">
                    <thead>
                      <tr className="border-b border-neutral-200 bg-neutral-50">
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700">Tag</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700 w-20">Count</th>
                        <th className="text-left py-3 px-4 font-semibold text-neutral-700 min-w-[200px]">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vaultTagNames.map((name) => {
                        const saved = tagSettings.find((t) => t.name === name);
                        const pillColor = editingTagName === name ? editingTagColor : (saved?.color ?? DISCOVERED_TAG_COLOR);
                        const count = tagCounts[name] ?? 0;
                        return (
                          <tr key={name} className="border-b border-neutral-100 last:border-0 hover:bg-neutral-50/50">
                            <td className="py-2.5 px-4">
                              <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full border ${pillColor}`}>
                                {name}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-neutral-600">{count}</td>
                            <td className="py-2.5 px-4">
                              <div className="flex flex-wrap items-center gap-1.5">
                                {editingTagName === name ? (
                                  <>
                                    <select
                                      value={editingTagColor}
                                      onChange={(e) => setEditingTagColor(e.target.value)}
                                      className="rounded-lg border border-neutral-300 px-2 py-1 text-sm"
                                      aria-label="Tag color"
                                    >
                                      {TAG_COLOR_PRESETS.map((p) => (
                                        <option key={p.value} value={p.value}>{p.label}</option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => saveDiscoveredTag(name, editingTagColor)}
                                      disabled={tagSaving}
                                      className="min-h-[36px] px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50"
                                    >
                                      {tagSaving ? "…" : "Save"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => { setEditingTagName(null); setTagSaveError(null); }}
                                      className="min-h-[36px] px-2.5 py-1 rounded-lg border border-neutral-300 text-neutral-600 text-xs hover:bg-neutral-50"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => { setEditingTagName(name); setEditingTagColor(saved?.color ?? DISCOVERED_TAG_COLOR); setTagSaveError(null); }}
                                      className="min-h-[36px] px-2.5 py-1 rounded-lg border border-neutral-300 text-neutral-600 text-xs hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                                    >
                                      Assign color
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTag(name)}
                                      disabled={removingTag === name}
                                      className="min-h-[36px] px-2.5 py-1 rounded-lg border border-neutral-300 text-neutral-500 text-xs hover:bg-red-50 hover:text-red-700 hover:border-red-200 disabled:opacity-50"
                                      title="Remove from all plants and saved settings"
                                    >
                                      {removingTag === name ? "…" : "Remove"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleBlockTag(name)}
                                      disabled={blockingTagName === name}
                                      className="min-h-[36px] px-2.5 py-1 rounded-lg border border-red-200 text-red-700 text-xs hover:bg-red-50 disabled:opacity-50"
                                      title="Remove from vault and block AI from adding this tag again"
                                    >
                                      {blockingTagName === name ? "…" : "Block"}
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Add tag */}
            <section aria-label="Add tag">
              <h2 className="text-sm font-semibold text-neutral-700 mb-2">Add tag</h2>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="new-tag-name" className="block text-xs font-medium text-neutral-600 mb-1">Tag name</label>
                  <input
                    id="new-tag-name"
                    type="text"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="e.g. Cutting Flower"
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm min-w-[160px]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-600 mb-1">Color</label>
                  <select
                    value={newTagColor}
                    onChange={(e) => setNewTagColor(e.target.value)}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  >
                    {TAG_COLOR_PRESETS.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={addTag}
                  disabled={!newTagName.trim() || tagSaving}
                  className="min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50"
                >
                  {tagSaving ? "Adding…" : "Add tag"}
                </button>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
