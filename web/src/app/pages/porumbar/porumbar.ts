import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CatalogService } from '../../core/catalog';
import { PigeonSummary } from '../../core/models';
import { PigeonChip } from '../../shared/pigeon-chip';
import { Icon } from '../../shared/icon';

const PAGE = 50;

@Component({
  selector: 'app-porumbar',
  imports: [FormsModule, RouterLink, PigeonChip, Icon],
  template: `
    <div class="head">
      <h1>Lista porumbeilor</h1>
      <a routerLink="/porumbei/nou" class="btn primary"><app-icon name="plus" />Porumbel nou</a>
    </div>

    <div class="card stack filters">
      <label class="field">Caută după inel sau nume
        <input type="search" name="q" placeholder="de ex. RO-25-276971 sau 276971" [(ngModel)]="q" (ngModelChange)="search()" />
      </label>
      <div class="row">
        <select [(ngModel)]="kind" (ngModelChange)="load()" aria-label="Ce porumbei">
          <option value="own">Porumbeii mei</option>
          <option value="external">Strămoși (ai altora)</option>
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
        <input type="number" inputmode="numeric" placeholder="Anul" aria-label="Anul inelului" [(ngModel)]="year" (ngModelChange)="search()" class="year" />
      </div>
    </div>

    @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
    @if (loaded() && !pigeons().length) {
      <div class="card empty stack">
        @if (q || status || sex || year || kind !== 'own') {
          <p>Niciun porumbel nu se potrivește căutării.</p>
        } @else {
          <p>Porumbarul e gol deocamdată.</p>
          <a routerLink="/porumbei/nou" class="btn primary"><app-icon name="plus" />Adaugă primul porumbel</a>
        }
      </div>
    }
    <ul class="list">
      @for (p of visible(); track p.id) {
        <li class="card item">
          <app-pigeon-chip [pigeon]="p" />
          @if (p.status) { <span class="badge">{{ catalog.label('statuses', p.status) }}</span> }
        </li>
      }
    </ul>
    @if (pigeons().length > shown()) {
      <button type="button" class="wide" (click)="shown.set(shown() + PAGE)">Arată mai mulți ({{ pigeons().length - shown() }} rămași)</button>
    }
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .filters { margin-bottom: 16px; }
    .filters select { width: auto; flex: 1 1 160px; }
    .year { width: 120px; flex: 0 0 120px; }
    .list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .item { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; padding: 8px 16px; }
    .empty { text-align: center; align-items: center; }
  `,
})
export default class Porumbar {
  private readonly api = inject(Api);
  protected readonly catalog = inject(CatalogService);
  protected readonly PAGE = PAGE;
  q = '';
  kind = 'own';
  status = '';
  sex = '';
  year: number | null = null;
  readonly pigeons = signal<PigeonSummary[]>([]);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly shown = signal(PAGE);
  readonly visible = computed(() => this.pigeons().slice(0, this.shown()));
  private timer: ReturnType<typeof setTimeout> | undefined;

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
    if (this.year) params.set('year', String(this.year));
    try {
      const r = await this.api.get<{ pigeons: PigeonSummary[] }>(`/pigeons?${params}`);
      this.pigeons.set(r.pigeons);
      this.shown.set(PAGE);
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loaded.set(true);
    }
  }
}
