// „Adu porumbeii din Excel”: tabelul lipit și ghicirea coloanelor. Modul pur, FĂRĂ importuri
// (testat direct cu Node, ca clasament.ts). Fără text pentru om aici.

export type Field =
  | 'inel' | 'inel_tara' | 'inel_an' | 'inel_club' | 'inel_numar'
  | 'nume' | 'sex' | 'culoare' | 'ochi' | 'rasa' | 'linii' | 'eclozare' | 'crescator' | 'stare'
  | 'tata' | 'mama' | 'observatii' | 'ignor';

// Un rând trimis serverului; `line` = numărul rândului ca în Excel (titlul se numără).
export type ImportRow = {
  line: number; ring: string; name?: string; sex?: string; color?: string; eyeColor?: string; breed?: string;
  lines?: string; hatchedOn?: string; breeder?: string; status?: string; father?: string; mother?: string; notes?: string;
};

const MAX_COLOANE = 20;

// Fără diacritice, litere mici, doar litere/cifre separate de un spațiu.
function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/ß/g, 'ss')
    .replace(/[^\p{L}\p{N}♂♀]+/gu, ' ').trim();
}

// Titlurile cunoscute (după fold) → câmpul. Fiecare listă: RO, HU, EN, NL, DE, FR.
const TITLURI: Partial<Record<Field, string[]>> = {
  inel: ['inel', 'inelul', 'nr inel', 'numar inel', 'gyuru', 'gyuruszam', 'ring', 'ring nr', 'ring number', 'ringnummer',
    'ringnr', 'ring no', 'bague', 'numero de bague', 'ringnummer', 'ring id'],
  inel_tara: ['tara', 'country', 'orszag', 'land', 'pays', 'tara inel'],
  inel_an: ['an', 'anul', 'an inel', 'year', 'ev', 'jaar', 'jahr', 'annee', 'ring year'],
  inel_club: ['club', 'asociatie', 'asociatia', 'egyesulet', 'association', 'vereniging', 'verein', 'federation', 'federatie'],
  inel_numar: ['number', 'szam', 'nummer', 'numero', 'serial', 'serie'],
  nume: ['nume', 'denumire', 'name', 'naam', 'nev', 'bezeichnung', 'nom'],
  sex: ['sex', 'sexul', 'ivar', 'geslacht', 'geschlecht', 'sexe', 'gender'],
  culoare: ['culoare', 'culoarea', 'szin', 'kleur', 'farbe', 'couleur', 'colour', 'color', 'colour of plumage'],
  ochi: ['ochi', 'ochii', 'culoare ochi', 'culoarea ochilor', 'szem', 'szemszin', 'eye', 'eyes', 'eye colour', 'eye color',
    'oog', 'ogen', 'oogkleur', 'auge', 'augen', 'augenfarbe', 'yeux', 'oeil', 'couleur des yeux'],
  rasa: ['rasa', 'rasa porumbel', 'fajta', 'breed', 'ras', 'rassen', 'rasse', 'race'],
  linii: ['linii', 'linie', 'linia', 'line', 'lines', 'lijn', 'lijnen', 'linie sange', 'vonal', 'bloodline', 'strain', 'stamm'],
  eclozare: ['data eclozarii', 'eclozare', 'eclozat', 'data nasterii', 'nascut', 'born', 'hatched', 'hatch date', 'geboren',
    'geboortedatum', 'kelt', 'kelte', 'keltezes', 'geburtsdatum', 'ne le', 'date de naissance', 'birth', 'birthday'],
  crescator: ['crescator', 'crescatorul', 'breeder', 'kweker', 'zuchter', 'tenyeszto', 'eleveur', 'fokker', 'owner', 'proprietar'],
  stare: ['stare', 'starea', 'status', 'allapot', 'toestand', 'zustand', 'etat', 'statut'],
  tata: ['tata', 'tatal', 'apa', 'vader', 'vater', 'sire', 'father', 'pere', 'cock', 'tata inel', 'inel tata', 'father ring'],
  mama: ['mama', 'mama inel', 'inel mama', 'mama', 'anya', 'moeder', 'mutter', 'dam', 'mother', 'mere', 'hen', 'mother ring'],
  observatii: ['observatii', 'observatie', 'notes', 'note', 'notite', 'remarks', 'comments', 'opmerking', 'opmerkingen',
    'megjegyzes', 'bemerkung', 'bemerkungen', 'remarque', 'remarques'],
};

// „Nr.” / „Număr” singure sunt de obicei contorul de rânduri: devin număr de inel doar lângă țară / an / club.
const NUMAR_AMBIGUU = new Set(['nr', 'numar']);

const DICT: Map<string, Field> = new Map();
for (const [f, list] of Object.entries(TITLURI) as [Field, string[]][]) {
  for (const w of list) if (!DICT.has(w)) DICT.set(w, f);
}

function titleField(cell: string): Field | null {
  return DICT.get(fold(cell)) ?? null;
}

const SEX_CUVINTE = new Set(['m', 'f', 'h', 't', 'mascul', 'masculin', 'femela', 'feminin', 'him', 'tojo', 'cock', 'hen',
  'doffer', 'duivin', 'tauber', 'taubin', 'male', 'female', 'femelle', '♂', '♀']);

function looksLikeSex(cell: string): boolean {
  return SEX_CUVINTE.has(fold(cell));
}

function looksLikeDate(cell: string): boolean {
  const c = cell.trim();
  return /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}(\s+\d{1,2}:\d{2}(:\d{2})?)?$/.test(c)
    || /^\d{4}[./-]\d{1,2}[./-]\d{1,2}(\.|\s+\d{1,2}:\d{2}(:\d{2})?|T[\d:.Z+-]+)?$/.test(c);
}

// Forma unui inel, fără rings.js: cel puțin 5 cifre și doar litere, cifre, spațiu, - / . (nu și data).
export function looksLikeRing(cell: string): boolean {
  const c = cell.trim();
  if (!c || looksLikeDate(c)) return false;
  if (!/^[\p{L}\p{N} \-/.]+$/u.test(c)) return false;
  return (c.match(/\d/g) || []).length >= 5;
}

export function looksLikeHeader(rows: string[][]): boolean {
  const first = rows[0];
  if (!first) return false;
  if (first.some(looksLikeRing)) return false;
  return first.some(c => titleField(c) !== null);
}

// Împarte textul lipit (sau un .csv) în rânduri și celule.
export function parsePasted(text: string): string[][] {
  const t = text.replace(/^\uFEFF/, '');
  const delim = alegeDelimitator(t);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQ = false;
  let eraCitat = false;
  const inchideRand = () => { row.push(cell); rows.push(row); row = []; cell = ''; eraCitat = false; };
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inQ) {
      if (ch === '"') {
        if (t[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
      } else cell += ch;
    } else if (ch === '"' && cell === '' && !eraCitat) {
      inQ = true; eraCitat = true;
    } else if (ch === delim) {
      row.push(cell); cell = ''; eraCitat = false;
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && t[i + 1] === '\n') i++;
      inchideRand();
    } else cell += ch;
  }
  if (cell !== '' || row.length || eraCitat) inchideRand();
  while (rows.length && rows[rows.length - 1].every(c => c.trim() === '')) rows.pop();
  const lat = rows.reduce((m, r) => Math.max(m, r.length), 0);
  for (const r of rows) while (r.length < lat) r.push('');
  return rows;
}

// Delimitatorul care apare cel mai consecvent în primele 20 de rânduri nevide (tab câștigă egalitatea).
function alegeDelimitator(t: string): string {
  const linii = t.split(/\r\n|\n|\r/).filter(l => l.trim() !== '').slice(0, 20);
  let best = '\t';
  let bestScor = 0;
  for (const d of ['\t', ';', ',']) {
    const nr = linii.map(l => numaraInAfaraGhilimelelor(l, d)).filter(n => n > 0);
    if (!nr.length) continue;
    const frecv = new Map<number, number>();
    for (const n of nr) frecv.set(n, (frecv.get(n) || 0) + 1);
    const scor = Math.max(...frecv.values());
    if (scor > bestScor) { best = d; bestScor = scor; }
  }
  return best;
}

function numaraInAfaraGhilimelelor(linie: string, d: string): number {
  let n = 0;
  let inQ = false;
  for (const ch of linie) {
    if (ch === '"') inQ = !inQ;
    else if (ch === d && !inQ) n++;
  }
  return n;
}

export function guessColumns(rows: string[][], hasHeader: boolean): Field[] {
  const lat = Math.min(MAX_COLOANE, rows.reduce((m, r) => Math.max(m, r.length), 0));
  const fields: Field[] = new Array(lat).fill('ignor');
  const luat = new Set<Field>();
  const pune = (i: number, f: Field) => { fields[i] = f; luat.add(f); };
  const date = hasHeader ? rows.slice(1) : rows;

  if (hasHeader && rows[0]) {
    for (let i = 0; i < lat; i++) {
      const f = titleField(rows[0][i] ?? '');
      if (f && !luat.has(f)) pune(i, f);
    }
  }

  if (hasHeader && rows[0] && !luat.has('inel_numar') && (luat.has('inel_tara') || luat.has('inel_an') || luat.has('inel_club'))) {
    const i = rows[0].slice(0, lat).findIndex((c, k) => fields[k] === 'ignor' && NUMAR_AMBIGUU.has(fold(c)));
    if (i >= 0) pune(i, 'inel_numar');
  }

  const inelePentru: Field[] = ['inel', 'tata', 'mama'];
  for (let i = 0; i < lat; i++) {
    if (fields[i] !== 'ignor') continue;
    // titlul spune ceva, dar câmpul e deja luat: coloana rămâne „nu iau”
    if (hasHeader && titleField(rows[0]?.[i] ?? '')) continue;
    const celule = date.map(r => (r[i] ?? '').trim()).filter(c => c !== '');
    if (!celule.length) continue;
    const parte = (test: (c: string) => boolean) => celule.filter(test).length / celule.length;
    if (parte(looksLikeRing) >= 0.6) {
      const f = inelePentru.find(x => !luat.has(x));
      if (f) pune(i, f);
    } else if (parte(looksLikeSex) >= 0.8) {
      if (!luat.has('sex')) pune(i, 'sex');
    } else if (parte(looksLikeDate) >= 0.6) {
      if (!luat.has('eclozare')) pune(i, 'eclozare');
    }
  }
  return fields;
}

export function canContinue(fields: Field[]): boolean {
  return fields.includes('inel') || fields.includes('inel_numar');
}

const IN_RAND: Partial<Record<Field, keyof ImportRow>> = {
  nume: 'name', sex: 'sex', culoare: 'color', ochi: 'eyeColor', rasa: 'breed', linii: 'lines', eclozare: 'hatchedOn',
  crescator: 'breeder', stare: 'status', tata: 'father', mama: 'mother', observatii: 'notes',
};

export function buildRows(rows: string[][], fields: Field[], hasHeader: boolean): ImportRow[] {
  const out: ImportRow[] = [];
  const nr = Math.min(fields.length, MAX_COLOANE);
  for (let i = hasHeader ? 1 : 0; i < rows.length; i++) {
    const val = new Map<Field, string>();
    for (let c = 0; c < nr; c++) {
      const f = fields[c];
      if (f === 'ignor' || val.has(f)) continue;
      const v = (rows[i][c] ?? '').trim();
      if (v !== '') val.set(f, v);
    }
    if (!val.size) continue;
    const ring = val.get('inel')
      ?? (['inel_tara', 'inel_an', 'inel_club', 'inel_numar'] as Field[]).map(f => val.get(f)).filter(Boolean).join('-');
    const r: ImportRow = { line: i + 1, ring };
    for (const [f, k] of Object.entries(IN_RAND) as [Field, keyof ImportRow][]) {
      const v = val.get(f);
      if (v !== undefined) (r as Record<string, unknown>)[k] = v;
    }
    out.push(r);
  }
  return out;
}
