import { Component, computed, input } from '@angular/core';
import { PedigreeV1Node } from '../core/models';

const REPEAT = ['#c2410c', '#0f766e', '#7c3aed', '#b45309', '#be185d', '#1d4ed8'];
const HEADS = ['Porumbelul', 'Părinți', 'Bunici', 'Străbunici', 'Răstrăbunici'];

interface Box {
  i: number;
  gen: number;
  node: PedigreeV1Node | null;
  row: string;
  repeat: string | null;
}

/*
 * Pedigree-ul ca pe foaie, doar de citit (pagina publică și tiparul A4): porumbelul în stânga, 4 generații spre
 * dreapta; strămoșii care apar de mai multe ori au aceeași culoare (spec §7).
 */
@Component({
  selector: 'app-pedigree-sheet',
  host: { '[class.compact]': 'compact()' },
  template: `
    <div class="heads" aria-hidden="true">@for (h of heads.slice(0, generations()); track h) { <div>{{ h }}</div> }</div>
    <div class="sheet" [style.grid-template-columns]="'repeat(' + generations() + ', minmax(0, 1fr))'" [style.grid-template-rows]="'repeat(' + rows() + ', auto)'">
      @for (b of boxes(); track b.i) {
        <div class="box" [class]="'box g' + b.gen" [style.grid-column]="b.gen + 1" [style.grid-row]="b.row"
             [style.border-color]="b.repeat" [style.box-shadow]="b.repeat ? 'inset 4px 0 0 ' + b.repeat : null">
          @if (b.node; as n) {
            <div class="line1">
              @if (n.sex) { <span class="sx" [class]="'sx s' + n.sex">{{ n.sex }}</span> }
              <strong class="mono">{{ n.ring ?? 'fără inel' }}</strong>
            </div>
            @if (n.name) { <div class="nm">„{{ n.name }}”</div> }
            @if (color(n); as c) { <div class="meta">{{ c }}</div> }
            @if (n.breeder) { <div class="meta">{{ n.breeder }}</div> }
            @if (n.pedigreeText) { <div class="txt" [class]="'txt t' + b.gen">{{ n.pedigreeText }}</div> }
          } @else {
            <span class="muted">—</span>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .heads { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin-bottom: 6px; font-weight: 800; text-transform: uppercase; font-size: 0.78rem; letter-spacing: 0.04em; color: var(--muted); }
    .sheet { display: grid; gap: 5px 8px; }
    .box { align-self: center; border: 1px solid var(--border); border-radius: 10px; padding: 6px 8px; background: var(--surface); font-size: 0.86rem; min-width: 0; break-inside: avoid; }
    .box.g0 { border: 2px solid var(--accent); font-size: 1rem; }
    .line1 { display: flex; align-items: center; gap: 6px; min-width: 0; }
    .line1 strong { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .sx { flex: none; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; font-size: 0.66rem; color: #fff; background: var(--muted); }
    .sx.sM { background: var(--male); }
    .sx.sF { background: var(--female); }
    .nm { font-weight: 700; }
    .meta { color: var(--muted); font-size: 0.8rem; }
    .txt { font-size: 0.8rem; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; }
    .txt.t0, .txt.t1 { -webkit-line-clamp: 6; }
    .txt.t2 { -webkit-line-clamp: 4; }
    .txt.t3 { -webkit-line-clamp: 2; }
    .txt.t4 { -webkit-line-clamp: 1; }
    /* Varianta pentru foaia A4 orizontală (5 generații pe o pagină): scris mic, texte scurtate. */
    :host(.compact) .heads { font-size: 7pt; margin-bottom: 2px; gap: 6px; }
    :host(.compact) .sheet { gap: 2px 6px; }
    :host(.compact) .box { padding: 2px 5px; font-size: 7.5pt; border-radius: 6px; line-height: 1.2; }
    :host(.compact) .box.g0 { font-size: 10pt; padding: 5px 7px; }
    :host(.compact) .sx { width: 12px; height: 12px; font-size: 6pt; }
    :host(.compact) .meta, :host(.compact) .txt { font-size: 6.8pt; }
    :host(.compact) .txt.t0, :host(.compact) .txt.t1 { -webkit-line-clamp: 5; }
    :host(.compact) .txt.t2 { -webkit-line-clamp: 3; }
    :host(.compact) .txt.t3, :host(.compact) .txt.t4 { -webkit-line-clamp: 1; }
    :host(.compact) .g3 .meta, :host(.compact) .g4 .meta { display: none; }
    @media screen and (max-width: 767px) {
      .heads { display: none; }
      .sheet { display: flex; flex-direction: column; }
      .box { grid-row: auto !important; }
    }
  `,
})
export class PedigreeSheet {
  readonly root = input.required<PedigreeV1Node>();
  readonly generations = input(5);
  /** Foaia tipărită: totul pe o pagină A4. */
  readonly compact = input(false);
  protected readonly heads = HEADS;
  protected readonly rows = computed(() => 2 ** (this.generations() - 1));

  protected color(n: PedigreeV1Node) {
    return n.colorText || (n.colorLabel ? `${n.colorLabel}${n.colorPa ? ' p.a.' : ''}` : '') || null;
  }

  protected readonly boxes = computed<Box[]>(() => {
    const gens = this.generations();
    const rows = 2 ** (gens - 1);
    const out: Box[] = [];
    const walk = (n: PedigreeV1Node | null, i: number) => {
      const gen = Math.floor(Math.log2(i));
      if (gen >= gens) return;
      const span = rows / 2 ** gen;
      const start = (i - 2 ** gen) * span + 1;
      out.push({ i, gen, node: n, row: `${start} / span ${span}`, repeat: null });
      if (!n && gen >= 2) return;
      walk(n?.father ?? null, 2 * i);
      walk(n?.mother ?? null, 2 * i + 1);
    };
    walk(this.root(), 1);
    // Strămoșii care se repetă (același inel): aceeași culoare.
    const count = new Map<string, number>();
    for (const b of out) if (b.node?.ring && b.i > 1) count.set(b.node.ring, (count.get(b.node.ring) ?? 0) + 1);
    const colors = new Map<string, string>();
    for (const b of out) {
      const r = b.node?.ring;
      if (!r || (count.get(r) ?? 0) < 2) continue;
      if (!colors.has(r)) colors.set(r, REPEAT[colors.size % REPEAT.length]);
      b.repeat = colors.get(r)!;
    }
    return out;
  });
}
