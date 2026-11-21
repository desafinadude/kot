# Monster City — Kaiju Edition 👑🦖

A portrait-format mobile game (static web app, no build step) — giant monsters
rampage through a city for Victory Points: **6 fictional Japanese titans** and
**4 districts** with their own perks and drawbacks.

## Run

```bash
npm run serve          # no-cache dev server (tools/serve.py) — avoids stale phone caches
# open http://localhost:8080  (on your phone: http://<your-lan-ip>:8080)
```

### Install on your phone (PWA)

- **Android (Chrome):** open the game over **HTTPS** → menu⋮ → *Install app*
  (or *Add to Home screen*) — it installs full-screen portrait as “Monster City”.
- **iOS (Safari):** Share → *Add to Home Screen* — works even over LAN http.
- A service worker caches the app shell (**network-first**: always fresh when
  online, playable offline). Icons are composed from the Gōryū portrait by
  `tools/make_icons.py`.
- Note: Android’s install prompt needs a secure context (https or localhost) —
  plain `http://<lan-ip>` won’t offer it. Deploy to any HTTPS host (GitHub
  Pages fits — paths are relative, works under a repo subpath).
- Shake/tilt needs HTTPS or localhost (secure context) on phones — over plain
  LAN http the sensors stay silent and the game falls back to tap-only; tap
  always works.

## Features

- **Shake 📳 or tap** to roll — zero-dependency DeviceMotion detector
  (`js/shake.js`), iOS permission requested on the Start tap. Toggle in the
  `?` rules sheet.
- **Minimal-scroll portrait UI** — board, standings, dice and the primary
  action all fit one screen; cards/log/rules open as bottom sheets.
- **Bot opponents** — setup toggle **BOTS / PASS & PLAY** (default bots): you
  control one titan and CPU monsters play the rest (keep/reroll heuristics,
  buys the strongest card it can afford, auto-yields City below 4 HP). The
  market never auto-opens — tap Shop when you want it. The resolve
  choreography is deliberately unhurried: beams, hits and captures each get
  about a second to land.
- **6 asymmetric kaiju, billed like a classic monster-movie poster**
  (`data/monsters.json`): **Gōryū** “The Atomic Terror” (+1 attack damage — the
  Godzilla slot), **Shirohime** “Empress of Moonlight” (heals 2), **Tetsujin-9**
  “The Iron Menace” (ignore 1 damage/attack), **Onizaru** “Terror of the Red
  Peak” (+1 reroll), **Suzaku** “The Vermillion Sky Terror” (+1⚡ per ⚡ face),
  **Ganryū** “The Living Island” (reflect 1 damage). Names & epithets are
  original homages — swap them freely in `data/monsters.json`.
- **4 districts** (`data/zones.json`) instead of 2:

  | District | ✦ Perk | ✖ Drawback |
  |---|---|---|
  | Tokyo City | +2⭐ at turn start | 💚 heal dice do nothing |
  | Tokyo Bay | +1⭐ +1⚡ at turn start | cards cost +1⚡ |
  | Shinjuku Crossing | +2⚡ at turn start | attacks vs you deal +1 |
  | Imperial Palace Gardens | heal 1❤️ at end of turn | cannot buy cards |

  Active districts = `min(players − 1, 4)` (someone must always remain
  outside Tokyo); districts lock/unlock as monsters fall.
- **75-card market** (`data/cards.json`) — 65 cards fully automated by the
  effect engine, 10 complex ones marked "manual" (resolved by their text).
- Win: first to 20⭐ (must survive your turn) or last monster standing.

### Feel (v2)

- **Pixel art style** — hand-built 16×16 sprites for all 6 monsters, pixel icons
  for hearts/energy/paws/stars, Silkscreen font, chunky shadowed panels.
- **Staged resolve** — Resolve plays a sequence: dice glow per result group →
  `TRIPLE 3×3` banner → energy surge → `2 CLAWS!` → animated attack beams on
  the map from attacker to each victim → hit shakes → heal. Counter pickups
  float on player cards (+★, +⚡, −♥).
- **Sound FX** — WebAudio blips for rolling, hits, captures, KO and victory;
  toggle in the rules sheet.

### Aesthetic (v3–v4) — paper, ink & brush

- **Parchment + sumi ink + vermilion seals** with a comic five-font system:
  **Dela Gothic One** (manga-poster title & resolve banners), **M PLUS Rounded 1c**
  (all UI: names, buttons, stats, dice — rounded & playful), **Yusei Magic**
  (marker notes/ticker), **Yuji Syuku** (brush — only for seal stamps, 番 and the
  map ribbon), **Zen Kaku Gothic New** (body).
- **Static ink map** — hand-built SVG (no tiles, no map library, no network):
  five evenly-spread spots — district seal stamps 京/宿/居 around a central
  palace, outsiders camp at 野, dotted ink roads, a pale sea band. Tap a seal
  for its perk/drawback; captures flash the seal; attack beams are animated
  dashed ink lines drawn between monster tokens on a persistent overlay.
- **In-place dice** — faces tumble and change in place in the tray; tap a
  die to keep it, shake (or tap ROLL) to throw. No physics library, works
  fully offline.
- **Icons**: Lucide-style line set (`js/icons.js`) for everything in the UI.
  Characters are ink-swatch placeholders until real art is imported —
  specs in `assets/art/README.md` (1024×1024, transparent, ink & wash).
- **Brush craft (v4)**: SVG brush-stroke backgrounds (primary button, announce
  banners, title/sheet underlines), ink-splatter around the title,
  angled everything (cards ±1°, banners −3.2°, tags −2.5°),
  lifted paper drop-shadows, stretched hero player cards (portrait up to
  104px for 2-player games), vertical calligraphy ribbon on the map.

## Project layout

```
index.html                app shell (setup screen + game screen + sheets)
css/paper.css             PAPER & INK theme — parchment, mincho type, red seals, safe-area, no page scroll
js/engine.js              rules engine — dice, attacks, zones, cards, hooks, staged resolve
js/ui.js                  rendering, static ink map, player cards, sheets, sequencer
js/icons.js               Lucide-style line-icon library (UI icons + canvas dice faces)
js/portrait.js            character ART PLACEHOLDERS (kanji swatches) — see assets/art/README.md
js/sfx.js                 tiny WebAudio sound FX (no assets) + toggle
js/main.js                bootstrap + monster-select setup screen
js/shake.js               DeviceMotion shake detector (shake to roll)
js/data.js                JSON loading + art-manifest fallback loader
data/monsters.json        the 6 kaiju + powers (hooks)
data/zones.json           districts, perks, unlock rules
data/cards.json           card database (canonical — edit directly)
data/art.json             art manifest: src → fallback mapping
manifest.webmanifest      PWA manifest — installable as an app
sw.js                     service worker — offline shell (network-first)
tools/smoke.mjs           headless engine test (node tools/smoke.mjs)
tools/make_icons.py       PWA icon composer (Gōryū portrait → 192/512/maskable)
```

## Importing generated art

1. Generate art elsewhere; export at the sizes listed in
   `data/art.json → recommendedSizes`.
2. Drop files under `assets/art/` using the paths already referenced by
   `data/art.json` (e.g. `assets/art/monsters/ryuga.webp`,
   `assets/art/zones/city.webp`, `assets/art/dice/attack.webp`,
   `assets/art/bg_tokyo_night.webp`).
3. Done — every image auto-upgrades from its emoji/CSS fallback at runtime.
   Missing files never break the game (failures are cached, no re-probing).

## Tweaking cards

- `data/cards.json` is the single source of truth — edit it directly for
  balance tweaks (cost, text, `effects`, `hooks`). New cards: copy an entry;
  `support: "text"` marks cards the engine shows but resolves manually.
- Effect ops: `gainVp, gainEnergy, heal, damageOthers, damageAll,
  damageSelf, vpOthers, energyDrainOthers, army, captureTokyo, extraTurn,
  maxHp`. Keep-card hooks live in `js/engine.js` (see `recalc`).

## Testing

```bash
node tools/smoke.mjs     # engine assertions: capture, damage, yield,
                         # buying, district bonuses, elimination, win
```

## Design notes

- First player is drawn at random (no opening-dice roll UI).
- Districts unlock as `min(players − 1, 4)` so at least one monster always
  remains outside the districts (keeps attacks meaningful).
- Attacker picks among vacant districts on capture (preference: City first).
- Acid Attack's unconditional 1 damage is implemented as a true attack
  against normal targets when you roll no 🐾.
