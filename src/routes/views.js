import express from 'express';
import { all } from '../db.js';
import { badRequest } from '../http.js';
import { requireAccount } from '../accounts.js';
import { getPigeonRow, toSummary } from '../pigeons.js';
import { pigeonValue } from '../value.js';

/*
 * Vederile de ansamblu ale porumbarului (Planul 1b): panoul (porumbeii proprii după valoare) și rețeaua de rudenie
 * (fiecare porumbel o singură dată, muchii părinte → pui).
 */

/** Câți porumbei arată rețeaua „tot porumbarul”: așezarea grafului durează mult peste ~200 și ar bloca telefonul. */
export const networkLimit = () => Number(process.env.NETWORK_LIMIT) || 200;

const intParam = (value, fallback, min, max, field) => {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest(`„${field}” trebuie să fie între ${min} și ${max}.`);
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

export function viewsRouter() {
  const r = express.Router();

  r.get('/board', requireAccount, async (req, res) => {
    const { rows, children } = await accountRows(req.account.id);
    const pigeons = rows
      .filter((row) => row.kind === 'own')
      .map((row) => {
        const offspringCount = children.get(row.id)?.length ?? 0;
        return { ...toSummary(row), offspringCount, value: valueOf(row, offspringCount) };
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
      return { id, ring: s.ring?.display ?? 'fără inel', name: s.name, sex: s.sex, year: s.year, kind: s.kind, score: v.score, band: v.band, offspringCount };
    });
    const edges = [];
    for (const id of ids) {
      const row = byId.get(id);
      if (row.father_id != null && ids.has(row.father_id)) edges.push({ from: row.father_id, to: id, role: 'father' });
      if (row.mother_id != null && ids.has(row.mother_id)) edges.push({ from: row.mother_id, to: id, role: 'mother' });
    }
    res.json({ nodes, edges, truncated });
  });

  return r;
}
