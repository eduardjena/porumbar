import { t } from '../../core/i18n';
import { BoardPigeon, CoiResult, PigeonSummary, TreeNode, Value } from '../../core/models';

/** Un porumbel din arbore, cu textul scurt de pe pedigree. */
export type TreePigeon = PigeonSummary & { text?: string };

export interface BloodPath {
  founderId: number | null;
  line: string;
  share: number;
  via: number[];
}

export interface Blood {
  lines: { name: string; percent: number; founders: number[] }[];
  paths: BloodPath[];
  pigeons: Record<number, PigeonSummary>;
}

/** Tot ce desenează vederile Arborelui pentru un porumbel (adus o singură dată de pagina Arbore). */
export interface ArboreData {
  rootId: number;
  tree: TreeNode;
  pigeons: Record<number, TreePigeon>;
  values: Record<number, Value>;
  coi: CoiResult;
  offspring: PigeonSummary[];
  blood: Blood;
}

export type { BoardPigeon };

/** Culori pentru strămoșii care se repetă (insigna „×N”), aceleași la fiecare apariție. */
export const REPEAT_COLORS = ['#b8860b', '#2f7f7a', '#8c357f', '#2b5a86', '#a33d1c', '#567a28'];

/** Culori distincte pentru liniile de sânge; „Necunoscut” / „Fără linie” sunt neutre. */
const LINE_COLORS = ['#a33d1c', '#2b5a86', '#567a28', '#8c357f', '#b8860b', '#2f7f7a', '#7a5a3a', '#5b5ea6', '#c0563a', '#3f7d55'];
export function lineColor(name: string, index: number): string {
  // Numele vin de la server în limba contului (text.necunoscut / text.fara_linie).
  if (name === t('text.necunoscut')) return '#b9ad9d';
  if (name === t('text.fara_linie')) return '#d6cbbd';
  return LINE_COLORS[index % LINE_COLORS.length];
}

/** Cum se numește ruda după drum: „Tatăl”, „Mama tatălui”… (doar până la bunici; mai departe numele generației). */
export function roleName(path: ('F' | 'M')[]): string {
  if (!path.length) return t('arbore.rol_porumbelul');
  if (path.length === 1) return t(path[0] === 'F' ? 'arbore.rol_tatal' : 'arbore.rol_mama');
  if (path.length === 2) {
    const who = path[1] === 'F' ? 'tatal' : 'mama';
    return t(`arbore.rol_${who}_${path[0] === 'F' ? 'tatalui' : 'mamei'}`);
  }
  // Străbunicii și răstrăbunicii: femininul după ultima literă (M = mamă) și partea din care vin.
  const base = ['', '', '', 'strabunic', 'rastrabunic'][path.length] ?? 'stramos';
  const female = path[path.length - 1] === 'M' ? 'a' : '';
  const rol = t(`arbore.rol_${base}${female}`);
  return t(path[0] === 'F' ? 'arbore.rol_linia_tatalui' : 'arbore.rol_linia_mamei', { rol });
}

const GENERATION_KEYS = ['arbore.rol_porumbelul', 'arbore.gen_parinti', 'arbore.gen_bunici', 'arbore.gen_strabunici', 'arbore.gen_rastrabunici'];
/** Numele generației g (0 = porumbelul, 1 = părinții … 4 = răstrăbunicii). */
export const generationName = (g: number) => (GENERATION_KEYS[g] ? t(GENERATION_KEYS[g]) : '');

/** Câte apariții are fiecare grup de repetare în arbore. */
export function repeatCounts(tree: TreeNode): Map<number, number> {
  const out = new Map<number, number>();
  const walk = (n: TreeNode | null) => {
    if (!n) return;
    if (n.repeat) out.set(n.repeat, (out.get(n.repeat) ?? 0) + 1);
    walk(n.father);
    walk(n.mother);
  };
  walk(tree);
  return out;
}

/** Ultimul porumbel deschis în Arbore (doar pe acest calculator), ca Arborele să se redeschidă tot pe el. */
export const LAST_KEY = 'porumbar.arbore.ultimul';
export function lastRoot(): number | null {
  try {
    return Number(localStorage.getItem(LAST_KEY)) || null;
  } catch {
    return null;
  }
}
export function rememberRoot(id: number) {
  try {
    localStorage.setItem(LAST_KEY, String(id));
  } catch {
    /* fără memorie locală: pornește de la cel mai valoros */
  }
}
