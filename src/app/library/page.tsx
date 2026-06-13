"use client";

import { useState, useEffect, Suspense } from "react";
import dynamic from "next/dynamic";
import { VaultProvider } from "@/contexts/VaultContext";
import { PageSkeletonLibrary } from "@/components/PageSkeleton";

// Skeleton mirrors the loaded Library layout 1:1 (chrome cohesion sweep 2026-06-12)
// so the page doesn't shift when content lands — same wrapper, toolbar slot, grid.
const VaultPageContent = dynamic(
  () => import("../vault/VaultPageContent"),
  {
    ssr: false,
    loading: () => <PageSkeletonLibrary />,
  }
);

export default function PlantsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <PageSkeletonLibrary />;
  }

  return (
    <VaultProvider>
      <Suspense fallback={<PageSkeletonLibrary />}>
        <VaultPageContent />
      </Suspense>
    </VaultProvider>
  );
}
