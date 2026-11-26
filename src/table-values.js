import { fold, BREEDS, EYE_COLORS, STATUSES } from './catalog.js';
import { parseRing } from './rings.js';
import { t } from './i18n.js';

/*
 * Citirea valorilor din celulele unei tabele aduse (Excel / CSV): sex, rasă, culoarea ochilor, stare, linii de sânge,
 * dată și țara inelului. Funcții pure, fără bază de date; textul necunoscut dă `null` (sau valoarea implicită), nu eroare.
 */

const SEX_WORDS = {
  M: ['m', 'mascul', 'masc', 'h', 'him', 'cock', 'doffer', 'tauber', 'male', '♂', 'オス', '雄'],
  F: ['f', 'femela', 'fem', 't', 'tojo', 'hen', 'duivin', 'taubin', 'femelle', 'female', '♀', 'メス', '雌'],
};
const SEX_BY_WORD = new Map(Object.entries(SEX_WORDS).flatMap(([sex, words]) => words.map((w) => [w, sex])));

/** Sexul din text: 'M' | 'F' | null. */
export function readSex(text) {
  // NFKC: „ｵｽ” (katakana îngustă) și formele late se aduc la cele obișnuite.
  return SEX_BY_WORD.get(fold(String(text ?? '').normalize('NFKC'))) ?? null;
}

/**
 * Codul dintr-o listă de catalog, după cod sau după numele din interfață (română, maghiară sau japoneză); `dictKeys` e
 * prefixul cheilor din i18n („catalog.stare”). Fără potrivire: null.
 */
export function readCode(text, list, dictKeys) {
  const f = fold(text);
  if (!f) return null;
  for (const { code } of list) {
    if (fold(code) === f) return code;
    for (const lang of ['ro', 'hu', 'ja']) {
      const name = t(lang, `${dictKeys}.${code}`);
      if (name !== `${dictKeys}.${code}` && fold(name) === f) return code;
    }
  }
  return null;
}

/** Rasa: gol → voiajor, necunoscută → alta. */
export function readBreed(text) {
  if (!fold(text)) return 'voiajor';
  return readCode(text, BREEDS, 'catalog.rasa') ?? 'alta';
}

export const readEyeColor = (text) => readCode(text, EYE_COLORS, 'catalog.ochi');
export const readStatus = (text) => readCode(text, STATUSES, 'catalog.stare');

/** Liniile de sânge: despărțite la `,` `;` `/` (și semnele japoneze `、` `，` `；` `／`), cel mult 10. */
export function readLines(text) {
  return String(text ?? '')
    .split(/[,、，;；/／]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}

// Ora de după dată, lăsată deoparte: „05.04.2024 00:00”, „2024-04-05T00:00:00Z”, „4/5/2024 12:00 AM”.
const TIME = /(?:\s+|T)\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*(?:[AP]M)?\s*(?:Z|[+-]\d{2}:?\d{2})?$/i;
const SLASH = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/**
 * Ordinea zilei și a lunii în datele cu „/” ale unei coloane: dacă o valoare are prima parte peste 12, 'dm'; altfel,
 * dacă una are a doua parte peste 12, 'md' (fișierele americane); altfel 'dm' (ca în România).
 */
export function slashOrder(values) {
  let md = false;
  for (const v of values) {
    const x = String(v ?? '').trim().replace(TIME, '').match(SLASH);
    if (!x) continue;
    if (Number(x[1]) > 12) return 'dm';
    if (Number(x[2]) > 12) md = true;
  }
  return md ? 'md' : 'dm';
}

// Primul an al fiecărei ere japoneze (și prescurtările R / H / S).
// Ultimul an al erei (令和 fără limită): peste el data nu există.
const ERA_START = { 令和: 2019, 平成: 1989, 昭和: 1926, R: 2019, H: 1989, S: 1926 };
const ERA_MAX = { 令和: Infinity, 平成: 31, 昭和: 64, R: Infinity, H: 31, S: 64 };

/**
 * Data ca AAAA-LL-ZZ din AAAA-LL-ZZ, AAAA.LL.ZZ, „AAAA. LL. ZZ.” (maghiar), ZZ.LL.AAAA și ZZ/LL/AAAA (LL/ZZ/AAAA cu
 * `order` = 'md', vezi slashOrder), plus cele japoneze: AAAA/L/Z, AAAA年L月Z日, era (令和7年11月25日, 令和元年, R7.11.25),
 * cu sau fără oră după ea (prescurtările R/H/S doar cu `options.lang` = 'ja'); un an singur, o lună fără zi sau o dată inexistentă → null.
 */
export function readDate(text, order = 'dm', { lang = null } = {}) {
  const s = String(text ?? '').normalize('NFKC').trim().replace(TIME, ''); // NFKC: cifrele late (２０２５) devin obișnuite
  let y, m, d, x;
  if ((x = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/) || s.match(/^(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?$/))) [, y, m, d] = x;
  else if ((x = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) [, d, m, y] = x;
  else if ((x = s.match(SLASH))) [, d, m, y] = order === 'md' ? [x[0], x[2], x[1], x[3]] : x;
  else if ((x = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/) || s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日?$/))) [, y, m, d] = x;
  else if ((x = s.match(/^(令和|平成|昭和)(元|\d{1,2})年(\d{1,2})月(\d{1,2})日?$/) || (lang === 'ja' && s.match(/^([RHS])(\d{1,2})\.(\d{1,2})\.(\d{1,2})$/i)))) {
    // Era japoneză: anul 1 al erei e anul ei de început (令和 2019, 平成 1989, 昭和 1926); „元” = anul 1.
    const era = x[1].toUpperCase();
    const n = x[2] === '元' ? 1 : Number(x[2]);
    if (n < 1 || n > ERA_MAX[era]) return null;
    y = ERA_START[era] + n - 1;
    [, , , m, d] = x;
  } else return null;
  const [Y, M, D] = [Number(y), Number(m), Number(d)];
  const dt = new Date(Date.UTC(Y, M - 1, D));
  if (dt.getUTCFullYear() !== Y || dt.getUTCMonth() !== M - 1 || dt.getUTCDate() !== D) return null;
  return `${String(Y).padStart(4, '0')}-${String(M).padStart(2, '0')}-${String(D).padStart(2, '0')}`;
}

/** Inelul cu țara coloanei pusă în față când textul nu o are și așa devine inel valid. */
export function ringWithCountry(text, country) {
  const p = parseRing(text);
  if (p.ok || p.needsClub) return text;
  if (country) {
    const withCountry = `${country} ${text}`;
    if (parseRing(withCountry).ok) return withCountry;
  }
  return text;
}

/** Text tăiat; gol → null. */
export function cut(text, max) {
  const s = String(text ?? '').trim();
  return s ? s.slice(0, max) : null;
}
