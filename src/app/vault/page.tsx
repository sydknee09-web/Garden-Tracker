"use client";

import { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { VaultProvider } from "@/contexts/VaultContext";

const VaultPageContent = dynamic(
  () => import("./VaultPageContent"),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[50vh] flex items-center justify-center p-6 text-neutral-600">
        Loading…
        </div>
    ),
  }
);

export default function VaultPage() {
  // Defer vault content until after mount to avoid init-order issues
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-6 text-neutral-600">
        Loading…
      </div>
    );
  }

  return (
    <VaultProvider>
      <Suspense fallback={
        <div className="min-h-[50vh] flex items-center justify-center p-6 text-neutral-600">
          Loading…
        </div>
      }>
        <VaultPageContent />
      </Suspense>
    </VaultProvider>
  );
}
