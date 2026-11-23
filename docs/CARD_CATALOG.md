# YOKOZUNA — Character & Market Card Catalog

**Authoritative content / exact prototype values**. This file matches `yokozuna-data.json`. Every market card is unique; total **20 physical/digital market cards**, not 20 types plus duplicates.

### Conventions

- `KEEP` = ongoing personal power. `DISCARD` = immediate one-shot effect then return to market discard.
- Spirit is the market currency; Prestige is progress toward Yokozuna; Stamina is survival.
- `PUSH_DICE` sources are attacks; instant card damage is never an attack and never offers a ring retreat.
- When identical character and market abilities are present, they stack unless their individual wording forbids it.
- Every effect, including character powers, is a proposed **v1 balance value**, not yet playtested.

## Six Rikishi — signature cards

| ID | Rikishi / name | Style | Signature power | Play mechanic |
|---|---|---|---|---|
| `iwakaze` | **Iwakaze** (岩風) · *The Iron Wall* | Defender | **Unmovable** | Once per opponent turn, when an attack made with Push dice would deal you 2 or more damage while you control a dohyō position, prevent 1 of that damage. |
| `arashiryu` | **Arashiryū** (嵐龍) · *The Storm Dragon* | Attacker | **Fierce Tachiai** | Once on your turn, if your final dice show 3 or more Push symbols, add 1 damage to your dice attack. |
| `hoshinoumi` | **Hoshinoumi** (星ノ海) · *The Rising Star* | Prestige scorer | **Crowd Favourite** | Once on your turn, when your numbered dice earn at least 1 Prestige, gain 1 additional Prestige. |
| `chiyonami` | **Chiyonami** (千代波) · *The Clever Technician* | Dice control | **Master of Balance** | Once on your turn, after your two normal reroll opportunities, you may reroll exactly one die and must accept its new result. |
| `akatsukifuji` | **Akatsukifuji** (暁富士) · *The Gentle Giant* | Recovery | **Chanko Champion** | Once on your turn, if at least one Recovery die actually restores Stamina, restore 1 additional Stamina, up to 10. |
| `tetsunishiki` | **Tetsunishiki** (鉄錦) · *The Old Master* | Spirit economy | **Stable Wisdom** | Once on your turn, if your Spirit dice grant you 1 or more Fighting Spirit, gain 1 additional Fighting Spirit. |

### Rikishi artwork directions (sheet positions are row-major)

1. **Iwakaze** — An enormous, stern veteran in an indigo mawashi with folded arms, Mount Fuji, stylised indigo waves and golden evening cloud. Base colour `#315D87`. Asset `art/characters/01_iwakaze.png`.
2. **Arashiryū** — A fierce young rikishi in a crimson mawashi launching a low tachiai charge, vermilion lightning-like brushstrokes and flying dust. Base colour `#BA3F31`. Asset `art/characters/02_arashiryu.png`.
3. **Hoshinoumi** — A charismatic confident rikishi in a purple mawashi with an open-palmed showman pose, lilac banners, star shapes and cheering supporters. Base colour `#775C9C`. Asset `art/characters/03_hoshinoumi.png`.
4. **Chiyonami** — A relatively lean nimble rikishi in a dark green mawashi crouched low in a poised stance, bamboo and a breaking emerald wave. Base colour `#287760`. Asset `art/characters/04_chiyonami.png`.
5. **Akatsukifuji** — A broad cheerful rikishi in a mustard/gold mawashi, holding a steaming chanko-nabe bowl, lanterns and golden celebratory pattern. Base colour `#C39435`. Asset `art/characters/05_akatsukifuji.png`.
6. **Tetsunishiki** — A weathered older veteran rikishi in a turquoise mawashi, strong craggy face, pine trees, ocean-blue ink clouds and restrained gold. Base colour `#247F84`. Asset `art/characters/06_tetsunishiki.png`.

## 20 Market Cards

| # | ID | Card | Type | Cost ⚡ | Full effect |
|---:|---|---|---|---:|---|
| 01 | `tachiai_charge` | **Tachiai Charge** | `KEEP` | 5 | Once on your turn, if your final dice show 3 or more Push symbols, add 1 damage to your dice attack. |
| 02 | `mawashi_grip` | **Mawashi Grip** | `KEEP` | 4 | Once on your turn, after all rerolls, you may change one die showing 1 to Push. |
| 03 | `clay_footing` | **Clay Footing** | `KEEP` | 4 | Once per opponent turn, prevent 1 damage from the first dice attack that hits you while you control a dohyō position. |
| 04 | `extra_keiko` | **Extra Keiko** | `KEEP` | 4 | Once on your turn, after your normal rerolls, you may reroll exactly one die and must accept its result. |
| 05 | `chanko_recipe` | **Chanko Recipe** | `KEEP` | 4 | Once on your turn, if at least one Recovery die actually restores Stamina, restore 1 additional Stamina, up to 10. |
| 06 | `senior_rank` | **Senior Rank** | `KEEP` | 5 | When you start your turn controlling a dohyō position, gain 1 extra Prestige in addition to the normal 2. |
| 07 | `crowd_chant` | **Crowd Chant** | `KEEP` | 4 | Once on your turn, when numbered dice earn at least 1 Prestige, gain 1 additional Prestige. |
| 08 | `salt_ritual` | **Salt Ritual** | `KEEP` | 3 | Once on your turn, if your Spirit dice grant at least 1 Fighting Spirit, gain 1 additional Fighting Spirit. |
| 09 | `stable_support` | **Stable Support** | `KEEP` | 4 | At the end of your turn, if you are outside both dohyō positions and have 7 or fewer Stamina, recover 1 Stamina. |
| 10 | `rivalry` | **Fierce Rivalry** | `KEEP` | 3 | Once on your turn, when you take an empty dohyō position after resolving your Push dice attack, gain 1 additional Prestige. |
| 11 | `chanko_feast` | **Chanko Feast** | `DISCARD` | 3 | Immediately recover 3 Stamina, even if you control a dohyō position. You cannot exceed 10 Stamina. |
| 12 | `zabuton_storm` | **Zabuton Storm** | `DISCARD` | 4 | Immediately gain 3 Prestige. |
| 13 | `kachi_koshi` | **Kachi-koshi** | `DISCARD` | 6 | Immediately gain 5 Prestige. |
| 14 | `sponsor_gift` | **Sponsor’s Envelope** | `DISCARD` | 2 | Immediately gain 4 Fighting Spirit (after paying this card’s cost). |
| 15 | `shikiri_reset` | **Shikiri Reset** | `DISCARD` | 3 | Immediately recover 2 Stamina and gain 1 Prestige. |
| 16 | `henka` | **Henka!** | `DISCARD` | 4 | Choose one opponent controlling a dohyō position. They lose 3 Stamina. This is not a dice attack and does not allow them to retreat. |
| 17 | `tsuppari_flurry` | **Tsuppari Flurry** | `DISCARD` | 4 | Every opponent on the opposite side of the ring boundary from you loses 2 Stamina. This is not a dice attack and cannot cause a retreat. |
| 18 | `ceremonial_entrance` | **Ceremonial Entrance** | `DISCARD` | 3 | If you control a dohyō position, gain 2 Prestige. Otherwise, gain 1 Prestige and 1 Fighting Spirit. |
| 19 | `suriashi_drills` | **Suriashi Drills** | `DISCARD` | 2 | Immediately recover 2 Stamina and gain 1 Fighting Spirit. Healing works even in a dohyō position. |
| 20 | `final_bout` | **Final Bout** | `DISCARD` | 4 | Choose one opponent. They lose 2 Stamina, and you gain 1 Prestige. This is not a dice attack and cannot cause a retreat. |

### Art prompts, in fixed contact-sheet order

The original generated art is **illustration only**, with **no text, digits or built-in card frame**. Your app draws the real card names, costs, types and body copy so typography remains crisp.

01. **Tachiai Charge** — A red-mawashi wrestler exploding forward at the opening charge, forceful red-gold speed lines. Asset: `art/market/01_tachiai_charge.png`.
02. **Mawashi Grip** — Close-up hands gripping a blue sumo mawashi, tense dramatic fabric folds, indigo and brass. Asset: `art/market/02_mawashi_grip.png`.
03. **Clay Footing** — Feet digging into clay near the straw tawara ring edge, cracked earth and dust, ochre. Asset: `art/market/03_clay_footing.png`.
04. **Extra Keiko** — Rikishi performing a powerful high-leg shiko training stomp in a stable, emerald and gold. Asset: `art/market/04_extra_keiko.png`.
05. **Chanko Recipe** — Steaming traditional chanko-nabe meal in an iron pot with tofu, cabbage and broth, warm lantern glow. Asset: `art/market/05_chanko_recipe.png`.
06. **Senior Rank** — Ornate vertical banzuke ranking scroll without readable writing, gold braided tassels. Asset: `art/market/06_senior_rank.png`.
07. **Crowd Chant** — Excited tournament spectators calling out and waving patterned fans, indigo and purple crowd. Asset: `art/market/07_crowd_chant.png`.
08. **Salt Ritual** — Rikishi throwing a dazzling white arc of purification salt before a bout, violet smoky background. Asset: `art/market/08_salt_ritual.png`.
09. **Stable Support** — An older stablemaster coaching a younger rikishi beside practice posts, warm wooden stable. Asset: `art/market/09_stable_support.png`.
10. **Fierce Rivalry** — Two imposing rikishi glaring at each other before the tachiai, red and blue split composition. Asset: `art/market/10_rivalry.png`.
11. **Chanko Feast** — Huge bubbling chanko-nabe hotpot surrounded by rice bowls and chopsticks, steam. Asset: `art/market/11_chanko_feast.png`.
12. **Zabuton Storm** — Red floor cushions flying over jubilant sumo spectators in a packed arena. Asset: `art/market/12_zabuton_storm.png`.
13. **Kachi-koshi** — Triumphant rikishi holding a giant ornate golden tournament trophy beneath falling confetti. Asset: `art/market/13_kachi_koshi.png`.
14. **Sponsor’s Envelope** — Ceremonial envelopes and traditional embroidered sponsorship banners, gold and deep navy. Asset: `art/market/14_sponsor_gift.png`.
15. **Shikiri Reset** — Rikishi crouching quietly at shikiri lines, soft dust, focused eyes and amber lanterns. Asset: `art/market/15_shikiri_reset.png`.
16. **Henka!** — One nimble wrestler sidestepping a charging heavier rival, sweeping diagonal motion lines. Asset: `art/market/16_henka.png`.
17. **Tsuppari Flurry** — Rapid-fire open-hand thrusts in an arena, repeated hands and energetic red screen-print lines. Asset: `art/market/17_tsuppari_flurry.png`.
18. **Ceremonial Entrance** — Magnificent ring-entering ceremony, colourful kesho-mawashi apron and ceremonial rope. Asset: `art/market/18_ceremonial_entrance.png`.
19. **Suriashi Drills** — Low sliding-foot training exercise in a wooden stable with chalk lines and sweat. Asset: `art/market/19_suriashi_drills.png`.
20. **Final Bout** — High-drama final bout under arena spotlights, two sumo wrestlers locked in a mawashi grapple. Asset: `art/market/20_final_bout.png`.

### Card UX / secondary labels

Market: type badge (`KEEP` or `DISCARD`), Spirit cost as a large number next to ⚡, title in English, optional descriptive italic text, precise ability in 2–4 lines. Character: shikona, Japanese glyphs (optional localisation), epithet, one signature power, player colour, starting Stamina value.

### Balance watch list

- If Arashiryū buys `Tachiai Charge`, +2 attack damage is possible; this is intentional but must be tested.
- If Hoshinoumi buys `Crowd Chant`, +2 Prestige to successful numbered scoring is possible; watch early victories.
- If Iwakaze buys `Clay Footing`, both reductions can trigger against the same dice attack where eligible; do not silently clamp a separate effect before testing.
- `Kachi-koshi` is a high-cost burst of 5 Prestige; with a 20-Prestige victory this is a major finisher.
- `Henka!` and `Tsuppari Flurry` cause **nonattack** damage, so defenders cannot yield a position due to them.
