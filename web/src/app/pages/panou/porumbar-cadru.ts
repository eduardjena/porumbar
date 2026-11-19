import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TPipe, t } from '../../core/i18n';
import { CatalogService } from '../../core/catalog';
import { Icon } from '../../shared/icon';
import { ViewToggle } from '../../shared/view-toggle';
import { PanouBar } from './panou-bar';
import { PorumbarState } from './porumbar-state';

/** Unde e omul în cadru: Grilă, Listă sau pagina „Rezultate concurs” (listarea ori introducerea). */
type Tab = 'grila' | 'lista' | 'rez-lista' | 'rez-nou';
const tabOf = (url: string): Tab => {
  const path = url.split(/[?#]/)[0];
  if (path.startsWith('/porumbar')) return 'lista';
  if (path.startsWith('/concursuri/nou')) return 'rez-nou';
  if (path.startsWith('/concursuri')) return 'rez-lista';
  return 'grila';
};

/*
 * Cadrul comun al Panoului: Grilă, Listă și „Rezultate concurs” (cu submeniurile Listare rezultate / Introdu rezultat
 * nou). Titlul, comutatorul, butoanele și bara de filtre stau pe loc; la schimbare se schimbă doar ce e dedesubt
 * (<router-outlet>). Datele și alegerea din bară: PorumbarState.
 */
@Component({
  selector: 'app-porumbar-cadru',
  imports: [RouterOutlet, RouterLink, Icon, ViewToggle, PanouBar, TPipe],
  template: `
    <div class="head">
      <div>
        <h1>{{ 'panou.titlu' | t }}</h1>
        @if (s.loaded()) { <p class="muted count">{{ subtitle() }}</p> }
      </div>
      <div class="row actions">
        <app-view-toggle [current]="toggle()" />
        <a routerLink="/porumbei/pedigree" class="btn"><app-icon name="fisa" />{{ 'panou.importa_pedigree' | t }}</a>
        <a routerLink="/concursuri" class="btn" [class.on]="results()" [attr.aria-current]="results() ? 'page' : null"><app-icon name="cupa" />{{ 'panou.rezultate_concurs' | t }}</a>
        <a routerLink="/scaneaza" class="btn"><app-icon name="qr" />{{ 'panou.scaneaza_qr' | t }}</a>
        <!-- Doar iconițe: „+” și porumbelul (ca pe fișa cu detalii); textul apare la hover și îl citesc cititoarele de ecran. -->
        <a routerLink="/porumbei/nou" class="btn primary add icon-only" [title]="'panou.adauga_porumbel_nou' | t" [attr.aria-label]="'panou.adauga_porumbel_nou' | t">
          <app-icon name="plus" [size]="18" class="plus" /><app-icon name="porumbel" [size]="26" />
        </a>
      </div>
    </div>

    @if (results()) {
      <nav class="sub" [attr.aria-label]="'panou.rezultate_concurs' | t">
        <a routerLink="/concursuri/lista" class="pill" [class.on]="tab() === 'rez-lista'" [attr.aria-current]="tab() === 'rez-lista' ? 'page' : null">
          <app-icon name="lista" [size]="18" />{{ 'concurs.sub_lista' | t }}
        </a>
        <a routerLink="/concursuri/nou" class="pill" [class.on]="tab() === 'rez-nou'" [attr.aria-current]="tab() === 'rez-nou' ? 'page' : null">
          <app-icon name="plus" [size]="18" />{{ 'concurs.sub_nou' | t }}
        </a>
      </nav>
    }

    @if (s.all().length && tab() !== 'rez-nou') {
      <app-panou-bar [(state)]="s.view" [statuses]="catalog.catalog()?.statuses ?? []" [years]="s.years()" [orderTools]="!results()" />
    }
    @if (s.error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ s.error() }}</div> }

    <router-outlet />
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .head h1 { margin-bottom: 2px; }
    .count { margin: 0; }
    .icon-only { gap: 0; padding: 0 14px 0 10px; min-width: 64px; justify-content: center; }
    .icon-only .plus { margin-right: -1px; }
    .actions .btn.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-strong); }
    /* Submeniurile „Rezultate concurs”: pastile ca în bara de filtre. */
    .sub { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
    .pill {
      display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border-radius: 999px; white-space: nowrap;
      background: var(--surface); border: 1px solid var(--border-strong); color: var(--text); font-weight: 700; font-size: 0.9rem; text-decoration: none;
    }
    .pill:hover { border-color: var(--accent); }
    .pill.on { background: var(--accent); border-color: var(--accent); color: #fff; }
    @media (max-width: 767px) {
      .actions .add { display: none; }
      .sub { flex-wrap: nowrap; }
      .pill { flex: 1 1 0; min-width: 0; justify-content: center; gap: 4px; padding: 0 6px; font-size: 0.82rem; }
    }
  `,
})
export default class PorumbarCadru {
  protected readonly s = inject(PorumbarState);
  protected readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  protected readonly tab = signal<Tab>(tabOf(this.router.url));
  protected readonly results = computed(() => this.tab() === 'rez-lista' || this.tab() === 'rez-nou');
  /** Comutatorul Grilă / Listă: niciunul aprins pe „Rezultate concurs”. */
  protected readonly toggle = computed(() => (this.tab() === 'grila' ? 'grila' : this.tab() === 'lista' ? 'lista' : null));
  protected readonly subtitle = computed(() => {
    switch (this.tab()) {
      case 'rez-lista': return this.s.resultsLine();
      case 'rez-nou': return t('concurs.intro');
      default: return this.s.countLine();
    }
  });

  constructor() {
    this.s.load();
    const sub = this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.tab.set(tabOf(e.urlAfterRedirects));
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }
}
