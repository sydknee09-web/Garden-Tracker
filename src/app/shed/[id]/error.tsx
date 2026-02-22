"use client";

import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export default function ShedDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} pageName="Supply" logPrefix="[Shed detail error boundary]" />;
}
