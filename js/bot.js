// CPU opponents — simple, watchable Monster City heuristics.
// A bot plays its whole turn: roll → keep good faces → reroll up to the limit →
// resolve (staged animations) → buy up to 2 cards → end turn.

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Paced so a human can follow the bot's turn without it dragging.
const PACE = { start: 800, roll: 750, reroll: 850, resolve: 650, buy: 700, end: 650 };

function desiredKeep(p, dice) {
  const counts = { 1: 0, 2: 0, 3: 0 };
  for (const f of dice) if (counts[f] !== undefined) counts[f]++;
  return dice.map((f) => {
    if (f === 'attack' || f === 'energy') return true;
    if (f === 'heal') return p.hp < p.maxHp - 1;   // only heal when actually hurt
    if (counts[f] !== undefined) return counts[f] >= 3; // keep triple material only
    return false;
  });
}

function isHappy(dice) {
  const counts = { 1: 0, 2: 0, 3: 0 };
  for (const f of dice) if (counts[f] !== undefined) counts[f]++;
  return dice.includes('attack') || Object.values(counts).some((c) => c >= 3);
}

function pickBuy(game) {
  const p = game.me();
  const affordable = game.state.shop
    .map((id, i) => (id ? { id, i, def: game.cardById[id] } : null))
    .filter(Boolean)
    .filter((c) => game.cardCost(p, c.def) <= p.energy);
  if (!affordable.length) return null;
  // strongest card it can afford (cost ≈ power in this game)
  affordable.sort((a, b) => game.cardCost(p, b.def) - game.cardCost(p, a.def));
  return affordable[0].i;
}

export function createBot(game, ui = {}) {
  let running = false;

  async function runTurn() {
    await sleep(PACE.start);
    const p = game.me();

    // 1) roll
    if (game.state.phase === 'awaitRoll') {
      if (ui.rollVisual) await ui.rollVisual();
      else game.roll();
      await sleep(PACE.roll);
    }

    // 2) reroll loop — keep the good faces, reroll the rest, stop when happy
    while (game.state.phase === 'rolled' && game.state.rerollsLeft > 0) {
      const dice = game.state.dice;
      const want = desiredKeep(p, dice);
      want.forEach((w, i) => { if (game.state.keep[i] !== w) game.toggleKeep(i); });
      if (isHappy(dice)) break;
      if (ui.rerollVisual) await ui.rerollVisual();
      else game.reroll();
      await sleep(PACE.reroll);
    }

    // 3) resolve — engine stages play the slow choreography
    if (game.state.phase === 'rolled') {
      await sleep(PACE.resolve);
      await game.resolve();
    }

    // 4) buy up to two cards (never opens the shop sheet)
    if (game.state.phase === 'buying') {
      for (let n = 0; n < 2; n++) {
        const idx = pickBuy(game);
        if (idx == null) break;
        await game.buy(idx);
        await sleep(PACE.buy);
      }
    }

    // 5) hand over
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
        .finally(() => { running = false; });
    },
  };
}
