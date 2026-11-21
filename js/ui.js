// Game screen rendering + interaction. Pure DOM, no framework.
import { FACE_GLYPH } from './engine.js';
import { mountArt } from './data.js?v=2';
import { icon } from './icons.js';
import { portrait } from './portrait.js';
import { sfx } from './sfx.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function createUI(game) {
  const els = {
    chip: $('turnChip'), ticker: $('ticker'), map: $('map'), players: $('players'),
    mapTip: $('mapTip'), announce: $('announceWrap'),
    abilities: $('abilities'), diceStage: $('diceStage'), diceFaces: $('diceFaces'),
    diceHint: $('diceHint'),
    primary: $('btnPrimary'),
    secondary: $('btnSecondary'), shopBtn: $('btnShop'),
    backdrop: $('backdrop'), modal: $('modal'), win: $('winOverlay'),
    sheetShop: $('sheetShop'), sheetLog: $('sheetLog'), sheetRules: $('sheetRules'),
    cardList: $('cardList'), shopEnergy: $('shopEnergy'), shopNote: $('shopNote'),
    sweep: $('btnSweep'), logList: $('logList'), rulesBody: $('rulesBody'),
  };
  // static map scaffold: base drawing + persistent fx layer (beams survive re-renders)
  els.map.innerHTML = '<svg class="tokyo-svg" id="mapBase" viewBox="0 0 460 260" shape-rendering="crispEdges"></svg><svg class="map-fx" id="mapFx" viewBox="0 0 460 260"></svg>';
  els.mapBase = $('mapBase');
  els.mapFx = $('mapFx');

  /** Emoji → monochrome ink glyphs (text-presentation selector). */
  const inkify = (t) => String(t || '').replace(/❤️|❤|⭐|⚡|🐾|💚|👑|💀|🏯|➤/g, (m) => m + '\uFE0E');

  let art = {};
  let rolling = false;
  let animating = false;
  let armed = null;             // pending set-die ability
  let openSheet = null;
  let shakeApi = null;          // {toggle, enabled}
  let stageFaces = null;        // faces highlighted during staged resolve
  let bot = null;               // CPU controller (js/bot.js)
  let selectedZone = null;      // map tip toggling
  const prevStats = {};         // seat → {hp, vp, en, alive} for pickup badges

  // ── overlay helpers ──────────────────────────────────────────────────────
  function modal({ title, body, actions, row = false }) {
    return new Promise((resolve) => {
      els.modal.innerHTML = `
        <div class="modal-card">
          <h3>${title}</h3>
          ${body ? `<p>${body}</p>` : ''}
          <div class="modal-actions ${row ? 'row' : ''}">
            ${actions.map((a, i) => `<button class="${a.class || 'btn-ghost'}" data-i="${i}">${a.label}</button>`).join('')}
          </div>
        </div>`;
      els.modal.classList.remove('hidden');
      els.modal.querySelectorAll('button').forEach((b) => {
        b.onclick = () => {
          els.modal.classList.add('hidden');
          els.modal.innerHTML = '';
          resolve(actions[+b.dataset.i].value);
        };
      });
    });
  }
  const modalOpen = () => !els.modal.classList.contains('hidden');

  function openSheetById(id) {
    closeSheets();
    openSheet = id;
    els.backdrop.classList.remove('hidden');
    $(`sheet${id[0].toUpperCase()}${id.slice(1)}`).classList.remove('hidden');
    if (id === 'shop') { game.state.shopAutoOpened = false; renderShop(); }
    if (id === 'log') renderLog();
    if (id === 'rules') renderRules();
  }
  function closeSheets() {
    openSheet = null;
    els.backdrop.classList.add('hidden');
    ['sheetShop', 'sheetLog', 'sheetRules'].forEach((k) => $(k).classList.add('hidden'));
  }
  els.backdrop.onclick = closeSheets;
  document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = closeSheets));
  $('btnShop').onclick = () => (openSheet === 'shop' ? closeSheets() : openSheetById('shop'));
  $('btnLog').onclick = () => (openSheet === 'log' ? closeSheets() : openSheetById('log'));
  $('btnRules').onclick = () => (openSheet === 'rules' ? closeSheets() : openSheetById('rules'));

  // ── main render ──────────────────────────────────────────────────────────
  function render() {
    const s = game.state;
    if (!s) return;
    if (armed && s.phase !== 'rolled') armed = null;
    renderChip();
    renderMap();
    renderPlayers();
    renderDice();
    renderAbilities();
    renderActions();
    if (s.phase === 'buying') clearBeams();
    if (openSheet === 'shop') renderShop();
    if (openSheet === 'log') renderLog();

    renderWin();
    bot?.maybeAct();   // CPU takes over its turn here (never auto-opens the shop)
  }

  function phaseText(p) {
    const s = game.state;
    const sh = shakeApi?.enabled ? ' · shake' : '';
    switch (s.phase) {
      case 'awaitRoll': return p.zone != null ? `in ${game.district(p.zone).short} · tap to roll${sh}` : `tap to roll${sh}`;
      case 'rolled': return s.rerollsLeft > 0 ? `tap dice to keep · ${s.rerollsLeft} reroll${s.rerollsLeft > 1 ? 's' : ''} left` : 'dice locked in · resolve';
      case 'resolving': return 'the city trembles…';
      case 'buying': return game.canShop(p) ? 'trade energy for cards, or end turn' : 'sheltering — cannot buy cards';
      case 'ending': return '…';
      case 'over': return 'the game is over';
      default: return '';
    }
  }

  function renderChip() {
    const p = game.me();
    els.chip.style.setProperty('--tc', p.color);
    els.chip.innerHTML = `
      <div class="t-portrait">${portrait(p, 34)}</div>
      <div class="t-meta">
        <div class="t-name">${p.name}'s turn</div>
        <div class="t-phase">${phaseText(p)}</div>
      </div>`;
    mountArt(els.chip.querySelector('.t-portrait'), art, `monster_${p.monsterId}`);
  }

  function renderTicker() {
    const s = game.state;
    els.ticker.textContent = inkify(s.lastEvent || '');
    els.ticker.classList.add('hot');
    clearTimeout(renderTicker._t);
    renderTicker._t = setTimeout(() => els.ticker.classList.remove('hot'), 1400);
  }

  // ── TOKYO MAP (static ink illustration — no tiles, no network) ────────────
  // Five evenly-spread spots: four district seals around a central palace,
  // outsiders camped at the edge. Exaggerated spacing — a board, not a survey.
  const SPOTS = {
    shinjuku: { x: 110, y: 68, kanji: '宿' },
    city: { x: 345, y: 62, kanji: '京' },
    palace: { x: 230, y: 126, kanji: '居' },
    bay: { x: 362, y: 198, kanji: '港' },
    outskirts: { x: 88, y: 198, kanji: '野' },
  };

  function tokenSVG(p, x, y) {
    const src = art[`monster_${p.monsterId}`]?.src || '';
    const id = `tkclip${p.seat}`;
    return `<g class="spot-token" transform="translate(${x},${y})">
      <defs><clipPath id="${id}"><circle cx="0" cy="0" r="14"/></clipPath></defs>
      <circle r="15.5" fill="#f8f1e1" stroke="${p.color}" stroke-width="2.5"/>
      ${src
        ? `<image href="${src}" x="-14" y="-14" width="28" height="28" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`
        : `<text y="5" text-anchor="middle" class="tok-init">${p.name.charAt(0)}</text>`}
      <title>${p.name}</title>
    </g>`;
  }

  function districtSpot(s, d) {
    const sp = SPOTS[d.id];
    const locked = !s.zonesActive.includes(d.id);
    const occ = game.occupant(d.id);
    return `<g class="spot ${locked ? 'locked' : ''}" data-zone="${d.id}">
      <circle class="stamp ${locked ? 'locked' : ''}" cx="${sp.x}" cy="${sp.y}" r="23"/>
      <text class="stamp-k" x="${sp.x}" y="${sp.y + 7}">${sp.kanji}</text>
      <text class="spot-lab" x="${sp.x}" y="${sp.y + 42}">${d.short}</text>
      ${locked ? `<text class="spot-lock" x="${sp.x}" y="${sp.y + 54}">LOCKED</text>` : ''}
      ${occ ? tokenSVG(occ, sp.x + 44, sp.y - 14) : ''}
    </g>`;
  }

  function outskirtsSpot(camps) {
    const sp = SPOTS.outskirts;
    const tokens = camps.map((p, i) => tokenSVG(p, sp.x + 42 + i * 34, sp.y - 10)).join('');
    return `<g class="spot" data-zone="outskirts">
      <circle class="stamp" cx="${sp.x}" cy="${sp.y}" r="20"/>
      <text class="stamp-k" x="${sp.x}" y="${sp.y + 6}">${sp.kanji}</text>
      <text class="spot-lab" x="${sp.x}" y="${sp.y + 38}">OUTSKIRTS</text>
      ${tokens}
    </g>`;
  }

  function mapSVG() {
    const s = game.state;
    const camps = game.alive().filter((x) => x.zone == null);
    return `<svg class="tokyo-svg" viewBox="0 0 460 260" shape-rendering="crispEdges">
      <path class="sea" d="M410 0 H460 V260 H376 L382 214 L390 164 L396 114 L402 62 Z"/>
      <path class="sea-line" d="M420 62 h24 M428 112 h24 M416 162 h24 M424 212 h24"/>
      <g>
        <line class="spot-road" x1="230" y1="126" x2="110" y2="68"/>
        <line class="spot-road" x1="230" y1="126" x2="345" y2="62"/>
        <line class="spot-road" x1="230" y1="126" x2="362" y2="198"/>
        <line class="spot-road" x1="230" y1="126" x2="88" y2="198"/>
      </g>
      ${game.defs.zones.districts.map((d) => districtSpot(s, d)).join('')}
      ${outskirtsSpot(camps)}
    </svg>`;
  }

  function renderMap() {
    els.mapBase.innerHTML = mapSVG();
    els.mapBase.querySelectorAll('.spot').forEach((g) => {
      g.addEventListener('click', () => showTip(g.dataset.zone));
    });
  }

  function showTip(id) {
    if (selectedZone === id) { selectedZone = null; els.mapTip.classList.add('hidden'); return; }
    selectedZone = id;
    els.mapTip.classList.remove('hidden');
    if (id === 'outskirts') {
      els.mapTip.innerHTML = `<b>Outskirts — outside Tokyo</b><span class="tip-perk">✦ Your attacks strike every district; after a strike you must claim an open one (+1 VP).</span>`;
      return;
    }
    const d = game.district(id);
    const locked = !game.state.zonesActive.includes(id);
    els.mapTip.innerHTML = `<b>${d.name}</b>${locked ? ' · LOCKED' : ''}
      <span class="tip-perk">✦ ${d.perk}</span><span class="tip-draw">✖ ${d.drawback}</span>`;
  }

  function spotAnchor(p) {
    if (p.zone != null) {
      const sp = SPOTS[p.zone];
      return { x: sp.x + 44, y: sp.y - 14 };   // district token position
    }
    const outs = game.alive().filter((x) => x.zone == null);
    const i = Math.max(0, outs.findIndex((x) => x.seat === p.seat));
    return { x: SPOTS.outskirts.x + 42 + i * 34, y: SPOTS.outskirts.y - 10 };
  }

  function flashRegion(id) {
    const g = els.mapBase.querySelector(`.spot[data-zone="${id}"] .stamp`);
    if (!g) return;
    g.classList.add('flash');
    setTimeout(() => g.classList.remove('flash'), 900);
  }

  function drawBeams({ attacker, targets }) {
    const alive = targets.filter((t) => t.alive);
    if (!alive.length) return;
    clearBeams();
    const from = spotAnchor(attacker);
    els.mapFx.innerHTML = alive.map((t) => {
      const to = spotAnchor(t);
      return `<line class="ink-beam" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${attacker.color}" stroke-width="3.5"/>`;
    }).join('');
    setTimeout(clearBeams, 1500);
  }

  function clearBeams() {
    if (els.mapFx) els.mapFx.innerHTML = '';
  }

  // ── announcements & pickup badges ─────────────────────────────────────────
  function announce(html, tone = 'gold') {
    const el = document.createElement('div');
    el.className = `announce ${tone}`;
    el.innerHTML = html;
    els.announce.replaceChildren(el);
    setTimeout(() => { if (el.parentNode === els.announce) el.remove(); }, 1000);
  }

  function floatBadge(seat, html, cls) {
    const card = $(`card-${seat}`);
    if (!card) return;
    const b = document.createElement('div');
    b.className = `pc-badge ${cls}`;
    b.innerHTML = html;
    card.appendChild(b);
    setTimeout(() => b.remove(), 1150);
  }

  function hitShake(seat) {
    const card = $(`card-${seat}`);
    if (!card) return;
    card.classList.remove('hit');
    void card.offsetWidth;
    card.classList.add('hit');
    const app = $('app');
    app.classList.remove('pulse');
    void app.offsetWidth;
    app.classList.add('pulse');
  }

  function checkDiffs(s) {
    for (const p of s.players) {
      const prev = prevStats[p.seat];
      if (prev) {
        if (!p.alive && prev.alive) { sfx.ko(); announce(`${p.name} FALLS`, 'red'); }
        if (p.vp > prev.vp) floatBadge(p.seat, `+${p.vp - prev.vp}${icon('star', 12, { filled: true })}`, 'gold');
        else if (p.vp < prev.vp) floatBadge(p.seat, `-${prev.vp - p.vp}${icon('star', 12, { filled: true })}`, 'dim');
        if (p.energy > prev.en) floatBadge(p.seat, `+${p.energy - prev.en}${icon('zap', 13)}`, 'cyan');
        if (p.hp > prev.hp) floatBadge(p.seat, `+${p.hp - prev.hp}${icon('heart', 12, { filled: true })}`, 'green');
        else if (p.hp < prev.hp) { floatBadge(p.seat, `-${prev.hp - p.hp}${icon('heart', 12, { filled: true })}`, 'red'); hitShake(p.seat); }
      }
      prevStats[p.seat] = { hp: p.hp, vp: p.vp, en: p.energy, alive: p.alive };
    }
  }

  // ── player cards ──────────────────────────────────────────────────────────
  function renderPlayers() {
    const s = game.state;
    els.players.innerHTML = s.players.map((p) => {
      const zone = p.zone != null ? game.district(p.zone) : null;
      const pips = Array.from({ length: p.maxHp }, (_, i) =>
        `<span class="hpip ${i < p.hp ? 'on' : ''}">${icon('heart', 10, { filled: i < p.hp })}</span>`).join('');
      const st = [
        p.bot ? '<span class="pc-st bot">CPU</span>' : '',
        p.statuses.poison ? `<span class="pc-st tox">TOX${p.statuses.poison}</span>` : '',
        p.statuses.shrink ? `<span class="pc-st sm">SM${p.statuses.shrink}</span>` : '',
        p.shield ? '<span class="pc-st wing">WING</span>' : '',
        p.cards.length ? `<span class="pc-st cards">C×${p.cards.length}</span>` : '',
      ].join('');
      const myTurn = p.alive && p.seat === s.turn;
      return `
      <div class="p-card ${myTurn ? 'active' : ''} ${p.alive ? '' : 'dead'}" id="card-${p.seat}" style="--pc:${p.color}">
        <div class="pc-name">${p.name}</div>
        <div class="pc-pic" data-seat="${p.seat}" title="tap to see cards">
          <span class="pc-sprite">${portrait(p, 44)}</span>
          ${p.cards.length ? `<span class="pc-deck">🃏×${p.cards.length}</span>` : ''}
          ${p.alive ? '' : `<span class="pc-ko">${icon('skull', 15)}</span>`}
          ${myTurn ? '<span class="pc-go">GO</span>' : ''}
        </div>
        <div class="pc-body">
          <div class="pc-hearts">${pips}</div>
          <div class="pc-stats">
            <span class="pc-vp">${icon('star', 15, { filled: true })}${p.vp}</span>
            <span class="pc-en">${icon('zap', 17)}${p.energy}</span>
            ${zone ? `<span class="pc-zone">${zone.short}</span>` : '<span class="pc-zone out">OUT</span>'}
          </div>
          ${st ? `<div class="pc-sts">${st}</div>` : ''}
        </div>
      </div>`;
    }).join('');
    const n = s.players.length;
    const cols = n === 2 ? 2 : n === 4 ? 4 : 3;   // vertical cards: 4 abreast fits a phone
    els.players.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    els.players.style.setProperty('--pic', `${n === 2 ? 128 : n === 4 ? 62 : n === 3 ? 84 : 48}px`);
    [...els.players.querySelectorAll('.pc-sprite')].forEach((el, i) => mountArt(el, art, `monster_${s.players[i].monsterId}`));
    els.players.querySelectorAll('.pc-pic').forEach((el) => {
      el.onclick = () => showDeck(+el.dataset.seat);
    });
    checkDiffs(s);
  }

  /** Tap a character portrait → see exactly which cards that player owns. */
  function showDeck(seat) {
    const p = game.state.players[seat];
    const owned = p.cards || [];
    const body = owned.length
      ? owned.map((c) => {
          const def = c.def || game.cardById[c.id];
          if (!def) return '';
          return `<span class="deck-row"><span class="c-name">${def.name}</span><span class="c-text">${def.text}</span></span>`;
        }).join('')
      : '<span class="deck-empty">No cards yet — buy some in the Card Market.</span>';
    modal({ title: `${p.name} · CARDS ×${owned.length}`, body, actions: [{ label: 'CLOSE', value: 0 }] });
  }

  function faceClass(f) { return f ? `f-${f}` : ''; }

  function renderDice() {
    const s = game.state, p = game.me();
    const n = s.dice.length || game.diceCount(p);
    const hint = diceHint(s);
    const DIE_FACE = (f) => (f === 'energy' ? icon('zap', 21) : f === 'attack' ? icon('paw', 23) : f === 'heal' ? icon('heart', 21, { filled: true }) : FACE_GLYPH[f]);
    const toneOf = (f) => (['1', '2', '3'].includes(f) ? 'gold' : f === 'energy' ? 'cyan' : f === 'attack' ? 'red' : 'green');
    let html = '';
    for (let i = 0; i < n; i++) {
      const f = s.dice[i];
      const glyph = rolling && !f ? '?' : (f ? DIE_FACE(f) : '?');
      const kept = s.phase !== 'awaitRoll' && s.keep[i];
      const armedStyle = armed ? ' armed' : '';
      const glow = stageFaces == null ? '' : (stageFaces === 'all' || stageFaces.has(f)) ? ` glow g-${stageFaces === 'all' ? 'all' : toneOf(f)}` : '';
      const cls = [faceClass(f), rolling ? 'rolling' : '', kept ? 'kept' : '', armedStyle, glow].join(' ');
      html += `<button class="die ${cls}" data-i="${i}">${glyph}</button>`;
    }
    els.diceFaces.innerHTML = html;
    els.diceHint.textContent = hint;
    els.diceFaces.querySelectorAll('.die').forEach((el) => {
      el.onclick = () => onDieTap(+el.dataset.i);
    });
  }

  function diceHint(s) {
    if (s.phase === 'rolled') {
      return armed ? 'tap a die to shape it' : (shakeApi?.enabled ? 'tap a die to keep · shake the phone' : 'tap a die to keep');
    }
    if (s.phase === 'awaitRoll') return shakeApi?.enabled ? 'SHAKE or tap ROLL' : 'tap ROLL to throw the dice';
    return '';
  }

  function onDieTap(i) {
    const s = game.state;
    if (armed) { resolveArmed(i); return; }
    if (s.phase === 'rolled') { game.toggleKeep(i); sfx.keep(); }
  }

  async function resolveArmed(dieIndex) {
    const ab = armed;
    let face = ab.inst.def.hooks.setDie.face;
    if (face === 'any') {
      face = await modal({
        title: 'Shape the die',
        body: 'Choose the face:',
        row: true,
        actions: ['1', '2', '3', 'energy', 'attack', 'heal'].map((f) => ({
          label: f === 'energy' ? icon('zap', 22)
            : f === 'attack' ? icon('paw', 24)
            : f === 'heal' ? icon('heart', 22, { filled: true })
            : `<span style="font-family:var(--font-display);font-size:20px">${FACE_GLYPH[f]}</span>`,
          value: f,
        })),
      });
      if (!face) return; // dismissed
    } else {
      face = String(face);
    }
    armed = null;
    game.useAbility(ab, { dieIndex, face });
    render();
  }

  function renderAbilities() {
    const p = game.me();
    const list = game.abilities(p);
    els.abilities.innerHTML = list.map((ab, i) =>
      `<button class="ab-btn ${armed && armed.inst === ab.inst ? 'armed' : ''}" data-i="${i}">${inkify(ab.label)}</button>`).join('');
    els.abilities.querySelectorAll('.ab-btn').forEach((el) => {
      el.onclick = () => {
        const ab = list[+el.dataset.i];
        if (ab.key === 'setDie') { armed = armed && armed.inst === ab.inst ? null : ab; render(); }
        else { game.useAbility(ab); render(); }
      };
    });
  }

  function renderActions() {
    const s = game.state;
    const b = els.primary, sec = els.secondary;
    b.disabled = false;
    els.shopBtn.classList.add('hidden');
    sec.classList.add('hidden');
    switch (s.phase) {
      case 'awaitRoll': b.textContent = 'ROLL'; break;
      case 'rolled':
        if (s.rerollsLeft > 0) { b.textContent = `REROLL (${s.rerollsLeft})`; sec.textContent = '✓ Resolve now'; sec.classList.remove('hidden'); }
        else b.textContent = '✓ RESOLVE';
        break;
      case 'resolving': b.textContent = '…'; b.disabled = true; break;
      case 'buying': b.textContent = 'END TURN ➜'; els.shopBtn.classList.remove('hidden'); break;
      case 'ending': b.textContent = '…'; b.disabled = true; break;
      case 'over': b.textContent = 'GAME OVER'; b.disabled = true; break;
    }
    b.onclick = primary;
    sec.onclick = async () => { if (game.state.phase === 'rolled') { b.disabled = true; await game.resolve(); render(); } };
  }

  // ── actions ──────────────────────────────────────────────────────────────
  async function animateRoll() {
    rolling = true; sfx.roll();
    render();
    await sleep(430);
    return () => { rolling = false; };
  }

  async function primary() {
    const s = game.state;
    if (!s || s.winner != null || modalOpen() || animating) return;
    if (s.phase === 'awaitRoll') {
      animating = true;
      const done = await animateRoll();
      game.roll();
      done(); animating = false; render();
    } else if (s.phase === 'rolled') {
      if (s.rerollsLeft > 0) {
        animating = true;
        const done = await animateRoll();
        game.reroll();
        done(); animating = false; render();
      } else {
        els.primary.disabled = true;
        await game.resolve();
        render();
      }
    } else if (s.phase === 'buying') {
      await game.endTurn();
      closeSheets();
      render();
    }
  }

  /** Visual roll/reroll used by bots — same animation as the human buttons. */
  async function rollVisual() {
    if (game.state.phase !== 'awaitRoll') return;
    const done = await animateRoll();
    game.roll();
    done(); render();
  }
  async function rerollVisual() {
    if (game.state.phase !== 'rolled' || game.state.rerollsLeft <= 0) return;
    const done = await animateRoll();
    game.reroll();
    done(); render();
  }

  /** Shake handler — same as the primary button, but only when safe. */
  function onShake() {
    const s = game.state;
    if (!s || s.winner != null || modalOpen() || openSheet) return;
    if (s.phase === 'awaitRoll' || (s.phase === 'rolled' && s.rerollsLeft > 0)) primary();
  }

  // ── staged resolve choreography ─────────────────────────────────────────
  function setFlavor(text) {
    const el = els.chip.querySelector('.t-phase');
    if (el) el.textContent = text;
  }

  function bestTriple(dice) {
    let best = null;
    for (const f of ['1', '2', '3']) {
      const count = dice.filter((d) => d === f).length;
      if (count >= 3 && (!best || Number(f) > Number(best.face))) best = { face: f, count };
    }
    return best;
  }

  function setStageGlow(set) {
    stageFaces = set;
    renderDice();
  }

  async function stage(name, ctx = {}) {
    try {
      switch (name) {
        case 'reveal':
          setStageGlow('all'); sfx.roll(); setFlavor('the dice clatter…');
          await sleep(550);
          break;
        case 'score': {
          setStageGlow(new Set(['1', '2', '3']));
          const tri = bestTriple(ctx.dice || game.state.dice);
          if (tri) {
            const gain = Number(tri.face) + (tri.count - 3);
            announce(`TRIPLE ${tri.face}×${tri.count}&nbsp;&nbsp;<b>+${gain}</b> ★`, 'gold');
            sfx.score(); setFlavor('scoring glory…');
            await sleep(1000);
          } else { setFlavor('no triples…'); await sleep(320); }
          break;
        }
        case 'energy':
          setStageGlow(new Set(['energy']));
          announce(`${icon('zap', 22)} ENERGY&nbsp;&nbsp;<b>+${ctx.n}</b>`, 'cyan');
          sfx.energy(); setFlavor('energy crackles');
          await sleep(700);
          break;
        case 'attack':
          setStageGlow(new Set(['attack']));
          announce(`${icon('paw', 26)} ${ctx.auto ? 'ACID SPRAY!' : `${ctx.n} CLAW${ctx.n > 1 ? 'S' : ''}!`}`, 'red');
          sfx.windup(); setFlavor('incoming attack!');
          await sleep(750);
          break;
        case 'strike':
          drawBeams(ctx); sfx.windup();
          await sleep(900);
          break;
        case 'hit':
          hitShake(ctx.victim.seat); sfx.hit();
          await sleep(500);
          break;
        case 'capture':
          flashRegion(ctx.zoneId);
          announce(`CLAIMED ${game.district(ctx.zoneId).short.toUpperCase()}&nbsp;&nbsp;<b>+1</b> ★`, 'gold');
          sfx.capture();
          await sleep(1100);
          break;
        case 'heal':
          setStageGlow(new Set(['heal']));
          announce(`${icon('heart', 22, { filled: true })} REGEN&nbsp;&nbsp;<b>+${ctx.n}</b>`, 'green');
          sfx.heal(); setFlavor('mending…');
          await sleep(700);
          break;
        default:
          await sleep(150);
      }
    } catch { /* never block the engine */ }
    setStageGlow(null);
  }

  // ── shop ─────────────────────────────────────────────────────────────────
  function renderShop() {
    const s = game.state, p = game.me();
    els.shopEnergy.innerHTML = `${icon('zap', 15)} ${p.energy}`;
    const blocked = !game.canShop(p);
    const disc = p.mods.cardDiscount ? ` · −${p.mods.cardDiscount} Energy discount` : '';
    const bay = p.zone != null && game.district(p.zone).hooks?.cardCostExtra ? ` · +${game.district(p.zone).hooks.cardCostExtra} Energy dock fee` : '';
    els.shopNote.textContent = blocked
      ? 'The Palace shelters you — purchasing is forbidden.'
      : `Pay in energy · tap to buy${disc}${bay}`;
    els.cardList.innerHTML = s.shop.map((id, i) => {
      if (!id) return `<div class="card-row"><div class="c-cost">—</div><div class="c-main"><div class="c-name">Deck spent</div></div></div>`;
      const def = game.cardById[id];
      const cost = game.cardCost(p, def);
      const can = !blocked && s.phase === 'buying' && p.energy >= cost;
      return `
      <button class="card-row ${def.type} ${can ? '' : 'cant'}" data-i="${i}" ${can ? '' : 'disabled'}>
        <div class="c-art" data-card="${def.id}"></div>
        <div class="c-cost">${cost}</div>
        <div class="c-main">
          <div class="c-top"><span class="c-name">${def.name}</span><span class="c-type ${def.type}">${def.type.toUpperCase()}</span></div>
          <div class="c-text">${def.text}</div>

        </div>
      </button>`;
    }).join('');
    els.cardList.querySelectorAll('.c-art').forEach((el) => mountArt(el, art, `card_${el.dataset.card}`));
    els.cardList.querySelectorAll('.card-row:not([disabled])').forEach((el) => {
      el.onclick = async () => { const ok = await game.buy(+el.dataset.i); if (ok) sfx.buy(); render(); };
    });
    els.sweep.disabled = blocked || p.energy < 2 || s.phase !== 'buying';
    els.sweep.style.opacity = els.sweep.disabled ? .45 : 1;
    els.sweep.onclick = async () => { if (await game.sweep()) sfx.buy(); render(); };
  }

  function renderLog() {
    const lines = game.state.log.slice(-60).reverse();
    els.logList.innerHTML = lines.map((l) => `<div class="log-line">${inkify(l)}</div>`).join('');
  }

  function renderRules() {
    const s = game.state;
    const zones = game.defs.zones.districts.map((d) => {
      const locked = !s.zonesActive.includes(d.id);
      return `<div class="rule-zone" style="--zc:${d.color}">
        <b>${d.name}</b> ${locked ? '· LOCKED (needs more players)' : ''}
        <div class="z-perk">✦ ${d.perk}</div><div class="z-draw">✖ ${d.drawback}</div>
      </div>`;
    }).join('');
    const powers = game.defs.monsters.monsters.map((m) =>
      `<div class="power-line"><b>${m.name}<em>${m.title}</em></b><span>${m.power.text}</span></div>`).join('');
    const shakeRow = shakeApi
      ? `<p style="margin-top:8px"><button class="btn-ghost" id="btnShakeToggle">${icon('phone', 15)} Shake to roll: <b>${shakeApi.enabled ? 'ON' : 'OFF'}</b></button></p>`
      : '';
    const sfxRow = `<p style="margin-top:6px"><button class="btn-ghost" id="btnSfxToggle">${icon(sfx.enabled ? 'volume' : 'mute', 15)} Sound FX: <b>${sfx.enabled ? 'ON' : 'OFF'}</b></button></p>`;
    els.rulesBody.innerHTML = `
      <h3>TURN</h3>
      <ul>
        <li>Roll 6 dice 🎲 — then up to 2 rerolls (tap dice to keep them).</li>
        <li>Resolve: triples score ⭐ · ⚡ = energy · 🐾 attacks · 💚 heals (max 10+❤️).</li>
        <li>Spend energy on cards, then end your turn.</li>
        <li>First to 20⭐ or the last monster standing wins.</li>
      </ul>
      <h3>ATTACKING</h3>
      <ul>
        <li>In a district → your 🐾 hurt everyone outside Tokyo.</li>
        <li>Outside → your 🐾 hurt every district occupant.</li>
        <li>Empty Tokyo? Your first 🐾 claims a district: +1⭐ (no damage).</li>
        <li>Attacked while inside? You may yield your district — damage still lands.</li>
      </ul>
      <h3>DISTRICTS</h3>${zones}
      <h3>MONSTER POWERS</h3>${powers}
      ${shakeRow}${sfxRow}`;
    const st = $('btnShakeToggle');
    if (st) st.onclick = async () => { await shakeApi.toggle(); renderRules(); render(); };
    const snd = $('btnSfxToggle');
    if (snd) snd.onclick = () => { sfx.toggle(); renderRules(); };
  }

  function renderWin() {
    const s = game.state;
    if (s.winner == null) { els.win.classList.add('hidden'); return; }
    if (els.win.dataset.seat === String(s.winner)) return;
    els.win.dataset.seat = String(s.winner);
    const w = s.winner === -1 ? null : s.players[s.winner];
    els.win.innerHTML = `
      <div class="win-card">
        <div class="win-crown">${w ? icon('crown', 52) : icon('skull', 52)}</div>
        <h2>${w ? 'MONSTER CITY' : 'NOBODY SURVIVES'}</h2>
        <div class="win-pic">${w ? portrait(w, 88) : ''}</div>
        <div class="win-monster" style="color:${w ? w.color : 'var(--ink-soft)'}">${w ? `${w.name} · ${w.vp}${icon('star', 15, { filled: true })}` : 'The city is ash. Everybody loses.'}</div>
        <p>${w ? 'All of Tokyo kneels.' : ''}</p>
        <button class="btn-primary" id="btnAgain">PLAY AGAIN</button>
      </div>`;
    els.win.classList.remove('hidden');
    if (w) mountArt(els.win.querySelector('.win-pic'), art, `monster_${w.monsterId}`);
    if (s.winner === -1) sfx.ko(); else sfx.win();
    $('btnAgain').onclick = () => location.reload();
  }

  // ── public ───────────────────────────────────────────────────────────────
  return {
    render,
    renderTicker,
    modal,
    stage,
    rollVisual,
    rerollVisual,
    setBot(b) { bot = b; },
    openSheetById,
    setArt(a) { art = a; },
    setShake(api) { shakeApi = api; },
    onShake,
    get busy() { return modalOpen() || openSheet != null; },
  };
}
