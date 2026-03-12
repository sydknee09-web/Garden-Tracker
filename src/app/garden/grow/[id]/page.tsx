"use client";

import { useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

/**
 * Redirect /garden/grow/[id] to /garden?grow=id so the growing instance
 * opens as a popup modal on the Garden page. Preserves from & profile params.
 */
export default function GrowInstanceRedirectPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const id = typeof params.id === "string" ? params.id : Array.isArray(params.id) ? params.id[0] : "";
  const from = searchParams.get("from");
  const profile = searchParams.get("profile");
  const gardenTab = searchParams.get("gardenTab");

  useEffect(() => {
    if (!id) {
      router.replace("/garden");
      return;
    }
    const tab = gardenTab === "plants" ? "plants" : "active";
    const query = new URLSearchParams();
    query.set("grow", id);
    query.set("tab", tab);
    if (from) query.set("from", from);
    if (profile) query.set("profile", profile);
    router.replace(`/garden?${query.toString()}`);
  }, [id, from, profile, gardenTab, router]);

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" aria-hidden />
    </div>
  );
}
