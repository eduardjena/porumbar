import { t } from './i18n.js';
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

// Sinonimele (și cele maghiare, din docs/cercetare/termeni-maghiari.md) includ abrevierile de pe pedigree-uri și clasamente: românești (A, S, G, R, b) și internaționale
// (BB = blue bar, BC = blue check, DC = dark check, PD = pied, GRZ = grizzle). Literele singure se recunosc doar
// când sunt tot textul culorii (altfel „A fost neinelat” ar însemna albastru).
export const COLORS = [
  { code: 'albastru', label: 'Albastru', synonyms: ['albastra', 'albastru cu dungi', 'blue', 'bleu', 'blue bar', 'bb', 'a', 'kek', 'kek szalagos', 'kekszalagos', 'kek csikos', 'k cs'] },
  { code: 'albastru-brocat', label: 'Albastru brocat', synonyms: ['albastra brocata', 'brocat', 'brocata', 'vilagos kovacsolt'] },
  { code: 'solzat', label: 'Solzat', synonyms: ['solzata', 'cenusiu solzat', 'blue check', 'check', 'bc', 's', 'kek kovacsolt', 'kekkovacsolt', 'k kov', 'kk', 'kek kockas', 'pikkelyes'] },
  { code: 'solzat-inchis', label: 'Solzat închis', synonyms: ['solzata inchisa', 'dark check', 'dark', 'dc', 'sotet kovacsolt', 'skt'] },
  { code: 'gut', label: 'Gut', synonyms: ['guta', 'g', 'sotet', 'barsonypajzsos', 't mintas'] },
  { code: 'negru', label: 'Negru', synonyms: ['neagra', 'black', 'fekete'] },
  { code: 'pestrit', label: 'Pestriț', synonyms: ['pestrita', 'pestrit alb', 'babos'] },
  { code: 'baltat', label: 'Bălțat', synonyms: ['baltata', 'pied', 'pd', 'b', 'tarka'] },
  // Vânăt = albastru cu dungi, culoarea porumbelului sălbatic (utilizatorul, 2026-11-16).
  { code: 'vanat', label: 'Vânăt', synonyms: ['vanata', 'vnata', 'vanat inchis'] },
  { code: 'rosu', label: 'Roșu', synonyms: ['rosie', 'rosu solzat', 'red', 'mealy', 'r', 'voros', 'hamuvoros', 'fako', 'vorosfako'] },
  { code: 'rosu-brocat', label: 'Roșu brocat', synonyms: ['rosie brocata', 'red check', 'voros kovacsolt', 'voroskovacsolt', 'vk'] },
  // Gălbui = roșu diluat; dun = negru diluat, altă culoare (utilizatorul, 2026-11-16).
  { code: 'galbui', label: 'Gălbui', synonyms: ['galbuie', 'galben', 'galbena', 'sarga', 'sargafako'] },
  { code: 'dun', label: 'Dun (maro-cenușiu)', synonyms: ['dun', 'maro cenusiu', 'fumuriu', 'olajszin'] },
  { code: 'alb', label: 'Alb', synonyms: ['alba', 'white', 'feher'] },
  { code: 'tarcat', label: 'Tărcat', synonyms: ['tarcata', 'grizzle', 'gris', 'grizonat', 'grz', 'deres'] },
  { code: 'argintiu', label: 'Argintiu', synonyms: ['argintie', 'silver', 'ezust', 'kekfako'] },
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

// Tratamentele și vaccinurile pe tot porumbarul (etichetele vin din i18n: catalog.tratament_*).
export const TREATMENT_METHODS = [{ code: 'apa' }, { code: 'hrana' }, { code: 'pastila' }, { code: 'injectie' }, { code: 'picaturi' }];

export const TREATMENT_TARGETS = [{ code: 'toti' }, { code: 'concurenti' }, { code: 'reproducatori' }, { code: 'tineret' }, { code: 'alesi' }];

// Boli și vaccinuri uzuale, ca sugestii pentru numele tratamentului (fără nume comerciale de medicamente).
export const TREATMENT_SUGGESTIONS = [
  { code: 'tricomonaza' },
  { code: 'coccidioza' },
  { code: 'ornitoza' },
  { code: 'viermi' },
  { code: 'salmoneloza' },
  { code: 'paramixo' },
  { code: 'variola' },
  { code: 'adenovirus' },
  { code: 'paraziti_externi' },
];

// Categoriile concursurilor, ca în antetul clasamentelor („CATEGORIA - VITEZA”).
export const RACE_CATEGORIES = [
  { code: 'viteza', label: 'Viteză' },
  // Columba scrie „Demifond” și „Extrem”; FCI: semifond / mare fond. Codurile rămân cele vechi.
  { code: 'semifond', label: 'Demifond (semifond)' },
  { code: 'fond', label: 'Fond' },
  { code: 'mare-fond', label: 'Extrem (mare fond)' },
  { code: 'maraton', label: 'Maraton' },
  { code: 'pui', label: 'Pui' },
  { code: 'altele', label: 'Altele' },
];

// Clasamentul în care a ieșit porumbelul (același concurs are clasament pe club, filială, zonă și național).
// `short` = cum apare pe pedigree („1e Jud.-197KM-10023P-'26”).
export const RACE_LEVELS = [
  { code: 'club', label: 'Club', short: 'Club' },
  { code: 'filiala', label: 'Filială (județ)', short: 'Jud.' },
  { code: 'zona', label: 'Zonă', short: 'Zon.' },
  { code: 'national', label: 'Național', short: 'Nat.' },
  { code: 'altul', label: 'Altul', short: null },
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

// Etichetele afișate vin din i18n/ (catalog.<listă>.<cod>); cele de aici rămân pentru citirea textelor românești.
const tr = (lang, group, list) => list.map(({ code }) => ({ code, label: t(lang, `catalog.${group}.${code}`) }));

/** Ce primește interfața (fără sinonime), în limba dată. */
export function publicCatalog(lang = 'ro') {
  return {
    breeds: tr(lang, 'rasa', BREEDS),
    colors: tr(lang, 'culoare', COLORS),
    eyeColors: tr(lang, 'ochi', EYE_COLORS),
    statuses: tr(lang, 'stare', STATUSES),
    evalCriteria: tr(lang, 'evaluare', EVAL_CRITERIA),
    journalTypes: tr(lang, 'jurnal', JOURNAL_TYPES),
    raceCategories: tr(lang, 'concurs', RACE_CATEGORIES),
    raceLevels: tr(lang, 'clasament', RACE_LEVELS),
    treatmentMethods: tr(lang, 'tratament_mod', TREATMENT_METHODS),
    treatmentTargets: tr(lang, 'tratament_cui', TREATMENT_TARGETS),
    treatmentSuggestions: tr(lang, 'tratament_sugestie', TREATMENT_SUGGESTIONS),
  };
}
