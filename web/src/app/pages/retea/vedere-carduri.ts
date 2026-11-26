import { Component, DestroyRef, ElementRef, computed, inject, input, output, signal } from '@angular/core';
import { sexShort } from '../../core/catalog';
import { TreeNode } from '../../core/models';
import { TPipe, GluePipe } from '../../core/i18n';
import { ArboreData, generationName, REPEAT_COLORS, roleName, repeatCounts, TreePigeon } from './arbore-data';

/*
 * Vederea „Carduri moderne” (macheta 1): pedigree-ul ca pe hârtie, dar modern. Coloane pe generații (porumbelul în
 * stânga, ca pe fișă, strămoșii spre dreapta), cât e lățimea paginii; carduri cu M/F, inel, text, an, notă; „nu e al tău” scris; strămoșii repetați
 * cu insigna „×N” în aceeași culoare, iar cei de la tată și de la mamă cu semnul „T+M” lângă an; legături curbe; porumbelul ales cu halou pastel.
 */

const LEVELS = 4; // generații deasupra porumbelului: părinți … răstrăbunici
const SLOT = 64; // înălțimea unui loc de răstrăbunic
const WEIGHTS = [212, 204, 192, 180, 172]; // porumbelul, părinți, bunici, străbunici, răstrăbunici (cât din lățime)
const GAP = 26; // spațiul dintre coloane, pentru legături
const MIN_WIDTH = 760; // mai îngust de atât, arborele se derulează
/** Padding-ul din stânga al cardurilor pe generații (titlul coloanei începe în dreptul textului din card). */
const PAD = [16, 11, 11, 9, 9];
const HEIGHT = SLOT * 2 ** LEVELS;

/** Coloanele pe lățimea dată: x și lățimea fiecărei generații (0 = porumbelul, în stânga). */
export function columns(width: number) {
  const w = Math.max(width, MIN_WIDTH);
  const free = w - GAP * LEVELS;
  const total = WEIGHTS.reduce((a, b) => a + b, 0);
  let x = 0;
  return WEIGHTS.map((k) => {
    const col = { x: Math.round(x), w: Math.floor((free * k) / total) };
    x += (free * k) / total + GAP;
    return col;
  });
}

interface Card {
  key: string;
  id: number | null;
  gen: number;
  path: ('F' | 'M')[];
  x: number;
  y: number;
  w: number;
  repeat: number | null;
  both: boolean;
}

@Component({
  selector: 'app-vedere-carduri',
  imports: [TPipe, GluePipe],
  template: `
    <div class="heads" [style.width.px]="width()">
      @for (c of cols(); track $index; let g = $index) {
        <div class="col-head" [style.left.px]="c.x" [style.width.px]="c.w" [style.padding-left.px]="pad[g]">
          {{ genName(g) }}@if (g > 0) { <span class="n">{{ 2 ** g }}</span> }
        </div>
      }
    </div>
    <div class="board" [style.width.px]="width()" [style.height.px]="height">
      <svg class="links" [attr.width]="width()" [attr.height]="height" aria-hidden="true">
        @for (l of links(); track l.key) {
          <path [attr.d]="l.d" [attr.stroke]="l.lit ? '#d92132' : l.side === 'F' ? '#9fb8cf' : '#d2a6c9'" [attr.stroke-width]="l.lit ? 3 : 2" fill="none" />
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
            @if (c.gen <= 3 && (p.name || p.text)) { <span class="txt">{{ p.name ? ('„' | glue) + p.name + ('”' | glue) : '' }}{{ p.name && p.text ? ' · ' : '' }}{{ p.text ?? '' }}</span> }
            <span class="meta">{{ p.year ?? '' }}@if (c.both) { <span class="tm" [title]="'arbore.tm_lung' | t">{{ 'arbore.tm' | t }}</span> }@if (p.kind === 'external') { <span class="tag">{{ 'text.nu_e_al_tau' | t }}</span> } @else { <span class="mine">{{ 'text.al_tau' | t }}</span> }</span>
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
                @if (p.name || p.text) { <span class="txt">{{ p.name ? ('„' | glue) + p.name + ('”' | glue) : '' }}{{ p.name && p.text ? ' · ' : '' }}{{ p.text ?? '' }}</span> }
                <span class="meta">{{ p.year ?? '' }}@if (c.both) { <span class="tm" [title]="'arbore.tm_lung' | t">{{ 'arbore.tm' | t }}</span> }@if (p.kind === 'external') { <span class="tag">{{ 'text.nu_e_al_tau' | t }}</span> } @else { <span class="mine">{{ 'text.al_tau' | t }}</span> }</span>
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
    .col-head { position: absolute; top: 0; display: flex; align-items: baseline; gap: 6px; white-space: nowrap; font-weight: 800; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
    .col-head .n { font-weight: 600; opacity: 0.75; }
    .board { position: relative; }
    .links { position: absolute; inset: 0; pointer-events: none; }
    .card-p {
      position: absolute; transform: translateY(-50%); display: flex; flex-direction: column; align-items: stretch; gap: 2px;
      text-align: left; padding: 8px 10px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border);
      box-shadow: var(--shadow); min-height: 0; font-weight: 400; cursor: pointer; transition: box-shadow 0.2s var(--ease), border-color 0.2s;
    }
    .card-p:hover { border-color: var(--accent); }
    .card-p.sel { border-color: var(--accent); box-shadow: 0 0 0 4px #f7cdd1, 0 0 26px 6px rgb(240 180 150 / 70%); }
    .card-p.g4, .card-p.g3 { padding: 6px 8px; border-radius: 12px; }
    .card-p.g0 { padding: 14px; border: 2px solid var(--accent); }
    /* Padding + bordură = PAD din cod (titlurile coloanelor se aliniază cu textul din carduri). */
    .card-p.empty { color: var(--muted); background: var(--surface-2); box-shadow: none; font-size: 0.85rem; cursor: default; }
    .role { font-size: 0.72rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent-strong); }
    .line1 { display: flex; align-items: center; gap: 6px; min-width: 0; }
    .av { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 0.72rem; color: #fff !important; flex: none; background: var(--muted); }
    .av.sex-M { background: var(--male); }
    .av.sex-F { background: var(--female); }
    /* Inelul se poate scurta, dar nu mai mult de ~8 caractere (insigna și nota nu-l mai strâng până la „R…”). */
    .ring { min-width: 8ch; font-size: 0.88rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .g0 .ring { font-size: 1.05rem; }
    .rep { color: #fff; font-size: 0.72rem; font-weight: 800; padding: 1px 6px; border-radius: 999px; flex: none; }
    .val { margin-left: auto; font-size: 0.78rem; font-weight: 800; padding: 2px 7px; border-radius: 8px; flex: none; }
    .txt { font-size: 0.8rem; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .g0 .txt, .g1 .txt { white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .meta { font-size: 0.78rem; color: var(--muted); display: flex; gap: 6px; align-items: center; min-width: 0; }
    /* Pe cardurile înguste (răstrăbunici) se scurtează „nu e al tău” / „al tău”, nu semnul „T+M” și nici cardul. */
    .tag { background: var(--surface-2); border-radius: 999px; padding: 0 7px; font-weight: 700; }
    .mine { color: var(--ok); font-weight: 700; }
    .tag, .mine { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    /* „T+M”: semn scris (nu doar culoare), ca pe fișa porumbelului: text și chenar închise, fără fundal. */
    .tm { flex: none; font-weight: 700; font-size: 0.72rem; color: var(--text); border: 1px solid var(--text); border-radius: 4px; padding: 0 4px; line-height: 1.2; background: transparent; }
    .gens { display: none; }
    @media (max-width: 767px) {
      :host { overflow: visible; }
      .heads, .board { display: none; }
      .gens { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 8px; }
      .gen { flex: 0 0 calc(100% - 28px); scroll-snap-align: start; display: flex; flex-direction: column; gap: 8px; }
      .gen h3 { margin: 0; display: flex; justify-content: space-between; align-items: baseline; }
      .gen h3 .muted { font-size: 0.85rem; font-weight: 600; }
      .m-card { display: flex; flex-direction: column; align-items: stretch; gap: 3px; text-align: left; padding: 10px 12px; border-radius: 14px; font-weight: 400; background: var(--surface); }
      .m-card.sel { border-color: var(--accent); box-shadow: 0 0 0 3px #f7cdd1; }
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
  /** Lățimea locului (măsurată); coloanele se împart pe ea. */
  private readonly avail = signal(1072);
  protected readonly width = computed(() => Math.max(this.avail(), MIN_WIDTH));
  protected readonly cols = computed(() => columns(this.avail()));
  protected readonly pad = PAD;
  protected readonly height = HEIGHT;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const ro = new ResizeObserver(() => {
      const w = Math.floor(host.clientWidth);
      if (w > 0) this.avail.set(w);
    });
    ro.observe(host);
    inject(DestroyRef).onDestroy(() => ro.disconnect());
  }
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
      const col = this.cols()[gen];
      const y = (i + 0.5) * SLOT * 2 ** (LEVELS - gen);
      out.push({ key: path.join('') || 'root', id: node?.id ?? null, gen, path, x: col.x, y, w: col.w, repeat: node?.repeat ?? null, both: !!node?.both });
      if (!node && gen >= 2) return;
      place(node?.father ?? null, gen + 1, 2 * i, [...path, 'F']);
      place(node?.mother ?? null, gen + 1, 2 * i + 1, [...path, 'M']);
    };
    place(this.data().tree, 0, 0, []);
    return out;
  });

  /** Legăturile curbe: din marginea dreaptă a puiului spre marginea stângă a părintelui. */
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
      const x1 = child.x + child.w;
      const x2 = c.x;
      const mid = (x1 + x2) / 2;
      out.push({ key: c.key, d: `M${x1},${child.y} C${mid},${child.y} ${mid},${c.y} ${x2},${c.y}`, side: c.path[c.path.length - 1], lit: litKeys.has(c.key) });
    }
    return out;
  });
}
