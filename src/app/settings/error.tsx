"use client";

import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} pageName="Settings" logPrefix="[Settings error boundary]" />;
}
