import { Component, computed, inject, input, output, signal, effect } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CatalogService, percent, ringText, sexShort } from '../../core/catalog';
import { CoiResult, PigeonSummary, TreeNode } from '../../core/models';

// Culori deschise pentru strămoșii care se repetă (textul negru rămâne lizibil pe toate).
const REPEAT_COLORS = ['#ffe08a', '#b9e4ff', '#ffc9de', '#c8f0c2', '#e2d3ff', '#ffd6b0'];

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
  imports: [RouterLink],
  template: `
    <div class="bar row">
      <button type="button" (click)="setGen(gen() - 1)" [disabled]="gen() <= 1">− generații</button>
      <span><strong>{{ gen() + 1 }}</strong> generații</span>
      <button type="button" (click)="setGen(gen() + 1)" [disabled]="gen() >= 9">+ generații</button>
    </div>
    @if (coi(); as c) {
      <div [class]="c.coi >= 0.125 ? 'warning' : 'notice'">
        Consangvinizare: <strong>{{ pct(c.coi) }}</strong>
        @if (c.common.length) {
          — strămoși comuni: @for (x of c.common; track x.pigeon.id; let last = $last) {<span class="mono">{{ ring(x.pigeon) }}</span>{{ last ? '' : ', ' }}}
        }
      </div>
    }
    @if (error()) { <div class="error">{{ error() }}</div> }
    @if (tree()) {
      <!-- Așezat ca pe fișa de pedigree: o coloană pe generație, fiecare porumbel în dreptul puiului lui, strâns pe verticală. -->
      <div class="scroll" tabindex="0" aria-label="Arborele genealogic; se poate derula în lateral">
        <div class="sheet" [style.grid-template-columns]="'repeat(' + (gen() + 1) + ', 190px)'" [style.grid-template-rows]="'repeat(' + rows() + ', auto)'">
          @for (c of cells(); track c.key) {
            @if (c.node; as node) {
              <div class="box" [class.root]="c.depth === 0" [class.f]="c.side === 'father'" [class.m]="c.side === 'mother'"
                   [style.grid-column]="c.depth + 1" [style.grid-row]="c.row" [style.background]="node.repeat ? color(node.repeat) : null"
                   (dblclick)="openPigeon(node.id)" title="Dublu clic: deschide fișa">
                @if (pigeons()[node.id]; as p) {
                  <a [routerLink]="['/porumbei', p.id]" class="mono ring">{{ ring(p) }}</a>
                  <span><span [class]="'sex-' + (p.sex ?? '')">{{ sex(p.sex) }}</span>@if (p.year) { <span class="year"> · {{ p.year }}</span> }</span>
                  @if (p.name) { <span class="name">„{{ p.name }}”</span> }
                  @if (p.color) { <span class="muted">{{ catalog.label('colors', p.color) }}</span> }
                }
              </div>
            } @else {
              <button type="button" class="box empty" [style.grid-column]="c.depth + 1" [style.grid-row]="c.row"
                      (click)="addParent.emit({ id: c.childId!, side: c.side! })">
                + Adaugă {{ c.side === 'father' ? 'tatăl' : 'mama' }}
              </button>
            }
          }
        </div>
      </div>
      @if (legend().length) {
        <p class="muted legend">
          @for (l of legend(); track l.group) {
            <span class="swatch" [style.background]="color(l.group)"></span><span class="mono">{{ l.ring }}</span> apare de {{ l.count }} ori.
          }
        </p>
      }
    }
  `,
  styles: `
    .bar { margin-bottom: 12px; }
    .scroll { overflow-x: auto; padding: 8px 0 16px; -webkit-overflow-scrolling: touch; }
    /* Ca pe fișă: rândurile le dă ultima generație; fiecare porumbel stă la mijlocul rândurilor puiului lui. */
    .sheet { display: grid; gap: 4px 10px; width: max-content; }
    .box {
      align-self: center; background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
      padding: 5px 10px; display: flex; flex-direction: column; font-size: 0.85rem; line-height: 1.3; text-align: left; min-width: 0;
    }
    /* Tatăl (sus) cu dungă albastră, mama (jos) cu dungă roz, ca liniile de dinainte. */
    .box.f { box-shadow: inset 4px 0 0 #8fa9c4; }
    .box.m { box-shadow: inset 4px 0 0 #c995be; }
    .box.root { border: 2px solid var(--accent); }
    .box.empty { border-style: dashed; color: var(--muted); font-weight: 400; min-height: 48px; justify-content: center; box-shadow: none; background: transparent; }
    .ring { font-weight: 700; }
    .year { color: var(--muted); font-weight: 700; }
    .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; }
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
  readonly legend = signal<{ group: number; ring: string; count: number }[]>([]);
  readonly error = signal('');
  protected readonly pct = percent;
  protected readonly ring = ringText;
  protected readonly sex = sexShort;
  protected readonly color = (g: number) => REPEAT_COLORS[(g - 1) % REPEAT_COLORS.length];

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
    this.gen.set(Math.max(1, Math.min(9, n)));
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
      const counts = new Map<number, { group: number; ring: string; count: number }>();
      const walk = (n: TreeNode | null) => {
        if (!n) return;
        if (n.repeat) {
          const e = counts.get(n.repeat) ?? { group: n.repeat, ring: ringText(t.pigeons[n.id]), count: 0 };
          e.count++;
          counts.set(n.repeat, e);
        }
        walk(n.father);
        walk(n.mother);
      };
      walk(t.tree);
      this.legend.set([...counts.values()]);
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
