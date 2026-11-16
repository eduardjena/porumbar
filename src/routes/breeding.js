import express from 'express';
import { requireAccount } from '../accounts.js';
import * as b from '../breeding.js';

/** Reproducția: perechi, ponte, inelarea puilor, seriile de inele (toate ale contului). */
export function breedingRouter() {
  const r = express.Router();
  const a = (req) => req.account.id;

  r.get('/pairs', requireAccount, async (req, res) => res.json(await b.listPairs(a(req), req.query.season)));
  r.post('/pairs', requireAccount, async (req, res) => res.status(201).json({ pair: await b.createPair(a(req), req.body) }));
  r.get('/pairs/:id', requireAccount, async (req, res) => res.json({ pair: await b.getPair(a(req), req.params.id) }));
  r.patch('/pairs/:id', requireAccount, async (req, res) => res.json({ pair: await b.updatePair(a(req), req.params.id, req.body) }));
  r.delete('/pairs/:id', requireAccount, async (req, res) => {
    await b.deletePair(a(req), req.params.id);
    res.status(204).end();
  });

  r.post('/pairs/:id/clutches', requireAccount, async (req, res) => res.status(201).json({ clutch: await b.createClutch(a(req), req.params.id, req.body) }));
  r.patch('/clutches/:id', requireAccount, async (req, res) => res.json({ clutch: await b.updateClutch(a(req), req.params.id, req.body) }));
  r.delete('/clutches/:id', requireAccount, async (req, res) => {
    await b.deleteClutch(a(req), req.params.id);
    res.status(204).end();
  });
  r.post('/clutches/:id/young', requireAccount, async (req, res) => res.status(201).json({ pigeon: await b.ringYoung(a(req), req.params.id, req.body) }));

  r.get('/ring-series', requireAccount, async (req, res) => res.json({ series: await b.listSeries(a(req)) }));
  r.post('/ring-series', requireAccount, async (req, res) => res.status(201).json({ series: await b.createSeries(a(req), req.body) }));
  r.get('/ring-series/next', requireAccount, async (req, res) => res.json({ ring: await b.nextRing(a(req), req.query.year) }));
  r.delete('/ring-series/:id', requireAccount, async (req, res) => {
    await b.deleteSeries(a(req), req.params.id);
    res.status(204).end();
  });

  return r;
}
