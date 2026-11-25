import { Pipe, PipeTransform, signal } from '@angular/core';
import roDictionary from '../../../../i18n/ro.json';
import languages from '../../../../i18n/languages.json';
import { loadJapaneseFont } from './font-ja';
import { glueWith } from './glue';

/*
 * Textele aplicației vin din i18n/<limba>.json (aceleași fișiere le citește și serverul). Româna e în pachet; celelalte
 * limbi se aduc de la /i18n/<limba>.json când e nevoie. O cheie lipsă într-o limbă se arată în română.
 */
export interface Lang {
  code: string;
  name: string;
  locale: string;
  public: boolean;
  /** Semnele limbii, dacă nu sunt cele din șabloane (vezi `glue`). */
  semne?: Record<string, string>;
}
type Plural = Partial<Record<Intl.LDMLPluralRule, string>>;
type Entry = string | Plural;
type Dictionary = Record<string, Entry>;

export const LANGS: Lang[] = languages;

/** ro.json are și sensurile ({ text, sens }), pentru traducători; aici rămâne doar textul. */
function withoutMeaning(d: Record<string, unknown>): Dictionary {
  const out: Dictionary = {};
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === 'string') out[k] = v;
    else if (v && typeof v === 'object') {
      const o = v as Record<string, string>;
      if (typeof o['text'] === 'string') out[k] = o['text'];
      else out[k] = Object.fromEntries(Object.entries(o).filter(([f]) => f !== 'sens')) as Plural;
    }
  }
  return out;
}

const dictionaries = new Map<string, Dictionary>([['ro', withoutMeaning(roDictionary as Record<string, unknown>)]]);
const lang = signal('ro');
/** Limba ecranului. */
export const currentLang = lang.asReadonly();

export const isLang = (code: string | null | undefined): code is string => LANGS.some((l) => l.code === code);
export const isPublicLang = (code: string | null | undefined) => LANGS.some((l) => l.code === code && l.public);
export const publicLangs = () => LANGS.filter((l) => l.public);
export const localeOf = (code: string = lang()) => LANGS.find((l) => l.code === code)?.locale ?? 'ro-RO';

const plurals = new Map<string, Intl.PluralRules>();
function pluralForm(code: string, n: number): Intl.LDMLPluralRule {
  if (!plurals.has(code)) plurals.set(code, new Intl.PluralRules(localeOf(code)));
  return plurals.get(code)!.select(n);
}

/** Textul cheii într-o limbă anume (de ex. fișa tipărită în altă limbă decât ecranul). */
export function tIn(code: string, key: string, vars: Record<string, unknown> = {}): string {
  const d = dictionaries.get(code) ?? dictionaries.get('ro')!;
  let v: Entry | undefined = d[key] ?? dictionaries.get('ro')![key];
  if (v === undefined) return key;
  if (typeof v !== 'string') {
    const form = typeof vars['count'] === 'number' ? pluralForm(code, vars['count'] as number) : 'other';
    v = v[form] ?? v.other ?? '';
  }
  return v.replace(/\{(\w+)\}/g, (m, name: string) => (vars[name] === undefined || vars[name] === null ? m : String(vars[name])));
}

/** Textul cheii în limba ecranului (citește semnalul, deci șabloanele se refac la schimbarea limbii). */
export const t = (key: string, vars?: Record<string, unknown>) => tIn(lang(), key, vars);

/** Un semn lipit între bucăți traduse („, ”, „).”, un spațiu), în limba dată: în japoneză 、 ）。 și fără spațiu. */
export const glueIn = (code: string, text: string) => glueWith(LANGS.find((l) => l.code === code)?.semne, text);
/** `glueIn` în limba ecranului. */
export const glue = (text: string) => glueIn(lang(), text);

/** Aduce dicționarul unei limbi și fontul ei (fără să schimbe limba ecranului). */
export async function ensureLang(code: string): Promise<void> {
  if (code === 'ja') void loadJapaneseFont(); // fără așteptare: textul apare cu fontul sistemului și se schimbă când vine
  if (dictionaries.has(code)) return;
  const r = await fetch(`/i18n/${code}.json`, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`/i18n/${code}.json: ${r.status}`);
  dictionaries.set(code, (await r.json()) as Dictionary);
}

/** Schimbă limba ecranului; dacă dicționarul nu vine, rămâne româna. */
export async function useLang(code: string | null | undefined): Promise<void> {
  let next = isLang(code) ? code : 'ro';
  try {
    await ensureLang(next);
  } catch {
    next = 'ro';
  }
  lang.set(next);
  document.documentElement.lang = next;
}

const GUEST_KEY = 'porumbar.limba';
/** Fără cont: limba aleasă pe acest telefon, altfel limba telefonului (doar limbile publice), altfel româna. */
export function guestLang(): string {
  try {
    const saved = localStorage.getItem(GUEST_KEY);
    if (isPublicLang(saved)) return saved!;
  } catch {
    /* fără spațiu local */
  }
  for (const l of navigator.languages ?? []) {
    const code = l.slice(0, 2).toLowerCase();
    if (isPublicLang(code)) return code;
  }
  return 'ro';
}
export function rememberGuestLang(code: string) {
  try {
    localStorage.setItem(GUEST_KEY, code);
  } catch {
    /* fără spațiu local: rămâne doar pe pagina deschisă */
  }
}

// ——— Formatarea după limbă ———

/** O zi „AAAA-LL-ZZ” (fără fus orar): 18.11.2026 în română, 2026. 11. 18. în maghiară, 2026/11/18 în japoneză. */
export const formatDay = (d: string | null | undefined) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString(localeOf()) : '');
export const formatDate = (d: string | Date, opts?: Intl.DateTimeFormatOptions) => new Date(d).toLocaleDateString(localeOf(), opts);
export const formatDateTime = (d: string | Date, opts?: Intl.DateTimeFormatOptions) => new Date(d).toLocaleString(localeOf(), opts);
export const formatTime = (d: string | Date, opts?: Intl.DateTimeFormatOptions) => new Date(d).toLocaleTimeString(localeOf(), opts);
export const formatNumber = (n: number, opts?: Intl.NumberFormatOptions) => n.toLocaleString(localeOf(), opts);
/** Suma în dolari, cu 2 zecimale („5,00 $”). */
export const formatMoney = (n: number) => `${formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

/** `{{ 'panou.titlu' | t }}`, `{{ 'x' | t: { count: n } }}`. */
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  transform(key: string, vars?: Record<string, unknown>): string {
    return t(key, vars);
  }
}

/** `{{ '. ' | glue }}`: semnul lipit între două bucăți traduse, în limba ecranului. */
@Pipe({ name: 'glue', pure: false })
export class GluePipe implements PipeTransform {
  transform(text: string): string {
    return glue(text);
  }
}
