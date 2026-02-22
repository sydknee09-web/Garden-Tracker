"use client";

import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export default function VaultDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} pageName="Plant Profile" logPrefix="[Vault detail error boundary]" />;
}
