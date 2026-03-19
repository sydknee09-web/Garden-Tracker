# Architect Mode & Map Edit Flow — Audit

**Purpose:** Audit the Architect mode (mallet) and the process of adding boulders/pebbles/shards on an existing peak, document issues, and align with a codified menu standard (from intro/campsite fixes) for Gemini input.

---

## 1. Current flow (as implemented)

### 1.1 Entry

- **Map (Scroll):** User sees list of peaks (mountains). Tap a peak card → `context.push('${AppRoutes.scroll}/${mountainId}')` → **Mountain Detail Screen**.
- **Mountain Detail Screen:** Single peak view: intent statement, progress bar, momentum, then either “No boulders yet” or a list of **boulder tiles**. Each boulder shows title and nested **pebbles** (tasks). Shards appear under pebbles when split.
- **Architect mode:** Toggle in the **app bar** (action): label `ARCHITECT` / `ARCHITECT ✕`. Tap toggles `_malletActive` (local state in `MountainDetailScreen`). When active:
  - Empty peak: “Add boulder” button appears.
  - With boulders: each boulder row shows **+ (Add pebble)**; each pebble row shows **hammer (Split)**. Tapping runs the corresponding mallet action.

### 1.2 Actions (mallet)

| Action | Trigger | Result | **Side effect** |
|--------|--------|--------|------------------|
| Add boulder | “Add boulder” (when no boulders) | `createBoulder()` → new milestone | **`_malletActive = false`** |
| Add pebble | + on a boulder row | `createNodeUnderParent(pebble)` + `movePebbleToReady()` | **`_malletActive = false`** |
| Split pebble | Hammer on pebble | `split(pebble)` → shard | **`_malletActive = false`** |
| Split shard | Hammer on shard | `split(shard)` | **`_malletActive = false`** |

So **every mallet use turns Architect off**. To add several pebbles or split several items, the user must re-enable Architect after each action.

### 1.3 Edit overlay (tap to refine)

- **Trigger:** Tap a boulder title or pebble title (not the mallet buttons) → `_openEditOverlay(EditTarget)`.
- **Implementation:** `showGeneralDialog` → **EditFlowOverlay** (full-screen, dimmed background, compass “Stow the Map” top-right).
- **Edit overlay content:** Elias + cream card (`whetPaper`) with:
  - Elias line (e.g. “Open Edit”)
  - Target display name
  - **Rename** (inline or dialog)
  - **Boulder only:** “Shatter into Pebbles” → Add pebble flow (name pebble)
  - **Pebble only:** “Refine into Shards” → Add shard flow (name shard)
  - **Delete** (with confirm dialog)
- **Add pebble/shard sub-flow:** Card switches to “Strike the Stone” + “Name this pebble” / “Name this shard” + text field + Add/Cancel. On submit: create node, invalidate, SnackBar, card switches back to default edit card. **Architect state is not touched** (edit overlay doesn’t know about `_malletActive`).
- **Close:** Compass or back → `Navigator.pop()` → `invalidateAfterNodeMutation`. Architect remains in whatever state it was when the overlay was opened.

### 1.4 Other dialogs

- **Chronicle this Peak:** `showDialog` → AlertDialog (title, content, Cancel / Chronicle). No interaction with Architect.
- **Rename / Delete confirm:** Inside EditFlowOverlay, `showDialog` for delete confirmation. No interaction with Architect.

### 1.5 Navigation

- **Stow the Map:** Leading app bar button or Edit overlay compass → `context.go(AppRoutes.scroll)` or pop. Mountain Detail is left; Architect state is local so it’s lost when leaving the screen.

---

## 2. Reported issues

1. **Menus not all visible when opening the screen**  
   Likely causes: viewport (e.g. SingleChildScrollView with bottom padding 100), keyboard (viewInsets), or overlay layout (EditFlowOverlay padding / maxHeight) cutting off content on small screens or when keyboard is open.

2. **Architect mode auto-exits while still editing**  
   **Root cause in code:** Every mallet handler does `setState(() => _malletActive = false)` after the action. So after one “Add pebble” or “Split,” Architect turns off. User expectation: stay in Architect until they tap “ARCHITECT ✕” or leave the screen.

3. **Flow feels clunky**  
   - Having to re-enable Architect after each add/split.
   - Possible overlap or ordering of full-screen overlay vs dialogs (edit vs rename vs delete confirm).
   - Inconsistent styling vs intro/campsite (see below).

---

## 3. Intro / campsite standard (to reuse)

From recent fixes and design choices:

- **Cream/scroll style:** Backgrounds like `whetPaper` / parchment; borders `whetLine`; text `whetInk`; cards have rounded corners and subtle borders. Used in management menu, wizard nav row, campsite intro.
- **Typewriter + tap-to-skip:** When text “types,” tap skips to full text without glitch (flag to stop the typing loop).
- **Stagger:** Inputs/CTAs appear after a short delay (~1.2s) so dialogue shows first, then controls.
- **Single primary action per step:** One “Continue” or “Stow the Map” per step; avoid duplicate labels (e.g. one “Stow the Map” when opened from management).
- **Elias presence:** Elias head/silhouette next to dialogue where appropriate; floating head for bridge moments.
- **Bottom sheet / overlay consistency:** Same padding, safe area, drag handle, and dismiss behavior where applicable.

**Ask:** Apply this standard to Map/Architect flows (Edit overlay, name-this-pebble/shard cards, confirm dialogs) so all “menus” feel the same and appear properly (visibility, keyboard, small screens).

---

## 4. Request for Gemini

1. **Architect persistence:** Recommend the minimal change so Architect mode stays on across multiple mallet actions (add boulder, add pebble, split pebble, split shard) and only turns off when the user taps “ARCHITECT ✕” or leaves the peak (e.g. Stow the Map). Consider any edge cases (e.g. after “Add boulder” when list was empty, or after error).

2. **Menu visibility:** From the described layout (Mountain Detail: SingleChildScrollView, padding bottom 100; EditFlowOverlay: Padding 24, 56, 24, 24+viewInsets.bottom; SingleChildScrollView + ConstrainedBox maxWidth 400), suggest concrete checks or changes so all actions (Rename, Shatter into Pebbles, Refine into Shards, Delete, Add/Cancel in add-child card) remain visible on small viewports and with keyboard open.

3. **Flow and codification:** Suggest a short list of concrete steps (e.g. “use cream card for all Edit sub-cards,” “ensure all dialogs use same maxHeight + scroll,” “add stagger for edit card content”) so the Map/Architect menus match the intro/campsite standard and feel consistent.

4. **Optional:** If there’s a simple way to make the Edit overlay a bottom sheet or a non–full-screen “card” that doesn’t cover the whole screen (so the user can still see the peak and Architect state), note pros/cons and whether to do it in a first pass.

---

## 5. File references

- Architect toggle + mallet handlers: `lib/features/scroll_map/mountain_detail_screen.dart` (e.g. lines 124–138, 267–299, 352–418).
- Edit overlay + add pebble/shard: `lib/features/scroll_map/edit_flow_overlay.dart` (full file).
- Map entry: `lib/features/scroll_map/scroll_map_screen.dart` (tap card → push).
- Intro/campsite patterns: `lib/features/onboarding/elias_intro_overlay.dart`, management menu `lib/features/management/management_menu_sheet.dart`, climb wizard nav `lib/features/scroll_map/climb_flow_overlay.dart` (_WizardNavRow cream container).

---

## 6. Response: Architect persistence, visibility, codification

### 6.1 Architect persistence (minimal code change)

**Change applied:** Remove the `setState(() => _malletActive = false)` at the end of all four mallet handlers in `mountain_detail_screen.dart`:

- **`_malletOnMountain`** (Add boulder when no boulders)
- **`_malletOnBoulder`** (Add pebble under boulder)
- **`_malletOnPebble`** (Split pebble into shard)
- **`_malletOnShard`** (Split shard)

**Result:** Architect stays on until the user taps "ARCHITECT ✕" in the app bar or leaves the screen (Stow the Map / back). No other call sites need to touch `_malletActive`; the Edit overlay does not and should not modify it.

**Edge case — Add boulder when list was empty:** Architect should stay on. After the first boulder is created, the UI switches from "Add boulder" to the boulder list with + / hammer; the user can immediately add pebbles or split without re-enabling. No special handling required.

**Edge case — errors:** If `createBoulder`, `createNodeUnderParent`, or `split` throws, the handlers already don’t run the removed `setState`, so Architect remains on. SnackBar/error handling is unchanged.

---

### 6.2 Menu visibility (2–3 concrete suggestions)

1. **Mountain Detail screen — safe bottom space:** Replace the fixed `padding: const EdgeInsets.fromLTRB(24, 16, 24, 100)` with padding that includes `MediaQuery.paddingOf(context).bottom` (and optionally `viewPadding.bottom`) so the scroll content has enough bottom inset on devices with home indicators or gesture bars. For example: `EdgeInsets.fromLTRB(24, 16, 24, 100 + MediaQuery.paddingOf(context).bottom)` so the "Chronicle this Peak" button and last boulder tile aren’t obscured.

2. **EditFlowOverlay — constrain height and scroll internal content:** Wrap the overlay’s main content (the `Column` with Elias + cream card) in a height constraint so it never exceeds ~80% of viewport height (e.g. `ConstrainedBox(constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.8))`). Keep the existing `SingleChildScrollView` as the direct child of that so the card and all actions (Rename, Shatter, Refine, Delete, Add/Cancel) remain scrollable when the keyboard is open or on small screens. Use `MediaQuery.viewInsetsOf(context).bottom` for the bottom padding (already done) so the card shifts up with the keyboard.

3. **EditFlowOverlay — single scroll + consistent bottom padding:** Ensure the only scrollable region is the `SingleChildScrollView` that contains the card, and use `padding: EdgeInsets.fromLTRB(24, 56, 24, 24 + MediaQuery.viewInsetsOf(context).bottom + MediaQuery.paddingOf(context).bottom)` so the bottom accounts for both keyboard insets and device safe area, preventing the Add/Cancel row from sitting under the keyboard or system UI.

---

### 6.3 Codification — align Map/Architect with intro/campsite (3–5 steps)

1. **Use whetPaper / whetLine / whetInk consistently:** In `EditFlowOverlay` and `_EditDefaultCard` / `_EditAddChildCard`, use `AppColors.whetPaper` (with the same alpha as ManagementMenuSheet or climb cards, e.g. 0.95–0.98), `AppColors.whetLine` for borders, and `AppColors.whetInk` for all body and button text. Replace any remaining `darkWalnut` or ad-hoc colors on the edit cards with whetInk so the palette matches intro/campsite.

2. **Add ~200 ms stagger before showing action buttons:** In `EditFlowOverlay`, after the Elias line and target name are shown, delay the appearance of Rename, Shatter/Refine, and Delete (e.g. with a short `Timer` or `Future.delayed` + `setState` to flip a `_showActions` flag, or `AnimatedOpacity`/staggered children). Use roughly 200 ms so the flow feels guided without feeling slow (intro uses ~1.2 s for first-time; edit can be shorter).

3. **Single primary action per card:** On the add-child card ("Name this pebble/shard"), keep a single primary CTA (Add) and secondary Cancel, and avoid duplicate or redundant labels so it matches the single-primary-action pattern used in intro and ManagementMenuSheet.

4. **Same drag handle and padding as ManagementMenuSheet for any bottom-sheet variant:** If the Edit overlay is later converted to a bottom sheet, use the same top drag handle (40×4, whetLine, 16 pt bottom margin), and padding `EdgeInsets.fromLTRB(24, 12, 24, MediaQuery.paddingOf(context).bottom + 24)` so it feels consistent with the management menu.

5. **Elias placement and sizing:** Keep Elias head/silhouette visible on the Edit overlay with consistent sizing (e.g. 140×210 or match ManagementMenuSheet’s 40×56 where space is tight). Reuse the same `EliasWidget` and period so day/night styling is consistent across Map and campsite.

---

### 6.4 Optional — full-screen vs bottom sheet for Edit overlay

**Recommendation:** Keep the Edit overlay **full-screen** for a first pass. The overlay already provides clear focus (dimmed background, Stow the Map compass), and converting it to a bottom sheet would require reworking the add-child sub-flow (two cards in one sheet) and scroll behavior when the keyboard opens. A full-screen overlay with the visibility fixes above (max height 80%, scroll, viewInsets + padding) delivers a consistent, predictable flow with less risk; a bottom-sheet variant can be a follow-up if you want the peak list and Architect state visible behind the edit card.
