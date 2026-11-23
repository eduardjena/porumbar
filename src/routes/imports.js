import express from 'express';
import { rateLimit } from '../http.js';
import { importTable } from '../table-import.js';

/*
 * „Adu porumbeii din Excel” (montat pe /api/import/excel, după requireAccount și limita de 2 MB din app.js):
 * previzualizarea (nimic nu se salvează) și salvarea, cu același motor (src/table-import.js).
 */
export function importsRouter() {
  const r = express.Router();
  r.post('/preview', rateLimit({ windowMs: 60_000, max: 30, key: (req) => `import:${req.account.id}` }), async (req, res) => {
    res.json(await importTable(req.account.id, req.body, { save: false }));
  });
  r.post('/', async (req, res) => {
    res.status(201).json(await importTable(req.account.id, req.body, { save: true }));
  });
  return r;
}
