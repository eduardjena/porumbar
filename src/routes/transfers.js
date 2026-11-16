import express from 'express';
import { all, insert, one, run, tx } from '../db.js';
import { HttpError, badRequest, notFound } from '../http.js';
import { requireAccount } from '../accounts.js';
import { getPigeonRow } from '../pigeons.js';
import { importPedigree } from '../pedigree-import.js';
import { pedigreeV1, toImportNode } from '../pedigree-format.js';

/*
 * Vânzarea prin copie (Planul 3, separare totală). Vânzătorul scrie emailul cumpărătorului; cumpărătorul vede în
 * contul lui doar inelul, numele și numele vânzătorului și acceptă. La acceptare: la cumpărător apare porumbelul
 * propriu cu pedigree-ul (strămoșii refolosiți după inel; dacă îl avea „din alt porumbar”, acel rând devine al lui),
 * plus notele și jurnalul dacă vânzătorul a bifat; la vânzător porumbelul rămâne, cu starea „Vândut”.
 */

const today = () => new Date().toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Bucharest' });

/** Vânzarea în așteptare, blocată până la sfârșitul tranzacției (două apăsări pe „Primesc” nu fac două copii). */
async function pendingFor(id, accountId, side) {
  const t = await one(`SELECT * FROM transfers WHERE id = ? AND ${side} = ? FOR UPDATE`, Number(id) || 0, accountId);
  if (!t) throw notFound('Vânzarea nu a fost găsită.');
  if (t.status !== 'pending') throw new HttpError(409, t.status === 'accepted' ? 'Vânzarea a fost deja primită.' : 'Vânzarea a fost anulată.');
  return t;
}

export function transfersRouter() {
  const r = express.Router();

  r.post('/pigeons/:id/transfers', requireAccount, async (req, res) => {
    const pigeon = await getPigeonRow(req.account.id, req.params.id);
    if (pigeon.kind !== 'own') throw badRequest('Poți vinde doar porumbei din porumbarul tău.');
    const email = String(req.body?.email ?? '').trim();
    if (!email) throw badRequest('Scrie emailul cumpărătorului.');
    const buyer = await one('SELECT id FROM accounts WHERE lower(email) = lower(?)', email);
    if (!buyer) throw notFound('Nu există un cont cu acest email. Cumpărătorul trebuie să-și facă întâi cont în Porumbar, iar contul să fie activ.');
    if (buyer.id === req.account.id) throw badRequest('Acesta e emailul contului tău.');
    if (await one(`SELECT 1 FROM transfers WHERE pigeon_id = ? AND status = 'accepted'`, pigeon.id)) {
      throw new HttpError(409, 'Porumbelul a fost deja vândut.');
    }
    if (await one(`SELECT 1 FROM transfers WHERE pigeon_id = ? AND status = 'pending'`, pigeon.id)) {
      throw new HttpError(409, 'Porumbelul are deja o vânzare în așteptare. Anuleaz-o întâi.');
    }
    const id = await insert(
      `INSERT INTO transfers (pigeon_id, from_account, to_account, include_private, status, created_at) VALUES (?, ?, ?, ?, 'pending', now())`,
      pigeon.id, req.account.id, buyer.id, req.body?.includePrivate === true,
    );
    res.status(201).json({ transfer: { id, status: 'pending' } });
  });

  r.get('/transfers', requireAccount, async (req, res) => {
    const me = req.account.id;
    // Cumpărătorul: doar inelul, numele și vânzătorul (nimic altceva din contul vânzătorului).
    const incoming = await all(
      `SELECT t.id, t.include_private, t.created_at, p.ring_raw, p.name, a.name AS seller
         FROM transfers t JOIN pigeons p ON p.id = t.pigeon_id JOIN accounts a ON a.id = t.from_account
        WHERE t.to_account = ? AND t.status = 'pending' ORDER BY t.created_at DESC`, me,
    );
    const outgoing = await all(
      `SELECT t.id, t.pigeon_id, t.status, t.include_private, t.created_at, t.decided_at, a.email AS buyer
         FROM transfers t JOIN accounts a ON a.id = t.to_account
        WHERE t.from_account = ? AND (?::bigint IS NULL OR t.pigeon_id = ?::bigint) ORDER BY t.created_at DESC LIMIT 100`,
      me, Number(req.query.pigeon) || null, Number(req.query.pigeon) || null,
    );
    const { parseRing, formatRing } = await import('../rings.js');
    const ring = (raw) => {
      const p = raw ? parseRing(raw) : null;
      return p?.ok && !p.unringed ? formatRing(p) : raw;
    };
    res.json({
      incoming: incoming.map((t) => ({ id: t.id, ring: ring(t.ring_raw), name: t.name, sellerName: t.seller, includePrivate: t.include_private, createdAt: t.created_at })),
      outgoing: outgoing.map((t) => ({ id: t.id, pigeonId: t.pigeon_id, status: t.status, buyerEmail: t.buyer, includePrivate: t.include_private, createdAt: t.created_at, decidedAt: t.decided_at })),
    });
  });

  r.post('/transfers/:id/accept', requireAccount, async (req, res) => {
    const buyer = req.account.id;
    const result = await tx(async () => {
      const t = await pendingFor(req.params.id, buyer, 'to_account');
      const seller = await one('SELECT name FROM accounts WHERE id = ?', t.from_account);
      const ped = await pedigreeV1(t.from_account, t.pigeon_id);
      const imported = await importPedigree(buyer, toImportNode(ped.root), 'own');
      // Notele și jurnalul vânzătorului intră doar într-un porumbel nou la cumpărător (sau un fost strămoș „din alt
      // porumbar”), niciodată peste notele lui (de ex. când își cumpără înapoi un porumbel vândut).
      const copyPrivate = t.include_private && imported.rootWas !== 'existing';
      const src = await one('SELECT * FROM pigeons WHERE id = ?', t.pigeon_id);
      await run(
        `UPDATE pigeons SET source_note = ?, breed = COALESCE(breed, ?), lines = CASE WHEN cardinality(lines) = 0 THEN ? ELSE lines END,
                eye_color = COALESCE(eye_color, ?), hatched_on = COALESCE(hatched_on, ?),
                status = CASE WHEN status = 'vandut' THEN NULL ELSE status END
                ${copyPrivate ? ', evaluation = ?' : ''}
          WHERE id = ? AND account_id = ?`,
        `Cumpărat de la ${seller.name} pe ${today()}`, src.breed, src.lines, src.eye_color, src.hatched_on,
        ...(copyPrivate ? [JSON.stringify(src.evaluation ?? {})] : []), imported.pigeonId, buyer,
      );
      if (copyPrivate) {
        await run(
          `INSERT INTO journal_entries (pigeon_id, account_id, entry_date, type, text, created_at)
           SELECT ?, ?, entry_date, type, text, now() FROM journal_entries WHERE pigeon_id = ? ORDER BY entry_date, id`,
          imported.pigeonId, buyer, t.pigeon_id,
        );
      }
      await run(`UPDATE pigeons SET status = 'vandut', updated_at = now() WHERE id = ?`, t.pigeon_id);
      await run(`UPDATE transfers SET status = 'accepted', decided_at = now() WHERE id = ?`, t.id);
      return imported;
    });
    res.json({ pigeonId: result.pigeonId, conflicts: result.conflicts });
  });

  r.post('/transfers/:id/cancel', requireAccount, async (req, res) => {
    const me = req.account.id;
    await tx(async () => {
      // Blocat ca la acceptare: dacă cumpărătorul tocmai a primit porumbelul, anularea vede „primit” și se oprește.
      const t = await one('SELECT * FROM transfers WHERE id = ? AND (from_account = ? OR to_account = ?) FOR UPDATE', Number(req.params.id) || 0, me, me);
      if (!t) throw notFound('Vânzarea nu a fost găsită.');
      if (t.status !== 'pending') throw new HttpError(409, t.status === 'accepted' ? 'Porumbelul a fost deja primit; vânzarea nu se mai poate anula.' : 'Vânzarea nu mai e în așteptare.');
      await run(`UPDATE transfers SET status = 'cancelled', decided_at = now() WHERE id = ? AND status = 'pending'`, t.id);
    });
    res.json({ ok: true });
  });

  return r;
}
