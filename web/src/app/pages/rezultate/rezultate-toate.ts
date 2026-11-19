import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CatalogService } from '../../core/catalog';
import { TPipe, formatDay, formatNumber } from '../../core/i18n';
import { RaceResult, Ring } from '../../core/models';
import { Icon } from '../../shared/icon';
import { ViewToggle } from '../../shared/view-toggle';

/** Un rezultat din lista tuturor, cu porumbelul lui. */
type Row = RaceResult & { pigeon: { id: number; name: string | null; sex: 'M' | 'F' | null; ring: Ring | null } };
type Sort = 'noi' | 'vechi' | 'bune' | 'viteza';

const SORTS: Sort[] = ['noi', 'vechi', 'bune', 'viteza'];
const SORT_KEY = 'porumbar.rezultate.ordine';
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** „Cel mai bun rezultat” = coeficientul cel mai mic (locul raportat la câți porumbei au zburat); fără angajați, după loc. */
const score = (r: Row) => r.penalty ?? r.place * 1000;
const dec2 = (n: number) => formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/*
 * Fila „Rezultate” de lângă Grilă și Listă: rezultatele tuturor porumbeilor, de ordonat după cele mai noi / mai vechi,
 * cel mai bun rezultat (coeficientul) sau viteză; căutare după porumbel sau concurs și „doar premiate”.
 */
@Component({
  selector: 'app-rezultate-toate',
  imports: [FormsModule, RouterLink, Icon, ViewToggle, TPipe],
  template: `
    <div class="head">
      <div>
        <h1>{{ 'panou.titlu' | t }}</h1>
        @if (loaded()) { <p class="muted count">{{ 'toate.numar' | t: { count: all().length } }}</p> }
      </div>
      <div class="row actions">
        <app-view-toggle current="rezultate" />
        <a routerLink="/concursuri/rezultate" class="btn primary"><app-icon name="plus" />{{ 'toate.adauga' | t }}</a>
      </div>
    </div>

    @if (all().length) {
      <div class="filters">
        <label class="search">
          <app-icon name="cautare" />
          <input type="search" [placeholder]="'toate.cauta' | t" [attr.aria-label]="'toate.cauta' | t" [ngModel]="q()" (ngModelChange)="q.set($event)" />
        </label>
        <label class="sort">{{ 'toate.ordoneaza' | t }}
          <select [ngModel]="sort()" (ngModelChange)="setSort($event)">
            @for (s of sorts; track s) { <option [value]="s">{{ 'toate.ordine_' + s | t }}</option> }
          </select>
        </label>
        <label class="check"><input type="checkbox" [ngModel]="prizedOnly()" (ngModelChange)="prizedOnly.set($event)" />{{ 'toate.doar_premiate' | t }}</label>
      </div>
    }

    @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }

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
        @if (loaded()) {
          <li class="empty">
            <p>{{ (all().length ? 'toate.nimic_gasit' : 'toate.niciunul') | t }}</p>
            @if (!all().length) { <a routerLink="/concursuri/rezultate" class="btn primary"><app-icon name="cupa" />{{ 'toate.adauga' | t }}</a> }
          </li>
        }
      }
    </ul>
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .head h1 { margin-bottom: 2px; }
    .count { margin: 0; }
    .filters { display: grid; grid-template-columns: 1fr auto auto; gap: 10px 16px; align-items: center; margin-bottom: 16px; }
    .search { position: relative; display: block; }
    .search app-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
    .search input { padding-left: 50px; border-radius: 999px; }
    .sort { display: flex; align-items: center; gap: 8px; font-weight: 700; white-space: nowrap; }
    .sort select { width: auto; }
    .check { display: flex; align-items: center; gap: 10px; font-weight: 600; min-height: 48px; white-space: nowrap; }
    .check input { width: 24px; height: 24px; }
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
      .actions .btn { display: none; }
      .filters { grid-template-columns: 1fr; }
      .rows a { grid-template-columns: minmax(0, 1fr) auto; padding: 10px 12px; }
      .race { grid-column: 1 / -1; grid-row: 2; }
      .who { grid-column: 1 / -1; grid-row: 3; }
      .nums { grid-column: 2; grid-row: 1; }
      .who .name { flex-basis: auto; }
    }
  `,
})
export default class RezultateToate {
  private readonly api = inject(Api);
  protected readonly catalog = inject(CatalogService);
  protected readonly sorts = SORTS;
  protected readonly day = formatDay;
  protected readonly dec2 = dec2;
  protected readonly num = (n: number, digits = 2) => formatNumber(n, { maximumFractionDigits: digits });

  readonly all = signal<Row[]>([]);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly q = signal('');
  readonly prizedOnly = signal(false);
  readonly sort = signal<Sort>(this.savedSort());

  /** Lista după căutare, „doar premiate” și ordinea aleasă. */
  protected readonly shown = computed(() => {
    const q = fold(this.q().trim());
    let list = this.all();
    if (this.prizedOnly()) list = list.filter((r) => r.prized);
    if (q) {
      list = list.filter((r) =>
        fold(`${r.pigeon.ring?.display ?? ''} ${r.pigeon.ring?.number ?? ''} ${r.pigeon.name ?? ''} ${r.race.releasePlace} ${r.race.organizer}`).includes(q),
      );
    }
    const byDate = (a: Row, b: Row) => a.race.date.localeCompare(b.race.date) || b.place - a.place;
    const sorted = [...list];
    switch (this.sort()) {
      case 'noi': return sorted.sort((a, b) => byDate(b, a));
      case 'vechi': return sorted.sort(byDate);
      case 'bune': return sorted.sort((a, b) => score(a) - score(b) || byDate(b, a));
      case 'viteza': return sorted.sort((a, b) => (b.speed ?? -1) - (a.speed ?? -1) || byDate(b, a));
    }
  });

  constructor() {
    this.catalog.load();
    this.load();
  }

  private async load() {
    try {
      this.all.set((await this.api.get<{ results: Row[] }>('/results')).results);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loaded.set(true);
    }
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
