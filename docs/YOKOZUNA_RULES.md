# YOKOZUNA — The Road to Grand Champion

**Playtest rules v1.0 — 2–6 players · 25–35 minutes · age 8+**

A lively dice-and-card battle in a fictional grand sumo tournament. Choose a distinctive rikishi, command the dohyō, collect Fighting Spirit, learn techniques, and rise through the ranks to become **Yokozuna**.

> **Design provenance:** This is a new, unofficial sumo retheme and playable variant designed for a pre-existing *King of Tokyo*-style codebase. Core dice/market/ring ideas intentionally remain recognisable; original characters, named powers, promotional framing and art are new. Not an official sumo association product or *King of Tokyo* expansion. The promotion track is a game abstraction, not how real-world promotion to Yokozuna works.

## 1. Components

- 6 rikishi cards, each with **one always-active signature ability**.
- 6 wrestler standees/tokens and 6 player boards, or digital equivalents.
- 1 dohyō board with a **Main Dohyō** position. Add the **Challenge Dohyō** position for 5–6 players.
- 6 identical six-sided dice (one each of `1`, `2`, `3`, `SPIRIT`, `PUSH`, `RECOVER`).
- **Exactly 20 market cards:** 10 `KEEP` and 10 `DISCARD`; no duplicates required.
- Counters / HUD tracks for Stamina, Prestige, and Fighting Spirit.

## 2. How to win

- **Promotion victory:** Be alive at the end of a turn with **20 or more Prestige** (⭐). You become Yokozuna.
- **Survival victory:** Be the only wrestler remaining. You become Yokozuna by dominance.
- If all remaining wrestlers are eliminated simultaneously, there is **no winner**.
- Players start with **10 Stamina**, **0 Prestige**, and **0 Fighting Spirit**. Unless a rule explicitly says otherwise, Stamina cannot exceed **10**.

### The ranks (display only in v1)

| Prestige | Displayed rank |
|---:|---|
| 0–4 | Maegashira |
| 5–9 | Komusubi |
| 10–14 | Sekiwake |
| 15–19 | Ōzeki |
| 20+ | **Yokozuna — winner** |

Promotion milestones are purely cosmetic in v1; they do **not** unlock extra dice, free Stamina, or additional abilities.

## 3. The six dice

| Face | Meaning | Effect |
|---|---|---|
| `1`, `2`, `3` | Ranked performance | Three matching numbers earn that number of Prestige, plus 1 Prestige for each extra identical result. A set of fewer than three does nothing. |
| `SPIRIT` ⚡ | Fighting Spirit | Gain 1 Fighting Spirit **per die**. Save it across turns. |
| `PUSH` ✋ | Attack | Deal 1 Stamina damage per die to every opponent on the **opposite side of the ring boundary**. |
| `RECOVER` 💚 | Recovery | Recover 1 Stamina per die **only while outside** the dohyō positions. |

**Number example:** four `2`s and two `SPIRIT` faces = 3 Prestige and 2 Fighting Spirit. Three `1`s plus three `3`s = 4 Prestige (one point for the `1`s, three for the `3`s).

### Rolls and rerolls

1. Roll all six dice.
2. You may choose any subset for a first reroll.
3. You may choose any subset for a second reroll. Dice previously held may be rerolled.
4. Apply allowed extra single-die rerolls from abilities or cards in **player-chosen order**, then lock final dice. Each such effect may be used at most once per turn.

## 4. Setup

1. Each player picks a different rikishi and takes their card/token.
2. Set each player's **Stamina to 10, Prestige to 0, Fighting Spirit to 0**.
3. Put all wrestlers **outside** the dohyō at the start.
4. Shuffle the 20-card market deck. Reveal 3 face-up cards.
5. For **2–4 players**, activate only the **Main Dohyō**; for **5–6**, activate the **Challenge Dohyō** too.
6. Everyone rolls six dice once; the player showing the most `PUSH` symbols goes first. Ties reroll among tied players. Take turns clockwise.

## 5. Your turn

1. **Start-of-turn ring bonus:** If you already control a dohyō position at the start of your turn, gain **2 Prestige**. Apply `Senior Rank` if owned.
2. **Roll and reroll:** Roll six dice, make up to two normal reroll choices, and optionally use permitted extra rerolls.
3. **Resolve final dice in this exact order:**
   1. Score numbered combinations and any applicable bonuses.
   2. Gain Fighting Spirit and any applicable bonuses.
   3. Resolve the `PUSH` dice attack, including damage prevention, eliminations, retreats, and vacant-position entry.
   4. Resolve `RECOVER` dice if **outside** the dohyō **after** the attack/entry phase. Apply recovery bonuses only if healing actually occurs.
4. **Market phase (optional):** Buy any face-up cards you can afford, or refresh the market. Purchases and refreshes may be repeated while you can pay.
5. **End-of-turn effects:** Apply owned end-of-turn effects; check whether an alive wrestler with 20+ Prestige has won. Pass the dice clockwise.

> In this prototype, finish resolving a player's turn before declaring a 20-Prestige victory, so an effect that eliminates that wrestler in the same turn still matters. A sole survivor wins as soon as the current damage/effect resolves.

## 6. Controlling the dohyō

A wrestler is either **outside** or occupying exactly **one** dohyō position. Main and Challenge positions both count as **inside** for every rule; their occupants do not hit each other with dice attacks.

- **Enter an empty position after your `PUSH` dice attack:** gain **1 Prestige**.
- **Start your own turn inside:** gain **2 Prestige**.
- **Cannot use `RECOVER` dice while inside**; market cards may still restore Stamina while inside.
- **Inside player rolls Push:** all **outside** opponents take damage; fellow inside players are unaffected.
- **Outside player rolls Push:** all **inside** opponents take damage. Outside players are unaffected.
- **No one inside at start of game:** the first attack showing 1+ `PUSH` deals no damage and places its attacker in Main Dohyō (+1 Prestige).
- **Empty available position later:** when an outside wrestler resolves a dice attack, they must enter an open position, with Main taking priority, and gain +1 Prestige; this still applies if zero opponents were damaged because the positions were empty.

### Retreat / yielding the ring

After taking **damage from an opponent's Push dice attack**, a surviving inside wrestler may choose to **retreat** outside. They still lose the Stamina first. The outside attacker takes an available vacant position; Main takes priority. This is the only automatic replacement route.

- Attacks can target multiple inside wrestlers simultaneously (5–6 players). Apply all damage, then let surviving defenders choose to retreat in fixed turn order, then put the attacker into **one** vacant position.
- If a `PUSH` attack eliminates an inside wrestler, the attacker must enter one newly vacant position if still alive.
- **Market-card damage is not a Push dice attack:** it never causes a retreat or automatic entry. An eliminated defender's position simply becomes empty.
- Effects reducing attack damage to zero do **not** count as a damaging attack for the purpose of a defender choosing to retreat. A vacant ring position may still be entered if Push dice were rolled.

### 5–6 player variant: Challenge Dohyō

- Activate this second position only while **5 or more** wrestlers are alive.
- Both positions count as **inside**; each occupant gets its own start-of-turn 2 Prestige.
- An outside Push attack damages all occupants; an inside Push attack damages all outside opponents.
- Occupants never damage each other with Push dice.
- An outside attacker enters at most **one** open position after its attack, Main before Challenge.
- If the alive count falls below 5, immediately deactivate Challenge: move its occupant outside **without dealing damage or granting entry Prestige**. Main remains active.

## 7. The 20-card market

- Display **three face-up cards** from the shuffled 20-card deck.
- Cards cost Fighting Spirit. Costs are shown on each card.
- A `KEEP` card stays in front of its owner and its effect can trigger as specified.
- A `DISCARD` card applies immediately during purchase, then goes to the market discard pile.
- Replace bought cards **immediately** from the deck.
- Pay **2 Fighting Spirit** to discard all three face-up market cards and refill three. Repeat as desired.
- Players may buy several cards in one market phase; effects marked **once per turn** cannot trigger repeatedly just because of several actions.
- Whenever the draw deck runs out, **shuffle the discard pile** and continue drawing. Cards currently kept by players or displayed in the market never return to the draw deck.
- If no cards remain in deck or discard pile, leave unfillable market slots empty. A refresh still costs 2 Spirit if chosen; do not take payment if there are zero displayed cards to refresh.
- If a wrestler is eliminated, their `KEEP` cards go into the discard pile. Their accumulated Spirit is lost.

The 20 cards and exact effects are in **`CARD_CATALOG.md`** and **`yokozuna-data.json`**. There are **10 KEEP and 10 DISCARD** cards, one of each.

## 8. Character signature powers

Each selected rikishi has exactly one passive ability for the entire game. Character powers and `KEEP` cards **stack additively** unless stated otherwise. A 'once per turn' ability is tracked by owner turn; 'once per opponent turn' effects reset for each attacking opponent turn. Full, authoritative wording is in `CARD_CATALOG.md`.

## 9. Priority / edge cases for programmers and playtesting

1. **Number scoring uses groups:** three or more of any number score; split triples of different numbers both score.
2. **Attack bonus without Push:** damage bonuses cannot create a dice attack if the final dice have zero Push symbols.
3. **Damage source:** `PUSH_DICE` is an attack (can cause retreat); `CARD_EFFECT` is not (cannot cause retreat).
4. **Reroll timing:** single-die extras happen after the two normal rerolls and before any score/damage resolution.
5. **Stamina cap:** heal first, clamp to 10, then conditional +1 heal if at least one actual point was restored; if already at 10, no extra healing.
6. **Entering:** the ring entry +1 Prestige triggers after attack/retreat logic, never when a defender merely stays.
7. **Multiple vacant positions:** attacker enters Main first; never both.
8. **Market instant damage:** target eligibility determined when the card resolves; death clears its occupied position, without automatic entry.
9. **Extra KEEP effects:** each card instance's trigger is evaluated separately, enabling two similar bonuses to stack.
10. **Win check:** alive at end of active turn with >=20 Prestige; last survivor immediately; no survivor means draw/no winner.
11. **No resources on elimination:** eliminated players cannot buy, play, or win.
12. **Market empty:** do not infinite-loop refilling when deck and discard are both empty.

## 10. Example turn

Chiyonami has 7 Stamina and 5 Prestige, outside the ring. On the final dice they have `2, 2, 2, 2, SPIRIT, PUSH` after exercising their extra one-die reroll. They score **3 Prestige** (2 for the triple plus 1 for the fourth `2`) and **1 Fighting Spirit**. Their single Push deals 1 damage to every current inside wrestler. If the inside wrestler chooses to retreat, Chiyonami moves into the empty Main Dohyō, immediately earns **1 more Prestige**, and now has 9 Prestige total. Because no `RECOVER` symbol remains, Chiyonami heals nothing. They may then shop.

## 11. Playtest priorities

- Test 2, 4, and 6 players. In particular, monitor whether two dohyō positions accelerate Prestige too quickly in 5–6-player games.
- Watch `Senior Rank`, `Kachi-koshi`, and overlapping attack bonuses. Adjust numbers only after testing.
- The fictional shikona are creative names. Japanese calligraphy displayed in assets should be reviewed before shipping.
- **Not included in v1:** forced Push-Out rule, wrestler statistics beyond one power, injuries, bouts/brackets, real-world promotion criteria, extra dice, legendary rarities, foil gameplay bonuses.
