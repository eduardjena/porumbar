import { Component, computed, input, output } from '@angular/core';
import { TreeNode } from '../../core/models';
import { ArboreData, REPEAT_COLORS } from './arbore-data';

/*
 * Vederea „Evantai” (macheta 2): pedigree circular. Porumbelul în centru, tatăl în stânga, mama în dreapta; spre
 * margine părinți, bunici, străbunici, răstrăbunici. Felia colorată după notă (gri = alt porumbar), dunga M/F,
 * contur colorat la strămoșii care se repetă. Puii dedesubt, după notă.
 */

const CX = 500;
const CY = 470;
const R0 = 78; // cercul porumbelului
const RING = 92; // grosimea unui inel
const MALE = '#2b5a86';
const FEMALE = '#8c357f';
const BAND_FILL = ['#ebe6df', '#e7efd2', '#c8d99c', '#90b256', '#567a28', '#33501a'];
const BAND_INK = ['#5e5043', '#34461a', '#24350c', '#1e2f08', '#ffffff', '#ffffff'];

interface Slice {
  key: string;
  id: number | null;
  gen: number;
  d: string;
  stripe: string;
  fill: string;
  ink: string;
  sexColor: string;
  repeat: number | null;
  label: string;
  sub: string;
  tx: number;
  ty: number;
  rot: number;
}

const pt = (r: number, deg: number) => [CX + r * Math.cos((deg * Math.PI) / 180), CY - r * Math.sin((deg * Math.PI) / 180)];

/** Felie de inel între razele r1–r2 și unghiurile a1 > a2 (grade, 180 = stânga, 0 = dreapta). */
function sector(r1: number, r2: number, a1: number, a2: number): string {
  const [x1, y1] = pt(r2, a1);
  const [x2, y2] = pt(r2, a2);
  const [x3, y3] = pt(r1, a2);
  const [x4, y4] = pt(r1, a1);
  const f = (n: number) => n.toFixed(1);
  return `M${f(x1)},${f(y1)} A${r2},${r2} 0 0 1 ${f(x2)},${f(y2)} L${f(x3)},${f(y3)} A${r1},${r1} 0 0 0 ${f(x4)},${f(y4)} Z`;
}

@Component({
  selector: 'app-vedere-evantai',
  template: `
    <svg viewBox="0 0 1000 500" class="fan" role="img" aria-label="Evantaiul strămoșilor">
      @for (s of slices(); track s.key) {
        <g class="slice" [class.sel]="s.id != null && s.id === selectedId()" (click)="s.id != null && select.emit(s.id)" (dblclick)="s.id != null && open.emit(s.id)">
          <path [attr.d]="s.d" [attr.fill]="s.fill" stroke="#fffdf9" stroke-width="2" />
          <path [attr.d]="s.stripe" [attr.fill]="s.sexColor" />
          @if (s.repeat) { <path [attr.d]="s.d" fill="none" [attr.stroke]="repeatColor(s.repeat)" stroke-width="4" /> }
          @if (s.id != null && s.id === selectedId()) { <path [attr.d]="s.d" fill="none" stroke="#a33d1c" stroke-width="5" /> }
          @if (s.label) {
            <text [attr.x]="s.tx" [attr.y]="s.ty" [attr.transform]="'rotate(' + s.rot + ' ' + s.tx + ' ' + s.ty + ')'" [attr.fill]="s.ink"
                  text-anchor="middle" dominant-baseline="middle" [attr.font-size]="s.gen <= 2 ? 15 : 12" font-weight="700">
              {{ s.label }}
              @if (s.sub && s.gen <= 2) { <tspan [attr.x]="s.tx" dy="17" font-weight="400" font-size="12">{{ s.sub }}</tspan> }
            </text>
          }
        </g>
      }
      <g class="slice" (click)="select.emit(data().rootId)" (dblclick)="open.emit(data().rootId)">
        <path [attr.d]="rootHalf" [attr.fill]="rootFill()" stroke="#a33d1c" stroke-width="4" stroke-linejoin="round" />
        <text [attr.x]="cx" [attr.y]="cy - 42" text-anchor="middle" [attr.fill]="rootInk()" font-size="24" font-weight="800">{{ rootValue() }}</text>
        <text [attr.x]="cx" [attr.y]="cy - 22" text-anchor="middle" [attr.fill]="rootInk()" font-size="14" font-weight="800">{{ rootName() }}</text>
        <text [attr.x]="cx" [attr.y]="cy - 7" text-anchor="middle" [attr.fill]="rootInk()" font-size="11">{{ rootRing() }}</text>
      </g>
      <text x="40" y="492" font-size="15" font-weight="800" fill="#2b5a86">← familia tatălui</text>
      <text x="960" y="492" font-size="15" font-weight="800" fill="#8c357f" text-anchor="end">familia mamei →</text>
    </svg>
    <p class="muted how">Atinge o felie ca s-o alegi; dublu clic deschide fișa. Culoarea = nota (gri = alt porumbar), dunga = mascul / femelă, conturul colorat = strămoș care se repetă.</p>
  `,
  styles: `
    :host { display: block; }
    .fan { width: 100%; height: auto; max-height: 72vh; display: block; }
    .slice { cursor: pointer; }
    .slice:hover path:first-child { filter: brightness(0.95); }
    .how { margin: 4px 0 0; }
  `,
})
export class VedereEvantai {
  readonly data = input.required<ArboreData>();
  readonly selectedId = input.required<number>();
  readonly select = output<number>();
  readonly open = output<number>();
  protected readonly cx = CX;
  protected readonly cy = CY;
  protected readonly r0 = R0;
  /** Porumbelul: un semicerc așezat pe linia de jos (un cerc întreg ar ieși din desen). */
  protected readonly rootHalf = `M${CX - R0 + 2},${CY} A${R0 - 2},${R0 - 2} 0 0 1 ${CX + R0 - 2},${CY} Z`;
  protected readonly repeatColor = (g: number) => REPEAT_COLORS[(g - 1) % REPEAT_COLORS.length];

  private root = computed(() => this.data().pigeons[this.data().rootId]);
  private rootBand = computed(() => this.data().values[this.data().rootId]?.band ?? 0);
  protected readonly rootFill = computed(() => BAND_FILL[this.rootBand()]);
  protected readonly rootInk = computed(() => BAND_INK[this.rootBand()]);
  protected readonly rootValue = computed(() => this.data().values[this.data().rootId]?.score ?? '–');
  protected readonly rootName = computed(() => this.root()?.name ?? '');
  protected readonly rootRing = computed(() => this.root()?.ring?.display ?? '');

  protected readonly slices = computed<Slice[]>(() => {
    const { pigeons, values } = this.data();
    const out: Slice[] = [];
    const walk = (node: TreeNode | null, gen: number, i: number, key: string) => {
      if (gen > 4) return;
      if (gen > 0) {
        const span = 180 / 2 ** gen;
        const a1 = 180 - i * span;
        const a2 = a1 - span;
        const r1 = R0 + (gen - 1) * RING;
        const r2 = r1 + RING;
        const p = node ? pigeons[node.id] : null;
        const v = node ? values[node.id] : null;
        const band = v?.band ?? 0;
        const own = p?.kind === 'own';
        const mid = (a1 + a2) / 2;
        const rm = (r1 + r2) / 2 + (gen <= 2 ? -4 : 4);
        const [tx, ty] = pt(rm, mid);
        // Text: de-a lungul arcului în inelele interioare (părinți, bunici: feliile sunt late), de-a lungul razei în
        // cele exterioare (feliile sunt înguste); niciodată cu capul în jos, niciodată peste felia vecină.
        const rot = gen <= 2 ? 90 - mid : mid > 90 ? 180 - mid : -mid;
        const ring = p?.ring?.display ?? (node ? 'fără inel' : '');
        out.push({
          key: key || 'r',
          id: node?.id ?? null,
          gen,
          d: sector(r1, r2, a1, a2),
          stripe: sector(r1, r1 + 7, a1, a2),
          fill: !node ? '#f5f0e8' : own ? BAND_FILL[band] : '#e2d8c8',
          ink: own && band >= 4 ? '#ffffff' : '#2b2117',
          sexColor: p?.sex === 'M' ? MALE : p?.sex === 'F' ? FEMALE : 'transparent',
          repeat: node?.repeat ?? null,
          label: gen <= 2 ? ring : ring.replace(/^[A-Z]{2}-\d{2}-/, ''),
          sub: p?.name ? `„${p.name}”` : p?.year ? String(p.year) : '',
          tx,
          ty,
          rot,
        });
      }
      if (!node) return;
      walk(node.father, gen + 1, 2 * i, key + 'F');
      walk(node.mother, gen + 1, 2 * i + 1, key + 'M');
    };
    walk(this.data().tree, 0, 0, '');
    return out;
  });
}
