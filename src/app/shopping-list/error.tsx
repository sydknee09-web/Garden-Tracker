"use client";

import { RouteErrorFallback } from "@/components/RouteErrorFallback";

export default function ShoppingListError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteErrorFallback error={error} reset={reset} pageName="Shopping List" logPrefix="[Shopping List error boundary]" />;
}
