import { Component, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { errorMessage } from '../../core/api';
import { CatalogService, ringText, sexShort } from '../../core/catalog';
import { TPipe, t } from '../../core/i18n';
import { BoardPigeon } from '../../core/models';
import { Icon } from '../../shared/icon';
import { resultsLine } from './panou-view';
import { PorumbarState } from './porumbar-state';
import { SharePdfService } from '../../core/share-pdf';

const BANDS: { band: number; label: string; key?: string }[] = [
  { band: 5, label: '80–100' },
  { band: 4, label: '60–79' },
  { band: 3, label: '40–59' },
  { band: 2, label: '20–39' },
  { band: 1, label: '', key: 'panou.banda_sub20' },
  { band: 0, label: '', key: 'panou.banda_fara_date' },
];

/** De ce are porumbelul nota asta, pe scurt: „evaluare 75 · 2 pui · reproducător”. */
function reasons(p: BoardPigeon): string {
  const out: string[] = [];
  if (p.value.parts.evaluare != null) out.push(t('panou.motiv_evaluare', { nota: Math.round(p.value.parts.evaluare) }));
  if (p.offspringCount) out.push(t('panou.motiv_pui', { count: p.offspringCount }));
  if (p.value.parts.reproducator) out.push(t('panou.motiv_reproducator'));
  return out.length ? out.join(' · ') : t('panou.fara_nota_ajutor');
}

@Component({
  selector: 'app-panou',
  imports: [RouterLink, Icon, TPipe],
  template: `
    @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
    @if (shareNote(); as n) { <div class="notice" role="status">{{ n }}</div> }

    @if (s.loaded() && !s.all().length) {
      <div class="empty card">
        <span class="empty-ico"><app-icon name="porumbel" [size]="48" /></span>
        <h2>{{ 'panou.gol_titlu' | t }}</h2>
        <p class="muted">{{ 'panou.gol_text' | t }}</p>
        <a routerLink="/porumbei/nou" class="btn primary"><app-icon name="plus" />{{ 'panou.adauga_primul' | t }}</a>
      </div>
    } @else if (s.loaded() && !s.shownCount()) {
      <p class="muted">{{ 'panou.nimic_gasit' | t }}</p>
    }

    <!-- Grilă compactă: încap zeci de porumbei pe ecran (2 pe rând pe telefon, 5–6 pe calculator); cu grupare, câte o secțiune pe grupă. -->
    @for (g of s.groups(); track g.key) {
      @if (g.label) {
        <button type="button" class="group-head" [attr.aria-expanded]="!collapsed().has(g.key)" (click)="toggleGroup(g.key)">
          <app-icon name="jos" [size]="22" [class.shut]="collapsed().has(g.key)" />
          <span>{{ g.label }}</span><span class="n">{{ g.items.length }}</span>
        </button>
      }
      @if (!collapsed().has(g.key)) {
        <ol class="grid">
          @for (p of g.items; track p.id) {
            <li>
              <a [routerLink]="['/porumbei', p.id]" class="tile" [title]="why(p)">
                <span class="top">
                  <span class="score" [class]="'score band-' + p.value.band" [attr.aria-label]="p.value.score == null ? ('panou.fara_nota_mic' | t) : ('panou.nota_aria' | t: { nota: p.value.score })">
                    {{ p.value.score ?? '–' }}
                  </span>
                  <span [class]="'sex sex-' + (p.sex ?? '')">{{ sex(p.sex) }}</span>
                </span>
                <span class="mono ring">{{ ring(p) }}</span>
                <span class="name">{{ p.name || ' ' }}</span>
                <span class="meta muted">{{ p.year ?? '' }}@if (p.status) { · {{ catalog.label('statuses', p.status) }} }</span>
                <span class="why">{{ s.resultsMode() ? resultsLine(p) : why(p) }}</span>
              </a>
              <!-- Tipărirea direct din panou, în colțul din dreapta sus al casetei (nu în link-ul casetei: link în link nu se poate). -->
              <a [routerLink]="['/porumbei', p.id, 'tiparire']" class="print" [title]="'porumbel.tipareste_pedigree' | t" [attr.aria-label]="'panou.tipareste_aria' | t: { cine: p.ring?.display ?? p.name ?? ('panou.porumbel_mic' | t) }">
                <app-icon name="tipar" [size]="22" />
              </a>
              <!-- Trimite fișa ca PDF (WhatsApp, mail…), în colțul din dreapta jos: sus nu mai e loc lângă notă pe telefon. -->
              <button type="button" class="share" (click)="send(p.id)" [disabled]="share.busy() === p.id" [attr.aria-busy]="share.busy() === p.id"
                      [title]="'panou.trimite_fisa' | t" [attr.aria-label]="'panou.trimite_aria' | t: { cine: p.ring?.display ?? p.name ?? ('panou.porumbel_mic' | t) }">
                <app-icon name="trimite" [size]="22" />
              </button>
            </li>
          }
        </ol>
      }
    }

    @if (s.all().length) {
      <div class="legend" [attr.aria-label]="'panou.culorile_notei' | t">
        <span class="muted">{{ 'panou.nota' | t }}</span>
        @for (b of bands; track b.band) { <span class="chip" [class]="'chip band-' + b.band">{{ b.key ? (b.key | t) : b.label }}</span> }
      </div>
      <p class="muted small">{{ 'panou.nota_explicatie' | t }}</p>
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
    .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(176px, 1fr)); gap: 10px; }
    .tile {
      display: flex; flex-direction: column; gap: 2px; padding: 12px; border-radius: var(--radius); background: var(--surface);
      border: 1px solid var(--border); box-shadow: var(--shadow); color: var(--text); text-decoration: none; height: 100%;
      transition: border-color 0.15s, transform 0.2s var(--ease);
    }
    .tile:hover { border-color: var(--accent); }
    .tile:active { transform: scale(0.98); }
    .grid > li { position: relative; }
    .top { display: flex; gap: 10px; align-items: flex-start; margin-bottom: 6px; padding-right: 40px; }
    .print {
      position: absolute; top: 6px; right: 6px; width: 44px; height: 44px; border-radius: 12px; display: grid; place-items: center;
      color: var(--muted); text-decoration: none; transition: color 0.15s, background 0.15s;
    }
    .share {
      position: absolute; bottom: 6px; right: 6px; width: 44px; height: 44px; min-height: 0; padding: 0; border: 0; border-radius: 12px;
      display: grid; place-items: center; background: transparent; box-shadow: none; color: var(--muted); transition: color 0.15s, background 0.15s;
    }
    .print:hover, .print:focus-visible, .share:hover, .share:focus-visible { color: var(--accent); background: var(--accent-soft); }
    .share[aria-busy='true'] { opacity: 1; color: var(--accent); animation: pulse 1s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: 0.35; } }
    /* Textele de jos lasă loc butonului de trimis. */
    .tile .meta, .tile .why { padding-right: 42px; }
    .score { width: 48px; height: 48px; border-radius: 14px; display: grid; place-items: center; font-size: 1.25rem; font-weight: 800; }
    .sex { font-size: 1rem; padding-top: 2px; }
    .ring { font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .name { font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-height: 1.5em; }
    .meta { font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .why { font-size: 0.8rem; color: var(--muted); line-height: 1.3; margin-top: 4px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
    .legend { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin-top: 24px; }
    .chip { padding: 4px 12px; border-radius: 999px; font-size: 0.85rem; font-weight: 700; }
    .small { font-size: 0.9rem; max-width: 70ch; }
    .empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 40px 20px; gap: 6px; }
    .empty h2 { margin: 8px 0 0; }
    .empty-ico { width: 88px; height: 88px; border-radius: 28px; background: var(--accent-soft); color: var(--accent); display: grid; place-items: center; }
    @media (max-width: 767px) {
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .tile { padding: 10px; }
    }
  `,
})
export default class Panou {
  protected readonly s = inject(PorumbarState);
  protected readonly catalog = inject(CatalogService);
  protected readonly bands = BANDS;
  protected readonly sex = sexShort;
  protected readonly why = reasons;
  protected readonly ring = ringText;
  protected readonly resultsLine = resultsLine;
  protected readonly share = inject(SharePdfService);
  readonly error = signal('');
  /** Mesajul de după „Trimite” (de ex. PDF-ul s-a descărcat, unde browserul nu poate trimite fișiere). */
  readonly shareNote = signal('');
  /** Grupele strânse (se deschid la loc când se schimbă gruparea). */
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

  async send(id: number) {
    this.shareNote.set('');
    try {
      if ((await this.share.sharePigeon(id)) === 'downloaded') this.shareNote.set(t('panou.fisa_descarcata'));
    } catch (e) {
      this.error.set(t('panou.fisa_nepregatita', { eroare: errorMessage(e) }));
    }
  }

  toggleGroup(key: string) {
    const next = new Set(this.collapsed());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.collapsed.set(next);
  }
}
