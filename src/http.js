export class HttpError extends Error {
  /** `code`: identificator scurt, fix (de ex. pentru mesajele afișate pe pagina de login). */
  constructor(status, message, code) {
    super(message);
    this.status = status;
    if (code) this.code = code;
  }
}

export const badRequest = (message) => new HttpError(400, message);
export const notFound = (message = 'Nu a fost găsit.') => new HttpError(404, message);

/** Validează un câmp text: trim, obligatoriu/opțional, lungime maximă. */
export function text(value, field, { max = 1000, optional = false } = {}) {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    if (optional) return null;
    throw badRequest(`Câmpul „${field}” este obligatoriu.`);
  }
  if (typeof value !== 'string') throw badRequest(`Câmpul „${field}” este invalid.`);
  const s = value.trim();
  if (s.length > max) throw badRequest(`Câmpul „${field}” depășește ${max} caractere.`);
  return s;
}

/** O dată reală AAAA-LL-ZZ, între 1900 și 2100 (30 februarie sau anul 0000 sunt refuzate aici, cu mesaj clar). */
export function realDate(value, label = 'Data') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw badRequest(`${label} trebuie să fie de forma AAAA-LL-ZZ.`);
  const d = new Date(`${value}T00:00:00Z`);
  const year = Number(value.slice(0, 4));
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value || year < 1900 || year > 2100) {
    throw badRequest(`${label} nu este o dată reală.`);
  }
  return value;
}

export function oneOf(value, allowed, field) {
  if (!allowed.includes(value)) throw badRequest(`Valoare invalidă pentru „${field}”.`);
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
      return res.status(429).json({ error: 'Prea multe încercări. Reîncearcă puțin mai târziu.' });
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
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalid.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Conținut prea mare.' });
  // Erorile noastre (HttpError) au mesaje pentru utilizator, inclusiv cele 5xx (de ex. 507: spațiu plin);
  // celelalte sunt neprevăzute: se scriu în jurnal, iar utilizatorul vede doar „Eroare internă”.
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  // Valori pe care le refuză PostgreSQL (număr prea mare, dată imposibilă, caracter nul în text): cerere invalidă, nu o defecțiune.
  if (INVALID_VALUE.has(err.code)) return res.status(400).json({ error: 'Valoare invalidă.' });
  if (DATABASE_UNAVAILABLE.has(err.code) || /timeout exceeded when trying to connect|Connection terminated/.test(err.message ?? '')) {
    console.error('[porumbar] Baza de date nu răspunde:', err.message);
    return res.status(503).json({ error: 'Baza de date este ocupată sau indisponibilă. Reîncearcă în câteva momente.' });
  }
  // Conflict cu o altă cerere simultană, rămas după reluări: omul poate încerca din nou.
  if (['40P01', '40001'].includes(err.code)) return res.status(503).json({ error: 'Altă operație pe aceleași date era în curs. Încearcă din nou.' });
  if (err.code === '23503') return res.status(409).json({ error: 'Porumbelul a fost șters sau schimbat între timp. Reîncarcă pagina.' });
  // Doi utilizatori creează același lucru în același moment (verificarea dinainte nu l-a văzut pe celălalt).
  if (err.code === '23505') return res.status(409).json({ error: 'Există deja o înregistrare cu aceste date.' });
  console.error(err);
  res.status(500).json({ error: 'Eroare internă.' });
}
