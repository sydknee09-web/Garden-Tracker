"use client";

import dynamic from "next/dynamic";

/**
 * Lazy wrapper for PacketVaultView — loaded only when Seed Vault tab is active.
 * Isolates the chunk to avoid "ep" before initialization when switching tabs.
 */
export const PacketVaultLazy = dynamic(
  () => import("@/components/PacketVaultView").then((m) => ({ default: m.PacketVaultView })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[200px] flex items-center justify-center text-neutral-500">
        Loading packets…
      </div>
    ),
  }
);
