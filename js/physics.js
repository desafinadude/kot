// Gravity dice — Matter.js bodies in the dice tray.
// Roll = impulses (tumble + land back on the tray), device tilt drives world
// gravity, shake adds jolts, taps pick dice. Falls back to DOM dice if the
// Matter CDN is unavailable (caller checks for null).
import { drawIcon } from './icons.js';

const FACE_ICON = { energy: 'zap', attack: 'paw', heal: 'heart' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

export function createDicePhysics(canvas, { onTap } = {}) {
  const M = window.Matter;
  if (!M) return null;
  const { Engine, Runner, Bodies, Body, Composite, Query } = M;

  const engine = Engine.create();
  engine.gravity.x = 0;
  engine.gravity.y = 1;
  const runner = Runner.create();
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0, S = 50, walls = [], bodies = [];
  let faces = [], keep = [], glow = null, tiltOn = false, dead = false;
  let settleHint = null;

  function resize() {
    const r = canvas.getBoundingClientRect(); // canvas extends above the tray
    if (!r.width) return;
    W = r.width; H = r.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    S = clamp((W - 5 * 8) / 6.4, 40, 54);
    buildWalls();
    layoutIdle();
  }

  function buildWalls() {
    if (walls.length) Composite.remove(engine.world, walls);
    const t = 60;
    walls = [
      Bodies.rectangle(W / 2, H + t / 2 - 2, W * 2, t, { isStatic: true }),
      Bodies.rectangle(-t / 2, H / 2, t, H * 4, { isStatic: true }),
      Bodies.rectangle(W + t / 2, H / 2, t, H * 4, { isStatic: true }),
    ];
    Composite.add(engine.world, walls);
  }

  function makeDie(x, y) {
    return Bodies.rectangle(x, y, S, S, {
      chamfer: { radius: 7 },
      restitution: 0.5, friction: 0.12, frictionAir: 0.012, density: 0.0014,
      angle: rnd(-0.25, 0.25),
    });
  }

  function setCount(n) {
    if (bodies.length === n) return;
    if (bodies.length) Composite.remove(engine.world, bodies);
    bodies = [];
    for (let i = 0; i < n; i++) bodies.push(makeDie(0, 0));
    Composite.add(engine.world, bodies);
    layoutIdle();
  }

  function layoutIdle() {
    const n = bodies.length;
    if (!n || !W) return;
    const gap = 8;
    const total = n * S + (n - 1) * gap;
    const x0 = Math.max(6, (W - total) / 2);
    bodies.forEach((b, i) => {
      Body.setPosition(b, { x: x0 + S / 2 + i * (S + gap), y: H - S / 2 - 3 });
      Body.setVelocity(b, { x: 0, y: 0 });
      Body.setAngularVelocity(b, 0);
      Body.setAngle(b, rnd(-0.12, 0.12));
      Body.setStatic(b, false);
    });
  }

  // ── public actions ────────────────────────────────────────────────────────
  function launch({ keepMask = [] } = {}) {
    bodies.forEach((b, i) => {
      if (keepMask[i]) { // kept dice stay put with a tiny thump
        Body.setVelocity(b, { x: 0, y: 1.5 });
        Body.setAngularVelocity(b, 0.02);
        return;
      }
      Body.setStatic(b, false);
      Body.setVelocity(b, { x: rnd(-9, 9), y: rnd(-15, -9) });
      Body.setAngularVelocity(b, rnd(-0.55, 0.55));
    });
    settleHint = performance.now() + 1600;
  }

  function jolt() {
    bodies.forEach((b) => {
      Body.setVelocity(b, {
        x: b.velocity.x + rnd(-5, 5),
        y: b.velocity.y + rnd(-7, -1),
      });
      Body.setAngularVelocity(b, rnd(-0.3, 0.3));
    });
  }

  function hop(faceSet) {
    bodies.forEach((b) => {
      const f = b.plugin?.face;
      if (faceSet === 'all' || (faceSet && faceSet.has && faceSet.has(f))) {
        Body.setVelocity(b, { x: b.velocity.x * 0.3, y: rnd(-7, -4) });
        Body.setAngularVelocity(b, rnd(-0.25, 0.25));
      }
    });
  }

  function setGravity(ax, ay, az) {
    if (!tiltOn) return;
    const g = 9.81;
    const nx = clamp(ax / g, -1.3, 1.3);
    const ny = -ay / g;
    // flat on a table → keep normal downward gravity
    if (Math.abs(ax) < 2.4 && Math.abs(ay) < 2.4) {
      engine.gravity.x = 0; engine.gravity.y = 1;
      return;
    }
    engine.gravity.x = nx;
    engine.gravity.y = clamp(ny, -1.3, 1.3);
  }

  function sync(nextFaces, nextKeep) {
    faces = nextFaces || [];
    keep = nextKeep || [];
    setCount(faces.length);
    bodies.forEach((b, i) => { b.plugin = b.plugin || {}; b.plugin.face = faces[i] || '?'; });
  }

  function setGlow(faceSet) { glow = faceSet || null; }

  function destroy() { dead = true; try { Runner.stop(runner); } catch { /* noop */ } }

  // ── picking (canvas has pointer-events:none — listen on the stage instead) ─
  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  canvas.parentElement.addEventListener('pointerdown', (e) => {
    const p = pos(e);
    const hit = Query.point(bodies, p)[0];
    const i = hit ? bodies.indexOf(hit) : -1;
    onTap?.(i, p);
  });

  // ── render loop ───────────────────────────────────────────────────────────
  function draw() {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < bodies.length; i++) {
      const b = bodies[i];
      const f = faces[i];
      const isKept = !!keep[i];
      const inGlow = glow === 'all' || (glow && f && glow.has && glow.has(f));
      ctx.save();
      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);
      const h = S / 2;
      // hand-built die — solid sumi-black body, parchment symbols (no image art)
      ctx.shadowColor = 'rgba(43, 33, 24, .4)';
      ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
      rr(-h, -h, S, S, 7);
      ctx.fillStyle = '#2b2118';
      ctx.fill();
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
      // edge: gold when kept, face-glow color when staged, near-black otherwise
      rr(-h, -h, S, S, 7);
      ctx.lineWidth = inGlow ? 3.5 : 2.2;
      ctx.strokeStyle = inGlow ? faceColor(f) : (isKept ? '#ffd166' : '#05060d');
      ctx.stroke();
      if (isKept && !inGlow) {
        rr(-h + 4, -h + 4, S - 8, S - 8, 5);
        ctx.strokeStyle = 'rgba(255, 209, 102, .6)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      const PARCH = '#f0e6d2';
      const icon = FACE_ICON[f];
      if (icon) {
        drawIcon(ctx, icon, -S * 0.36, -S * 0.36, S * 0.72, { color: PARCH, lineWidth: 2.4 });
      } else if (f && f !== '?') {
        ctx.fillStyle = PARCH;
        ctx.font = `900 ${Math.round(S * 0.5)}px "M PLUS Rounded 1c", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f, 0, 2);
      } else {
        // unknown face — dashed ? on black
        ctx.setLineDash([4, 3]);
        rr(-h + 7, -h + 7, S - 14, S - 14, 4);
        ctx.strokeStyle = 'rgba(240, 230, 210, .5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(240, 230, 210, .55)';
        ctx.font = `900 ${Math.round(S * 0.42)}px "M PLUS Rounded 1c", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('?', 0, 2);
      }
      ctx.restore();
    }
  }

  function faceColor(f) {
    if (f === 'energy') return '#35627f';
    if (f === 'attack') return '#b23a2e';
    if (f === 'heal') return '#5c7d4a';
    if (f === '1' || f === '2' || f === '3') return '#9a7b28';
    return '#2b2118';
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function loop() {
    if (dead) return;
    draw();
    requestAnimationFrame(loop);
  }

  resize();
  window.addEventListener('resize', resize);
  Runner.run(runner, engine);
  requestAnimationFrame(loop);

  return {
    available: true,
    resize,
    sync,
    launch,
    jolt,
    hop,
    setGlow,
    setGravity,
    enableTilt(on) { tiltOn = on; if (!on) { engine.gravity.x = 0; engine.gravity.y = 1; } },
    get running() { return !dead; },
    destroy,
  };
}
