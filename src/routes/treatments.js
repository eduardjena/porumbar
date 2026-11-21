import express from 'express';
import { requireAccount } from '../accounts.js';
import { badRequest } from '../http.js';
import { ref } from '../i18n.js';
import { TREATMENT_TARGETS, codes } from '../catalog.js';
import {
  treatmentRow, toTreatment, treatmentPigeons, listTreatments, createTreatment, updateTreatment, cancelTreatment, deleteTreatment,
  groupPigeonIds, freezeDue,
} from '../treatments.js';

/** Tratamentele și vaccinurile pe tot porumbarul sau pe grupuri. */
export function treatmentsRouter() {
  const r = express.Router();

  r.get('/treatments', requireAccount, async (req, res) => {
    await freezeDue(req.account.id, req.lang);
    res.json({ treatments: await listTreatments(req.account.id, req.lang, { stare: req.query.stare, before: req.query.before }) });
  });

  // Înaintea lui /treatments/:id.
  r.get('/treatments/count', requireAccount, async (req, res) => {
    const target = req.query.target;
    if (!codes(TREATMENT_TARGETS).includes(target) || target === 'alesi') throw badRequest('eroare.valoare_invalida_camp', { camp: ref('camp.cui') });
    res.json({ count: (await groupPigeonIds(req.account.id, target)).length });
  });

  r.get('/treatments/:id', requireAccount, async (req, res) => {
    await freezeDue(req.account.id, req.lang);
    const row = await treatmentRow(req.account.id, req.params.id);
    res.json({ treatment: await toTreatment(row, req.lang), pigeons: await treatmentPigeons(row) });
  });

  r.post('/treatments', requireAccount, async (req, res) => {
    const row = await createTreatment(req.account.id, req.lang, req.body);
    res.status(201).json({ treatment: await toTreatment(row, req.lang) });
  });

  r.patch('/treatments/:id', requireAccount, async (req, res) => {
    const row = await updateTreatment(req.account.id, req.lang, req.params.id, req.body);
    res.json({ treatment: await toTreatment(row, req.lang) });
  });

  r.post('/treatments/:id/cancel', requireAccount, async (req, res) => {
    const row = await cancelTreatment(req.account.id, req.lang, req.params.id);
    res.json({ treatment: await toTreatment(row, req.lang) });
  });

  r.delete('/treatments/:id', requireAccount, async (req, res) => {
    await deleteTreatment(req.account.id, req.params.id);
    res.status(204).end();
  });

  return r;
}
