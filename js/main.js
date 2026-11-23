// Bootstrap: data → rikishi selection → tournament.
import { loadData, mountArt, preloadArt } from './data.js';
import { Game } from './engine.js';
import { createUI } from './ui.js';
import { createShakeDetector } from './shake.js';
import { portrait } from './portrait.js';
import { createBot } from './bot.js';

const $ = (id) => document.getElementById(id);

let data, art;
try {
  ({ data, art } = await loadData());
} catch (e) {
  document.body.innerHTML = `<pre style="padding:16px;white-space:pre-wrap;font:13px monospace;color:#8e2b22">${String(e.message || e)}</pre>`;
  throw e;
}
preloadArt(art);
const cfg = data.config;
let count = 2;
let selected = [];
let mode = 'bots';
let ui = null;

// ── shake (permission asked on Start tap = valid user gesture) ─────────────
const shake = createShakeDetector(() => ui?.onShake?.());
const shakeApi = {
  get enabled() { return shake.enabled; },
  async toggle() {
    if (shake.enabled) shake.disable();
    else await shake.enable();
    ui?.render?.();
  },
};

// ── setup screen ───────────────────────────────────────────────────────────
const grid = $('rikishiGrid');

function renderGrid() {
  grid.innerHTML = data.characters.map((c) => {
    const idx = selected.indexOf(c.id);
    return `
    <button class="m-card ${idx >= 0 ? 'picked' : ''}" data-id="${c.id}" style="--m-c:${c.color}">
      ${idx >= 0 ? `<span class="m-order">${mode === 'bots' ? 'YOU' : idx + 1}</span>` : ''}
      <div class="m-face">${portrait(c, 52)}</div>
      <div class="m-name">${c.name} <span class="m-kanji">${c.kanji}</span></div>
      <div class="m-title">${c.epithet}</div>
      <div class="m-style">${c.style}</div>
      <div class="m-power"><b>${c.ability_name}</b> ${c.ability}</div>
    </button>`;
  }).join('');
  grid.querySelectorAll('.m-card').forEach((el) => {
    const id = el.dataset.id;
    mountArt(el.querySelector('.m-face'), art, `char_${id}`);
    el.onclick = () => {
      if (mode === 'bots') {
        selected = selected[0] === id ? [] : [id];
      } else {
        const i = selected.indexOf(id);
        if (i >= 0) selected.splice(i, 1);
        else if (selected.length < count) selected.push(id);
      }
      renderGrid(); updateStart();
    };
  });
}

function updateStart() {
  const btn = $('btnStart');
  $('playerCount').textContent = count;
  $('ringNote').textContent = count >= cfg.second_ring_min_alive_players ? 'Main + Challenge Dohyō' : 'Main Dohyō only';
  const hint = document.querySelector('#screen-setup .hint');
  if (mode === 'bots') {
    const ready = selected.length === 1;
    btn.textContent = ready ? `ENTER THE DOHYŌ ▶  VS ${count - 1} CPU` : 'CHOOSE YOUR RIKISHI';
    btn.disabled = !ready;
    hint.innerHTML = 'You wrestle as one rikishi — the rest are CPU opponents.<br/>Shake your phone (or tap) to roll the dice.';
  } else {
    const left = count - selected.length;
    btn.textContent = left > 0 ? `SELECT ${left} MORE RIKISHI` : 'ENTER THE DOHYŌ ▶';
    btn.disabled = left > 0;
    hint.innerHTML = 'Tap rikishi in seat order (clockwise). An opening roll decides who starts.<br/>Shake your phone (or tap) to roll the dice.';
  }
}

$('btnMinus').onclick = () => { count = Math.max(cfg.players.min, count - 1); if (mode !== 'bots') selected = selected.slice(0, count); renderGrid(); updateStart(); };
$('btnPlus').onclick = () => { count = Math.min(cfg.players.max, count + 1); renderGrid(); updateStart(); };

document.querySelectorAll('#modeToggle .mode-btn').forEach((b) => {
  b.onclick = () => {
    mode = b.dataset.mode;
    document.querySelectorAll('#modeToggle .mode-btn').forEach((x) => x.classList.toggle('active', x === b));
    if (mode === 'bots') selected = selected.slice(0, 1);
    renderGrid(); updateStart();
  };
});

renderGrid();
updateStart();

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline/dev: ignore */ });
}

// ── tournament ─────────────────────────────────────────────────────────────
$('btnStart').onclick = async () => {
  if (mode === 'bots' ? selected.length !== 1 : selected.length !== count) return;

  const game = new Game(data, {
    onChange: () => ui?.render(),
    log: () => ui?.renderTicker(),
    stage: (name, ctx) => ui.stage(name, ctx),
    promptRetreat: async ({ victim, attacker, positionName }) => {
      if (victim.bot) {
        await new Promise((r) => setTimeout(r, 650));
        return victim.stamina <= 4;                    // CPU yields when badly hurt
      }
      return ui.modal({
        title: `${attacker.name} pushes!`,
        body: `<p>${victim.name} holds the <b>${positionName}</b> with ${victim.stamina} Stamina left. Yield the position? The damage stands either way — but ${attacker.name} would step in (+1 Prestige).</p>`,
        actions: [
          { label: 'Stand firm', value: false },
          { label: `Yield → ${attacker.name} enters`, value: true, class: 'btn-danger' },
        ],
      });
    },
    promptTarget: async ({ player, card, candidates }) => {
      if (player.bot) {
        const t = candidates.slice().sort((a, b) => a.stamina - b.stamina || b.prestige - a.prestige)[0];
        return t.seat;
      }
      return ui.modal({
        title: card.name,
        body: `<p>${card.effect}</p><p>Choose your opponent:</p>`,
        actions: [
          ...candidates.map((c) => ({ label: `${c.name} · ${c.stamina}❤︎ ${c.prestige}★`, value: c.seat })),
          { label: 'Cancel (nothing is paid)', value: null },
        ],
      });
    },
  });

  ui = createUI(game);
  ui.setArt(art);
  ui.setShake(shakeApi);
  ui.setBot(createBot(game, ui));
  window.__game = game;   // debug/testing handle

  $('screen-setup').classList.add('hidden');
  $('screen-game').classList.remove('hidden');

  let ids = selected.slice();
  let botSeats = [];
  if (mode === 'bots') {
    const pool = data.characters.map((c) => c.id).filter((x) => x !== ids[0]);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    ids = ids.concat(pool.slice(0, count - 1));
    botSeats = ids.map((_, i) => i).slice(1);   // seat 0 = you, the rest are CPU
  }
  const params = new URLSearchParams(location.search);
  const seed = params.has('seed') ? Number(params.get('seed')) : undefined;
  await game.start(ids, { botSeats, seed });
  ui.render();

  const res = await shake.enable();
  if (res.ok) ui.render();
};
