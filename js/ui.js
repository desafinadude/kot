// YOKOZUNA — game screen rendering + interaction. Pure DOM, no framework.
import { POSITION_NAME } from './engine.js';
import { mountArt } from './data.js';
import { icon } from './icons.js';
import { portrait } from './portrait.js';
import { sfx } from './sfx.js';

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const POS_SHORT = { MAIN: 'MAIN', CHALLENGE: 'CHAL', OUTSIDE: 'OUT' };

export function createUI(game) {
  const cfg = game.cfg;
  const els = {
    chip: $('turnChip'), ticker: $('ticker'), map: $('map'), players: $('players'),
    mapTip: $('mapTip'), announce: $('announceWrap'),
    abilities: $('abilities'), diceFaces: $('diceFaces'), diceHint: $('diceHint'),
    primary: $('btnPrimary'), secondary: $('btnSecondary'), shopBtn: $('btnShop'),
    backdrop: $('backdrop'), modal: $('modal'), win: $('winOverlay'),
    cardList: $('cardList'), shopSpirit: $('shopSpirit'), shopNote: $('shopNote'),
    refresh: $('btnRefresh'), logList: $('logList'), rulesBody: $('rulesBody'),
  };
  // dohyō board: base drawing + persistent fx layer (push beams survive re-renders)
  els.map.innerHTML = '<svg class="dohyo-svg" id="mapBase" viewBox="0 0 460 240"></svg><svg class="map-fx" id="mapFx" viewBox="0 0 460 240"></svg>';
  els.mapBase = $('mapBase');
  els.mapFx = $('mapFx');

  /** Emoji → monochrome ink glyphs (text-presentation selector). */
  const inkify = (t) => String(t || '').replace(/❤️|❤|⭐|⚡|✋|💚/g, (m) => m + '︎');
  const charOf = (p) => game.character(p);
  const star = (n = 12) => icon('star', n, { filled: true });

  let art = {};
  let rolling = false;
  let animating = false;
  let armed = null;             // pending single-die active (reroll / convert)
  let openSheet = null;
  let shakeApi = null;
  let stageFaces = null;        // faces highlighted during staged resolve
  let bot = null;
  let selectedSpot = null;
  const prevStats = {};

  // ── overlay helpers ──────────────────────────────────────────────────────
  function modal({ title, body, actions, row = false }) {
    return new Promise((resolve) => {
      els.modal.innerHTML = `
        <div class="modal-card">
          <h3>${title}</h3>
          ${body ? `<div class="modal-body">${body}</div>` : ''}
          <div class="modal-actions ${row ? 'row' : ''}">
            ${actions.map((a, i) => `<button class="${a.class || 'btn-ghost'}" data-i="${i}">${a.label}</button>`).join('')}
          </div>
        </div>`;
      els.modal.classList.remove('hidden');
      els.modal.querySelectorAll('.modal-actions button').forEach((b) => {
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
    if (id === 'shop') renderShop();
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
    if (armed && (s.phase !== 'rolled' || !game.actives().some((a) => a.key === armed.key))) armed = null;
    renderChip();
    renderRing();
    renderPlayers();
    renderDice();
    renderAbilities();
    renderActions();
    if (s.phase === 'buying') clearBeams();
    if (openSheet === 'shop') renderShop();
    if (openSheet === 'log') renderLog();
    renderWin();
    bot?.maybeAct();
  }

  function phaseText(p) {
    const s = game.state;
    const sh = shakeApi?.enabled ? ' · or shake' : '';
    switch (s.phase) {
      case 'awaitRoll': return game.isInside(p) ? `holds the ${POSITION_NAME[p.position]} · tap ROLL${sh}` : `tap ROLL${sh}`;
      case 'rolled': return s.rerollsLeft > 0 ? `tap dice to hold · ${s.rerollsLeft} reroll${s.rerollsLeft > 1 ? 's' : ''} left` : 'dice final · resolve';
      case 'resolving': return 'the bout unfolds…';
      case 'buying': return 'spend Fighting Spirit, or end turn';
      case 'over': return 'the tournament is over';
      default: return '…';
    }
  }

  function promoStrip(prestige) {
    const target = cfg.prestige_to_win;
    const pct = Math.min(100, (prestige / target) * 100);
    const ticks = cfg.rank_thresholds.filter((t) => t.at > 0 && t.at < target)
      .map((t) => `<i style="left:${(t.at / target) * 100}%"></i>`).join('');
    return `<div class="promo" title="${prestige}/${target} Prestige"><b style="width:${pct}%"></b>${ticks}</div>`;
  }

  function renderChip() {
    const p = game.me(), c = charOf(p);
    els.chip.style.setProperty('--tc', p.color);
    els.chip.innerHTML = `
      <div class="t-portrait">${portrait(c, 36)}</div>
      <div class="t-meta">
        <div class="t-name">${p.name} <span class="t-rank">${game.rank(p)}</span></div>
        <div class="t-power"><b>${c.ability_name}</b> · ${c.ability}</div>
        <div class="t-phase">${phaseText(p)}</div>
        ${promoStrip(p.prestige)}
      </div>`;
    mountArt(els.chip.querySelector('.t-portrait'), art, `char_${p.rikishiId}`);
    els.chip.onclick = () => showPlayer(p.seat);
  }

  function renderTicker() {
    els.ticker.textContent = inkify(game.state.lastEvent || '');
    els.ticker.classList.add('hot');
    clearTimeout(renderTicker._t);
    renderTicker._t = setTimeout(() => els.ticker.classList.remove('hot'), 1400);
  }

  // ── DOHYŌ BOARD (static ink illustration) ─────────────────────────────────
  const RING = { x: 230, y: 104, r: 80 };
  function posXY(pos) {
    if (!game.state.challengeActive) return { x: RING.x, y: RING.y };
    return pos === 'MAIN' ? { x: RING.x - 40, y: RING.y } : { x: RING.x + 40, y: RING.y };
  }
  function outsideXY(i, n) {
    const gap = Math.min(52, 400 / Math.max(1, n));
    return { x: RING.x + (i - (n - 1) / 2) * gap, y: 214 };
  }

  function tokenSVG(p, x, y, r = 17) {
    const src = art[`char_${p.rikishiId}`]?.src || '';
    const id = `tk${p.seat}`;
    return `<g class="spot-token" transform="translate(${x},${y})">
      <defs><clipPath id="${id}"><circle cx="0" cy="0" r="${r - 1.5}"/></clipPath></defs>
      <circle r="${r + 1.5}" fill="#f8f1e1" stroke="${p.color}" stroke-width="3"/>
      ${src
        ? `<image href="${src}" x="${-r}" y="${-r * 0.75}" width="${r * 2}" height="${r * 3}" clip-path="url(#${id})" preserveAspectRatio="xMidYMin slice"/>`
        : `<text y="5" text-anchor="middle" class="tok-init">${p.name.charAt(0)}</text>`}
      <title>${p.name}</title>
    </g>`;
  }

  function positionSpot(pos) {
    const { x, y } = posXY(pos);
    const occ = game.occupant(pos);
    const kanji = pos === 'MAIN' ? '本' : '挑';
    return `<g class="spot" data-spot="${pos}">
      <circle class="pos-ring ${occ ? 'held' : ''}" cx="${x}" cy="${y}" r="27" ${occ ? `style="stroke:${occ.color}"` : ''}/>
      ${occ ? tokenSVG(occ, x, y, 22) : `<text class="pos-k" x="${x}" y="${y + 8}">${kanji}</text>`}
      <text class="pos-lab" x="${x}" y="${y - 34}">${pos === 'MAIN' ? 'MAIN' : 'CHALLENGE'}</text>
      <text class="pos-bonus" x="${x}" y="${y + 43}">${occ ? `+${cfg.ring_start_turn_prestige}★/turn` : `+${cfg.ring_entry_prestige}★ entry`}</text>
    </g>`;
  }

  function ringSVG() {
    const s = game.state;
    const outs = game.alive().filter((p) => !game.isInside(p));
    const { x, y, r } = RING;
    return `
      <rect class="mound" x="${x - r - 34}" y="${y - r - 18}" width="${(r + 34) * 2}" height="${(r + 18) * 2}" rx="6"/>
      <circle class="clay" cx="${x}" cy="${y}" r="${r}"/>
      <circle class="tawara" cx="${x}" cy="${y}" r="${r}"/>
      <circle class="tawara-in" cx="${x}" cy="${y}" r="${r - 6}"/>
      <path class="shikiri" d="M${x - 9} ${y + 22} v10 M${x + 9} ${y + 22} v10" />
      ${positionSpot('MAIN')}
      ${s.challengeActive ? positionSpot('CHALLENGE') : ''}
      <g class="spot" data-spot="OUTSIDE">
        <text class="out-lab" x="18" y="${214 + 4}">OUTSIDE</text>
        ${outs.map((p, i) => { const o = outsideXY(i, outs.length); return tokenSVG(p, o.x, o.y); }).join('')}
      </g>`;
  }

  function renderRing() {
    els.mapBase.innerHTML = ringSVG();
    els.mapBase.querySelectorAll('.spot').forEach((g) => g.addEventListener('click', () => showTip(g.dataset.spot)));
  }

  function showTip(id) {
    if (selectedSpot === id) { selectedSpot = null; els.mapTip.classList.add('hidden'); return; }
    selectedSpot = id;
    els.mapTip.classList.remove('hidden');
    if (id === 'OUTSIDE') {
      els.mapTip.innerHTML = `<b>Outside the dohyō</b><span class="tip-perk">✦ Recovery dice heal you · your Push hits every wrestler inside, then you must take an open position (+1★).</span>`;
      return;
    }
    const occ = game.occupant(id);
    els.mapTip.innerHTML = `<b>${POSITION_NAME[id]}</b>${occ ? ` · held by ${occ.name}` : ' · empty'}
      <span class="tip-perk">✦ +2★ at the start of each of your turns · +1★ when you enter · your Push hits everyone outside.</span>
      <span class="tip-draw">✖ Recovery dice do nothing in the ring. Hit by Push? You may yield (damage still lands).</span>`;
  }

  function spotAnchor(p) {
    if (game.isInside(p)) return posXY(p.position);
    const outs = game.alive().filter((x) => !game.isInside(x));
    const i = Math.max(0, outs.findIndex((x) => x.seat === p.seat));
    return outsideXY(i, outs.length);
  }

  function flashPos(pos) {
    const g = els.mapBase.querySelector(`.spot[data-spot="${pos}"] .pos-ring`);
    if (!g) return;
    g.classList.add('flash');
    setTimeout(() => g.classList.remove('flash'), 900);
  }

  function drawBeams({ attacker, targets }) {
    const alive = targets.filter((t) => t.alive);
    if (!alive.length) return;
    const from = spotAnchor(attacker);
    els.mapFx.innerHTML = alive.map((t) => {
      const to = spotAnchor(t);
      return `<line class="ink-beam" x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" stroke="${attacker.color}" stroke-width="4"/>`;
    }).join('');
    setTimeout(clearBeams, 1500);
  }
  function clearBeams() { if (els.mapFx) els.mapFx.innerHTML = ''; }

  // ── announcements & pickup badges ─────────────────────────────────────────
  function announce(html, tone = 'gold', ms = 1000) {
    const el = document.createElement('div');
    el.className = `announce ${tone}`;
    el.innerHTML = html;
    els.announce.replaceChildren(el);
    setTimeout(() => { if (el.parentNode === els.announce) el.remove(); }, ms);
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
    card.classList.remove('hit'); void card.offsetWidth; card.classList.add('hit');
    const app = $('app');
    app.classList.remove('pulse'); void app.offsetWidth; app.classList.add('pulse');
  }

  function checkDiffs(s) {
    for (const p of s.players) {
      const prev = prevStats[p.seat];
      if (prev) {
        if (!p.alive && prev.alive) { sfx.ko(); announce(`${p.name} IS OUT`, 'red'); }
        if (p.prestige > prev.pr) floatBadge(p.seat, `+${p.prestige - prev.pr}${star()}`, 'gold');
        if (p.spirit > prev.sp) floatBadge(p.seat, `+${p.spirit - prev.sp}${icon('zap', 13)}`, 'cyan');
        if (p.stamina > prev.hp) floatBadge(p.seat, `+${p.stamina - prev.hp}${icon('heart', 12, { filled: true })}`, 'green');
        else if (p.stamina < prev.hp && p.alive) { floatBadge(p.seat, `-${prev.hp - p.stamina}${icon('heart', 12, { filled: true })}`, 'red'); hitShake(p.seat); }
      }
      prevStats[p.seat] = { hp: p.stamina, pr: p.prestige, sp: p.spirit, alive: p.alive };
    }
  }

  // ── player cards ──────────────────────────────────────────────────────────
  function renderPlayers() {
    const s = game.state;
    els.players.innerHTML = s.players.map((p) => {
      const pips = Array.from({ length: cfg.maximum_stamina }, (_, i) =>
        `<span class="hpip ${i < p.stamina ? 'on' : ''}">${icon('heart', 10, { filled: i < p.stamina })}</span>`).join('');
      const myTurn = p.alive && p.seat === s.turn;
      return `
      <div class="p-card ${myTurn ? 'active' : ''} ${p.alive ? '' : 'dead'} ${game.isInside(p) ? 'inside' : ''}" id="card-${p.seat}" style="--pc:${p.color}">
        <div class="pc-name" title="${p.name}">${p.name}</div>
        <div class="pc-pic" data-seat="${p.seat}" title="tap for power &amp; cards">
          <span class="pc-sprite">${portrait(charOf(p), 44)}</span>
          ${p.keepCardIds.length ? `<span class="pc-deck">${icon('scroll', 10)}×${p.keepCardIds.length}</span>` : ''}
          ${p.bot ? '<span class="pc-cpu">CPU</span>' : ''}
          ${p.alive ? '' : `<span class="pc-ko">${icon('skull', 15)}</span>`}
          ${myTurn ? '<span class="pc-go">GO</span>' : ''}
        </div>
        <div class="pc-body">
          <div class="pc-hearts" title="Stamina ${p.stamina}/${cfg.maximum_stamina}">${pips}</div>
          <div class="pc-stats">
            <span class="pc-pr" title="Prestige">${star(15)}${p.prestige}</span>
            <span class="pc-sp" title="Fighting Spirit">${icon('zap', 16)}${p.spirit}</span>
            <span class="pc-zone ${game.isInside(p) ? '' : 'out'}">${POS_SHORT[p.position]}</span>
          </div>
          <div class="pc-rank">${game.rank(p)}</div>
        </div>
      </div>`;
    }).join('');
    const n = s.players.length;
    const compact = n >= 4;                 // 4–6: horizontal cards (portrait left, stats right)
    const cols = n === 2 ? 2 : n === 4 ? 2 : 3;
    els.players.classList.toggle('compact', compact);
    els.players.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    els.players.style.setProperty('--pic', `${n === 2 ? 112 : n === 3 ? 80 : n === 4 ? 50 : 38}px`);
    [...els.players.querySelectorAll('.pc-sprite')].forEach((el, i) => mountArt(el, art, `char_${s.players[i].rikishiId}`));
    els.players.querySelectorAll('.pc-pic').forEach((el) => { el.onclick = () => showPlayer(+el.dataset.seat); });
    checkDiffs(s);
  }

  /** Tap a wrestler → signature power + KEEP cards owned. */
  function showPlayer(seat) {
    const p = game.state.players[seat], c = charOf(p);
    const cards = p.keepCardIds.map((id) => game.cardById[id]);
    const body = `
      <div class="pp-head"><span class="pp-kanji">${c.kanji}</span><span class="pp-epithet">${c.epithet} · ${c.style}</span></div>
      <div class="pp-power"><b>${c.ability_name}</b><span>${c.ability}</span></div>
      <div class="pp-stats">${game.rank(p)} · ${p.stamina}/${cfg.maximum_stamina} Stamina · ${p.prestige} Prestige · ${p.spirit} Spirit · ${POSITION_NAME[p.position]}</div>
      ${cards.length
        ? cards.map((d) => `<span class="deck-row"><span class="c-name">${d.name}</span><span class="c-text">${d.effect}</span></span>`).join('')
        : '<span class="deck-empty">No techniques yet — buy KEEP cards in the market.</span>'}`;
    modal({ title: `${p.name}${p.bot ? ' · CPU' : ''}`, body, actions: [{ label: 'CLOSE', value: 0 }] });
  }

  // ── dice ─────────────────────────────────────────────────────────────────
  const DIE_FACE = (f) => (f === 'SPIRIT' ? icon('zap', 21) : f === 'PUSH' ? icon('palm', 23) : f === 'RECOVER' ? icon('heart', 21, { filled: true }) : f);
  const toneOf = (f) => (['1', '2', '3'].includes(f) ? 'gold' : f === 'SPIRIT' ? 'cyan' : f === 'PUSH' ? 'red' : 'green');

  function renderDice() {
    const s = game.state, p = game.me();
    const n = s.dice.length || cfg.base_dice;
    const inside = game.isInside(p);
    let html = '';
    for (let i = 0; i < n; i++) {
      const f = s.dice[i];
      const glyph = f ? DIE_FACE(f) : '?';
      const kept = s.phase === 'rolled' && s.keep[i];
      const locked = f === 'RECOVER' && inside && ['rolled', 'resolving'].includes(s.phase);
      const target = armed && (armed.kind === 'reroll' || f === armed.from);
      const glow = stageFaces == null ? '' : (stageFaces === 'all' || stageFaces.has(f)) ? ` glow g-${stageFaces === 'all' ? 'all' : toneOf(f)}` : '';
      const cls = [f ? `f-${f}` : '', rolling ? 'rolling' : '', kept ? 'kept' : '', target ? 'armed' : '', locked ? 'locked' : '', glow].join(' ');
      const title = locked ? 'Recovery is locked while you hold a dohyō position' : '';
      html += `<button class="die ${cls}" data-i="${i}" ${title ? `title="${title}" aria-label="${title}"` : ''}>${glyph}${locked ? `<span class="die-lock">${icon('lock', 11)}</span>` : ''}</button>`;
    }
    els.diceFaces.innerHTML = html;
    els.diceHint.textContent = diceHint(s, inside);
    els.diceFaces.querySelectorAll('.die').forEach((el) => { el.onclick = () => onDieTap(+el.dataset.i); });
  }

  function diceHint(s, inside) {
    if (s.phase === 'rolled') {
      if (armed) return armed.kind === 'reroll' ? 'tap the die to reroll — you must keep the result' : 'tap a die showing 1 to turn it into Push';
      const lock = inside && s.dice.includes('RECOVER') ? ' · 🔒 Recovery locked in the ring' : '';
      if (s.rerollsLeft <= 0) return `dice final${lock}`;
      return (shakeApi?.enabled ? 'tap a die to hold · shake to reroll' : 'tap a die to hold it') + lock;
    }
    if (s.phase === 'awaitRoll') return shakeApi?.enabled ? 'SHAKE or tap ROLL' : 'tap ROLL to throw the six dice';
    return '';
  }

  async function onDieTap(i) {
    const s = game.state;
    if (game.me().bot) return;
    if (armed) {
      const a = armed;
      if (a.kind === 'convert' && s.dice[i] !== a.from) return;
      armed = null;
      if (a.kind === 'reroll') { sfx.roll(); }
      await game.useActive(a.key, i);
      render();
      return;
    }
    if (s.phase === 'rolled' && s.rerollsLeft > 0) { game.toggleKeep(i); sfx.keep(); }
  }

  function renderAbilities() {
    const p = game.me();
    const list = p.bot ? [] : game.actives(p);
    els.abilities.innerHTML = list.map((a, i) =>
      `<button class="ab-btn ${armed && armed.key === a.key ? 'armed' : ''}" data-i="${i}">${icon(a.kind === 'reroll' ? 'reroll' : 'palm', 13)} ${a.label}</button>`).join('');
    els.abilities.querySelectorAll('.ab-btn').forEach((el) => {
      el.onclick = () => {
        const a = list[+el.dataset.i];
        armed = armed && armed.key === a.key ? null : a;
        render();
      };
    });
  }

  function renderActions() {
    const s = game.state, p = game.me();
    const b = els.primary, sec = els.secondary;
    b.disabled = !!p.bot && s.phase !== 'over';
    els.shopBtn.classList.add('hidden');
    sec.classList.add('hidden');
    const allKept = s.keep.length && s.keep.every(Boolean);
    switch (s.phase) {
      case 'awaitRoll': b.textContent = p.bot ? `${p.name} is up…` : 'ROLL'; break;
      case 'rolled':
        if (p.bot) { b.textContent = `${p.name} is thinking…`; break; }
        if (s.rerollsLeft > 0 && !allKept) { b.textContent = `REROLL (${s.rerollsLeft})`; sec.textContent = '✓ Resolve now'; sec.classList.remove('hidden'); }
        else b.textContent = '✓ RESOLVE';
        break;
      case 'resolving': b.textContent = '…'; b.disabled = true; break;
      case 'buying':
        b.textContent = p.bot ? `${p.name} shops…` : 'END TURN ➜';
        if (!p.bot) { els.shopBtn.classList.remove('hidden'); els.shopBtn.innerHTML = `${icon('bag', 15)} Market · ${p.spirit}${icon('zap', 13)}`; }
        break;
      case 'ending': b.textContent = '…'; b.disabled = true; break;
      case 'over': b.textContent = 'TOURNAMENT OVER'; b.disabled = true; break;
    }
    b.onclick = primary;
    sec.onclick = async () => { if (game.state.phase === 'rolled' && !game.me().bot) { b.disabled = true; armed = null; await game.resolve(); render(); } };
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
    if (!s || s.winner != null || modalOpen() || animating || game.me().bot) return;
    if (s.phase === 'awaitRoll') {
      animating = true;
      const done = await animateRoll();
      game.roll();
      done(); animating = false; render();
    } else if (s.phase === 'rolled') {
      const allKept = s.keep.every(Boolean);
      if (s.rerollsLeft > 0 && !allKept) {
        animating = true;
        const done = await animateRoll();
        game.reroll();
        done(); animating = false; render();
      } else {
        armed = null;
        els.primary.disabled = true;
        await game.resolve();
        render();
      }
    } else if (s.phase === 'buying') {
      closeSheets();
      await game.endTurn();
      render();
    }
  }

  /** Visual roll/reroll for bots — same animation as the human buttons. */
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

  function onShake() {
    const s = game.state;
    if (!s || s.winner != null || modalOpen() || openSheet || game.me().bot) return;
    if (s.phase === 'awaitRoll' || (s.phase === 'rolled' && s.rerollsLeft > 0 && !s.keep.every(Boolean))) primary();
  }

  // ── staged resolve choreography ─────────────────────────────────────────
  function setFlavor(text) {
    const el = els.chip.querySelector('.t-phase');
    if (el) el.textContent = text;
  }
  function setStageGlow(set) { stageFaces = set; renderDice(); }

  async function stage(name, ctx = {}) {
    try {
      switch (name) {
        case 'reveal':
          setStageGlow('all'); setFlavor('the dice settle…');
          await sleep(500);
          break;
        case 'score': {
          setStageGlow(new Set(['1', '2', '3']));
          if (ctx.total > 0) {
            const label = ctx.groups.map((g) => `${g.face}×${g.count}`).join(' + ');
            announce(`${label}&nbsp;&nbsp;<b>+${ctx.total}</b> ${star(18)}`, 'gold');
            sfx.score(); setFlavor('the crowd roars…');
            await sleep(1000);
          } else { setFlavor('no ranked sets…'); await sleep(300); }
          break;
        }
        case 'spirit':
          setStageGlow(new Set(['SPIRIT']));
          announce(`${icon('zap', 22)} FIGHTING SPIRIT&nbsp;&nbsp;<b>+${ctx.n}</b>`, 'cyan');
          sfx.spirit(); setFlavor('spirit rises');
          await sleep(700);
          break;
        case 'attack':
          setStageGlow(new Set(['PUSH']));
          announce(`${icon('palm', 26)} ${ctx.damage} PUSH${ctx.damage > 1 ? 'ES' : ''}!`, 'red');
          sfx.windup(); setFlavor('tachiai!');
          await sleep(750);
          break;
        case 'strike':
          drawBeams(ctx); sfx.windup();
          await sleep(850);
          break;
        case 'hit':
          hitShake(ctx.victim.seat); sfx.hit();
          await sleep(450);
          break;
        case 'enter':
          render();
          flashPos(ctx.position);
          sfx.capture();
          await sleep(500);
          break;
        case 'retreat':
          render();
          announce(`${ctx.victim.name} YIELDS`, 'cyan');
          await sleep(700);
          break;
        case 'recover':
          setStageGlow(new Set(['RECOVER']));
          if (ctx.blocked) {
            announce(`${icon('lock', 20)} RECOVERY LOCKED IN THE RING`, 'dim');
            setFlavor('no healing inside the dohyō');
          } else {
            announce(`${icon('heart', 22, { filled: true })} RECOVER&nbsp;&nbsp;<b>+${ctx.n}</b>`, 'green');
            sfx.heal(); setFlavor('catching breath…');
          }
          await sleep(700);
          break;
        case 'card':
          announce(`${ctx.card.name.toUpperCase()}${ctx.target ? ` → ${ctx.target.name}` : ''}`, 'gold');
          await sleep(700);
          break;
        case 'announce':
          render();
          announce(inkify(ctx.text), ctx.tone || 'gold', 1300);
          await sleep(1100);
          break;
        default:
          await sleep(120);
      }
    } catch { /* never block the engine */ }
    setStageGlow(null);
  }

  // ── market ───────────────────────────────────────────────────────────────
  function renderShop() {
    const s = game.state, p = game.me();
    els.shopSpirit.innerHTML = `${icon('zap', 15)} ${p.spirit}`;
    els.shopNote.textContent = `Pay Fighting Spirit · tap a card to buy · ${s.deckIds.length} in deck, ${s.discardIds.length} discarded`;
    els.cardList.innerHTML = s.marketIds.map((id, i) => {
      if (!id) return `<div class="card-row empty"><div class="c-main"><div class="c-name">No card — deck and discard are empty</div></div></div>`;
      const def = game.cardById[id];
      const chk = game.canBuy(i, p);
      const can = chk.ok && !p.bot;
      const type = def.type.toLowerCase();
      return `
      <button class="card-row ${type} ${can ? '' : 'cant'}" data-i="${i}" ${can ? '' : 'disabled'}>
        <div class="c-art" data-card="${def.id}"></div>
        <div class="c-main">
          <div class="c-top">
            <span class="c-name">${def.name}</span>
            <span class="c-type ${type}">${def.type}</span>
            <span class="c-cost">${def.cost}${icon('zap', 14)}</span>
          </div>
          <div class="c-text">${def.effect}</div>
          ${!chk.ok && s.phase === 'buying' ? `<div class="c-why">${chk.reason}</div>` : ''}
        </div>
      </button>`;
    }).join('');
    els.cardList.querySelectorAll('.c-art').forEach((el) => mountArt(el, art, `card_${el.dataset.card}`));
    els.cardList.querySelectorAll('.card-row:not([disabled])').forEach((el) => {
      el.onclick = async () => { const ok = await game.buy(+el.dataset.i); if (ok) sfx.buy(); render(); };
    });
    const canR = game.canRefresh(p) && !p.bot;
    els.refresh.disabled = !canR;
    els.refresh.innerHTML = `${icon('reroll', 14)} Refresh market · ${cfg.market_sweep_cost} Spirit`;
    els.refresh.onclick = async () => { if (await game.refresh()) sfx.buy(); render(); };
  }

  function renderLog() {
    const lines = game.state.log.slice(-80).reverse();
    els.logList.innerHTML = lines.map((l) => `<div class="log-line">${inkify(l)}</div>`).join('');
  }

  function renderRules() {
    const ranks = cfg.rank_thresholds.map((t) =>
      `<div class="rank-step"><b>${t.at}${t.at < cfg.prestige_to_win ? '+' : ''}</b><span>${t.rank}</span></div>`).join('');
    const powers = game.data.characters.map((c) =>
      `<div class="power-line" style="--pc:${c.color}"><b>${c.name} <em>${c.epithet}</em></b><span><i>${c.ability_name}:</i> ${c.ability}</span></div>`).join('');
    const shakeRow = shakeApi
      ? `<p style="margin-top:8px"><button class="btn-ghost" id="btnShakeToggle">${icon('phone', 15)} Shake to roll: <b>${shakeApi.enabled ? 'ON' : 'OFF'}</b></button></p>` : '';
    const sfxRow = `<p style="margin-top:6px"><button class="btn-ghost" id="btnSfxToggle">${icon(sfx.enabled ? 'volume' : 'mute', 15)} Sound FX: <b>${sfx.enabled ? 'ON' : 'OFF'}</b></button></p>`;
    els.rulesBody.innerHTML = `
      <h3>WIN</h3>
      <ul>
        <li>End your turn alive with <b>${cfg.prestige_to_win} Prestige</b> ⭐ — promoted to Yokozuna.</li>
        <li>Or be the last wrestler standing. If everyone falls at once, nobody wins.</li>
      </ul>
      <div class="rank-strip">${ranks}</div>
      <p class="rules-note">Ranks are display milestones only.</p>
      <h3>YOUR TURN</h3>
      <ul>
        <li>Start in the dohyō: +${cfg.ring_start_turn_prestige} ⭐.</li>
        <li>Roll 6 dice, then up to ${cfg.normal_reroll_opportunities} rerolls (tap dice to hold). Extra single-die rerolls come after.</li>
        <li>Resolve in order: <b>1·2·3</b> — three of a kind scores its number, +1 per extra · <b>⚡</b> +1 Spirit each · <b>✋ Push</b> 1 damage each to every opponent across the ring line · <b>💚 Recover</b> +1 Stamina each, only outside.</li>
        <li>Buy market cards with Spirit, or refresh all 3 for ${cfg.market_sweep_cost} Spirit.</li>
      </ul>
      <h3>THE DOHYŌ</h3>
      <ul>
        <li>Inside → your Push hits everyone outside. Outside → your Push hits everyone inside.</li>
        <li>Empty ring? Your first Push deals no damage and takes the Main Dohyō (+${cfg.ring_entry_prestige} ⭐).</li>
        <li>Hit by Push while inside? You may yield — damage still lands — and the attacker moves in (+${cfg.ring_entry_prestige} ⭐).</li>
        <li>An outside attacker must take any open position (Main first).</li>
        <li>Card damage (Henka!, Tsuppari Flurry, Final Bout) is not an attack: no yielding, no entry.</li>
        <li>5–6 players: the Challenge Dohyō opens too, until fewer than ${cfg.second_ring_min_alive_players} remain.</li>
      </ul>
      <h3>RIKISHI POWERS</h3>${powers}
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
    const how = w ? (game.alive().length === 1 ? 'Last wrestler standing — Yokozuna by dominance.' : `Promoted with ${w.prestige} Prestige.`) : '';
    els.win.innerHTML = `
      <div class="win-card">
        <div class="win-crown">${w ? '<span class="win-kanji">横綱</span>' : icon('skull', 52)}</div>
        <h2>${w ? 'YOKOZUNA!' : 'NO YOKOZUNA'}</h2>
        <div class="win-pic">${w ? portrait(charOf(w), 96) : ''}</div>
        <div class="win-name" style="color:${w ? w.color : 'var(--ink-soft)'}">${w ? `${w.name} · ${w.prestige}${star(15)}` : 'Every wrestler fell together.'}</div>
        <p>${how}</p>
        <button class="btn-primary" id="btnAgain">NEW TOURNAMENT</button>
      </div>`;
    els.win.classList.remove('hidden');
    if (w) mountArt(els.win.querySelector('.win-pic'), art, `char_${w.rikishiId}`);
    if (s.winner === -1) sfx.ko(); else sfx.win();
    $('btnAgain').onclick = () => location.reload();
  }

  return {
    render, renderTicker, modal, stage, rollVisual, rerollVisual,
    setBot(b) { bot = b; },
    openSheetById,
    setArt(a) { art = a; },
    setShake(api) { shakeApi = api; },
    onShake,
    get busy() { return modalOpen() || openSheet != null; },
  };
}
