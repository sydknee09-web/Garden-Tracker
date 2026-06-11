"use client";

import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export default function CalendarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} pageName="the Calendar" logPrefix="[Calendar error boundary]" />;
}
