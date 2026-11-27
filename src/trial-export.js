import { config } from './config.js';
import { all, one } from './db.js';
import { HttpError } from './http.js';
import { ref } from './i18n.js';

/*
 * Ce poate ieși din aplicație (fișa tipărită, PDF-ul, „Trimite”, codul QR / linkul public, vânzarea), după starea contului:
 * - abonament plătit (active, expiring) și vânzătorul: tot;
 * - expired (a plătit, abonamentul a trecut): tipărește tot (termenii promit consultare și tipar), dar nu scrie nimic;
 * - trial (proba de 30 de zile): un singur porumbel, ales de om (fișa, PDF-ul și QR-ul lui), fără vânzare;
 * - trial-ended (n-a plătit niciodată) și unconfirmed: nimic. Linkurile pornite deja merg în continuare.
 * Porumbelul ales rămâne legat de inelul pe care îl avea la alegere: rescris în alt porumbel, nu mai iese.
 */

const how = () => (config.sellerContact ? ref('eroare.activare_contact', { contact: config.sellerContact }) : ref('eroare.activare_vanzator'));

/** 'all' | 'one' | 'none' pentru contul din cerere (`req.account`). */
export function exportMode(account) {
  const s = account.subscription;
  if (account.isAdmin || ['active', 'expiring', 'expired'].includes(s.status)) return 'all';
  return s.status === 'trial' ? 'one' : 'none';
}

const ringLabel = (p) => p?.ring_raw || p?.name || '—';

/** Aruncă 402 dacă fișele / linkurile acestor porumbei nu pot ieși din cont. */
export async function assertExport(account, ids) {
  const mode = exportMode(account);
  if (mode === 'all') return;
  if (mode === 'none') throw new HttpError(402, 'eroare.tipar_fara_abonament', { activare: how() });
  const chosen = account.trialPigeonId;
  if (!chosen) throw new HttpError(402, 'eroare.proba_alege_porumbel');
  const pigeon = await one('SELECT id, ring_raw, ring_key, name FROM pigeons WHERE id = ? AND account_id = ?', chosen, account.id);
  if (ids.some((id) => Number(id) !== Number(chosen))) {
    throw new HttpError(402, 'eroare.proba_un_porumbel', { inel: pigeon ? ringLabel(pigeon) : account.trialPigeonRing ?? '—' });
  }
  if (!pigeon || (pigeon.ring_key ?? null) !== (account.trialPigeonRing ?? null)) {
    throw new HttpError(402, 'eroare.proba_inel_schimbat');
  }
}

/** Omul alege porumbelul din probă (o singură dată; același porumbel de două ori e în regulă). */
export async function chooseTrialPigeon(account, pigeonId) {
  const mode = exportMode(account);
  if (mode === 'all') return;
  if (mode === 'none') throw new HttpError(402, 'eroare.tipar_fara_abonament', { activare: how() });
  const pigeon = await one('SELECT id, ring_key FROM pigeons WHERE id = ? AND account_id = ?', pigeonId, account.id);
  if (!pigeon) throw new HttpError(404, 'eroare.negasit');
  const done = await one(
    'UPDATE accounts SET trial_pigeon_id = ?, trial_pigeon_ring = ? WHERE id = ? AND trial_pigeon_id IS NULL RETURNING id',
    pigeon.id, pigeon.ring_key ?? null, account.id,
  );
  if (done) {
    account.trialPigeonId = pigeon.id;
    account.trialPigeonRing = pigeon.ring_key ?? null;
    return;
  }
  // Ales deja: dacă e același, nimic de făcut; altfel mesajul cu porumbelul ales.
  const a = await one('SELECT trial_pigeon_id, trial_pigeon_ring FROM accounts WHERE id = ?', account.id);
  account.trialPigeonId = a.trial_pigeon_id;
  account.trialPigeonRing = a.trial_pigeon_ring;
  await assertExport(account, [pigeon.id]);
}

/** Vânzătorul eliberează porumbelul din probă (de ex. omul a corectat inelul): omul poate alege din nou. */
export async function releaseTrialPigeon(accountId) {
  const rows = await all('UPDATE accounts SET trial_pigeon_id = NULL, trial_pigeon_ring = NULL WHERE id = ? RETURNING id', accountId);
  return rows.length > 0;
}

/** Vânzarea (o copie în contul altuia): doar cu abonament plătit. */
export function assertCanSell(account) {
  if (exportMode(account) === 'all') return; // expired nu ajunge aici: scrierea e oprită înainte (402)
  throw new HttpError(402, 'eroare.vanzare_fara_abonament', { activare: how() });
}
