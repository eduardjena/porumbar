/*
 * Inelele porumbeilor, scrise în multe feluri pe pedigree-uri și în clasamente:
 *   RO-26-800546 L · 412084/15 RO · 159989 019-ESP · 738256/09F · RO 25 1326835 · 6008107/08 BELG M · DV-08778-24-271 · MATRICOL 0276971 + AN 2025
 * și din toată lumea (docs/cercetare/reports/Formatele inelelor de porumbei.md): GB22T12345, PL-0384-25-1698,
 * CHN 26-15-0443185, AU 18 RMR 18861, IHU 09 S 76230, ZA24 HOBY 223, KUW-2023-1-1230264 …
 * Se păstrează mereu textul original (`raw`); forma normalizată servește la comparare și afișare.
 *
 * Modulul e pur (fără importuri, fără Node): îl folosește și interfața (web/src/app/shared/ring-preview.ts), ca
 * telefonul să arate exact ce va înțelege serverul. Tipurile: rings.d.ts.
 *
 * Două trepte:
 *  1. Regulile de dinainte (pozițiile fixe, tabelul LEGACY): tot ce recunoșteau ele dă exact aceeași cheie și aceeași
 *     afișare (cheile stau în baza de date; test/rings-compat.test.js). Singura schimbare: anul pe 2 cifre egal cu
 *     anul curent + 1 e acum 20AA (înainte 19AA). Inelele salvate înainte ca strămoși nerecunoscuți primesc cheia la
 *     pornire (src/ring-backfill.js).
 *  2. Ce n-au recunoscut ele trece prin parserul pe bucăți (tokeni): emitentul din tabelul ALIASES, apoi șablonul
 *     familiei lui (club, literă de serie, provincie, cod de club american …).
 * Ce nu recunoaște niciuna rămâne `ok: false`; un porumbel propriu se poate salva și așa, cu cheia de rezervă
 * (fallbackKey: „?|” + textul curățat), care nu se poate confunda cu o cheie recunoscută.
 */

/** Codurile recunoscute de regulile vechi (nu se schimbă: de ele depind cheile salvate). */
const LEGACY = {
  RO: 'RO', NL: 'NL', BE: 'BE', BELG: 'BE', B: 'BE', DV: 'DV', D: 'DV', DE: 'DV',
  GB: 'GB', GBR: 'GB', PL: 'PL', HU: 'HU', HUN: 'HU', H: 'HU', BG: 'BG', MD: 'MD', FR: 'FR', F: 'FR',
  CZ: 'CZ', SK: 'SK', RS: 'RS', SRB: 'RS', UA: 'UA', IT: 'IT', I: 'IT', ES: 'ES', E: 'ES',
  PT: 'PT', P: 'PT', ESP: 'ES', TW: 'TW', CN: 'CN', CHN: 'CN', US: 'US', USA: 'US', AT: 'AT', A: 'AT', AUS: 'AT', AUT: 'AT', CH: 'CH', DK: 'DK', DAN: 'DK',
};

/**
 * Emitentul de pe inel → codul canonic (cel din cheie și din afișare). Țările de dinainte își păstrează codul (BE, DV,
 * AT, DK, RS, CN, TW, ES …); țările noi au codul ISO, iar emitenții care nu sunt țări (uniunile britanice, IHU, AU, IF,
 * CU, NPA, asociațiile australiene și taiwaneze, NIPPON, PHA, HKPA) își păstrează prefixul. Coliziuni (raportul):
 * AU = SUA (American Racing Pigeon Union), nu Australia; AUS rămâne Austria (așa scriu aplicațiile românești);
 * CU = Canada; KSA = Arabia Saudită (SA singur e ambiguu: Africa de Sud veche sau South Australia).
 */
const ALIASES = {
  ...LEGACY,
  BEL: 'BE', HOLL: 'NL', FRANCE: 'FR', DVX: 'DV', DDR: 'DV', AUSTRIA: 'AT', POR: 'PT', PORT: 'PT', ITALIA: 'IT', ITA: 'IT',
  LUX: 'LU', LU: 'LU', MALTA: 'MT', MT: 'MT', UK: 'GB', NEHU: 'NEHU', NWHU: 'NWHU', SU: 'SU', WHU: 'WHU', WHPU: 'WHU', WALES: 'WHU',
  IHU: 'IHU', RP: 'PL', CS: 'CZ', HUNG: 'HU', RSR: 'RO', CRO: 'HR', HR: 'HR', SLO: 'SI', SLOVENIA: 'SI', SI: 'SI',
  LTU: 'LT', LT: 'LT', TR: 'TR', EG: 'EG',
  AU: 'AU', ARPU: 'AU', IF: 'IF', NPA: 'NPA', CU: 'CU', CRPU: 'CU', MEX: 'MX', MX: 'MX',
  ZA: 'ZA', SA: 'ZA', ZW: 'ZW', HUNGARY: 'HU', KW: 'KW', KUW: 'KW', QATAR: 'QA', QTR: 'QA', QA: 'QA', UAE: 'AE', AE: 'AE', KSA: 'KSA', NZ: 'NZ',
  VRPU: 'VRPU', VHA: 'VHA', VPU: 'VPU', VPO: 'VPO', WPF: 'WPF', QRPF: 'QRPF', QPF: 'QPF', SAHPA: 'SAHPA', ACP: 'ACP',
  PRV: 'PRV', GIPP: 'GIPP', GMPF: 'GMPF', AUST: 'AUST',
  CHINA: 'CN', TWN: 'TW', TAIWAN: 'TW', '台灣': 'TW', '台湾': 'TW', CTRPA: 'CTRPA', KLPR: 'KLPR', TPA: 'TPA', DTRPA: 'DTRPA',
  JPN: 'JP', JAPAN: 'JP', JP: 'JP', NIPPON: 'NIPPON', KR: 'KR', KOR: 'KR', TH: 'TH', THAI: 'TH', PHA: 'PHA', HKPA: 'HKPA',
  VN: 'VN', ID: 'ID',
};

// Familiile (după partea din mijloc). Restul: țară / emitent + an + număr.
/**
 * Clubul (secția, organizația) e un număr, înaintea anului sau după el. Când amândouă pot fi an: clubul primul la DV și
 * LT, anul primul la celelalte (așa se afișează și așa se citește înapoi afișarea; DK cu club era deja salvat cu anul
 * primul, DK-15-151-1958).
 */
const CLUB_FIRST = new Set(['DV', 'LT']);
const CLUB_YEAR = new Set(['DV', 'AT', 'DK', 'PL', 'LT', 'CZ', 'SK', 'SI']);
/** Clubul păstrat cum e scris (cod de regiune pe 2 cifre), nu fără zerouri. */
const CLUB_AS_WRITTEN = new Set(['LT']);
/** O literă de serie (1–2 litere) între an și număr: RPRA, uniunile britanice, IHU (S / N = regiunea), JPN, PHA. */
const SERIES = new Set(['GB', 'NEHU', 'NWHU', 'SU', 'WHU', 'IHU', 'JP', 'PHA']);
/** Codul de club liber, în orice ordine față de an și număr (SUA, Canada, Africa de Sud, Golful …). */
const FREE = new Set(['AU', 'IF', 'CU', 'NPA', 'ZA', 'ZW', 'MX', 'NZ', 'KR', 'VN', 'KW', 'QA', 'AE', 'MT', 'TH']);
/** Emitenții americani: pe pedigree-uri prefixul apare oriunde (25138 RMR AU 2025, 19970-AU19-RMR). */
const ANYWHERE = new Set(['AU', 'IF', 'CU', 'NPA']);
/** Afișarea cu clubul înaintea anului, ca pe inel (DV are și zerourile clubului). */
const SHOW_CLUB_FIRST = new Set(['LT']);
/**
 * Numărul cu lățime fixă (raportul, nivel O / E): la afișare se pun la loc zerourile din față (cheia nu le ține). Doar la
 * familiile noi: cele vechi se afișează ca înainte (FR-21-6470). China cu provincie: 7 cifre din 2014, 6 înainte; JP cu
 * litera de serie: 5.
 */
const WIDTH = { HKPA: 7, HR: 5, SI: 4, KR: 4, MX: 6, NIPPON: 6, TH: 5, VN: 6, ID: 6, KSA: 6 };
/** Emitenții din lumea englezească: H de la final = hen (femelă); la ceilalți (maghiari) H = hím. */
const ENGLISH = new Set(['GB', 'NEHU', 'NWHU', 'SU', 'WHU', 'IHU', 'AU', 'IF', 'CU', 'NPA', 'US', 'ZA', 'NZ', 'AUST',
  'VRPU', 'VHA', 'VPU', 'VPO', 'WPF', 'QRPF', 'QPF', 'SAHPA', 'ACP', 'PRV', 'GIPP', 'GMPF']);
/** Mai lung de atât nu e un inel (câmpul are cel mult 80): nu se citește deloc, ca să nu coste timp. */
const MAX_LENGTH = 120;

// Litera de sex de la final: L/M = mascul, T/F = femelă (Compuclub folosește L/T); maghiarii scriu H (hím) / T (tojó);
// pe pedigree-urile tipărite (mai ales maghiare) și ♂ / ♀; englezii COCK / HEN (și H = hen, vezi ENGLISH); germanii
// V / W (doar după un inel DV); în cuvinte și HÍM / TOJÓ, MALE / FEMALE.
const SEX = { L: 'M', M: 'M', H: 'M', T: 'F', F: 'F', '♂': 'M', '♀': 'F', V: 'M', W: 'F' };
const SEX_WORDS = { COCK: 'M', HEN: 'F', HIM: 'M', TOJO: 'F', MALE: 'M', FEMALE: 'F' };
const SEX_WORD_AT_END = /(?:^|[^\p{L}])(?:COCK|HEN|H[IÍ]M|TOJ[OÓ]|MALE|FEMALE)$/u;

/** Textul de citit: formele late (ＲＯ) devin obișnuite, caracterele invizibile (cratimă moale, spațiu de lățime 0) cad. */
const clean = (text) => text.normalize('NFKC').replace(/\p{Cf}/gu, '').toUpperCase().replace(/\s+/g, ' ').trim();

const stripZeros = (s) => s.replace(/^0+(?=\d)/, '');
const country = (code) => (code ? LEGACY[code] ?? null : 'RO');

/** Anul pe 2 cifre: până la anul curent + 1 (inelele de sezon din Taiwan) → 20AA, altfel 19AA. */
function fullYear(text, now) {
  if (text.length === 4) return Number(text);
  const yy = Number(text);
  return yy <= (now.getFullYear() + 1) % 100 ? 2000 + yy : 1900 + yy;
}

/**
 * @returns {{ ok: boolean, unringed: boolean, raw: string, country: string|null, year: number|null,
 *            number: string|null, club: string|null, sex: 'M'|'F'|null, needsClub?: boolean }}
 */
export function parseRing(text, { now = new Date() } = {}) {
  const raw = typeof text === 'string' ? text.trim() : '';
  const result = { ok: false, unringed: false, raw, country: null, year: null, number: null, club: null, sex: null };
  if (raw.length > MAX_LENGTH) return result;
  let s = clean(raw);
  if (!s) return result;

  // Sexul: cuvânt separat la final („RO-26-800546 L”), lipit de cifre („738256/09F”), semnul ♂ / ♀ sau după bară
  // („398221/23/M”, în rezultatele FCI).
  let m = s.match(/^(.*?)\s*([♂♀])$/) ?? s.match(/^(.*?)(?:\s+|(?<=\d))([LMTFH])$/) ?? s.match(/^(.*\d)\s*\/\s*([LMTFH])$/);
  const sexLetter = m && m[1] ? m[2] : null;
  if (sexLetter) {
    result.sex = SEX[sexLetter];
    s = m[1].trim();
  }

  // Doar zerouri: porumbel fără inel („000 M”).
  if (/^0+$/.test(s)) return { ...result, ok: true, unringed: true };

  const legacy = legacyParts(s);
  if (legacy === 'needsClub') return { ...result, needsClub: true };
  const parts = legacy ?? worldParts(s, result, now);
  if (parts === 'needsClub') return { ...result, needsClub: true };
  if (!parts) return result;

  const number = stripZeros(parts.number);
  // H după un inel englezesc / american / australian = hen.
  const sex = sexLetter === 'H' && ENGLISH.has(parts.country) ? 'F' : result.sex;
  const out = { ...result, ok: true, sex, country: parts.country, year: fullYear(parts.year, now), number, club: parts.club ?? null };
  if (/^0+$/.test(number)) out.unringed = true;
  return out;
}

/** Regulile de dinainte, neschimbate (pozițiile fixe, codurile din LEGACY). */
function legacyParts(s) {
  let m;
  let parts = null;
  // Ungaria: HU-2023-29-14530 (anul, numărul organizatorului regional din două cifre sau o literă de serie, numărul).
  // Scris de mână, organizatorul apare și fără zero („HU-2024-4-41013” = 04).
  if ((m = s.match(/^(HUN|HU|H)[\s-]*(\d{2}|\d{4})[\s-]+(\d{1,2}|[A-Z])[\s-]+(\d{3,6})$/))) {
    parts = { country: 'HU', club: /^\d$/.test(m[3]) ? `0${m[3]}` : m[3], year: m[2], number: m[4] };
  } else
  // Țara la început: RO-26-800546, RO 25 1326835, DV-08778-24-271 (cu club).
  if ((m = s.match(/^([A-Z]{1,4})[\s-]+(\d{1,5})[\s-]+(\d{2})[\s-]+(\d+)$/)) && LEGACY[m[1]] === 'DV' && m[2].length > 2) {
    parts = { country: 'DV', club: stripZeros(m[2]), year: m[3], number: m[4] };
  } else if ((m = s.match(/^([A-Z]{1,4})[\s-]+(\d{2})[\s-]+(\d{3,5})[\s-]+(\d+)$/)) && LEGACY[m[1]]) {
    // Anul în față, apoi clubul: DV 17-01063-813 (myloft), AUS 18-301-1405 (Austria).
    parts = { country: LEGACY[m[1]], club: stripZeros(m[3]), year: m[2], number: m[4] };
  } else if ((m = s.match(/^([A-Z]{1,4})[\s-]+(\d{2}|\d{4})[\s-]+(\d+)$/))) {
    parts = { country: country(m[1]), year: m[2], number: m[3] };
  } else if ((m = s.match(/^(\d+)\s*[/-]\s*(\d{2}|\d{4})(?:[\s-]+([A-Z]{1,4}))?$/))) {
    // Numărul întâi: 412084/15 RO, 6008107/08 BELG, 2091850-25, 0561385-2017-RO.
    parts = { country: country(m[3]), year: m[2], number: m[1] };
  } else if ((m = s.match(/^(\d{4,})\s*[\s/-]\s*0(\d{2})[\s-]+([A-Z]{1,4})$/)) && LEGACY[m[3]]) {
    // Fișele spaniole: „Serie: 159989” + „Año: 019-ESP”: anul pe 3 cifre cu zero în față, doar cu țara scrisă.
    parts = { country: LEGACY[m[3]], year: m[2], number: m[1] };
  } else if ((m = s.match(/^([A-Z]{1,4})\s+(\d{4,})\s*-\s*(\d{4})$/)) && LEGACY[m[1]]) {
    // Țara, numărul, anul întreg: Ro 439175 - 2020, B 6024428-2019.
    parts = { country: LEGACY[m[1]], year: m[3], number: m[2] };
  }
  if (!parts || !parts.country) return null;
  // Un inel maghiar fără numărul organizatorului s-ar încurca cu inelul altei asociații (numerele se repetă).
  if (parts.country === 'HU' && !parts.club) return 'needsClub';
  return parts;
}

/**
 * Bucățile textului: litere (din orice alfabet) sau cifre; `glued` = lipită de bucata dinainte (AU2017, GB22T12345).
 * Separatori: spațiu, - / . , ' # :. Punctele dintre litere se strâng (D.V. → DV, C.T.R.P.A → CTRPA), „&” leagă
 * literele (F&D → FD), accentele cad (PROTÉGÉ → PROTEGE). Alt semn (emoji, caractere invizibile …) → null.
 */
function tokenize(s) {
  const clean = s.normalize('NFD').replace(/\p{M}/gu, '').replace(/(?<=\p{L})[.&](?=\p{L})/gu, '');
  if (/[^\p{L}\d\s\-/.,'#:]/u.test(clean)) return null;
  const tokens = [];
  for (const chunk of clean.split(/[\s\-/.,'#:]+/)) {
    if (!chunk) continue;
    // Literele O tastate în loc de zero, într-o bucată de cifre: PL-O264-1O-15025.
    const fixed = /\d/.test(chunk) && /^[\dO]+$/.test(chunk) ? chunk.replace(/O/g, '0') : chunk;
    for (const [j, value] of fixed.match(/\d+|\p{L}+/gu).entries()) {
      tokens.push({ value, digits: /^\d/.test(value), glued: j > 0, i: tokens.length });
    }
  }
  return tokens;
}

/** Inelele pe care regulile vechi nu le-au recunoscut: emitentul, apoi șablonul familiei lui. */
function worldParts(s, result, now) {
  const tokens = tokenize(s);
  // Un inel are cel mult câteva bucăți (AU2017 F&D LOFTS 17219 are 6); mai multe nu se citesc.
  if (!tokens?.length || tokens.length > 12) return null;
  const maxYear = now.getFullYear() + 1;
  const yearLike = (t) => t.digits && (t.value.length === 2 || (t.value.length === 4 && Number(t.value) >= 1900 && Number(t.value) <= maxYear));

  // Sexul scris în cuvinte la final (COCK / HEN, HÍM / TOJÓ, MALE / FEMALE).
  const last = tokens.at(-1);
  if (!last.digits && SEX_WORDS[last.value] && !result.sex) {
    result.sex = SEX_WORDS[last.value];
    tokens.pop();
    if (!tokens.length) return null;
  }

  // China fără prefix: AAAA-PP-NNNNNNN (anul întreg, provincia 00–33, numărul de 7 cifre; 6 până în 2013).
  if (tokens.length === 3 && tokens.every((t) => t.digits)) {
    const [y, p, n] = tokens.map((t) => t.value);
    const year = Number(y);
    if (y.length === 4 && yearLike(tokens[0]) && p.length === 2 && Number(p) <= 33 && (n.length === 7 || (n.length === 6 && year <= 2013))) {
      return { country: 'CN', year: y, club: p, number: n };
    }
    return null;
  }

  // Emitentul: la început, la sfârșit (414415-23-SRB, 296943 台灣2027) sau, la americani, oriunde.
  const letters = tokens.filter((t) => !t.digits);
  let issuerAt = -1;
  if (!tokens[0].digits && ALIASES[tokens[0].value]) issuerAt = 0;
  else if (letters.length && ALIASES[letters.at(-1).value]) issuerAt = letters.at(-1).i;
  else issuerAt = tokens.findIndex((t) => !t.digits && ANYWHERE.has(ALIASES[t.value]));
  if (issuerAt < 0) return null;
  const prefix = tokens[issuerAt].value;
  let code = ALIASES[prefix];
  const rest = tokens.filter((_, i) => i !== issuerAt);
  // Anul lipit de emitent (AU2017, ZA24, GB22T…) e sigur anul.
  const next = tokens[issuerAt + 1];
  const glued = next && next.digits && next.glued && yearLike(next) ? next : null;

  // V / W după un inel german = sexul (DV 1009 23 9V).
  if (code === 'DV' && !rest.at(-1)?.digits && (rest.at(-1)?.value === 'V' || rest.at(-1)?.value === 'W') && !result.sex) {
    result.sex = SEX[rest.pop().value];
  }
  const digits = rest.filter((t) => t.digits);
  const words = rest.filter((t) => !t.digits);

  // SA: Africa de Sud doar în forma veche, cu anul întreg și codul uniunii (SA 2004 THU 17193).
  if (prefix === 'SA' && !(digits.some((t) => t.value.length === 4 && yearLike(t)) && words.length)) return null;

  /** Cifrele lipite de un cod de club sunt numărul, nu anul (IF PROTEGE99 11). */
  const afterClub = (t) => t.glued && t.i - 1 !== issuerAt && !tokens[t.i - 1].digits;
  /** Anul: cel lipit de emitent; altfel primul an posibil (2 cifre sau 1900…anul următor). */
  const pickYear = (list) => glued ?? list.find((t) => yearLike(t) && !afterClub(t)) ?? null;

  if (code === 'HU') {
    // Ungaria: organizatorul e obligatoriu (cele două cifre sau litera de serie).
    const [y, c, n] = rest;
    if (rest.length === 3 && y.digits && yearLike(y) && n.digits && n.value.length >= 3 && n.value.length <= 6
      && ((c.digits && c.value.length <= 2) || (!c.digits && c.value.length === 1))) {
      return { country: 'HU', year: y.value, club: c.digits && c.value.length === 1 ? `0${c.value}` : c.value, number: n.value };
    }
    return digits.length === 2 && !words.length ? 'needsClub' : null;
  }

  if (code === 'PL' && words.length === 1 && words[0].value === 'DE' && digits.length === 2) {
    // Inelul polonez de Derby: PL-DE-00-123456 (DE nu e Germania).
    const year = pickYear(digits);
    const number = digits.find((t) => t !== year);
    return year && number ? { country: 'PL', year: year.value, club: 'DE', number: number.value } : null;
  }

  if (code === 'CN' && digits.length === 3 && !words.length) {
    // China: anul, provincia (00–33), numărul.
    const [y, p, n] = digits;
    if (yearLike(y) && p.value.length === 2 && Number(p.value) <= 33 && n.value.length <= 7) return { country: 'CN', year: y.value, club: p.value, number: n.value };
    return null;
  }

  if (CLUB_YEAR.has(code) && digits.length === 3 && !words.length) {
    // Club + an + număr (DV 1009 23 9, AUSTRIA 415-18-120, PL-0384-25-1698) sau an + club + număr (CZ-01-0148-123,
    // SK-2022-01002-783, Benzing DV-2023-06687-547). Când ambele pot fi an, ordinea obișnuită a țării.
    const [a, b, n] = digits;
    let club;
    let year;
    if (yearLike(b) && !yearLike(a)) [club, year] = [a, b];
    else if (yearLike(a) && !yearLike(b)) [year, club] = [a, b];
    else if (yearLike(a) && yearLike(b)) [club, year] = CLUB_FIRST.has(code) ? [a, b] : [b, a];
    else return null;
    if (club.value.length > 5) return null;
    return { country: code, year: year.value, club: CLUB_AS_WRITTEN.has(code) ? club.value : stripZeros(club.value), number: n.value };
  }

  if (SERIES.has(code) && (digits.length === 2 && words.length <= 1)) {
    // An, literă de serie (opțională), număr: GB22T12345, IHU 09 S 76230 (S / N = regiunea), JPN 09 AB 12345.
    const [y, n] = digits;
    const series = words[0] ?? null;
    if (!yearLike(y)) return null;
    if (series && (series.value.length > 2 || series.i < y.i || series.i > n.i)) return null;
    if (series && code === 'IHU' && !['S', 'N'].includes(series.value)) return null;
    return { country: code, year: y.value, club: series?.value ?? null, number: n.value };
  }

  if (FREE.has(code) && digits.length >= 2 && digits.length <= 3 && words.length <= 3) {
    // Codul de club liber, în orice ordine: AU 18 RMR 18861, 25138 RMR AU 2025, IF PROTEGE99 11, KUW-2023-1-87664.
    const year = pickYear(digits);
    if (!year) return null;
    const others = digits.filter((t) => t !== year);
    const number = others.at(-1);
    const club = rest.filter((t) => t !== year && t !== number);
    if (club.some((t) => t.digits && t.value.length > 3)) return null;
    const clubText = club.map((t) => t.value).join('');
    // Clubul cum e scris (KUW-2023-1-…, MALTA 26-04-4205: câmpul din mijloc are sens necunoscut, zeroul rămâne).
    return { country: code, year: year.value, club: clubText || null, number: number.value };
  }

  if (digits.length === 2 && !words.length) {
    // Țară / emitent + an + număr, în orice ordine: FRANCE 166548-98, BELG 6092000 14, VRPU-23-10537, ESP0144872-2019.
    const year = pickYear(digits);
    const number = digits.find((t) => t !== year);
    if (!year || !number) return null;
    return { country: code, year: year.value, number: number.value };
  }
  return null;
}

/**
 * Afișarea uniformă: RO-25-276971, DV-08778-24-271 (Germania: clubul pe 5 cifre, înaintea anului),
 * AT-18-301-1405 (alte țări cu club sau literă de serie: anul, clubul, numărul: GB-22-T-12345, AU-18-RMR-18861),
 * LT-01-03-14003 (clubul înaintea anului, ca pe inel); numărul cu zerourile din față la familiile noi cu lățime fixă
 * (CN-26-15-0443185, HKPA-26-0001384); un inel necitit sau lipsă rămâne cum a fost scris.
 */
export function formatRing(r) {
  if (!r?.ok || r.unringed) return r?.raw ?? '';
  const yy = String(r.year % 100).padStart(2, '0');
  // Ungaria: anul întreg, ca pe inel (HU-2023-29-14530).
  if (r.country === 'HU' && r.club) return `HU-${r.year}-${r.club}-${r.number}`;
  const width = r.country === 'CN' && r.club ? (r.year >= 2014 ? 7 : 6) : r.country === 'JP' && r.club ? 5 : WIDTH[r.country];
  const number = width ? String(r.number).padStart(width, '0') : r.number;
  if (!r.club) return `${r.country}-${yy}-${number}`;
  if (r.country === 'DV') return `${r.country}-${r.club.padStart(5, '0')}-${yy}-${number}`;
  if (SHOW_CLUB_FIRST.has(r.country)) return `${r.country}-${r.club}-${yy}-${number}`;
  return `${r.country}-${yy}-${r.club}-${number}`;
}

/** Cheia de comparare: același inel scris în forme diferite dă aceeași cheie; null pentru inel necitit sau lipsă. */
export function ringKey(r) {
  if (!r?.ok || r.unringed) return null;
  return `${r.country}|${r.year}|${r.club ?? ''}|${r.number}`;
}

/**
 * Cheia de rezervă a unui inel nerecunoscut: „?|” + literele și cifrele lui, cu majuscule, fără separatori și fără
 * sexul de la final. Nu se poate confunda cu o cheie recunoscută (acelea încep cu codul țării). Null pentru inel
 * recunoscut, fără inel, maghiar fără organizator sau fără nicio literă / cifră.
 */
export function fallbackKey(r) {
  if (!r || r.ok || r.needsClub || !r.raw || r.raw.length > MAX_LENGTH) return null;
  let s = clean(r.raw);
  if (r.sex) {
    s = SEX_WORD_AT_END.test(s)
      ? s.replace(/\p{L}+$/u, '')
      : s.replace(/\s*(?:[♂♀]|\/\s*[LMTFH]|(?<=[\s\d])[LMTFH])$/u, '');
  }
  const text = s.replace(/[^\p{L}\p{N}]/gu, '');
  return text ? `?|${text}` : null;
}

/** Cheia salvată la un porumbel propriu: cea recunoscută sau, pentru un inel nerecunoscut, cea de rezervă. */
export const storedRingKey = (r) => ringKey(r) ?? fallbackKey(r);

/** Forma inelului japonez scris fără emitent: anul (2 sau 4 cifre), litera de serie (două litere), numărul. */
const JAPANESE_SHAPE = /^(\d{2}|\d{4})[ -]?([A-Z]{2})[ -]?(\d{1,6})$/;

/**
 * Crescătorii japonezi își scriu inelele fără „JPN” (25-AB-01234). Dacă textul are forma japoneză și cu „JPN ” în față
 * se citește, întoarce textul omului cu „JPN ” în față; altfel textul neschimbat (un inel doar din cifre, cu țară sau
 * deja cu JPN rămâne cum e). Nu știe de cont: o cheamă doar cine salvează ce scrie sau aduce omul la un cont `ja`
 * (formular, părinți, pui inelați, serii, clasament lipit, import Excel, citirea din poză); copiile (vânzare, „Preia”)
 * nu. `parseRing` nu se schimbă pentru inelul fără prefix.
 */
export function japaneseRingText(text) {
  if (typeof text !== 'string' || text.length > MAX_LENGTH) return text;
  if (!JAPANESE_SHAPE.test(clean(text))) return text;
  const withIssuer = `JPN ${text.trim()}`;
  return parseRing(withIssuer).ok ? withIssuer : text;
}

/** Inelul dintr-un rând de clasament columba.ro: coloanele MATRICOL (0276971) și AN (2025). */
export function ringFromColumba(matricol, an) {
  return parseRing(`RO-${an}-${String(matricol).trim()}`);
}
