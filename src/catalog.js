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

// Sinonimele includ abrevierile de pe pedigree-uri și clasamente: românești (A, S, G, R, b) și internaționale
// (BB = blue bar, BC = blue check, DC = dark check, PD = pied, GRZ = grizzle). Literele singure se recunosc doar
// când sunt tot textul culorii (altfel „A fost neinelat” ar însemna albastru).
export const COLORS = [
  { code: 'albastru', label: 'Albastru', synonyms: ['albastra', 'albastru cu dungi', 'blue', 'bleu', 'blue bar', 'bb', 'a'] },
  { code: 'albastru-brocat', label: 'Albastru brocat', synonyms: ['albastra brocata', 'brocat', 'brocata'] },
  { code: 'solzat', label: 'Solzat', synonyms: ['solzata', 'cenusiu solzat', 'blue check', 'check', 'bc', 's'] },
  { code: 'solzat-inchis', label: 'Solzat închis', synonyms: ['solzata inchisa', 'dark check', 'dc'] },
  { code: 'gut', label: 'Gut', synonyms: ['guta', 'g'] },
  { code: 'negru', label: 'Negru', synonyms: ['neagra', 'black'] },
  { code: 'pestrit', label: 'Pestriț', synonyms: ['pestrita', 'pestrit alb'] },
  { code: 'baltat', label: 'Bălțat', synonyms: ['baltata', 'pied', 'pd', 'b'] },
  { code: 'vanat', label: 'Vânăt', synonyms: ['vanata', 'vnata', 'vanat inchis', 'dark'] },
  { code: 'rosu', label: 'Roșu', synonyms: ['rosie', 'rosu solzat', 'red', 'mealy', 'r'] },
  { code: 'rosu-brocat', label: 'Roșu brocat', synonyms: ['rosie brocata', 'red check'] },
  { code: 'galbui', label: 'Gălbui', synonyms: ['galbuie', 'galben', 'galbena', 'dun'] },
  { code: 'alb', label: 'Alb', synonyms: ['alba', 'white'] },
  { code: 'tarcat', label: 'Tărcat', synonyms: ['tarcata', 'grizzle', 'gris', 'grizonat', 'grz'] },
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
// Formele mai lungi întâi (ca „albastru brocat” să bată „albastru”, iar „vanat” să bată abrevierea „a”).
const COLOR_FORMS = COLORS.flatMap((c) => [c.label, ...c.synonyms].map((f) => ({ code: c.code, words: fold(f).split(' ') }))).sort(
  (a, b) => b.words.length - a.words.length || b.words.join(' ').length - a.words.join(' ').length,
);
const PA = /(^|\s)(p\.?\s?a\.?|pene albe|wf)(?=\s|$)/;

/** Culoarea dintr-un text liber de pe pedigree: „Albastra p.a Consangvina” → { code: 'albastru', pa: true, rest: 'consangvina' }. */
export function matchColor(text) {
  // „Spa” = solzat cu pene albe (abrevierea culorii lipită de „pa”).
  let s = fold(text).replace(/[,;]/g, ' ').replace(/(^|\s)([asgr])pa(?=\s|$)/g, '$1$2 pa');
  const pa = PA.test(s);
  s = s.replace(PA, ' ').replace(/[.:!?()"„”]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = s ? s.split(' ') : [];
  for (const form of COLOR_FORMS) {
    if (form.words.length === 1 && form.words[0].length === 1 && words.length !== 1) continue;
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
