import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CatalogService, ringText, sexShort } from '../../core/catalog';
import { TPipe } from '../../core/i18n';
import { PigeonSummary } from '../../core/models';
import { Icon } from '../../shared/icon';
import { ViewToggle } from '../../shared/view-toggle';

/** Lista porumbeilor: toți odată, pe rânduri compacte, cu căutare și filtre (și pe cei din alte porumbare, dacă îi alegi). */
@Component({
  selector: 'app-porumbar',
  imports: [FormsModule, RouterLink, Icon, ViewToggle, TPipe],
  template: `
    <div class="head">
      <div>
        <h1>{{ 'panou.titlu' | t }}</h1>
        @if (loaded()) { <p class="muted count">{{ 'panou.numar_porumbei' | t: { count: pigeons().length } }}</p> }
      </div>
      <div class="row actions">
        <app-view-toggle current="lista" />
        <a routerLink="/porumbei/nou" class="btn primary add"><app-icon name="plus" />{{ 'porumbel.nou' | t }}</a>
      </div>
    </div>

    <div class="filters">
      <label class="search">
        <app-icon name="cautare" />
        <input type="search" [placeholder]="'porumbar.cauta' | t" [attr.aria-label]="'porumbar.cauta' | t" [(ngModel)]="q" (ngModelChange)="search()" />
      </label>
      <select [(ngModel)]="kind" (ngModelChange)="load()" [attr.aria-label]="'porumbar.ce_porumbei' | t">
        <option value="own">{{ 'porumbel.din_porumbarul_meu' | t }}</option>
        <option value="external">{{ 'porumbar.nu_sunt_ai_mei' | t }}</option>
        <option value="">{{ 'porumbar.toti' | t }}</option>
      </select>
      <select [(ngModel)]="status" (ngModelChange)="load()" [attr.aria-label]="'porumbel.starea' | t">
        <option value="">{{ 'porumbar.orice_stare' | t }}</option>
        @for (s of catalog.catalog()?.statuses ?? []; track s.code) { <option [value]="s.code">{{ s.label }}</option> }
      </select>
      <select [(ngModel)]="sex" (ngModelChange)="load()" [attr.aria-label]="'porumbel.sexul' | t">
        <option value="">{{ 'porumbar.masculi_si_femele' | t }}</option>
        <option value="M">{{ 'porumbel.masculi' | t }}</option>
        <option value="F">{{ 'porumbel.femele' | t }}</option>
      </select>
    </div>

    @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
    @if (loaded() && !pigeons().length) {
      <p class="muted">{{ (q || status || sex || kind !== 'own' ? 'porumbar.nimic_gasit' : 'porumbar.gol') | t }}</p>
    }

    @if (pigeons().length) {
      <ul class="rows card">
        @for (p of pigeons(); track p.id) {
          <li>
            <a [routerLink]="['/porumbei', p.id]" [queryParams]="{ din: 'lista' }">
              <span class="mono ring">{{ ring(p) }}</span>
              <span [class]="'sex sex-' + (p.sex ?? '')">{{ sexS(p.sex) }}</span>
              <span class="name">{{ p.name ?? '' }}</span>
              <span class="muted year">{{ p.year ?? '' }}</span>
              <span class="muted status">{{ p.kind === 'external' ? ('porumbel.nu_e_al_meu_mic' | t) : catalog.label('statuses', p.status) }}</span>
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
  protected readonly ring = ringText;
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
