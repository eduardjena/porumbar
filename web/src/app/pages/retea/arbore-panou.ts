import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { percent, sexLabel } from '../../core/catalog';
import { ArboreData, lineColor } from './arbore-data';
import { Icon } from '../../shared/icon';

/** Panoul din dreapta al vederilor Arborelui: porumbelul ales, strămoșii comuni, consangvinizarea, sângele, puii. */
@Component({
  selector: 'app-arbore-panou',
  imports: [RouterLink, Icon],
  template: `
    @if (pigeon(); as p) {
      <section class="card stack">
        <div class="who">
          <span class="score" [class]="'score band-' + (value()?.band ?? 0)">{{ value()?.score ?? '–' }}</span>
          <div>
            <div><strong class="mono">{{ p.ring?.display ?? 'Fără inel' }}</strong></div>
            @if (p.name) { <div class="name">{{ p.name }}</div> }
            <div class="muted">{{ sex(p.sex) }}@if (p.year) { · {{ p.year }} }@if (p.kind === 'external') { · alt porumbar }</div>
          </div>
        </div>
        <div class="row">
          <a class="btn primary" [routerLink]="['/porumbei', p.id]" [queryParams]="from()"><app-icon name="fisa" />Deschide fișa</a>
          @if (p.id !== data().rootId) {
            <button type="button" (click)="startHere.emit(p.id)"><app-icon name="copac" />Pornește de aici</button>
          }
        </div>
      </section>
    }

    <section class="card stack">
      <h3>Strămoși comuni</h3>
      @for (c of data().coi.common; track c.pigeon.id) {
        <button type="button" class="common" (click)="select.emit(c.pigeon.id)">
          <span class="mono">{{ c.pigeon.ring?.display ?? 'Fără inel' }}</span>
          @if (c.pigeon.name) { <span class="muted">„{{ c.pigeon.name }}”</span> }
          <span class="badge">{{ pct(c.contribution) }}</span>
        </button>
      } @empty {
        <p class="muted">Niciunul în pedigree-ul cunoscut.</p>
      }
      <p>Consangvinizare: <strong>{{ pct(data().coi.coi) }}</strong></p>
    </section>

    <section class="card stack">
      <h3>Sângele lui {{ rootName() }}</h3>
      <div class="bar" role="img" [attr.aria-label]="'Liniile de sânge: ' + bloodText()">
        @for (l of data().blood.lines; track l.name; let i = $index) {
          <span [style.width.%]="l.percent" [style.background]="color(l.name, i)" [title]="l.name + ' ' + l.percent + '%'"></span>
        }
      </div>
      <ul class="lines">
        @for (l of data().blood.lines.slice(0, 6); track l.name; let i = $index) {
          <li><i [style.background]="color(l.name, i)"></i>{{ l.name }} <strong>{{ l.percent.toLocaleString('ro-RO') }}%</strong></li>
        }
      </ul>
    </section>

    @if (data().offspring.length) {
      <section class="card stack">
        <h3>Puii lui {{ rootName() }} ({{ data().offspring.length }})</h3>
        <div class="kids">
          @for (k of data().offspring; track k.id) {
            <a [routerLink]="['/porumbei', k.id]" [queryParams]="from()" class="kid">
              <span class="mini" [class]="'mini band-' + (data().values[k.id]?.band ?? 0)">{{ data().values[k.id]?.score ?? '–' }}</span>
              <span class="mono">{{ k.ring?.display?.slice(-6) ?? '?' }}</span>
            </a>
          }
        </div>
      </section>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    h3 { margin: 0; }
    .who { display: flex; gap: 14px; align-items: center; }
    .name { font-weight: 700; }
    .score { flex: none; width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; font-size: 1.3rem; font-weight: 800; }
    .common { justify-content: flex-start; flex-wrap: wrap; gap: 6px 10px; border-radius: 12px; min-height: 48px; padding: 6px 12px; font-weight: 600; }
    .bar { display: flex; height: 22px; border-radius: 999px; overflow: hidden; background: var(--surface-2); }
    .bar span { height: 100%; }
    .lines { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; font-size: 0.95rem; }
    .lines li { display: flex; align-items: center; gap: 8px; }
    .lines i { width: 12px; height: 12px; border-radius: 4px; flex: none; }
    .lines strong { margin-left: auto; }
    .kids { display: flex; flex-wrap: wrap; gap: 6px; }
    .kid { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px 4px 4px; border-radius: 10px; background: var(--surface-2); color: var(--text); text-decoration: none; font-size: 0.85rem; min-height: 40px; }
    .mini { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; font-weight: 800; font-size: 0.85rem; }
  `,
})
export class ArborePanou {
  readonly data = input.required<ArboreData>();
  readonly selectedId = input.required<number>();
  readonly from = input<Record<string, unknown>>({});
  readonly select = output<number>();
  readonly startHere = output<number>();
  protected readonly pct = percent;
  protected readonly sex = sexLabel;
  protected readonly color = lineColor;
  protected readonly pigeon = computed(() => this.data().pigeons[this.selectedId()] ?? this.data().blood.pigeons[this.selectedId()] ?? null);
  protected readonly value = computed(() => this.data().values[this.selectedId()] ?? null);
  protected readonly rootName = computed(() => {
    const r = this.data().pigeons[this.data().rootId];
    return r?.name || r?.ring?.display || 'porumbelului';
  });
  protected readonly bloodText = computed(() => this.data().blood.lines.map((l) => `${l.name} ${l.percent}%`).join(', '));
}
