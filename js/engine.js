// Monster City — game engine (framework-agnostic, UI-agnostic).
// State is plain data; the UI renders from game.state and calls actions.

export const FACES = ['1', '2', '3', 'energy', 'attack', 'heal'];
export const FACE_GLYPH = { '1': '1', '2': '2', '3': '3', energy: '⚡', attack: '🐾', heal: '💚' };

const rand = (n) => Math.floor(Math.random() * n);
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export class Game {
  /**
   * @param {{monsters:any, zones:any, cards:any}} data
   * @param {{onChange?:Function, log?:Function, promptYield?:Function, promptVacancy?:Function}} hooks
   */
  constructor(data, hooks = {}) {
    this.defs = data;
    this.hooks = hooks;
    this.byId = Object.fromEntries(data.monsters.monsters.map((m) => [m.id, m]));
    this.cardById = Object.fromEntries(data.cards.cards.map((c) => [c.id, c]));
    this.state = null;
  }

  // ── setup ────────────────────────────────────────────────────────────────
  start(monsterIds, opts = {}) {
    const n = monsterIds.length;
    const botSeats = opts.botSeats || [];
    const zonesActive = this.defs.zones.unlockByPlayerCount[String(n)] || ['city'];
    const full = shuffle(monsterIds.slice());
    // bot flags must follow their monsters through the shuffle — otherwise the
    // human's pick can land on a CPU seat and the player controls a stranger.
    const botMonsters = new Set(botSeats.map((i) => monsterIds[i]));
    this.state = {
      serial: 0, players: [], turn: 0, phase: 'awaitRoll', winner: null,
      dice: [], keep: [], rerollsLeft: 0, zonesActive, shop: [], deck: [], spent: [],
      extras: [], thunder: { owner: null, armed: false },
      log: [], lastEvent: '', shopAutoOpened: false, vpGainThisTurn: 0,
    };
    for (let i = 0; i < n; i++) {
      const mon = this.byId[full[i]];
      this.state.players.push({
        seat: i, monsterId: mon.id, name: mon.name, color: mon.color, emoji: mon.emoji,
        hp: 10, maxHp: 10, vp: 0, energy: 0, zone: null, alive: true,
        bot: botMonsters.has(full[i]),
        cards: [], mods: {}, statuses: { poison: 0, shrink: 0 },
        dealtDamage: 0, shield: false, superJumpSerial: -1, flags: {},
      });
    }
    // build deck
    const deck = [];
    for (const c of this.defs.cards.cards) for (let k = 0; k < c.count; k++) deck.push(c.id);
    this.state.deck = shuffle(deck);
    for (let i = 0; i < 3; i++) this.state.shop.push(this.state.deck.pop() ?? null);
    this.log(`City trembles. ${n} monsters rise. Tokyo districts: ${zonesActive.length}.`);
    this.log(`First turn: ${this.state.players[0].name}.`);
    this.beginTurn();
  }

  // ── helpers ──────────────────────────────────────────────────────────────
  me() { return this.state.players[this.state.turn]; }
  alive() { return this.state.players.filter((p) => p.alive); }
  district(id) { return this.defs.zones.districts.find((d) => d.id === id); }
  occupant(zoneId) { return this.alive().find((p) => p.zone === zoneId) || null; }
  vacantZones() { return this.state.zonesActive.filter((z) => !this.occupant(z)); }
  inTokyo(p) { return p.zone != null; }

  log(msg) {
    this.state.log.push(msg);
    this.state.lastEvent = msg;
    this.hooks.log?.(msg);
    this.changed();
  }
  changed() { this.hooks.onChange?.(); }
  /** Dramatic pacing hook — the UI may await animations here. */
  async stage(name, ctx = {}) {
    if (this.hooks.stage) await this.hooks.stage(name, ctx);
  }

  recalc(p) {
    const m = {};
    const add = (k, v) => {
      if (typeof v === 'number') m[k] = (m[k] || 0) + v;
      else if (typeof v === 'boolean') m[k] = m[k] || v;
      else m[k] = v;
    };
    for (const [k, v] of Object.entries(this.byId[p.monsterId].power.hooks || {})) add(k, v);
    for (const inst of p.cards) for (const [k, v] of Object.entries(inst.def.hooks || {})) add(k, v);
    p.mods = m;
    p.maxHp = 10 + (m.maxHp || 0);
    if (p.hp > p.maxHp) p.hp = p.maxHp;
  }

  diceCount(p) {
    const n = 6 + (p.mods.diceBonus || 0) - p.statuses.shrink
      - (this.state.thunder.armed ? 1 : 0) - (p.flags.freezeDicePenalty || 0);
    return Math.max(1, n);
  }

  // ── turn flow ────────────────────────────────────────────────────────────
  beginTurn(opts = {}) {
    const s = this.state;
    if (s.winner != null) return;
    s.serial++;
    const cur = s.players[s.turn];
    // thunder stomp wears off at the owner's next turn
    if (s.thunder.armed && s.thunder.owner === cur.seat) s.thunder.armed = false;
    s.vpGainThisTurn = 0;
    s.shopAutoOpened = false;
    cur.flags = { freezeDicePenalty: opts.freezeDicePenalty || 0 };
    cur.dealtDamage = 0;
    cur.shield = false;
    cur.superJumpSerial = s.serial; // Super Jump re-arms once per own turn
    // district start-of-turn effects
    if (cur.zone != null) {
      const d = this.district(cur.zone);
      const h = d.hooks || {};
      const vp = (h.vpStart || 0) + (cur.mods.vpStartBonus || 0);
      const en = h.energyStart || 0;
      if (vp) { cur.vp += vp; this.log(`${cur.name} holds ${d.short}: +${vp}⭐.`); }
      if (en) { this.gainEnergy(cur, en, `${d.short} port fees`); }
    }
    s.phase = 'awaitRoll';
    s.dice = []; s.keep = [];
    s.rerollsLeft = 2 + (cur.mods.rerollsBonus || 0);
    this.log(`— ${cur.name}'s turn —`);
    this.checkEnd();
    this.changed();
  }

  roll() {
    const s = this.state, p = this.me();
    if (s.phase !== 'awaitRoll') return false;
    const n = this.diceCount(p);
    s.dice = Array.from({ length: n }, () => FACES[rand(FACES.length)]);
    s.keep = Array(n).fill(false);
    s.phase = 'rolled';
    this.log(`${p.name} rolls ${s.dice.map((f) => FACE_GLYPH[f]).join(' ')}`);
    this.changed();
    return true;
  }

  reroll() {
    const s = this.state, p = this.me();
    if (s.phase !== 'rolled' || s.rerollsLeft <= 0) return false;
    let rolled = 0;
    s.dice = s.dice.map((f, i) => { if (s.keep[i]) return f; rolled++; return FACES[rand(FACES.length)]; });
    s.rerollsLeft--;
    if (rolled === 0) rolled = s.dice.length;
    this.log(`${p.name} rerolls (${s.rerollsLeft} left): ${s.dice.map((f) => FACE_GLYPH[f]).join(' ')}`);
    this.changed();
    return true;
  }

  toggleKeep(i) {
    const s = this.state;
    if (s.phase !== 'rolled') return;
    s.keep[i] = !s.keep[i];
    this.changed();
  }

  /** Primary lazy action: roll → reroll → resolve. */
  primaryAction() {
    const s = this.state;
    if (s.phase === 'awaitRoll') return this.roll();
    if (s.phase === 'rolled') {
      if (s.rerollsLeft > 0) return this.reroll();
      return this.resolve();
    }
    return false;
  }

  // ── resolution ───────────────────────────────────────────────────────────
  async resolve() {
    const s = this.state, p = this.me();
    if (s.phase !== 'rolled') return;
    s.phase = 'resolving';
    const dice = s.dice.slice();
    await this.stage('reveal', { dice });

    // triples → VP
    await this.stage('score', { dice });
    for (const face of ['1', '2', '3']) {
      const count = dice.filter((d) => d === face).length;
      if (count >= 3) {
        let vp = Number(face) + (count - 3);
        const tv = p.mods.tripleVp;
        if (tv && tv.face === Number(face)) vp += tv.extra;
        this.gainVp(p, vp, `triple ${face}s`);
        if (face === '1' && p.mods.freezeTime) {
          s.extras.push({ seat: p.seat, dicePenalty: 1 });
          this.log(`${p.name}: Freeze Time — an extra turn awaits (−1 die).`);
        }
        const td = p.mods.tripleDamage;
        if (td && td.face === Number(face) && count >= 3) {
          await this.dealDamage(p, this.alive().filter((x) => x !== p), td.amount, { isAttack: true, label: 'Poison Quills' });
        }
      }
    }
    // Complete Destruction
    if (p.mods.completeDestruction) {
      const set = new Set(dice);
      if (['1', '2', '3', 'heal', 'attack', 'energy'].every((f) => set.has(f))) {
        this.gainVp(p, p.mods.completeDestruction, 'Complete Destruction');
      }
    }
    // Omnivore: score 1-2-3 combo once per turn
    if (p.mods.omnivore && !p.flags.omnivoreUsed && ['1', '2', '3'].every((f) => dice.includes(f))) {
      p.flags.omnivoreUsed = true;
      this.gainVp(p, 2, 'Omnivore [1][2][3]');
    }
    // Energy
    const faces = dice.filter((d) => d === 'energy').length;
    if (faces > 0) {
      await this.stage('energy', { n: faces });
      this.gainEnergy(p, faces + (p.mods.energyPerFace || 0), '⚡ dice');
    }
    // Attack
    const atk = dice.filter((d) => d === 'attack').length;
    if (atk > 0) {
      await this.stage('attack', { n: atk });
      await this.attack(p, atk);
    } else if (p.mods.autoAttack) {
      await this.stage('attack', { n: p.mods.autoAttack, auto: true });
      await this.dealDamage(p, this.targetsFor(p), p.mods.autoAttack, { isAttack: true, label: 'Acid Attack' });
    }
    // Heal
    const heals = dice.filter((d) => d === 'heal').length;
    if (heals > 0) {
      await this.stage('heal', { n: heals });
      await this.healDice(p, heals);
    }
    // Thunder Stomp: scored 4⭐ this turn?
    if (p.mods.thunderStomp && s.vpGainThisTurn >= 4) {
      s.thunder = { owner: p.seat, armed: true };
      this.log(`${p.name}: Thunder Stomp! Everyone rolls −1 die until their next turn.`);
    }
    // buy phase
    s.phase = 'buying';
    s.shopAutoOpened = true;
    this.log(p.zone != null && this.district(p.zone).hooks?.shopBlocked
      ? `${p.name} shelters in the Palace — cards are off-limits.`
      : `${p.name} may buy cards.`);
    this.checkEnd();
    this.changed();
  }

  targetsFor(p) {
    // In a district → hits everyone outside Tokyo. Outside → hits every occupant.
    return p.zone != null
      ? this.alive().filter((x) => x !== p && x.zone == null)
      : this.alive().filter((x) => x !== p && x.zone != null);
  }

  async attack(p, atkCount) {
    const s = this.state;
    let hits = atkCount + (p.mods.attackDamageBonus || 0);
    if (p.zone != null && p.mods.attackFromTokyo) hits += p.mods.attackFromTokyo;
    // free capture when Tokyo is empty
    const occupants = this.alive().filter((x) => x.zone != null);
    if (p.zone == null && occupants.length === 0) {
      await this.capture(p, this.vacantZones());
      return;
    }
    const targets = this.targetsFor(p);
    if (targets.length === 0) { this.log(`${p.name} roars at empty streets.`); return; }
    p.flags.attacked = true;
    await this.stage('strike', { attacker: p, targets, hits });
    await this.dealDamage(p, targets, hits, { isAttack: true, label: 'attack' });
    if (!p.alive) return;
    // yield prompts (victims in Tokyo attacked from outside)
    if (p.zone == null) {
      for (const v of targets.filter((t) => t.alive && t.zone != null && t.flags.wasDamaged)) {
        const d = this.district(v.zone);
        const yield_ = await this.hooks.promptYield?.({ victim: v, attacker: p, zone: d });
        if (yield_ === true) {
          const takeDmg = v.mods.yieldDamage && !v.mods.yieldImmune ? 1 : 0; // Burrowing only; Jets negates
          v.zone = null;
          this.log(`${v.name} yields ${d.short}${takeDmg ? ' (Burrowing: −1❤️)' : ''}.`);
          if (takeDmg) await this.dealDamage(v, [p], 1, { isAttack: false, label: 'Burrowing' });
          this.changed();
        }
      }
      const vacant = this.vacantZones();
      if (vacant.length > 0 && p.zone == null && p.alive) await this.capture(p, vacant);
    }
  }

  async capture(p, vacant) {
    if (!p.alive || vacant.length === 0) return;
    const choice = vacant.length === 1 ? vacant[0] : await this.hooks.promptVacancy?.({ player: p, vacant });
    const zone = choice || vacant[0];
    await this.stage('capture', { player: p, zoneId: zone });
    p.zone = zone;
    p.vp += 1;
    const d = this.district(zone);
    this.log(`${p.name} takes ${d.short}! +1⭐`);
    this.changed();
  }

  async dealDamage(attacker, targets, raw, meta = {}) {
    if (raw <= 0 || targets.length === 0) return;
    for (const v of targets) {
      if (!v.alive) continue;
      v.flags.wasDamaged = false;
      let dmg = raw;
      if (meta.isAttack) {
        dmg += (this.district(v.zone)?.hooks?.incomingDamageBonus || 0);
        dmg -= (v.mods.incomingReduce || 0);
        if (attacker.mods.fireBreathing && this.areNeighbors(attacker, v)) dmg += attacker.mods.fireBreathing;
      }
      if (v.shield) { this.log(`${v.name}'s Wings deflect the blow.`); continue; }
      if (meta.isAttack && (v.mods.superJump) && v.energy > 0 && v.superJumpSerial !== this.state.serial) {
        v.energy -= v.mods.superJump.cost;
        v.superJumpSerial = this.state.serial;
        dmg = Math.max(0, dmg - 1);
        this.log(`${v.name} Super Jumps (−1⚡).`);
      }
      dmg = Math.max(0, dmg);
      if (dmg === 0) { this.log(`${v.name} shrugs it off.`); continue; }
      // camouflage: reroll a die per damage point, ❤️ negates
      if (v.mods.camouflage) {
        let kept = 0;
        for (let i = 0; i < dmg; i++) kept += FACES[rand(FACES.length)] === 'heal' ? 0 : 1;
        if (kept < dmg) this.log(`${v.name}'s Camouflage absorbs ${dmg - kept}.`);
        dmg = kept;
        if (dmg === 0) continue;
      }
      await this.stage('hit', { victim: v, attacker, dmg });
      v.flags.wasDamaged = true;
      v.hp -= dmg;
      attacker.dealtDamage += dmg;
      if (attacker !== v) attacker.flags.dealtDamageTotal = (attacker.flags.dealtDamageTotal || 0) + dmg;
      if (meta.isAttack && (attacker.mods.poison || attacker.mods.shrink)) {
        if (attacker.mods.poison) { v.statuses.poison++; this.log(`${v.name} is Poisoned (${v.statuses.poison}).`); }
        if (attacker.mods.shrink) { v.statuses.shrink++; this.log(`${v.name} Shrunk (${v.statuses.shrink} dice down).`); }
      }
      this.log(`${v.name} takes ${dmg}❤️ ${meta.label ? `(${meta.label})` : ''}`.trim());
      if (attacker.mods.onDamageDealtHeal) this.heal(attacker, attacker.mods.onDamageDealtHeal, 'Cannibalistic');
      if (v.mods.reflect && attacker.alive && attacker !== v && meta.isAttack) {
        attacker.hp -= v.mods.reflect;
        this.log(`${v.name}'s Barbed Shell reflects ${v.mods.reflect}❤️ → ${attacker.name}.`);
        if (attacker.hp <= 0) await this.eliminate(attacker, v);
      }
      if (dmg >= 2 && v.mods.onLoseHp2 && v.hp > 0) {
        this.gainEnergy(v, v.mods.onLoseHp2.energy, "We're Only Making It Stronger");
      }
      if (v.hp <= 0) await this.eliminate(v, attacker);
    }
  }

  areNeighbors(a, b) {
    const alive = this.alive().map((p) => p.seat).sort((x, y) => x - y);
    const i = alive.indexOf(a.seat), j = alive.indexOf(b.seat);
    const n = alive.length;
    return n > 2 && (Math.abs(i - j) === 1 || Math.abs(i - j) === n - 1);
  }

  async eliminate(p, attacker) {
    if (!p.alive || p.hp > 0) return;
    if (p.mods.revive) {
      p.cards = []; p.vp = 0; this.recalc(p);
      p.hp = 10; p.statuses = { poison: 0, shrink: 0 };
      p.zone = null;
      this.log(`It Has a Child! ${p.name} returns at 10❤️, 0⭐.`);
      this.changed();
      return;
    }
    p.alive = false; p.hp = 0;
    const wasInZone = p.zone; p.zone = null;
    p.cards = [];
    this.log(`💀 ${p.name} is ELIMINATED${wasInZone ? ` — ${this.district(wasInZone).short} lies vacant` : ''}.`);
    for (const o of this.alive()) if (o.mods.vpOnDeath) this.gainVp(o, o.mods.vpOnDeath, 'Eater of the Dead');
    // district count may shrink with player count
    this.syncZones();
    this.checkEnd();
    this.changed();
  }

  syncZones() {
    const n = Math.max(2, this.alive().length);
    const want = this.defs.zones.unlockByPlayerCount[String(Math.min(n, 6))] || ['city'];
    for (const z of this.state.zonesActive) {
      if (!want.includes(z)) {
        const occ = this.occupant(z);
        if (occ) { occ.zone = null; this.log(`${occ.name} is forced out of ${this.district(z).short} (district sealed).`); }
      }
    }
    this.state.zonesActive = want;
  }

  // ── heals / gains ────────────────────────────────────────────────────────
  async healDice(p, n) {
    if (p.zone != null && this.district(p.zone).hooks?.noHealDice) {
      this.log(`${p.name} is in Tokyo City — heal dice do nothing.`);
      return;
    }
    // poison/shrink counters are cleared by hearts first
    let left = n;
    while (left > 0 && (p.statuses.poison > 0 || p.statuses.shrink > 0)) {
      if (p.statuses.poison > 0) p.statuses.poison--; else p.statuses.shrink--;
      left--;
      this.log(`${p.name} burns off a counter with a 💚.`);
    }
    if (left > 0) this.heal(p, left * (1 + (p.mods.healPerHeart ? p.mods.healPerHeart - 1 : 0) + (p.mods.healBonus || 0)), '💚 dice');
    this.changed();
  }

  heal(p, n, label = '') {
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + n);
    const healed = p.hp - before;
    if (healed > 0) this.log(`${p.name} heals ${healed}❤️ ${label ? `(${label})` : ''}`.trim());
    this.changed();
  }

  gainVp(p, n, label = '') {
    if (n === 0) return;
    p.vp = Math.max(0, p.vp + n);
    if (n > 0) this.state.vpGainThisTurn += n;
    this.log(`${p.name} ${n > 0 ? '+' : ''}${n}⭐ ${label ? `(${label})` : ''}`.trim());
    this.changed();
  }

  gainEnergy(p, n, label = '') {
    if (n <= 0) return;
    n += (p.mods.energyGainBonus || 0);
    p.energy += n;
    this.log(`${p.name} +${n}⚡ ${label ? `(${label})` : ''}`.trim());
    this.changed();
  }

  // ── buying ───────────────────────────────────────────────────────────────
  cardCost(p, def) {
    const d = p.zone != null ? this.district(p.zone) : null;
    return Math.max(0, def.cost - (p.mods.cardDiscount || 0) + (d?.hooks?.cardCostExtra || 0));
  }

  canShop(p) {
    const d = p.zone != null ? this.district(p.zone) : null;
    return !(d?.hooks?.shopBlocked);
  }

  async buy(idx) {
    const s = this.state, p = this.me();
    if (s.phase !== 'buying' || !this.canShop(p)) return false;
    const id = s.shop[idx];
    if (!id) return false;
    const def = this.cardById[id];
    const cost = this.cardCost(p, def);
    if (p.energy < cost) { this.log(`Not enough ⚡ for ${def.name}.`); return false; }
    p.energy -= cost;
    s.shop[idx] = s.deck.length ? s.deck.pop() : (s.spent.length ? this.reshuffle() : null);
    if (def.type === 'keep') {
      p.cards.push({ id: def.id, def, state: {} });
      this.recalc(p);
      this.log(`${p.name} keeps ${def.name} (${cost}⚡).`);
      await this.applyEffects(p, def.effects || []);
    } else {
      this.log(`${p.name} plays ${def.name} (${cost}⚡).`);
      await this.applyEffects(p, def.effects || []);
      s.spent.push(def.id);
    }
    if (p.mods.vpOnBuy) this.gainVp(p, p.mods.vpOnBuy, 'Dedicated News Team');
    this.checkEnd();
    this.changed();
    return true;
  }

  reshuffle() {
    const s = this.state;
    s.deck = shuffle(s.spent.splice(0));
    return s.deck.pop() ?? null;
  }

  async sweep() {
    const s = this.state, p = this.me();
    if (s.phase !== 'buying' || !this.canShop(p) || p.energy < 2) return false;
    p.energy -= 2;
    for (const id of s.shop) if (id) s.spent.push(id);
    for (let i = 0; i < 3; i++) s.shop[i] = s.deck.length ? s.deck.pop() : (s.spent.length ? this.reshuffle() : null);
    this.log(`${p.name} sweeps the market (−2⚡).`);
    this.changed();
    return true;
  }

  async applyEffects(p, effects) {
    for (const e of effects) {
      switch (e.op) {
        case 'gainVp': this.gainVp(p, e.n); break;
        case 'gainEnergy': this.gainEnergy(p, e.n); break;
        case 'heal': this.heal(p, e.n); break;
        case 'damageOthers': await this.dealDamage(p, this.alive().filter((x) => x !== p), e.n, { isAttack: false, label: 'card' }); break;
        case 'damageAll': await this.dealDamage(p, this.alive(), e.n, { isAttack: false, label: 'card' }); break;
        case 'damageSelf':
          p.hp -= e.n; this.log(`${p.name} loses ${e.n}❤️ (card).`);
          if (p.hp <= 0) await this.eliminate(p, p);
          break;
        case 'vpOthers':
          for (const o of this.alive()) if (o !== p) o.vp = Math.max(0, o.vp - e.n);
          this.log(`All other monsters lose ${e.n}⭐.`); break;
        case 'energyDrainOthers':
          for (const o of this.alive()) if (o !== p) { const lost = Math.floor(o.energy / 2); o.energy -= lost; }
          this.log('Vast Storm drains the others’ ⚡.'); break;
        case 'army':
          for (let i = 0; i < p.cards.length; i++) { this.gainVp(p, 1); p.hp -= 1; }
          this.log(`Army: ${p.cards.length}⭐ gained, ${p.cards.length}❤️ lost.`);
          if (p.hp <= 0) await this.eliminate(p, p);
          break;
        case 'captureTokyo': if (!this.inTokyo(p)) await this.capture(p, this.vacantZones()); break;
        case 'extraTurn': this.state.extras.push({ seat: p.seat, dicePenalty: 0 }); this.log(`${p.name} takes another turn!`); break;
        case 'maxHp': this.heal(p, e.gainNow || 0); break; // maxHp handled by hooks via recalc
        default: break;
      }
    }
  }

  // ── abilities (keep-card actives) ────────────────────────────────────────
  abilities(p) {
    const s = this.state, out = [];
    if (s.winner != null || !p.alive) return out;
    const inTurn = s.players[s.turn] === p;
    for (const inst of p.cards) {
      const h = inst.def.hooks || {};
      if (h.setDie && inTurn && s.phase === 'rolled') {
        const used = h.setDie.per === 'game' ? inst.state.used : inst.state.usedSerial === s.serial;
        if (!used && p.energy >= (h.setDie.cost || 0)) {
          out.push({ key: 'setDie', inst, label: h.setDie.face === 'any' ? 'Set a die → any' : `Set a die → ${FACE_GLYPH[h.setDie.face]}`, cost: h.setDie.cost || 0 });
        }
      }
      if (h.rapidHeal && inTurn && (s.phase === 'rolled' || s.phase === 'buying') && p.energy >= h.rapidHeal.cost) {
        out.push({ key: 'rapidHeal', inst, label: `Heal 1❤️ · ${h.rapidHeal.cost}⚡`, cost: h.rapidHeal.cost });
      }
      if (h.spendForVp && inTurn && (s.phase === 'rolled' || s.phase === 'buying') && p.energy >= h.spendForVp.cost) {
        out.push({ key: 'spendForVp', inst, label: `+1⭐ · ${h.spendForVp.cost}⚡`, cost: h.spendForVp.cost });
      }
      if (h.telepath && inTurn && s.phase === 'rolled' && p.energy >= h.telepath.cost) {
        out.push({ key: 'telepath', inst, label: `+1 reroll · ${h.telepath.cost}⚡`, cost: h.telepath.cost });
      }
      if (h.smokeCloud && inTurn && s.phase === 'rolled' && inst.state.charges > 0) {
        out.push({ key: 'smokeCloud', inst, label: `+1 reroll · smoke (${inst.state.charges})`, cost: 0 });
      }
      if (h.wings && !p.shield && p.energy >= h.wings.cost) {
        out.push({ key: 'wings', inst, label: `Wings shield · ${h.wings.cost}⚡`, cost: h.wings.cost });
      }
    }
    return out;
  }

  useAbility(ab, payload = {}) {
    const s = this.state, p = this.me(), h = ab.inst.def.hooks;
    if (ab.key === 'setDie') {
      const d = h.setDie;
      if (d.per === 'game') ab.inst.state.used = true; else ab.inst.state.usedSerial = s.serial;
      if (d.discardAfter) p.cards = p.cards.filter((c) => c !== ab.inst);
      if (payload.dieIndex != null && payload.face) s.dice[payload.dieIndex] = payload.face;
      this.log(`${p.name} shapes a die → ${payload.face ? FACE_GLYPH[payload.face] : '?'} (${ab.inst.def.name}).`);
      this.changed();
      return true;
    }
    if (ab.cost) p.energy -= ab.cost;
    if (ab.key === 'rapidHeal') this.heal(p, 1, 'Rapid Healing');
    if (ab.key === 'spendForVp') this.gainVp(p, 1, 'Sleep Walker');
    if (ab.key === 'telepath') s.rerollsLeft += h.telepath.rerolls;
    if (ab.key === 'smokeCloud') { ab.inst.state.charges--; s.rerollsLeft++; if (ab.inst.state.charges <= 0) p.cards = p.cards.filter((c) => c !== ab.inst); }
    if (ab.key === 'wings') { p.shield = true; this.log(`${p.name} raises Wings — damage nullified until their next turn.`); }
    this.changed();
    return true;
  }

  // ── end of turn ──────────────────────────────────────────────────────────
  async endTurn() {
    const s = this.state, p = this.me();
    if (s.phase !== 'buying' || s.winner != null) return;
    s.phase = 'ending';
    const n = this.alive().length;

    if (p.mods.tanker && (p.flags.dealtDamageTotal || 0) >= p.mods.tanker.threshold && !p.flags.tankerGained) {
      p.flags.tankerGained = true; this.gainVp(p, p.mods.tanker.vp, 'Throw a Tanker');
    }
    if (p.mods.energyHoarder) { const v = Math.floor(p.energy / 6); if (v) this.gainVp(p, v, 'Energy Hoarder'); }
    if (p.mods.solar && p.energy === 0) this.gainEnergy(p, 1, 'Solar Powered');
    if (p.mods.herbivore && !p.flags.attacked && (p.flags.dealtDamageTotal || 0) === 0) this.gainVp(p, 1, 'Herbivore');
    if (p.mods.underdog) {
      const low = Math.min(...this.alive().map((x) => x.vp));
      if (p.vp === low && this.alive().filter((x) => x.vp === low).length === 1) this.gainVp(p, 1, 'Rooting for the Underdog');
    }
    if (p.zone != null && this.district(p.zone).hooks?.healEndTurn) this.heal(p, this.district(p.zone).hooks.healEndTurn, 'Palace Gardens');
    if (p.mods.setDie?.per) { /* per-turn use resets via serial */ }

    // poison tick
    if (p.statuses.poison > 0 && p.alive) {
      const dmg = p.statuses.poison;
      p.hp -= dmg; p.flags.wasDamaged = true;
      this.log(`${p.name} suffers ${dmg}❤️ from poison.`);
      if (p.hp <= 0) await this.eliminate(p, p);
    }

    this.checkEnd(true);
    if (s.winner != null) { this.changed(); return; }

    // next — extra turns (Frenzy / Freeze Time), skipping the fallen
    const aliveSeats = this.alive().map((x) => x.seat);
    s.extras = s.extras.filter((ex) => aliveSeats.includes(ex.seat));
    if (s.extras.length) {
      const ex = s.extras.shift();
      s.turn = ex.seat;
      this.beginTurn({ freezeDicePenalty: ex.dicePenalty });
      return;
    }
    const seats = this.state.players;
    let i = s.turn;
    do { i = (i + 1) % seats.length; } while (!seats[i].alive);
    s.turn = i;
    this.beginTurn();
  }

  checkEnd(vpCheck = false) {
    const s = this.state;
    const alive = this.alive();
    if (alive.length === 0) { s.winner = -1; s.phase = 'over'; this.log('All monsters perish. Everybody loses.'); return true; }
    if (alive.length === 1) { s.winner = alive[0].seat; s.phase = 'over'; this.log(`👑 ${alive[0].name} stands alone — MONSTER CITY IS YOURS!`); return true; }
    if (!vpCheck) return false; // 20⭐ only crowns at the end of a turn
    const scorers = alive.filter((p) => p.vp >= 20);
    if (scorers.length) {
      const w = scorers.find((p) => p.seat === s.turn) || scorers[0];
      s.winner = w.seat; s.phase = 'over';
      this.log(`👑 ${w.name} reaches ${w.vp}⭐ — MONSTER CITY IS YOURS!`);
      return true;
    }
    return false;
  }
}
