import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService } from '../../core/confirm';
import { percent, ringText } from '../../core/catalog';
import { Pair, PigeonSummary, RingSeries } from '../../core/models';
import { Icon } from '../../shared/icon';

const today = () => new Date().toISOString().slice(0, 10);
export const roDate = (d: string | null | undefined) => (d ? d.split('-').reverse().join('.') : '');
export const STATUS_LABEL: Record<Pair['status'], string> = { planificata: 'Plănuită', activa: 'Împreună', despartita: 'Despărțită' };
// În listă: întâi ai tăi; strămoșii / împrumutații sunt marcați (o pereche se poate face și cu un porumbel împrumutat).
const who = (p: PigeonSummary | null) => (p ? `${ringText(p)}${p.name ? ` „${p.name}”` : ''}${p.kind === 'external' ? ' · nu e în porumbarul meu' : ''}` : '—');

/*
 * Reproducția: perechile sezonului (an), perechea nouă (cu consangvinizarea puilor văzută înainte de salvare) și
 * seriile de inele ale anului, din care programul propune inelul următor la inelarea puilor.
 */
@Component({
  selector: 'app-perechi',
  imports: [FormsModule, RouterLink, Icon],
  template: `
    <div class="head">
      <h1>Perechi</h1>
      <label class="season">Sezonul
        <select [ngModel]="season()" (ngModelChange)="changeSeason($event)">
          @for (s of seasons(); track s) { <option [ngValue]="s">{{ s }}</option> }
        </select>
      </label>
    </div>
    <p class="muted">Perechile, ouăle și puii fiecărui sezon. Puii inelați intră în porumbar cu tatăl și mama deja puși.</p>

    @if (!adding()) {
      <button type="button" class="primary big" (click)="openAdd()"><app-icon name="plus" />Pereche nouă</button>
    } @else {
      <form class="card stack" (ngSubmit)="create()">
        <h2>Pereche nouă</h2>
        <label class="field">Caută <input name="filter" [(ngModel)]="filter" placeholder="inel sau nume" autocomplete="off" /></label>
        <label class="field">Masculul
          <select name="cock" [(ngModel)]="cockId" (ngModelChange)="checkCoi()" required>
            <option [ngValue]="null">— alege masculul —</option>
            @for (p of cocks(); track p.id) { <option [ngValue]="p.id">{{ label(p) }}</option> }
          </select>
        </label>
        <label class="field">Femela
          <select name="hen" [(ngModel)]="henId" (ngModelChange)="checkCoi()" required>
            <option [ngValue]="null">— alege femela —</option>
            @for (p of hens(); track p.id) { <option [ngValue]="p.id">{{ label(p) }}</option> }
          </select>
        </label>
        @if (!allPigeons().length) { <p class="muted">Se încarcă porumbeii…</p> }
        @else if (!cocks().length || !hens().length) { <p class="muted">Pentru o pereche, porumbeii trebuie să aibă sexul trecut pe fișă (M sau F).</p> }
        @if (coi() != null) {
          <div [class]="coi()! >= 0.125 ? 'warning' : 'notice'" role="status">
            @if (coi()! > 0) { Puii acestei perechi ar avea consangvinizare <strong>{{ pct(coi()!) }}</strong>. }
            @else { Masculul și femela nu au strămoși comuni cunoscuți: puii nu sunt consangvini. }
          </div>
        }
        <label class="check"><input type="checkbox" name="planned" [(ngModel)]="planned" /> Doar o plănuiesc (încă nu i-am pus împreună)</label>
        @if (!planned) {
          <label class="field">Data împerecherii <input type="date" name="pairedOn" [(ngModel)]="pairedOn" required /></label>
        }
        <label class="field">Cuibul / boxa <span class="hint">(nu e obligatoriu)</span><input name="nest" [(ngModel)]="nest" placeholder="de ex. 12" /></label>
        @if (formError()) { <div class="error" role="alert">{{ formError() }}</div> }
        <div class="row">
          <button class="primary" type="submit" [disabled]="!cockId || !henId || busy()"><app-icon name="bifa" />Salvează perechea</button>
          <button type="button" (click)="adding.set(false)">Renunță</button>
        </div>
      </form>
    }

    @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
    <ul class="pairs">
      @for (p of pairs(); track p.id) {
        <li>
          <a class="card pair" [routerLink]="['/perechi', p.id]">
            <span class="birds">
              <span class="sx sM">M</span><strong class="mono">{{ ring(p.cock) }}</strong>
              <span class="x">×</span>
              <span class="sx sF">F</span><strong class="mono">{{ ring(p.hen) }}</strong>
            </span>
            <span class="meta">
              <span class="badge" [class]="'badge st-' + p.status">{{ status[p.status] }}</span>
              @if (p.nest) { <span>cuibul {{ p.nest }}</span> }
              @if (p.pairedOn) { <span>din {{ date(p.pairedOn) }}</span> }
              <span>{{ p.clutchCount }} {{ p.clutchCount === 1 ? 'pontă' : 'ponte' }} · {{ p.youngCount }} pui inelați</span>
              @if (p.coi > 0) { <span [class.warn]="p.coi >= 0.125">consangvinizare {{ pct(p.coi) }}</span> }
            </span>
            <app-icon name="inainte" />
          </a>
        </li>
      } @empty {
        @if (loaded()) { <p class="muted">Nicio pereche în {{ season() }}. Apasă „Pereche nouă”.</p> }
      }
    </ul>

    <section class="card stack series">
      <h2>Inelele mele</h2>
      <p class="muted">Scrie primul și ultimul inel din seria primită de la federație. La inelarea puilor, programul îți propune următorul inel liber.</p>
      @for (s of series(); track s.id) {
        <div class="row between">
          <span><strong>{{ s.year }}</strong>: <span class="mono">{{ s.first }}</span> → <span class="mono">{{ s.last }}</span> <span class="muted">({{ s.count }} inele)</span></span>
          <button type="button" class="link" (click)="removeSeries(s)">Șterge</button>
        </div>
      }
      <form class="row" (ngSubmit)="addSeries()">
        <label class="field grow">Primul inel <input name="first" [(ngModel)]="first" class="mono" placeholder="RO-26-800540" /></label>
        <label class="field grow">Ultimul inel <input name="last" [(ngModel)]="last" class="mono" placeholder="RO-26-800589" /></label>
        <button type="submit" class="end" [disabled]="!first.trim() || !last.trim()"><app-icon name="plus" />Adaugă seria</button>
      </form>
      @if (seriesError()) { <div class="error" role="alert">{{ seriesError() }}</div> }
    </section>
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .head h1 { margin: 0; }
    .season { display: flex; align-items: center; gap: 8px; font-weight: 700; }
    .big { min-height: 56px; margin: 6px 0 16px; }
    h2 { margin: 0; }
    .check { display: flex; align-items: center; gap: 10px; font-weight: 600; min-height: 48px; }
    .check input { width: 24px; height: 24px; }
    .pairs { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 10px; margin: 0 0 24px; }
    .pair { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 4px 12px; text-decoration: none; color: var(--text); }
    .pair app-icon { grid-row: 1 / span 2; grid-column: 2; color: var(--muted); }
    .birds { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 1.1rem; }
    .x { color: var(--muted); font-weight: 700; padding: 0 2px; }
    .sx { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: 0.75rem; color: #fff; }
    .sx.sM { background: var(--male); }
    .sx.sF { background: var(--female); }
    .meta { display: flex; flex-wrap: wrap; gap: 4px 12px; color: var(--muted); font-size: 0.95rem; align-items: center; }
    .warn { color: var(--danger, #b3261e); font-weight: 700; }
    .st-activa { background: var(--accent-soft); color: var(--accent-strong); }
    .grow { flex: 1 1 180px; }
    .end { align-self: flex-end; }
    .between { justify-content: space-between; }
  `,
})
export default class Perechi {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  /** ?sezon=2025 */
  readonly sezon = input<string>();
  readonly season = signal(new Date().getFullYear());
  readonly seasons = signal<number[]>([new Date().getFullYear()]);
  readonly pairs = signal<Pair[]>([]);
  readonly series = signal<RingSeries[]>([]);
  readonly allPigeons = signal<PigeonSummary[]>([]);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly seriesError = signal('');
  readonly adding = signal(false);
  readonly busy = signal(false);
  readonly coi = signal<number | null>(null);
  readonly filterS = signal('');
  get filter() { return this.filterS(); }
  set filter(v: string) { this.filterS.set(v); }
  cockId: number | null = null;
  henId: number | null = null;
  planned = false;
  pairedOn = today();
  nest = '';
  first = '';
  last = '';
  protected readonly status = STATUS_LABEL;
  protected readonly pct = percent;
  protected readonly date = roDate;
  protected readonly label = who;
  protected readonly ring = (p: PigeonSummary | null) => (p ? ringText(p) : '—');

  private readonly filtered = computed(() => {
    const q = this.filterS().trim().toLowerCase().replace(/[\s/-]+/g, '');
    const all = this.allPigeons();
    if (!q) return all;
    return all.filter((p) => `${p.ring?.display ?? ''}${p.ring?.raw ?? ''}${p.name ?? ''}`.toLowerCase().replace(/[\s/-]+/g, '').includes(q));
  });
  protected readonly cocks = computed(() => this.filtered().filter((p) => p.sex === 'M' || p.id === this.cockId));
  protected readonly hens = computed(() => this.filtered().filter((p) => p.sex === 'F' || p.id === this.henId));

  constructor() {
    effect(() => {
      const s = Number(this.sezon());
      untracked(() => {
        if (Number.isInteger(s) && s > 1990) this.season.set(s);
        this.load();
      });
    });
    this.loadSeries();
  }

  private async load() {
    try {
      const r = await this.api.get<{ season: number; seasons: number[]; pairs: Pair[] }>(`/pairs?season=${this.season()}`);
      this.pairs.set(r.pairs);
      const now = new Date().getFullYear();
      this.seasons.set([...new Set([now, r.season, ...r.seasons])].sort((a, b) => b - a));
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loaded.set(true);
    }
  }

  private async loadSeries() {
    try {
      this.series.set((await this.api.get<{ series: RingSeries[] }>('/ring-series')).series);
    } catch {
      // lista seriilor nu e esențială
    }
  }

  changeSeason(s: number) {
    this.router.navigate([], { queryParams: { sezon: s }, replaceUrl: true });
  }

  async openAdd() {
    this.adding.set(true);
    this.formError.set('');
    if (!this.allPigeons().length) {
      try {
        const list = (await this.api.get<{ pigeons: PigeonSummary[] }>('/pigeons')).pigeons;
        // Întâi porumbeii proprii, apoi strămoșii / împrumutații; în fiecare grup după inel.
        this.allPigeons.set([...list].sort((a, b) => Number(a.kind !== 'own') - Number(b.kind !== 'own') || ringText(a).localeCompare(ringText(b))));
      } catch (e) {
        this.formError.set(errorMessage(e));
      }
    }
  }

  async checkCoi() {
    this.coi.set(null);
    if (!this.cockId || !this.henId) return;
    try {
      this.coi.set((await this.api.get<{ coi: number }>(`/pairs/coi?sireId=${this.cockId}&damId=${this.henId}`)).coi);
    } catch {
      // fără calcul: perechea se poate salva oricum
    }
  }

  async create() {
    this.formError.set('');
    this.busy.set(true);
    try {
      const body = { cockId: this.cockId, henId: this.henId, pairedOn: this.planned ? null : this.pairedOn, season: this.season(), nest: this.nest || null };
      const r = await this.api.post<{ pair: Pair }>('/pairs', body);
      this.router.navigate(['/perechi', r.pair.id]);
    } catch (e) {
      this.formError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async addSeries() {
    this.seriesError.set('');
    try {
      await this.api.post('/ring-series', { first: this.first, last: this.last });
      this.first = '';
      this.last = '';
      await this.loadSeries();
    } catch (e) {
      this.seriesError.set(errorMessage(e));
    }
  }

  async removeSeries(s: RingSeries) {
    const ok = await this.confirm.ask({
      title: 'Ștergi seria de inele?',
      lines: [`${s.first} → ${s.last}`, 'Porumbeii inelați deja rămân neatinși; doar nu se mai propun inele din seria aceasta.'],
      confirmLabel: 'Da, șterge seria',
      danger: true,
    });
    if (!ok) return;
    await this.api.delete(`/ring-series/${s.id}`);
    this.series.update((l) => l.filter((x) => x.id !== s.id));
  }
}
