import { getCountryCallingCode, getExampleNumber, isSupportedCountry, parsePhoneNumberFromString, validatePhoneNumberLength, type CountryCode } from 'libphonenumber-js/max';
import examples from 'libphonenumber-js/mobile/examples';
import { COUNTRY_CODES, defaultCountry } from './countries';

/*
 * Telefonul de la înscriere: țara numărului (prefixul, de ex. RO +40) se alege lângă număr. Aceleași reguli ca pe
 * server (src/phone.js), ca omul să vadă greșeala înainte de trimitere; serverul verifică oricum.
 */

/** Țara după fusul orar al telefonului / calculatorului (fără niciun serviciu extern). */
const ZONES: Record<string, string> = {
  'Europe/Bucharest': 'RO', 'Europe/Chisinau': 'MD', 'Europe/Budapest': 'HU', 'Europe/Vienna': 'AT', 'Europe/Berlin': 'DE',
  'Europe/Rome': 'IT', 'Europe/Madrid': 'ES', 'Europe/Paris': 'FR', 'Europe/London': 'GB', 'Europe/Dublin': 'IE',
  'Europe/Lisbon': 'PT', 'Europe/Brussels': 'BE', 'Europe/Amsterdam': 'NL', 'Europe/Luxembourg': 'LU', 'Europe/Zurich': 'CH',
  'Europe/Prague': 'CZ', 'Europe/Bratislava': 'SK', 'Europe/Warsaw': 'PL', 'Europe/Belgrade': 'RS', 'Europe/Zagreb': 'HR',
  'Europe/Ljubljana': 'SI', 'Europe/Sarajevo': 'BA', 'Europe/Skopje': 'MK', 'Europe/Podgorica': 'ME', 'Europe/Tirane': 'AL',
  'Europe/Sofia': 'BG', 'Europe/Athens': 'GR', 'Europe/Istanbul': 'TR', 'Europe/Kiev': 'UA', 'Europe/Kyiv': 'UA',
  'Europe/Minsk': 'BY', 'Europe/Moscow': 'RU', 'Europe/Vilnius': 'LT', 'Europe/Riga': 'LV', 'Europe/Tallinn': 'EE',
  'Europe/Helsinki': 'FI', 'Europe/Stockholm': 'SE', 'Europe/Oslo': 'NO', 'Europe/Copenhagen': 'DK', 'Europe/Malta': 'MT',
  'Asia/Nicosia': 'CY', 'Europe/Nicosia': 'CY', 'Asia/Tokyo': 'JP', 'Asia/Seoul': 'KR', 'Asia/Shanghai': 'CN', 'Asia/Taipei': 'TW',
  'Asia/Hong_Kong': 'HK', 'Asia/Manila': 'PH', 'Asia/Bangkok': 'TH', 'Asia/Singapore': 'SG', 'Asia/Dubai': 'AE',
  'Asia/Jerusalem': 'IL', 'Africa/Kampala': 'UG', 'Africa/Johannesburg': 'ZA', 'Africa/Cairo': 'EG',
  'America/New_York': 'US', 'America/Chicago': 'US', 'America/Denver': 'US', 'America/Los_Angeles': 'US', 'America/Phoenix': 'US',
  'America/Anchorage': 'US', 'America/Toronto': 'CA', 'America/Vancouver': 'CA', 'America/Sao_Paulo': 'BR',
  'America/Mexico_City': 'MX', 'America/Argentina/Buenos_Aires': 'AR', 'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU',
  'Australia/Brisbane': 'AU', 'Australia/Perth': 'AU', 'Australia/Adelaide': 'AU', 'Pacific/Auckland': 'NZ',
};

/**
 * Țara în care pare să fie omul: fusul orar, apoi regiunea limbii browserului (ro-RO, en-US), apoi limba ecranului.
 * Un maghiar din România are fusul României, deci țara rămâne România și cu ecranul în maghiară.
 */
export function guessCountry(lang: string): string {
  try {
    const zone = ZONES[Intl.DateTimeFormat().resolvedOptions().timeZone];
    if (zone) return zone;
  } catch { /* fără fus orar: mai departe */ }
  for (const l of navigator.languages ?? []) {
    const region = /^[a-z]{2,3}-([A-Z]{2})$/.exec(l)?.[1];
    if (region && (COUNTRY_CODES as readonly string[]).includes(region)) return region;
  }
  return defaultCountry(lang);
}

/** Lista prefixelor pentru <select>: „România +40”, ordonată după numele țării în limba ecranului. */
export function phoneCountries(lang: string): { code: string; name: string; dial: string }[] {
  const names = new Intl.DisplayNames([lang], { type: 'region' });
  return COUNTRY_CODES.filter((c) => isSupportedCountry(c))
    .map((code) => ({ code, name: names.of(code) ?? code, dial: `+${getCountryCallingCode(code as CountryCode)}` }))
    .sort((a, b) => a.name.localeCompare(b.name, lang));
}

export const dialOf = (country: string) => (isSupportedCountry(country) ? `+${getCountryCallingCode(country as CountryCode)}` : '+');

/** Un număr de mobil de exemplu, așa cum îl scrie omul în țara lui (de ex. 0712 345 678). */
export function examplePhone(country: string): string {
  if (!isSupportedCountry(country)) return '';
  return getExampleNumber(country as CountryCode, examples)?.formatNational() ?? '';
}

/** Ce e greșit la număr: cheia mesajului și valorile lui, sau null dacă e bun (aceleași chei ca serverul). */
export function phoneProblem(raw: string, country: string, lang: string): { key: string; vars?: Record<string, string> } | null {
  const phone = raw.trim().replace(/^00/, '+');
  const region = isSupportedCountry(country) ? (country as CountryCode) : undefined;
  if (!region && !phone.startsWith('+')) return { key: 'eroare.telefon_tara' };
  const p = parsePhoneNumberFromString(phone, region);
  const c = p?.country ?? region;
  if (!p || !c) return { key: 'eroare.telefon_invalid_fara_tara' };
  if (p.isValid()) return null;
  const vars = { tara: new Intl.DisplayNames([lang], { type: 'region' }).of(c) ?? c, prefix: `+${getCountryCallingCode(c)}` };
  // Ca pe server: regulile țării, apoi lungimea unui mobil obișnuit din țară.
  const rule = validatePhoneNumberLength(phone, region);
  const usual = getExampleNumber(c, examples)?.nationalNumber.length ?? 0;
  const n = p.nationalNumber.length;
  const length = rule === 'TOO_SHORT' || rule === 'TOO_LONG' ? rule : usual && n < usual ? 'TOO_SHORT' : usual && n > usual + 1 ? 'TOO_LONG' : null;
  if (length === 'TOO_SHORT') return { key: 'eroare.telefon_scurt', vars };
  if (length === 'TOO_LONG') return { key: 'eroare.telefon_lung', vars };
  return { key: 'eroare.telefon_invalid', vars };
}

/** Numărul scris cu „+40…” sau „0040…” își spune singur țara: o punem și în selector. */
export function countryInNumber(raw: string): string | null {
  if (!/^\s*(\+|00)/.test(raw)) return null;
  return parsePhoneNumberFromString(raw.trim().replace(/^00/, '+'))?.country ?? null;
}
