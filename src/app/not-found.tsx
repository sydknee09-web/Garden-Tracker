import Link from "next/link";
import { ICON_MAP } from "@/lib/styleDictionary";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-paper">
      <ICON_MAP.Sprout className="w-16 h-16 text-neutral-300 mb-4" aria-hidden />
      <h1 className="text-xl font-semibold text-neutral-900 mb-2">Page Not Found</h1>
      <p className="text-neutral-600 text-sm mb-6 text-center max-w-md">
        We couldn&apos;t find that page. Let&apos;s get you back to your garden.
      </p>
      <Link
        href="/"
        className="min-h-[44px] min-w-[120px] px-4 py-2 rounded-xl bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors flex items-center justify-center"
      >
        Back to Garden
      </Link>
    </div>
  );
}
