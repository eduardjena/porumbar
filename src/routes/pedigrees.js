import express from 'express';
import { requireAccount } from '../accounts.js';
import { importPedigree } from '../pedigree-import.js';

/* Pedigree-uri întregi: importul dintr-un pas (din ecranul „Pedigree pe hârtie” sau după citirea unei poze). */
export function pedigreesRouter() {
  const r = express.Router();
  r.post('/pedigrees/import', requireAccount, async (req, res) => {
    const result = await importPedigree(req.account.id, req.body?.root, req.body?.rootKind ?? 'own');
    res.status(201).json(result);
  });
  return r;
}
