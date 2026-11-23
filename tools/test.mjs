// YOKOZUNA engine acceptance tests — run: node tools/test.mjs  (or npm test)
// Covers every case in docs/AGENT_IMPLEMENTATION.md plus card/ability edge cases
// and full simulated games at 2, 4 and 6 players.
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Game, scoreNumbers } from '../js/engine.js';
import { validateData, EFFECTS } from '../js/effects.js';

const DATA = JSON.parse(readFileSync(new URL('../data/yokozuna-data.json', import.meta.url), 'utf8'));
const ALL = DATA.characters.map((c) => c.id);

let passed = 0;
const failures = [];
async function test(name, fn) {
  try { await fn(); passed++; console.log(`  ✓ ${name}`); }
  catch (e) { failures.push(name); console.log(`  ✗ ${name}\n    ${e.stack.split('\n').slice(0, 3).join('\n    ')}`); }
}

/** New game, deterministic seed, seat 0 starts. hooks may override prompts. */
async function setup(ids, hooks = {}, opts = {}) {
  const calls = { retreat: [], target: [] };
  const g = new Game(DATA, {
    promptRetreat: async (ctx) => { calls.retreat.push(ctx); return hooks.retreat ? hooks.retreat(ctx) : false; },
    promptTarget: async (ctx) => { calls.target.push(ctx); return hooks.target ? hooks.target(ctx) : ctx.candidates[0].seat; },
  });
  await g.start(ids, { seed: opts.seed ?? 12345, firstSeat: opts.firstSeat ?? 0 });
  g.calls = calls;
  return g;
}
/** Force the active player's final dice and resolve them. */
async function resolveWith(g, dice) {
  g.state.phase = 'rolled';
  g.state.dice = dice.slice();
  g.state.keep = dice.map(() => false);
  g.state.rerollsLeft = 0;
  await g.resolve();
}
const P = (g, i) => g.state.players[i];
async function giveTurn(g, seat) { g.state.turn = seat; await g.beginTurn(); }
function putInMarket(g, id) {
  const s = g.state;
  for (const k of ['deckIds', 'discardIds']) s[k] = s[k].filter((x) => x !== id);
  if (!s.marketIds.includes(id)) { if (s.marketIds[0]) s.deckIds.push(s.marketIds[0]); s.marketIds[0] = id; }
  return s.marketIds.indexOf(id);
}
function allCardLocations(g) {
  const s = g.state;
  return [...s.marketIds.filter(Boolean), ...s.deckIds, ...s.discardIds, ...s.players.flatMap((p) => p.keepCardIds)];
}

console.log('YOKOZUNA engine tests');

// ── data ───────────────────────────────────────────────────────────────────
await test('data validates: 6 rikishi, exactly 20 cards (10 KEEP + 10 DISCARD), all handlers registered', () => {
  assert.equal(validateData(DATA), true);
  assert.equal(DATA.cards.length, 20);
  for (const c of DATA.characters) assert.ok(EFFECTS[c.ability_id]);
  for (const c of DATA.cards) assert.ok(EFFECTS[c.effect_id]);
  const bad = structuredClone(DATA); bad.cards.push({ ...bad.cards[0], id: 'extra' });
  assert.throws(() => validateData(bad), /20 market cards/);
});

// ── acceptance table ───────────────────────────────────────────────────────
await test('Fresh game: 10 Stamina, 0 Prestige, 0 Spirit, all outside; 3-card market from a 20-card deck', async () => {
  for (const id of ALL) {
    const other = ALL.find((x) => x !== id);
    const g = await setup([id, other]);
    for (const p of g.state.players) {
      assert.deepEqual([p.stamina, p.prestige, p.spirit, p.position, p.alive], [10, 0, 0, 'OUTSIDE', true]);
    }
    assert.equal(g.state.marketIds.filter(Boolean).length, 3);
    assert.equal(g.state.deckIds.length, 17);
    assert.equal(new Set(allCardLocations(g)).size, 20);
  }
});

await test('Opening roll-off: most Push goes first (deterministic with seed)', async () => {
  const g = new Game(DATA, {});
  await g.start(['iwakaze', 'arashiryu', 'chiyonami'], { seed: 99 });
  const last = g.state.openingRolls.at(-1);
  const best = Math.max(...last.map((r) => r.push));
  assert.equal(last.filter((r) => r.push === best).length, 1);
  assert.equal(g.state.turn, last.find((r) => r.push === best).seat);
});

await test('Dice scoring: 2,2,2,2,SPIRIT,PUSH → +3 Prestige, +1 Spirit, 1 damage to inside opponent', async () => {
  const g = await setup(['iwakaze', 'arashiryu', 'chiyonami']);
  P(g, 1).position = 'MAIN';
  await resolveWith(g, ['2', '2', '2', '2', 'SPIRIT', 'PUSH']);
  assert.equal(P(g, 0).prestige, 3);
  assert.equal(P(g, 0).spirit, 1);
  assert.equal(P(g, 1).stamina, 9);
  assert.equal(P(g, 2).stamina, 10, 'outside opponents unaffected by an outside attacker');
  assert.equal(P(g, 0).position, 'OUTSIDE', 'defender stayed, so attacker stays outside');
});

await test('Double triple: 1,1,1,3,3,3 → +4 Prestige; fewer than three scores nothing', async () => {
  assert.equal(scoreNumbers(['1', '1', '1', '3', '3', '3']).total, 4);
  assert.equal(scoreNumbers(['1', '1', '2', '2', '3', '3']).total, 0);
  assert.equal(scoreNumbers(['3', '3', '3', '3', '3', '3']).total, 6);
  const g = await setup(['iwakaze', 'arashiryu']);
  await resolveWith(g, ['1', '1', '1', '3', '3', '3']);
  assert.equal(P(g, 0).prestige, 4);
});

await test('First ring capture: empty ring + Push → Main, +1 Prestige, zero damage', async () => {
  const g = await setup(['iwakaze', 'arashiryu', 'chiyonami', 'akatsukifuji', 'tetsunishiki']);
  await resolveWith(g, ['PUSH', 'PUSH', '1', '2', 'SPIRIT', 'RECOVER']);
  assert.equal(P(g, 0).position, 'MAIN');
  assert.equal(P(g, 0).prestige, 1);
  for (let i = 1; i < 5; i++) assert.equal(P(g, i).stamina, 10);
  assert.equal(g.occupant('CHALLENGE'), null, 'enters exactly one position, Main first');
  assert.equal(P(g, 0).stamina, 10, 'Recovery after entering does nothing (now inside)');
});

await test('Ring start: inside at own turn start → +2 Prestige; Senior Rank makes +3', async () => {
  const g = await setup(['iwakaze', 'arashiryu']);
  P(g, 1).position = 'MAIN';
  await giveTurn(g, 1);
  assert.equal(P(g, 1).prestige, 2);
  P(g, 1).keepCardIds.push('senior_rank');
  await giveTurn(g, 1);
  assert.equal(P(g, 1).prestige, 5);
  await giveTurn(g, 0);
  assert.equal(P(g, 0).prestige, 0, 'outside players get nothing');
});

await test('Ring healing ban: inside player rolling Recover heals 0 from dice', async () => {
  const g = await setup(['akatsukifuji', 'arashiryu']);
  P(g, 0).position = 'MAIN'; P(g, 0).stamina = 5;
  await resolveWith(g, ['RECOVER', 'RECOVER', 'RECOVER', 'RECOVER', '1', '2']);
  assert.equal(P(g, 0).stamina, 5);
});

await test('Ability activation: Arashiryū with 3+ Push gets +1 damage exactly once', async () => {
  const g = await setup(['arashiryu', 'iwakaze', 'chiyonami']);
  P(g, 2).position = 'MAIN';
  await resolveWith(g, ['PUSH', 'PUSH', 'PUSH', 'PUSH', '1', '2']);
  assert.equal(P(g, 2).stamina, 10 - 5);
  const g2 = await setup(['arashiryu', 'iwakaze', 'chiyonami']);
  P(g2, 2).position = 'MAIN';
  await resolveWith(g2, ['PUSH', 'PUSH', '1', '1', '2', '3']);
  assert.equal(P(g2, 2).stamina, 8, 'no bonus below 3 Push');
});

await test('Arashiryū + Tachiai Charge stack: +2 damage', async () => {
  const g = await setup(['arashiryu', 'chiyonami']);
  P(g, 0).keepCardIds.push('tachiai_charge');
  P(g, 1).position = 'MAIN';
  await resolveWith(g, ['PUSH', 'PUSH', 'PUSH', '1', '2', '3']);
  assert.equal(P(g, 1).stamina, 10 - 5);
});

await test('Attack bonus without Push never creates an attack', async () => {
  const g = await setup(['arashiryu', 'chiyonami']);
  P(g, 0).keepCardIds.push('tachiai_charge');
  P(g, 1).position = 'MAIN';
  await resolveWith(g, ['1', '2', '3', 'SPIRIT', 'RECOVER', 'RECOVER']);
  assert.equal(P(g, 1).stamina, 10);
  assert.equal(P(g, 0).position, 'OUTSIDE');
});

await test('Defender: Iwakaze inside takes 3 Push → loses 2; 1 Push → loses 1', async () => {
  const g = await setup(['chiyonami', 'iwakaze']);
  P(g, 1).position = 'MAIN';
  await resolveWith(g, ['PUSH', 'PUSH', 'PUSH', '1', '2', '3']);
  assert.equal(P(g, 1).stamina, 8);
  await giveTurn(g, 0);
  await resolveWith(g, ['PUSH', '1', '1', '2', '2', '3']);
  assert.equal(P(g, 1).stamina, 7, 'below 2 damage → no prevention (flag reset for new attacker turn)');
});

await test('Iwakaze outside gets no prevention; Clay Footing stacks with Unmovable inside', async () => {
  const g = await setup(['chiyonami', 'iwakaze']);
  P(g, 0).position = 'MAIN';
  await resolveWith(g, ['PUSH', 'PUSH', 'PUSH', '1', '2', '3']);
  assert.equal(P(g, 1).stamina, 7, 'outside: full damage');
  const g2 = await setup(['chiyonami', 'iwakaze']);
  P(g2, 1).position = 'MAIN'; P(g2, 1).keepCardIds.push('clay_footing');
  await resolveWith(g2, ['PUSH', 'PUSH', 'PUSH', '1', '2', '3']);
  assert.equal(P(g2, 1).stamina, 9, '3 − Unmovable 1 − Clay Footing 1');
});

await test('Prevention to zero does not allow a retreat; attacker still enters a vacant position', async () => {
  const g = await setup(['chiyonami', 'iwakaze', 'arashiryu', 'akatsukifuji', 'tetsunishiki'], { retreat: () => true });
  P(g, 1).position = 'MAIN'; P(g, 1).keepCardIds.push('clay_footing');
  await resolveWith(g, ['PUSH', '1', '1', '2', '2', '3']);
  assert.equal(P(g, 1).stamina, 10);
  assert.equal(g.calls.retreat.length, 0, 'no retreat prompt on a zero-damage attack');
  assert.equal(P(g, 1).position, 'MAIN');
  assert.equal(P(g, 0).position, 'CHALLENGE', 'Push dice were rolled — vacant Challenge is entered');
});

await test('Recovery synergy: Akatsukifuji at 8 rolls 1 Recover outside → 10', async () => {
  const g = await setup(['akatsukifuji', 'iwakaze']);
  P(g, 0).stamina = 8;
  await resolveWith(g, ['RECOVER', '1', '1', '2', '2', '3']);
  assert.equal(P(g, 0).stamina, 10);
});

await test('No overheal: Akatsukifuji at 10 stays 10; at 9 with Chanko Recipe caps at 10', async () => {
  const g = await setup(['akatsukifuji', 'iwakaze']);
  await resolveWith(g, ['RECOVER', 'RECOVER', '1', '2', '2', '3']);
  assert.equal(P(g, 0).stamina, 10);
  const g2 = await setup(['akatsukifuji', 'iwakaze']);
  P(g2, 0).stamina = 6; P(g2, 0).keepCardIds.push('chanko_recipe');
  await resolveWith(g2, ['RECOVER', '1', '1', '2', '2', '3']);
  assert.equal(P(g2, 0).stamina, 9, '6 + 1 die + Chanko Champion + Chanko Recipe');
});

await test('Reroll: Chiyonami rerolls exactly one die after normal rerolls; mandatory; once', async () => {
  for (let seed = 1; seed <= 40; seed++) {
    const g = await setup(['chiyonami', 'iwakaze'], {}, { seed });
    g.roll(); g.reroll(); g.reroll();
    assert.equal(g.state.rerollsLeft, 0);
    const before = g.state.dice.slice();
    const acts = g.actives();
    assert.equal(acts.length, 1);
    assert.equal(acts[0].key, 'char:master_balance');
    assert.ok(await g.useActive(acts[0].key, 2));
    g.state.dice.forEach((f, i) => { if (i !== 2) assert.equal(f, before[i]); });
    assert.equal(g.actives().length, 0, 'used once per turn');
    assert.equal(g.reroll(), false, 'no further normal rerolls');
  }
  const g = await setup(['iwakaze', 'chiyonami']);
  g.roll();
  assert.equal(g.actives().length, 0, 'other rikishi have no extra reroll');
});

await test('Chiyonami + Extra Keiko: two separate single-die rerolls in chosen order', async () => {
  const g = await setup(['chiyonami', 'iwakaze']);
  P(g, 0).keepCardIds.push('extra_keiko');
  g.roll();
  assert.equal(g.actives().length, 2);
  await g.useActive('card:extra_keiko', 0);
  assert.equal(g.actives().length, 1);
  await g.useActive('char:master_balance', 1);
  assert.equal(g.actives().length, 0);
});

await test('Mawashi Grip: change one 1 to Push after all rerolls (locks dice)', async () => {
  const g = await setup(['iwakaze', 'chiyonami']);
  P(g, 0).keepCardIds.push('mawashi_grip');
  g.roll();
  g.state.dice = ['1', '1', '2', '3', 'SPIRIT', 'RECOVER'];
  assert.equal(await g.useActive('card:mawashi_grip', 2), false, 'only a die showing 1');
  assert.ok(await g.useActive('card:mawashi_grip', 0));
  assert.deepEqual(g.state.dice, ['PUSH', '1', '2', '3', 'SPIRIT', 'RECOVER']);
  assert.equal(g.reroll(), false);
  assert.equal(g.actives().length, 0);
});

await test('Hoshinoumi + Crowd Chant: +2 on successful numbered scoring, nothing without a set', async () => {
  const g = await setup(['hoshinoumi', 'iwakaze']);
  P(g, 0).keepCardIds.push('crowd_chant');
  await resolveWith(g, ['3', '3', '3', 'SPIRIT', '1', '2']);
  assert.equal(P(g, 0).prestige, 5);
  const g2 = await setup(['hoshinoumi', 'iwakaze']);
  await resolveWith(g2, ['3', '3', '1', '1', '2', '2']);
  assert.equal(P(g2, 0).prestige, 0);
});

await test('Tetsunishiki + Salt Ritual: +1 each when Spirit dice grant Spirit', async () => {
  const g = await setup(['tetsunishiki', 'iwakaze']);
  P(g, 0).keepCardIds.push('salt_ritual');
  await resolveWith(g, ['SPIRIT', 'SPIRIT', '1', '2', '3', '3']);
  assert.equal(P(g, 0).spirit, 4);
});

await test('Market purchase: pay cost, KEEP card kept, slot refilled immediately', async () => {
  const g = await setup(['iwakaze', 'arashiryu']);
  await resolveWith(g, ['1', '2', '3', '1', '2', '3']);
  const idx = putInMarket(g, 'salt_ritual');
  P(g, 0).spirit = 5;
  const deck = g.state.deckIds.length;
  assert.ok(await g.buy(idx));
  assert.equal(P(g, 0).spirit, 2);
  assert.deepEqual(P(g, 0).keepCardIds, ['salt_ritual']);
  assert.ok(g.state.marketIds[idx] && g.state.marketIds[idx] !== 'salt_ritual');
  assert.equal(g.state.deckIds.length, deck - 1);
  assert.equal(new Set(allCardLocations(g)).size, 20);
});

await test('Unaffordable purchase refused', async () => {
  const g = await setup(['iwakaze', 'arashiryu']);
  await resolveWith(g, ['1', '2', '3', '1', '2', '3']);
  const idx = putInMarket(g, 'kachi_koshi');
  P(g, 0).spirit = 5;
  assert.equal(g.canBuy(idx).ok, false);
  assert.equal(await g.buy(idx), false);
  assert.equal(P(g, 0).spirit, 5);
});

await test('DISCARD resolves immediately and goes to discard (Sponsor’s Envelope: net +2)', async () => {
  const g = await setup(['iwakaze', 'arashiryu']);
  await resolveWith(g, ['1', '2', '3', '1', '2', '3']);
  const idx = putInMarket(g, 'sponsor_gift');
  P(g, 0).spirit = 2;
  assert.ok(await g.buy(idx));
  assert.equal(P(g, 0).spirit, 4);
  assert.ok(g.state.discardIds.includes('sponsor_gift'));
});

await test('Market refresh: pay 2 Spirit, all shown cards discarded and refilled', async () => {
  const g = await setup(['iwakaze', 'arashiryu']);
  await resolveWith(g, ['1', '2', '3', '1', '2', '3']);
  P(g, 0).spirit = 3;
  const shown = g.state.marketIds.slice();
  assert.ok(await g.refresh());
  assert.equal(P(g, 0).spirit, 1);
  for (const id of shown) assert.ok(g.state.discardIds.includes(id));
  assert.equal(g.state.marketIds.filter(Boolean).length, 3);
  for (const id of g.state.marketIds) assert.ok(!shown.includes(id));
  assert.equal(g.canRefresh(), false, 'cannot refresh with 1 Spirit');
});

await test('Short deck exhaustion: only the discard pile is reshuffled; KEEP never duplicated', async () => {
  const g = await setup(['iwakaze', 'arashiryu']);
  await resolveWith(g, ['1', '2', '3', '1', '2', '3']);
  const s = g.state;
  // move everything except the market into: P1 keeps / discard pile
  P(g, 1).keepCardIds = s.deckIds.splice(0, 10);
  s.discardIds = s.deckIds.splice(0);
  const discardBefore = s.discardIds.slice();
  P(g, 0).spirit = 99;
  const idx = s.marketIds.findIndex((id) => g.canBuy(s.marketIds.indexOf(id)).ok);
  assert.ok(await g.buy(idx, 1));
  assert.ok(discardBefore.includes(s.marketIds[idx]), 'refill came from the old discard pile');
  const all = allCardLocations(g);
  assert.equal(all.length, 20); assert.equal(new Set(all).size, 20);
  for (const k of P(g, 1).keepCardIds) assert.ok(!s.deckIds.includes(k) && !s.marketIds.includes(k));
});

await test('Market empty: no infinite loop, empty slots stay empty, refresh refused with nothing shown', async () => {
  const g = await setup(['iwakaze', 'arashiryu']);
  await resolveWith(g, ['1', '2', '3', '1', '2', '3']);
  const s = g.state;
  P(g, 1).keepCardIds = DATA.cards.map((c) => c.id).filter((id) => id !== 'salt_ritual');
  s.marketIds = ['salt_ritual', null, null];
  s.deckIds = []; s.discardIds = [];
  P(g, 0).spirit = 99;
  assert.ok(await g.buy(0));
  assert.deepEqual(s.marketIds, [null, null, null]);
  assert.equal(g.canRefresh(), false);
  assert.equal(await g.refresh(), false);
  assert.equal(P(g, 0).spirit, 96, 'no payment for refreshing an empty market');
  assert.equal(g.drawCard(), null);
});

await test('Nonattack damage: Henka! on inside player → 3 damage, no retreat prompt, no entry', async () => {
  const g = await setup(['iwakaze', 'arashiryu', 'chiyonami'], { retreat: () => true });
  P(g, 1).position = 'MAIN';
  await resolveWith(g, ['1', '2', '3', '1', '2', '3']);
  const idx = putInMarket(g, 'henka');
  P(g, 0).spirit = 4;
  assert.ok(await g.buy(idx));
  assert.equal(P(g, 1).stamina, 7);
  assert.equal(P(g, 1).position, 'MAIN');
  assert.equal(P(g, 0).position, 'OUTSIDE');
  assert.equal(g.calls.retreat.length, 0);
  assert.deepEqual(g.calls.target[0].candidates.map((c) => c.seat), [1], 'only dohyō occupants are eligible');
});

await test('Henka! with nobody inside cannot be bought', async () => {
  const g = await setup(['iwakaze', 'arashiryu']);
  await resolveWith(g, ['1', '2', '3', '1', '2', '3']);
  const idx = putInMarket(g, 'henka');
  P(g, 0).spirit = 9;
  assert.equal(g.canBuy(idx).ok, false);
});

await test('Card damage eliminating an occupant leaves the position empty (no auto entry)', async () => {
  const g = await setup(['iwakaze', 'arashiryu', 'chiyonami']);
  P(g, 1).position = 'MAIN'; P(g, 1).stamina = 2;
  await resolveWith(g, ['1', '2', '3', '1', '2', '3']);
  const idx = putInMarket(g, 'tsuppari_flurry');
  P(g, 0).spirit = 4;
  assert.ok(await g.buy(idx));
  assert.equal(P(g, 1).alive, false);
  assert.equal(g.occupant('MAIN'), null);
  assert.equal(P(g, 0).position, 'OUTSIDE');
  assert.equal(P(g, 2).stamina, 10, 'Tsuppari only hits the opposite side');
});

await test('Final Bout: any opponent −2, buyer +1 Prestige; Ceremonial Entrance branches', async () => {
  const g = await setup(['iwakaze', 'arashiryu', 'chiyonami'], { target: () => 2 });
  await resolveWith(g, ['1', '2', '3', '1', '2', '3']);
  P(g, 0).spirit = 20;
  assert.ok(await g.buy(putInMarket(g, 'final_bout')));
  assert.equal(P(g, 2).stamina, 8); assert.equal(P(g, 0).prestige, 1);
  assert.ok(await g.buy(putInMarket(g, 'ceremonial_entrance')));
  assert.equal(P(g, 0).prestige, 2); assert.equal(P(g, 0).spirit, 20 - 4 - 3 + 1);
  P(g, 0).position = 'MAIN';
  g.state.discardIds = g.state.discardIds.filter((x) => x !== 'ceremonial_entrance');
  assert.ok(await g.buy(putInMarket(g, 'ceremonial_entrance')));
  assert.equal(P(g, 0).prestige, 4);
});

await test('Ring switch: inside player yields after Push damage → attacker enters, +1 Prestige', async () => {
  const g = await setup(['iwakaze', 'arashiryu', 'chiyonami'], { retreat: () => true });
  P(g, 1).position = 'MAIN';
  await resolveWith(g, ['PUSH', 'PUSH', '1', '2', 'SPIRIT', 'RECOVER']);
  assert.equal(P(g, 1).stamina, 8, 'damage taken before yielding');
  assert.equal(P(g, 1).position, 'OUTSIDE');
  assert.equal(P(g, 0).position, 'MAIN');
  assert.equal(P(g, 0).prestige, 1);
  assert.equal(P(g, 0).stamina, 10, 'now inside: no Recovery (already full anyway)');
});

await test('Fierce Rivalry: +1 extra Prestige on entry after a Push attack', async () => {
  const g = await setup(['iwakaze', 'arashiryu'], { retreat: () => true });
  P(g, 0).keepCardIds.push('rivalry');
  await resolveWith(g, ['PUSH', '1', '1', '2', '2', '3']);
  assert.equal(P(g, 0).prestige, 2);
});

await test('Push eliminating the inside wrestler → attacker enters the vacated position', async () => {
  const g = await setup(['iwakaze', 'arashiryu', 'chiyonami']);
  P(g, 1).position = 'MAIN'; P(g, 1).stamina = 1; P(g, 1).spirit = 7; P(g, 1).keepCardIds = ['senior_rank'];
  await resolveWith(g, ['PUSH', '1', '1', '2', '2', '3']);
  assert.equal(P(g, 1).alive, false);
  assert.equal(P(g, 1).spirit, 0, 'Spirit lost');
  assert.ok(g.state.discardIds.includes('senior_rank'), 'KEEP cards to discard');
  assert.equal(P(g, 0).position, 'MAIN');
});

await test('Inside attacker hits all outside opponents, never a fellow occupant', async () => {
  const g = await setup(['iwakaze', 'arashiryu', 'chiyonami', 'akatsukifuji', 'tetsunishiki']);
  P(g, 0).position = 'MAIN'; P(g, 1).position = 'CHALLENGE';
  await resolveWith(g, ['PUSH', 'PUSH', '1', '2', '2', '3']);
  assert.equal(P(g, 1).stamina, 10);
  for (const i of [2, 3, 4]) assert.equal(P(g, i).stamina, 8);
});

await test('Two occupants hit: damage all, retreat prompts in turn order, attacker enters ONE (Main first)', async () => {
  const g = await setup(['iwakaze', 'arashiryu', 'chiyonami', 'akatsukifuji', 'tetsunishiki'], { retreat: () => true }, { firstSeat: 2 });
  P(g, 0).position = 'CHALLENGE'; P(g, 4).position = 'MAIN';
  await resolveWith(g, ['PUSH', '1', '1', '2', '2', '3']);
  assert.deepEqual(g.calls.retreat.map((c) => c.victim.seat), [4, 0], 'turn order after attacker (seat 2): 4 then 0');
  assert.equal(P(g, 2).position, 'MAIN');
  assert.equal(g.occupant('CHALLENGE'), null);
  assert.equal(P(g, 2).prestige, 1);
});

await test('5–6 setup: Challenge active with 5+ alive; hidden/inactive with 4 or fewer', async () => {
  assert.equal((await setup(ALL)).state.challengeActive, true);
  assert.equal((await setup(ALL.slice(0, 5))).state.challengeActive, true);
  const g4 = await setup(ALL.slice(0, 4));
  assert.equal(g4.state.challengeActive, false);
  assert.deepEqual(g4.activePositions(), ['MAIN']);
});

await test('Fall to four alive: Challenge deactivates, occupant moves outside without damage or Prestige', async () => {
  const g = await setup(ALL.slice(0, 5));
  P(g, 2).position = 'CHALLENGE'; P(g, 2).prestige = 6;
  P(g, 3).stamina = 1;
  await resolveWith(g, ['1', '2', '3', '1', '2', '3']);
  P(g, 0).spirit = 4;
  await g.buy(putInMarket(g, 'final_bout'), 3);
  assert.equal(P(g, 3).alive, false);
  assert.equal(g.state.challengeActive, false);
  assert.equal(P(g, 2).position, 'OUTSIDE');
  assert.equal(P(g, 2).stamina, 10); assert.equal(P(g, 2).prestige, 6);
});

await test('Winner: alive with 20+ Prestige at end of turn → YOKOZUNA (not before end of turn)', async () => {
  const g = await setup(['iwakaze', 'arashiryu']);
  P(g, 0).prestige = 17;
  await resolveWith(g, ['3', '3', '3', '1', '2', 'SPIRIT']);
  assert.equal(P(g, 0).prestige, 20);
  assert.equal(g.state.winner, null, 'not declared mid-turn');
  await g.endTurn();
  assert.equal(g.state.winner, 0);
  assert.equal(g.state.phase, 'over');
});

await test('Survival victory: last wrestler standing wins immediately', async () => {
  const g = await setup(['iwakaze', 'arashiryu']);
  P(g, 1).position = 'MAIN'; P(g, 1).stamina = 2;
  await resolveWith(g, ['PUSH', 'PUSH', '1', '2', '3', '3']);
  assert.equal(g.state.winner, 0);
  assert.equal(g.state.phase, 'over');
});

await test('Mutual destruction: final players eliminated by one effect → no winner', async () => {
  const g = await setup(['iwakaze', 'arashiryu']);
  P(g, 0).stamina = 1; P(g, 1).stamina = 2;
  await g.dealDamage(null, g.alive(), 3, 'CARD_EFFECT', 'test');
  assert.equal(g.state.winner, -1);
  assert.equal(g.alive().length, 0);
});

await test('Stable Support: +1 at end of turn only outside and at 7 or fewer', async () => {
  const g = await setup(['iwakaze', 'arashiryu']);
  P(g, 0).keepCardIds.push('stable_support'); P(g, 0).stamina = 7;
  await resolveWith(g, ['1', '2', '3', '1', '2', '3']);
  await g.endTurn();
  assert.equal(P(g, 0).stamina, 8);
  await resolveWith(g, ['1', '2', '3', '1', '2', '3']);
  await g.endTurn();
  assert.equal(P(g, 0).stamina, 8, '8 > 7: no heal');
});

await test('Healing cards work inside; stamina never exceeds 10', async () => {
  const g = await setup(['iwakaze', 'arashiryu']);
  P(g, 0).position = 'MAIN'; P(g, 0).stamina = 6;
  await resolveWith(g, ['1', '2', '3', '1', '2', '3']);
  P(g, 0).spirit = 20;
  await g.buy(putInMarket(g, 'chanko_feast'));
  assert.equal(P(g, 0).stamina, 9);
  await g.buy(putInMarket(g, 'suriashi_drills'));
  assert.equal(P(g, 0).stamina, 10);
});

await test('State is serializable and reloads deterministically', async () => {
  const g = await setup(['iwakaze', 'arashiryu', 'chiyonami']);
  const snap = g.serialize();
  g.roll(); const a = g.state.dice.slice();
  g.load(snap); g.roll();
  assert.deepEqual(g.state.dice, a);
  assert.doesNotThrow(() => JSON.stringify(g.state));
});

// ── full simulated games ────────────────────────────────────────────────────
async function simulate(n, seed) {
  const g = new Game(DATA, {
    promptRetreat: async ({ victim }) => victim.stamina <= 4,
    promptTarget: async ({ candidates }) => candidates[0].seat,
  });
  await g.start(ALL.slice(0, n), { seed });
  let turns = 0;
  while (g.state.winner == null && turns < 2000) {
    g.roll();
    while (g.state.rerollsLeft > 0 && g.rand() < 0.6) {
      g.state.keep = g.state.dice.map((f) => f === 'PUSH' || f === 'SPIRIT');
      if (!g.reroll()) break;
    }
    for (const a of g.actives()) {
      const idx = a.kind === 'convert' ? g.state.dice.indexOf('1') : 0;
      await g.useActive(a.key, idx);
    }
    await g.resolve();
    if (g.state.winner != null) break;
    for (let k = 0; k < 3; k++) {
      const i = g.state.marketIds.findIndex((_, j) => g.canBuy(j).ok);
      if (i < 0) break;
      await g.buy(i);
      if (g.state.winner != null) break;
    }
    if (g.state.winner != null) break;
    if (g.canRefresh() && g.rand() < 0.1) await g.refresh();
    const all = allCardLocations(g);
    assert.equal(all.length, 20, 'card conservation'); assert.equal(new Set(all).size, 20, 'no duplicate cards');
    for (const p of g.state.players) {
      assert.ok(p.stamina <= 10, 'stamina cap');
      if (!p.alive) assert.equal(p.position, 'OUTSIDE');
    }
    const inside = g.alive().filter((p) => p.position !== 'OUTSIDE');
    assert.ok(inside.length <= g.activePositions().length, 'at most one wrestler per active position');
    if (!g.state.challengeActive) assert.ok(!inside.some((p) => p.position === 'CHALLENGE'));
    await g.endTurn();
    turns++;
  }
  return { g, turns };
}

for (const n of [2, 4, 6]) {
  await test(`Simulated games at ${n} players finish with a valid result (50 seeds)`, async () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { g, turns } = await simulate(n, seed * 7919 + n);
      assert.ok(g.state.winner != null, `game ended (seed ${seed}, ${turns} turns)`);
      if (g.state.winner >= 0) {
        const w = g.state.players[g.state.winner];
        assert.ok(w.alive && (w.prestige >= 20 || g.alive().length === 1));
      }
    }
  });
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
