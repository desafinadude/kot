// Data loading + art-manifest resolution (art can be swapped in from elsewhere).

export async function loadData() {
  const [monsters, zones, cards, art] = await Promise.all(
    ['data/monsters.json', 'data/zones.json', 'data/cards.json', 'data/art.json']
      .map((u) => fetch(u).then((r) => {
        if (!r.ok) throw new Error(`Failed to load ${u}`);
        return r.json();
      }))
  );
  return { monsters, zones, cards, art: art.assets || {} };
}

export function fallbackHTML(art, key) {
  const a = art[key];
  if (!a || !a.fallback) return '';
  const [kind, val] = [a.fallback.slice(0, a.fallback.indexOf(':')), a.fallback.slice(a.fallback.indexOf(':') + 1)];
  if (kind === 'emoji') return val;
  return '';
}

export function fallbackClass(art, key) {
  const a = art[key];
  if (!a || !a.fallback?.startsWith('css:')) return '';
  return 'art-' + a.fallback.slice(4);
}

const failedArt = new Set();

/**
 * Warm the browser cache for every art src (cards first) so images appear
 * instantly the first time they're shown. Safe to call once at boot.
 */
export function preloadArt(art) {
  const entries = Object.values(art).filter((a) => a?.src && !failedArt.has(a.src));
  entries.sort((a, b) => (b.src.includes('/cards/') ? 1 : 0) - (a.src.includes('/cards/') ? 1 : 0));
  for (const a of entries) {
    const img = new Image();
    img.decoding = 'async';
    img.fetchPriority = 'low';
    img.onerror = () => failedArt.add(a.src);
    img.src = a.src;
  }
}

/**
 * Show the fallback immediately; upgrade to real art when/if the file loads.
 * mode: 'content' (replace children) | 'background' (tile the element bg)
 */
export function mountArt(el, art, key, mode = 'content') {
  if (!el) return;
  const a = art[key];
  if (!a?.src || failedArt.has(a.src)) return;
  const img = new Image();
  img.decoding = 'async';
  img.onload = () => {
    if (mode === 'background') {
      el.style.backgroundImage = `url("${a.src}")`;
      el.style.backgroundSize = 'cover';
      el.style.backgroundPosition = 'center';
    } else {
      el.innerHTML = '';
      el.appendChild(img);
    }
  };
  img.onerror = () => { failedArt.add(a.src); }; // keep the fallback, don't re-probe
  img.src = a.src;
  // already cached (preloaded) → paint synchronously, no flash of fallback
  if (img.complete && img.naturalWidth) img.onload();
}
