import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CatalogService, sexShort } from '../../core/catalog';
import { PigeonSummary } from '../../core/models';
import { Icon } from '../../shared/icon';
import { ViewToggle } from '../../shared/view-toggle';

/** Lista porumbeilor: toți odată, pe rânduri compacte, cu căutare și filtre (și pe cei din alte porumbare, dacă îi alegi). */
@Component({
  selector: 'app-porumbar',
  imports: [FormsModule, RouterLink, Icon, ViewToggle],
  template: `
    <div class="head">
      <div>
        <h1>Porumbarul meu</h1>
        @if (loaded()) { <p class="muted count">{{ pigeons().length }} {{ pigeons().length === 1 ? 'porumbel' : 'porumbei' }}</p> }
      </div>
      <div class="row actions">
        <app-view-toggle current="lista" />
        <a routerLink="/porumbei/nou" class="btn primary add"><app-icon name="plus" />Porumbel nou</a>
      </div>
    </div>

    <div class="filters">
      <label class="search">
        <app-icon name="cautare" />
        <input type="search" placeholder="Caută după inel sau nume" aria-label="Caută după inel sau nume" [(ngModel)]="q" (ngModelChange)="search()" />
      </label>
      <select [(ngModel)]="kind" (ngModelChange)="load()" aria-label="Ce porumbei">
        <option value="own">Din porumbarul meu</option>
        <option value="external">Nu sunt în porumbarul meu</option>
        <option value="">Toți</option>
      </select>
      <select [(ngModel)]="status" (ngModelChange)="load()" aria-label="Starea">
        <option value="">Orice stare</option>
        @for (s of catalog.catalog()?.statuses ?? []; track s.code) { <option [value]="s.code">{{ s.label }}</option> }
      </select>
      <select [(ngModel)]="sex" (ngModelChange)="load()" aria-label="Sexul">
        <option value="">Masculi și femele</option>
        <option value="M">Masculi</option>
        <option value="F">Femele</option>
      </select>
    </div>

    @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
    @if (loaded() && !pigeons().length) {
      <p class="muted">{{ q || status || sex || kind !== 'own' ? 'Niciun porumbel nu se potrivește căutării.' : 'Porumbarul e gol deocamdată.' }}</p>
    }

    @if (pigeons().length) {
      <ul class="rows card">
        @for (p of pigeons(); track p.id) {
          <li>
            <a [routerLink]="['/porumbei', p.id]" [queryParams]="{ din: 'lista' }">
              <span class="mono ring">{{ p.ring?.display ?? 'Fără inel' }}</span>
              <span [class]="'sex sex-' + (p.sex ?? '')">{{ sexS(p.sex) }}</span>
              <span class="name">{{ p.name ?? '' }}</span>
              <span class="muted year">{{ p.year ?? '' }}</span>
              <span class="muted status">{{ p.kind === 'external' ? 'nu e în porumbarul meu' : catalog.label('statuses', p.status) }}</span>
              <app-icon name="inainte" [size]="20" class="go" />
            </a>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .head h1 { margin-bottom: 2px; }
    .count { margin: 0; }
    .filters { display: grid; grid-template-columns: 1fr auto auto auto; gap: 10px; margin-bottom: 16px; }
    .filters select { width: auto; }
    .search { position: relative; display: block; }
    .search app-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
    .search input { padding-left: 50px; border-radius: 999px; }
    .rows { list-style: none; margin: 0; padding: 4px 0; }
    .rows li + li { border-top: 1px solid var(--border); }
    .rows a {
      display: grid; grid-template-columns: minmax(150px, 1.2fr) 28px minmax(0, 1.4fr) 56px minmax(0, 1fr) 20px; gap: 10px;
      align-items: center; min-height: 52px; padding: 4px 16px; color: var(--text); text-decoration: none;
    }
    .rows a:hover { background: var(--accent-soft); }
    .ring { white-space: nowrap; }
    .name { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .status { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem; }
    .go { color: var(--border-strong); }
    @media (max-width: 767px) {
      .actions .add { display: none; }
      .filters { grid-template-columns: 1fr 1fr; }
      .search { grid-column: 1 / -1; }
      .filters select:first-of-type { grid-column: 1 / -1; }
      .rows a { grid-template-columns: minmax(0, 1fr) 24px 52px 20px; padding: 6px 12px; row-gap: 0; }
      .rows .name { grid-column: 1; grid-row: 2; font-size: 0.95rem; }
      .rows .status { display: none; }
    }
  `,
})
export default class Porumbar {
  private readonly api = inject(Api);
  protected readonly catalog = inject(CatalogService);
  protected readonly sexS = sexShort;
  q = '';
  kind = 'own';
  status = '';
  sex = '';
  readonly pigeons = signal<PigeonSummary[]>([]);
  readonly loaded = signal(false);
  readonly error = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;
  private request = 0;

  constructor() {
    this.load();
  }

  search() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.load(), 300);
  }

  async load() {
    const params = new URLSearchParams();
    if (this.q.trim()) params.set('q', this.q.trim());
    if (this.kind) params.set('kind', this.kind);
    if (this.status) params.set('status', this.status);
    if (this.sex) params.set('sex', this.sex);
    const req = ++this.request;
    try {
      const r = await this.api.get<{ pigeons: PigeonSummary[] }>(`/pigeons?${params}`);
      if (req !== this.request) return; // între timp s-a cerut altă căutare
      this.pigeons.set(r.pigeons);
      this.error.set('');
    } catch (e) {
      if (req === this.request) this.error.set(errorMessage(e));
    } finally {
      this.loaded.set(true);
    }
  }
}
