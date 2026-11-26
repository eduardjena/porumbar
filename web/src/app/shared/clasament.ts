/*
 * Clasamentul lipit (copiat de om de pe columba.ro și lipit în Pigeonrama). Se citește DOAR în telefonul omului: la server
 * pleacă numai rândurile lui (după codul de crescător sau după inelele porumbeilor lui), restul paginii, cu ceilalți
 * crescători, nu iese din telefon. Fără importuri, ca să se poată testa direct cu Node (test/clasament.test.js).
 *
 * Antetul (exemplu: docs/exemple/clasament-columba-lipit.txt):
 *   CLASAMENTUL CONCURSULUI NR. 1 / Organizator: Valcea
 *   CATEGORIA - VITEZA
 *   04.05.2026 - Yablanita
 *   LANSARE:  04.05.2026 8:1        (8:1 = 08:01)
 *   PORUMBEI ANGAJATI:  10023
 * Rândurile (tab-urile pot deveni spații când se copiază de pe telefon):
 *   NR.CRT. NUME PRENUME COD CDC LOCALITATE DISTANTA MATRICOL AN E X ZI H M S T.REAL VIT.MED. PENALIZ. FCI CLS.
 */

export interface PastedRace {
  number: number | null;
  organizer: string | null;
  /** Codul categoriei din Pigeonrama (viteza, semifond, fond, mare-fond, maraton, pui, altele). */
  category: string | null;
  /** AAAA-LL-ZZ */
  date: string | null;
  releasePlace: string | null;
  /** HH:MM:SS */
  releaseTime: string | null;
  entered: number | null;
}

export interface PastedRow {
  place: number;
  name: string;
  code: string;
  /** Inelul, ca în Pigeonrama: RO-25-276971 (MATRICOL 0276971 + AN 2025, fără zerourile din față). */
  ring: string;
  country: string;
  year: number;
  number: string;
  sex: 'M' | 'F' | null;
  day: number;
  /** HH:MM:SS */
  time: string;
  distanceKm: number;
  speed: number | null;
  fci: number | null;
}

export interface Pasted {
  race: PastedRace;
  rows: PastedRow[];
}

const CATEGORIES: [RegExp, string][] = [
  [/^VITEZA/, 'viteza'],
  [/^(DEMIFOND|SEMIFOND|SEMI-FOND)/, 'semifond'],
  [/^(EXTREM|MARE FOND|MAREFOND|MARATON EXTREM)/, 'mare-fond'],
  [/^MARATON/, 'maraton'],
  [/^FOND/, 'fond'],
  [/^(PUI|TINERET)/, 'pui'],
];

/** Fără diacritice, litere mari (ca în antetul Columba). */
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const two = (n: string | number) => String(n).padStart(2, '0');
const strip = (n: string) => n.replace(/^0+(?=\d)/, '');
const num = (s: string | undefined) => {
  const n = s == null ? NaN : Number(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const ROW =
  /^(\d+) (.+?) ([A-Z]{1,4}\d{2,6}) (.+?) (\d{4,7}) (\d{3,8}) (\d{4}) (?:\S )?([MF]) (\d) (\d{1,2}) (\d{1,2}) (\d{1,2}) ([\d.,]+) ([\d.,]+) ([\d.,]+) ([\d.,]+) (\d+)$/;

/** Citește antetul și toate rândurile din textul lipit. Ce nu se recunoaște rămâne null / se sare. */
export function readPasted(text: string): Pasted {
  const lines = String(text ?? '').split(/\r?\n/);
  const race: PastedRace = { number: null, organizer: null, category: null, date: null, releasePlace: null, releaseTime: null, entered: null };
  const rows: PastedRow[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const up = plain(line);
    let m: RegExpMatchArray | null;
    if ((m = up.match(/CONCURSULUI NR\.? ?(\d+)/))) race.number = Number(m[1]);
    if ((m = line.match(/Organizator: ?(.+)$/i))) race.organizer = m[1].trim();
    if ((m = up.match(/^CATEGORIA ?[-:] ?(.+)$/))) race.category = CATEGORIES.find(([re]) => re.test(m![1].trim()))?.[1] ?? 'altele';
    if (!race.date && (m = line.match(/^(\d{2})\.(\d{2})\.(\d{4}) ?- ?(.+)$/))) {
      race.date = `${m[3]}-${m[2]}-${m[1]}`;
      race.releasePlace = m[4].trim();
    }
    if ((m = up.match(/^LANSARE: ?\d{2}\.\d{2}\.\d{4} (\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/))) race.releaseTime = `${two(m[1])}:${two(m[2])}:${two(m[3] ?? 0)}`;
    if ((m = up.match(/^PORUMBEI ANGAJATI: ?(\d+)/))) race.entered = Number(m[1]);
    const r = line.match(ROW);
    if (r) {
      const year = Number(r[7]);
      rows.push({
        place: Number(r[1]),
        name: r[2],
        code: r[3].toUpperCase(),
        ring: `RO-${String(year).slice(2)}-${strip(r[6])}`,
        country: 'RO',
        year,
        number: strip(r[6]),
        sex: r[8] === 'M' ? 'M' : r[8] === 'F' ? 'F' : null,
        day: Number(r[9]),
        time: `${two(r[10])}:${two(r[11])}:${two(r[12])}`,
        distanceKm: Number(r[5]) / 1000,
        speed: num(r[14]),
        fci: num(r[16]),
      });
    }
  }
  return { race, rows };
}

/** Cheia de comparare a unui inel (țară, an, număr fără zerouri), ca pe server. */
export const ringKeyOf = (country: string | null, year: number | null, number: string | null) =>
  country && year && number ? `${country}|${year}|${strip(number)}` : null;

/**
 * Doar rândurile omului: cu codul lui de crescător sau cu inelul unui porumbel de-al lui. Restul nu se păstrează.
 * `known` = cheile inelelor porumbeilor lui (ringKeyOf).
 */
export function ownRows(pasted: Pasted, code: string | null, known: Set<string>): PastedRow[] {
  const mine = code ? code.toUpperCase().replace(/\s+/g, '') : null;
  return pasted.rows.filter((r) => (mine && r.code === mine) || known.has(ringKeyOf(r.country, r.year, r.number)!));
}
