/**
 * Centralized visual language: icons and design tokens.
 * Refined Architectural Luxury — clean, stroke-based SVG icons.
 * Use with Tailwind: text-emerald-luxury, bg-emerald-luxury for Add/Save actions.
 */

import type { SVGProps } from "react";

/** Base SVG props (viewBox, stroke, aria). Callers can override via className, width, height. */
function iconProps(props?: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#333333",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": props?.["aria-hidden"] ?? true,
    className: props?.className,
  };
}

/** Standard soft shadow for FAB menu container. Use className="shadow-float". */
export const FAB_MENU_SHADOW_CLASS = "shadow-float";

function AddIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  );
}

function EditIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function JournalIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
    </svg>
  );
}

function ShoppingIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

function TaskIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function TrashIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

function SeedIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M12 22v-4" />
      <path d="M12 18a6 6 0 0 0 6-6V4" />
      <path d="M12 18a6 6 0 0 1-6-6V4" />
      <path d="M12 14v-2" />
      <path d="M12 10a2 2 0 0 0 2-2V2" />
      <path d="M12 10a2 2 0 0 1-2-2V2" />
    </svg>
  );
}

function PlantIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M7 20h10" />
      <path d="M10 20c5.5-2.5 7.5-8 7.5-12a7.5 7.5 0 0 0-15 0c0 4 2 9.5 7.5 12Z" />
      <path d="M12 8v4" />
      <path d="M10 12h4" />
    </svg>
  );
}

function ShedIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M3 21V9l9-6 9 6v12H3zM9 21v-7h6v7" />
    </svg>
  );
}

function BackIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function HarvestIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M5 8h14l-1.5 10H6.5L5 8z" />
      <path d="M9 8V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M4 10h16" />
    </svg>
  );
}

function ManualEntryIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  );
}

function PhotoImportIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function PurchaseOrderIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}

function SparkleIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  );
}

function CameraIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <polyline points="9 6 15 12 9 18" />
    </svg>
  );
}

/** Journal/log entry — cupped hands with heart and sprout (care logging). */
function JournalCareHandsIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M5 19c0-3 2-6 5-7 1.5-.5 3 0 4 1" />
      <path d="M19 19c0-3-2-6-5-7-1.5-.5-3 0-4 1" />
      <path d="M12 8.5C10.5 7 8 7.5 8 9.5c0 2 4 4 4 4s4-2 4-4c0-2-2.5-2.5-4-1z" />
      <path d="M13 11v1.5c0 .8.6 1.5 1.2 1.5" />
    </svg>
  );
}

function WaterIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z" />
    </svg>
  );
}

function FertilizeIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
    </svg>
  );
}

function SprayIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M7 10l2-6h6l2 6" />
      <path d="M5 10h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V10z" />
      <path d="M9 7h6" />
      <path d="M12 4v3" />
    </svg>
  );
}

function PestIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M12 2v10" />
      <path d="M18 7a6 6 0 0 0-12 0" />
      <path d="M12 12a6 6 0 0 0 6 6H6a6 6 0 0 0 6-6z" />
      <path d="M6 13H3" />
      <path d="M18 13h3" />
      <path d="M7 19l-2 2" />
      <path d="M17 19l2 2" />
    </svg>
  );
}

function GalleryIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function ArchiveIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4" />
    </svg>
  );
}

function SaveIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function CancelIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6M9 9l6 6" />
    </svg>
  );
}

/** Plain X for modal close / dismiss (1.5 stroke). */
function CloseIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

/** Sprout/seedling for plant profile fallback (1.5 stroke). */
function SeedlingIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M12 22v-6" />
      <path d="M12 16c2.5-2 4-5 4-8a4 4 0 1 0-8 0c0 3 1.5 6 4 8z" />
      <path d="M8 10h2" />
      <path d="M14 10h2" />
    </svg>
  );
}

/** Shovel/spade for plant/sow actions (1.5 stroke). */
function ShovelIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M2 22l7-7m0 0l-4-4 7-7 4 4-7 7zM15 3l6 6" />
    </svg>
  );
}

/** Trash can (alternate style, 1.5 stroke). */
function Trash2Icon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
    </svg>
  );
}

/** Calendar for schedule/task actions (1.5 stroke). */
function CalendarIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2zM16 2v4M8 2v4M3 10h18M17 17h.01" />
    </svg>
  );
}

/** Pencil for edit (1.5 stroke). Same as Edit. */
function PencilIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

/** Merge profiles icon (1.5 stroke). */
function MergeIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M8 6h3v3H8z" />
      <path d="M13 6h3v3h-3z" />
      <path d="M10.5 12v6M8 15h5" />
    </svg>
  );
}

/** Shopping list / box with handle (1.5 stroke). */
function ShoppingListIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

/** Photo cards grid = 2x2 quadrants (1.5 stroke). */
function PhotoCardsGridIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
    </svg>
  );
}

/** Condensed grid = 3x2 denser cells (1.5 stroke). */
function CondensedGridIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <rect x="2" y="2" width="5" height="5" />
      <rect x="9.5" y="2" width="5" height="5" />
      <rect x="17" y="2" width="5" height="5" />
      <rect x="2" y="9.5" width="5" height="5" />
      <rect x="9.5" y="9.5" width="5" height="5" />
      <rect x="17" y="9.5" width="5" height="5" />
    </svg>
  );
}

/** Filter funnel (1.5 stroke). */
function FilterIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </svg>
  );
}

/** Search magnifier (1.5 stroke). */
function SearchIcon(props: SVGProps<SVGSVGElement>) {
  const p = { ...iconProps(props), ...props };
  return (
    <svg {...p}>
      <path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35" />
    </svg>
  );
}

export const ICON_MAP = {
  Add: AddIcon,
  Close: CloseIcon,
  Edit: EditIcon,
  Journal: JournalIcon,
  Shopping: ShoppingIcon,
  Task: TaskIcon,
  Trash: TrashIcon,
  Seed: SeedIcon,
  Seedling: SeedlingIcon,
  Plant: PlantIcon,
  Shed: ShedIcon,
  Back: BackIcon,
  Harvest: HarvestIcon,
  ManualEntry: ManualEntryIcon,
  PhotoImport: PhotoImportIcon,
  PurchaseOrder: PurchaseOrderIcon,
  Sparkle: SparkleIcon,
  Camera: CameraIcon,
  ChevronDown: ChevronDownIcon,
  ChevronRight: ChevronRightIcon,
  /** For "Add journal entry" / log care on cards. */
  JournalCareHands: JournalCareHandsIcon,
  Water: WaterIcon,
  Fertilize: FertilizeIcon,
  Spray: SprayIcon,
  Pest: PestIcon,
  Gallery: GalleryIcon,
  Archive: ArchiveIcon,
  Save: SaveIcon,
  Cancel: CancelIcon,
  Shovel: ShovelIcon,
  Trash2: Trash2Icon,
  Calendar: CalendarIcon,
  Pencil: PencilIcon,
  Merge: MergeIcon,
  ShoppingList: ShoppingListIcon,
  PhotoCardsGrid: PhotoCardsGridIcon,
  CondensedGrid: CondensedGridIcon,
  Filter: FilterIcon,
  Search: SearchIcon,
} as const;

export type IconKey = keyof typeof ICON_MAP;
