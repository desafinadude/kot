# YOKOZUNA — Coding Agent Implementation Brief

> **Objective:** Retheme the existing *King of Tokyo*-style application into a playable **YOKOZUNA** prototype by reusing its proven dice/turn/combat/market architecture and adding six optional character-passive hooks. **Do not rewrite the engine unnecessarily.** Read `YOKOZUNA_RULES.md`, `CARD_CATALOG.md`, `ART_DIRECTION.md`, and `yokozuna-data.json` before changing code.

## Reuse map — old mechanic → new name

| Existing concept | Yokozuna concept | Change required |
|---|---|---|
| Monster | Rikishi | Renaming, identity and art |
| Tokyo City | Main Dohyō | Rename location, retain occupancy targeting/entry |
| Tokyo Bay | Challenge Dohyō | Rename; only active with >=5 alive |
| Victory Points | Prestige | Rename UI/model label, cap at target >=20 |
| Life / Health | Stamina | Rename UI/model label; default max 10 |
| Energy | Fighting Spirit | Rename currency icon and descriptions |
| Attack / Claw | Push / open palm | Rename die face and effect, preserve target logic |
| Heal die | Recovery | Rename icon, prohibited inside ring |
| 66-card power deck | **20-card** Technique/Event deck | Replace deck/content entirely; exact 10 KEEP + 10 DISCARD |
| Monster selection | Rikishi selection | Add 6 passives with bounded trigger API |
| Victory threshold | Promotion to Yokozuna | 20 Prestige or last standing |
| Tokyo board | Dohyō board | Replace layout/asset and location labels |

## Data and modules

- Source-of-truth config: `yokozuna-data.json`, validated at app startup.
- Use stable `id` keys, not array indexes or display text, for save games, market effects, and player selection.
- Suggested modules: `gameConfig`, `characters`, `cardDefinitions`, `effectRegistry`, `diceReducer`, `ringReducer`, `marketReducer`, `winReducer`, `uiAssets`.
- Implement a **data-driven effect registry** keyed by `ability_id` and `effect_id`. Do **not** evaluate card text as code.
- Reuse RNG / seeded dice rolls, current reducer, market store, turn authority, animations and multiplayer synchronization from the existing build.
- Keep all game state deterministic and serializable; effects should produce events/transitions, not mutate UI components directly.

## Required state fields (adapt to existing schema)

```ts
type DiceFace = '1' | '2' | '3' | 'SPIRIT' | 'PUSH' | 'RECOVER';
type RingPosition = 'OUTSIDE' | 'MAIN' | 'CHALLENGE';
type DamageSource = 'PUSH_DICE' | 'CARD_EFFECT';
type CardType = 'KEEP' | 'DISCARD';
type TurnPhase = 'START' | 'ROLL' | 'RESOLVE' | 'MARKET' | 'END';
interface PlayerState {
  id: string;
  rikishiId: string;
  stamina: number;
  prestige: number;
  spirit: number;
  position: RingPosition;
  keepCardIds: string[];
  alive: boolean;
}
interface GameState {
  players: PlayerState[];
  activePlayerId: string;
  phase: TurnPhase;
  dice: DiceFace[];
  rollsUsed: number;
  marketIds: (string | null)[];
  deckIds: string[];
  discardIds: string[];
  perTurnFlags: Record<string, boolean>;
  winnerId?: string;
}
```

## Implementation order

1. **Branch/backup existing game.** Add a `theme: 'yokozuna'` config; preserve original game mode if wanted.
2. **Add the 6 characters** from JSON and player selection. Set 10 Stamina/0 Prestige/0 Spirit.
3. **Reskin dice** (1/2/3, Spirit/Push/Recover). Keep the 6-die 2-reroll engine; expose optional bonus reroll hooks before finalizing dice.
4. **Reskin ring** to Main / Challenge. Test automatic entrance, attack targeting, voluntary retreat, healing ban, opening attack, double ring at >=5 alive, deactivation below 5.
5. **Implement all six passive ability handlers**, with once-per-owner-turn or once-per-opponent-turn tracking as appropriate.
6. **Replace marketplace** with exactly 20 JSON cards. Implement the listed 10 KEEP handlers and 10 DISCARD handlers. Keep 3 face-up slots and 2-Spirit full refresh. Ensure discard reshuffle/exhaustion works with a short deck.
7. **Implement promotion strip** thresholds, end-of-turn and last-survivor victory checks, new win screen "YOKOZUNA!".
8. **Apply contact-sheet assets**. Do not rely on generated art for text; use UI typography for names, stats, costs and card rules.
9. **Add tests** from the acceptance checklist. Confirm single-player/browser-mode and existing online/local multiplayer behavior as applicable.

## Minimal effect event API

Use one hook pipeline rather than sprinkling logic across screens:

```
onTurnStart -> beforeDiceFinalized -> onNumberScore -> onSpiritGain
  -> beforePushDamage -> afterPushDamage -> onRingEntry
  -> onRecovery -> onPurchase -> onCardResolved
  -> onTurnEnd -> checkVictory
```

Handlers should return a patch/events list; use source tags so `CARD_EFFECT` never invokes ring-retreat prompts. Characters and `KEEP` cards subscribe to the same hook pipeline but have separate use flags for each copy.

## Effect registry keys

**Character:** `iron_wall`, `fierce_tachiai`, `crowd_favourite`, `master_balance`, `chanko_champion`, `stable_wisdom`.

**KEEP:** `attack_bonus_three`, `convert_one_to_push`, `ring_defense_once`, `extra_single_reroll`, `heal_bonus`, `ring_start_prestige`, `numbered_bonus`, `spirit_bonus`, `end_turn_outside_heal`, `entry_prestige_bonus`.

**DISCARD:** `instant_heal_3`, `instant_prestige_3`, `instant_prestige_5`, `instant_spirit_4`, `instant_heal_2_prestige_1`, `instant_ring_target_damage_3`, `instant_opposite_damage_2`, `instant_conditional_prestige`, `instant_heal_2_spirit_1`, `instant_target_damage_2_prestige_1`.

## Specific UX requirements

- Starting screen displays title YOKOZUNA and six selectable wrestler cards, each with **visible distinct ability**, not just cosmetic skin.
- Main HUD shows current name, character power, Stamina ❤️, Prestige ⭐, Fighting Spirit ⚡ and current rank.
- Clearly mark who controls the dohyō and show +1 entry / +2 start bonuses visibly.
- Market displays only 3 cards with cost, type and complete effect. Disable unpayable purchases; allow refresh for 2 Spirit.
- When inside and rolling `RECOVER`, show locked/greyed heart with clear tool-tip.
- Use concise announcements: "Iwakaze holds the dohyō (+2 Prestige)", "Arashiryū's Fierce Tachiai +1 Push", "Chiyonami rerolls one die".
- For 5–6 players show Challenge Dohyō; otherwise hide it completely.
- Keep high contrast on phone UI; if a card's body text would overflow, allow scrolling/expansion instead of illegible small type.

## Automated acceptance tests (minimum)

| Case | Setup / action | Expected |
|---|---|---|
| Fresh game | Pick any rikishi | 10 Stamina, 0 Prestige, 0 Spirit; all outside |
| Dice scoring | `2,2,2,2,SPIRIT,PUSH` | +3 Prestige, +1 Spirit, 1 damage to eligible targets |
| Double triple | `1,1,1,3,3,3` | +4 Prestige |
| First ring capture | Empty ring, first Push dice attack | Attacker enters Main, +1 Prestige, zero Push damage |
| Ring start | Player inside begins own turn | +2 Prestige; `Senior Rank` makes +3 |
| Ring healing ban | Player inside rolls Recover | Zero healing from dice |
| Ability activation | Arashiryū has 3+ Push | Attack has +1 damage only once |
| Defender | Iwakaze takes 3 Push damage inside | Takes 2 (if ability unused this attacker turn) |
| Recovery synergy | Akatsukifuji has 8 Stamina, rolls 1 Recover while outside | Restores 2 to 10 |
| No overheal synergy | Akatsukifuji already at 10 | Does not exceed 10 |
| Reroll | Chiyonami after normal rerolls | Exactly one extra die rerolled; result mandatory |
| Market purchase | Buy one of 3 cards | Pay cost and refill 1 immediately |
| Market refresh | Pay 2 Spirit | All currently shown cards discarded/refilled |
| Short deck exhaustion | No cards in draw, some in discard | Shuffle only discard into draw; never duplicate KEEP |
| Nonattack damage | Buy `Henka!` against inside player | 3 damage; no voluntary retreat / no auto entry |
| Ring switch | Inside player yields after Push damage | Outside attacker enters one empty position; +1 Prestige |
| 5–6 setup | Six alive | Challenge position active |
| Fall to four alive | Five alive with someone in Challenge, one dies | Challenge deactivates and its occupant moves outside without damage |
| Winner | Alive with 20+ at end of turn | YOKOZUNA win screen |
| Mutual destruction | Final players both eliminated in one effect | No winner |

## Integration warning — no hidden assumptions

No existing app source has been provided with this package; module names and data interfaces above are **proposed adapters**, not claims about the actual repository. An agent should first inspect its engine's current types and fit the new data/handlers into them, not mechanically apply file names from this brief.

**Scope discipline:** do not add real-life tournament calendars, historic rankings, brackets, NPCs, betting, rankings based on real wrestlers, or net-new backend services. First ship the above rules exactly, with art, then playtest.
