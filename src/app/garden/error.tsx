"use client";

import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export default function GardenError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} pageName="the Garden" logPrefix="[Garden error boundary]" />;
}
