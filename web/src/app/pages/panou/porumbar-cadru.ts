import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TPipe } from '../../core/i18n';
import { CatalogService } from '../../core/catalog';
import { Icon } from '../../shared/icon';
import { ViewToggle } from '../../shared/view-toggle';
import { PanouBar } from './panou-bar';
import { PorumbarState } from './porumbar-state';

type Tab = 'grila' | 'lista' | 'rezultate';
const tabOf = (url: string): Tab => (url.startsWith('/porumbar') ? 'lista' : url.startsWith('/rezultate') ? 'rezultate' : 'grila');

/*
 * Cadrul comun al filelor Grilă / Listă / Rezultate: titlul, comutatorul, butoanele și bara de filtre stau pe loc;
 * la schimbarea filei se schimbă doar ce e sub bară (<router-outlet>). Datele și alegerea din bară: PorumbarState.
 */
@Component({
  selector: 'app-porumbar-cadru',
  imports: [RouterOutlet, RouterLink, Icon, ViewToggle, PanouBar, TPipe],
  template: `
    <div class="head">
      <div>
        <h1>{{ 'panou.titlu' | t }}</h1>
        @if (s.loaded()) { <p class="muted count">{{ tab() === 'rezultate' ? s.resultsLine() : s.countLine() }}</p> }
      </div>
      <div class="row actions">
        <app-view-toggle [current]="tab()" />
        <a routerLink="/porumbei/pedigree" class="btn"><app-icon name="fisa" />{{ 'panou.importa_pedigree' | t }}</a>
        <a routerLink="/concursuri/rezultate" class="btn"><app-icon name="cupa" />{{ 'panou.rezultate_concurs' | t }}</a>
        <a routerLink="/scaneaza" class="btn"><app-icon name="qr" />{{ 'panou.scaneaza_qr' | t }}</a>
        <a routerLink="/porumbei/nou" class="btn primary add"><app-icon name="plus" />{{ 'porumbel.nou' | t }}</a>
      </div>
    </div>

    @if (s.all().length) {
      <app-panou-bar [(state)]="s.view" [statuses]="catalog.catalog()?.statuses ?? []" [years]="s.years()" [orderTools]="tab() !== 'rezultate'" />
    }
    @if (s.error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ s.error() }}</div> }

    <router-outlet />
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .head h1 { margin-bottom: 2px; }
    .count { margin: 0; }
    @media (max-width: 767px) {
      .actions .add { display: none; }
    }
  `,
})
export default class PorumbarCadru {
  protected readonly s = inject(PorumbarState);
  protected readonly catalog = inject(CatalogService);
  private readonly router = inject(Router);
  protected readonly tab = signal<Tab>(tabOf(this.router.url));

  constructor() {
    this.s.load();
    const sub = this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.tab.set(tabOf(e.urlAfterRedirects));
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }
}
