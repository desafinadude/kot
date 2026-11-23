// Rikishi portrait PLACEHOLDER — shown until the real art (JSON `asset`) loads,
// or if it is missing. Paper swatch with the shikona's first kanji in the
// wrestler's colour.

/**
 * @param {{name:string,color:string,kanji?:string}} who  character def or player
 * @param {number} size rendered px (svg scales)
 */
export function portrait(who, size = 48) {
  const k = (who.kanji || who.name || '?').slice(0, 1);
  const c = who.color || '#2b2118';
  return `<svg class="portrait" width="${size}" height="${size}" viewBox="0 0 48 48" aria-label="${who.name}">
    <rect x="1" y="1" width="46" height="46" rx="3" fill="#f8f1e1"/>
    <rect x="1" y="1" width="46" height="46" rx="3" fill="${c}" opacity="0.17"/>
    <rect x="4" y="4" width="40" height="40" rx="2" fill="none" stroke="#c2b195" stroke-width="1" stroke-dasharray="4 3"/>
    <text x="24" y="32.5" text-anchor="middle" font-family="Yuji Syuku, serif" font-weight="700"
      font-size="25" fill="${c}" stroke="rgba(43,33,24,.85)" stroke-width="0.7" paint-order="stroke fill">${k}</text>
  </svg>`;
}
