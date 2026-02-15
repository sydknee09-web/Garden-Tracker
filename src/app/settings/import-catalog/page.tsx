"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

type Result = {
  ok: boolean;
  inserted?: number;
  skipped?: number;
  parsed?: number;
  pages?: number;
  error?: string;
};

export default function ImportCatalogPage() {
  const { user, session } = useAuth();
  const [vendor, setVendor] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.access_token || !vendor.trim() || !file) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.set("vendor", vendor.trim());
      formData.set("file", file);
      const res = await fetch("/api/settings/import-catalog", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as Result & { error?: string };
      if (!res.ok) {
        setResult({ ok: false, error: data.error ?? `HTTP ${res.status}` });
        return;
      }
      setResult({
        ok: true,
        inserted: data.inserted,
        skipped: data.skipped,
        parsed: data.parsed,
        pages: data.pages,
      });
      setFile(null);
      if (typeof document !== "undefined" && document.getElementById("file-input") instanceof HTMLInputElement) {
        (document.getElementById("file-input") as HTMLInputElement).value = "";
      }
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="px-4 py-6 max-w-2xl mx-auto pb-24">
      <Link
        href="/settings"
        className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4 min-h-[44px] items-center"
      >
        ← Back to Settings
      </Link>
      <h1 className="text-xl font-bold text-neutral-900 mb-1">Import Vendor Catalog</h1>
      <p className="text-sm text-neutral-500 mb-4">
        Upload a PDF catalog from a vendor that doesn’t have a website. Plants will be added to the shared cache so they appear in Quick Add and link import.
      </p>

      <form onSubmit={handleSubmit} className="rounded-xl border border-black/10 bg-white p-4 space-y-4">
        <div>
          <label htmlFor="vendor" className="block text-sm font-medium text-neutral-700 mb-1">
            Vendor name
          </label>
          <input
            id="vendor"
            type="text"
            value={vendor}
            onChange={(e) => setVendor(e.target.value)}
            placeholder="e.g. Geo Seed"
            className="w-full min-h-[44px] px-3 rounded-lg border border-black/15 bg-white text-neutral-900 placeholder:text-neutral-400"
            required
          />
        </div>
        <div>
          <label htmlFor="file-input" className="block text-sm font-medium text-neutral-700 mb-1">
            PDF catalog
          </label>
          <input
            id="file-input"
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-black/15 bg-white text-neutral-900 file:mr-2 file:rounded file:border-0 file:bg-emerald-50 file:text-emerald-700 file:font-medium"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !vendor.trim() || !file}
          className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-lg bg-emerald-600 text-white font-medium disabled:opacity-50 disabled:pointer-events-none"
        >
          {loading ? "Importing…" : "Import catalog"}
        </button>
      </form>

      {result && (
        <div
          className={`mt-4 p-4 rounded-xl border ${
            result.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900"
          }`}
        >
          {result.ok ? (
            <p className="text-sm">
              Done. Inserted/updated <strong>{result.inserted ?? 0}</strong> plants, skipped {result.skipped ?? 0}.
              {result.pages != null && (
                <span className="block mt-1 text-neutral-600">Processed {result.pages} page(s), {result.parsed ?? 0} parsed rows.</span>
              )}
            </p>
          ) : (
            <p className="text-sm">{result.error}</p>
          )}
        </div>
      )}
    </div>
  );
}
