"use client";

import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export default function GrowInstanceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} pageName="Plant" logPrefix="[Grow instance error boundary]" />;
}
