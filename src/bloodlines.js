import { tr } from './i18n.js';
/*
 * Liniile de sânge ale unui porumbel: cât aduce fiecare linie (fondator) pe fiecare drum din pedigree.
 * Fiecare drum de la porumbel în sus până la un fondator (porumbel fără părinți cunoscuți, sau la maxGen) aduce
 * 0,5^adâncime. Un părinte necunoscut e un drum spre „Necunoscut”. Același strămoș pe mai multe drumuri se adună
 * (așa se vede consangvinizarea). Linia fondatorului: primul din „Linii”, altfel crescătorul de origine, altfel „Fără linie”.
 */


const lineOf = (row) => row?.lines?.[0]?.trim() || row?.breeder_text?.trim() || tr('text.fara_linie');

/**
 * @param {number} rootId
 * @param {Map<number, { id, father_id, mother_id, lines, breeder_text }>} rowsById
 * @returns {{ lines: { name, percent, founders: number[] }[], paths: { founderId, line, share, via: number[] }[] }}
 */
export function bloodlines(rootId, rowsById, maxGen = 8) {
  const paths = [];
  // `trail` = de la porumbel în sus (rădăcina prima); `via` se întoarce: de la fondator spre rădăcină.
  const walk = (id, depth, trail) => {
    const row = rowsById.get(id);
    const parents = row ? [row.father_id, row.mother_id] : [null, null];
    const known = parents.filter((p) => p != null && rowsById.has(p) && !trail.includes(p));
    const isFounder = depth > 0 && (known.length === 0 || depth >= maxGen);
    if (isFounder) {
      paths.push({ founderId: id, line: lineOf(row), share: 0.5 ** depth, via: [...trail].reverse() });
      return;
    }
    for (const p of parents) {
      if (p == null || !rowsById.has(p)) {
        // Părinte necunoscut: jumătatea lui de sânge e „Necunoscut”.
        paths.push({ founderId: null, line: tr('text.necunoscut'), share: 0.5 ** (depth + 1), via: [...trail].reverse() });
      } else if (trail.includes(p)) {
        // Ciclu în date (greșeală de introducere): drumul se oprește aici, socotit necunoscut.
        paths.push({ founderId: null, line: tr('text.necunoscut'), share: 0.5 ** (depth + 1), via: [...trail].reverse() });
      } else {
        walk(p, depth + 1, [...trail, p]);
      }
    }
  };
  walk(rootId, 0, [rootId]);

  const byLine = new Map();
  for (const p of paths) {
    const l = byLine.get(p.line) ?? { name: p.line, share: 0, founders: new Set() };
    l.share += p.share;
    if (p.founderId != null) l.founders.add(p.founderId);
    byLine.set(p.line, l);
  }
  const all = [...byLine.values()];
  const percents = roundPercents(all.map((l) => l.share));
  const lines = all
    .map((l, i) => ({ name: l.name, percent: percents[i], founders: [...l.founders] }))
    .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name, 'ro'));
  return { lines, paths };
}

/**
 * Procente cu 2 zecimale care adună exact 100 (metoda celor mai mari resturi): fiecare cotă se rotunjește în jos
 * la sutimi, iar sutimile rămase merg la cotele cu cel mai mare rest. Altfel bara ar putea arăta 99,99 %.
 */
export function roundPercents(shares) {
  const units = shares.map((s) => s * 1e4); // sutimi de procent
  const floor = units.map((u) => Math.floor(u + 1e-9));
  let left = Math.round(units.reduce((a, b) => a + b, 0)) - floor.reduce((a, b) => a + b, 0);
  const order = units.map((u, i) => [u - floor[i], i]).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floor[i]++;
    left--;
  }
  return floor.map((f) => f / 100);
}
