// Headless engine smoke test: node tools/smoke.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert';
import { Game } from '../js/engine.js';

const root = new URL('../', import.meta.url);
const J = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const data = { monsters: J('data/monsters.json'), zones: J('data/zones.json'), cards: J('data/cards.json') };

const g = new Game(data, {
  log() {}, onChange() {},
  promptYield: async () => false,                    // victims always stay
  promptVacancy: async ({ vacant }) => vacant[0],     // always first preference
});
g.start(['ryuga', 'shirohime', 'tetsujin9', 'onizaru']);
const S = g.state;

// 1. Zone unlocking by player count
assert.equal(S.zonesActive.join(','), 'city,bay,shinjuku', '4p → 3 active districts');

// 2. First attack into empty Tokyo: free capture, no damage
S.phase = 'awaitRoll'; g.roll();
S.dice = ['attack', '3', '3', '3', 'energy', 'heal'];
await g.resolve();
const p0 = S.players[0];
assert.equal(p0.zone, 'city', 'captured Tokyo City');
assert.equal(p0.vp, 4, 'triple 3s = 3⭐ + capture 1⭐');
assert.equal(p0.energy, 1, 'energy face');
assert.equal(S.players[1].hp, 10, 'free capture deals no damage');
assert.equal(S.phase, 'buying');

// 3. End turn → next seat
await g.endTurn();
assert.equal(S.turn, 1, 'turn passes left');

// 4. Buying a keep card recalculates mods (must happen during the buying phase)
const p1 = S.players[1];
S.phase = 'awaitRoll'; g.roll();
S.dice = ['1', '2', '3', 'energy', 'heal', '2'];
await g.resolve();
assert.equal(S.phase, 'buying');
p1.energy = 10;
const cheap = data.cards.cards.filter((c) => c.type === 'keep').sort((a, b) => a.cost - b.cost)[0];
if (!S.shop.includes(cheap.id)) S.shop[0] = cheap.id;
await g.buy(S.shop.indexOf(cheap.id));
assert.equal(p1.cards.length, 1, 'card purchased');
assert.ok(p1.energy < 10, 'energy paid');

// 5. Attack from outside: damage + yield(stay) + forced capture of a vacancy
await g.endTurn();            // seat 2 (tetsujin) begins
assert.equal(S.turn, 2);
S.phase = 'awaitRoll'; g.roll();
S.dice = ['attack', 'attack', '1', '2', 'energy', 'heal'];
await g.resolve();
const p2 = S.players[2], p0b = S.players[0];
assert.equal(p0b.hp, 8, 'two 🐾 → 2 damage to city occupant');
assert.equal(p2.zone, 'bay', 'attacker forced into first vacancy (bay)');
assert.equal(p2.vp, 1, '+1⭐ for capture');
await g.endTurn();

// 6. Tokyo City start-of-turn bonus, and heal dice blocked there
S.turn = 0;
const hpBefore = S.players[0].hp;
const vpBefore = S.players[0].vp;
g.beginTurn();
assert.equal(S.players[0].vp, vpBefore + 2, '+2⭐ starting in City');
S.phase = 'awaitRoll'; g.roll();
S.dice = ['heal', 'heal', 'heal', 'heal', '1', '2'];
await g.resolve();
assert.equal(S.players[0].hp, hpBefore, 'heal dice blocked in Tokyo City');
await g.endTurn();

// 7. Bay start-of-turn bonus (+1⭐ +1⚡)
S.turn = 2;
g.beginTurn();
assert.equal(S.players[2].vp, 2, 'bay grants +1⭐ at turn start');
assert.equal(S.players[2].energy, 2, 'bay grants +1⚡ at turn start');

// 8. Elimination + last standing + 20⭐ win
for (let i = 1; i < 4; i++) { if (i !== 2) S.players[i].hp = 0; }
// keep only p2 alive scenario:
S.players[0].alive = true;
S.players[1].alive = false; S.players[2].alive = true; S.players[3].alive = false;
S.players[0].hp = 0;
await g.eliminate(S.players[0], S.players[2]);
assert.equal(g.alive().length, 1, 'one monster remains');
assert.equal(S.winner, 2, 'last monster standing wins');

console.log('SMOKE OK — all engine assertions passed');
