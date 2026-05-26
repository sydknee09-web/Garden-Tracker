import type { ReactNode } from "react";
import { ICON_MAP } from "@/lib/styleDictionary";

/**
 * Form-level error display. Use for "Title is required." / "Plant name is required."
 * style validation messages AND save-failure messages (formatAddFlowError output) in
 * FAB-tree forms. Placement: bottom of form (NOT inline-by-field) — locked 2026-05-26.
 *
 * Visual contract: italic + red + small warning-icon prefix + role="alert".
 * See VISION.md §8 "Form-level error treatment".
 */
export function FormError({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="text-sm italic font-medium text-red-600 flex items-start gap-1.5"
    >
      <ICON_MAP.Warning width={16} height={16} className="flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </p>
  );
}
