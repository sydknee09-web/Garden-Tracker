# Satchel Page — UI/UX Recommendations

Actionable recommendations to make the Voyager Sanctuary Satchel page prettier and more cohesive with the app’s Japandi / cozy / ritual aesthetic. Palette and structure reference: `GEMINI_SATCHEL_UI_HANDOFF.md`, `satchel_screen.dart`, and `app_colors.dart`.

---

## 1. Visual hierarchy

- **Emphasize the Pack CTA**  
  - Treat “Pack” as the primary action when the satchel isn’t full: consider slightly larger type (e.g. 15px), letter-spacing 1.2, and ensure ember color stands out against inkBlack. Optional: subtle glow or underline on focus/press.

- **Clear title stack**  
  - Keep “Sanctuary ›” small (10px, ashGrey) as breadcrumb; keep “YOUR SATCHEL” as the main label (14px, parchment). If desired, bump “YOUR SATCHEL” to 16px and add a bit more letter-spacing for a more “ritual” feel.

- **Slot order**  
  - Filled slots first, then empty (already implemented) — this keeps the “ready to burn” content above the fold and makes empty slots feel like gentle invitation rather than clutter.

- **Typography scale**  
  - Use a consistent scale: app bar title (14–16px), tool tile labels (12px), slot content (bodyLarge), “Ready to burn” (10px). Keep Georgia and letter-spacing for headings/labels; avoid mixing in system fonts for slot text.

- **Spacing rhythm**  
  - Use a 4px base (4, 8, 12, 16, 20, 24) so ListView padding (16), section gaps (16, 8), and slot internal padding align. Increase slot row vertical padding to **14px** (from 10) for more breathing room.

---

## 2. Layout & composition

- **Tools row (Map + Whetstone)**  
  - Keep two equal tiles side-by-side with 12px gap. Ensure both have the same height (e.g. min height 100px) so the row doesn’t feel lopsided when one has shimmer. Consider a bit more horizontal padding (14px) inside each tile for balance.

- **Satchel image**  
  - Keep satchel_open.png at 80px height, centered. Add a small horizontal padding (e.g. 24px) so the image doesn’t touch the screen edge on narrow devices. The satchelSlotFilled strip behind it is good; consider 8px vertical padding above/below the image so it sits in a clear “pocket.”

- **Wood plank + slot list**  
  - Keep the wood plank as the slot area background. Ensure the plank has enough vertical padding so the first and last slot rows don’t feel clipped — e.g. 12px top/bottom padding on the Stack/Column that contains the slot rows.

- **Proportions**  
  - Slot rows: keep the slot number column at 24px; stone icon 32×32; “Ready to burn” large stone 50×50. Ensure the Hammer (gavel) and star badge don’t crowd the title — fixed widths and padding (e.g. 8px between star and large stone) keep alignment consistent.

- **Breathing room**  
  - Increase bottom margin between slot rows from 10 to **12px** so the wood texture and borders don’t feel cramped. Optional: add 4–8px horizontal margin to the plank container so it doesn’t run full-bleed on large screens.

---

## 3. Empty state

- **Empty slot styling**  
  - Use **whetPaper** at low opacity (e.g. 0.5–0.6) for the empty-slot background instead of (or blended with) satchelSlotEmpty, so empty slots feel like “vellum” pockets and align with the tooltip and Edit overlay cream. Keep satchelSlotEmptyInk for “— empty —” and slot number for readability.

- **Copy**  
  - Keep “— empty —” italic and subtle. Optional: add a single short line under the first empty slot when the satchel is new, e.g. “Pack pebbles from your peaks” (whetLine or ashGrey, 10px), so the empty state feels instructive, not barren.

- **No peaks (quest tooltip)**  
  - The vellum tooltip “Cast your first Peak here to define your journey.” is already inviting. Consider a very subtle pattern or corner flourish (e.g. a small line graphic in whetLine) so it feels like a scroll fragment rather than a plain box. Keep whetPaper 40% and slotBorder (or satchelSlotBorder) for the border.

- **Illustration**  
  - Optional: a small, muted illustration (e.g. a single pebble or a minimal mountain silhouette) in the top empty area when all slots are empty, to reinforce “your journey starts here” without clutter.

---

## 4. Filled slots

- **Card style**  
  - Filled slots already use satchelSlotFilled; keep this. For visual consistency with the Edit overlay and management cream cards (whetPaper/whetInk), consider a very subtle inner highlight (e.g. 1px lighter line at top edge using satchelSlotBorder.withValues(alpha: 0.5)) so the card reads as a “stone on wood” rather than flat.

- **Borders**  
  - Keep ember border (1.5px) when ready-to-burn and gold border when starred. Use satchelSlotBorder for default filled state. Ensure border radius is 8px to match tool tiles and tooltip.

- **Stone icon**  
  - Keep stone_medium.png; muted (ashGrey blend) when not ready, full color when ready. Ensure the 32×32 container has a consistent 10px right padding from the title so the layout doesn’t shift.

- **“Ready to burn”**  
  - Keep the current treatment (Georgia, 10px, ember, letter-spacing 0.5). Optionally add a tiny ember dot or flame icon (e.g. 8px) before the text for a quick visual cue. Ensure it doesn’t compete with the large stone on the right.

- **Hammer affordance**  
  - Replace the hardcoded `Color(0xFFB87333)` with a palette color: use **ember** or a warm copper (e.g. a new constant like `hammerCopper` between ember and gold) so the Hammer fits the palette. Ensure IconButton has at least 44×44 dp touch target (padding 8 is good; add min size if needed). Keep tooltip “Refine.”

- **Consistency with Edit/management**  
  - Edit overlay uses whetPaper 95% and whetInk for text; management sheet uses whetPaper and whetInk. Satchel filled slots are darker (wood brown); keep that contrast but use the same typography (Georgia, whetInk-like readability). For slot title and date, ensure contrast ratio meets accessibility (see §7).

---

## 5. Color & texture

- **Palette**  
  - **Background:** Keep body gradient ember 10% → inkBlack.  
  - **Empty slots:** Prefer whetPaper 50–60% or blend with satchelSlotEmpty so the page doesn’t feel too dark.  
  - **Filled slots:** satchelSlotFilled; borders satchelSlotBorder, ember (ready), gold (starred).  
  - **Tool tiles:** satchelTileBg with satchelSlotBorder; keep Map/Whetstone icons ember.  
  - **Text:** parchment for app bar and key labels; ashGrey for secondary (e.g. tile subtitles); satchelSlotEmptyInk / whetInk-alike for slot content where needed.

- **Wood plank**  
  - Keep wood_plank.png. If it feels too strong, consider a slight opacity (e.g. 0.92) or a dark overlay (inkBlack 5–10%) so the slot cards pop slightly more. Fallback: satchelSlotEmpty (or a blend) when asset is missing is already correct.

- **Gradient**  
  - Current gradient is good. Optional: extend the ember tint slightly (e.g. 15% at top) for a warmer “hearth” feel, or leave as-is for a calmer look.

- **Tooltip**  
  - Keep whetPaper 40% and rounded border; use satchelSlotBorder or slotBorder for the border so it matches the rest of the satchel surface.

---

## 6. Micro-interactions & polish

- **Slot fill**  
  - Keep the scale-up (0.85 → 1.0, 120ms, easeOut) when a slot is filled. Consider a very short haptic on “Pack” and when a slot receives a pebble (already present for Pack).

- **Slot remove**  
  - Keep fade-out + scale-down (180ms) when removing. SnackBar message is good; consider a brief ember glow on the Remove action pane before dismiss.

- **Tools row**  
  - Whetstone shimmer/spark is good; keep duration and color (ember 30%). Ensure the scale (1.02) doesn’t cause overflow. Optional: subtle scale-down on tap (0.98 for 80ms) for both tiles for press feedback.

- **Pack button**  
  - Optional: light scale or opacity animation on press (e.g. 0.97 scale for 100ms) so the CTA feels responsive.

- **Scroll**  
  - ListView already scrolls; ensure the wood plank and slot list scroll as one. No need for extra parallax unless you add a dedicated “ritual” moment (e.g. a short stagger when slots appear).

- **Loading**  
  - _WaitingPulseWidget (HearthSparkPainter, “Waiting” text) is on-brand; keep. Optionally fade in the first visible slot row when loading completes (200ms opacity 0 → 1).

---

## 7. Accessibility & clarity

- **Contrast**  
  - Ensure “— empty —” and slot numbers on empty slots meet WCAG AA: satchelSlotEmptyInk on whetPaper/satchelSlotEmpty. For filled slots, ensure title and “Ready to burn” have sufficient contrast on satchelSlotFilled (parchment or light grey on dark brown). If bodyLarge uses theme default, override to a color that passes (e.g. parchment or a light warm grey).

- **Touch targets**  
  - Pack: ensure the TextButton has at least 44×44 dp.  
  - Map and Whetstone tiles: full tile is tappable; keep min height (e.g. 100px) so they’re easy to hit.  
  - Hammer IconButton: add `minimumSize` or padding so the tap area is at least 44×44 dp.  
  - Slidable actions (Done/Return, Remove): ensure action panes are wide enough (extentRatio 0.35 is reasonable); consider Semantics labels for “Swipe right to mark done” if you add onboarding.

- **Labels**  
  - Keep Semantics on Pack (“Pack N pebbles into your satchel”), “The Map,” and “The Whetstone.” Add Semantics for each slot row where useful (e.g. “Slot N, empty” vs “Slot N, [title], ready to burn”).

- **Focus**  
  - If the app supports keyboard or switch access, ensure Pack and both tool tiles receive focus in a logical order and show a visible focus ring (e.g. ember or parchment 2px outline).

---

## Summary

- **Visual hierarchy:** Stronger Pack CTA, consistent typography scale, slot row padding 14px, 4px spacing rhythm.  
- **Layout:** Balanced tools row, padded satchel image, 12px slot margin and plank padding.  
- **Empty state:** whetPaper-tinted empty slots, optional hint copy and subtle pattern on tooltip.  
- **Filled slots:** Consistent borders and radius, palette Hammer color, 44dp Hammer tap target, optional “Ready to burn” icon.  
- **Color & texture:** Use whetPaper for empty slots; keep wood plank, optionally softened; gradient optional tweak.  
- **Micro-interactions:** Keep fill/remove animations; optional tap feedback on tiles and Pack.  
- **Accessibility:** Contrast check on slot text, 44dp targets, Semantics on key controls.

Save implementation details in code comments or a short “Satchel UI spec” section in the codebase so future changes stay consistent with this aesthetic.
