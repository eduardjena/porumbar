import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../../core/api';
import { CatalogService, ringText, sexShort } from '../../core/catalog';
import { TPipe, t } from '../../core/i18n';
import { SharePdfService } from '../../core/share-pdf';
import { Icon } from '../../shared/icon';
import { resultsLine } from '../panou/panou-view';
import { PorumbarState } from '../panou/porumbar-state';

/*
 * Lista porumbeilor: aceiași porumbei și aceeași bară ca Grila (antetul și bara le ține cadrul comun, porumbar-cadru.ts),
 * doar că pe rânduri compacte.
 */
@Component({
  selector: 'app-porumbar',
  imports: [RouterLink, Icon, TPipe],
  template: `
    @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
    @if (shareNote(); as n) { <div class="notice" role="status">{{ n }}</div> }

    @if (s.loaded() && !s.all().length) {
      <div class="empty card">
        <h2>{{ 'panou.gol_titlu' | t }}</h2>
        <p class="muted">{{ 'panou.gol_text' | t }}</p>
        <a routerLink="/porumbei/nou" class="btn primary"><app-icon name="plus" />{{ 'panou.adauga_primul' | t }}</a>
      </div>
    } @else if (s.loaded() && !s.shownCount()) {
      <p class="muted">{{ 'panou.nimic_gasit' | t }}</p>
    }

    @for (g of s.groups(); track g.key) {
      @if (g.label) {
        <button type="button" class="group-head" [attr.aria-expanded]="!collapsed().has(g.key)" (click)="toggleGroup(g.key)">
          <app-icon name="jos" [size]="22" [class.shut]="collapsed().has(g.key)" />
          <span>{{ g.label }}</span><span class="n">{{ g.items.length }}</span>
        </button>
      }
      @if (!collapsed().has(g.key) && g.items.length) {
        <ul class="rows card">
          @for (p of g.items; track p.id) {
            <li>
              <a [routerLink]="['/porumbei', p.id]" [queryParams]="{ din: 'lista' }" class="row-link">
                <span class="score" [class]="'score band-' + p.value.band" [attr.aria-label]="p.value.score == null ? ('panou.fara_nota_mic' | t) : ('panou.nota_aria' | t: { nota: p.value.score })">
                  {{ p.value.score ?? '–' }}
                </span>
                <span class="mono ring">{{ ring(p) }}</span>
                <span [class]="'sex sex-' + (p.sex ?? '')">{{ sex(p.sex) }}</span>
                <span class="name">{{ p.name ?? '' }}</span>
                <span class="muted meta">{{ p.year ?? '' }}@if (p.status) { · {{ catalog.label('statuses', p.status) }} }</span>
                @if (s.resultsMode()) { <span class="muted res">{{ resultsLine(p) }}</span> }
              </a>
              <a [routerLink]="['/porumbei', p.id, 'tiparire']" class="act" [title]="'porumbel.tipareste_pedigree' | t" [attr.aria-label]="'panou.tipareste_aria' | t: { cine: p.ring?.display ?? p.name ?? ('panou.porumbel_mic' | t) }">
                <app-icon name="tipar" [size]="22" />
              </a>
              <button type="button" class="act" (click)="send(p.id)" [disabled]="share.busy() === p.id" [attr.aria-busy]="share.busy() === p.id"
                      [title]="'panou.trimite_fisa' | t" [attr.aria-label]="'panou.trimite_aria' | t: { cine: p.ring?.display ?? p.name ?? ('panou.porumbel_mic' | t) }">
                <app-icon name="trimite" [size]="22" />
              </button>
            </li>
          }
        </ul>
      }
    }
  `,
  styles: `
    .group-head {
      display: flex; align-items: center; gap: 10px; width: 100%; min-height: 48px; margin: 18px 0 8px; padding: 6px 4px; border: 0;
      border-bottom: 2px solid var(--border); border-radius: 0; background: none; box-shadow: none; color: var(--text); font-size: 1.1rem; font-weight: 800; text-align: left;
    }
    .group-head:first-of-type { margin-top: 4px; }
    .group-head app-icon { color: var(--muted); transition: transform 0.2s var(--ease); }
    .group-head app-icon.shut { transform: rotate(-90deg); }
    .group-head .n { margin-left: auto; min-width: 32px; padding: 2px 10px; border-radius: 999px; background: var(--surface-2); color: var(--muted); font-size: 0.95rem; text-align: center; }
    .rows { list-style: none; margin: 0 0 8px; padding: 4px 0; }
    .rows li { display: flex; align-items: center; gap: 2px; padding-right: 6px; }
    .rows li + li { border-top: 1px solid var(--border); }
    .row-link {
      flex: 1 1 auto; min-width: 0; display: grid; grid-template-columns: 40px minmax(150px, 1.1fr) 28px minmax(0, 1.3fr) minmax(0, 1fr);
      gap: 4px 12px; align-items: center; min-height: 56px; padding: 6px 8px 6px 14px; color: var(--text); text-decoration: none;
    }
    .row-link:hover { background: var(--accent-soft); }
    .score { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; font-size: 1.05rem; font-weight: 800; }
    .ring { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .name { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .meta { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.9rem; }
    .res { grid-column: 2 / -1; font-size: 0.85rem; line-height: 1.3; }
    .act {
      flex: none; width: 44px; height: 44px; min-height: 0; padding: 0; border: 0; border-radius: 12px; display: grid; place-items: center;
      background: transparent; box-shadow: none; color: var(--muted); text-decoration: none;
    }
    .act:hover, .act:focus-visible { color: var(--accent); background: var(--accent-soft); }
    .act[aria-busy='true'] { color: var(--accent); animation: pulse 1s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: 0.35; } }
    .empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 40px 20px; gap: 6px; }
    @media (max-width: 767px) {
      .row-link { grid-template-columns: 40px minmax(0, 1fr) 24px; padding: 6px 4px 6px 10px; }
      .score { grid-row: span 2; }
      .name { grid-column: 2; grid-row: 2; font-size: 0.95rem; }
      .meta { grid-column: 3; grid-row: 2; }
      .meta { display: none; }
      .res { grid-column: 2 / -1; }
    }
  `,
})
export default class Porumbar {
  protected readonly s = inject(PorumbarState);
  protected readonly catalog = inject(CatalogService);
  protected readonly share = inject(SharePdfService);
  protected readonly sex = sexShort;
  protected readonly ring = ringText;
  protected readonly resultsLine = resultsLine;
  readonly error = signal('');
  readonly shareNote = signal('');
  readonly collapsed = signal<Set<string>>(new Set());

  constructor() {
    let group = this.s.view().group;
    effect(() => {
      const g = this.s.view().group;
      if (g !== group) {
        group = g;
        this.collapsed.set(new Set());
      }
    });
  }

  toggleGroup(key: string) {
    const next = new Set(this.collapsed());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.collapsed.set(next);
  }

  async send(id: number) {
    this.shareNote.set('');
    try {
      if ((await this.share.sharePigeon(id)) === 'downloaded') this.shareNote.set(t('panou.fisa_descarcata'));
    } catch (e) {
      this.error.set(t('panou.fisa_nepregatita', { eroare: errorMessage(e) }));
    }
  }
}
