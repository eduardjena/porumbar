import express from 'express';
import { tr } from '../i18n.js';
import { all } from '../db.js';
import { badRequest } from '../http.js';
import { requireAccount } from '../accounts.js';
import { getPigeonRow, toSummary } from '../pigeons.js';
import { buildTree, commonOf } from '../genealogy.js';
import { pigeonValue } from '../value.js';
import { COLORS } from '../catalog.js';
import { formatRing, parseRing } from '../rings.js';

/*
 * Vederile de ansamblu ale porumbarului (Planul 1b): panoul (porumbeii proprii după valoare) și rețeaua de rudenie
 * (fiecare porumbel o singură dată, muchii părinte → pui).
 */

/** Câți porumbei arată rețeaua „tot porumbarul”: așezarea grafului durează mult peste ~200 și ar bloca telefonul. */
export const networkLimit = () => Number(process.env.NETWORK_LIMIT) || 200;

const intParam = (value, fallback, min, max, field) => {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest('eroare.intre', { camp: field, min, max });
  return n;
};

async function accountRows(accountId) {
  const rows = await all('SELECT * FROM pigeons WHERE account_id = ?', accountId);
  const children = new Map();
  for (const r of rows) {
    for (const parent of [r.father_id, r.mother_id]) {
      if (parent == null) continue;
      if (!children.has(parent)) children.set(parent, []);
      children.get(parent).push(r.id);
    }
  }
  return { rows, byId: new Map(rows.map((r) => [r.id, r])), children };
}

const valueOf = (row, offspringCount) => pigeonValue({ scores: row.evaluation?.scores ?? {}, offspringCount, status: row.status });

const ringText = (row) => {
  if (!row?.ring_raw) return tr('text.fara_inel');
  const r = parseRing(row.ring_raw);
  return r.ok && !r.unringed ? formatRing(r) : row.ring_raw;
};

/**
 * Ce mai trebuie panoului ca să ordoneze, să grupeze și să filtreze (bara de sus): rezultatele pe scurt, perechea din
 * ultimul sezon, generația în porumbar, ce e de completat. Premiat = în primii 20% din porumbeii înscriși (regula 1 la 5).
 */
async function boardFacts(accountId, rows, byId) {
  const results = new Map();
  const rr = await all(
    `SELECT rr.pigeon_id, rr.place, r.entered, r.category FROM race_results rr JOIN races r ON r.id = rr.race_id WHERE rr.account_id = ?`,
    accountId,
  );
  for (const x of rr) {
    const cur = results.get(x.pigeon_id) ?? { count: 0, prizes: 0, bestPlace: null, bestPenalty: null, bestCategory: null };
    cur.count++;
    if (x.entered && x.place * 5 <= x.entered) cur.prizes++;
    if (cur.bestPlace == null || x.place < cur.bestPlace) cur.bestPlace = x.place;
    const penalty = x.entered ? Math.round((x.place * 100000) / x.entered) / 100 : null;
    if (penalty != null && (cur.bestPenalty == null || penalty < cur.bestPenalty)) {
      cur.bestPenalty = penalty;
      cur.bestCategory = x.category;
    }
    if (cur.bestCategory == null) cur.bestCategory = x.category;
    results.set(x.pigeon_id, cur);
  }

  // Perechile din ultimul sezon cu perechi: părinții și puii inelați din pontele lor.
  const pairs = await all(
    `SELECT p.* FROM pairs p WHERE p.account_id = ? AND p.season = (SELECT max(season) FROM pairs WHERE account_id = ?)
      ORDER BY p.paired_on DESC NULLS LAST, p.created_at DESC`,
    accountId,
    accountId,
  );
  const pairOf = new Map();
  const active = new Set();
  for (const p of pairs) {
    const fact = { id: Number(p.id), season: p.season, label: `${ringText(byId.get(p.cock_id))} × ${ringText(byId.get(p.hen_id))}` };
    for (const id of [p.cock_id, p.hen_id]) {
      if (!pairOf.has(id)) pairOf.set(id, fact);
      if (p.paired_on && !p.separated_on) active.add(id);
    }
  }
  if (pairs.length) {
    const young = await all(
      `SELECT pg.id, c.pair_id FROM pigeons pg JOIN clutches c ON c.id = pg.clutch_id WHERE pg.account_id = ? AND c.pair_id = ANY(?::bigint[])`,
      accountId,
      pairs.map((p) => p.id),
    );
    const byPair = new Map(pairs.map((p) => [p.id, p]));
    for (const y of young) {
      if (pairOf.has(y.id)) continue;
      const p = byPair.get(y.pair_id);
      pairOf.set(y.id, { id: Number(p.id), season: p.season, label: `${ringText(byId.get(p.cock_id))} × ${ringText(byId.get(p.hen_id))}` });
    }
  }

  // Generația în porumbar: 1 = adus din afară (fără părinți proprii), apoi pui (2), nepoți (3)…
  const gen = new Map();
  const genOf = (id, seen = new Set()) => {
    if (gen.has(id)) return gen.get(id);
    const row = byId.get(id);
    if (!row || seen.has(id)) return 0;
    seen.add(id);
    const parents = [row.father_id, row.mother_id].map((x) => byId.get(x)).filter((x) => x && x.kind === 'own');
    const g = parents.length ? 1 + Math.max(...parents.map((x) => genOf(x.id, seen))) : 1;
    gen.set(id, g);
    return g;
  };

  return (row) => {
    const missing = [];
    if (!row.sex) missing.push('sex');
    if (!row.color && !row.color_text) missing.push('culoare');
    if (!row.father_id && !row.mother_id) missing.push('parinti');
    else if (!row.father_id) missing.push('tata');
    else if (!row.mother_id) missing.push('mama');
    return {
      colorLabel: row.color_text || COLORS.find((c) => c.code === row.color)?.label || null,
      breeder: row.breeder_text || null,
      lines: row.lines ?? [],
      hatchedOn: row.hatched_on ?? null,
      createdAt: row.created_at,
      fatherId: row.father_id ?? null,
      motherId: row.mother_id ?? null,
      results: results.get(row.id) ?? null,
      pair: pairOf.get(row.id) ?? null,
      breeding: row.status === 'reproducator' || active.has(row.id),
      loftGen: genOf(row.id),
      missing,
    };
  };
}

export function viewsRouter() {
  const r = express.Router();

  r.get('/board', requireAccount, async (req, res) => {
    const { rows, byId, children } = await accountRows(req.account.id);
    const facts = await boardFacts(req.account.id, rows, byId);
    const pigeons = rows
      .filter((row) => row.kind === 'own')
      .map((row) => {
        const offspringCount = children.get(row.id)?.length ?? 0;
        return { ...toSummary(row), offspringCount, value: valueOf(row, offspringCount), facts: facts(row) };
      })
      .sort((x, y) => (y.value.score ?? -1) - (x.value.score ?? -1) || (x.ring?.display ?? '').localeCompare(y.ring?.display ?? '', 'ro'));
    res.json({ pigeons });
  });

  r.get('/network', requireAccount, async (req, res) => {
    const up = intParam(req.query.up, 5, 1, 10, 'up');
    const down = intParam(req.query.down, 3, 0, 10, 'down');
    const { rows, byId, children } = await accountRows(req.account.id);
    let ids = new Set();
    let truncated = false;
    let common = [];

    if (req.query.rootId !== undefined && req.query.rootId !== '') {
      const root = await getPigeonRow(req.account.id, req.query.rootId);
      ids.add(root.id);
      // În lățime, cu mulțime de vizitați: ciclurile vechi din date nu blochează.
      const walk = (start, depth, next) => {
        let frontier = [start];
        for (let d = 0; d < depth && frontier.length; d++) {
          const nextFrontier = [];
          for (const id of frontier) {
            for (const n of next(id)) {
              if (n == null || ids.has(n) || !byId.has(n)) continue;
              ids.add(n);
              nextFrontier.push(n);
            }
          }
          frontier = nextFrontier;
        }
      };
      walk(root.id, up, (id) => [byId.get(id)?.father_id, byId.get(id)?.mother_id]);
      walk(root.id, down, (id) => children.get(id) ?? []);
      // Strămoșii „T+M” (și la tată, și la mamă): din rândurile contului, fără altă interogare.
      const treeNodes = new Map([...byId].map(([id, row]) => [id, { id, fatherId: row.father_id ?? null, motherId: row.mother_id ?? null }]));
      common = commonOf(buildTree(root.id, treeNodes, up)).filter((id) => ids.has(id));
    } else {
      const limit = networkLimit();
      const sorted = [...rows].sort((x, y) => (toSummary(y).year ?? -1) - (toSummary(x).year ?? -1) || x.id - y.id);
      truncated = sorted.length > limit;
      ids = new Set(sorted.slice(0, limit).map((x) => x.id));
    }

    const nodes = [...ids].map((id) => {
      const row = byId.get(id);
      const s = toSummary(row);
      const offspringCount = children.get(id)?.length ?? 0;
      const v = row.kind === 'own' ? valueOf(row, offspringCount) : { score: null, band: 0 };
      return { id, ring: s.ring?.display ?? tr('text.fara_inel'), name: s.name, sex: s.sex, year: s.year, kind: s.kind, score: v.score, band: v.band, offspringCount };
    });
    const edges = [];
    for (const id of ids) {
      const row = byId.get(id);
      if (row.father_id != null && ids.has(row.father_id)) edges.push({ from: row.father_id, to: id, role: 'father' });
      if (row.mother_id != null && ids.has(row.mother_id)) edges.push({ from: row.mother_id, to: id, role: 'mother' });
    }
    res.json({ nodes, edges, truncated, common });
  });

  return r;
}
