import { Component, computed, input, output, signal } from '@angular/core';
import { ArboreData, lineColor } from './arbore-data';

/*
 * Vederea „Liniile de sânge” (macheta 4): fiecare linie (fondator) e o panglică colorată care curge de la strămoșii
 * fondatori (stânga) spre porumbel (dreapta); grosimea = cât sânge aduce pe acel drum. Fiecare porumbel o singură
 * dată, în coloana celei mai apropiate generații. Sus, bara cu procentele liniilor.
 */

const COL_W = 210;
const NODE_W = 150;
const NODE_H = 40;
const TOP = 20;
const ROW = 48; // loc pe verticală pentru un porumbel
const FULL = 150; // grosimea panglicii pentru 100 %

interface Node2 {
  id: number;
  depth: number;
  x: number;
  y: number;
}

@Component({
  selector: 'app-vedere-sange',
  template: `
    <div class="bar" role="img" [attr.aria-label]="'Liniile de sânge: ' + summary()">
      @for (l of lines(); track l.name; let i = $index) {
        <button type="button" [style.width.%]="l.percent" [style.background]="color(l.name, i)" [class.dim]="line() && line() !== l.name"
                (click)="toggle(l.name)" [title]="l.name + ' ' + l.percent + '%'">
          @if (l.percent >= 8) { <span>{{ l.name }} {{ fmt(l.percent) }}%</span> }
        </button>
      }
    </div>
    <div class="chips">
      @for (l of lines(); track l.name; let i = $index) {
        <button type="button" class="chip" [class.on]="line() === l.name" (click)="toggle(l.name)">
          <i [style.background]="color(l.name, i)"></i>{{ l.name }} <strong>{{ fmt(l.percent) }}%</strong>
        </button>
      }
    </div>
    @if (explain(); as e) { <p class="explain">{{ e }}</p> }

    <div class="scroll">
      <svg [attr.viewBox]="'0 0 ' + width() + ' ' + height()" [style.min-width.px]="width() * 0.75" role="img" aria-label="Panglicile liniilor de sânge">
        @for (r of ribbons(); track r.key) {
          <path [attr.d]="r.d" fill="none" [attr.stroke]="r.color" [attr.stroke-width]="r.w" stroke-linecap="round"
                [attr.opacity]="line() && line() !== r.line ? 0.07 : 0.6" />
        }
        @for (n of nodes(); track n.id) {
          <g class="node" [class.sel]="n.id === selectedId()" (click)="select.emit(n.id)" (dblclick)="open.emit(n.id)">
            <rect [attr.x]="n.x" [attr.y]="n.y - nodeH / 2" [attr.width]="nodeW" [attr.height]="nodeH" rx="10"
                  [attr.fill]="n.id === data().rootId ? '#a33d1c' : '#fffdf9'" [attr.stroke]="n.id === selectedId() ? '#a33d1c' : '#c2b39c'"
                  [attr.stroke-width]="n.id === selectedId() ? 3 : 1" />
            <text [attr.x]="n.x + 10" [attr.y]="n.y - 3" font-size="13" font-weight="800" [attr.fill]="n.id === data().rootId ? '#fff' : '#2b2117'">{{ ring(n.id) }}</text>
            <text [attr.x]="n.x + 10" [attr.y]="n.y + 13" font-size="11" [attr.fill]="n.id === data().rootId ? '#fff' : '#625345'">{{ sub(n.id) }}</text>
          </g>
        }
      </svg>
    </div>
    <p class="muted how">Grosimea = cât sânge aduce · culoarea = linia (fondatorul). Atinge o linie, în bară sau în listă, ca să rămână doar ea. Linia fondatorului vine din câmpul „Linii” din fișă (sau din crescătorul de origine).</p>
  `,
  styles: `
    :host { display: block; }
    .bar { display: flex; height: 44px; border-radius: 14px; overflow: hidden; background: var(--surface-2); }
    .bar button { border: 0; border-radius: 0; min-height: 0; padding: 0 6px; color: #fff; font-size: 0.85rem; overflow: hidden; white-space: nowrap; transition: opacity 0.2s; }
    .bar span { overflow: hidden; text-overflow: ellipsis; }
    .bar button.dim { opacity: 0.25; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0; }
    .chip { min-height: 44px; padding: 4px 12px; border-radius: 999px; font-weight: 600; gap: 8px; }
    .chip.on { border-color: var(--accent); background: var(--accent-soft); }
    .chip i { width: 12px; height: 12px; border-radius: 4px; display: inline-block; }
    .explain { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 12px 14px; }
    .scroll svg { display: block; width: 100%; height: auto; }
    .scroll { overflow-x: auto; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 8px 0; }
    .node { cursor: pointer; }
    .how { margin: 6px 0 0; }
  `,
})
export class VedereSange {
  readonly data = input.required<ArboreData>();
  readonly selectedId = input.required<number>();
  readonly select = output<number>();
  readonly open = output<number>();
  readonly line = signal<string | null>(null);
  protected readonly color = lineColor;
  protected readonly nodeW = NODE_W;
  protected readonly nodeH = NODE_H;
  protected readonly fmt = (n: number) => n.toLocaleString('ro-RO');
  protected readonly lines = computed(() => this.data().blood.lines);
  protected readonly summary = computed(() => this.lines().map((l) => `${l.name} ${l.percent}%`).join(', '));
  private readonly colorOf = computed(() => new Map(this.lines().map((l, i) => [l.name, lineColor(l.name, i)])));

  toggle(name: string) {
    this.line.set(this.line() === name ? null : name);
  }

  private pigeon = (id: number) => this.data().pigeons[id] ?? this.data().blood.pigeons[id];
  protected ring = (id: number) => this.pigeon(id)?.ring?.display ?? 'fără inel';
  protected sub = (id: number) => {
    const p = this.pigeon(id);
    return [p?.name ? `„${p.name}”` : '', p?.year ?? ''].filter(Boolean).join(' · ');
  };

  /** Fiecare porumbel o dată, în coloana generației celei mai apropiate de rădăcină. */
  protected readonly nodes = computed<Node2[]>(() => {
    const depth = new Map<number, number>();
    const order: number[] = [];
    for (const p of this.data().blood.paths) {
      p.via.forEach((id, k) => {
        const d = p.via.length - 1 - k;
        if (!depth.has(id)) order.push(id);
        depth.set(id, Math.min(depth.get(id) ?? Infinity, d));
      });
    }
    if (!depth.size) depth.set(this.data().rootId, 0), order.push(this.data().rootId);
    const max = Math.max(...depth.values());
    const cols = new Map<number, number[]>();
    for (const id of order) {
      const d = depth.get(id)!;
      cols.set(d, [...(cols.get(d) ?? []), id]);
    }
    const out: Node2[] = [];
    const h = this.heightFor(Math.max(...[...cols.values()].map((ids) => ids.length)));
    for (const [d, ids] of cols) {
      ids.forEach((id, k) => out.push({ id, depth: d, x: 20 + (max - d) * COL_W, y: TOP + ((k + 0.5) * (h - 2 * TOP)) / ids.length }));
    }
    return out;
  });

  private heightFor = (rows: number) => Math.max(360, rows * ROW + 2 * TOP);
  protected readonly height = computed(() => {
    const per = new Map<number, number>();
    for (const n of this.nodes()) per.set(n.depth, (per.get(n.depth) ?? 0) + 1);
    return this.heightFor(Math.max(1, ...per.values()));
  });
  protected readonly width = computed(() => 40 + (Math.max(0, ...this.nodes().map((n) => n.depth)) + 1) * COL_W);

  /** Panglicile: pentru fiecare drum, segmente curbe între porumbeii de pe drum, groase cât cota drumului. */
  protected readonly ribbons = computed(() => {
    const pos = new Map(this.nodes().map((n) => [n.id, n]));
    const out: { key: string; d: string; color: string; w: number; line: string }[] = [];
    this.data().blood.paths.forEach((p, pi) => {
      if (p.founderId == null) return; // partea necunoscută apare doar în bară
      const color = this.colorOf().get(p.line) ?? '#b9ad9d';
      const w = Math.max(2, p.share * FULL);
      for (let k = 0; k + 1 < p.via.length; k++) {
        const a = pos.get(p.via[k]);
        const b = pos.get(p.via[k + 1]);
        if (!a || !b) continue;
        const x1 = a.x + NODE_W;
        const x2 = b.x;
        const mid = (x1 + x2) / 2;
        out.push({ key: `${pi}-${k}`, d: `M${x1},${a.y} C${mid},${a.y} ${mid},${b.y} ${x2},${b.y}`, color, w, line: p.line });
      }
    });
    return out;
  });

  /** Explicația liniei alese: prin ce strămoși vine și pe câte drumuri. */
  protected readonly explain = computed(() => {
    const name = this.line();
    if (!name) return '';
    const l = this.lines().find((x) => x.name === name);
    if (!l) return '';
    const paths = this.data().blood.paths.filter((p) => p.line === name);
    if (name === 'Necunoscut') return `Necunoscut, ${this.fmt(l.percent)} %: părinți care nu sunt trecuți în program.`;
    const founders = l.founders.map((id) => this.ring(id)).join(', ');
    const parts = paths.map((p) => `${this.fmt(Math.round(p.share * 1e4) / 1e2)} %`).join(' + ');
    return `${name}, ${this.fmt(l.percent)} %: vine prin ${founders}, pe ${paths.length} ${paths.length === 1 ? 'drum' : 'drumuri'} (${parts}).${paths.length > 1 ? ' Aici se întâlnesc liniile.' : ''}`;
  });
}
