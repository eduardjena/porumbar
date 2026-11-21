import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CatalogService } from '../../core/catalog';
import { TPipe } from '../../core/i18n';
import { Treatment } from '../../core/models';
import { Icon } from '../../shared/icon';
import { kindIcon, periodText, statusText } from './tratament-text';

/** „Gata” vine câte 50 (cele mai noi întâi); „Mai multe” aduce următoarele. */
const PAGE = 50;

/*
 * Pagina Tratamente: cele în curs, cele care urmează și cele gata (terminate sau oprite). Atingerea unui rând deschide
 * tratamentul, cu porumbeii lui și Modifică / Oprește / Șterge.
 */
@Component({
  selector: 'app-tratamente',
  imports: [RouterLink, Icon, TPipe],
  template: `
    <div class="head">
      <h1>{{ 'tratamente.titlu' | t }}</h1>
      <a routerLink="/tratamente/nou" class="btn primary"><app-icon name="plus" />{{ 'tratamente.nou' | t }}</a>
    </div>
    <p class="muted intro">{{ 'tratamente.intro' | t }}</p>

    @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }

    @if (loaded() && empty()) {
      <div class="empty card">
        <span class="empty-ico"><app-icon name="tratament" [size]="44" /></span>
        <h2>{{ 'tratamente.niciunul' | t }}</h2>
        <p class="muted">{{ 'tratamente.niciunul_text' | t }}</p>
        <a routerLink="/tratamente/nou" class="btn primary"><app-icon name="plus" />{{ 'tratamente.nou' | t }}</a>
      </div>
    }

    @for (s of sections(); track s.key) {
      @if (s.items.length) {
        <section>
          <h2>{{ s.title | t }} <span class="n">{{ s.items.length }}{{ s.key === 'gata' && more() ? '+' : '' }}</span></h2>
          <ul class="list">
            @for (tr of s.items; track tr.id) {
              <li>
                <a class="card item" [class.now]="tr.status === 'in_curs'" [routerLink]="['/tratamente', tr.id]">
                  <span class="ico" [class.vaccin]="tr.kind === 'vaccin'"><app-icon [name]="icon(tr)" [size]="26" /></span>
                  <span class="body">
                    <strong class="name">{{ tr.label }}</strong>
                    <span class="when">{{ status(tr) }}</span>
                    <span class="meta muted">
                      <span>{{ period(tr) }}</span>
                      <span>{{ catalog.label('treatmentTargets', tr.target) }} · {{ 'tratamente.n_porumbei' | t: { count: tr.count } }}</span>
                      <span>{{ catalog.label('treatmentMethods', tr.method) }}</span>
                    </span>
                  </span>
                  <app-icon name="inainte" class="go" />
                </a>
              </li>
            }
          </ul>
          @if (s.key === 'gata' && more()) {
            <button type="button" class="wide" (click)="loadMore()" [disabled]="busy()">{{ 'tratamente.mai_multe' | t }}</button>
          }
        </section>
      }
    }
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .head h1 { margin: 0; }
    .intro { margin: 8px 0 4px; }
    h2 { display: flex; align-items: center; gap: 10px; }
    .n { font-size: 0.85rem; font-weight: 700; color: var(--muted); background: var(--surface-2); border-radius: 999px; padding: 2px 10px; }
    .list { list-style: none; padding: 0; margin: 0 0 12px; display: flex; flex-direction: column; gap: 10px; }
    .item { display: grid; grid-template-columns: auto 1fr auto; gap: 14px; align-items: center; text-decoration: none; color: var(--text); padding: 14px 16px; }
    .item:hover { border-color: var(--border-strong); }
    .item.now { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset, var(--shadow); }
    .ico { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent-strong); }
    .ico.vaccin { background: var(--ok-soft); color: var(--ok); }
    .body { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .name { font-size: 1.1rem; overflow-wrap: anywhere; }
    .when { font-weight: 700; color: var(--accent-strong); }
    .meta { display: flex; flex-wrap: wrap; gap: 2px 14px; font-size: 0.95rem; align-items: center; }
    .go { color: var(--muted); }
    .empty { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; margin-top: 16px; }
    .empty h2 { margin: 8px 0 0; }
    .empty-ico { width: 76px; height: 76px; border-radius: 22px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent-strong); }
    @media (max-width: 767px) {
      .head .btn { width: 100%; }
      .item { gap: 10px; padding: 12px; }
    }
  `,
})
export default class Tratamente {
  private readonly api = inject(Api);
  protected readonly catalog = inject(CatalogService);
  protected readonly running = signal<Treatment[]>([]);
  protected readonly upcoming = signal<Treatment[]>([]);
  protected readonly done = signal<Treatment[]>([]);
  protected readonly more = signal(false);
  protected readonly loaded = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly icon = kindIcon;
  protected readonly period = periodText;
  protected readonly status = statusText;

  protected readonly sections = computed(() => [
    { key: 'in_curs', title: 'tratamente.in_curs', items: this.running() },
    { key: 'urmeaza', title: 'tratamente.urmeaza', items: this.upcoming() },
    { key: 'gata', title: 'tratamente.gata', items: this.done() },
  ]);
  protected readonly empty = computed(() => !this.running().length && !this.upcoming().length && !this.done().length);

  constructor() {
    this.catalog.load();
    this.load();
  }

  private list(stare: string, before?: number) {
    return this.api.get<{ treatments: Treatment[] }>(`/treatments?stare=${stare}${before ? `&before=${before}` : ''}`).then((r) => r.treatments);
  }

  private async load() {
    try {
      const [running, upcoming, done] = await Promise.all([this.list('in_curs'), this.list('urmeaza'), this.list('gata')]);
      this.running.set(running);
      this.upcoming.set(upcoming);
      this.done.set(done);
      this.more.set(done.length === PAGE);
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loaded.set(true);
    }
  }

  protected async loadMore() {
    const last = this.done().at(-1);
    if (!last) return;
    this.busy.set(true);
    try {
      const next = await this.list('gata', last.id);
      this.done.update((l) => [...l, ...next]);
      this.more.set(next.length === PAGE);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
