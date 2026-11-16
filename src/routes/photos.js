import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { one, all, insert, run, tx, nowIso } from '../db.js';
import { HttpError, notFound, oneOf } from '../http.js';
import { config } from '../config.js';
import { requireAccount } from '../accounts.js';
import { getPigeonRow, whenPigeonDeleted } from '../pigeons.js';
import { whenAccountDeleted } from '../hooks.js';

const KINDS = ['corp', 'aripa', 'ochi', 'altele'];
const MAX_BYTES = 10 * 1024 * 1024;

const photosDir = () => path.resolve(config.dataDir, 'photos');
const fileOf = (id) => path.join(photosDir(), String(id));
const removeFile = (id) => fs.rmSync(fileOf(id), { force: true });

/** Tipul imaginii după primii octeți (nu după ce spune cererea). */
function sniff(buf) {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 12 && buf.toString('latin1', 0, 4) === 'RIFF' && buf.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const toPhoto = (r) => ({ id: r.id, kind: r.kind, url: `/api/photos/${r.id}`, createdAt: r.created_at });

async function photoRow(accountId, id) {
  const n = Number(id);
  const row = Number.isSafeInteger(n) ? await one('SELECT * FROM photos WHERE id = ? AND account_id = ?', n, accountId) : null;
  if (!row) throw notFound('Poza nu a fost găsită.');
  return row;
}

whenPigeonDeleted(async (pigeonId) => {
  for (const { id } of await all('SELECT id FROM photos WHERE pigeon_id = ?', pigeonId)) removeFile(id);
});
whenAccountDeleted(async (accountId) => {
  for (const { id } of await all('SELECT id FROM photos WHERE account_id = ?', accountId)) removeFile(id);
});

/** Pozele porumbelului (corp, aripă, ochi). Fișierele stau pe disc; se văd doar din contul proprietar. */
export function photosRouter() {
  const r = express.Router();

  r.get('/pigeons/:id/photos', requireAccount, async (req, res) => {
    const p = await getPigeonRow(req.account.id, req.params.id);
    const rows = await all('SELECT * FROM photos WHERE pigeon_id = ? ORDER BY id', p.id);
    res.json({ photos: rows.map(toPhoto) });
  });

  r.post('/pigeons/:id/photos', requireAccount, express.raw({ type: () => true, limit: MAX_BYTES }), async (req, res) => {
    const p = await getPigeonRow(req.account.id, req.params.id);
    const kind = oneOf(req.query.kind ?? 'altele', KINDS, 'tipul pozei');
    const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    const mime = sniff(buf);
    if (!mime) throw new HttpError(415, 'Fișierul nu este o poză (JPEG, PNG sau WEBP).');
    const row = await tx(async () => {
      const id = await insert(
        'INSERT INTO photos (pigeon_id, account_id, kind, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        p.id, req.account.id, kind, mime, buf.length, nowIso(),
      );
      fs.mkdirSync(photosDir(), { recursive: true });
      fs.writeFileSync(fileOf(id), buf);
      return one('SELECT * FROM photos WHERE id = ?', id);
    });
    res.status(201).json({ photo: toPhoto(row) });
  });

  r.get('/photos/:photoId', requireAccount, async (req, res) => {
    const row = await photoRow(req.account.id, req.params.photoId);
    if (!fs.existsSync(fileOf(row.id))) throw notFound('Fișierul pozei lipsește.');
    res.set({ 'Content-Type': row.mime, 'Cache-Control': 'private, max-age=86400' });
    res.sendFile(fileOf(row.id));
  });

  r.delete('/photos/:photoId', requireAccount, async (req, res) => {
    const row = await photoRow(req.account.id, req.params.photoId);
    await run('DELETE FROM photos WHERE id = ?', row.id);
    removeFile(row.id);
    res.status(204).end();
  });

  return r;
}
