/*
 * Listele predefinite ale fișei porumbelului: rase, culori (cu variantele scrise pe pedigree-uri), culoarea ochilor,
 * stări, criteriile evaluării la mână și tipurile din jurnal. Codurile se salvează în bază; etichetele se afișează.
 */

export const BREEDS = [
  { code: 'voiajor', label: 'Voiajor' },
  { code: 'jucator', label: 'Jucător' },
  { code: 'zburator-inaltime', label: 'Zburător de înălțime' },
  { code: 'rotitor', label: 'Rotitor' },
  { code: 'expozitie', label: 'Porumbel de expoziție (ornamental)' },
  { code: 'carne', label: 'Porumbel de carne' },
  { code: 'alta', label: 'Altă rasă' },
];

export const COLORS = [
  { code: 'albastru', label: 'Albastru', synonyms: ['albastra', 'albastru cu dungi', 'blue', 'bleu'] },
  { code: 'albastru-brocat', label: 'Albastru brocat', synonyms: ['albastra brocata', 'brocat', 'brocata', 'albastru solzat inchis', 'blue check'] },
  { code: 'solzat', label: 'Solzat', synonyms: ['solzata', 'cenusiu solzat'] },
  { code: 'negru', label: 'Negru', synonyms: ['neagra', 'black'] },
  { code: 'pestrit', label: 'Pestriț', synonyms: ['pestrita', 'pestrit alb', 'pied'] },
  { code: 'vanat', label: 'Vânăt', synonyms: ['vanata', 'vnata', 'vanat inchis', 'dark'] },
  { code: 'rosu', label: 'Roșu', synonyms: ['rosie', 'rosu solzat', 'red', 'mealy'] },
  { code: 'rosu-brocat', label: 'Roșu brocat', synonyms: ['rosie brocata', 'red check'] },
  { code: 'galbui', label: 'Gălbui', synonyms: ['galbuie', 'galben', 'galbena', 'dun'] },
  { code: 'alb', label: 'Alb', synonyms: ['alba', 'white'] },
  { code: 'tarcat', label: 'Tărcat', synonyms: ['tarcata', 'grizzle', 'gris'] },
  { code: 'argintiu', label: 'Argintiu', synonyms: ['argintie', 'silver'] },
];

export const EYE_COLORS = [
  { code: 'galben', label: 'Galben' },
  { code: 'portocaliu', label: 'Portocaliu' },
  { code: 'rosu', label: 'Roșu' },
  { code: 'perlat', label: 'Perlat' },
  { code: 'visiniu', label: 'Vișiniu (taurin)' },
  { code: 'mixt', label: 'Mixt' },
];

export const STATUSES = [
  { code: 'concurent', label: 'Concurent' },
  { code: 'reproducator', label: 'Reproducător' },
  { code: 'tanar', label: 'Tânăr' },
  { code: 'vandut', label: 'Vândut' },
  { code: 'pierdut', label: 'Pierdut' },
  { code: 'mort', label: 'Mort' },
  { code: 'accidentat', label: 'Accidentat' },
];

export const EVAL_CRITERIA = [
  { code: 'echilibru', label: 'Echilibru' },
  { code: 'musculatura', label: 'Musculatură' },
  { code: 'spate', label: 'Spate' },
  { code: 'aripa', label: 'Aripă' },
  { code: 'penaj', label: 'Penaj' },
  { code: 'ochi', label: 'Ochi' },
  { code: 'bazin', label: 'Bazin' },
  { code: 'caracter', label: 'Caracter' },
];

export const JOURNAL_TYPES = [
  { code: 'nota', label: 'Notă' },
  { code: 'tratament', label: 'Tratament' },
  { code: 'vaccin', label: 'Vaccin' },
  { code: 'antrenament', label: 'Antrenament' },
  { code: 'altele', label: 'Altele' },
];

export const codes = (list) => list.map((x) => x.code);

/** Fără diacritice, litere mici, spații simple. */
export const fold = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

// Toate formele unei culori, ca liste de cuvinte; cele mai lungi întâi (ca „albastru brocat” să bată „albastru”).
const COLOR_FORMS = COLORS.flatMap((c) => [c.label, ...c.synonyms].map((f) => ({ code: c.code, words: fold(f).split(' ') }))).sort(
  (a, b) => b.words.length - a.words.length,
);
const PA = /(^|\s)(p\.?\s?a\.?|pene albe)(?=\s|$)/;

/** Culoarea dintr-un text liber de pe pedigree: „Albastra p.a Consangvina” → { code: 'albastru', pa: true, rest: 'consangvina' }. */
export function matchColor(text) {
  let s = fold(text).replace(/[,;]/g, ' ');
  const pa = PA.test(s);
  s = s.replace(PA, ' ').replace(/\s+/g, ' ').trim();
  const words = s ? s.split(' ') : [];
  for (const form of COLOR_FORMS) {
    for (let i = 0; i + form.words.length <= words.length; i++) {
      if (form.words.every((w, j) => words[i + j] === w)) {
        const rest = [...words.slice(0, i), ...words.slice(i + form.words.length)].join(' ');
        return { code: form.code, pa, rest };
      }
    }
  }
  return { code: null, pa, rest: words.join(' ') };
}

/** Ce primește interfața (fără sinonime). */
export function publicCatalog() {
  return {
    breeds: BREEDS,
    colors: COLORS.map(({ code, label }) => ({ code, label })),
    eyeColors: EYE_COLORS,
    statuses: STATUSES,
    evalCriteria: EVAL_CRITERIA,
    journalTypes: JOURNAL_TYPES,
  };
}
