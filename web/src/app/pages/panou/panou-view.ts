import { BoardPigeon, Catalog } from '../../core/models';

/*
 * Bara panoului: cum se ordonează, se grupează și se filtrează porumbeii. Totul se face pe telefon, din datele panoului
 * (fără cereri noi la server). Alegerea (fără textul căutat) se ține minte pe telefon / calculator.
 */

export type SortKey = 'nota' | 'inel' | 'tineri' | 'batrani' | 'nume' | 'loc' | 'premii' | 'coef' | 'pui' | 'recent';
export type GroupKey = 'none' | 'sex' | 'an' | 'stare' | 'nota' | 'rezultate' | 'categorie' | 'pereche' | 'linie' | 'culoare' | 'generatie';

export interface ViewState {
  q: string;
  sort: SortKey;
  group: GroupKey;
  /** Butoanele rapide. */
  sex: '' | 'M' | 'F';
  young: boolean;
  prizes: boolean;
  breeding: boolean;
  todo: boolean;
  /** Din „Filtre”: stările și anii aleși (gol = toate). */
  statuses: string[];
  years: number[];
}

export const DEFAULT_VIEW: ViewState = {
  q: '', sort: 'nota', group: 'none', sex: '', young: false, prizes: false, breeding: false, todo: false, statuses: [], years: [],
};

/** `short`: pe pastila din bară (un cuvânt, ca bara să încapă pe un rând orice s-ar alege). */
export const SORTS: { key: SortKey; label: string; short: string; hint: string }[] = [
  { key: 'nota', label: 'Notă', short: 'Notă', hint: 'cei mai valoroși primii' },
  { key: 'inel', label: 'Inel', short: 'Inel', hint: 'anul, apoi numărul' },
  { key: 'tineri', label: 'Cei mai tineri', short: 'Tineri', hint: 'după data eclozării sau anul inelului' },
  { key: 'batrani', label: 'Cei mai bătrâni', short: 'Bătrâni', hint: 'după data eclozării sau anul inelului' },
  { key: 'nume', label: 'Nume', short: 'Nume', hint: 'A–Z, cei fără nume la sfârșit' },
  { key: 'loc', label: 'Cel mai bun loc', short: 'Loc', hint: 'din rezultatele la concursuri' },
  { key: 'premii', label: 'Cele mai multe premii', short: 'Premii', hint: 'premiu = în primii 20% din înscriși' },
  { key: 'coef', label: 'Cel mai bun coeficient', short: 'Coef.', hint: 'locul × 1000 / înscriși, mai mic e mai bine' },
  { key: 'pui', label: 'Cei mai mulți pui', short: 'Pui', hint: 'puii din porumbar' },
  { key: 'recent', label: 'Adăugați recent', short: 'Recenți', hint: 'cei puși ultimii în program' },
];

export const GROUPS: { key: GroupKey; label: string; short: string; hint: string }[] = [
  { key: 'none', label: 'Fără grupare', short: 'Grupează', hint: 'toți la un loc' },
  { key: 'sex', label: 'Sex', short: 'Sex', hint: 'masculi, femele, nesexați' },
  { key: 'an', label: 'An', short: 'An', hint: 'puii fiecărui an' },
  { key: 'stare', label: 'Stare', short: 'Stare', hint: 'concurenți, reproducători, tineri…' },
  { key: 'nota', label: 'Notă', short: 'Notă', hint: 'cele 5 trepte de culoare' },
  { key: 'rezultate', label: 'Rezultate', short: 'Rezultate', hint: 'premiați, cu rezultate, fără rezultate' },
  { key: 'categorie', label: 'Categoria de concurs', short: 'Categorie', hint: 'unde au cel mai bun rezultat' },
  { key: 'pereche', label: 'Pereche', short: 'Pereche', hint: 'fiecare cuplu din sezon, cu puii lui' },
  { key: 'linie', label: 'Crescător / linie', short: 'Linie', hint: 'de unde vin' },
  { key: 'culoare', label: 'Culoare', short: 'Culoare', hint: 'după culoarea penajului' },
  { key: 'generatie', label: 'Generația în porumbar', short: 'Generație', hint: 'aduși, puii lor, nepoții…' },
];

const BAND_LABEL: Record<number, string> = { 5: 'Nota 80–100', 4: 'Nota 60–79', 3: 'Nota 40–59', 2: 'Nota 20–39', 1: 'Nota sub 20', 0: 'Fără notă' };

export interface Group {
  key: string;
  label: string;
  items: BoardPigeon[];
}

/** Fără diacritice și mic, ca „Vânăt” să se găsească și scris „vanat”. */
export const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const currentYear = () => new Date().getFullYear();

/** Câte filtre sunt puse (numărul de pe butonul „Filtre”). */
export function filterCount(v: ViewState): number {
  return (v.sex ? 1 : 0) + [v.young, v.prizes, v.breeding, v.todo].filter(Boolean).length + v.statuses.length + v.years.length;
}

function matches(p: BoardPigeon, v: ViewState): boolean {
  if (v.sex && p.sex !== v.sex) return false;
  if (v.young && p.year !== currentYear()) return false;
  if (v.prizes && !p.facts.results?.prizes) return false;
  if (v.breeding && !p.facts.breeding) return false;
  if (v.todo && !p.facts.missing.length) return false;
  if (v.statuses.length && !v.statuses.includes(p.status ?? '')) return false;
  if (v.years.length && !v.years.includes(p.year ?? -1)) return false;
  const q = fold(v.q.trim());
  if (!q) return true;
  // Inelul: fără spații, liniuțe și zerouri în față („RO 24 500002” = „RO-24-500002” = „500002”).
  const qr = q.replace(/[\s/.-]+/g, '');
  const ring = fold(`${p.ring?.display ?? ''}|${p.ring?.raw ?? ''}`).replace(/[\s/.-]+/g, '');
  if (qr && (ring.includes(qr) || ring.includes(qr.replace(/^0+/, '')))) return true;
  if (/^(19|20)\d\d$/.test(q) && p.year === Number(q)) return true;
  const text = fold([p.name, p.facts.colorLabel, p.facts.breeder, ...p.facts.lines].filter(Boolean).join(' | '));
  return q.split(/\s+/).every((w) => text.includes(w));
}

const ringNumber = (p: BoardPigeon) => Number((p.ring?.number ?? '').replace(/\D/g, '')) || Number.MAX_SAFE_INTEGER;
const byRing = (a: BoardPigeon, b: BoardPigeon) =>
  (a.ring?.year ?? 9999) - (b.ring?.year ?? 9999) ||
  (a.ring?.country ?? '').localeCompare(b.ring?.country ?? '') ||
  ringNumber(a) - ringNumber(b) ||
  (a.ring?.display ?? '').localeCompare(b.ring?.display ?? '', 'ro');
/** Vârsta: data eclozării; fără ea, 1 iulie al anului (mijlocul sezonului). */
const born = (p: BoardPigeon) => (p.facts.hatchedOn ? Date.parse(p.facts.hatchedOn) : p.year ? Date.UTC(p.year, 6, 1) : NaN);
/** Pune golurile (null / NaN) la sfârșit, oricare ar fi sensul. */
const nullsLast = (a: number | null | undefined, b: number | null | undefined, dir: 1 | -1) => {
  const na = a == null || Number.isNaN(a);
  const nb = b == null || Number.isNaN(b);
  if (na || nb) return na === nb ? 0 : na ? 1 : -1;
  return (a! - b!) * dir;
};

function comparator(sort: SortKey): (a: BoardPigeon, b: BoardPigeon) => number {
  switch (sort) {
    case 'nota': return (a, b) => nullsLast(a.value.score, b.value.score, -1);
    case 'inel': return byRing;
    case 'tineri': return (a, b) => nullsLast(born(a), born(b), -1);
    case 'batrani': return (a, b) => nullsLast(born(a), born(b), 1);
    case 'nume': return (a, b) => (a.name ? 0 : 1) - (b.name ? 0 : 1) || (a.name ?? '').localeCompare(b.name ?? '', 'ro');
    case 'loc': return (a, b) => nullsLast(a.facts.results?.bestPlace, b.facts.results?.bestPlace, 1);
    case 'premii': return (a, b) => (b.facts.results?.prizes ?? -1) - (a.facts.results?.prizes ?? -1) || (b.facts.results?.count ?? -1) - (a.facts.results?.count ?? -1);
    case 'coef': return (a, b) => nullsLast(a.facts.results?.bestPenalty, b.facts.results?.bestPenalty, 1);
    case 'pui': return (a, b) => b.offspringCount - a.offspringCount;
    case 'recent': return (a, b) => Date.parse(b.facts.createdAt) - Date.parse(a.facts.createdAt);
  }
}

/** Cheia și eticheta grupei unui porumbel, plus ordinea grupei (mai mic = mai sus). */
function groupOf(p: BoardPigeon, g: GroupKey, cat: Catalog | null): { key: string; label: string; order: number | string } {
  const idx = (list: { code: string }[] | undefined, code: string | null) => {
    const i = (list ?? []).findIndex((x) => x.code === code);
    return i < 0 ? 999 : i;
  };
  const label = (list: { code: string; label: string }[] | undefined, code: string | null) => (list ?? []).find((x) => x.code === code)?.label ?? code ?? '';
  switch (g) {
    case 'none':
      return { key: 'all', label: '', order: 0 };
    case 'sex':
      return p.sex === 'M' ? { key: 'M', label: 'Masculi', order: 0 } : p.sex === 'F' ? { key: 'F', label: 'Femele', order: 1 } : { key: '-', label: 'Nesexați', order: 2 };
    case 'an':
      return p.year ? { key: String(p.year), label: p.year === currentYear() ? `Puii anului ${p.year}` : `Anul ${p.year}`, order: -p.year } : { key: '-', label: 'Fără an', order: 99999 };
    case 'stare':
      return p.status ? { key: p.status, label: label(cat?.statuses, p.status), order: idx(cat?.statuses, p.status) } : { key: '-', label: 'Fără stare', order: 9999 };
    case 'nota':
      return { key: String(p.value.band), label: BAND_LABEL[p.value.band] ?? 'Fără notă', order: p.value.band === 0 ? 99 : -p.value.band };
    case 'rezultate': {
      const r = p.facts.results;
      if (r?.prizes) return { key: 'premiati', label: 'Premiați', order: 0 };
      if (r?.count) return { key: 'rezultate', label: 'Cu rezultate, fără premiu', order: 1 };
      return { key: '-', label: 'Fără rezultate', order: 2 };
    }
    case 'categorie': {
      const c = p.facts.results?.bestCategory ?? null;
      return c ? { key: c, label: label(cat?.raceCategories, c), order: idx(cat?.raceCategories, c) } : { key: '-', label: 'Fără rezultate', order: 9999 };
    }
    case 'pereche': {
      const x = p.facts.pair;
      return x ? { key: String(x.id), label: `Perechea ${x.label} (${x.season})`, order: x.label } : { key: '-', label: 'Fără pereche în sezon', order: '￿' };
    }
    case 'linie': {
      const line = p.facts.lines[0];
      if (line) return { key: `l:${fold(line)}`, label: `Linia ${line}`, order: `0${fold(line)}` };
      if (p.facts.breeder) return { key: `c:${fold(p.facts.breeder)}`, label: `Crescător: ${p.facts.breeder}`, order: `1${fold(p.facts.breeder)}` };
      if (p.facts.loftGen > 1) return { key: 'own', label: 'Crescuți în porumbarul meu', order: '2' };
      return { key: '-', label: 'Fără crescător sau linie', order: '3' };
    }
    case 'culoare': {
      // Culoarea din listă, când e aleasă (așa „Albastră” scris la import și „Albastru” ales stau împreună); altfel textul scris.
      if (p.color) return { key: `c:${p.color}`, label: label(cat?.colors, p.color), order: idx(cat?.colors, p.color) };
      const c = p.facts.colorLabel;
      if (!c) return { key: '-', label: 'Fără culoare', order: 99999 };
      return { key: `t:${fold(c).replace(/[^a-z0-9]+/g, ' ').trim()}`, label: c, order: 5000 };
    }
    case 'generatie': {
      const n = p.facts.loftGen;
      const text = n <= 1 ? 'Aduși din afară (fondatori)' : n === 2 ? 'Generația 2: puii lor' : n === 3 ? 'Generația 3: nepoții' : `Generația ${n}`;
      return { key: String(n), label: text, order: n };
    }
  }
}

/** Porumbeii de arătat: filtrați, grupați, ordonați (în fiecare grupă, după ordonarea aleasă; la egalitate, după inel). */
export function buildGroups(all: BoardPigeon[], v: ViewState, cat: Catalog | null): Group[] {
  const cmp = comparator(v.sort);
  const items = all.filter((p) => matches(p, v)).sort((a, b) => cmp(a, b) || byRing(a, b));
  const groups = new Map<string, Group & { order: number | string }>();
  for (const p of items) {
    const g = groupOf(p, v.group, cat);
    if (!groups.has(g.key)) groups.set(g.key, { key: g.key, label: g.label, items: [], order: g.order });
    groups.get(g.key)!.items.push(p);
  }
  return [...groups.values()].sort((a, b) =>
    typeof a.order === 'number' && typeof b.order === 'number' ? a.order - b.order || a.label.localeCompare(b.label, 'ro') : String(a.order).localeCompare(String(b.order), 'ro'),
  );
}

/** Rândul de jos al casetei, când ordonarea sau gruparea e după rezultate: „2 rezultate · 1 premiu · locul 5”. */
export function resultsLine(p: BoardPigeon): string {
  const r = p.facts.results;
  if (!r) return 'Fără rezultate la concursuri';
  const parts = [r.count === 1 ? '1 rezultat' : `${r.count} rezultate`];
  if (r.prizes) parts.push(r.prizes === 1 ? '1 premiu' : `${r.prizes} premii`);
  if (r.bestPlace != null) parts.push(`locul ${r.bestPlace}`);
  if (r.bestPenalty != null) parts.push(`coef. ${String(r.bestPenalty).replace('.', ',')}`);
  return parts.join(' · ');
}

const KEY = 'porumbar.panou';

export function loadView(): ViewState {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_VIEW };
    const v = { ...DEFAULT_VIEW, ...raw, q: '' } as ViewState;
    if (!SORTS.some((s) => s.key === v.sort)) v.sort = 'nota';
    if (!GROUPS.some((g) => g.key === v.group)) v.group = 'none';
    if (!Array.isArray(v.statuses)) v.statuses = [];
    if (!Array.isArray(v.years)) v.years = [];
    return v;
  } catch {
    return { ...DEFAULT_VIEW };
  }
}

export function saveView(v: ViewState) {
  try {
    const { q: _q, ...rest } = v;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    /* fără memorie în browser: alegerea ține doar cât e pagina deschisă */
  }
}
