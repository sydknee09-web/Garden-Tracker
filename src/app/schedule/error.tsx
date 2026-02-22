"use client";

import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export default function ScheduleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} pageName="Schedule" logPrefix="[Schedule error boundary]" />;
}
