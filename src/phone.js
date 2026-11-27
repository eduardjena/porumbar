import { parsePhoneNumberFromString, validatePhoneNumberLength, isSupportedCountry, getCountryCallingCode, getExampleNumber } from 'libphonenumber-js/max';
import examples from 'libphonenumber-js/mobile/examples';
import { badRequest } from './http.js';

/*
 * Telefonul de la înscriere: omul alege țara numărului (prefixul, de ex. RO +40) și scrie restul numărului.
 * Îl verificăm după regulile țării (lungime, prefixe reale; mobil sau fix, ambele bune) și îl păstrăm mereu la fel,
 * în forma internațională („+40 724 582 681”). Un număr scris cu „+” sau „00” în față își alege singur țara.
 */

/** Numele țării în limba cererii (pentru mesaje). */
const countryName = (code, lang) => {
  try {
    return new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
};

/**
 * Prea scurt / prea lung: după regulile țării, iar când ele nu spun nimic, față de un număr de mobil obișnuit din țară
 * („0722 12” are 6 cifre, un mobil românesc are 9: mesajul spune „prea puține cifre”, nu doar „nu pare un număr”).
 */
export function lengthProblem(phone, region, p, country) {
  const rule = validatePhoneNumberLength(phone, region);
  if (rule === 'TOO_SHORT' || rule === 'TOO_LONG') return rule;
  const usual = getExampleNumber(country, examples)?.nationalNumber.length;
  if (!usual) return null;
  if (p.nationalNumber.length < usual) return 'TOO_SHORT';
  if (p.nationalNumber.length > usual + 1) return 'TOO_LONG';
  return null;
}

/** Numărul în forma internațională, sau 400 cu ce e greșit (cheile eroare.telefon_*). */
export function checkPhone(raw, country, lang = 'ro') {
  // „0040…” = „+40…” (prefixul internațional scris cu 00).
  const phone = String(raw ?? '').trim().replace(/^00/, '+');
  const region = typeof country === 'string' && isSupportedCountry(country) ? country : undefined;
  if (!region && !phone.startsWith('+')) throw badRequest('eroare.telefon_tara');
  const p = parsePhoneNumberFromString(phone, region);
  const where = (c) => ({ tara: countryName(c, lang), prefix: `+${getCountryCallingCode(c)}` });
  const c = p?.country ?? region;
  if (!p || !c) throw badRequest('eroare.telefon_invalid_fara_tara');
  if (p.isValid()) return p.formatInternational();
  const length = lengthProblem(phone, region, p, c);
  if (length === 'TOO_SHORT') throw badRequest('eroare.telefon_scurt', where(c));
  if (length === 'TOO_LONG') throw badRequest('eroare.telefon_lung', where(c));
  throw badRequest('eroare.telefon_invalid', where(c));
}
