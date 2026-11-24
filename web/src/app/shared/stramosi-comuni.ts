/*
 * Strămoșii comuni pe foaia de pedigree: compararea inelelor și regula „T+M”.
 * Fără importuri Angular (se testează direct). Aceeași regulă ca `tmKeys` din `src/genealogy.js`.
 */

/** Inelul pentru comparare: NFKC, majuscule, fără spații, `-`, `/`, `.`; gol → null (fără inel nu se compară). */
export function ringCompareKey(ring: string | null | undefined): string | null {
  const k = (ring ?? '').normalize('NFKC').toUpperCase().replace(/[\s\-/.]+/g, '');
  return k || null;
}

/**
 * Cheile „T+M”: apar și în jumătatea tatălui, și în a mamei, doar cele mai apropiate.
 * `positions`: poziție heap ≥ 2 (tatăl 2, mama 3, părinții lui i = 2i și 2i+1) → cheie; rădăcina nu intră.
 */
export function tmKeys(positions: Map<number, string>): Set<string> {
  const half = (i: number) => {
    while (i > 3) i = Math.floor(i / 2);
    return i;
  };
  const sides = new Map<string, Set<number>>();
  for (const [i, k] of positions) sides.set(k, (sides.get(k) ?? new Set<number>()).add(half(i)));
  const common = new Set([...sides].filter(([, s]) => s.size === 2).map(([k]) => k));
  // O poziție e acoperită dacă un strămoș dintre ea și rădăcină are o cheie comună.
  const covered = (p: number) => {
    for (let q = Math.floor(p / 2); q >= 2; q = Math.floor(q / 2)) {
      const k = positions.get(q);
      if (k !== undefined && common.has(k)) return true;
    }
    return false;
  };
  const open = new Map<string, Set<number>>();
  for (const [i, k] of positions) {
    if (common.has(k) && !covered(i)) open.set(k, (open.get(k) ?? new Set<number>()).add(half(i)));
  }
  return new Set([...open].filter(([, s]) => s.size === 2).map(([k]) => k));
}
