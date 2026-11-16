/*
 * Inelele porumbeilor, scrise în multe feluri pe pedigree-uri și în clasamente:
 *   RO-26-800546 L · 412084/15 RO · 738256/09F · RO 25 1326835 · 6008107/08 BELG M · DV-08778-24-271 · MATRICOL 0276971 + AN 2025
 * Se păstrează mereu textul original (`raw`); forma normalizată servește la comparare și afișare.
 */

/** Codurile de țară acceptate și variantele lor. Germania are inele cu număr de club (DV-08778-24-271). */
const COUNTRIES = {
  RO: 'RO', NL: 'NL', BE: 'BE', BELG: 'BE', B: 'BE', DV: 'DV', D: 'DV', DE: 'DV',
  GB: 'GB', GBR: 'GB', PL: 'PL', HU: 'HU', H: 'HU', BG: 'BG', MD: 'MD', FR: 'FR', F: 'FR',
  CZ: 'CZ', SK: 'SK', RS: 'RS', SRB: 'RS', UA: 'UA', IT: 'IT', I: 'IT', ES: 'ES', E: 'ES',
  PT: 'PT', P: 'PT', TW: 'TW', CN: 'CN', CHN: 'CN', US: 'US', USA: 'US', AT: 'AT', A: 'AT', AUS: 'AT', AUT: 'AT', CH: 'CH', DK: 'DK', DAN: 'DK',
};
// Litera de sex de la final: L/M = mascul, T/F = femelă (Compuclub folosește L/T).
const SEX = { L: 'M', M: 'M', T: 'F', F: 'F' };

const stripZeros = (s) => s.replace(/^0+(?=\d)/, '');
const country = (code) => (code ? COUNTRIES[code] ?? null : 'RO');

function fullYear(text, now) {
  if (text.length === 4) return Number(text);
  const yy = Number(text);
  return yy <= now.getFullYear() % 100 ? 2000 + yy : 1900 + yy;
}

/**
 * @returns {{ ok: boolean, unringed: boolean, raw: string, country: string|null, year: number|null,
 *            number: string|null, club: string|null, sex: 'M'|'F'|null }}
 */
export function parseRing(text, { now = new Date() } = {}) {
  const raw = typeof text === 'string' ? text.trim() : '';
  const result = { ok: false, unringed: false, raw, country: null, year: null, number: null, club: null, sex: null };
  let s = raw.toUpperCase().replace(/\s+/g, ' ');
  if (!s) return result;

  // Sexul: cuvânt separat la final („RO-26-800546 L”) sau lipit de cifre („738256/09F”).
  let m = s.match(/^(.*?)(?:\s+|(?<=\d))([LMTF])$/);
  if (m && m[1]) {
    result.sex = SEX[m[2]];
    s = m[1].trim();
  }

  // Doar zerouri: porumbel fără inel („000 M”).
  if (/^0+$/.test(s)) return { ...result, ok: true, unringed: true };

  let parts = null;
  // Țara la început: RO-26-800546, RO 25 1326835, DV-08778-24-271 (cu club).
  if ((m = s.match(/^([A-Z]{1,4})[\s-]+(\d{1,5})[\s-]+(\d{2})[\s-]+(\d+)$/)) && COUNTRIES[m[1]] === 'DV' && m[2].length > 2) {
    parts = { country: 'DV', club: stripZeros(m[2]), year: m[3], number: m[4] };
  } else if ((m = s.match(/^([A-Z]{1,4})[\s-]+(\d{2})[\s-]+(\d{3,5})[\s-]+(\d+)$/)) && COUNTRIES[m[1]]) {
    // Anul în față, apoi clubul: DV 17-01063-813 (myloft), AUS 18-301-1405 (Austria).
    parts = { country: COUNTRIES[m[1]], club: stripZeros(m[3]), year: m[2], number: m[4] };
  } else if ((m = s.match(/^([A-Z]{1,4})[\s-]+(\d{2}|\d{4})[\s-]+(\d+)$/))) {
    parts = { country: country(m[1]), year: m[2], number: m[3] };
  } else if ((m = s.match(/^(\d+)\s*[/-]\s*(\d{2}|\d{4})(?:\s+([A-Z]{1,4}))?$/))) {
    // Numărul întâi: 412084/15 RO, 6008107/08 BELG, 2091850-25.
    parts = { country: country(m[3]), year: m[2], number: m[1] };
  }
  if (!parts || !parts.country) return result;

  const number = stripZeros(parts.number);
  const out = { ...result, ok: true, country: parts.country, year: fullYear(parts.year, now), number, club: parts.club ?? null };
  if (/^0+$/.test(number)) out.unringed = true;
  return out;
}

/**
 * Afișarea uniformă: RO-25-276971, DV-08778-24-271 (Germania: clubul pe 5 cifre, înaintea anului),
 * AT-18-301-1405 (alte țări cu club: anul, clubul, numărul); un inel necitit sau lipsă rămâne cum a fost scris.
 */
export function formatRing(r) {
  if (!r?.ok || r.unringed) return r?.raw ?? '';
  const yy = String(r.year % 100).padStart(2, '0');
  if (!r.club) return `${r.country}-${yy}-${r.number}`;
  return r.country === 'DV' ? `${r.country}-${r.club.padStart(5, '0')}-${yy}-${r.number}` : `${r.country}-${yy}-${r.club}-${r.number}`;
}

/** Cheia de comparare: același inel scris în forme diferite dă aceeași cheie; null pentru inel necitit sau lipsă. */
export function ringKey(r) {
  if (!r?.ok || r.unringed) return null;
  return `${r.country}|${r.year}|${r.club ?? ''}|${r.number}`;
}

/** Inelul dintr-un rând de clasament columba.ro: coloanele MATRICOL (0276971) și AN (2025). */
export function ringFromColumba(matricol, an) {
  return parseRing(`RO-${an}-${String(matricol).trim()}`);
}
