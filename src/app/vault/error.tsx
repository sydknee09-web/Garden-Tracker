"use client";

import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export default function VaultError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} pageName="the Vault" logPrefix="[Vault error boundary]" />;
}
