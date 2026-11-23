# YOKOZUNA — The Road to Grand Champion 横綱

A portrait-format mobile dice-and-card battle set in a fictional grand sumo
tournament (static web app, no build step). Pick one of **six rikishi**, each
with a real signature power, fight for the **dohyō**, collect Fighting Spirit,
learn techniques from a **20-card market**, and climb the ranks to Yokozuna.

2–6 players · VS CPU or pass & play · 25–35 minutes.

> Unofficial, fictional sumo retheme of a *King of Tokyo*-style engine.
> Characters, powers, names and art are original. The promotion track is a game
> abstraction, not how real-world promotion works. Rules are a v1 playtest draft.

## Run

```bash
npm run serve          # no-cache dev server → http://localhost:8080
```

```bash
npm test               # engine acceptance tests (node tools/test.mjs)
```

Add `?seed=123` to the URL for a reproducible tournament (dice, deck, opening roll).

## Rules in one screen

Authoritative rules and data live in **`docs/`** and **`data/yokozuna-data.json`**
(`docs/YOKOZUNA_RULES.md`, `docs/CARD_CATALOG.md`, `docs/AGENT_IMPLEMENTATION.md`).

- Start: 10 Stamina ❤️, 0 Prestige ⭐, 0 Fighting Spirit ⚡, everyone outside.
  An opening roll (most Push) decides who goes first.
- Turn: start inside → **+2 ⭐**. Roll six dice (`1 2 3 ⚡ ✋ 💚`), up to two
  rerolls, then any extra single-die rerolls. Resolve in order:
  numbers (three of a kind scores its value, +1 per extra) → Spirit → **Push**
  attack → **Recover** (outside only). Then buy cards / refresh (2 ⚡).
- **Dohyō:** inside, your Push hits everyone outside; outside, it hits everyone
  inside. Empty ring → first Push takes the Main Dohyō (+1 ⭐, no damage). Hit by
  Push inside → you may yield (damage still lands); the attacker enters (+1 ⭐).
  An outside attacker must take any open position (Main first, never both).
- **5–6 players:** a second **Challenge Dohyō** is open while 5+ are alive; when
  the count drops below 5 its occupant steps outside (no damage, no Prestige).
- Card damage (Henka!, Tsuppari Flurry, Final Bout) is **not** an attack: no
  yielding, no entry.
- **Win:** end your turn alive with 20+ ⭐, or be the last wrestler standing.
  Simultaneous wipe-out → no winner. Ranks (Maegashira 0 · Komusubi 5 ·
  Sekiwake 10 · Ōzeki 15 · Yokozuna 20) are display only.

## The six rikishi

| Rikishi | Style | Power |
|---|---|---|
| **Iwakaze** 岩風 · The Iron Wall | Defender | *Unmovable* — once per opponent turn, prevent 1 of a 2+ Push hit while inside |
| **Arashiryū** 嵐龍 · The Storm Dragon | Attacker | *Fierce Tachiai* — +1 damage with 3+ Push |
| **Hoshinoumi** 星ノ海 · The Rising Star | Prestige | *Crowd Favourite* — +1 ⭐ when numbers score |
| **Chiyonami** 千代波 · The Clever Technician | Dice control | *Master of Balance* — one extra single-die reroll |
| **Akatsukifuji** 暁富士 · The Gentle Giant | Recovery | *Chanko Champion* — +1 ❤️ when Recover actually heals |
| **Tetsunishiki** 鉄錦 · The Old Master | Spirit | *Stable Wisdom* — +1 ⚡ when Spirit dice grant Spirit |

## Project layout

```
index.html                 app shell (rikishi select + game screen + sheets)
css/paper.css              paper & ink theme: parchment, sumi, vermilion seals, clay dohyō
data/yokozuna-data.json    SOURCE OF TRUTH: config, 6 characters, 20 cards, asset paths
js/effects.js              data-driven effect registry (ability_id / effect_id → handler)
                           + validateData() run at startup
js/engine.js               rules engine: turn flow, dice, ring, market, win checks;
                           seeded RNG in state, fully serializable (serialize/load)
js/ui.js                   rendering, dohyō board SVG, staged resolve, market, modals
js/bot.js                  CPU opponents
js/main.js                 bootstrap, rikishi selection, retreat/target prompts
js/data.js                 JSON load + art mounting (art keyed by stable ids)
js/portrait.js             kanji placeholder while art loads
js/icons.js, sfx.js, shake.js   line icons, WebAudio FX, shake-to-roll
art/characters/, art/market/    sliced card art (paths = JSON `asset` keys)
art/contact_sheets/        original generated sheets
docs/                      design hand-off: rules, card catalog, implementation brief
tools/test.mjs             engine acceptance tests
tools/slice_art.py         contact sheets → per-asset PNGs (gutter-detecting slicer)
tools/make_icons.py        PWA icons from the Iwakaze art
```

## Engine notes

- **Effect hooks** (in order): `onTurnStart → actives (reroll/convert) →
  onNumberScore → onSpiritGain → beforePushDamage → modifyIncomingPush →
  onRingEntry → onRecovery → instant (DISCARD) → onTurnEnd → checkVictory`.
  Handlers return patches (`{prestige}`, `{damage}`, `{prevent}`…); the engine
  applies them and tracks `once: 'turn' | 'opponentTurn'` per source instance in
  `state.perTurnFlags`, so character powers and KEEP cards stack.
- Damage carries a source: `PUSH_DICE` (prevention + yield prompts) or
  `CARD_EFFECT` (neither).
- Unmovable and Clay Footing are both evaluated against the **raw** incoming
  Push damage, so a 2-damage hit on Iwakaze holding Clay Footing is reduced to 0
  (catalog: "do not silently clamp").
- Extra single-die rerolls end the normal rerolls; Mawashi Grip locks the dice
  (it happens "after all rerolls").
- Henka! / Final Bout need a target: they can't be bought with no eligible
  opponent, and cancelling the target picker costs nothing.
- Market: bought cards are replaced immediately; the empty deck reshuffles only
  the discard pile; empty slots stay empty when both piles are exhausted.

## Art

`python3 tools/slice_art.py` re-slices `art/contact_sheets/*.webp` into
`art/characters/*.png` and `art/market/*.png` (256-colour PNGs, ~200 KB each),
matching the `asset` paths in the JSON. All names, costs and rules text are
rendered by the app — the art contains no text.

## Install on your phone (PWA)

Open over HTTPS → *Install app* (Android) / Share → *Add to Home Screen* (iOS).
The service worker is network-first (always fresh online, playable offline).
Shake-to-roll needs HTTPS or localhost.
