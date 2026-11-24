import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TPipe, t } from '../../core/i18n';
import { CatalogService } from '../../core/catalog';
import { Icon } from '../../shared/icon';
import { PanouBar } from './panou-bar';
import { TratamenteBanda } from './tratamente-banda';
import { CuiburiBanda } from './cuiburi-banda';
import { PorumbarState } from './porumbar-state';
import { MAX_SHEETS, idsOfGroups } from '../../shared/fise-toate';

/** Unde e omul în cadru: Grilă, Listă sau pagina „Rezultate concurs” (listarea ori introducerea). */
type Tab = 'grila' | 'lista' | 'rez-lista' | 'rez-nou' | 'import' | 'excel' | 'scan';
const tabOf = (url: string): Tab => {
  const path = url.split(/[?#]/)[0];
  if (path.startsWith('/porumbar')) return 'lista';
  if (path.startsWith('/porumbei/pedigree')) return 'import';
  if (path.startsWith('/porumbei/excel')) return 'excel';
  if (path.startsWith('/scaneaza')) return 'scan';
  if (path.startsWith('/concursuri/nou')) return 'rez-nou';
  if (path.startsWith('/concursuri')) return 'rez-lista';
  return 'grila';
};

/*
 * Cadrul comun al Panoului: Grilă, Listă, Importă pedigree, Adu porumbeii din Excel, Rezultate concurs (cu submeniurile Listare rezultate /
 * Rezultat nou) și Scanează cod QR. Submeniurile lor stau în banda de sub meniul mare (app.ts); aici stau titlul,
 * pastilele Rezultate concurs și bara de filtre, pe loc; la schimbare se schimbă doar ce e dedesubt (<router-outlet>). Datele și alegerea din bară: PorumbarState.
 */
@Component({
  selector: 'app-porumbar-cadru',
  imports: [RouterOutlet, RouterLink, Icon, PanouBar, TratamenteBanda, CuiburiBanda, TPipe],
  template: `
    <div class="head">
      <div>
        <h1>{{ 'panou.titlu' | t }}</h1>
        @if (s.loaded()) { <p class="muted count">{{ subtitle() }}</p> }
      </div>
      @if ((tab() === 'grila' || tab() === 'lista') && s.loaded() && s.all().length) {
        <button type="button" class="tipar-toate" [disabled]="!s.shownCount()" [attr.title]="'panou.tipareste_fisele_aria' | t" [attr.aria-label]="'panou.tipareste_fisele_aria' | t" (click)="printAll()">
          <app-icon name="tipar" [size]="20" />{{ 'panou.tipareste_fisele' | t: { count: s.shownCount() } }}
        </button>
      }
    </div>
    @if (tooMany() && s.shownCount() > MAX) { <div class="muted" role="status">{{ 'panou.prea_multe_fise' | t: { count: s.shownCount(), max: MAX } }}</div> }

    <!-- Pe Panou (Grilă), sus: tratamentele în curs și cele care urmează în 30 de zile, apoi cuiburile (ce e de făcut
         azi și în următoarele zile); fără nimic de arătat, nicio bandă. -->
    @if (tab() === 'grila') {
      <app-tratamente-banda />
      <app-cuiburi-banda />
    }

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

    @if (s.all().length && (tab() === 'grila' || tab() === 'lista' || tab() === 'rez-lista')) {
      <app-panou-bar [(state)]="s.view" [statuses]="catalog.catalog()?.statuses ?? []" [years]="s.years()" [orderTools]="!results()" />
    }
    @if (s.error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ s.error() }}</div> }

    <router-outlet />
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .head h1 { margin-bottom: 2px; }
    .count { margin: 0; }
    .tipar-toate { min-height: 48px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; white-space: normal; }
    @media (max-width: 767px) { .tipar-toate { width: 100%; } }
    .icon-only { gap: 0; padding: 0 14px 0 10px; min-width: 64px; justify-content: center; }
    .icon-only .plus { margin-right: -1px; }
    /* Submeniurile „Rezultate concurs”: pastile ca în bara de filtre. */
    .sub { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 12px; }
    .pill {
      display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border-radius: 999px; white-space: nowrap;
      background: var(--surface); border: 1px solid var(--border-strong); color: var(--text); font-weight: 700; font-size: 0.9rem; text-decoration: none;
    }
    .pill:hover { border-color: var(--accent); }
    .pill.on { background: var(--accent); border-color: var(--accent); color: #fff; }
    @media (max-width: 767px) {
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
  protected readonly MAX = MAX_SHEETS;
  protected readonly tooMany = signal(false);
  protected readonly results = computed(() => this.tab() === 'rez-lista' || this.tab() === 'rez-nou');
  protected readonly subtitle = computed(() => {
    switch (this.tab()) {
      case 'rez-lista': return this.s.resultsLine();
      case 'rez-nou': return t('concurs.intro');
      case 'import': return t('hartie.intro');
      case 'excel': return t('excel.intro');
      case 'scan': return t('scan.intro');
      default: return this.s.countLine();
    }
  });

  /** Fișele porumbeilor afișați acum (cu filtrele și ordinea de pe ecran), pe pagina de tipar; peste MAX_SHEETS, doar mesajul. */
  protected printAll(): void {
    if (this.s.shownCount() > MAX_SHEETS) { this.tooMany.set(true); return; }
    this.tooMany.set(false);
    void this.router.navigate(['/porumbei/tiparire'], {
      queryParams: { ids: idsOfGroups(this.s.groups()).join(','), inapoi: this.tab() === 'lista' ? 'porumbar' : 'panou' },
    });
  }

  constructor() {
    this.s.load();
    const sub = this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.tab.set(tabOf(e.urlAfterRedirects));
    });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }
}
