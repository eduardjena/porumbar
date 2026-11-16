/*
 * Liniile de sânge ale unui porumbel: cât aduce fiecare linie (fondator) pe fiecare drum din pedigree.
 * Fiecare drum de la porumbel în sus până la un fondator (porumbel fără părinți cunoscuți, sau la maxGen) aduce
 * 0,5^adâncime. Un părinte necunoscut e un drum spre „Necunoscut”. Același strămoș pe mai multe drumuri se adună
 * (așa se vede consangvinizarea). Linia fondatorului: primul din „Linii”, altfel crescătorul de origine, altfel „Fără linie”.
 */

const UNKNOWN = 'Necunoscut';
const NO_LINE = 'Fără linie';

const lineOf = (row) => row?.lines?.[0]?.trim() || row?.breeder_text?.trim() || NO_LINE;

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
        paths.push({ founderId: null, line: UNKNOWN, share: 0.5 ** (depth + 1), via: [...trail].reverse() });
      } else if (trail.includes(p)) {
        // Ciclu în date (greșeală de introducere): drumul se oprește aici, socotit necunoscut.
        paths.push({ founderId: null, line: UNKNOWN, share: 0.5 ** (depth + 1), via: [...trail].reverse() });
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
  const round = (x) => Math.round(x * 1e4) / 1e2; // procent cu 2 zecimale
  const lines = [...byLine.values()]
    .map((l) => ({ name: l.name, percent: round(l.share), founders: [...l.founders] }))
    .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name, 'ro'));
  return { lines, paths };
}
