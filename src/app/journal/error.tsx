"use client";

import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export default function JournalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} pageName="the Journal" logPrefix="[Journal error boundary]" />;
}
