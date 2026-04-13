# Asset Manifest

Cross-reference for `assets/` folder. Generated from [ASSET_INVENTORY.md](ASSET_INVENTORY.md). Paths match code exactly. Use before implementing animations or Phase 12 polish to avoid build errors.

---

## Quick Checklist

| Category | Status | Notes |
|----------|--------|-------|
| Backgrounds | 5/6 | sunrise.jfif, midday.jfif, dusk.jfif, night.jfif, elias_intro_pathway; forest.jfif optional (night.jfif placeholder) |
| Elias | 11/11 | Elias_Dawn/Midday/Sunset/Night (4) + elias_welcoming, elias_explaining_gesture, elias_guide_pose (3) + EliasFloatingSmile.png, EliasFloatingMouthOpen.png (2 heads) + elias_pointing_up, elias_pointing_left (2 optional) |
| Hearth | 3/3 | Hearth_Sizzle.png, Hearth_High.png, hearth_extra_high.png |
| Satchel | 2/2 | satchel_closed.png, satchel_open.png |
| Stones | 3/3 | stone_large, stone_medium, stone_small (stone_medium/stone_large wired; stone_small optional) |
| Mallet | 1/1 | mallet.png |
| Images | 4/5 | wood_plank.png; `assets/ui/` scroll_horizontal_open (Map), scroll_top, scroll_texture (+2 white spares), scroll_center, scroll_bottom, scroll_full_open; scroll_body tileable required |
| Icons | 0/2 | icon_scroll, icon_whetstone required for Satchel inventory |
| Audio | 7/7 | scroll_open, scroll_close (wired); app_open, rock_break, stone_drop, weight, whetstone |

---

## Phase 12 (Future)

| Asset | Path | Status | When |
|-------|------|--------|------|
| Elias idle | `assets/elias/elias_idle.png` | Required | Elias breathing/blink animation |
| Parallax layer | `assets/backgrounds/parallax_layer_0.png` | Required | Background parallax effect |

---

## Verification

Run before build (paths must match code exactly):

```bash
# Backgrounds
ls assets/backgrounds/sunrise.jfif assets/backgrounds/midday.jfif assets/backgrounds/dusk.jfif assets/backgrounds/night.jfif
# Elias (time-of-day + intro + heads)
ls assets/elias/Elias_Dawn.png assets/elias/Elias_Midday.png assets/elias/Elias_Sunset.png assets/elias/Elias_Night.png
ls assets/elias/elias_welcoming.png assets/elias/elias_explaining_gesture.png assets/elias/elias_guide_pose.png
ls assets/elias/EliasFloatingSmile.png assets/elias/EliasFloatingMouthOpen.png
# Hearth, Satchel, Stones, Mallet, Images
ls assets/hearth/Hearth_Sizzle.png assets/hearth/Hearth_High.png assets/hearth/hearth_extra_high.png
ls assets/satchel/satchel_closed.png assets/satchel/satchel_open.png
ls assets/stones/stone_medium.png assets/stones/stone_large.png
ls assets/mallet/mallet.png
ls assets/images/wood_plank.png
ls assets/ui/scroll_horizontal_open.png assets/ui/scroll_top.png assets/ui/scroll_texture.png assets/ui/scroll_center.png assets/ui/scroll_bottom.png
# Audio (at least one of .wav or .mp3 per)
ls assets/sounds/scroll_open.* assets/sounds/scroll_close.*
```

If any path is missing, the app may use fallbacks or throw. See [ASSET_INVENTORY.md](ASSET_INVENTORY.md) for full paths and usage.
