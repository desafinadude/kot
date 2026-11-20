# Monster City — Mobile Game Build Checklist

Strategy: static web app (no build step), portrait mobile, JSON-driven data (cards, monsters, zones, art manifest). One step per turn.

- [x] 1. Read source data (rules + card CSV) — cards/monsters/zones designed (see data/*.json)
- [x] 2. Scaffold app structure (index.html, CSS design tokens, entry JS)
- [x] 3. Data layer: `data/cards.json`, `data/monsters.json`, `data/zones.json`, `data/art.json`
- [x] 4. Game engine: dice roll/reroll (3 rolls), resolution, turn flow, win check
- [x] 5. Zones: expanded Tokyo map (4 districts) with perks/disadvantages + occupancy rules
- [x] 6. Six asymmetric Japanese kaiju with unique powers
- [x] 7. Card system: shop of 3, buy/sweep, KEEP/DISCARD effects
- [x] 8. UI: portrait layout, minimal scrolling, clean HUD, bottom sheets
- [x] 9. Shake-to-roll (DeviceMotion + iOS permission) with tap fallback
- [x] 10. Art import pipeline: `art.json` manifest + graceful placeholders
- [x] 11. Polish: dice animation, feedback, transitions
- [x] 12. Verify in browser (mobile viewport), fix issues — browser flow test + `node tools/smoke.mjs` green

## V2 — "Make it feel alive" (user feedback: too boring)

- [x] V1. Pixel sprite system: monster portraits + icon set (`js/pixels.js`)
- [x] V2. Real Tokyo map approximation (SVG: night sky + moon, skyline, stepped coast, bay, 4 districts + outskirts, roads, landmarks, monster placements, tap-for-details)
- [x] V3. Staged resolve: engine stage hooks + UI sequencer (dice glow → score → energy → attack beams → hits → heal) + capture banner
- [x] V4. Pickup animations: counter ticks (+★ +⚡ −♥ floats), card hit-shake + screen pulse, capture flash
- [x] V5. Big player cards with portraits, heart pips, active/dead states
- [x] V6. Pixel theme pass: Silkscreen font, chunky buttons/panels, starfield bg (`css/theme.css`, old styles.css removed)
- [x] V7. SFX (tiny WebAudio: roll, hit, gain, capture, KO, win) + 🔊 toggle in rules sheet
- [x] V8. Browser verification with screenshots (stage banners, beams, yield modal, cards) — 0 page errors, smoke green

## V3 — "Papery/ink, real map, real physics" (user feedback: too pixel, ugly map, dice should fly)

- [x] C1. Ink/paper theme: parchment palette, mincho/handwriting type, red seal accents (`css/paper.css`, pixel theme deleted)
- [x] C2. Line-icon library module (Lucide-style, `js/icons.js`) for all UI icons — not characters
- [x] C3. Character placeholders (`js/portrait.js` kanji swatches) + art spec doc (`assets/art/README.md`), art.json v3
- [x] C4. Leaflet map of real Tokyo (OSM keyless tiles, sepia/paper filter): red seal stamps at real coords, monster tokens, ink-beam polylines, parchment fallback if CDN fails
- [x] C5. Matter.js dice: gravity + impulses, device-tilt gravity, shake jolts, stage hops, tap-to-pick on canvas, DOM fallback
- [x] C6. UI rewire: stages drive physics glow+hops, inkified log glyphs, `js/pixels.js` removed
- [x] C7. Browser verification (layout overlap bug fixed, CARTO→OSM keyless, beams on real map, yield modal, 0 page errors, smoke green); docs + memory updated

## V4 — "Brush vibes & big cards" (user feedback: needs creative fonts, angles, drop shadows)

- [x] B1. Font hunt: Reggae One (painted title), Yuji Syuku (brush calligraphy: seals, banners, ribbon), Yusei Magic (marker notes), Shippori Mincho (UI), Zen Kaku (body)
- [x] B2. Brush artifacts: SVG brush-stroke button/banner/underline paths, ink splatter around title, washi tape on portraits, vertical 怪獣王 map ribbon
- [x] B3. Angled everything: title −2.2°, cards ±1°, portraits −2.2°, zone tags −2.5°, names −1°, stamps −9°, banners −3.2°
- [x] B4. Big monster cards: rows stretch to fill (max ~215px), portrait 104/78/64px by roster, lifted layered shadows, tape, corner 番 seal
- [x] B5. Fixed: announce hidden under leaflet panes (z 30→900), players 2px scrollbar (overflow hidden), horizontal card overflow (min-width 0 + stat wrap), light kanji ink outline
- [x] B6. Verified: banner painted & captured over live map, 0 page errors
- [x] B7. Comic font pass ("too fancy/serif"): mincho → **M PLUS Rounded 1c** (all UI, weights 500/700/900), display → **Dela Gothic One** (title, banners, win), brush Yuji kept ONLY for seals/ribbon/番, canvas dice font matched; Reggae One + Shippori Mincho dropped
- [x] B8. Clipping/layering fix ("dice & cards in invisible boxes"): dice canvas extends 132px above tray at z-700 (flights render over cards/map, pointer-events none, taps via stage listener); `.players` overflow visible (番 seal/tape/badges uncut); overlays re-scaled above dice — backdrop 940 / sheets 950 / modal 960 / win 980 / pulse 990, announce stays 900; hit-test verified sheet covers dice; 0 errors

## V5 — "Classic kaiju movie bill" (user request: Godzilla & friends, giant monsters that terrorise)

- [x] K1. Roster re-archetyped to classic daikaiju lineup (ids unchanged for stability): **Gōryū** “The Atomic Terror” (Godzilla slot — our own name, atomic breath = +1 attack, green, 剛), **Shirohime** “Empress of Moonlight” (Mothra slot), **Tetsujin-9** “The Iron Menace” (Mecha slot), **Onizaru** “Terror of the Red Peak” (beast-island slot), **Suzaku** “The Vermillion Sky Terror” (Rodan slot — renamed from Kagerō, vermillion 朱, +1⚡/face), **Ganryū** “The Living Island” (guardian-turtle slot)
- [x] K2. Movie-poster epithets displayed: red uppercase billing line on setup cards + rules-sheet power list; tagline “6 titans · 4 districts · one throne”; win text “All of Tokyo kneels.”
- [x] K3. Art spec updated (daikaiju subjects, city-stomping menace), README roster rewritten
- [x] K4. Verified: all names/titles/kanji live in UI, 0 page errors; fixed stale-cache serving via `?v=2` busts (python http.server sends no cache headers)
- [x] K5. `ART_BRIEF.md` — copy-paste generation brief for ChatGPT: two 1536×1024 contact sheets (3×2 grid, exact 512×512 cells for slicing), comic-book style spec, per-monster descriptions, dice faces
- [x] K6. Brief extended: black + green dice sheets (“8 dice: 6 black + 2 green” component split, 512px cells) + four card-art contact sheets (6×4 grid, exact 256×256 cells, all 75 card names in position tables, no-text vignette rule)
- [x] K7. Dice combined into ONE sheet (user: “don’t be silly”): Sheet 2 = 6×3, 18 cells, colorway rows (paper/black/green), integer slicing bands y=0/341/682; card sheets renumbered 3–6; brief now “six sheets”
- [x] K8. Dice corrected to the real component split (user: “read the rules”): NO paper colorway, solid bodies — row 1 = 6 black dice (solid `#2b2118`, parchment symbols), row 2 = green dice (solid `#5c7d4a`); grid 6×2 → clean 256×512 cells (x=0…1280, y=0/512), filenames `{face}_{black|green}.png`

## V6 — Generated art wired in (user: “I've added the art files… go for it”)

- [x] A1. `tools/slice_art.py` — sliced all six 1536×1024 sheets → **93 assets** (6 monsters @512² webp, 12 dice @256² square-cropped, 75 card vignettes @256²) + auto-updated `data/art.json`
- [x] A2. Manifest cache-bust: every art `src` got `?v=1` — browsers had **cached the 404s** from before the files existed (python http.server, no cache headers)
- [x] A3. Wiring: physics canvas draws black die-face art (vector fallback until loaded, kept/glow rings preserved); shop rows show card thumbnails (`.c-art` + `:has(img)`); map tokens, turn chip, player cards, setup grid, win portrait all upgrade via `mountArt`
- [x] A4. Verified: setup 6/6 real imgs (0 placeholder svgs), board 2/2 portraits + 2/2 map tokens, shop 3/3 thumbnails, art URLs 200, only expected 404 = never-generated `logo.webp`, 0 page errors, smoke green
- [x] A5. Misalignment & clipping fixes (user report): `.m-face img` had NO size rule → 512px art exploded out of setup frames (now svg+img share sizing, measured img=frame=75², overflow 0); dice re-sliced with content-aware `die_cell_crop` (generator drew dice tall & low in cells → blind middle-crop clipped bottoms; now corner-sampled bg + bbox + pad-to-square, all 12 dice ≥12px margins, CLIPPED:0); cache bumps `paper.css?v=4` + art `?v=2`
- [x] A6. Dice switched to hand-built markup (user: image dice looked smaller than their squares): physics canvas draws vector dice — solid `#2b2118` body exactly S×S, parchment `#f0e6d2` numerals/icons, gold kept-ring, colored stage glows; DOM fallback `.die` restyled to match; all image-dice code removed (`faceArt/loadArt/drawImage` = 0 refs); verified 0 dice-image requests + canvas body luminance 35 (solid black) at all 6 dice + light parchment centers; versions bumped to main/ui/physics ?v=4, paper.css ?v=5

## V7 — Pacing + bot opponents (user request)

- [x] P1. Slower staged resolve: reveal 550 · score 1000/320 · energy 700 · attack 750 · strike/beams 900 · hit 500 · capture 1100 · heal 700 (measured human resolve = 3445 ms even on a quiet roll; attack+capture turns run ~5–6 s)
- [x] P2. Shop never auto-opens — opens only via the Shop button; bots buy silently through `engine.buy()` without ever opening the sheet
- [x] P3. Bot players: setup **BOTS / PASS & PLAY** toggle (default bots, 2–6 seats); seat 0 = human + shuffled random monsters for the rest; `js/bot.js` heuristics (keep triples/attacks/energy, heal only when hurt, buy strongest affordable ×2, paced 0.6–0.9 s between actions, animated rolls via `ui.rollVisual`); bot yield rule: flee City when ≤4 HP; **CPU** chip on cards; `window.__game` debug handle
- [x] P4. Latent rules bug found by the bot test: yield damage was applying to EVERYONE (log claimed “Burrowing”) — now gated by `mods.yieldDamage` (Burrowing card only; Jets negates)
- [x] P5. Verified end-to-end: resolve 3445 ms · shopAuto=false · bot completed its full turn back to human · human-yield modal appeared during bot attack and was dismissable · forced scenario: hurt bot auto-yielded City → human auto-took the single vacancy · CPU chips correct · 0 page errors · smoke green

## V8 — Static ink map (user: “map isn’t working… static image, less detail, spread out”)

- [x] M1. Leaflet fully removed (CDN script+css, tile requests, fallback layer) — zero leaflet/OSM/unpkg network requests verified
- [x] M2. Hand-built static SVG map (viewBox 460×260): 5 evenly-spread spots — palace center (居), four district seals around it (宿/京/港 + 野 outskirts camp), nearest-neighbour distances 132–166 (no clustering), dotted ink roads between them, low-detail sea band + waves
- [x] M3. Tokens carry real generated art (SVG `<image>` with clip + kanji fallback); camp tokens for outsiders; tap-seal → perk/drawback tip unchanged
- [x] M4. Beams live on a persistent `mapFx` overlay SVG (survive re-renders, no panning) — verified drawing during strike; capture flash on `.stamp` with drop-shadow keyframes
- [x] M5. Verified: 5 spots/stamps, tip works, beamsSeen=1 mid-strike, full resolve+yield flow, 0 page errors, smoke green; versions bumped ui/main ?v=6, paper.css ?v=7

## V9 — Installable PWA (user: “manifest + installable on a phone”)

- [x] P1. `manifest.webmanifest` — Monster City, portrait, standalone, parchment theme, subpath-safe (`./` ids/urls so GitHub Pages project sites work), 3 icons (192/512 any + 512 maskable)
- [x] P2. `sw.js` — network-first + cache fallback, same-origin only (CDNs pass through), cache `monster-city-v1` purged on activate; registered at the end of `main.js` (http/https only)
- [x] P3. `tools/make_icons.py` — composes icons from the Gōryū portrait (parchment + vermilion border, rounded any-icons, safe-zone maskable, opaque 180 apple-touch) — sizes verified
- [x] P4. Metas: theme-color `#f0e6d2`, apple-touch-icon/title, mobile-web-app-capable, favicon; README install section (Android needs HTTPS for the prompt, iOS Add-to-Home works over LAN)
- [x] P5. Verified in browser: SW registered (scope /), manifest 200 `application/manifest+json`, icon-192/maskable/apple-touch all 200, titles set
