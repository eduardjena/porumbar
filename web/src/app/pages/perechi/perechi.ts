import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService } from '../../core/confirm';
import { percent, ringText } from '../../core/catalog';
import { formatDay, t, TPipe } from '../../core/i18n';
import { Pair, PigeonSummary, RingSeries } from '../../core/models';
import { Icon } from '../../shared/icon';

const today = () => new Date().toISOString().slice(0, 10);
export const statusLabel = (s: Pair['status']) => t(`perechi.status_${s}`);
// În listă: întâi ai tăi; strămoșii / împrumutații sunt marcați (o pereche se poate face și cu un porumbel împrumutat).
const who = (p: PigeonSummary | null) => (p ? `${ringText(p)}${p.name ? ` „${p.name}”` : ''}${p.kind === 'external' ? ` · ${t('text.nu_e_in_porumbarul_meu')}` : ''}` : '—');

/*
 * Reproducția: perechile sezonului (an), perechea nouă (cu consangvinizarea puilor văzută înainte de salvare) și
 * seriile de inele ale anului, din care programul propune inelul următor la inelarea puilor.
 */
@Component({
  selector: 'app-perechi',
  imports: [FormsModule, RouterLink, Icon, TPipe],
  template: `
    <div class="head">
      <h1>{{ 'perechi.titlu' | t }}</h1>
      @if (section() !== 'inele') {
      <label class="season">{{ 'camp.sezonul' | t }}
        <select [ngModel]="season()" (ngModelChange)="changeSeason($event)">
          @for (s of seasons(); track s) { <option [ngValue]="s">{{ s }}</option> }
        </select>
      </label>
      }
    </div>
    <!-- Submeniurile (Perechile sezonului / Pereche nouă / Inelele mele) stau în banda de sus (app.ts), după ?sec=. -->
    @if (section() === 'sezon') { <p class="muted">{{ 'perechi.intro' | t }}</p> }

    @if (section() === 'noua') {
      <form class="card stack" (ngSubmit)="create()">
        <h2>{{ 'perechi.pereche_noua' | t }}</h2>
        <label class="field">{{ 'perechi.cauta' | t }} <input name="filter" [(ngModel)]="filter" [placeholder]="'perechi.inel_sau_nume' | t" autocomplete="off" /></label>
        <label class="field">{{ 'perechi.masculul' | t }}
          <select name="cock" [(ngModel)]="cockId" (ngModelChange)="checkCoi()" required>
            <option [ngValue]="null">{{ 'perechi.alege_masculul' | t }}</option>
            @for (p of cocks(); track p.id) { <option [ngValue]="p.id">{{ label(p) }}</option> }
          </select>
        </label>
        <label class="field">{{ 'perechi.femela' | t }}
          <select name="hen" [(ngModel)]="henId" (ngModelChange)="checkCoi()" required>
            <option [ngValue]="null">{{ 'perechi.alege_femela' | t }}</option>
            @for (p of hens(); track p.id) { <option [ngValue]="p.id">{{ label(p) }}</option> }
          </select>
        </label>
        @if (!allPigeons().length) { <p class="muted">{{ 'perechi.se_incarca' | t }}</p> }
        @else if (!cocks().length || !hens().length) { <p class="muted">{{ 'perechi.sex_lipsa' | t }}</p> }
        @if (coi() != null) {
          <div [class]="coi()! >= 0.125 ? 'warning' : 'notice'" role="status">
            @if (coi()! > 0) { {{ 'perechi.coi_ar_avea' | t }} <strong>{{ pct(coi()!) }}</strong>. }
            @else { {{ 'perechi.fara_stramosi_comuni' | t }} }
          </div>
        }
        <label class="check"><input type="checkbox" name="planned" [(ngModel)]="planned" /> {{ 'perechi.doar_planuiesc' | t }}</label>
        @if (!planned) {
          <label class="field">{{ 'camp.data_imperecherii' | t }} <input type="date" name="pairedOn" [(ngModel)]="pairedOn" required /></label>
        }
        <label class="field">{{ 'perechi.cuibul_boxa' | t }} <span class="hint">{{ 'perechi.nu_e_obligatoriu' | t }}</span><input name="nest" [(ngModel)]="nest" [placeholder]="'perechi.de_ex_12' | t" /></label>
        @if (formError()) { <div class="error" role="alert">{{ formError() }}</div> }
        <div class="row">
          <button class="primary" type="submit" [disabled]="!cockId || !henId || busy()"><app-icon name="bifa" />{{ 'perechi.salveaza_perechea' | t }}</button>
          <button type="button" (click)="toSeason()">{{ 'actiune.renunta' | t }}</button>
        </div>
      </form>
    }

    @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
    @if (section() === 'sezon') {
    <ul class="pairs">
      @for (p of pairs(); track p.id) {
        <li>
          <a class="card pair" [routerLink]="['/perechi', p.id]">
            <span class="birds">
              <span class="sx sM">{{ 'sex.m' | t }}</span><strong class="mono">{{ ring(p.cock) }}</strong>
              <span class="x">×</span>
              <span class="sx sF">{{ 'sex.f' | t }}</span><strong class="mono">{{ ring(p.hen) }}</strong>
            </span>
            <span class="meta">
              <span class="badge" [class]="'badge st-' + p.status">{{ status(p.status) }}</span>
              @if (p.nest) { <span>{{ 'perechi.cuibul' | t: { n: p.nest } }}</span> }
              @if (p.pairedOn) { <span>{{ 'perechi.din_data' | t: { data: date(p.pairedOn) } }}</span> }
              <span>{{ 'perechi.ponte' | t: { count: p.clutchCount } }} · {{ 'perechi.pui_inelati' | t: { n: p.youngCount } }}</span>
              @if (p.coi > 0) { <span [class.warn]="p.coi >= 0.125">{{ 'perechi.consangvinizare' | t: { procent: pct(p.coi) } }}</span> }
            </span>
            <app-icon name="inainte" />
          </a>
        </li>
      } @empty {
        @if (loaded()) { <p class="muted">{{ 'perechi.nicio_pereche' | t: { sezon: season() } }}</p> }
      }
    </ul>
    }

    @if (section() === 'inele') {
    <section class="card stack series">
      <h2>{{ 'perechi.inelele_mele' | t }}</h2>
      <p class="muted">{{ 'perechi.serii_intro' | t }}</p>
      @for (s of series(); track s.id) {
        <div class="row between">
          <span><strong>{{ s.year }}</strong>: <span class="mono">{{ s.first }}</span> → <span class="mono">{{ s.last }}</span> <span class="muted">{{ 'perechi.n_inele' | t: { n: s.count } }}</span></span>
          <button type="button" class="link" (click)="removeSeries(s)">{{ 'actiune.sterge' | t }}</button>
        </div>
      }
      <form class="row" (ngSubmit)="addSeries()">
        <label class="field grow">{{ 'camp.primul_inel' | t }} <input name="first" [(ngModel)]="first" class="mono" placeholder="RO-26-800540" /></label>
        <label class="field grow">{{ 'camp.ultimul_inel' | t }} <input name="last" [(ngModel)]="last" class="mono" placeholder="RO-26-800589" /></label>
        <button type="submit" class="end" [disabled]="!first.trim() || !last.trim()"><app-icon name="plus" />{{ 'perechi.adauga_seria' | t }}</button>
      </form>
      @if (seriesError()) { <div class="error" role="alert">{{ seriesError() }}</div> }
    </section>
    }
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
  /** Submeniul din banda de sus: ?sec=noua (Pereche nouă), ?sec=inele (Inelele mele); altfel perechile sezonului. */
  readonly sec = input<string>();
  protected readonly section = computed(() => (this.sec() === 'noua' || this.sec() === 'inele' ? this.sec()! : 'sezon'));
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
  protected readonly status = statusLabel;
  protected readonly pct = percent;
  protected readonly date = formatDay;
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
      const noua = this.section() === 'noua';
      untracked(() => (noua ? this.openAdd() : this.adding.set(false)));
    });
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

  /** „Renunță” la perechea nouă: înapoi la perechile sezonului. */
  toSeason() {
    this.router.navigate([], { queryParams: { sec: undefined }, queryParamsHandling: 'merge' });
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
      title: t('perechi.sterge_seria_titlu'),
      lines: [`${s.first} → ${s.last}`, t('perechi.sterge_seria_text')],
      confirmLabel: t('perechi.sterge_seria_da'),
      danger: true,
    });
    if (!ok) return;
    await this.api.delete(`/ring-series/${s.id}`);
    this.series.update((l) => l.filter((x) => x.id !== s.id));
  }
}
