# Asset Inventory

Single source of truth for assets: **Completed** (in repo, referenced in code) vs **Required** (needed for a planned feature; you provide when working on it). For every new image, fill in **Dimensions/Ratio** and any tileable or code-only animation note.

---

## Images

### Backgrounds

| Asset | Path | Dimensions/Ratio | Status | Where used |
|-------|------|------------------|--------|------------|
| Sunrise (dawn) | `assets/backgrounds/sunrise.jfif` | — | Completed | Sanctuary + Entrance time-of-day background |
| Midday | `assets/backgrounds/midday.jfif` | — | Completed | Sanctuary + Entrance time-of-day background |
| Dusk (sunset) | `assets/backgrounds/dusk.jfif` | — | Completed | Sanctuary + Entrance time-of-day background |
| Night | `assets/backgrounds/night.jfif` | — | Completed | Sanctuary + Entrance time-of-day background |
| Forest (cold start) | `assets/backgrounds/forest.jfif` | — | **Required** | Forest Threshold (bootstrap loading). *Placeholder:* `night.jfif` until dedicated forest asset added. |
| Elias intro pathway | `assets/backgrounds/elias_intro_pathway.png` | Vertical (tall); storybook style | Completed | Loading / intro screen when user first meets Elias; signpost area for UI overlays |

### Elias

| Asset | Path | Dimensions/Ratio | Status | Where used |
|-------|------|------------------|--------|------------|
| Elias Dawn | `assets/elias/Elias_Dawn.png` | e.g. 3:4 (match for future narrative portraits) | Completed | Sanctuary + Climb/Edit overlay (period-based) |
| Elias Midday | `assets/elias/Elias_Midday.png` | Same ratio | Completed | Same |
| Elias Sunset | `assets/elias/Elias_Sunset.png` | Same ratio | Completed | Same |
| Elias Night | `assets/elias/Elias_Night.png` | Same ratio | Completed | Same |
| Elias pointing up | `assets/elias/elias_pointing_up.png` | Full-body; black bg | Completed | Optional: discovery / “look there” moments |
| Elias explaining gesture | `assets/elias/elias_explaining_gesture.png` | Full-body; black bg | Completed | Optional: tutorial or explanatory overlays |
| Elias pointing left | `assets/elias/elias_pointing_left.png` | Full-body; black bg | Completed | Optional: directing attention to UI element |
| Elias guide pose | `assets/elias/elias_guide_pose.png` | Full-body; black bg | Completed | Optional: intro welcome or step-by-step guidance |
| Elias welcoming | `assets/elias/elias_welcoming.png` | Full-body; black bg | Completed | Optional: beckoning / inviting user forward |
| Elias floating smile (head) | `assets/elias/EliasFloatingSmile.png` | Bust/portrait; transparent bg | Completed | New Journey wizard (all steps); Climb overlay |
| Elias floating mouth open (head) | `assets/elias/EliasFloatingMouthOpen.png` | Bust/portrait; transparent bg | Completed | Intro bridge step (before map) |

### Hearth

| Asset | Path | Dimensions/Ratio | Status | Where used |
|-------|------|------------------|--------|------------|
| Hearth sizzle (low fire) | `assets/hearth/Hearth_Sizzle.png` | — | Completed | Sanctuary: 0 stones dropped this session |
| Hearth default | `assets/hearth/Hearth_High.png` | — | Completed | Sanctuary: 1–2 stones dropped |
| Hearth extra high | `assets/hearth/hearth_extra_high.png` | — | Completed | Sanctuary: 3+ stones dropped (huge fire) |

### Satchel

| Asset | Path | Dimensions/Ratio | Status | Where used |
|-------|------|------------------|--------|------------|
| Satchel closed | `assets/ui/satchel_closed.png` | — | Completed | Sanctuary compact tray (bag icon); cream/white bg art |
| Satchel open | `assets/ui/satchel_open.png` | — | Completed | Satchel hero (cream bg art); parchment frame in UI |

### Stones (Satchel / Hearth)

| Asset | Path | Dimensions/Ratio | Status | Where used |
|-------|------|------------------|--------|------------|
| Stone large | `assets/stones/stone_large.png` | — | Completed | Available for boulder/milestone visuals |
| Stone medium | `assets/stones/stone_medium.png` | — | Completed | Available for pebble/task slots, drag feedback |
| Stone small | `assets/stones/stone_small.png` | — | Completed | Available for shard/sub-step visuals |

**Note:** Not yet wired in code. Satchel slots and `_StoneFeedback` use `Icon` fallbacks. Wire when polishing stone visuals.

### Mallet

| Asset | Path | Dimensions/Ratio | Status | Where used |
|-------|------|------------------|--------|------------|
| Mallet | `assets/mallet/mallet.png` | — | Completed | Scroll Map Architect FAB; **Climb Step 3 strike animation** (code-only: rotation, haptic, stone scale, fade — no separate strike image) |

**Note:** Climb Step 3 strike uses this asset with code-based rotation/scaling: swing `Transform.rotate` -45° to 10°, 5ms haptic, stone scale 1.05, then fade mallet out. Do not add a separate "strike" image.

### Images (scroll, satchel UI)

| Asset | Path | Dimensions/Ratio | Status | Where used |
|-------|------|------------------|--------|------------|
| Wood plank | `assets/images/wood_plank.png` | — | Completed | Satchel slot area background texture |
| Scroll top roll | `assets/ui/scroll_top.png` | Height ~40–60px; width matches content | Completed | Scroll Map: top roller strip (`ScreenBlendComposite`) |
| Scroll texture (primary) | `assets/ui/scroll_texture.png` | ~1:1 square; black matte | Completed | Scroll Map: middle fill (`BoxFit.fill`), first choice in chain |
| Scroll texture deckled (white matte) | `assets/ui/scroll_texture_deckled_white.png` | Square; white matte outside deckled edges | Completed | **Art spare:** not screen-blended; re-export black matte or use multiply if wired later |
| Scroll texture soft (white matte) | `assets/ui/scroll_texture_soft_white.png` | Square; white matte | Completed | **Art spare:** same as deckled variant |
| Scroll center body | `assets/ui/scroll_center.png` | Vertical strip; straight top/bottom seam; black matte | Completed | Scroll Map: fallback middle if `scroll_texture` missing |
| Scroll bottom roll | `assets/ui/scroll_bottom.png` | Height ~40–60px; travels with unfurl leading edge | Completed | Scroll Map: bottom roller strip (`ScreenBlendComposite`) |
| Scroll full open | `assets/ui/scroll_full_open.png` | Square / tall; black matte bg | Completed | Fallback if strip center textures missing (`ScreenBlendComposite`) |
| Scroll horizontal open | `assets/ui/scroll_horizontal_open.png` | Wide; side rollers; black matte | Completed | **Map primary backdrop** (`BoxFit.cover`); fallback: segmented vertical scroll |
| Scroll body (tileable) | e.g. `assets/images/scroll_body.png` | **Tileable strip:** height ~20–40px; left/right edges identical top/bottom for seamless vertical repeat | **Required** | Unfurl animation (Phase 5); you provide |

### Icons (Satchel tools)

| Asset | Path | Dimensions/Ratio | Status | Where used |
|-------|------|------------------|--------|------------|
| Scroll icon | e.g. `assets/images/icon_scroll.png` | — | **Required** | Satchel inventory: tap to open Scroll/Map |
| Whetstone icon | e.g. `assets/images/icon_whetstone.png` | — | **Required** | Satchel inventory: tap for Daily habits (Sharpen Habits) |

---

## Audio

| Asset | Path | Status | Where used |
|-------|------|--------|------------|
| scroll_open | `assets/sounds/scroll_open.wav` or `.mp3` | Completed | Scroll Map: when route opens (`app_audio_service.dart`) |
| scroll_close | `assets/sounds/scroll_close.wav` or `.mp3` | Completed | Scroll Map: when route closes (`app_audio_service.dart`) |
| app_open | `assets/sounds/app_open.wav` (.mp3 optional) | Completed | Entrance: when Sanctuary appears |
| rock_break | `assets/sounds/rock_break.wav` (.mp3 optional) | Completed | Scroll Map: mallet split; Climb Step 3 pebble add |
| stone_drop | `assets/sounds/stone_drop.wav` (.mp3 optional) | Completed | Sanctuary: stone dropped on hearth |
| weight | `assets/sounds/weight.wav` (.mp3 optional) | Completed | Sanctuary: layered with stone_drop by stone count |
| whetstone | `assets/sounds/whetstone.wav` (.mp3 optional) | Completed | Optional cue when entering Whetstone flow (Satchel overlay offers Sharpen Habits only; Refine on Map) |

---

## Maintenance

- When adding a feature that needs an asset: add a row with Status **Required** and Where used.
- When you add the file and wire it in code: set Status to **Completed** and keep Where used accurate.
- For images, always fill **Dimensions/Ratio**; add "tileable/repeatable" or "code-only animation" where relevant.
