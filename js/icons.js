// Line-icon library (Lucide-style, ISC-licensed paths redrawn/adapted).
// Used for ALL interface icons (palm = Push die) — characters/portraits are separate (see portrait.js).

const S = {
  heart: [{ t: 'path', d: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.29 1.51 4.04 3 5.5l7 7Z' }],
  zap: [{ t: 'path', d: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z' }],
  star: [{ t: 'path', d: 'M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.3l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9L12 2.5Z' }],
  paw: [
    { t: 'circle', cx: 6, cy: 8, r: 2.2 },
    { t: 'circle', cx: 11, cy: 4.4, r: 2.2 },
    { t: 'circle', cx: 17.5, cy: 6.5, r: 2.2 },
    { t: 'circle', cx: 20.5, cy: 12.5, r: 2 },
    { t: 'path', d: 'M9.2 11.2c2.6-1.4 6-1 8 1.4 1.7 2.1 1.4 4.9-.6 6.6-1.7 1.5-4.3 1.6-6 .3-2.4-1.8-3.9-5.4-1.4-8.3Z' },
  ],
  palm: [
    { t: 'path', d: 'M18 11V6a2 2 0 0 0-4 0' },
    { t: 'path', d: 'M14 10V4a2 2 0 0 0-4 0v2' },
    { t: 'path', d: 'M10 10.5V6a2 2 0 0 0-4 0v8' },
    { t: 'path', d: 'M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15' },
  ],
  skull: [
    { t: 'path', d: 'M12 2a8 8 0 0 0-8 8c0 2.4 1.1 4.3 2.9 5.6V17a2 2 0 0 0 2 2h1v2.2a1.1 1.1 0 0 0 1.1 1.1h.1a1.1 1.1 0 0 0 1.1-1.1V19h.8v2.2a1.1 1.1 0 0 0 1.1 1.1h.1a1.1 1.1 0 0 0 1.1-1.1V19h1a2 2 0 0 0 2-2v-1.4C18.9 14.3 20 12.4 20 10a8 8 0 0 0-8-8Z' },
    { t: 'circle', cx: 9, cy: 11, r: 1.6, f: 1 },
    { t: 'circle', cx: 15, cy: 11, r: 1.6, f: 1 },
  ],
  crown: [{ t: 'path', d: 'M3 7.5l4.2 3.6L12 4.5l4.8 6.6L21 7.5l-1.7 10.8H4.7L3 7.5Z' }, { t: 'path', d: 'M5 20.5h14' }],
  lock: [{ t: 'path', d: 'M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5' }, { t: 'rect', x: 3.5, y: 10.5, w: 17, h: 10.5, rx: 1.5 }],
  x: [{ t: 'path', d: 'M18 6 6 18M6 6l12 12' }],
  check: [{ t: 'path', d: 'M20 6 9 17l-5-5' }],
  reroll: [
    { t: 'path', d: 'M3 12a9 9 0 0 1 15.3-6.4L21 8' },
    { t: 'path', d: 'M21 3.5V8h-4.5' },
    { t: 'path', d: 'M21 12a9 9 0 0 1-15.3 6.4L3 16' },
    { t: 'path', d: 'M3 20.5V16h4.5' },
  ],
  arrowRight: [{ t: 'path', d: 'M4 12h15' }, { t: 'path', d: 'm13 6 6 6-6 6' }],
  bag: [
    { t: 'path', d: 'M6 2.5 3.5 6.5V19a2.5 2.5 0 0 0 2.5 2.5h12a2.5 2.5 0 0 0 2.5-2.5V6.5L18 2.5H6Z' },
    { t: 'path', d: 'M3.5 6.5h17' },
    { t: 'path', d: 'M16 10.5a4 4 0 0 1-8 0' },
  ],
  scroll: [
    { t: 'path', d: 'M14 2.5H6.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V8L14 2.5Z' },
    { t: 'path', d: 'M14 2.5V8h5.5' },
    { t: 'path', d: 'M8.5 13h7M8.5 17h7' },
  ],
  help: [{ t: 'circle', cx: 12, cy: 12, r: 9.5 }, { t: 'path', d: 'M9.2 9.2a3 3 0 0 1 5.8 1c0 2-3 2.6-3 4.3' }, { t: 'path', d: 'M12 17.5h.01' }],
  volume: [
    { t: 'path', d: 'M11 5 6.5 8.5H3v7h3.5L11 19V5Z' },
    { t: 'path', d: 'M15 9.5a4 4 0 0 1 0 5' },
    { t: 'path', d: 'M17.8 7a8 8 0 0 1 0 10' },
  ],
  mute: [
    { t: 'path', d: 'M11 5 6.5 8.5H3v7h3.5L11 19V5Z' },
    { t: 'path', d: 'm16 10 5 5M21 10l-5 5' },
  ],
  phone: [{ t: 'rect', x: 6, y: 2.5, w: 12, h: 19, rx: 2 }, { t: 'path', d: 'M12 18h.01' }],
  dice: [
    { t: 'rect', x: 3.5, y: 3.5, w: 17, h: 17, rx: 3 },
    { t: 'circle', cx: 8.2, cy: 8.2, r: 1.2, f: 1 },
    { t: 'circle', cx: 15.8, cy: 8.2, r: 1.2, f: 1 },
    { t: 'circle', cx: 12, cy: 12, r: 1.2, f: 1 },
    { t: 'circle', cx: 8.2, cy: 15.8, r: 1.2, f: 1 },
    { t: 'circle', cx: 15.8, cy: 15.8, r: 1.2, f: 1 },
  ],
  spark: [{ t: 'path', d: 'm12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z' }, { t: 'path', d: 'M19 16.5l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7.7-2.1Z' }],
  seal: [{ t: 'circle', cx: 12, cy: 12, r: 9 }, { t: 'path', d: 'M8.5 9.5h7M8.5 12.5h7M10.5 15.5h3' }],
  swords: [
    { t: 'path', d: 'M4.5 3.5h3l9.5 9.5-3 3L4.5 6.5v-3Z' },
    { t: 'path', d: 'M19.5 3.5h-3l-6 6' },
    { t: 'path', d: 'm14 19 6-6' },
    { t: 'path', d: 'M13.5 20.5H8l-4-4' },
  ],
};

function shapeEl(s) {
  if (s.t === 'path') return `<path d="${s.d}"/>`;
  if (s.t === 'circle') return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}"${s.f ? ' fill="currentColor"' : ''}/>`;
  if (s.t === 'rect') return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="${s.rx || 0}"/>`;
  return '';
}

/** SVG line icon. filled=true → solid (hearts/stars), else stroke outline. */
export function icon(name, size = 16, { filled = false, cls = '' } = {}) {
  const shapes = S[name] || S.spark;
  const fillMode = filled ? 'currentColor' : 'none';
  return `<svg class="icn ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fillMode}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${shapes.map(shapeEl).join('')}</svg>`;
}

/** Draw an icon on a 2D canvas context. */
export function drawIcon(ctx, name, x, y, size, { color = '#2b2418', filled = false, lineWidth = 2 } = {}) {
  const shapes = S[name] || S.spark;
  const k = size / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(k, k);
  ctx.lineWidth = lineWidth / k;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  for (const s of shapes) {
    if (s.t === 'path') {
      const p = new Path2D(s.d);
      filled ? ctx.fill(p) : ctx.stroke(p);
    } else if (s.t === 'circle') {
      ctx.beginPath();
      ctx.arc(s.cx, s.cy, s.r, 0, Math.PI * 2);
      (filled || s.f) ? ctx.fill() : ctx.stroke();
    } else if (s.t === 'rect') {
      const p = new Path2D(roundRectPath(s));
      filled ? ctx.fill(p) : ctx.stroke(p);
    }
  }
  ctx.restore();
}

function roundRectPath(s) {
  const { x, y, w, h, rx = 0 } = s;
  return `M${x + rx},${y} h${w - 2 * rx} a${rx},${rx} 0 0 1 ${rx},${rx} v${h - 2 * rx} a${rx},${rx} 0 0 1 ${-rx},${rx} h${-(w - 2 * rx)} a${rx},${rx} 0 0 1 ${-rx},${-rx} v${-(h - 2 * rx)} a${rx},${rx} 0 0 1 ${rx},${-rx} z`;
}

export const ICON_NAMES = Object.keys(S);
