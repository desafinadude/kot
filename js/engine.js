// YOKOZUNA — rules engine (framework-agnostic, UI-agnostic, deterministic).
//
// State is plain serializable data (ids only, seeded RNG kept in state). The UI
// renders from `game.state` and calls actions; the engine calls back through
// `hooks` for animation pacing (`stage`) and player decisions (`promptRetreat`,
// `promptTarget`). All character/card behaviour lives in js/effects.js.
//
// Phase names (kept from the original engine) ↔ brief TurnPhase:
//   awaitRoll = START/ROLL · rolled = ROLL · resolving = RESOLVE
//   buying = MARKET · ending = END · over = game finished

import { EFFECTS } from './effects.js';

export const FACES = ['1', '2', '3', 'SPIRIT', 'PUSH', 'RECOVER'];
export const FACE_GLYPH = { 1: '1', 2: '2', 3: '3', SPIRIT: '⚡', PUSH: '✋', RECOVER: '💚' };
export const POSITION_NAME = { MAIN: 'Main Dohyō', CHALLENGE: 'Challenge Dohyō', OUTSIDE: 'outside' };

/** Numbered dice: each face with 3+ copies scores face value + 1 per extra copy. */
export function scoreNumbers(dice) {
  const groups = [];
  for (const face of ['1', '2', '3']) {
    const count = dice.filter((d) => d === face).length;
    if (count >= 3) groups.push({ face, count, points: Number(face) + (count - 3) });
  }
  return { total: groups.reduce((a, g) => a + g.points, 0), groups };
}

export function rankFor(prestige, thresholds) {
  let rank = thresholds[0].rank;
  for (const t of thresholds) if (prestige >= t.at) rank = t.rank;
  return rank;
}

export class Game {
  /**
   * @param {object} data parsed data/yokozuna-data.json (validated by the caller)
   * @param {{onChange?:Function, log?:Function, stage?:Function,
   *          promptRetreat?:Function, promptTarget?:Function}} hooks
   */
  constructor(data, hooks = {}) {
    this.data = data;
    this.cfg = data.config;
    this.hooks = hooks;
    this.charById = Object.fromEntries(data.characters.map((c) => [c.id, c]));
    this.cardById = Object.fromEntries(data.cards.map((c) => [c.id, c]));
    this.state = null;
  }

  // ── RNG (mulberry32, state lives in game.state.rng → saves are deterministic)
  rand() {
    const s = this.state;
    let t = (s.rng = (s.rng + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  randInt(n) { return Math.floor(this.rand() * n); }
  rollFace() { return FACES[this.randInt(FACES.length)]; }
  shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = this.randInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  // ── setup ────────────────────────────────────────────────────────────────
  /**
   * @param {string[]} rikishiIds seat order (clockwise)
   * @param {{botSeats?:number[], seed?:number, firstSeat?:number}} opts
   */
  async start(rikishiIds, opts = {}) {
    const cfg = this.cfg;
    const n = rikishiIds.length;
    if (n < cfg.players.min || n > cfg.players.max) throw new Error(`need ${cfg.players.min}–${cfg.players.max} players`);
    if (new Set(rikishiIds).size !== n) throw new Error('each player must pick a different rikishi');
    const botSeats = new Set(opts.botSeats || []);
    this.state = {
      serial: 0,
      players: rikishiIds.map((rid, i) => {
        const c = this.charById[rid];
        if (!c) throw new Error(`unknown rikishi ${rid}`);
        return {
          seat: i, id: `p${i + 1}`, rikishiId: rid, name: c.name, color: c.color,
          stamina: cfg.initial_stamina, prestige: cfg.initial_prestige, spirit: cfg.initial_spirit,
          position: 'OUTSIDE', keepCardIds: [], alive: true, bot: botSeats.has(i),
        };
      }),
      turn: 0, phase: 'awaitRoll', winner: null, winnerId: null,
      dice: [], keep: [], rerollsLeft: 0, rollsUsed: 0, diceLocked: false,
      marketIds: Array(cfg.market_slots).fill(null), deckIds: [], discardIds: [],
      perTurnFlags: {},
      challengeActive: n >= cfg.second_ring_min_alive_players,
      rng: (opts.seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0,
      openingRolls: [],
      log: [], lastEvent: '',
    };
    const s = this.state;
    s.deckIds = this.shuffle(this.data.cards.map((c) => c.id));
    for (let i = 0; i < s.marketIds.length; i++) s.marketIds[i] = this.drawCard();
    this.log(`The tournament begins: ${n} rikishi. ${s.challengeActive ? 'Main and Challenge Dohyō are open.' : 'The Main Dohyō is open.'}`);
    s.turn = opts.firstSeat ?? this.rollOff();
    this.log(`${s.players[s.turn].name} steps up first.`);
    await this.beginTurn();
  }

  /** Everyone rolls six dice; most Push goes first; ties re-roll among the tied. */
  rollOff() {
    let contenders = this.state.players.map((p) => p.seat);
    for (;;) {
      const round = contenders.map((seat) => {
        const dice = Array.from({ length: this.cfg.base_dice }, () => this.rollFace());
        return { seat, push: dice.filter((d) => d === 'PUSH').length };
      });
      this.state.openingRolls.push(round);
      const best = Math.max(...round.map((r) => r.push));
      const top = round.filter((r) => r.push === best).map((r) => r.seat);
      this.log(`Opening roll: ${round.map((r) => `${this.state.players[r.seat].name} ${r.push}✋`).join(', ')}.`);
      if (top.length === 1) return top[0];
      contenders = top;
    }
  }

  // ── queries ──────────────────────────────────────────────────────────────
  me() { return this.state.players[this.state.turn]; }
  alive() { return this.state.players.filter((p) => p.alive); }
  isInside(p) { return p.position !== 'OUTSIDE'; }
  activePositions() { return this.state.challengeActive ? ['MAIN', 'CHALLENGE'] : ['MAIN']; }
  occupant(pos) { return this.alive().find((p) => p.position === pos) || null; }
  vacantPositions() { return this.activePositions().filter((pos) => !this.occupant(pos)); }
  /** Opponents on the opposite side of the ring boundary. */
  oppositeOf(p) { return this.alive().filter((o) => o !== p && this.isInside(o) !== this.isInside(p)); }
  rank(p) { return rankFor(p.prestige, this.cfg.rank_thresholds); }
  character(p) { return this.charById[p.rikishiId]; }

  /** Ordered effect sources for a player: signature power first, then KEEP cards. */
  sources(p) {
    const c = this.character(p);
    const out = [{ key: `char:${c.ability_id}`, effectId: c.ability_id, name: c.ability_name, kind: 'character' }];
    for (const id of p.keepCardIds) {
      const card = this.cardById[id];
      out.push({ key: `card:${id}`, effectId: card.effect_id, name: card.name, kind: 'card' });
    }
    return out;
  }
  flagKey(p, src) { return `${p.id}|${src.key}`; }
  used(p, src) { return !!this.state.perTurnFlags[this.flagKey(p, src)]; }

  /** Run one hook for one player's sources; returns triggered [{src, result}]. */
  runHook(p, hook, ctx) {
    const out = [];
    for (const src of this.sources(p)) {
      const eff = EFFECTS[src.effectId];
      if (!eff || typeof eff[hook] !== 'function') continue;
      if (eff.once && this.used(p, src)) continue;
      const result = eff[hook](ctx);
      if (!result) continue;
      if (eff.once) this.state.perTurnFlags[this.flagKey(p, src)] = true;
      out.push({ src, result });
    }
    return out;
  }

  // ── plumbing ─────────────────────────────────────────────────────────────
  log(msg) {
    this.state.log.push(msg);
    this.state.lastEvent = msg;
    this.hooks.log?.(msg);
    this.changed();
  }
  changed() { this.hooks.onChange?.(); }
  async stage(name, ctx = {}) { if (this.hooks.stage) await this.hooks.stage(name, ctx); }
  async announce(text, tone = 'gold') { this.log(text); await this.stage('announce', { text, tone }); }

  serialize() { return JSON.parse(JSON.stringify(this.state)); }
  load(state) { this.state = JSON.parse(JSON.stringify(state)); this.changed(); }

  // ── turn flow ────────────────────────────────────────────────────────────
  async beginTurn() {
    const s = this.state;
    if (s.winner != null) return;
    s.serial++;
    s.perTurnFlags = {};          // resets once-per-turn AND once-per-opponent-turn uses
    s.phase = 'awaitRoll';
    s.dice = []; s.keep = [];
    s.rerollsLeft = this.cfg.normal_reroll_opportunities;
    s.rollsUsed = 0;
    s.diceLocked = false;
    const p = this.me();
    this.log(`— ${p.name}'s turn —`);
    if (this.isInside(p)) {
      const gain = this.cfg.ring_start_turn_prestige;
      p.prestige += gain;
      await this.announce(`${p.name} holds the dohyō (+${gain} Prestige)`, 'gold');
      for (const { src, result } of this.runHook(p, 'onTurnStart', { inside: true })) {
        p.prestige += result.prestige;
        await this.announce(`${p.name}'s ${src.name} +${result.prestige} Prestige`, 'gold');
      }
    }
    this.changed();
  }

  roll() {
    const s = this.state, p = this.me();
    if (s.phase !== 'awaitRoll' || s.winner != null) return false;
    s.dice = Array.from({ length: this.cfg.base_dice }, () => this.rollFace());
    s.keep = s.dice.map(() => false);
    s.rollsUsed = 1;
    s.phase = 'rolled';
    this.log(`${p.name} rolls ${s.dice.map((f) => FACE_GLYPH[f]).join(' ')}`);
    this.changed();
    return true;
  }

  reroll() {
    const s = this.state, p = this.me();
    if (s.phase !== 'rolled' || s.rerollsLeft <= 0 || s.diceLocked) return false;
    if (s.keep.every(Boolean)) return false;
    s.dice = s.dice.map((f, i) => (s.keep[i] ? f : this.rollFace()));
    s.rerollsLeft--;
    s.rollsUsed++;
    this.log(`${p.name} rerolls (${s.rerollsLeft} left): ${s.dice.map((f) => FACE_GLYPH[f]).join(' ')}`);
    this.changed();
    return true;
  }

  toggleKeep(i) {
    const s = this.state;
    if (s.phase !== 'rolled' || s.rerollsLeft <= 0) return;
    s.keep[i] = !s.keep[i];
    this.changed();
  }

  /** Player-triggered single-die effects available right now (roll phase). */
  actives(p = this.me()) {
    const s = this.state;
    if (s.phase !== 'rolled' || p !== this.me() || s.winner != null || s.diceLocked) return [];
    const out = [];
    for (const src of this.sources(p)) {
      const eff = EFFECTS[src.effectId];
      if (!eff?.active || this.used(p, src)) continue;
      if (eff.active.kind === 'reroll') {
        out.push({ ...src, kind: 'reroll', label: `${src.name}: reroll 1 die` });
      } else if (eff.active.kind === 'convert' && s.dice.includes(eff.active.from)) {
        out.push({ ...src, kind: 'convert', from: eff.active.from, to: eff.active.to, label: `${src.name}: 1 → Push` });
      }
    }
    return out;
  }

  /**
   * Use an extra single-die reroll (ends normal rerolls — it comes after them;
   * result is mandatory) or Mawashi Grip's 1→Push (after ALL rerolls: locks dice).
   */
  async useActive(srcKey, dieIndex) {
    const s = this.state, p = this.me();
    const act = this.actives(p).find((a) => a.key === srcKey);
    if (!act || dieIndex == null || dieIndex < 0 || dieIndex >= s.dice.length) return false;
    if (act.kind === 'convert' && s.dice[dieIndex] !== act.from) return false;
    s.perTurnFlags[this.flagKey(p, act)] = true;
    s.rerollsLeft = 0;
    s.keep = s.dice.map(() => false);
    if (act.kind === 'reroll') {
      const before = s.dice[dieIndex];
      s.dice[dieIndex] = this.rollFace();
      this.log(`${act.name}: ${FACE_GLYPH[before]} → ${FACE_GLYPH[s.dice[dieIndex]]}`);
      await this.announce(`${p.name} rerolls one die`, 'cyan');
    } else {
      s.dice[dieIndex] = act.to;
      s.diceLocked = true;
      await this.announce(`${p.name}'s ${act.name}: 1 → Push`, 'red');
    }
    this.changed();
    return true;
  }

  // ── resolution ───────────────────────────────────────────────────────────
  async resolve() {
    const s = this.state, p = this.me();
    if (s.phase !== 'rolled') return false;
    s.phase = 'resolving';
    s.keep = s.dice.map(() => false);
    const dice = s.dice.slice();
    const count = (f) => dice.filter((d) => d === f).length;
    await this.stage('reveal', { dice });

    // 1. numbered combinations
    const num = scoreNumbers(dice);
    await this.stage('score', { dice, ...num });
    if (num.total > 0) {
      this.gainPrestige(p, num.total, num.groups.map((g) => `${g.count}× ${g.face}`).join(' + '));
      for (const { src, result } of this.runHook(p, 'onNumberScore', { scored: num.total })) {
        p.prestige += result.prestige;
        await this.announce(`${p.name}'s ${src.name} +${result.prestige} Prestige`, 'gold');
      }
    }

    // 2. Fighting Spirit
    const sp = count('SPIRIT');
    if (sp > 0) {
      await this.stage('spirit', { n: sp });
      this.gainSpirit(p, sp, 'Spirit dice');
      for (const { src, result } of this.runHook(p, 'onSpiritGain', { gained: sp })) {
        p.spirit += result.spirit;
        await this.announce(`${p.name}'s ${src.name} +${result.spirit} Spirit`, 'cyan');
      }
    }

    // 3. Push dice attack (damage, prevention, eliminations, retreats, entry)
    await this.pushAttack(p, count('PUSH'));
    if (s.winner != null) { s.phase = 'over'; this.changed(); return true; }

    // 4. Recovery — only if outside AFTER the attack/entry phase
    const rec = count('RECOVER');
    if (rec > 0 && p.alive) {
      if (this.isInside(p)) {
        await this.stage('recover', { n: rec, blocked: true });
        this.log(`${p.name} is in the dohyō — Recovery dice do nothing.`);
      } else {
        await this.stage('recover', { n: rec });
        const healed = this.heal(p, rec, 'Recovery dice');
        if (healed > 0) {
          for (const { src, result } of this.runHook(p, 'onRecovery', { healed })) {
            const extra = this.heal(p, result.stamina, src.name);
            if (extra > 0) await this.announce(`${p.name}'s ${src.name} +${extra} Stamina`, 'green');
          }
        }
      }
    }

    s.phase = 'buying';
    this.log(`${p.name} may visit the market.`);
    this.changed();
    return true;
  }

  async pushAttack(p, pushCount) {
    if (pushCount <= 0) return;            // bonuses can never create an attack
    let damage = pushCount;
    for (const { src, result } of this.runHook(p, 'beforePushDamage', { pushCount })) {
      damage += result.damage;
      await this.announce(`${p.name}'s ${src.name} +${result.damage} Push`, 'red');
    }
    await this.stage('attack', { n: pushCount, damage });
    const attackerOutside = !this.isInside(p);

    // nobody inside at all → no damage, the attacker walks into the Main Dohyō
    if (attackerOutside && this.alive().every((o) => !this.isInside(o))) {
      this.log(`The dohyō is empty — ${p.name}'s Push meets no one.`);
      await this.enter(p, true);
      return;
    }

    const targets = this.oppositeOf(p);
    if (targets.length) {
      await this.stage('strike', { attacker: p, targets, damage });
      const results = await this.dealDamage(p, targets, damage, 'PUSH_DICE', `${pushCount}✋ Push`);
      if (this.state.winner != null) return;
      if (attackerOutside && p.alive) {
        // surviving defenders who actually took damage may yield, in fixed turn order
        const n = this.state.players.length;
        const order = (v) => (v.seat - p.seat + n) % n;
        const yielders = results
          .filter((r) => r.dealt > 0 && r.victim.alive && this.isInside(r.victim))
          .map((r) => r.victim)
          .sort((a, b) => order(a) - order(b));
        for (const v of yielders) {
          const pos = v.position;
          const yes = await this.hooks.promptRetreat?.({ victim: v, attacker: p, position: pos, positionName: POSITION_NAME[pos] });
          if (yes === true) {
            v.position = 'OUTSIDE';
            await this.stage('retreat', { victim: v, position: pos });
            this.log(`${v.name} yields the ${POSITION_NAME[pos]}.`);
          }
        }
      }
    } else {
      this.log(`${p.name}'s Push finds no opponent across the ring.`);
    }
    // an outside attacker must take an open position (Main first, never both)
    if (attackerOutside && p.alive && this.vacantPositions().length) await this.enter(p, true);
  }

  async enter(p, viaAttack) {
    const pos = this.vacantPositions()[0];
    if (!pos || !p.alive || this.isInside(p)) return;
    p.position = pos;
    const gain = this.cfg.ring_entry_prestige;
    p.prestige += gain;
    await this.stage('enter', { player: p, position: pos });
    await this.announce(`${p.name} enters the ${POSITION_NAME[pos]} (+${gain} Prestige)`, 'gold');
    for (const { src, result } of this.runHook(p, 'onRingEntry', { viaAttack, position: pos })) {
      p.prestige += result.prestige;
      await this.announce(`${p.name}'s ${src.name} +${result.prestige} Prestige`, 'gold');
    }
    this.changed();
  }

  /**
   * Apply damage to several victims at once: all damage lands first, then
   * eliminations, Challenge deactivation and the last-survivor check.
   * source: 'PUSH_DICE' (an attack: prevention + retreat apply) | 'CARD_EFFECT'.
   */
  async dealDamage(attacker, victims, amount, source, label = '') {
    const results = [];
    for (const v of victims) {
      if (!v.alive) continue;
      let prevented = 0;
      if (source === 'PUSH_DICE') {
        for (const { src, result } of this.runHook(v, 'modifyIncomingPush', { raw: amount, inside: this.isInside(v) })) {
          prevented += result.prevent;
          await this.announce(`${v.name}'s ${src.name} prevents ${result.prevent}`, 'cyan');
        }
      }
      const dealt = Math.max(0, amount - prevented);
      if (dealt > 0) {
        await this.stage('hit', { victim: v, attacker, dmg: dealt, source });
        v.stamina -= dealt;
        this.log(`${v.name} loses ${dealt} Stamina${label ? ` (${label})` : ''}.`);
      } else {
        this.log(`${v.name} holds firm — no damage.`);
      }
      results.push({ victim: v, raw: amount, prevented, dealt });
    }
    for (const r of results) if (r.victim.alive && r.victim.stamina <= 0) this.eliminate(r.victim);
    this.syncChallenge();
    this.checkSurvivor();
    this.changed();
    return results;
  }

  eliminate(p) {
    if (!p.alive) return;
    const pos = p.position;
    p.alive = false;
    p.stamina = 0;
    p.position = 'OUTSIDE';
    p.spirit = 0;                                         // Spirit is lost
    this.state.discardIds.push(...p.keepCardIds);         // KEEP cards → discard pile
    p.keepCardIds = [];
    this.log(`${p.name} is OUT of the tournament${pos !== 'OUTSIDE' ? ` — the ${POSITION_NAME[pos]} lies empty` : ''}.`);
  }

  /** Challenge Dohyō exists only while 5+ wrestlers are alive; never reopens. */
  syncChallenge() {
    const s = this.state;
    if (!s.challengeActive || this.alive().length >= this.cfg.second_ring_min_alive_players) return;
    s.challengeActive = false;
    const occ = this.alive().find((p) => p.position === 'CHALLENGE');
    if (occ) occ.position = 'OUTSIDE';
    this.log(`Fewer than ${this.cfg.second_ring_min_alive_players} remain — the Challenge Dohyō closes${occ ? `; ${occ.name} steps outside` : ''}.`);
  }

  checkSurvivor() {
    const s = this.state;
    if (s.winner != null) return true;
    const alive = this.alive();
    if (alive.length === 0) {
      s.winner = -1; s.winnerId = null; s.phase = 'over';
      this.log('Every wrestler has fallen — no Yokozuna this tournament.');
      return true;
    }
    if (alive.length === 1) {
      s.winner = alive[0].seat; s.winnerId = alive[0].id; s.phase = 'over';
      this.log(`${alive[0].name} is the last wrestler standing — YOKOZUNA by dominance!`);
      return true;
    }
    return false;
  }

  // ── gains ────────────────────────────────────────────────────────────────
  /** Restore Stamina (clamped to max). Returns the amount actually restored. */
  heal(p, n, label = '') {
    if (!p.alive || n <= 0) return 0;
    const before = p.stamina;
    p.stamina = Math.min(this.cfg.maximum_stamina, p.stamina + n);
    const healed = p.stamina - before;
    if (healed > 0) this.log(`${p.name} +${healed} Stamina${label ? ` (${label})` : ''}`);
    this.changed();
    return healed;
  }
  gainPrestige(p, n, label = '') {
    if (n <= 0) return;
    p.prestige += n;
    this.log(`${p.name} +${n} Prestige${label ? ` (${label})` : ''}`);
    this.changed();
  }
  gainSpirit(p, n, label = '') {
    if (n <= 0) return;
    p.spirit += n;
    this.log(`${p.name} +${n} Spirit${label ? ` (${label})` : ''}`);
    this.changed();
  }

  // ── market ───────────────────────────────────────────────────────────────
  /** Draw one card; reshuffle the discard pile when the deck runs out. */
  drawCard() {
    const s = this.state;
    if (!s.deckIds.length && s.discardIds.length) {
      s.deckIds = this.shuffle(s.discardIds.splice(0));
      this.log('The market deck is reshuffled from the discard pile.');
    }
    return s.deckIds.pop() ?? null;
  }

  cardTargets(p, card) {
    const eff = EFFECTS[card.effect_id];
    return eff?.targets ? eff.targets(this, p) : null;
  }

  canBuy(idx, p = this.me()) {
    const s = this.state;
    const id = s.marketIds[idx];
    if (s.phase !== 'buying' || !p.alive || p !== this.me()) return { ok: false, reason: 'not your market phase' };
    if (!id) return { ok: false, reason: 'empty slot' };
    const card = this.cardById[id];
    if (p.spirit < card.cost) return { ok: false, reason: `needs ${card.cost} Spirit` };
    const t = this.cardTargets(p, card);
    if (t && t.length === 0) return { ok: false, reason: 'no eligible opponent' };
    return { ok: true };
  }

  async buy(idx, targetSeat = null) {
    const s = this.state, p = this.me();
    if (!this.canBuy(idx, p).ok) return false;
    const card = this.cardById[s.marketIds[idx]];
    let target = null;
    const candidates = this.cardTargets(p, card);
    if (candidates) {
      if (targetSeat != null) target = candidates.find((c) => c.seat === targetSeat) || null;
      else {
        const pick = await this.hooks.promptTarget?.({ player: p, card, candidates });
        target = pick == null ? (this.hooks.promptTarget ? null : candidates[0]) : candidates.find((c) => c.seat === pick) || null;
      }
      if (!target) return false;          // cancelled — nothing paid
    }
    p.spirit -= card.cost;
    s.marketIds[idx] = this.drawCard();   // replace immediately
    if (card.type === 'KEEP') {
      p.keepCardIds.push(card.id);
      this.log(`${p.name} learns ${card.name} (−${card.cost} Spirit).`);
    } else {
      this.log(`${p.name} plays ${card.name} (−${card.cost} Spirit)${target ? ` on ${target.name}` : ''}.`);
      await this.stage('card', { player: p, card, target });
      await EFFECTS[card.effect_id].instant(this, p, target);
      s.discardIds.push(card.id);
    }
    this.changed();
    return true;
  }

  canRefresh(p = this.me()) {
    const s = this.state;
    return s.phase === 'buying' && p.alive && p.spirit >= this.cfg.market_sweep_cost && s.marketIds.some((x) => x);
  }

  async refresh() {
    const s = this.state, p = this.me();
    if (!this.canRefresh(p)) return false;
    p.spirit -= this.cfg.market_sweep_cost;
    for (let i = 0; i < s.marketIds.length; i++) {
      if (s.marketIds[i]) s.discardIds.push(s.marketIds[i]);
      s.marketIds[i] = null;
    }
    for (let i = 0; i < s.marketIds.length; i++) s.marketIds[i] = this.drawCard();
    this.log(`${p.name} refreshes the market (−${this.cfg.market_sweep_cost} Spirit).`);
    this.changed();
    return true;
  }

  // ── end of turn ──────────────────────────────────────────────────────────
  async endTurn() {
    const s = this.state, p = this.me();
    if (s.phase !== 'buying' || s.winner != null) return false;
    s.phase = 'ending';
    if (p.alive) {
      for (const { src, result } of this.runHook(p, 'onTurnEnd', { inside: this.isInside(p), stamina: p.stamina })) {
        const healed = this.heal(p, result.stamina, src.name);
        if (healed > 0) await this.announce(`${p.name}'s ${src.name} +${healed} Stamina`, 'green');
      }
    }
    if (this.checkVictory()) { this.changed(); return true; }
    const seats = s.players;
    let i = s.turn;
    do { i = (i + 1) % seats.length; } while (!seats[i].alive);
    s.turn = i;
    await this.beginTurn();
    return true;
  }

  /** End-of-turn promotion check: alive with 20+ Prestige (active player first). */
  checkVictory() {
    const s = this.state;
    if (this.checkSurvivor()) return true;
    const target = this.cfg.prestige_to_win;
    const scorers = this.alive().filter((p) => p.prestige >= target);
    if (!scorers.length) return false;
    const w = scorers.find((p) => p.seat === s.turn) || scorers.sort((a, b) => b.prestige - a.prestige)[0];
    s.winner = w.seat; s.winnerId = w.id; s.phase = 'over';
    this.log(`${w.name} reaches ${w.prestige} Prestige — promoted to YOKOZUNA!`);
    return true;
  }
}
