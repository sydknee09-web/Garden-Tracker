"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

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
  // Defer vault content until after mount to avoid "ep" before initialization
  // (usePathname/useSearchParams + heavy imports trigger init-order issues)
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

  return <VaultPageContent />;
}
