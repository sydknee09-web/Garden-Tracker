# Images

## Satchel


- **wood_plank.png** — Background texture for the satchel slot area (`satchel_screen.dart`). If missing, the app shows a solid fallback via `errorBuilder` but the console may log a 404 on web. Add this asset to remove the message.

## Scroll images

For The Scroll parchment/roller UI:

- **parchment_tile.png** — tileable parchment texture (background)
- **scroll_top.png** — wooden roller at top of scroll
- **scroll_bottom.png** — wooden roller at bottom of scroll

**Generate (needs GEMINI_API_KEY):** From project root:
```bash
python scripts/generate_assets.py list                    # list subjects
python scripts/generate_assets.py generate --subject scroll   # all three images
python scripts/generate_assets.py generate --subject scroll --pose parchment_tile
```
Output goes to `assets/images/`. Until these exist, the scroll uses a gradient background and optional roller images are skipped.
