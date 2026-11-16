import { Component, inject, input, output, signal, effect } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CatalogService, percent, ringText, sexShort } from '../../core/catalog';
import { CoiResult, PigeonSummary, TreeNode } from '../../core/models';

// Culori deschise pentru strămoșii care se repetă (textul negru rămâne lizibil pe toate).
const REPEAT_COLORS = ['#ffe08a', '#b9e4ff', '#ffc9de', '#c8f0c2', '#e2d3ff', '#ffd6b0'];

/** Arborele genealogic: rădăcina în stânga, ca pe pedigree-urile cunoscute; strămoșii repetați au aceeași culoare. */
@Component({
  selector: 'app-arbore',
  imports: [NgTemplateOutlet, RouterLink],
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
    @if (tree(); as t) {
      <div class="scroll" tabindex="0" aria-label="Arborele genealogic; se poate derula în lateral">
        <ng-container *ngTemplateOutlet="branch; context: { $implicit: t, depth: 0 }" />
      </div>
      @if (legend().length) {
        <p class="muted legend">
          @for (l of legend(); track l.group) {
            <span class="swatch" [style.background]="color(l.group)"></span><span class="mono">{{ l.ring }}</span> apare de {{ l.count }} ori.
          }
        </p>
      }
    }

    <ng-template #branch let-node let-depth="depth">
      <div class="branch">
        <div class="box" [style.background]="node.repeat ? color(node.repeat) : null" [class.root]="depth === 0">
          @if (pigeons()[node.id]; as p) {
            <a [routerLink]="['/porumbei', p.id]" class="mono ring">{{ ring(p) }}</a>
            <span><span [class]="'sex-' + (p.sex ?? '')">{{ sex(p.sex) }}</span>@if (p.year) { <span class="year"> · {{ p.year }}</span> }</span>
            @if (p.name) { <span class="name">„{{ p.name }}”</span> }
            @if (p.color) { <span class="muted">{{ catalog.label('colors', p.color) }}</span> }
          }
        </div>
        @if (depth < gen()) {
          <div class="parents">
            @for (side of ['father', 'mother']; track side) {
              @if (node[side]; as child) {
                <ng-container *ngTemplateOutlet="branch; context: { $implicit: child, depth: depth + 1 }" />
              } @else {
                <div class="branch">
                  <button type="button" class="box empty" (click)="addParent.emit({ id: node.id, side })">
                    + Adaugă {{ side === 'father' ? 'tatăl' : 'mama' }}
                  </button>
                </div>
              }
            }
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: `
    .bar { margin-bottom: 12px; }
    .scroll { overflow-x: auto; padding: 8px 0 16px; -webkit-overflow-scrolling: touch; }
    .branch { display: flex; align-items: center; }
    /* Liniile clasice de pedigree: din puiul din stânga iese o linie, care se desparte spre tată (sus) și mamă (jos). */
    .parents { display: flex; flex-direction: column; gap: 10px; position: relative; margin-left: 22px; }
    .parents::before { content: ''; position: absolute; left: -22px; top: 50%; width: 22px; border-top: 2px solid var(--border-strong); }
    .parents > .branch { position: relative; padding-left: 22px; }
    .parents > .branch::before { content: ''; position: absolute; left: 0; border-left: 2px solid var(--border-strong); }
    .parents > .branch::after { content: ''; position: absolute; left: 0; top: 50%; width: 22px; border-top: 2px solid var(--border-strong); }
    .parents > .branch:first-child::before { top: 50%; bottom: -5px; }
    .parents > .branch:last-child::before { top: -5px; bottom: 50%; }
    .parents > .branch:first-child::before, .parents > .branch:first-child::after { border-color: #8fa9c4; }
    .parents > .branch:last-child::before, .parents > .branch:last-child::after { border-color: #c995be; }
    .box {
      width: 190px; flex: none; background: var(--surface); border: 1px solid var(--border); border-radius: 10px;
      padding: 6px 10px; display: flex; flex-direction: column; font-size: 0.85rem; line-height: 1.3; text-align: left;
    }
    .box.root { border: 2px solid var(--accent); }
    .box.empty { border-style: dashed; color: var(--muted); font-weight: 400; min-height: 48px; justify-content: center; }
    .ring { font-weight: 700; }
    .year { color: var(--muted); font-weight: 700; }
    .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; }
    .swatch { display: inline-block; width: 18px; height: 18px; border-radius: 4px; border: 1px solid var(--border); vertical-align: middle; margin-right: 4px; }
  `,
})
export class Arbore {
  private readonly api = inject(Api);
  protected readonly catalog = inject(CatalogService);
  readonly pigeonId = input.required<number>();
  /** Crește când se schimbă părinții, ca arborele să se reîncarce. */
  readonly version = input(0);
  readonly addParent = output<{ id: number; side: string }>();

  readonly gen = signal(3);
  readonly tree = signal<TreeNode | null>(null);
  readonly pigeons = signal<Record<number, PigeonSummary>>({});
  readonly coi = signal<CoiResult | null>(null);
  readonly legend = signal<{ group: number; ring: string; count: number }[]>([]);
  readonly error = signal('');
  protected readonly pct = percent;
  protected readonly ring = ringText;
  protected readonly sex = sexShort;
  protected readonly color = (g: number) => REPEAT_COLORS[(g - 1) % REPEAT_COLORS.length];

  constructor() {
    effect(() => {
      this.version();
      this.load(this.pigeonId(), this.gen());
    });
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
