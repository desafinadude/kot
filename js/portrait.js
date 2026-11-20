// Character portrait PLACEHOLDERS — generated art replaces these via data/art.json.
// Until real art is imported, each monster shows a paper swatch with its kanji
// and colour wash. See assets/art/README.md for full art specifications.

const KANJI = {
  ryuga: '剛',        // Gōryū — the atomic reptile (Godzilla slot)
  shirohime: '蛾',    // Shirohime — moon moth (Mothra slot)
  tetsujin9: '鉄',    // Tetsujin-9 — mechanical titan (Mecha slot)
  onizaru: '猿',      // Onizaru — ogre-ape (beast-island slot)
  kagero: '朱',       // Suzaku — vermillion pterosaur (Rodan slot)
  ganryu: '亀',       // Ganryū — shell colossus (guardian-turtle slot)
};

/**
 * Paper-swatch portrait placeholder.
 * @param {{id:string,name:string,color:string}} monster
 * @param {number} size rendered px (svg scales)
 */
export function portrait(monster, size = 48) {
  const k = KANJI[monster.id] || (monster.name || '?').slice(0, 1);
  const c = monster.color || '#2b2118';
  return `<svg class="portrait" width="${size}" height="${size}" viewBox="0 0 48 48" aria-label="${monster.name} portrait placeholder">
    <rect x="1" y="1" width="46" height="46" rx="3" fill="#f8f1e1"/>
    <rect x="1" y="1" width="46" height="46" rx="3" fill="${c}" opacity="0.17"/>
    <path d="M36 1h11v11z" fill="#e2d6bd"/>
    <path d="M36 1l11 11" stroke="#c2b195" stroke-width="1" fill="none"/>
    <rect x="4" y="4" width="40" height="40" rx="2" fill="none" stroke="#c2b195" stroke-width="1" stroke-dasharray="4 3"/>
    <text x="24" y="32.5" text-anchor="middle" font-family="Shippori Mincho, serif" font-weight="700"
      font-size="25" fill="${c}" stroke="rgba(43,33,24,.85)" stroke-width="0.7" paint-order="stroke fill">${k}</text>
  </svg>`;
}

export function portraitForId(monsters, id, size = 48) {
  const m = monsters.find((x) => x.id === id);
  return m ? portrait(m, size) : '';
}
