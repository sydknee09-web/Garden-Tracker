"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingState } from "@/components/LoadingState";
import { PlantingForm } from "@/components/PlantingForm";

function VaultPlantPageInner() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const idsParam = searchParams.get("ids");
  const profileIds = idsParam ? idsParam.split(",").filter(Boolean) : [];
  const fromGarden = searchParams.get("from") === "garden";

  if (!user) return null;

  return (
    <div className="px-6 pt-8 pb-40 max-w-2xl mx-auto">
      <Link
        href={fromGarden ? "/garden" : "/vault"}
        className="inline-flex items-center gap-2 text-emerald-600 font-medium hover:underline mb-4 min-h-[44px]"
      >
        ← Back
      </Link>
      <div className="text-center mb-4">
        <h1 className="text-xl font-semibold text-black mb-1">Planting</h1>
      </div>
      <PlantingForm profileIds={profileIds} fromGarden={fromGarden} mode="page" />
    </div>
  );
}

export default function VaultPlantPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading…" className="p-6" />}>
      <VaultPlantPageInner />
    </Suspense>
  );
}
