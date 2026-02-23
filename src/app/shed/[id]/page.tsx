"use client";

import { useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";

/** Redirect /shed/[id] to /vault/shed/[id] so supply detail lives under vault. */
export default function ShedPageRedirect() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params?.id as string | undefined;

  useEffect(() => {
    if (!id) return;
    const category = searchParams.get("category");
    const href = category ? `/vault/shed/${id}?category=${category}` : `/vault/shed/${id}`;
    router.replace(href);
  }, [id, searchParams, router]);

  return <div className="p-6">Redirecting…</div>;
}
