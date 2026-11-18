import { Component, computed, input, output } from '@angular/core';
import { sexShort } from '../../core/catalog';
import { TreeNode } from '../../core/models';
import { TPipe } from '../../core/i18n';
import { ArboreData, generationName, REPEAT_COLORS, roleName, repeatCounts, TreePigeon } from './arbore-data';

/*
 * Vederea „Carduri moderne” (macheta 1): pedigree-ul ca pe hârtie, dar modern. Coloane pe generații (strămoșii în
 * stânga, porumbelul în dreapta), carduri cu M/F, inel, text, an, notă; „nu e al tău” scris; strămoșii repetați
 * cu insigna „×N” în aceeași culoare; legături curbe; porumbelul ales cu halou pastel.
 */

const LEVELS = 4; // generații deasupra porumbelului: părinți … răstrăbunici
const SLOT = 64; // înălțimea unui loc de răstrăbunic
const COLS = [
  { x: 0, w: 172 }, // răstrăbunici
  { x: 190, w: 180 }, // străbunici
  { x: 388, w: 192 }, // bunici
  { x: 598, w: 204 }, // părinți
  { x: 820, w: 212 }, // porumbelul
];
const WIDTH = 1032;
const HEIGHT = SLOT * 2 ** LEVELS;

interface Card {
  key: string;
  id: number | null;
  gen: number;
  path: ('F' | 'M')[];
  x: number;
  y: number;
  w: number;
  repeat: number | null;
}

@Component({
  selector: 'app-vedere-carduri',
  imports: [TPipe],
  template: `
    <div class="heads" [style.width.px]="width">
      @for (c of cols; track $index; let g = $index) {
        <div class="col-head" [style.left.px]="c.x" [style.width.px]="c.w">
          {{ genName(4 - g) }} <span class="muted">{{ 4 - g === 0 ? '' : 2 ** (4 - g) }}</span>
        </div>
      }
    </div>
    <div class="board" [style.width.px]="width" [style.height.px]="height">
      <svg class="links" [attr.width]="width" [attr.height]="height" aria-hidden="true">
        @for (l of links(); track l.key) {
          <path [attr.d]="l.d" [attr.stroke]="l.lit ? '#a33d1c' : l.side === 'F' ? '#9fb8cf' : '#d2a6c9'" [attr.stroke-width]="l.lit ? 3 : 2" fill="none" />
        }
      </svg>
      @for (c of cards(); track c.key) {
        @if (c.id != null && pigeons()[c.id]; as p) {
          <button type="button" class="card-p" [class]="'card-p g' + c.gen" [class.sel]="c.id === selectedId()"
                  [style.left.px]="c.x" [style.top.px]="c.y" [style.width.px]="c.w"
                  (click)="select.emit(c.id!)" (dblclick)="open.emit(c.id!)" [title]="'arbore.dublu_clic' | t">
            @if (c.gen >= 1 && c.gen <= 2) { <span class="role">{{ role(c.path) }}</span> }
            <span class="line1">
              <span class="av" [class]="'av sex-' + (p.sex ?? '')">{{ sex(p.sex) }}</span>
              <span class="mono ring">{{ p.ring?.display ?? ('text.fara_inel_mare' | t) }}</span>
              @if (c.repeat) { <span class="rep" [style.background]="repeatColor(c.repeat)">×{{ counts().get(c.repeat) }}</span> }
              @if (value(p.id); as v) { <span class="val" [class]="'val band-' + v.band">{{ v.score ?? '–' }}</span> }
            </span>
            @if (c.gen <= 3 && (p.name || p.text)) { <span class="txt">{{ p.name ? '„' + p.name + '”' : '' }}{{ p.name && p.text ? ' · ' : '' }}{{ p.text ?? '' }}</span> }
            <span class="meta">{{ p.year ?? '' }}@if (p.kind === 'external') { <span class="tag">{{ 'text.nu_e_al_tau' | t }}</span> } @else { <span class="mine">{{ 'text.al_tau' | t }}</span> }</span>
          </button>
        } @else if (c.gen <= 2) {
          <div class="card-p empty" [style.left.px]="c.x" [style.top.px]="c.y" [style.width.px]="c.w">{{ 'arbore.rol_necunoscut' | t: { rol: role(c.path) } }}</div>
        }
      }
    </div>

    <!-- Pe telefon: câte o generație pe ecran, glisezi între ele; fiecare card spune ce rudă e. -->
    <div class="gens" [attr.aria-label]="'arbore.aria_generatii' | t">
      @for (g of genList; track g) {
        <section class="gen">
          <h3>{{ genName(g) }} <span class="muted">{{ g < 4 ? ('arbore.gliseaza' | t) : '' }}</span></h3>
          @for (c of cardsOf(g); track c.key) {
            @if (c.id != null && pigeons()[c.id]; as p) {
              <button type="button" class="m-card" [class.sel]="c.id === selectedId()" (click)="select.emit(c.id!)" (dblclick)="open.emit(c.id!)">
                <span class="role">{{ role(c.path) }}</span>
                <span class="line1">
                  <span class="av" [class]="'av sex-' + (p.sex ?? '')">{{ sex(p.sex) }}</span>
                  <span class="mono ring">{{ p.ring?.display ?? ('text.fara_inel_mare' | t) }}</span>
                  @if (c.repeat) { <span class="rep" [style.background]="repeatColor(c.repeat)">×{{ counts().get(c.repeat) }}</span> }
                  @if (value(p.id); as v) { <span class="val" [class]="'val band-' + v.band">{{ v.score ?? '–' }}</span> }
                </span>
                @if (p.name || p.text) { <span class="txt">{{ p.name ? '„' + p.name + '”' : '' }}{{ p.name && p.text ? ' · ' : '' }}{{ p.text ?? '' }}</span> }
                <span class="meta">{{ p.year ?? '' }}@if (p.kind === 'external') { <span class="tag">{{ 'text.nu_e_al_tau' | t }}</span> } @else { <span class="mine">{{ 'text.al_tau' | t }}</span> }</span>
              </button>
            } @else if (g <= 2) {
              <div class="m-card empty">{{ 'arbore.rol_necunoscut' | t: { rol: role(c.path) } }}</div>
            }
          }
        </section>
      }
    </div>
  `,
  styles: `
    :host { display: block; overflow-x: auto; padding-bottom: 8px; }
    .heads { position: relative; height: 36px; }
    .col-head { position: absolute; top: 0; font-weight: 800; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
    .board { position: relative; }
    .links { position: absolute; inset: 0; pointer-events: none; }
    .card-p {
      position: absolute; transform: translateY(-50%); display: flex; flex-direction: column; align-items: stretch; gap: 2px;
      text-align: left; padding: 8px 10px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border);
      box-shadow: var(--shadow); min-height: 0; font-weight: 400; cursor: pointer; transition: box-shadow 0.2s var(--ease), border-color 0.2s;
    }
    .card-p:hover { border-color: var(--accent); }
    .card-p.sel { border-color: var(--accent); box-shadow: 0 0 0 4px #f3d3c3, 0 0 26px 6px rgb(240 180 150 / 70%); }
    .card-p.g4, .card-p.g3 { padding: 6px 8px; border-radius: 12px; }
    .card-p.g0 { padding: 14px; border: 2px solid var(--accent); }
    .card-p.empty { color: var(--muted); background: var(--surface-2); box-shadow: none; font-size: 0.85rem; cursor: default; }
    .role { font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-strong); }
    .line1 { display: flex; align-items: center; gap: 6px; min-width: 0; }
    .av { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 0.72rem; color: #fff !important; flex: none; background: var(--muted); }
    .av.sex-M { background: var(--male); }
    .av.sex-F { background: var(--female); }
    .ring { font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .g0 .ring { font-size: 1.05rem; }
    .rep { color: #fff; font-size: 0.72rem; font-weight: 800; padding: 1px 6px; border-radius: 999px; flex: none; }
    .val { margin-left: auto; font-size: 0.78rem; font-weight: 800; padding: 2px 7px; border-radius: 8px; flex: none; }
    .txt { font-size: 0.8rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .g0 .txt, .g1 .txt { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .meta { font-size: 0.78rem; color: var(--muted); display: flex; gap: 6px; align-items: center; }
    .tag { background: var(--surface-2); border-radius: 999px; padding: 0 7px; font-weight: 700; }
    .mine { color: var(--ok); font-weight: 700; }
    .gens { display: none; }
    @media (max-width: 767px) {
      :host { overflow: visible; }
      .heads, .board { display: none; }
      .gens { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 8px; }
      .gen { flex: 0 0 calc(100% - 28px); scroll-snap-align: start; display: flex; flex-direction: column; gap: 8px; }
      .gen h3 { margin: 0; display: flex; justify-content: space-between; align-items: baseline; }
      .gen h3 .muted { font-size: 0.85rem; font-weight: 600; }
      .m-card { display: flex; flex-direction: column; align-items: stretch; gap: 3px; text-align: left; padding: 10px 12px; border-radius: 14px; font-weight: 400; background: var(--surface); }
      .m-card.sel { border-color: var(--accent); box-shadow: 0 0 0 3px #f3d3c3; }
      .m-card.empty { color: var(--muted); background: var(--surface-2); border: 1px dashed var(--border); }
      .m-card .txt { white-space: normal; }
    }
  `,
})
export class VedereCarduri {
  readonly data = input.required<ArboreData>();
  readonly selectedId = input.required<number>();
  readonly select = output<number>();
  readonly open = output<number>();
  protected readonly cols = COLS;
  protected readonly width = WIDTH;
  protected readonly height = HEIGHT;
  protected readonly sex = sexShort;
  protected readonly role = roleName;
  protected readonly genName = generationName;
  protected readonly repeatColor = (g: number) => REPEAT_COLORS[(g - 1) % REPEAT_COLORS.length];
  protected readonly pigeons = computed<Record<number, TreePigeon>>(() => this.data().pigeons);
  protected readonly counts = computed(() => repeatCounts(this.data().tree));
  protected readonly value = (id: number) => this.data().values[id] ?? null;
  protected readonly genList = [0, 1, 2, 3, 4];
  protected readonly cardsOf = (g: number) => this.cards().filter((c) => c.gen === g);

  /** Locul fiecărei căsuțe: generația g, indexul i (tatăl = 2i, mama = 2i + 1). */
  protected readonly cards = computed<Card[]>(() => {
    const out: Card[] = [];
    const place = (node: TreeNode | null, gen: number, i: number, path: ('F' | 'M')[]) => {
      if (gen > LEVELS) return;
      const col = COLS[LEVELS - gen];
      const y = (i + 0.5) * SLOT * 2 ** (LEVELS - gen);
      out.push({ key: path.join('') || 'root', id: node?.id ?? null, gen, path, x: col.x, y, w: col.w, repeat: node?.repeat ?? null });
      if (!node && gen >= 2) return;
      place(node?.father ?? null, gen + 1, 2 * i, [...path, 'F']);
      place(node?.mother ?? null, gen + 1, 2 * i + 1, [...path, 'M']);
    };
    place(this.data().tree, 0, 0, []);
    return out;
  });

  /** Legăturile curbe: din marginea stângă a puiului spre marginea dreaptă a părintelui. */
  protected readonly links = computed(() => {
    const byKey = new Map(this.cards().map((c) => [c.path.join(''), c]));
    const sel = this.selectedId();
    // Drumurile porumbelului ales (toate aparițiile) spre rădăcină se evidențiază.
    const litKeys = new Set<string>();
    for (const c of this.cards()) if (c.id === sel && c.gen > 0) for (let k = 1; k <= c.path.length; k++) litKeys.add(c.path.slice(0, k).join(''));
    const out: { key: string; d: string; side: 'F' | 'M'; lit: boolean }[] = [];
    for (const c of this.cards()) {
      if (!c.path.length || c.id == null) continue;
      const child = byKey.get(c.path.slice(0, -1).join(''));
      if (!child) continue;
      const x1 = c.x + c.w;
      const x2 = child.x;
      const mid = (x1 + x2) / 2;
      out.push({ key: c.key, d: `M${x1},${c.y} C${mid},${c.y} ${mid},${child.y} ${x2},${child.y}`, side: c.path[c.path.length - 1], lit: litKeys.has(c.key) });
    }
    return out;
  });
}
