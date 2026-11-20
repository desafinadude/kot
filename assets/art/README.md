# Art specifications — Monster City: Kaiju Edition

The game ships with **ink-swatch placeholders** for all characters (paper square +
kanji, see `js/portrait.js`). Generate real art elsewhere and drop it in —
everything upgrades at runtime through `data/art.json`. Missing files never
break the game (probes are cached).

## Style guide (all assets)

- **Ink & wash on aged paper** — sumi-e brush outlines, soft watercolour washes,
  visible paper grain. No photorealism, no neon, no pixel art.
- **Palette**: sumi ink `#2b2118`, parchment `#f0e6d2`, vermilion `#b23a2e`,
  plus each monster's accent colour (see `data/monsters.json → color`).
- Transparent backgrounds for anything that sits on the map or on cards.

## Characters (priority #1)

Subjects — six classic **daikaiju** archetypes, 1970s monster-movie energy:
**atomic reptile** (Gōryū), **moon moth** (Shirohime), **mechanical titan**
(Tetsujin-9), **ogre-ape** (Onizaru), **vermillion pterosaur** (Suzaku),
**shell colossus** (Ganryū). Think city-stomping menace, not cute.

| Item | Spec |
|---|---|
| Files | `assets/art/monsters/ryuga.webp`, `shirohime.webp`, `tetsujin9.webp`, `onizaru.webp`, `kagero.webp`, `ganryu.webp` |
| Size | **1024 × 1024 px**, square (rendered 30–96 px) |
| Format | WebP or PNG, **transparent background** |
| Framing | Head/bust portrait, facing forward, fills ~85% of canvas |
| Style | Ink-brush kaiju portrait + one flat wash of the monster's accent colour |

Character reference (names, titles, powers, accent colours): `data/monsters.json`.

## Optional / lower priority

| Item | File | Size | Notes |
|---|---|---|---|
| App logo | `assets/art/logo.webp` | 512 × 512 | transparent; setup screen seal |
| Backdrop | `assets/art/bg_tokyo_night.webp` | 1080 × 1920 | subtle, low-contrast only |
| Card frame (keep) | `assets/art/cards/frame_keep.webp` | 420 × 588 | optional; cards render fine without |
| Card frame (discard) | `assets/art/cards/frame_discard.webp` | 420 × 588 | optional |

## Deprecated (no longer used)

- `assets/art/zones/*` — districts now live on a **real Leaflet map** with seal stamps.
- `assets/art/dice/*` — dice faces use the line-icon set (`js/icons.js`),
  drawn on the physics canvas.

## How to import

1. Export at the path/size above.
2. Files are detected automatically (one probe, failures cached).
3. If a file is absent, the ink placeholder stays — import piece by piece.
