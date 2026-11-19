import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CatalogService } from '../../core/catalog';
import { TPipe, formatDay, formatNumber, localeOf } from '../../core/i18n';
import { Icon } from '../../shared/icon';
import { fold, matches } from '../panou/panou-view';
import { PorumbarState, ResultRow } from '../panou/porumbar-state';

type Col = 'data' | 'concurs' | 'porumbel' | 'loc' | 'coef' | 'viteza' | 'km';
type Dir = 'asc' | 'desc';
interface Sort {
  col: Col;
  dir: Dir;
}

// Locul imediat după dată: pe telefon se vede fără să derulezi tabelul în lateral.
const COLS: Col[] = ['data', 'loc', 'porumbel', 'concurs', 'coef', 'viteza', 'km'];
/** La prima apăsare: cele mai noi, cel mai bun loc / coeficient, cea mai mare viteză / distanță, textele A–Z. */
const FIRST_DIR: Record<Col, Dir> = { data: 'desc', concurs: 'asc', porumbel: 'asc', loc: 'asc', coef: 'asc', viteza: 'desc', km: 'desc' };
const SORT_KEY = 'porumbar.rezultate.tabel';
const DEFAULT_SORT: Sort = { col: 'data', dir: 'desc' };
/** Coeficientul (locul raportat la câți porumbei au zburat); fără angajați, după loc. */
const coef = (r: ResultRow) => r.penalty ?? r.place * 1000;
const dec2 = (n: number) => formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Valoarea după care se ordonează coloana (golurile la sfârșit, oricare ar fi sensul). */
function valueOf(r: ResultRow, col: Col): number | string | null {
  switch (col) {
    case 'data': return r.race.date;
    case 'concurs': return fold(r.race.releasePlace);
    case 'porumbel': return r.pigeon.ring?.display ?? r.pigeon.name ?? null;
    case 'loc': return r.place;
    case 'coef': return coef(r);
    case 'viteza': return r.speed;
    case 'km': return r.distanceM;
  }
}

/*
 * Fila „Rezultate” din cadrul comun (lângă Grilă și Listă): rezultatele tuturor porumbeilor, într-un tabel. Apeși pe
 * capul unei coloane: se ordonează după ea; încă o dată: invers (ordinea se ține minte pe telefon). Bara de sus e
 * aceeași ca la Grilă / Listă: căutarea și filtrele aleg porumbeii (căutarea găsește și locul lansării), iar
 * „Premiați” arată doar rezultatele premiate.
 */
@Component({
  selector: 'app-rezultate-toate',
  imports: [RouterLink, Icon, TPipe],
  template: `
    @if (s.resultsLoaded() && !shown().length) {
      <div class="card empty">
        <p>{{ (s.results().length ? 'toate.nimic_gasit' : 'toate.niciunul') | t }}</p>
        @if (!s.results().length) { <a routerLink="/concursuri/rezultate" class="btn primary"><app-icon name="cupa" />{{ 'toate.adauga' | t }}</a> }
      </div>
    } @else if (shown().length) {
      <div class="card wrap">
        <table>
          <thead>
            <tr>
              @for (c of cols; track c) {
                <th scope="col" [class]="'c-' + c" [attr.aria-sort]="sort().col === c ? (sort().dir === 'asc' ? 'ascending' : 'descending') : 'none'">
                  <button type="button" (click)="sortBy(c)" [class.on]="sort().col === c" [title]="'toate.ordoneaza_dupa' | t: { coloana: ('toate.col_' + c | t) }">
                    {{ 'toate.col_' + c | t }}<span class="arrow" aria-hidden="true">{{ sort().col === c ? (sort().dir === 'asc' ? '↑' : '↓') : '↕' }}</span>
                  </button>
                </th>
              }
            </tr>
          </thead>
          <tbody>
            @for (r of shown(); track r.id) {
              <tr (click)="open(r)">
                <td class="c-data">{{ day(r.race.date) }}</td>
                <td class="c-loc">
                  <strong>{{ r.place }}</strong>@if (r.race.entered) { <span class="muted small"> / {{ num(r.race.entered) }}</span> }
                  @if (r.prized) { <span class="prized">{{ 'rezultate.premiat' | t }}</span> }
                </td>
                <td class="c-porumbel">
                  <a [routerLink]="['/porumbei', r.pigeon.id]" [queryParams]="{ fila: 'rezultate' }" (click)="$event.stopPropagation()" class="mono">{{ r.pigeon.ring?.display ?? '—' }}</a>
                  @if (r.pigeon.name) { <span class="small name">{{ r.pigeon.name }}</span> }
                </td>
                <td class="c-concurs">
                  <strong>{{ r.race.releasePlace }}</strong>
                  <span class="muted small">{{ catalog.label('raceCategories', r.race.category) }}@if (r.race.level) { · {{ catalog.label('raceLevels', r.race.level) }} }</span>
                </td>
                <td class="c-coef num">{{ r.penalty != null ? dec2(r.penalty) : '—' }}</td>
                <td class="c-viteza num">{{ r.speed ? dec2(r.speed) : '—' }}</td>
                <td class="c-km num">{{ num(r.distanceM / 1000, 1) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: `
    .empty { padding: 20px 16px; }
    .empty p { margin: 0 0 12px; }
    /* Pe telefon tabelul se derulează în lateral, în cartonașul lui (pagina nu); data rămâne lipită în stânga. */
    .wrap { padding: 0; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 0.95rem; }
    th { position: sticky; top: 0; background: var(--surface-2); text-align: left; padding: 0; white-space: nowrap; }
    th button {
      display: inline-flex; align-items: center; gap: 6px; width: 100%; min-height: 48px; padding: 0 12px; border: 0; border-radius: 0;
      background: none; box-shadow: none; color: var(--text); font-weight: 800; font-size: 0.9rem; text-align: left; cursor: pointer;
    }
    th button.on { color: var(--accent-strong); }
    th button:hover { background: var(--accent-soft); }
    .arrow { color: var(--muted); font-weight: 700; }
    th button.on .arrow { color: var(--accent-strong); }
    td { padding: 10px 12px; border-top: 1px solid var(--border); vertical-align: top; }
    tbody tr { cursor: pointer; }
    tbody tr:hover td { background: var(--accent-soft); }
    .num, th.c-coef button, th.c-viteza button, th.c-km button { text-align: right; justify-content: flex-end; }
    .num { white-space: nowrap; font-variant-numeric: tabular-nums; }
    .c-data { white-space: nowrap; }
    .c-concurs, .c-porumbel { min-width: 140px; }
    .c-concurs strong, .c-porumbel a { display: block; }
    .c-porumbel a { font-weight: 700; color: var(--text); text-decoration: none; white-space: nowrap; }
    .c-loc { white-space: nowrap; }
    .small { font-size: 0.85rem; display: block; }
    .c-loc .small { display: inline; }
    .name { font-weight: 600; }
    .prized { display: block; width: fit-content; margin-top: 4px; padding: 1px 8px; border-radius: 999px; font-size: 0.8rem; font-weight: 800; background: var(--ok-soft); color: var(--ok); }
    @media (max-width: 767px) {
      table { font-size: 0.9rem; }
      th.c-data, td.c-data { position: sticky; left: 0; z-index: 1; }
      td.c-data { background: var(--surface); }
      th.c-data { z-index: 2; }
      td { padding: 8px 10px; }
      .c-concurs, .c-porumbel { min-width: 110px; }
    }
  `,
})
export default class RezultateToate {
  protected readonly s = inject(PorumbarState);
  protected readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  protected readonly cols = COLS;
  protected readonly day = formatDay;
  protected readonly dec2 = dec2;
  protected readonly num = (n: number, digits = 2) => formatNumber(n, { maximumFractionDigits: digits });
  readonly sort = signal<Sort>(this.savedSort());

  /** Rezultatele după bara comună (porumbeii aleși, căutarea, „Premiați”) și coloana aleasă. */
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
    const { col, dir } = this.sort();
    const sign = dir === 'asc' ? 1 : -1;
    const locale = localeOf();
    return list.sort((a, b) => {
      const x = valueOf(a, col);
      const y = valueOf(b, col);
      if (x == null || y == null) return x == null && y == null ? 0 : x == null ? 1 : -1;
      const d = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), locale, { numeric: true });
      // La egalitate: cele mai noi întâi, apoi locul.
      return d * sign || b.race.date.localeCompare(a.race.date) || a.place - b.place;
    });
  });

  constructor() {
    this.s.loadResults();
    effect(() => {
      const n = this.shown().length;
      untracked(() => this.s.resultsShown.set(n));
    });
  }

  /** Capul coloanei: prima apăsare o alege, a doua întoarce ordinea. */
  sortBy(col: Col) {
    const cur = this.sort();
    const next: Sort = cur.col === col ? { col, dir: cur.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: FIRST_DIR[col] };
    this.sort.set(next);
    try {
      localStorage.setItem(SORT_KEY, JSON.stringify(next));
    } catch {
      /* fără memorie locală: ordinea nu se ține minte */
    }
  }

  open(r: ResultRow) {
    this.router.navigate(['/porumbei', r.pigeon.id], { queryParams: { fila: 'rezultate' } });
  }

  private savedSort(): Sort {
    try {
      const s = JSON.parse(localStorage.getItem(SORT_KEY) ?? 'null') as Sort | null;
      return s && COLS.includes(s.col) && (s.dir === 'asc' || s.dir === 'desc') ? s : DEFAULT_SORT;
    } catch {
      return DEFAULT_SORT;
    }
  }
}
