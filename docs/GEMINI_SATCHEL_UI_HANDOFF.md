# Satchel Page — UI Handoff for Gemini

**Purpose:** Get concrete recommendations to make the Satchel page prettier and better looking.  
**App aesthetic:** Japandi / Studio Ghibli–esque. Cozy, ritual-over-task-list. Elias as guide. Palette: parchment, whetPaper, whetInk, whetLine, ember, gold, charcoal, inkBlack. Warm neutrals, no bright colors.

---

## Current Satchel page (lib/features/satchel/satchel_screen.dart)

**Layout (top to bottom):**
- **App bar:** "Sanctuary ›" (small, ashGrey) + "YOUR SATCHEL" (letter-spacing animation, parchment). Action: "Pack" (ember TextButton) when not full.
- **Body:** Dark gradient (ember 10% → inkBlack). ListView with:
  1. Optional vellum tooltip: "Cast your first Peak here…" (whetPaper 40%, rounded border) when no mountains + quest step 1 seen.
  2. **_ToolsSection:** Two tiles side-by-side — "The Map" (icon map_outlined) and "The Whetstone" (icon auto_fix_high), each with subtitle. Background satchelTileBg, border satchelSlotBorder, 12px radius. Whetstone can show shimmer/spark when habits incomplete.
  3. Centered **satchel_open.png** image (80px height) on satchelSlotFilled background.
  4. **Wood plank** background image with 6 **slot rows** stacked vertically. Each row:
     - **Empty:** "— empty —" (italic, satchelSlotEmptyInk), slot number 1–6, rounded rect (satchelSlotEmpty, subtle border).
     - **Filled:** Slot number, stone_medium icon (muted or full color when ready), title (or "(untitled)"), optional due date (calendar icon + ember), "Ready to burn" when toggled, optional star badge, Hammer icon (gavel), optional large stone when ready. Slidable: swipe right = Done/Return, swipe left = Remove. Colors: satchelSlotFilled, ember border when ready, gold border when starred.

**Colors (AppColors):** satchelSlotEmpty (warm parchment tan), satchelSlotEmptyInk, satchelSlotFilled (warm wood brown), satchelSlotBorder, satchelTileBg, parchment, ember, gold, ashGrey, inkBlack.

**Assets:** assets/satchel/satchel_open.png, assets/images/wood_plank.png, assets/stones/stone_medium.png, stone_large.png.

**Related:** Management menu and Edit overlay use whetPaper/whetInk/whetLine; VOYAGER_SANCTUARY_UI_AUDIT has button/layout guidance; BUILD_GUIDANCE mentions Satchel untitled ("(untitled)" already shown in code).

---

## Request for Gemini

Produce **actionable UI/UX recommendations** to make the Satchel page **prettier and better looking**, consistent with the app’s Japandi/cozy/ritual aesthetic. Include:

1. **Visual hierarchy** — What to emphasize (e.g. Pack CTA, filled slots vs empty), spacing, typography scale.
2. **Layout & composition** — Tools row, satchel image, slot list: proportions, alignment, breathing room. Any suggested reorder or grouping.
3. **Empty state** — How to make empty slots and the “no peaks” state feel inviting rather than barren (copy, illustration, subtle pattern).
4. **Filled slots** — Card style, borders, stone icon placement, “Ready to burn” treatment, Hammer affordance. Consistency with Edit overlay / management cream cards.
5. **Color & texture** — Use of palette (parchment, whetPaper, ember, satchelSlot*). Wood plank: keep, replace, or soften. Gradient: adjust or leave.
6. **Micro-interactions & polish** — Animations (e.g. slot fill already has scale-up; remove has fade). Any additional motion or feedback that would elevate the page.
7. **Accessibility & clarity** — Contrast, touch targets, labels (Semantics already on Pack and tiles). Any quick wins.

Format: markdown with short sections and bullet or numbered lists. Be specific (e.g. “Increase slot row vertical padding to 14” or “Use whetPaper for empty-slot background instead of satchelSlotEmpty”). Where relevant, reference the existing palette and components (e.g. management menu cream cards, Edit overlay max height/scroll). Save the output to **docs/SATCHEL_UI_RECOMMENDATIONS.md**.
