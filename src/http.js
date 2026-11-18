import { t, ref } from './i18n.js';

export class HttpError extends Error {
  /**
   * `key`: cheia mesajului din i18n/ (tradus în limba cererii de errorHandler); `vars`: valorile din mesaj.
   * `code`: identificator scurt, fix (de ex. pentru mesajele afișate pe pagina de login).
   */
  constructor(status, key, vars, code) {
    super(key);
    this.status = status;
    if (typeof vars === 'string') [vars, code] = [undefined, vars];
    this.vars = vars ?? {};
    if (code) this.code = code;
  }
}

export const badRequest = (key, vars) => new HttpError(400, key, vars);
export const notFound = (key = 'eroare.negasit', vars) => new HttpError(404, key, vars);

/** Validează un câmp text: trim, obligatoriu/opțional, lungime maximă. `field`: cheia numelui câmpului (`camp.nume`). */
export function text(value, field, { max = 1000, optional = false } = {}) {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (optional) return null;
    throw badRequest('eroare.camp_obligatoriu', { camp: ref(field) });
  }
  if (typeof value !== 'string') throw badRequest('eroare.camp_invalid', { camp: ref(field) });
  const s = value.trim();
  if (s.length > max) throw badRequest('eroare.camp_prea_lung', { camp: ref(field), max });
  return s;
}

/** O dată reală AAAA-LL-ZZ, între 1900 și 2100 (30 februarie sau anul 0000 sunt refuzate aici, cu mesaj clar). */
export function realDate(value, label = 'camp.data') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badRequest('eroare.data_forma', { camp: ref(label) });
  const d = new Date(`${value}T00:00:00Z`);
  const year = Number(value.slice(0, 4));
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value || year < 1900 || year > 2100) {
    throw badRequest('eroare.data_nereala', { camp: ref(label) });
  }
  return value;
}

export function oneOf(value, allowed, field) {
  if (!allowed.includes(value)) throw badRequest('eroare.valoare_invalida_camp', { camp: ref(field) });
  return value;
}

export function intParam(value) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw notFound();
  return n;
}

/**
 * Limitare simplă în memorie (fereastră fixă), suficientă pentru o singură instanță.
 * Cu `failuresOnly`, se numără doar cererile respinse (status ≥ 400): utilizatorii legitimi din spatele aceluiași IP
 * (o firmă întreagă, de exemplu) nu se blochează între ei.
 */
export function rateLimit({ windowMs, max, key = (req) => req.ip, failuresOnly = false }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 10_000) for (const [k, h] of hits) if (h.reset < now) hits.delete(k);
    const k = key(req);
    let h = hits.get(k);
    if (!h || h.reset < now) {
      h = { n: 0, reset: now + windowMs };
      hits.set(k, h);
    }
    // failuresOnly: încercarea se numără de la început și se scade la succes, ca cererile trimise deodată să nu
    // treacă toate înainte să se numere vreuna.
    const over = ++h.n > max;
    if (over) {
      if (failuresOnly) h.n--;
      res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ error: t(req.lang, 'eroare.prea_multe_incercari') });
    }
    if (failuresOnly) {
      const bucket = h;
      res.on('finish', () => {
        if (res.statusCode < 400) bucket.n = Math.max(0, bucket.n - 1);
      });
    }
    next();
  };
}

const INVALID_VALUE = new Set(['22P02', '22003', '22021', '22007', '22008', '22009']);
// Așteptare depășită, cerere anulată, server oprit sau în repornire, prea multe conexiuni, rețea.
const DATABASE_UNAVAILABLE = new Set(['55P03', '57014', '57P01', '57P02', '57P03', '53300', '08000', '08003', '08006', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND']);

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const lang = req.lang ?? 'ro';
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: t(lang, 'eroare.json_invalid') });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: t(lang, 'eroare.prea_mare') });
  // Erorile noastre (HttpError) au mesaje pentru utilizator, inclusiv cele 5xx (de ex. 507: spațiu plin);
  // celelalte sunt neprevăzute: se scriu în jurnal, iar utilizatorul vede doar „Eroare internă”.
  if (err instanceof HttpError) return res.status(err.status).json({ error: t(lang, err.message, err.vars) });
  // Valori pe care le refuză PostgreSQL (număr prea mare, dată imposibilă, caracter nul în text): cerere invalidă, nu o defecțiune.
  if (INVALID_VALUE.has(err.code)) return res.status(400).json({ error: t(lang, 'eroare.valoare_invalida') });
  if (DATABASE_UNAVAILABLE.has(err.code) || /timeout exceeded when trying to connect|Connection terminated/.test(err.message ?? '')) {
    console.error('[porumbar] Baza de date nu răspunde:', err.message); // i18n: ro
    return res.status(503).json({ error: t(lang, 'eroare.baza_ocupata') });
  }
  // Conflict cu o altă cerere simultană, rămas după reluări: omul poate încerca din nou.
  if (['40P01', '40001'].includes(err.code)) return res.status(503).json({ error: t(lang, 'eroare.operatie_in_curs') });
  if (err.code === '23503') return res.status(409).json({ error: t(lang, 'eroare.sters_intre_timp') });
  // Doi utilizatori creează același lucru în același moment (verificarea dinainte nu l-a văzut pe celălalt).
  if (err.code === '23505') return res.status(409).json({ error: t(lang, 'eroare.exista_deja') });
  console.error(err);
  res.status(500).json({ error: t(lang, 'eroare.interna') });
}
