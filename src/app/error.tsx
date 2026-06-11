"use client";

import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} logPrefix="[Error boundary]" fullScreen />;
}
