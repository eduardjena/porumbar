import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CatalogService, sexShort } from '../../core/catalog';
import { BoardPigeon } from '../../core/models';
import { Icon } from '../../shared/icon';
import { ViewToggle } from '../../shared/view-toggle';

const BANDS = [
  { band: 5, label: '80–100' },
  { band: 4, label: '60–79' },
  { band: 3, label: '40–59' },
  { band: 2, label: '20–39' },
  { band: 1, label: 'sub 20' },
  { band: 0, label: 'fără date' },
];

/** De ce are porumbelul nota asta, pe scurt: „evaluare 75 · 2 pui · reproducător”. */
function reasons(p: BoardPigeon): string {
  const out: string[] = [];
  if (p.value.parts.evaluare != null) out.push(`evaluare ${Math.round(p.value.parts.evaluare)}`);
  if (p.offspringCount) out.push(p.offspringCount === 1 ? '1 pui' : `${p.offspringCount} pui`);
  if (p.value.parts.reproducator) out.push('reproducător');
  return out.length ? out.join(' · ') : 'Fără notă: adaugă evaluarea sau puii';
}

@Component({
  selector: 'app-panou',
  imports: [FormsModule, RouterLink, Icon, ViewToggle],
  template: `
    <div class="head">
      <div>
        <h1>Porumbarul meu</h1>
        @if (loaded()) { <p class="muted count">{{ all().length }} {{ all().length === 1 ? 'porumbel' : 'porumbei' }}, cei mai valoroși primii</p> }
      </div>
      <div class="row actions">
        <app-view-toggle current="grila" />
        <a routerLink="/porumbei/pedigree" class="btn"><app-icon name="fisa" />Importă pedigree</a>
        <a routerLink="/scaneaza" class="btn"><app-icon name="qr" />Scanează cod QR</a>
        <a routerLink="/porumbei/nou" class="btn primary add"><app-icon name="plus" />Porumbel nou</a>
      </div>
    </div>

    <div class="filters">
      <label class="search">
        <app-icon name="cautare" />
        <input type="search" placeholder="Caută după inel sau nume" aria-label="Caută după inel sau nume" [(ngModel)]="q" />
      </label>
      <select [(ngModel)]="status" aria-label="Starea">
        <option value="">Orice stare</option>
        @for (s of catalog.catalog()?.statuses ?? []; track s.code) { <option [value]="s.code">{{ s.label }}</option> }
      </select>
      <select [(ngModel)]="sexF" aria-label="Sexul">
        <option value="">Masculi și femele</option>
        <option value="M">Masculi</option>
        <option value="F">Femele</option>
      </select>
    </div>

    @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }

    @if (loaded() && !all().length) {
      <div class="empty card">
        <span class="empty-ico"><app-icon name="porumbel" [size]="48" /></span>
        <h2>Porumbarul e gol deocamdată</h2>
        <p class="muted">Adaugă primul porumbel. Durează un minut.</p>
        <a routerLink="/porumbei/nou" class="btn primary"><app-icon name="plus" />Adaugă primul porumbel</a>
      </div>
    } @else if (loaded() && !shown().length) {
      <p class="muted">Niciun porumbel nu se potrivește căutării.</p>
    }

    <!-- Grilă compactă: încap zeci de porumbei pe ecran (2 pe rând pe telefon, 5–6 pe calculator). -->
    <ol class="grid">
      @for (p of shown(); track p.id) {
        <li>
          <a [routerLink]="['/porumbei', p.id]" class="tile" [title]="why(p)">
            <span class="top">
              <span class="score" [class]="'score band-' + p.value.band" [attr.aria-label]="p.value.score == null ? 'fără notă' : 'nota ' + p.value.score">
                {{ p.value.score ?? '–' }}
              </span>
              <span [class]="'sex sex-' + (p.sex ?? '')">{{ sex(p.sex) }}</span>
            </span>
            <span class="mono ring">{{ p.ring?.display ?? 'Fără inel' }}</span>
            <span class="name">{{ p.name || ' ' }}</span>
            <span class="meta muted">{{ p.year ?? '' }}@if (p.status) { · {{ catalog.label('statuses', p.status) }} }</span>
            <span class="why">{{ why(p) }}</span>
          </a>
          <!-- Tipărirea direct din panou, în colțul din dreapta sus al casetei (nu în link-ul casetei: link în link nu se poate). -->
          <a [routerLink]="['/porumbei', p.id, 'tiparire']" class="print" title="Tipărește pedigree-ul" [attr.aria-label]="'Tipărește pedigree-ul lui ' + (p.ring?.display ?? p.name ?? 'porumbel')">
            <app-icon name="tipar" [size]="22" />
          </a>
        </li>
      }
    </ol>

    @if (all().length) {
      <div class="legend" aria-label="Culorile notei">
        <span class="muted">Nota:</span>
        @for (b of bands; track b.band) { <span class="chip" [class]="'chip band-' + b.band">{{ b.label }}</span> }
      </div>
      <p class="muted small">Nota (0–100) vine din evaluarea la mână, câți pui are în porumbar și dacă e reproducător. După ce introduci rezultatele de concurs, va ține cont și de ele.</p>
    }
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
    .head h1 { margin-bottom: 2px; }
    .count { margin: 0; }
    .filters { display: grid; grid-template-columns: 1fr auto auto; gap: 10px; margin-bottom: 18px; }
    .filters select { width: auto; }
    .search { position: relative; display: block; }
    .search app-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
    .search input { padding-left: 50px; border-radius: 999px; }
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
    .print:hover, .print:focus-visible { color: var(--accent); background: var(--accent-soft); }
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
      .actions .add { display: none; }
      .filters { grid-template-columns: 1fr 1fr; }
      .search { grid-column: 1 / -1; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
      .tile { padding: 10px; }
    }
  `,
})
export default class Panou {
  private readonly api = inject(Api);
  protected readonly catalog = inject(CatalogService);
  protected readonly bands = BANDS;
  protected readonly sex = sexShort;
  protected readonly why = reasons;
  readonly all = signal<BoardPigeon[]>([]);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly qS = signal('');
  readonly statusS = signal('');
  readonly sexS = signal('');

  get q() { return this.qS(); }
  set q(v: string) { this.qS.set(v); }
  get status() { return this.statusS(); }
  set status(v: string) { this.statusS.set(v); }
  get sexF() { return this.sexS(); }
  set sexF(v: string) { this.sexS.set(v); }

  protected readonly shown = computed(() => {
    const q = this.qS().trim().toLowerCase().replace(/[\s/-]+/g, '');
    return this.all().filter((p) => {
      if (this.statusS() && p.status !== this.statusS()) return false;
      if (this.sexS() && p.sex !== this.sexS()) return false;
      if (!q) return true;
      const hay = `${p.ring?.display ?? ''}${p.ring?.raw ?? ''}${p.name ?? ''}`.toLowerCase().replace(/[\s/-]+/g, '');
      return hay.includes(q) || hay.includes(q.replace(/^0+/, ''));
    });
  });

  constructor() {
    this.load();
  }

  private async load() {
    try {
      this.all.set((await this.api.get<{ pigeons: BoardPigeon[] }>('/board')).pigeons);
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loaded.set(true);
    }
  }
}
