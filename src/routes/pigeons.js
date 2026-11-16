import express from 'express';
import { requireAccount } from '../accounts.js';
import { createPigeon, updatePigeon, deletePigeon, getPigeon, listPigeons } from '../pigeons.js';

export function pigeonsRouter() {
  const r = express.Router();
  r.use(requireAccount);

  r.get('/', async (req, res) => res.json({ pigeons: await listPigeons(req.account.id, req.query) }));
  r.post('/', async (req, res) => res.status(201).json({ pigeon: await createPigeon(req.account.id, req.body) }));
  // Un id nenumeric ajunge la getPigeonRow, care răspunde 404.
  r.get('/:id', async (req, res) => res.json({ pigeon: await getPigeon(req.account.id, req.params.id) }));
  r.patch('/:id', async (req, res) => res.json({ pigeon: await updatePigeon(req.account.id, req.params.id, req.body) }));
  r.delete('/:id', async (req, res) => {
    await deletePigeon(req.account.id, req.params.id);
    res.status(204).end();
  });
  return r;
}
