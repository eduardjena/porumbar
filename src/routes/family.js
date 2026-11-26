import express from 'express';
import { all, run, tx, lockAccount } from '../db.js';
import { badRequest } from '../http.js';
import { requireAccount } from '../accounts.js';
import { getPigeonRow, getPigeon, loadNodes, toPigeon, toSummary } from '../pigeons.js';
import { parseRing, formatRing, ringKey, fallbackKey, japaneseRingText } from '../rings.js';
import { buildTree, wrightCoi, coiOf, ancestorIds } from '../genealogy.js';
import { bloodlines } from '../bloodlines.js';
import { COLORS } from '../catalog.js';
import { pedigreeLines } from '../results.js';

/*
 * Familia unui porumbel: alegerea părinților după inel (cu istoricul lor), rudele, arborele și consangvinizarea.
 * Toate se uită doar în porumbeii contului (căutarea în pedigree-urile publice ale altora vine odată cu pagina publică).
 */

const MAX_GENERATIONS = 10;
const OFFSPRING_ON_CARD = 20;
const round = (x) => Math.round(x * 1e6) / 1e6;

async function summaries(accountId, ids) {
  if (!ids.length) return {};
  const rows = await all('SELECT * FROM pigeons WHERE account_id = ? AND id = ANY(?::bigint[])', accountId, ids);
  return Object.fromEntries(rows.map((r) => [r.id, toSummary(r)]));
}

async function offspringOf(accountId, id) {
  const rows = await all(
    `SELECT * FROM pigeons WHERE account_id = ? AND (father_id = ? OR mother_id = ?)
      ORDER BY hatched_on DESC NULLS LAST, ring_year DESC NULLS LAST, id DESC`,
    accountId, id, id,
  );
  return rows.map(toSummary);
}

/** Cardul de istoric afișat când crescătorul scrie inelul unui părinte. */
async function historyCard(accountId, row) {
  const p = toPigeon(row);
  const map = await summaries(accountId, [p.fatherId, p.motherId].filter(Boolean));
  const offspring = await offspringOf(accountId, p.id);
  return {
    pigeon: { ...toSummary(row), breed: p.breed, lines: p.lines, hatchedOn: p.hatchedOn, pedigreeText: p.pedigreeText },
    father: map[p.fatherId] ?? null,
    mother: map[p.motherId] ?? null,
    offspringCount: offspring.length,
    offspring: offspring.slice(0, OFFSPRING_ON_CARD),
  };
}

async function coiResponse(accountId, result) {
  const map = await summaries(accountId, result.common.map((c) => c.id));
  return {
    coi: round(result.coi),
    common: result.common.map((c) => ({ pigeon: map[c.id], contribution: round(c.contribution) })),
  };
}

const idOrNull = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n <= 0) throw badRequest('eroare.parinte_invalid');
  return n;
};

export function familyRouter() {
  const r = express.Router();

  r.get('/pigeons/lookup', requireAccount, async (req, res) => {
    const raw = String(req.query.ring ?? '').trim();
    // La un cont japonez, inelul scris fără „JPN” (25-AB-01234) se caută ca JP, cum se și salvează (pigeons.js).
    const ring = parseRing(req.account.lang === 'ja' ? japaneseRingText(raw) : raw);
    const key = ringKey(ring);
    let rows = [];
    // Un porumbel fără inel („000 M”) nu se caută: două strămoși necunoscuți nu sunt același porumbel.
    if (key) rows = await all('SELECT * FROM pigeons WHERE account_id = ? AND ring_key = ? ORDER BY kind, id', req.account.id, key);
    else if (raw && !ring.unringed) {
      // Inel nerecunoscut: aceeași scriere (porumbelul propriu, după cheia de rezervă, sau textul identic).
      rows = await all('SELECT * FROM pigeons WHERE account_id = ? AND (ring_key = ? OR lower(ring_raw) = lower(?)) ORDER BY kind, id', req.account.id, fallbackKey(ring), raw);
    }
    const matches = [];
    for (const row of rows) matches.push(await historyCard(req.account.id, row));
    res.json({ ring: { ok: ring.ok, unringed: ring.unringed, raw, display: ring.ok && !ring.unringed ? formatRing(ring) : raw }, matches });
  });

  r.put('/pigeons/:id/parents', requireAccount, async (req, res) => {
    const accountId = req.account.id;
    const fatherId = idOrNull(req.body?.fatherId);
    const motherId = idOrNull(req.body?.motherId);
    const pigeon = await tx(async () => {
      await lockAccount(accountId); // două alegeri de părinți deodată nu pot face împreună un ciclu
      const child = await getPigeonRow(accountId, req.params.id);
      const father = fatherId ? await getPigeonRow(accountId, fatherId) : null;
      const mother = motherId ? await getPigeonRow(accountId, motherId) : null;
      if (father?.id === child.id || mother?.id === child.id) throw badRequest('eroare.propriul_parinte');
      if (father && mother && father.id === mother.id) throw badRequest('eroare.tata_mama_acelasi');
      if (father?.sex === 'F') throw badRequest('eroare.tata_mascul');
      if (mother?.sex === 'M') throw badRequest('eroare.mama_femela');
      const nodes = await loadNodes(accountId);
      for (const parent of [father, mother]) {
        if (parent && ancestorIds(parent.id, nodes).has(child.id)) throw badRequest('eroare.deja_urmas');
      }
      if (father && !father.sex) await run(`UPDATE pigeons SET sex = 'M' WHERE id = ?`, father.id);
      if (mother && !mother.sex) await run(`UPDATE pigeons SET sex = 'F' WHERE id = ?`, mother.id);
      await run('UPDATE pigeons SET father_id = ?, mother_id = ?, updated_at = now() WHERE id = ?', father?.id ?? null, mother?.id ?? null, child.id);
      return getPigeon(accountId, child.id);
    });
    res.json({ pigeon });
  });

  r.get('/pigeons/:id/family', requireAccount, async (req, res) => {
    const accountId = req.account.id;
    const p = toPigeon(await getPigeonRow(accountId, req.params.id));
    const map = await summaries(accountId, [p.fatherId, p.motherId].filter(Boolean));
    let fullSiblings = [];
    let halfSiblings = [];
    if (p.fatherId || p.motherId) {
      const rows = await all(
        `SELECT * FROM pigeons WHERE account_id = ? AND id <> ?
            AND ((?::bigint IS NOT NULL AND father_id = ?::bigint) OR (?::bigint IS NOT NULL AND mother_id = ?::bigint))
          ORDER BY ring_year DESC NULLS LAST, id DESC`,
        accountId, p.id, p.fatherId, p.fatherId, p.motherId, p.motherId,
      );
      for (const row of rows) {
        const both = p.fatherId && p.motherId && row.father_id === p.fatherId && row.mother_id === p.motherId;
        (both ? fullSiblings : halfSiblings).push(toSummary(row));
      }
    }
    res.json({
      father: map[p.fatherId] ?? null,
      mother: map[p.motherId] ?? null,
      fullSiblings,
      halfSiblings,
      offspring: await offspringOf(accountId, p.id),
    });
  });

  r.get('/pigeons/:id/tree', requireAccount, async (req, res) => {
    const accountId = req.account.id;
    const generations = req.query.generations === undefined ? 4 : Number(req.query.generations);
    if (!Number.isInteger(generations) || generations < 1 || generations > MAX_GENERATIONS) {
      throw badRequest('eroare.generatii_interval', { max: MAX_GENERATIONS });
    }
    const root = await getPigeonRow(accountId, req.params.id);
    const tree = buildTree(root.id, await loadNodes(accountId), generations);
    const ids = new Set();
    const collect = (t) => t && (ids.add(t.id), collect(t.father), collect(t.mother));
    collect(tree);
    // Pentru cardurile arborelui: și un text scurt de pe pedigree (titluri, palmares).
    const map = await summaries(accountId, [...ids]);
    const texts = await all(
      'SELECT id, pedigree_text, color, color_pa, color_text, breeder_text FROM pigeons WHERE account_id = ? AND id = ANY(?::bigint[])',
      accountId,
      [...ids],
    );
    const lines = await pedigreeLines(accountId);
    for (const t of texts) {
      if (!map[t.id]) continue;
      if (t.pedigree_text) map[t.id].text = t.pedigree_text.slice(0, 120);
      // Ce scrie în căsuța de pe fișa tipărită (arborele din fila Pedigree arată la fel).
      const label = COLORS.find((c) => c.code === t.color)?.label;
      map[t.id].sheet = {
        color: t.color_text || (label ? `${label}${t.color_pa ? ' p.a.' : ''}` : null),
        breeder: t.breeder_text || null,
        text: [(lines.get(t.id) ?? []).join('; '), t.pedigree_text].filter(Boolean).join('; ') || null,
      };
    }
    res.json({ tree, pigeons: map });
  });

  r.get('/pigeons/:id/coi', requireAccount, async (req, res) => {
    const root = await getPigeonRow(req.account.id, req.params.id);
    res.json(await coiResponse(req.account.id, coiOf(root.id, await loadNodes(req.account.id))));
  });

  r.get('/pigeons/:id/bloodlines', requireAccount, async (req, res) => {
    const root = await getPigeonRow(req.account.id, req.params.id);
    const rows = await all('SELECT id, father_id, mother_id, lines, breeder_text FROM pigeons WHERE account_id = ?', req.account.id);
    const result = bloodlines(root.id, new Map(rows.map((r) => [r.id, r])));
    const ids = [...new Set(result.paths.flatMap((p) => p.via))];
    res.json({ ...result, pigeons: await summaries(req.account.id, ids) });
  });

  r.get('/pairs/coi', requireAccount, async (req, res) => {
    const sire = await getPigeonRow(req.account.id, req.query.sireId);
    const dam = await getPigeonRow(req.account.id, req.query.damId);
    res.json(await coiResponse(req.account.id, wrightCoi(sire.id, dam.id, await loadNodes(req.account.id))));
  });

  return r;
}
