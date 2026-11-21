import express from 'express';
import { one, all, run, insert, nowIso } from '../db.js';
import { HttpError, badRequest, notFound, text, oneOf, realDate } from '../http.js';
import { requireAccount } from '../accounts.js';
import { getPigeonRow } from '../pigeons.js';
import { JOURNAL_TYPES, codes } from '../catalog.js';

const toEntry = (r) => ({ id: r.id, date: r.entry_date, type: r.type, text: r.text, treatmentId: r.treatment_id ?? null });

const validDate = (value) => realDate(value, 'camp.data');

/** Jurnalul porumbelului: note, tratamente, vaccinuri, antrenamente — cu dată. */
export function journalRouter() {
  const r = express.Router();

  r.get('/pigeons/:id/journal', requireAccount, async (req, res) => {
    const p = await getPigeonRow(req.account.id, req.params.id);
    const rows = await all('SELECT * FROM journal_entries WHERE pigeon_id = ? ORDER BY entry_date DESC, id DESC', p.id);
    res.json({ entries: rows.map(toEntry) });
  });

  r.post('/pigeons/:id/journal', requireAccount, async (req, res) => {
    const p = await getPigeonRow(req.account.id, req.params.id);
    const date = validDate(req.body?.date);
    const type = oneOf(req.body?.type, codes(JOURNAL_TYPES), 'camp.tip');
    const body = text(req.body?.text, 'camp.text', { max: 4000 });
    const id = await insert(
      'INSERT INTO journal_entries (pigeon_id, account_id, entry_date, type, text, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      p.id, req.account.id, date, type, body, nowIso(),
    );
    res.status(201).json({ entry: toEntry(await one('SELECT * FROM journal_entries WHERE id = ?', id)) });
  });

  r.delete('/journal/:entryId', requireAccount, async (req, res) => {
    const id = Number(req.params.entryId);
    const row = Number.isSafeInteger(id) ? await one('SELECT treatment_id FROM journal_entries WHERE id = ? AND account_id = ?', id, req.account.id) : null;
    if (!row) throw notFound('eroare.intrare_negasita');
    // Intrarea scrisă de un tratament se schimbă doar din tratament.
    if (row.treatment_id) throw new HttpError(409, 'eroare.intrare_din_tratament');
    await run('DELETE FROM journal_entries WHERE id = ? AND account_id = ?', id, req.account.id);
    res.status(204).end();
  });

  return r;
}
