# Copy-and-paste prompt for the coding agent

You have access to our **existing playable King of Tokyo–style codebase** and the attached `Yokozuna_handoff` folder (or `.zip`). We are creating a new playable mode called **YOKOZUNA — The Road to Grand Champion**. **Reuse the current game engine where practical** rather than starting over.

1. Read `README.md`, `YOKOZUNA_RULES.md`, `CARD_CATALOG.md`, `AGENT_IMPLEMENTATION.md`, `ART_DIRECTION.md`, and `yokozuna-data.json` **before coding**. The `.md` rules and JSON are the authoritative game data. Generated image text and any old infographics are **not** rules sources.
2. First inspect the existing source structure and identify turn, dice, combat, area control, market, state serialization, and UI modules. Tell me briefly how you will adapt these modules and whether there are any blockers or conflicts.
3. Implement the **20-card deck exactly** (10 KEEP, 10 DISCARD, one copy each), with a 3-slot market, 2-Spirit refresh, draw/discard reshuffling, and proper empty-deck handling. Do not auto-generate an extra 40+ cards.
4. Implement all six named rikishi and their **real gameplay abilities**, respecting attack source distinctions and once-per-turn triggers; do not treat them as purely cosmetic character skins.
5. Preserve six dice, two normal reroll opportunities, numbered scoring, 10 Stamina, and 20 Prestige; implement the two dohyō positions and 5–6-player rules exactly as stated.
6. Wire the images in `art/characters/` and `art/market/` using the stable JSON `asset` paths. Render all names/costs/descriptions in code. The `art/previews/` examples are **visual design guides**, not pre-rendered UI elements to slice out.
7. Apply the promotion strip: Maegashira (0), Komusubi (5), Sekiwake (10), Ōzeki (15), Yokozuna (20). These are display milestones only. Win by 20 Prestige or last wrestler standing.
8. Add automated tests for all cases in `AGENT_IMPLEMENTATION.md`, run them, then report changes, tests, and any remaining differences. Keep the new game playable at 2, 4, and 6 players.

**No scope creep:** do not add actual real-world tournament progression, injuries, wrestler statistics, extra dice, a 60-card market, new online services, or complicated signature decks for this first version. The image assets and names are original fictional artwork/content; the rules are a draft for playtesting.
