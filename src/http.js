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
    const over = failuresOnly ? h.n >= max : ++h.n > max;
    if (over) {
      res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return res.status(429).json({ error: 'Prea multe încercări. Reîncearcă puțin mai târziu.' });
    }
    if (failuresOnly) {
      const bucket = h;
      res.on('finish', () => {
        if (res.statusCode >= 400) bucket.n++;
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
  // Doi utilizatori creează același lucru în același moment (verificarea dinainte nu l-a văzut pe celălalt).
  if (err.code === '23505') return res.status(409).json({ error: 'Există deja o înregistrare cu aceste date.' });
  console.error(err);
  res.status(500).json({ error: 'Eroare internă.' });
}
