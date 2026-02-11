"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

type CacheEntry = {
  id: string;
  updated_at: string;
  source_url: string;
  identity_key: string;
  vendor: string | null;
  extract_data: Record<string, unknown>;
  hero_storage_path: string | null;
  original_hero_url: string | null;
};

function heroThumbUrl(entry: CacheEntry): string | null {
  if (entry.hero_storage_path) {
    const { data } = supabase.storage.from("journal-photos").getPublicUrl(entry.hero_storage_path);
    if (data?.publicUrl) return data.publicUrl;
  }
  const ext = entry.original_hero_url?.trim();
  if (ext?.startsWith("http")) return ext;
  return null;
}

export default function ExtractCachePage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadEntries = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("plant_extract_cache")
        .select("id, updated_at, source_url, identity_key, vendor, extract_data, hero_storage_path, original_hero_url")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(500);
      if (!error) setEntries((data ?? []) as CacheEntry[]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const clearAll = useCallback(async () => {
    if (!user?.id || clearing) return;
    setClearing(true);
    await supabase.from("plant_extract_cache").delete().eq("user_id", user.id);
    setEntries([]);
    setClearing(false);
  }, [user?.id, clearing]);

  const deleteRow = useCallback(
    async (id: string) => {
      if (!user?.id) return;
      setDeletingId(id);
      await supabase.from("plant_extract_cache").delete().eq("id", id).eq("user_id", user.id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
      setDeletingId(null);
    },
    [user?.id]
  );

  return (
    <div className="px-6 py-8 max-w-5xl mx-auto">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-6"
      >
        &larr; Back to Settings
      </Link>
      <h1 className="text-2xl font-bold text-neutral-900 mb-2">Plant Extract Cache</h1>
      <p className="text-sm text-neutral-600 mb-4">
        Cached plant details and hero photos from previous imports. Re-importing a cached URL skips AI extraction entirely.
        Delete an entry to force a fresh extraction on next import.
      </p>

      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-neutral-600">
          {loading
            ? "Loading\u2026"
            : `${entries.length} cached entr${entries.length === 1 ? "y" : "ies"}`}
        </p>
        <button
          type="button"
          onClick={clearAll}
          disabled={clearing || entries.length === 0}
          className="min-h-[44px] px-4 py-2 rounded-xl border border-neutral-300 text-neutral-700 text-sm font-medium hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {clearing ? "Clearing\u2026" : "Clear All"}
        </button>
      </div>

      {loading ? (
        <p className="text-neutral-500 text-sm">Loading\u2026</p>
      ) : entries.length === 0 ? (
        <p className="text-neutral-500 text-sm">
          No cached entries yet. Import seeds and save to vault to populate the cache.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm border-collapse" aria-label="Plant extract cache entries">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50/80">
                <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-600">Hero</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-600">Type / Variety</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-600">Vendor</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-600">Identity Key</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-600 max-w-[200px]">URL</th>
                <th className="text-left py-2 px-3 text-xs font-semibold text-neutral-600">Updated</th>
                <th className="py-2 px-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map((row) => {
                const ed = row.extract_data ?? {};
                const plantType = (ed.type as string) ?? "";
                const variety = (ed.variety as string) ?? "";
                const thumb = heroThumbUrl(row);
                return (
                  <tr key={row.id} className="border-b border-neutral-100 last:border-0">
                    <td className="py-2 px-3 align-middle">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt=""
                          className="w-10 h-10 rounded object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <span className="inline-block w-10 h-10 rounded bg-neutral-100 text-center leading-10 text-neutral-400 text-xs">
                          —
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-neutral-800 align-middle">
                      <span className="font-medium">{plantType}</span>
                      {variety ? <span className="text-neutral-500"> {variety}</span> : null}
                    </td>
                    <td className="py-2 px-3 text-neutral-700 align-middle">{row.vendor ?? "—"}</td>
                    <td
                      className="py-2 px-3 text-neutral-600 truncate max-w-[140px] align-middle"
                      title={row.identity_key}
                    >
                      {row.identity_key}
                    </td>
                    <td
                      className="py-2 px-3 max-w-[200px] truncate align-middle"
                      title={row.source_url}
                    >
                      <a
                        href={row.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-600 hover:underline"
                      >
                        {row.source_url.length > 50
                          ? row.source_url.slice(0, 50) + "\u2026"
                          : row.source_url}
                      </a>
                    </td>
                    <td className="py-2 px-3 text-neutral-600 whitespace-nowrap align-middle">
                      {new Date(row.updated_at).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 align-middle">
                      <button
                        type="button"
                        onClick={() => deleteRow(row.id)}
                        disabled={deletingId === row.id}
                        className="text-neutral-400 hover:text-red-500 disabled:opacity-40 transition-colors"
                        title="Delete this cache entry"
                        aria-label="Delete cache entry"
                      >
                        {deletingId === row.id ? "\u2026" : "\u2715"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
