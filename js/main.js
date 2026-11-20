// Bootstrap: data → setup screen → game.
import { loadData, mountArt, fallbackHTML } from './data.js';
import { Game } from './engine.js';
import { createUI } from './ui.js?v=7';
import { createShakeDetector } from './shake.js';
import { icon } from './icons.js';
import { portrait } from './portrait.js';
import { createBot } from './bot.js';

const $ = (id) => document.getElementById(id);

const data = await loadData();
const art = data.art;
let count = 2;
let selected = [];
let mode = 'bots';
let ui = null;

// ── shake (permission asked on Start tap = valid user gesture) ─────────────
const shake = createShakeDetector(() => ui?.onShake?.(), (m) => ui?.onMotion?.(m));
const shakeApi = {
  get enabled() { return shake.enabled; },
  async toggle() {
    if (shake.enabled) shake.disable();
    else await shake.enable();
    ui?.render?.();
  },
};

// ── setup screen ───────────────────────────────────────────────────────────
const grid = $('monsterGrid');

function renderGrid() {
  grid.innerHTML = data.monsters.monsters.map((m) => {
    const idx = selected.indexOf(m.id);
    return `
    <button class="m-card ${idx >= 0 ? 'picked' : ''}" data-id="${m.id}" style="--m-c:${m.color}">
      ${idx >= 0 ? `<span class="m-order">${idx + 1}</span>` : ''}
      <div class="m-face">${portrait(m, 52)}</div>
      <div class="m-name">${m.name}</div>
      <div class="m-title">${m.title}</div>
      <div class="m-power">${m.power.text}</div>
    </button>`;
  }).join('');
  grid.querySelectorAll('.m-card').forEach((el) => {
    const id = el.dataset.id;
    mountArt(el.querySelector('.m-face'), art, `monster_${id}`);
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
  const hint = document.querySelector('#screen-setup .hint');
  if (mode === 'bots') {
    const need = 1 - selected.length;
    btn.textContent = need > 0
      ? 'CHOOSE YOUR MONSTER'
      : `BEGIN RAMPAGE ▶  VS ${count - 1} BOT${count > 2 ? 'S' : ''}`;
    btn.disabled = need > 0;
    if (hint) hint.innerHTML = 'You control one titan — the rest are CPU monsters.<br/>Shake your phone (or tap) to roll the dice.';
  } else {
    const left = count - selected.length;
    btn.textContent = left > 0 ? `SELECT ${left} MORE MONSTER${left > 1 ? 'S' : ''}` : 'BEGIN RAMPAGE ▶';
    btn.disabled = left > 0;
    if (hint) hint.innerHTML = 'Tap monsters in seat order. First player is drawn at random.<br/>Shake your phone (or tap) to roll the dice.';
  }
}

$('btnMinus').onclick = () => { count = Math.max(2, count - 1); selected = mode === 'bots' ? selected.slice(0, 1) : selected.slice(0, count); renderGrid(); updateStart(); };
$('btnPlus').onclick = () => { count = Math.min(6, count + 1); renderGrid(); updateStart(); };

document.querySelectorAll('#modeToggle .mode-btn').forEach((b) => {
  b.onclick = () => {
    mode = b.dataset.mode;
    document.querySelectorAll('#modeToggle .mode-btn').forEach((x) => x.classList.toggle('active', x === b));
    if (mode === 'bots') selected = selected.slice(0, 1);
    renderGrid(); updateStart();
  };
});

// dice style: gravity physics vs faces that appear & change in place
const diceMode = localStorage.getItem('mc-dice') || 'gravity';
document.querySelectorAll('#diceToggle .mode-btn').forEach((b) => {
  b.classList.toggle('active', b.dataset.dice === diceMode);
  b.onclick = () => {
    localStorage.setItem('mc-dice', b.dataset.dice);
    document.querySelectorAll('#diceToggle .mode-btn').forEach((x) => x.classList.toggle('active', x === b));
  };
});

mountArt($('setupLogo'), art, 'logo');
$('setupLogo').innerHTML = '<span class="seal-king">王</span>';
renderGrid();
updateStart();

// PWA — installable + offline shell (network-first, cache fallback)
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline/dev: ignore */ });
}

// ── game ───────────────────────────────────────────────────────────────────
$('btnStart').onclick = async () => {
  if (mode === 'bots' ? selected.length !== 1 : selected.length !== count) return;

  const game = new Game(data, {
    onChange: () => ui.render(),
    log: () => ui.renderTicker(),
    stage: (name, ctx) => ui.stage(name, ctx),
    promptYield: async ({ victim, attacker, zone }) => {
      if (victim.bot) {
        await new Promise((r) => setTimeout(r, 650));   // let the hit breathe
        return victim.hp <= 4;                          // CPU flees when badly hurt
      }
      return ui.modal({
        title: `${attacker.name} attacks!`,
        body: `${victim.name} holds <b>${zone.name}</b>. Yield the district? You take the damage either way — but ${attacker.name} would move in (+1 VP for them).`,
        actions: [
          { label: `Stay in ${zone.short}`, value: false },
          { label: `Yield ${zone.short} → attacker enters`, value: true, class: 'btn-danger' },
        ],
      });
    },
    promptVacancy: ({ player, vacant }) => {
      if (player.bot) return vacant[0];                 // CPU takes the first-choice district
      return ui.modal({
        title: 'Tokyo lies open',
        body: `${player.name} roared into empty streets — choose a district to occupy. (+1 VP)`,
        actions: vacant.map((z) => {
          const d = game.defs.zones.districts.find((x) => x.id === z);
          return { label: `${d.emoji} ${d.name}`, value: z };
        }),
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
    const pool = data.monsters.monsters.map((m) => m.id).filter((x) => x !== ids[0]);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    ids = ids.concat(pool.slice(0, count - 1));
    botSeats = ids.map((_, i) => i).slice(1);   // seat 0 = human, rest = CPU
  }
  game.start(ids, { botSeats });
  ui.render();

  // try to arm shake-to-roll (user gesture context); UI keeps working on tap
  const res = await shake.enable();
  if (res.ok) ui.render();
};

updateStart();
