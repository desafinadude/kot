// Data loading + art resolution. data/yokozuna-data.json is the single source
// of truth; it is validated at startup (js/effects.js → validateData).
import { validateData } from './effects.js';

export async function loadData() {
  const r = await fetch('data/yokozuna-data.json');
  if (!r.ok) throw new Error('Failed to load data/yokozuna-data.json');
  const data = await r.json();
  validateData(data);
  // art map keyed by stable ids: char_<id>, card_<id> → the JSON `asset` path
  const art = {};
  for (const c of data.characters) art[`char_${c.id}`] = { src: c.asset };
  for (const c of data.cards) art[`card_${c.id}`] = { src: c.asset };
  return { data, art };
}

const failedArt = new Set();

/** Warm the browser cache for every art src (rikishi first) so images show instantly. */
export function preloadArt(art) {
  const entries = Object.entries(art).filter(([, a]) => a?.src && !failedArt.has(a.src));
  entries.sort(([a], [b]) => (b.startsWith('char_') ? 1 : 0) - (a.startsWith('char_') ? 1 : 0));
  for (const [, a] of entries) {
    const img = new Image();
    img.decoding = 'async';
    img.fetchPriority = 'low';
    img.onerror = () => failedArt.add(a.src);
    img.src = a.src;
  }
}

/**
 * Keep the placeholder in place; swap in the real art when/if it loads.
 * mode: 'content' (replace children) | 'background' (cover the element bg)
 */
export function mountArt(el, art, key, mode = 'content') {
  if (!el) return;
  const a = art[key];
  if (!a?.src || failedArt.has(a.src)) return;
  const img = new Image();
  img.decoding = 'async';
  img.alt = '';
  img.onload = () => {
    if (mode === 'background') {
      el.style.backgroundImage = `url("${a.src}")`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center top';
    } else {
      el.innerHTML = '';
      el.appendChild(img);
    }
  };
  img.onerror = () => { failedArt.add(a.src); };
  img.src = a.src;
  if (img.complete && img.naturalWidth) img.onload();
}
