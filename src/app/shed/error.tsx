"use client";

import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export default function ShedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} pageName="Shed" logPrefix="[Shed error boundary]" />;
}
