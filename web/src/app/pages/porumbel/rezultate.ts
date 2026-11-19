import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api';
import { CatalogService } from '../../core/catalog';
import { ConfirmService } from '../../core/confirm';
import { Race, RaceResult } from '../../core/models';
import { Icon } from '../../shared/icon';
import { TPipe, formatDay, formatNumber, t } from '../../core/i18n';

/** Formularul, cu aceleași câmpuri ca clasamentul columba.ro (texte, ca să primească și „196,608”). */
interface Form {
  raceId: string;
  date: string;
  releasePlace: string;
  category: string;
  organizer: string;
  level: string;
  number: string;
  releaseTime: string;
  entered: string;
  place: string;
  distanceKm: string;
  arrivalDay: string;
  arrivalTime: string;
  speed: string;
  fci: string;
  onPedigree: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);
const empty = (): Form => ({
  raceId: '', date: today(), releasePlace: '', category: 'viteza', organizer: '', level: '', number: '', releaseTime: '', entered: '',
  place: '', distanceKm: '', arrivalDay: '1', arrivalTime: '', speed: '', fci: '', onPedigree: true,
});
const str = (v: number | string | null | undefined) => (v == null ? '' : String(v));
const num = (n: number, digits = 2) => formatNumber(n, { maximumFractionDigits: digits });
/** Penalizarea și coeficientul FCI: calculate cu 4 zecimale, arătate cu 2, ca pe foaia Columba („0,10”). */
const dec2 = (n: number) => formatNumber(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Un număr de pus înapoi în câmp: fără puncte de mii, cu virgulă („196,608”). */
const plain = (n: number) => String(n).replace('.', ',');

/*
 * Rezultatele la concursuri ale porumbelului, introduse de mână (design: docs/superpowers/specs/2026-11-16-rezultate-manual-design.md).
 * Al doilea porumbel din același concurs alege concursul din listă; viteza și coeficientul le calculează programul.
 */
@Component({
  selector: 'app-rezultate',
  imports: [FormsModule, Icon, TPipe],
  template: `
    <form class="card stack" (ngSubmit)="save()">
      <h3>{{ (editing() ? 'rezultate.schimba_titlu' : 'rezultate.adauga_titlu') | t }}</h3>
      @if (races().length) {
        <label class="field">{{ 'rezultate.concursul' | t }}
          <select name="raceId" [ngModel]="f.raceId" (ngModelChange)="pickRace($event)">
            <option value="">{{ 'rezultate.concurs_nou' | t }}</option>
            @for (r of races(); track r.id) { <option [value]="r.id">{{ raceLabel(r) }}</option> }
          </select>
          <span class="hint">{{ 'rezultate.concurs_ales_ajutor' | t }}</span>
        </label>
      }
      <fieldset class="stack">
        <legend>{{ 'rezultate.concursul' | t }}</legend>
        <div class="row">
          <label class="field grow">{{ 'camp.data' | t }} <input type="date" name="date" [(ngModel)]="f.date" required /></label>
          <label class="field grow">{{ 'camp.categoria' | t }}
            <select name="category" [(ngModel)]="f.category">
              @for (c of catalog.catalog()?.raceCategories ?? []; track c.code) { <option [value]="c.code">{{ c.label }}</option> }
            </select>
          </label>
        </div>
        <div class="row">
          <label class="field grow">{{ 'camp.locul_lansarii' | t }} <input name="releasePlace" [(ngModel)]="f.releasePlace" [placeholder]="'rezultate.ex_lansare' | t" required /></label>
          <label class="field grow">{{ 'rezultate.organizator' | t }} <input name="organizer" [(ngModel)]="f.organizer" [placeholder]="'rezultate.ex_organizator' | t" required /></label>
        </div>
        <label class="field">{{ 'camp.clasamentul' | t }}
          <select name="level" [(ngModel)]="f.level">
            <option value="">{{ 'rezultate.clasament_nespus' | t }}</option>
            @for (l of catalog.catalog()?.raceLevels ?? []; track l.code) { <option [value]="l.code">{{ l.label }}</option> }
          </select>
          <span class="hint">{{ 'rezultate.clasament_ajutor' | t }}</span>
        </label>
        <label class="field">{{ 'rezultate.angajati' | t }}
          <input name="entered" [(ngModel)]="f.entered" inputmode="numeric" [placeholder]="'text.de_exemplu' | t: { exemplu: '10023' }" />
          <span class="hint">{{ 'rezultate.angajati_ajutor' | t }}</span>
        </label>
      </fieldset>
      <fieldset class="stack">
        <legend>{{ 'rezultate.rezultatul_porumbelului' | t }}</legend>
        <div class="row">
          <label class="field grow">{{ 'rezultate.locul_obtinut' | t }} <input name="place" [(ngModel)]="f.place" inputmode="numeric" [placeholder]="'text.de_exemplu' | t: { exemplu: '1' }" required /></label>
          <label class="field grow">{{ 'camp.distanta_km' | t }} <input name="distanceKm" [(ngModel)]="f.distanceKm" inputmode="decimal" [placeholder]="'text.de_exemplu' | t: { exemplu: '196,608' }" required /></label>
        </div>
        <label class="check"><input type="checkbox" name="onPedigree" [(ngModel)]="f.onPedigree" /> {{ 'rezultate.apare_pe_pedigree' | t }}</label>
      </fieldset>
      <details [open]="moreOpen()">
        <summary>{{ 'rezultate.mai_multe_date' | t }}</summary>
        <div class="stack more">
          <div class="row">
            <label class="field grow">{{ 'camp.nr_concurs' | t }} <input name="number" [(ngModel)]="f.number" inputmode="numeric" /></label>
            <label class="field grow">{{ 'camp.ora_lansarii' | t }} <input type="time" step="1" name="releaseTime" [(ngModel)]="f.releaseTime" /></label>
          </div>
          <div class="row">
            <label class="field grow">{{ 'camp.ora_sosirii' | t }} <input type="time" step="1" name="arrivalTime" [(ngModel)]="f.arrivalTime" /></label>
            <label class="field grow">{{ 'camp.ziua_sosirii' | t }}
              <select name="arrivalDay" [(ngModel)]="f.arrivalDay">
                <option value="1">{{ 'rezultate.ziua_1' | t }}</option>
                @for (z of laterDays; track z) { <option [value]="z">{{ 'rezultate.ziua' | t: { zi: z } }}</option> }
              </select>
            </label>
          </div>
          <div class="row">
            <label class="field grow">{{ 'camp.viteza' | t }}
              <input name="speed" [(ngModel)]="f.speed" inputmode="decimal" />
              <span class="hint">{{ (f.arrivalTime && +f.arrivalDay >= 2 ? 'rezultate.viteza_din_clasament' : 'rezultate.viteza_ajutor') | t }}</span>
            </label>
            <label class="field grow">{{ 'camp.coeficient' | t }} <input name="fci" [(ngModel)]="f.fci" inputmode="decimal" /></label>
          </div>
        </div>
      </details>
      @if (formError()) { <div class="error" role="alert"><app-icon name="alerta" />{{ formError() }}</div> }
      <div class="row">
        <button class="primary" type="submit" [disabled]="busy()"><app-icon name="bifa" />{{ (editing() ? 'rezultate.salveaza_schimbarea' : 'rezultate.adauga_rezultatul') | t }}</button>
        @if (editing()) { <button type="button" (click)="cancel()">{{ 'actiune.renunta' | t }}</button> }
      </div>
    </form>

    @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
    <ul class="results">
      @for (r of results(); track r.id) {
        <li class="card">
          <p class="big"><strong>{{ 'rezultate.locul' | t: { loc: r.place } }}</strong>@if (r.race.entered) { {{ 'rezultate.din' | t: { numar: num(r.race.entered, 0) } }} } · {{ r.race.releasePlace }} · {{ num(r.distanceM / 1000, 1) }} km
            @if (r.prized) { <span class="prized">{{ 'rezultate.premiat' | t }}</span> }</p>
          <p class="muted">
            {{ day(r.race.date) }} · {{ catalog.label('raceCategories', r.race.category) }} · {{ r.race.organizer }}@if (r.race.level) { · {{ catalog.label('raceLevels', r.race.level) }} }@if (r.race.number) { · {{ 'rezultate.concursul_nr' | t: { nr: r.race.number } }}}
          </p>
          <p class="muted">
            @if (r.speed) { {{ 'rezultate.viteza' | t: { viteza: num(r.speed) } }} · } @else if (r.speedFromSheet) { {{ 'rezultate.viteza_lipsa' | t }} · }@if (r.penalty != null) { {{ 'rezultate.coeficient' | t: { coef: dec2(r.penalty) } }} · }@if (r.fci != null) { FCI {{ dec2(r.fci) }} · }
            @if (r.onPedigree) { {{ 'rezultate.pe_pedigree' | t }} <span class="mono">{{ r.short }}</span> } @else { {{ 'rezultate.nu_pe_pedigree' | t }} }
          </p>
          <div class="row">
            <button type="button" (click)="edit(r)"><app-icon name="editeaza" />{{ 'actiune.schimba' | t }}</button>
            <button type="button" class="link" (click)="remove(r)">{{ 'actiune.sterge' | t }}</button>
          </div>
        </li>
      } @empty {
        @if (loaded()) { <p class="muted">{{ 'rezultate.niciunul' | t }}</p> }
      }
    </ul>
  `,
  styles: `
    h3 { margin: 0; }
    fieldset { border: 1px solid var(--border); border-radius: 14px; padding: 12px 14px 14px; margin: 0; }
    legend { font-weight: 800; padding: 0 6px; }
    .grow { flex: 1 1 200px; }
    .check { display: flex; align-items: center; gap: 10px; font-weight: 600; min-height: 48px; }
    .check input { width: 24px; height: 24px; }
    details summary { cursor: pointer; font-weight: 700; min-height: 48px; display: flex; align-items: center; color: var(--accent-strong); }
    .more { padding-top: 8px; }
    .results { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 10px; margin-top: 18px; }
    .results p { margin: 0 0 4px; }
    .big { font-size: 1.15rem; }
    .prized { display: inline-block; margin-left: 6px; padding: 2px 10px; border-radius: 999px; font-size: 0.85rem; font-weight: 800; background: var(--ok-soft); color: var(--ok); }
  `,
})
export class Rezultate {
  private readonly api = inject(Api);
  private readonly confirm = inject(ConfirmService);
  protected readonly catalog = inject(CatalogService);
  readonly pigeonId = input.required<number>();
  readonly results = signal<RaceResult[]>([]);
  readonly races = signal<Race[]>([]);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly formError = signal('');
  readonly busy = signal(false);
  readonly editing = signal<RaceResult | null>(null);
  readonly moreOpen = computed(() => !!this.editing() && !!(this.editing()!.arrival || this.editing()!.race.releaseTime || this.editing()!.fciEntered != null));
  f: Form = empty();
  protected readonly num = num;
  protected readonly dec2 = dec2;
  protected readonly laterDays = [2, 3, 4, 5, 6, 7];
  protected readonly day = formatDay;

  constructor() {
    this.catalog.load();
    effect(() => {
      const id = this.pigeonId();
      untracked(() => this.load(id));
    });
  }

  private async load(id: number) {
    try {
      const [res, races] = await Promise.all([
        this.api.get<{ results: RaceResult[] }>(`/pigeons/${id}/results`),
        this.api.get<{ races: Race[] }>('/races'),
      ]);
      this.results.set(res.results);
      this.races.set(races.races);
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loaded.set(true);
    }
  }

  protected raceLabel(r: Race) {
    return [formatDay(r.date), r.releasePlace, this.catalog.label('raceCategories', r.category), r.organizer, r.level ? this.catalog.label('raceLevels', r.level) : null]
      .filter(Boolean)
      .join(' · ');
  }

  /** Concursul ales din listă completează câmpurile concursului (rămân de scris doar locul și distanța). */
  pickRace(id: string) {
    this.f.raceId = id;
    const r = this.races().find((x) => String(x.id) === id);
    if (!r) return;
    Object.assign(this.f, {
      date: r.date, releasePlace: r.releasePlace, category: r.category, organizer: r.organizer, level: r.level ?? '',
      number: str(r.number), releaseTime: str(r.releaseTime), entered: str(r.entered),
    });
  }

  edit(r: RaceResult) {
    this.editing.set(r);
    this.formError.set('');
    this.f = {
      raceId: String(r.race.id), date: r.race.date, releasePlace: r.race.releasePlace, category: r.race.category, organizer: r.race.organizer, level: r.race.level ?? '',
      number: str(r.race.number), releaseTime: str(r.race.releaseTime), entered: str(r.race.entered),
      place: String(r.place), distanceKm: plain(r.distanceM / 1000), arrivalDay: str(r.arrival?.day ?? 1),
      arrivalTime: str(r.arrival?.time), speed: r.speedEntered == null ? '' : plain(r.speedEntered), fci: r.fciEntered == null ? '' : plain(r.fciEntered), onPedigree: r.onPedigree,
    };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancel() {
    this.editing.set(null);
    this.formError.set('');
    this.f = empty();
  }

  async save() {
    this.formError.set('');
    const f = this.f;
    const opt = (v: string) => (v.trim() === '' ? null : v.trim());
    const body = {
      race: {
        date: f.date, releasePlace: f.releasePlace, category: f.category, organizer: f.organizer, level: opt(f.level),
        number: opt(f.number), releaseTime: opt(f.releaseTime), entered: opt(f.entered),
      },
      place: opt(f.place),
      distanceKm: opt(f.distanceKm),
      arrival: f.arrivalTime ? { day: Number(f.arrivalDay), time: f.arrivalTime } : null,
      speed: opt(f.speed),
      fci: opt(f.fci),
      onPedigree: f.onPedigree,
    };
    this.busy.set(true);
    try {
      const editing = this.editing();
      if (editing) await this.api.patch(`/results/${editing.id}`, body);
      else await this.api.post(`/pigeons/${this.pigeonId()}/results`, body);
      this.editing.set(null);
      this.f = empty();
      await this.load(this.pigeonId());
    } catch (e) {
      this.formError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async remove(r: RaceResult) {
    const ok = await this.confirm.ask({
      title: t('rezultate.sterge_titlu'),
      lines: [`${t('rezultate.locul', { loc: r.place })} · ${r.race.releasePlace} · ${formatDay(r.race.date)}`, t('text.nu_se_poate_da_inapoi')],
      confirmLabel: t('actiune.da_sterge'),
      danger: true,
    });
    if (!ok) return;
    try {
      await this.api.delete(`/results/${r.id}`);
      if (this.editing()?.id === r.id) this.cancel();
      this.results.update((list) => list.filter((x) => x.id !== r.id));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
