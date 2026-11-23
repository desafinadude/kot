// YOKOZUNA — data-driven effect registry.
//
// Every character `ability_id` and market `effect_id` in data/yokozuna-data.json
// maps to one entry here. Card text is NEVER evaluated — it is display copy only.
//
// Passive entries subscribe to engine hooks. A hook handler receives a context
// object and returns a small patch ({ prestige }, { spirit }, { stamina },
// { damage }, { prevent }) or null when it does not trigger. The engine owns
// all state changes, once-per-turn bookkeeping and announcements:
//
//   once: 'turn'          — at most once per owner turn (per source instance)
//   once: 'opponentTurn'  — at most once per opponent (attacker) turn
//
// Hook pipeline (engine call order):
//   onTurnStart → [actives: reroll/convert] → onNumberScore → onSpiritGain
//   → beforePushDamage → modifyIncomingPush → onRingEntry → onRecovery
//   → (market: instant) → onTurnEnd → checkVictory
//
// Active entries (player-triggered, during the roll phase) declare
//   active: { kind: 'reroll' | 'convert', from?: face, to?: face }
// DISCARD entries declare `instant(game, player, target)` and, when they need
// a chosen opponent, `targets(game, player)` returning the eligible players.

export const EFFECTS = {
  // ── character signature powers ─────────────────────────────────────────
  iron_wall: {
    once: 'opponentTurn',
    // evaluated against the raw incoming Push damage, so it stacks with Clay Footing
    modifyIncomingPush: ({ raw, inside }) => (inside && raw >= 2 ? { prevent: 1 } : null),
  },
  fierce_tachiai: {
    once: 'turn',
    beforePushDamage: ({ pushCount }) => (pushCount >= 3 ? { damage: 1 } : null),
  },
  crowd_favourite: {
    once: 'turn',
    onNumberScore: ({ scored }) => (scored >= 1 ? { prestige: 1 } : null),
  },
  master_balance: {
    once: 'turn',
    active: { kind: 'reroll' },
  },
  chanko_champion: {
    once: 'turn',
    onRecovery: ({ healed }) => (healed >= 1 ? { stamina: 1 } : null),
  },
  stable_wisdom: {
    once: 'turn',
    onSpiritGain: ({ gained }) => (gained >= 1 ? { spirit: 1 } : null),
  },

  // ── KEEP cards ─────────────────────────────────────────────────────────
  attack_bonus_three: {
    once: 'turn',
    beforePushDamage: ({ pushCount }) => (pushCount >= 3 ? { damage: 1 } : null),
  },
  convert_one_to_push: {
    once: 'turn',
    active: { kind: 'convert', from: '1', to: 'PUSH' },
  },
  ring_defense_once: {
    once: 'opponentTurn',
    // "the first dice attack that hits you" — one dice attack per opponent turn,
    // so the once-per-opponent-turn flag is exactly "first hit".
    modifyIncomingPush: ({ raw, inside }) => (inside && raw >= 1 ? { prevent: 1 } : null),
  },
  extra_single_reroll: {
    once: 'turn',
    active: { kind: 'reroll' },
  },
  heal_bonus: {
    once: 'turn',
    onRecovery: ({ healed }) => (healed >= 1 ? { stamina: 1 } : null),
  },
  ring_start_prestige: {
    onTurnStart: ({ inside }) => (inside ? { prestige: 1 } : null),
  },
  numbered_bonus: {
    once: 'turn',
    onNumberScore: ({ scored }) => (scored >= 1 ? { prestige: 1 } : null),
  },
  spirit_bonus: {
    once: 'turn',
    onSpiritGain: ({ gained }) => (gained >= 1 ? { spirit: 1 } : null),
  },
  end_turn_outside_heal: {
    onTurnEnd: ({ inside, stamina }) => (!inside && stamina <= 7 ? { stamina: 1 } : null),
  },
  entry_prestige_bonus: {
    once: 'turn',
    onRingEntry: ({ viaAttack }) => (viaAttack ? { prestige: 1 } : null),
  },

  // ── DISCARD cards ──────────────────────────────────────────────────────
  instant_heal_3: {
    instant: (g, p) => { g.heal(p, 3, 'Chanko Feast'); },
  },
  instant_prestige_3: {
    instant: (g, p) => { g.gainPrestige(p, 3, 'Zabuton Storm'); },
  },
  instant_prestige_5: {
    instant: (g, p) => { g.gainPrestige(p, 5, 'Kachi-koshi'); },
  },
  instant_spirit_4: {
    instant: (g, p) => { g.gainSpirit(p, 4, 'Sponsor’s Envelope'); },
  },
  instant_heal_2_prestige_1: {
    instant: (g, p) => { g.heal(p, 2, 'Shikiri Reset'); g.gainPrestige(p, 1, 'Shikiri Reset'); },
  },
  instant_ring_target_damage_3: {
    targets: (g, p) => g.alive().filter((o) => o !== p && o.position !== 'OUTSIDE'),
    instant: async (g, p, target) => {
      await g.dealDamage(p, [target], 3, 'CARD_EFFECT', 'Henka!');
    },
  },
  instant_opposite_damage_2: {
    instant: async (g, p) => {
      await g.dealDamage(p, g.oppositeOf(p), 2, 'CARD_EFFECT', 'Tsuppari Flurry');
    },
  },
  instant_conditional_prestige: {
    instant: (g, p) => {
      if (p.position !== 'OUTSIDE') g.gainPrestige(p, 2, 'Ceremonial Entrance');
      else { g.gainPrestige(p, 1, 'Ceremonial Entrance'); g.gainSpirit(p, 1, 'Ceremonial Entrance'); }
    },
  },
  instant_heal_2_spirit_1: {
    instant: (g, p) => { g.heal(p, 2, 'Suriashi Drills'); g.gainSpirit(p, 1, 'Suriashi Drills'); },
  },
  instant_target_damage_2_prestige_1: {
    targets: (g, p) => g.alive().filter((o) => o !== p),
    instant: async (g, p, target) => {
      await g.dealDamage(p, [target], 2, 'CARD_EFFECT', 'Final Bout');
      g.gainPrestige(p, 1, 'Final Bout');
    },
  },
};

export const CHARACTER_KEYS = ['iron_wall', 'fierce_tachiai', 'crowd_favourite', 'master_balance', 'chanko_champion', 'stable_wisdom'];
export const KEEP_KEYS = ['attack_bonus_three', 'convert_one_to_push', 'ring_defense_once', 'extra_single_reroll', 'heal_bonus',
  'ring_start_prestige', 'numbered_bonus', 'spirit_bonus', 'end_turn_outside_heal', 'entry_prestige_bonus'];
export const DISCARD_KEYS = ['instant_heal_3', 'instant_prestige_3', 'instant_prestige_5', 'instant_spirit_4', 'instant_heal_2_prestige_1',
  'instant_ring_target_damage_3', 'instant_opposite_damage_2', 'instant_conditional_prestige', 'instant_heal_2_spirit_1',
  'instant_target_damage_2_prestige_1'];

/**
 * Validate the game data at startup. Throws with every problem listed.
 * Enforces: 6 unique characters, exactly 20 unique market cards (10 KEEP +
 * 10 DISCARD), every ability/effect id has a registered handler of the right kind.
 */
export function validateData(data) {
  const errs = [];
  const cfg = data?.config;
  if (!cfg) errs.push('missing config');
  const chars = data?.characters || [];
  const cards = data?.cards || [];
  if (chars.length !== 6) errs.push(`expected 6 characters, got ${chars.length}`);
  if (cards.length !== 20) errs.push(`expected 20 market cards, got ${cards.length}`);
  const keep = cards.filter((c) => c.type === 'KEEP').length;
  const disc = cards.filter((c) => c.type === 'DISCARD').length;
  if (keep !== 10 || disc !== 10) errs.push(`expected 10 KEEP + 10 DISCARD, got ${keep} + ${disc}`);
  const dup = (arr) => arr.filter((x, i) => arr.indexOf(x) !== i);
  for (const d of dup(chars.map((c) => c.id))) errs.push(`duplicate character id ${d}`);
  for (const d of dup(cards.map((c) => c.id))) errs.push(`duplicate card id ${d}`);
  for (const c of chars) {
    const e = EFFECTS[c.ability_id];
    if (!e || !CHARACTER_KEYS.includes(c.ability_id)) errs.push(`character ${c.id}: no handler for ability ${c.ability_id}`);
    if (!c.asset) errs.push(`character ${c.id}: missing asset`);
  }
  for (const c of cards) {
    const e = EFFECTS[c.effect_id];
    if (!e) { errs.push(`card ${c.id}: no handler for effect ${c.effect_id}`); continue; }
    if (c.type === 'DISCARD' && typeof e.instant !== 'function') errs.push(`card ${c.id}: DISCARD effect ${c.effect_id} has no instant handler`);
    if (c.type === 'KEEP' && typeof e.instant === 'function') errs.push(`card ${c.id}: KEEP effect ${c.effect_id} is an instant`);
    if (!Number.isInteger(c.cost) || c.cost < 0) errs.push(`card ${c.id}: bad cost`);
    if (!c.asset) errs.push(`card ${c.id}: missing asset`);
  }
  if (cfg && JSON.stringify(cfg.dice_faces) !== JSON.stringify(['1', '2', '3', 'SPIRIT', 'PUSH', 'RECOVER'])) {
    errs.push('config.dice_faces must be 1,2,3,SPIRIT,PUSH,RECOVER');
  }
  if (errs.length) throw new Error(`yokozuna-data.json invalid:\n - ${errs.join('\n - ')}`);
  return true;
}
