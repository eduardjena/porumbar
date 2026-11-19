import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/catalog';
import { TPipe, formatDay, formatNumber } from '../../core/i18n';
import { Icon } from '../../shared/icon';
import { fold, matches } from '../panou/panou-view';
import { PorumbarState, ResultRow } from '../panou/porumbar-state';

type Sort = 'noi' | 'vechi' | 'bune' | 'viteza';
const SORTS: Sort[] = ['noi', 'vechi', 'bune', 'viteza'];
const SORT_KEY = 'porumbar.rezultate.ordine';
/** „Cel mai bun rezultat” = coeficientul cel mai mic (locul raportat la câți porumbei au zburat); fără angajați, după loc. */
const score = (r: ResultRow) => r.penalty ?? r.place * 1000;
const dec2 = (n: number) => formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/*
 * Fila „Rezultate” din cadrul comun (lângă Grilă și Listă): rezultatele tuturor porumbeilor. Bara de sus e aceeași:
 * căutarea și filtrele aleg porumbeii (căutarea găsește și locul lansării), iar „Premiați” arată doar rezultatele
 * premiate. Ordonarea e a rezultatelor: cele mai noi / vechi, cel mai bun rezultat (coeficientul), viteză.
 */
@Component({
  selector: 'app-rezultate-toate',
  imports: [FormsModule, RouterLink, Icon, TPipe],
  template: `
    @if (s.results().length) {
      <label class="sort">{{ 'toate.ordoneaza' | t }}
        <select [ngModel]="sort()" (ngModelChange)="setSort($event)">
          @for (o of sorts; track o) { <option [value]="o">{{ 'toate.ordine_' + o | t }}</option> }
        </select>
      </label>
    }

    <ul class="rows card">
      @for (r of shown(); track r.id) {
        <li>
          <a [routerLink]="['/porumbei', r.pigeon.id]" [queryParams]="{ fila: 'rezultate' }">
            <span class="place">
              <strong>{{ 'rezultate.locul' | t: { loc: r.place } }}</strong>
              @if (r.race.entered) { <span class="muted">{{ 'rezultate.din' | t: { numar: num(r.race.entered) } }}</span> }
              @if (r.prized) { <span class="prized">{{ 'rezultate.premiat' | t }}</span> }
            </span>
            <span class="race">
              <strong>{{ r.race.releasePlace }}</strong> · {{ num(r.distanceM / 1000, 1) }} km
              <span class="muted small">{{ day(r.race.date) }} · {{ catalog.label('raceCategories', r.race.category) }}@if (r.race.level) { · {{ catalog.label('raceLevels', r.race.level) }} }</span>
            </span>
            <span class="who">
              <span class="mono">{{ r.pigeon.ring?.display ?? '—' }}</span>
              @if (r.pigeon.name) { <span class="name">{{ r.pigeon.name }}</span> }
            </span>
            <span class="nums">
              @if (r.speed) { <span>{{ num(r.speed) }} m/min</span> }
              @if (r.fci != null) { <span class="muted small">FCI {{ dec2(r.fci) }}</span> }
            </span>
          </a>
        </li>
      } @empty {
        @if (s.resultsLoaded()) {
          <li class="empty">
            <p>{{ (s.results().length ? 'toate.nimic_gasit' : 'toate.niciunul') | t }}</p>
            @if (!s.results().length) { <a routerLink="/concursuri/rezultate" class="btn primary"><app-icon name="cupa" />{{ 'toate.adauga' | t }}</a> }
          </li>
        }
      }
    </ul>
  `,
  styles: `
    .sort { display: flex; align-items: center; gap: 8px; font-weight: 700; margin: 0 0 12px; }
    .sort select { width: auto; }
    .rows { list-style: none; margin: 0; padding: 4px 0; }
    .rows li + li { border-top: 1px solid var(--border); }
    .rows a {
      display: grid; grid-template-columns: minmax(150px, 1fr) minmax(0, 1.4fr) minmax(0, 1fr) auto; gap: 6px 14px;
      align-items: center; min-height: 60px; padding: 8px 16px; color: var(--text); text-decoration: none;
    }
    .rows a:hover { background: var(--accent-soft); }
    .place, .race, .who, .nums { display: flex; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; min-width: 0; }
    .race .small, .who .name { flex-basis: 100%; }
    .nums { flex-direction: column; align-items: flex-end; gap: 0; white-space: nowrap; }
    .name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .small { font-size: 0.9rem; }
    .prized { padding: 1px 10px; border-radius: 999px; font-size: 0.85rem; font-weight: 800; background: var(--ok-soft); color: var(--ok); }
    .empty { padding: 20px 16px; }
    .empty p { margin: 0 0 12px; }
    @media (max-width: 767px) {
      .rows a { grid-template-columns: minmax(0, 1fr) auto; padding: 10px 12px; }
      .race { grid-column: 1 / -1; grid-row: 2; }
      .who { grid-column: 1 / -1; grid-row: 3; }
      .nums { grid-column: 2; grid-row: 1; }
      .who .name { flex-basis: auto; }
    }
  `,
})
export default class RezultateToate {
  protected readonly s = inject(PorumbarState);
  protected readonly catalog = inject(CatalogService);
  protected readonly sorts = SORTS;
  protected readonly day = formatDay;
  protected readonly dec2 = dec2;
  protected readonly num = (n: number, digits = 2) => formatNumber(n, { maximumFractionDigits: digits });
  readonly sort = signal<Sort>(this.savedSort());

  /** Rezultatele după bara comună (porumbeii aleși, căutarea, „Premiați”) și ordinea aleasă. */
  protected readonly shown = computed(() => {
    const v = this.s.view();
    const byId = this.s.byId();
    const q = fold(v.q.trim());
    // Filtrele pe porumbel, fără căutare și fără „Premiați” (acela alege rezultatele premiate, mai jos).
    const pigeonOnly = { ...v, q: '', prizes: false };
    const withQ = { ...v, prizes: false };
    const list = this.s.results().filter((r) => {
      const p = byId.get(r.pigeon.id);
      if (p && !matches(p, pigeonOnly)) return false;
      if (v.prizes && !r.prized) return false;
      if (!q) return true;
      return (p && matches(p, withQ)) || fold(`${r.race.releasePlace} ${r.race.organizer}`).includes(q);
    });
    const byDate = (a: ResultRow, b: ResultRow) => a.race.date.localeCompare(b.race.date) || b.place - a.place;
    switch (this.sort()) {
      case 'noi': return list.sort((a, b) => byDate(b, a));
      case 'vechi': return list.sort(byDate);
      case 'bune': return list.sort((a, b) => score(a) - score(b) || byDate(b, a));
      case 'viteza': return list.sort((a, b) => (b.speed ?? -1) - (a.speed ?? -1) || byDate(b, a));
    }
  });

  constructor() {
    this.s.loadResults();
    effect(() => {
      const n = this.shown().length;
      untracked(() => this.s.resultsShown.set(n));
    });
  }

  /** Ordinea aleasă se ține minte pe telefon. */
  setSort(s: Sort) {
    this.sort.set(s);
    try {
      localStorage.setItem(SORT_KEY, s);
    } catch {
      /* fără memorie locală: ordinea nu se ține minte */
    }
  }

  private savedSort(): Sort {
    try {
      const s = localStorage.getItem(SORT_KEY) as Sort | null;
      return s && SORTS.includes(s) ? s : 'noi';
    } catch {
      return 'noi';
    }
  }
}
