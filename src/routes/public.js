import crypto from 'node:crypto';
import express from 'express';
import { config } from '../config.js';
import { one, run } from '../db.js';
import { badRequest, notFound, rateLimit } from '../http.js';
import { requireAccount } from '../accounts.js';
import { getPigeonRow } from '../pigeons.js';
import { importPedigree } from '../pedigree-import.js';
import { pedigreeV1, toImportNode } from '../pedigree-format.js';

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
