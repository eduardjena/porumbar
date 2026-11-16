import express from 'express';
import { requireAccount } from '../accounts.js';
import { importPedigree } from '../pedigree-import.js';
import { readPedigree } from '../pedigree-reader.js';
import { rateLimit } from '../http.js';

/* Pedigree-uri întregi: importul dintr-un pas (din ecranul „Importă pedigree” sau după citirea unei poze). */
export function pedigreesRouter() {
  const r = express.Router();
  r.post('/pedigrees/import', requireAccount, async (req, res) => {
    const result = await importPedigree(req.account.id, req.body?.root, req.body?.rootKind ?? 'own');
    res.status(201).json(result);
  });
  // Citirea dintr-o poză / PDF: doar întoarce căsuțele, omul le verifică și salvează cu /import.
  r.post('/pedigrees/read', requireAccount, rateLimit({ windowMs: 60_000, max: 6, key: (req) => `read:${req.account.id}` }), async (req, res) => {
    res.json(await readPedigree(req.account.id, req.body));
  });
  return r;
}
