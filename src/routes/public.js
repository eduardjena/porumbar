import crypto from 'node:crypto';
import express from 'express';
import { config } from '../config.js';
import { all, one, run } from '../db.js';
import { badRequest, notFound, rateLimit } from '../http.js';
import { requireAccount } from '../accounts.js';
import { getPigeonRow } from '../pigeons.js';
import { importPedigree } from '../pedigree-import.js';
import { pedigreeContext, pedigreeFrom, pedigreeV1, toImportNode } from '../pedigree-format.js';

/*
 * Linkul public / codul QR al unui porumbel (Planul 3, separare totală): singura cale prin care date dintr-un cont
 * ajung la altcineva. Proprietarul pornește linkul (token aleator), îl poate opri sau înlocui oricând; cine are linkul
 * vede pedigree-ul fără cont și, cu cont, îl poate prelua (o copie în porumbarul lui).
 */

const newToken = () => crypto.randomBytes(16).toString('base64url');
const urlOf = (token) => (token ? `${config.publicBaseUrl}/p/${token}` : null);

async function ownRow(accountId, id) {
  const row = await getPigeonRow(accountId, id);
  if (row.kind !== 'own') throw badRequest('eroare.link_doar_proprii');
  return row;
}

const MAX_SHEETS = 200;

// „3,1,7” (sau o listă) → întregi pozitivi, fără dubluri, în ordinea cerută; invalidele se ignoră.
function parseSheetIds(raw) {
  const parts = Array.isArray(raw) ? raw : String(raw ?? '').split(',');
  const ids = [];
  for (const part of parts) {
    const text = String(part).trim();
    const n = /^\d{1,15}$/.test(text) ? Number(text) : 0;
    if (n > 0 && !ids.includes(n)) ids.push(n);
  }
  if (!ids.length) throw badRequest('eroare.camp_obligatoriu', { camp: 'ids' });
  if (ids.length > MAX_SHEETS) throw badRequest('eroare.prea_multe_fise', { max: MAX_SHEETS });
  return ids;
}

async function byToken(token) {
  const row = /^[A-Za-z0-9_-]{16,64}$/.test(String(token)) ? await one('SELECT id, account_id FROM pigeons WHERE public_token = ?', token) : null;
  if (!row) throw notFound('eroare.link_invalid');
  return row;
}

export function publicRouter() {
  const r = express.Router();
  const publicLimit = rateLimit({ windowMs: 60_000, max: 60 });

  r.get('/pigeons/:id/public', requireAccount, async (req, res) => {
    const row = await getPigeonRow(req.account.id, req.params.id);
    res.json({ url: urlOf(row.public_token) });
  });

  // Pedigree-ul unui porumbel al meu în formatul deschis (pentru tipar).
  r.get('/pigeons/:id/pedigree', requireAccount, async (req, res) => {
    const row = await getPigeonRow(req.account.id, req.params.id);
    res.json(await pedigreeV1(req.account.id, row.id, { forPrint: true }));
  });

  // Fișele mai multor porumbei deodată (tipărirea tuturor).
  r.get('/sheets', requireAccount, async (req, res) => {
    const ids = parseSheetIds(req.query.ids);
    const rows = new Map((await all('SELECT id, public_token FROM pigeons WHERE account_id = ? AND id = ANY(?::bigint[])', req.account.id, ids)).map((x) => [Number(x.id), x]));
    const sheets = [];
    const ctx = await pedigreeContext(req.account.id, { forPrint: true });
    for (const id of ids) {
      const row = rows.get(id);
      if (row) sheets.push({ id, pedigree: pedigreeFrom(ctx, id), url: urlOf(row.public_token) });
    }
    res.json({ sheets });
  });

  // Pornește linkul public pentru porumbeii proprii care nu-l au; îl păstrează pe al celor care îl au.
  r.post('/sheets/public', requireAccount, async (req, res) => {
    const ids = parseSheetIds(req.body?.ids);
    const rows = new Set((await all("SELECT id FROM pigeons WHERE account_id = ? AND kind = 'own' AND id = ANY(?::bigint[])", req.account.id, ids)).map((x) => Number(x.id)));
    const sheets = [];
    for (const id of ids) {
      if (!rows.has(id)) continue;
      const done = await one("UPDATE pigeons SET public_token = COALESCE(public_token, ?) WHERE id = ? AND account_id = ? AND kind = 'own' RETURNING public_token", newToken(), id, req.account.id);
      if (done) sheets.push({ id, url: urlOf(done.public_token) });
    }
    res.json({ sheets });
  });

  r.post('/pigeons/:id/public', requireAccount, async (req, res) => {
    const row = await ownRow(req.account.id, req.params.id);
    // Atomic: zece apăsări deodată dau același link (primul pornit rămâne).
    const { public_token: token } = await one('UPDATE pigeons SET public_token = COALESCE(public_token, ?) WHERE id = ? RETURNING public_token', newToken(), row.id);
    res.json({ url: urlOf(token) });
  });

  r.post('/pigeons/:id/public/new', requireAccount, async (req, res) => {
    const row = await ownRow(req.account.id, req.params.id);
    const token = newToken();
    await run('UPDATE pigeons SET public_token = ? WHERE id = ?', token, row.id);
    res.json({ url: urlOf(token) });
  });

  r.delete('/pigeons/:id/public', requireAccount, async (req, res) => {
    const row = await getPigeonRow(req.account.id, req.params.id);
    await run('UPDATE pigeons SET public_token = NULL WHERE id = ?', row.id);
    res.status(204).end();
  });

  // Fără cont: pedigree-ul în formatul deschis.
  r.get('/public/:token', publicLimit, async (req, res) => {
    const row = await byToken(req.params.token);
    res.json(await pedigreeV1(row.account_id, row.id));
  });

  // Cu cont: „Preia în porumbarul meu” – o copie (implicit „din alt porumbar”; „own” dacă e acum al lui).
  r.post('/public/:token/import', requireAccount, publicLimit, async (req, res) => {
    const row = await byToken(req.params.token);
    if (row.account_id === req.account.id) throw badRequest('eroare.deja_al_tau');
    const kind = req.body?.kind === 'own' ? 'own' : 'external';
    const ped = await pedigreeV1(row.account_id, row.id);
    const result = await importPedigree(req.account.id, toImportNode(ped.root), kind);
    const note = `Preluat de la ${ped.owner.name} pe ${new Date().toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Bucharest' })}`;
    await run('UPDATE pigeons SET source_note = COALESCE(source_note, ?) WHERE id = ? AND account_id = ?', note, result.pigeonId, req.account.id);
    res.status(201).json(result);
  });

  return r;
}
