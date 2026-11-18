/*
 * Dicționarele (i18n/<limba>.json): același fișier îl citesc serverul și interfața.
 * ro.json are, unde e nevoie, și sensul textului ({ text, sens }), pentru cine traduce. Pluralul e un obiect cu formele
 * din Intl.PluralRules (one / few / other …). O cheie lipsă într-o limbă se arată în română.
 */
import fs from 'node:fs';
import path from 'node:path';
import { AsyncLocalStorage } from 'node:async_hooks';

const DIR = path.join(import.meta.dirname, '..', 'i18n');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));

/** @type {{ code: string, name: string, locale: string, public: boolean }[]} */
export const LANGS = readJson('languages.json');
const BY_CODE = new Map(LANGS.map((l) => [l.code, l]));
const DICTS = new Map(LANGS.map((l) => [l.code, readJson(`${l.code}.json`)]));

export const isLang = (code) => BY_CODE.has(code);
export const isPublicLang = (code) => BY_CODE.get(code)?.public === true;
export const localeOf = (lang) => BY_CODE.get(lang)?.locale ?? 'ro-RO';

/** Doar pentru teste: o cheie pusă de mână. */
export function __setForTest(lang, key, value) {
  DICTS.get(lang)[key] = value;
}

const plurals = new Map();
function pluralForm(lang, n) {
  if (!plurals.has(lang)) plurals.set(lang, new Intl.PluralRules(localeOf(lang)));
  return plurals.get(lang).select(n);
}

function entry(lang, key) {
  return DICTS.get(lang)?.[key] ?? DICTS.get('ro')[key];
}

/** O valoare tradusă și ea la afișare (de ex. numele câmpului într-un mesaj de eroare): `ref('camp.nume')`. */
export const ref = (key, vars) => ({ $t: key, vars });

/**
 * Textul cheii în limba dată; `{nume}` se înlocuiește din `vars` (o valoare `ref(...)` se traduce și ea); cu
 * `vars.count` număr se alege forma de plural.
 */
export function t(lang, key, vars = {}) {
  const lng = isLang(lang) ? lang : 'ro';
  let v = entry(lng, key);
  if (v === undefined) return key;
  if (typeof v === 'object') {
    if (typeof v.text === 'string') v = v.text;
    else {
      const form = typeof vars.count === 'number' ? pluralForm(lng, vars.count) : 'other';
      v = v[form] ?? v.other;
    }
  }
  return String(v).replace(/\{(\w+)\}/g, (m, name) => {
    const x = vars[name];
    if (x === undefined || x === null) return m;
    return typeof x === 'object' && x.$t ? t(lng, x.$t, x.vars) : String(x);
  });
}

/** Dicționarul fără sensuri, pentru interfață. */
export function flatDictionary(lang) {
  const out = {};
  for (const [k, v] of Object.entries(DICTS.get(lang) ?? {})) {
    if (typeof v === 'string') out[k] = v;
    else if (typeof v.text === 'string') out[k] = v.text;
    else out[k] = Object.fromEntries(Object.entries(v).filter(([f]) => f !== 'sens'));
  }
  return out;
}

/** Prima limbă publică din antetul Accept-Language („hu-HU,hu;q=0.9,ro;q=0.8”); altfel româna. */
export function requestLang(header) {
  for (const part of String(header ?? '').split(',')) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (isPublicLang(code)) return code;
  }
  return 'ro';
}

/*
 * Limba cererii în curs, fără s-o mai dăm din mână în mână: middleware-ul din app.js pornește fiecare cerere cu
 * `langScope`, iar requireAccount o schimbă în limba contului. În afara unei cereri (teste, sarcini de fundal): română.
 */
const scope = new AsyncLocalStorage();
export const langScope = (lang, fn) => scope.run({ lang }, fn);
export const currentLang = () => scope.getStore()?.lang ?? 'ro';
export function setCurrentLang(lang) {
  const s = scope.getStore();
  if (s) s.lang = lang;
}
/** `t` în limba cererii în curs. */
export const tr = (key, vars) => t(currentLang(), key, vars);
