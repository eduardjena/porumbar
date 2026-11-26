import { Component, computed, inject, input, output, signal, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CatalogService, percent, ringText, sexShort } from '../../core/catalog';
import { CoiResult, PigeonSummary, TreeNode } from '../../core/models';
import { Icon } from '../../shared/icon';
import { ShareButton } from '../../shared/share-button';
import { TPipe, GluePipe } from '../../core/i18n';

// Culori deschise pentru strămoșii care se repetă (textul negru rămâne lizibil pe toate).
const REPEAT_COLORS = ['#ffe08a', '#b9e4ff', '#ffc9de', '#c8f0c2', '#e2d3ff', '#ffd6b0'];
// Aceleași nuanțe, închise, pentru chenare (contrast cel puțin 3:1 pe alb și pe fundalul paginii; pastelul ar avea ~1,3:1).
const REPEAT_BORDERS = ['#9a6f00', '#2b5a86', '#8c357f', '#567a28', '#6d4bb3', '#a33d1c'];

interface Cell {
  key: string;
  depth: number;
  /** Rândurile din grilă: „început / span n”. */
  row: string;
  node: TreeNode | null;
  side: 'father' | 'mother' | null;
  /** La căsuța goală: puiul căruia îi lipsește părintele. */
  childId: number | null;
}

/**
 * Arborele genealogic, așezat ca pe fișa de pedigree: porumbelul în stânga, câte o coloană pe generație, fiecare strămoș în
 * dreptul puiului lui; strămoșii repetați au aceeași culoare; unde lipsește un părinte, butonul „+ Adaugă”.
 */
@Component({
  selector: 'app-arbore',
  imports: [RouterLink, Icon, ShareButton, TPipe, GluePipe],
  template: `
    <div class="bar row">
      <button type="button" (click)="setGen(gen() - 1)" [disabled]="gen() <= 1">{{ 'arbore.mai_putine' | t }}</button>
      <span><strong>{{ gen() + 1 }}</strong>{{ ' ' | glue }}{{ 'arbore.generatii' | t }}</span>
      <button type="button" (click)="setGen(gen() + 1)" [disabled]="gen() >= 5">{{ 'arbore.mai_multe' | t }}</button>
      <!-- Tipărirea pedigree-ului direct de aici (pagina de tipar, foaia A4 cu 5 generații). -->
      <a class="btn print" [routerLink]="['/porumbei', pigeonId(), 'tiparire']" [queryParams]="{ inapoi: 'arbore' }"><app-icon name="tipar" />{{ 'actiune.tipareste' | t }}</a>
      <app-share-button [pigeonId]="pigeonId()" />
    </div>
    @if (coi(); as c) {
      <div [class]="c.coi >= 0.125 ? 'warning' : 'notice'">
        <span class="flow">{{ 'arbore.consangvinizare' | t }}{{ ' ' | glue }}<strong>{{ pct(c.coi) }}</strong>
        @if (c.common.length) {
          <ng-container>{{ ' ' | glue }}{{ 'arbore.stramosi_comuni' | t }}{{ ' ' | glue }}</ng-container>@for (x of c.common; track x.pigeon.id; let last = $last) {<span class="mono">{{ ring(x.pigeon) }}</span>{{ last ? '' : (', ' | glue) }}}
        }</span>
      </div>
    }
    @if (error()) { <div class="error">{{ error() }}</div> }
    @if (tree()) {
      <!-- Așezat ca pe fișa de pedigree: o coloană pe generație, fiecare porumbel în dreptul puiului lui, strâns pe verticală. -->
      <div class="scroll" tabindex="0" [attr.aria-label]="'arbore.aria' | t">
        <div class="sheet" [style.grid-template-columns]="'minmax(96px, 0.9fr) repeat(' + gen() + ', minmax(96px, 1fr))'" [style.grid-template-rows]="'repeat(' + rows() + ', auto)'">
          @for (c of cells(); track c.key) {
            <!-- Celula ocupă toate rândurile porumbelului (ca să știe unde-i e mijlocul); liniile spre pui se desenează din ea. -->
            <div class="cell" [class.root]="c.depth === 0" [class.f]="c.side === 'father'" [class.m]="c.side === 'mother'" [class.has-parents]="c.node && c.depth < gen()"
                 [style.grid-column]="c.depth + 1" [style.grid-row]="c.row">
              @if (c.node; as node) {
                <div class="box" [class]="'box g' + (c.depth > 5 ? 5 : c.depth)" [style.background]="node.repeat && node.both ? color(node.repeat) : null"
                     [style.border]="node.repeat ? '2px solid ' + border(node.repeat) : null"
                     (dblclick)="openPigeon(node.id)" [title]="'arbore.dublu_clic' | t">
                  @if (pigeons()[node.id]; as p) {
                    <div class="line1">
                      @if (p.sex) { <span class="sx" [class]="'sx s' + p.sex">{{ sex(p.sex) }}</span> }
                      <a [routerLink]="['/porumbei', p.id]" class="mono ring">{{ ring(p) }}</a>
                      @if (node.both) { <span class="tm" [title]="'arbore.tm_lung' | t">{{ 'arbore.tm' | t }}</span> }
                    </div>
                    @if (p.name) { <div class="nm">{{ '„' | glue }}{{ p.name }}{{ '”' | glue }}</div> }
                    @if (p.sheet?.color; as col) { <div class="meta">{{ col }}</div> }
                    @if (p.sheet?.breeder; as br) { <div class="meta br">{{ br }}</div> }
                    @if (p.sheet?.text; as tx) { <div class="txt">{{ tx }}</div> }
                  }
                </div>
              } @else {
                <button type="button" class="box empty" (click)="addParent.emit({ id: c.childId!, side: c.side! })">
                  {{ (c.side === 'father' ? 'arbore.adauga_tatal' : 'arbore.adauga_mama') | t }}
                </button>
              }
            </div>
          }
        </div>
      </div>
      @if (legend().length) {
        <p class="muted legend">
          @for (l of legend(); track l.group) {
            <span class="item">
              <span class="swatch" [style.background]="l.both ? color(l.group) : null" [style.border]="'2px solid ' + border(l.group)"></span><span class="mono">{{ l.ring }}</span>
              {{ 'arbore.apare_de' | t: { count: l.count } }}@if (l.both) { · <span class="tm">{{ 'arbore.tm' | t }}</span> {{ 'arbore.tm_lung' | t }}}
            </span>
          }
        </p>
      }
    }
  `,
  styles: `
    .bar { margin-bottom: 12px; }
    .bar .print { margin-left: auto; }
    .scroll { overflow-x: auto; padding: 8px 0 16px; -webkit-overflow-scrolling: touch; }
    /*
     * Ca pe fișa tipărită: coloanele se împart lățimea ecranului (prima puțin mai îngustă), căsuțele umplu tot locul
     * strămoșului, aproape una de alta; textul se scurtează după generație. Cu multe generații, coloanele se strâng
     * până la 96 px, apoi arborele se derulează în lateral.
     */
    .sheet { display: grid; gap: 3px 14px; width: 100%; }
    .cell { position: relative; display: flex; align-items: stretch; min-width: 0; }
    .cell.root { align-items: center; }
    /* Liniile: din pui spre dreapta, apoi în sus la tată (albastru) și în jos la mamă (roz), la jumătatea spațiului dintre coloane. */
    .cell.has-parents::after { content: ''; position: absolute; left: 100%; top: 50%; width: 7px; border-top: 2px solid var(--border-strong); }
    .cell.f::before, .cell.m::before { content: ''; position: absolute; left: -7px; width: 7px; }
    .cell.f::before { top: 50%; bottom: -3px; border-left: 2px solid #8fa9c4; border-top: 2px solid #8fa9c4; border-top-left-radius: 5px; }
    .cell.m::before { top: 0; height: 50%; border-left: 2px solid #c995be; border-bottom: 2px solid #c995be; border-bottom-left-radius: 5px; }
    .box {
      flex: 1; min-width: 0; overflow: hidden; display: flex; flex-direction: column; text-align: left;
      padding: 3px 6px; border-radius: 6px; border: 1px solid #8f8476; background: #fff; box-shadow: 2px 2px 0 #3a3129;
      color: #2b2117; font-size: 0.74rem; line-height: 1.25;
    }
    .box.g0 { font-size: 0.95rem; border: 2px solid #a33d1c; padding: 6px 8px; }
    .box.g1 { font-size: 0.85rem; }
    .box.g2 { font-size: 0.8rem; }
    .box.g5 { font-size: 0.7rem; }
    .line1 { display: flex; align-items: flex-start; gap: 4px; min-width: 0; }
    .ring { font-weight: 700; color: #a33d1c; overflow-wrap: anywhere; }
    .sx { flex: none; width: 1.3em; height: 1.3em; margin-top: 0.05em; border-radius: 50%; display: grid; place-items: center; font-size: 0.75em; font-weight: 700; color: #fff; background: var(--muted); }
    .sx.sM { background: var(--male); }
    .sx.sF { background: var(--female); }
    /* „T+M”: nu se micșorează și nu acoperă inelul; semnul nu e doar culoare. */
    .tm { flex: none; margin-left: auto; font-weight: 700; font-size: 0.85em; color: #2b2117; border: 1px solid #2b2117; border-radius: 4px; padding: 0 3px; line-height: 1.2; }
    .nm { font-weight: 700; }
    .txt { overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
    .g0 .txt { -webkit-line-clamp: 10; }
    .g1 .txt { -webkit-line-clamp: 14; }
    .g2 .txt { -webkit-line-clamp: 8; }
    .g3 .txt { -webkit-line-clamp: 3; }
    .g4 .txt { -webkit-line-clamp: 1; }
    .g4 .br, .g5 .meta, .g5 .txt { display: none; }
    .box.empty {
      flex: 1; border: 1px dashed var(--border-strong); box-shadow: none; background: transparent; color: var(--muted);
      font-weight: 400; min-height: 34px; justify-content: center; align-items: flex-start; font-size: 0.8rem;
    }
    .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; }
    /* Un grup pe element: textul curge și se rupe pe rânduri înăuntru (la 320 px nu iese în lateral). */
    .legend .item { min-width: 0; }
    .swatch { display: inline-block; width: 18px; height: 18px; border-radius: 4px; border: 1px solid var(--border); vertical-align: middle; margin-right: 4px; }
  `,
})
export class Arbore {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly catalog = inject(CatalogService);
  readonly pigeonId = input.required<number>();
  /** Crește când se schimbă părinții, ca arborele să se reîncarce. */
  readonly version = input(0);
  readonly addParent = output<{ id: number; side: string }>();

  // 5 generații (porumbelul + 4), ca pe fișa tipărită.
  readonly gen = signal(4);
  readonly tree = signal<TreeNode | null>(null);
  readonly pigeons = signal<Record<number, PigeonSummary>>({});
  readonly coi = signal<CoiResult | null>(null);
  readonly legend = signal<{ group: number; ring: string; count: number; both: boolean }[]>([]);
  readonly error = signal('');
  protected readonly pct = percent;
  protected readonly ring = ringText;
  protected readonly sex = sexShort;
  protected readonly color = (g: number) => REPEAT_COLORS[(g - 1) % REPEAT_COLORS.length];
  protected readonly border = (g: number) => REPEAT_BORDERS[(g - 1) % REPEAT_BORDERS.length];

  /** Câte rânduri are grila: câți strămoși încap în ultima generație. */
  protected readonly rows = computed(() => 2 ** this.gen());

  protected readonly cells = computed<Cell[]>(() => {
    const root = this.tree();
    const gen = this.gen();
    const rows = 2 ** gen;
    const out: Cell[] = [];
    const place = (i: number, depth: number) => {
      const span = rows / 2 ** depth;
      return `${(i - 2 ** depth) * span + 1} / span ${span}`;
    };
    const walk = (n: TreeNode, i: number, depth: number, side: Cell['side']) => {
      out.push({ key: `${i}`, depth, row: place(i, depth), node: n, side, childId: null });
      if (depth >= gen) return;
      (['father', 'mother'] as const).forEach((s, k) => {
        const child = n[s];
        const ci = 2 * i + k;
        if (child) walk(child, ci, depth + 1, s);
        else out.push({ key: `${ci}`, depth: depth + 1, row: place(ci, depth + 1), node: null, side: s, childId: n.id });
      });
    };
    if (root) walk(root, 1, 0, null);
    return out;
  });

  constructor() {
    effect(() => {
      this.version();
      this.load(this.pigeonId(), this.gen());
    });
  }

  openPigeon(id: number) {
    this.router.navigate(['/porumbei', id]);
  }

  setGen(n: number) {
    // Cel mult 6 generații (porumbelul + 5): mai multe nu mai încap frumos și nu le cere nimeni.
    this.gen.set(Math.max(1, Math.min(5, n)));
  }

  private async load(id: number, gen: number) {
    try {
      const [t, c] = await Promise.all([
        this.api.get<{ tree: TreeNode; pigeons: Record<number, PigeonSummary> }>(`/pigeons/${id}/tree?generations=${gen}`),
        this.api.get<CoiResult>(`/pigeons/${id}/coi`),
      ]);
      this.pigeons.set(t.pigeons);
      this.tree.set(t.tree);
      this.coi.set(c);
      const counts = new Map<number, { group: number; ring: string; count: number; both: boolean }>();
      const walk = (n: TreeNode | null) => {
        if (!n) return;
        if (n.repeat) {
          const e = counts.get(n.repeat) ?? { group: n.repeat, ring: ringText(t.pigeons[n.id]), count: 0, both: false };
          e.count++;
          if (n.both) e.both = true;
          counts.set(n.repeat, e);
        }
        walk(n.father);
        walk(n.mother);
      };
      walk(t.tree);
      // Cele „T+M” primele (sortare stabilă: restul rămân în ordinea de azi).
      this.legend.set([...counts.values()].sort((a, b) => Number(b.both) - Number(a.both)));
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
