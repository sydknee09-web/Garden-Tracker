"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Redirect /vault/packets to /vault?tab=list for backward compatibility.
 * The Seed Vault tab (packet list) is now integrated into the main vault page.
 */
export default function AllPacketsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/vault?tab=list");
  }, [router]);

  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <p className="text-neutral-500">Redirecting to Seed Vault…</p>
    </div>
  );
}
