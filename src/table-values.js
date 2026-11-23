import { fold, BREEDS, EYE_COLORS, STATUSES } from './catalog.js';
import { parseRing } from './rings.js';
import { t } from './i18n.js';

/*
 * Citirea valorilor din celulele unei tabele aduse (Excel / CSV): sex, rasă, culoarea ochilor, stare, linii de sânge,
 * dată și țara inelului. Funcții pure, fără bază de date; textul necunoscut dă `null` (sau valoarea implicită), nu eroare.
 */

const SEX_WORDS = {
  M: ['m', 'mascul', 'masc', 'h', 'him', 'cock', 'doffer', 'tauber', 'male', '♂'],
  F: ['f', 'femela', 'fem', 't', 'tojo', 'hen', 'duivin', 'taubin', 'femelle', 'female', '♀'],
};
const SEX_BY_WORD = new Map(Object.entries(SEX_WORDS).flatMap(([sex, words]) => words.map((w) => [w, sex])));

/** Sexul din text: 'M' | 'F' | null. */
export function readSex(text) {
  return SEX_BY_WORD.get(fold(text)) ?? null;
}

/**
 * Codul dintr-o listă de catalog, după cod sau după numele din interfață (română sau maghiară); `dictKeys` e
 * prefixul cheilor din i18n („catalog.stare”). Fără potrivire: null.
 */
export function readCode(text, list, dictKeys) {
  const f = fold(text);
  if (!f) return null;
  for (const { code } of list) {
    if (fold(code) === f) return code;
    for (const lang of ['ro', 'hu']) {
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

/** Liniile de sânge: despărțite la `,` `;` `/`, cel mult 10. */
export function readLines(text) {
  return String(text ?? '')
    .split(/[,;/]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 10);
}

/** Data ca AAAA-LL-ZZ din AAAA-LL-ZZ, ZZ.LL.AAAA, ZZ/LL/AAAA; un an singur sau o dată inexistentă → null. */
export function readDate(text) {
  const s = String(text ?? '').trim();
  let y, m, d;
  let x = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (x) [, y, m, d] = x;
  else if ((x = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/))) [, d, m, y] = x;
  else return null;
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
