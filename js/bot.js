// CPU rikishi — simple, watchable YOKOZUNA heuristics.
// A bot plays its whole turn: roll → hold good faces → reroll → use single-die
// actives → resolve (staged animations) → buy up to 2 cards → end turn.
// Retreat and target decisions live in main.js (engine prompt hooks).

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PACE = { start: 800, roll: 750, reroll: 850, active: 700, resolve: 650, buy: 750, end: 650 };

function counts(dice) {
  const c = { 1: 0, 2: 0, 3: 0 };
  for (const f of dice) if (c[f] !== undefined) c[f]++;
  return c;
}

/** Which dice are worth holding for this wrestler right now. */
function desiredKeep(game, p, dice) {
  const c = counts(dice);
  const inside = game.isInside(p);
  const hurt = p.stamina <= 7;
  return dice.map((f) => {
    if (f === 'SPIRIT') return true;
    if (f === 'PUSH') return !(hurt && !inside && p.stamina <= 4); // badly hurt outside: heal instead
    if (f === 'RECOVER') return !inside && hurt;
    if (c[f] !== undefined) return c[f] >= 3 || (f === '3' && c[f] >= 2);
    return false;
  });
}

function isHappy(game, p, dice) {
  const c = counts(dice);
  const triple = Object.values(c).some((n) => n >= 3);
  const push = dice.filter((d) => d === 'PUSH').length;
  return triple && push >= 1 || push >= 3;
}

/** Index of the least useful die (for a single-die reroll). */
function worstDie(game, p, dice) {
  const keep = desiredKeep(game, p, dice);
  const i = keep.findIndex((k) => !k);
  return i;
}

function cardScore(game, p, def) {
  const id = def.id;
  const inside = game.isInside(p);
  if (['chanko_feast', 'shikiri_reset', 'suriashi_drills'].includes(id) && p.stamina >= 9) return def.cost - 2;
  if (id === 'kachi_koshi' || id === 'zabuton_storm') return def.cost + 2;
  if (id === 'senior_rank' && !inside) return def.cost - 1;
  return def.cost;
}

function pickBuy(game) {
  const p = game.me();
  const opts = game.state.marketIds
    .map((id, i) => (id && game.canBuy(i, p).ok ? { i, def: game.cardById[id] } : null))
    .filter(Boolean);
  if (!opts.length) return null;
  opts.sort((a, b) => cardScore(game, p, b.def) - cardScore(game, p, a.def));
  return opts[0].i;
}

export function createBot(game, ui = {}) {
  let running = false;

  async function runTurn() {
    await sleep(PACE.start);
    const p = game.me();

    if (game.state.phase === 'awaitRoll') {
      if (ui.rollVisual) await ui.rollVisual(); else game.roll();
      await sleep(PACE.roll);
    }

    while (game.state.phase === 'rolled' && game.state.rerollsLeft > 0) {
      const dice = game.state.dice;
      const want = desiredKeep(game, p, dice);
      want.forEach((w, i) => { if (game.state.keep[i] !== w) game.toggleKeep(i); });
      if (isHappy(game, p, dice) || want.every(Boolean)) break;
      if (ui.rerollVisual) await ui.rerollVisual(); else game.reroll();
      await sleep(PACE.reroll);
    }

    // extra single-die rerolls, then Mawashi Grip (it locks the dice)
    for (const kind of ['reroll', 'convert']) {
      for (const a of game.actives(p).filter((x) => x.kind === kind)) {
        const dice = game.state.dice;
        let idx = -1;
        if (kind === 'reroll') idx = worstDie(game, p, dice);
        else if (counts(dice)[1] < 3) idx = dice.indexOf('1');
        if (idx < 0) continue;
        await game.useActive(a.key, idx);
        await sleep(PACE.active);
      }
    }

    if (game.state.phase === 'rolled') {
      await sleep(PACE.resolve);
      await game.resolve();
    }

    if (game.state.phase === 'buying') {
      for (let n = 0; n < 2; n++) {
        const idx = pickBuy(game);
        if (idx == null) break;
        await game.buy(idx);
        await sleep(PACE.buy);
        if (game.state.phase !== 'buying') break;
      }
    }

    if (game.state.phase === 'buying') {
      await sleep(PACE.end);
      await game.endTurn();
    }
  }

  return {
    maybeAct() {
      if (running || !game.state || game.state.winner != null) return;
      const p = game.me();
      if (!p || !p.bot) return;
      running = true;
      runTurn()
        .catch((e) => console.error('bot turn failed', e))
        .finally(() => { running = false; ui.render?.(); });
    },
  };
}
