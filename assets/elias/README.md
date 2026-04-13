# Elias — Character Assets

Assets for the guide character Elias. Used across onboarding, the New Journey wizard, Sanctuary, and other screens. Place all Elias PNGs in this folder; `pubspec.yaml` includes `assets/elias/` so they are bundled automatically.

---

## Time-of-day poses (full-body)

Used by `EliasWidget` when no override is set (e.g. Sanctuary, Satchel, management). Filenames are **PascalCase** in code.

| Filename         | Time window | Description                          |
|------------------|-------------|--------------------------------------|
| `Elias_Dawn.png` | 5am – 10am  | Standing, horizon, cup in hand       |
| `Elias_Midday.png` | 10am – 5pm | Upright, alert, arms relaxed         |
| `Elias_Sunset.png` | 5pm – 8pm  | Seated, contemplative, watching fire |
| `Elias_Night.png`  | 8pm – 5am  | Seated by fire, relaxed presence    |

Defined in `lib/core/enums/day_period.dart` as `ScenePeriod.eliasAssetPath`.

---

## Intro / storybook poses (full-body)

Used in the first-time intro overlay for specific beats. Override is passed per step.

| Filename                      | Used in intro                    |
|------------------------------|----------------------------------|
| `elias_welcoming.png`        | Beats 1–2, name prompt, Beat 5   |
| `elias_explaining_gesture.png` | Name confirmation               |
| `elias_guide_pose.png`       | Beat 4; **Sanctuary home intro** (all steps, regardless of time of day) |

Defined in `lib/features/onboarding/elias_intro_overlay.dart` and `lib/features/sanctuary/sanctuary_screen.dart` (home intro overlay).

---

## Head / bust assets (wizard and bridge)

One head per screen: **speaking** on the bridge step, **at rest** in the wizard. Transparent background; shown at ~100×120 so Elias appears as a portrait over the parchment, not standing on top of it.

| Filename                     | Where used                          |
|-----------------------------|-------------------------------------|
| `EliasFloatingMouthOpen.png`| Intro **bridge step** (before map)   |
| `EliasFloatingSmile.png`    | **New Journey wizard** (all steps)  |

- **Bridge:** One line of dialogue before the scroll opens: *"Before we step forward, let us consult the map. Which peak shall we scout first?"* — mouth-open head only.
- **Wizard:** Intent, Identity, Theme, Logic, Markers, Pebbles — smile head only on each step.

Defined in `elias_intro_overlay.dart` (bridge) and `climb_flow_overlay.dart` (wizard).

---

## Other pose variants (full-body)

Available for future or alternate use. Names as in folder; add overrides in code where needed.

| Filename                   | Notes                    |
|---------------------------|--------------------------|
| `elias_pointing_up.png`   | Enthusiastic; “look there” |
| `elias_pointing_left.png` | Guiding attention to UI  |
| `elias_guide_pose.png`    | Intro/guide              |

---

## Style and behavior

- **Elias is a grounded presence.** He does not lecture or manage; he holds the space and is the gatekeeper for the Satchel refill.
- **One asset per screen.** We do not show multiple Elias images at once; we switch by context (e.g. mouth-open on bridge, smile in wizard).

---

## Black background removal

If new images have black or near-black backgrounds, run from repo root:

```bash
python scripts/remove_black_bg.py
```

This processes all PNGs in `assets/elias/` and makes black/near-black pixels transparent in place.

---

## Fallback

If an asset fails to load, `EliasWidget` uses a painted silhouette fallback (see `lib/widgets/elias_silhouette.dart`).
