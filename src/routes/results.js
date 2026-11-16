import express from 'express';
import { requireAccount } from '../accounts.js';
import { getPigeonRow } from '../pigeons.js';
import { addResult, deleteResult, listRaces, listResults, updateResult } from '../results.js';

/** Rezultatele la concursuri ale porumbeilor contului, introduse de mână. */
export function resultsRouter() {
  const r = express.Router();

  r.get('/pigeons/:id/results', requireAccount, async (req, res) => {
    const p = await getPigeonRow(req.account.id, req.params.id);
    res.json({ results: await listResults(req.account.id, p.id) });
  });

  r.post('/pigeons/:id/results', requireAccount, async (req, res) => {
    const p = await getPigeonRow(req.account.id, req.params.id);
    res.status(201).json({ result: await addResult(req.account.id, p.id, req.body) });
  });

  r.patch('/results/:id', requireAccount, async (req, res) => res.json({ result: await updateResult(req.account.id, req.params.id, req.body) }));

  r.delete('/results/:id', requireAccount, async (req, res) => {
    await deleteResult(req.account.id, req.params.id);
    res.status(204).end();
  });

  r.get('/races', requireAccount, async (req, res) => res.json({ races: await listRaces(req.account.id) }));

  return r;
}
