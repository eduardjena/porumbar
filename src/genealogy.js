/*
 * Genealogia, fără bază de date: arborele unui porumbel și consangvinizarea (coeficientul lui Wright).
 * Datele: Nodes = Map<id, { id, fatherId, motherId }>. Datele vechi pot avea cicluri (greșeli de introducere):
 * niciun calcul nu trece de două ori prin același porumbel pe același drum.
 */

const parentsOf = (nodes, id) => {
  const n = nodes.get(id);
  return n ? [n.fatherId, n.motherId].filter((p) => p != null) : [];
};

/**
 * Arborele cu `generations` niveluri sub rădăcină. Strămoșii care apar de mai multe ori primesc același număr
 * de grup în `repeat` (1, 2, … în ordinea primei apariții); ceilalți au `repeat: null`.
 */
export function buildTree(rootId, nodes, generations) {
  const seen = new Map();
  const order = [];
  const build = (id, depth, path) => {
    if (id == null || path.has(id)) return null;
    if (!seen.has(id)) order.push(id);
    seen.set(id, (seen.get(id) ?? 0) + 1);
    const node = { id, father: null, mother: null, repeat: null };
    if (depth < generations) {
      const n = nodes.get(id);
      const next = new Set(path).add(id);
      node.father = build(n?.fatherId ?? null, depth + 1, next);
      node.mother = build(n?.motherId ?? null, depth + 1, next);
    }
    return node;
  };
  const tree = build(rootId, 0, new Set());
  const groups = new Map();
  for (const id of order) if (seen.get(id) > 1) groups.set(id, groups.size + 1);
  const mark = (t) => {
    if (!t) return;
    t.repeat = groups.get(t.id) ?? null;
    mark(t.father);
    mark(t.mother);
  };
  mark(tree);
  return tree;
}

/** Toate drumurile în sus de la `start` (inclusiv drumul de lungime 0), de cel mult `maxGen` pași, fără noduri repetate. */
function pathsUp(start, nodes, maxGen) {
  const out = [];
  const walk = (id, path) => {
    out.push(path);
    if (path.length - 1 >= maxGen) return;
    for (const p of parentsOf(nodes, id)) if (!path.includes(p)) walk(p, [...path, p]);
  };
  walk(start, [start]);
  return out;
}

/**
 * Consangvinizarea puilor perechii (sire × dam), după Wright:
 * F = Σ (1/2)^(n1+n2+1) · (1 + F_A), peste fiecare strămoș comun A și fiecare pereche de drumuri sire→A, dam→A
 * care nu au alt porumbel comun în afară de A.
 * @returns {{ coi: number, common: { id: number, contribution: number }[] }}
 */
export function wrightCoi(sireId, damId, nodes, maxGen = 6, memo = new Map(), busy = new Set()) {
  if (sireId == null || damId == null) return { coi: 0, common: [] };
  const fOf = (a) => {
    if (memo.has(a)) return memo.get(a);
    if (busy.has(a)) return 0; // ciclu în date
    busy.add(a);
    const n = nodes.get(a);
    const f = n ? wrightCoi(n.fatherId, n.motherId, nodes, maxGen, memo, busy).coi : 0;
    busy.delete(a);
    memo.set(a, f);
    return f;
  };
  const byEnd = (paths) => {
    const m = new Map();
    for (const p of paths) {
      const end = p[p.length - 1];
      if (!m.has(end)) m.set(end, []);
      m.get(end).push(p);
    }
    return m;
  };
  const sirePaths = byEnd(pathsUp(sireId, nodes, maxGen));
  const damPaths = byEnd(pathsUp(damId, nodes, maxGen));
  const common = [];
  let coi = 0;
  for (const [a, fromSire] of sirePaths) {
    const fromDam = damPaths.get(a);
    if (!fromDam) continue;
    let sum = 0;
    for (const p1 of fromSire) {
      const set = new Set(p1.slice(0, -1));
      for (const p2 of fromDam) {
        if (p2.slice(0, -1).some((x) => set.has(x))) continue;
        sum += 0.5 ** (p1.length - 1 + (p2.length - 1) + 1);
      }
    }
    if (sum > 0) {
      const contribution = sum * (1 + fOf(a));
      coi += contribution;
      common.push({ id: a, contribution });
    }
  }
  common.sort((x, y) => y.contribution - x.contribution);
  return { coi, common };
}

/** Consangvinizarea unui porumbel = a perechii care l-a făcut. */
export function coiOf(id, nodes, maxGen = 6) {
  const n = nodes.get(id);
  if (!n || n.fatherId == null || n.motherId == null) return { coi: 0, common: [] };
  return wrightCoi(n.fatherId, n.motherId, nodes, maxGen);
}

/** Toți strămoșii cunoscuți ai unui porumbel (fără el). */
export function ancestorIds(id, nodes) {
  const out = new Set();
  const stack = [...parentsOf(nodes, id)];
  while (stack.length) {
    const p = stack.pop();
    if (out.has(p) || p === id) continue;
    out.add(p);
    stack.push(...parentsOf(nodes, p));
  }
  return out;
}
