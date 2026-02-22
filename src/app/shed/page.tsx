"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Redirect /shed to vault Shed tab so Shed is inline with Plant Profiles and Seed Vault. */
export default function ShedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const category = searchParams.get("category");
    const href = category ? `/vault?tab=shed&category=${category}` : "/vault?tab=shed";
    router.replace(href);
  }, [router, searchParams]);

  return <div className="p-6">Redirecting…</div>;
}
