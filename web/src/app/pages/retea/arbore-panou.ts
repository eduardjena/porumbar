import { Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { percent, sexLabel } from '../../core/catalog';
import { formatNumber, t, TPipe, GluePipe, glue } from '../../core/i18n';
import { ArboreData, lineColor } from './arbore-data';
import { Icon } from '../../shared/icon';

/** Panoul din dreapta al vederilor Arborelui: porumbelul ales, strămoșii comuni, consangvinizarea, sângele, puii. */
@Component({
  selector: 'app-arbore-panou',
  imports: [RouterLink, Icon, TPipe, GluePipe],
  template: `
    @if (pigeon(); as p) {
      <section class="card stack">
        <div class="who">
          <span class="score" [class]="'score band-' + (value()?.band ?? 0)">{{ value()?.score ?? '–' }}</span>
          <div>
            <div><strong class="mono">{{ p.ring?.display ?? ('text.fara_inel_mare' | t) }}</strong></div>
            @if (p.name) { <div class="name">{{ p.name }}</div> }
            <div class="muted">{{ sex(p.sex) }}@if (p.year) { · {{ p.year }} }@if (p.kind === 'external') { · {{ 'text.nu_e_al_tau' | t }} }</div>
          </div>
        </div>
        <div class="row">
          <a class="btn primary" [routerLink]="['/porumbei', p.id]" [queryParams]="from()"><app-icon name="fisa" />{{ 'actiune.deschide_fisa' | t }}</a>
          @if (p.id !== data().rootId) {
            <button type="button" (click)="startHere.emit(p.id)"><app-icon name="copac" />{{ 'actiune.porneste_de_aici' | t }}</button>
          }
        </div>
      </section>
    }

    <section class="card stack">
      <h3>{{ 'arbore.stramosi_comuni_titlu' | t }}</h3>
      @for (c of data().coi.common; track c.pigeon.id) {
        <button type="button" class="common" (click)="select.emit(c.pigeon.id)">
          <span class="mono">{{ c.pigeon.ring?.display ?? ('text.fara_inel_mare' | t) }}</span>
          @if (c.pigeon.name) { <span class="muted">{{ '„' | glue }}{{ c.pigeon.name }}{{ '”' | glue }}</span> }
          <span class="badge">{{ pct(c.contribution) }}</span>
        </button>
      } @empty {
        <p class="muted">{{ 'arbore.niciunul_comun' | t }}</p>
      }
      <p>{{ 'arbore.consangvinizare' | t }}{{ ' ' | glue }}<strong>{{ pct(data().coi.coi) }}</strong></p>
    </section>

    <section class="card stack">
      <h3>{{ 'arbore.sangele_lui' | t: { nume: rootName() } }}</h3>
      <div class="bar" role="img" [attr.aria-label]="'arbore.aria_linii' | t: { linii: bloodText() }">
        @for (l of data().blood.lines; track l.name; let i = $index) {
          <span [style.width.%]="l.percent" [style.background]="color(l.name, i)" [title]="l.name + ' ' + l.percent + '%'"></span>
        }
      </div>
      <ul class="lines">
        @for (l of data().blood.lines.slice(0, 6); track l.name; let i = $index) {
          <li><i [style.background]="color(l.name, i)"></i>{{ l.name }} <strong>{{ fmt(l.percent) }}%</strong></li>
        }
      </ul>
    </section>

    @if (data().offspring.length) {
      <section class="card stack">
        <h3>{{ 'arbore.puii_lui' | t: { nume: rootName(), n: data().offspring.length } }}</h3>
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
  protected readonly fmt = (n: number) => formatNumber(n);
  protected readonly pigeon = computed(() => this.data().pigeons[this.selectedId()] ?? this.data().blood.pigeons[this.selectedId()] ?? null);
  protected readonly value = computed(() => this.data().values[this.selectedId()] ?? null);
  protected readonly rootName = computed(() => {
    const r = this.data().pigeons[this.data().rootId];
    return r?.name || r?.ring?.display || t('arbore.porumbelului');
  });
  protected readonly bloodText = computed(() => this.data().blood.lines.map((l) => `${l.name} ${l.percent}%`).join(glue(', ')));
}
