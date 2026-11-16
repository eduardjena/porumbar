import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api';
import { CatalogService } from '../../core/catalog';
import { ConfirmService } from '../../core/confirm';
import { Race, RaceResult } from '../../core/models';
import { Icon } from '../../shared/icon';

/** Formularul, cu aceleași câmpuri ca clasamentul columba.ro (texte, ca să primească și „196,608”). */
interface Form {
  raceId: string;
  date: string;
  releasePlace: string;
  category: string;
  organizer: string;
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
  raceId: '', date: today(), releasePlace: '', category: 'viteza', organizer: '', number: '', releaseTime: '', entered: '',
  place: '', distanceKm: '', arrivalDay: '1', arrivalTime: '', speed: '', fci: '', onPedigree: true,
});
const str = (v: number | string | null | undefined) => (v == null ? '' : String(v));
const ro = (n: number, digits = 2) => n.toLocaleString('ro-RO', { maximumFractionDigits: digits });
/** Un număr de pus înapoi în câmp: fără puncte de mii, cu virgulă („196,608”). */
const plain = (n: number) => String(n).replace('.', ',');
const roDate = (d: string) => d.split('-').reverse().join('.');

/*
 * Rezultatele la concursuri ale porumbelului, introduse de mână (design: docs/superpowers/specs/2026-11-16-rezultate-manual-design.md).
 * Al doilea porumbel din același concurs alege concursul din listă; viteza și coeficientul le calculează programul.
 */
@Component({
  selector: 'app-rezultate',
  imports: [FormsModule, Icon],
  template: `
    <form class="card stack" (ngSubmit)="save()">
      <h3>{{ editing() ? 'Schimbă rezultatul' : 'Adaugă un rezultat' }}</h3>
      @if (races().length) {
        <label class="field">Concursul
          <select name="raceId" [ngModel]="f.raceId" (ngModelChange)="pickRace($event)">
            <option value="">Concurs nou (îl scriu mai jos)</option>
            @for (r of races(); track r.id) { <option [value]="r.id">{{ raceLabel(r) }}</option> }
          </select>
          <span class="hint">Dacă ai trecut deja concursul la alt porumbel, alege-l de aici și nu-l mai scrii o dată.</span>
        </label>
      }
      <fieldset class="stack">
        <legend>Concursul</legend>
        <div class="row">
          <label class="field grow">Data <input type="date" name="date" [(ngModel)]="f.date" required /></label>
          <label class="field grow">Categoria
            <select name="category" [(ngModel)]="f.category">
              @for (c of catalog.catalog()?.raceCategories ?? []; track c.code) { <option [value]="c.code">{{ c.label }}</option> }
            </select>
          </label>
        </div>
        <div class="row">
          <label class="field grow">Locul lansării <input name="releasePlace" [(ngModel)]="f.releasePlace" placeholder="de ex. Yablanița" required /></label>
          <label class="field grow">Organizator (club sau județ) <input name="organizer" [(ngModel)]="f.organizer" placeholder="de ex. Vâlcea" required /></label>
        </div>
        <label class="field">Porumbei angajați (în tot concursul)
          <input name="entered" [(ngModel)]="f.entered" inputmode="numeric" placeholder="de ex. 10023" />
          <span class="hint">Fără el nu se poate calcula coeficientul.</span>
        </label>
      </fieldset>
      <fieldset class="stack">
        <legend>Rezultatul porumbelului</legend>
        <div class="row">
          <label class="field grow">Locul obținut <input name="place" [(ngModel)]="f.place" inputmode="numeric" placeholder="de ex. 1" required /></label>
          <label class="field grow">Distanța (km) <input name="distanceKm" [(ngModel)]="f.distanceKm" inputmode="decimal" placeholder="de ex. 196,608" required /></label>
        </div>
        <label class="check"><input type="checkbox" name="onPedigree" [(ngModel)]="f.onPedigree" /> Apare pe pedigree (fișa tipărită, linkul public, vânzarea)</label>
      </fieldset>
      <details [open]="moreOpen()">
        <summary>Mai multe date din clasament (nu sunt obligatorii)</summary>
        <div class="stack more">
          <div class="row">
            <label class="field grow">Nr. concursului <input name="number" [(ngModel)]="f.number" inputmode="numeric" /></label>
            <label class="field grow">Ora lansării <input type="time" step="1" name="releaseTime" [(ngModel)]="f.releaseTime" /></label>
          </div>
          <div class="row">
            <label class="field grow">Ora sosirii <input type="time" step="1" name="arrivalTime" [(ngModel)]="f.arrivalTime" /></label>
            <label class="field grow">Ziua sosirii
              <select name="arrivalDay" [(ngModel)]="f.arrivalDay">
                <option value="1">Ziua 1 (în ziua lansării)</option><option value="2">Ziua 2</option><option value="3">Ziua 3</option>
              </select>
            </label>
          </div>
          <div class="row">
            <label class="field grow">Viteza (m/min)
              <input name="speed" [(ngModel)]="f.speed" inputmode="decimal" />
              <span class="hint">Se calculează singură din ora lansării, ora sosirii (ziua 1) și distanță.</span>
            </label>
            <label class="field grow">Coeficient FCI <input name="fci" [(ngModel)]="f.fci" inputmode="decimal" /></label>
          </div>
        </div>
      </details>
      @if (formError()) { <div class="error" role="alert"><app-icon name="alerta" />{{ formError() }}</div> }
      <div class="row">
        <button class="primary" type="submit" [disabled]="busy()"><app-icon name="bifa" />{{ editing() ? 'Salvează schimbarea' : 'Adaugă rezultatul' }}</button>
        @if (editing()) { <button type="button" (click)="cancel()">Renunță</button> }
      </div>
    </form>

    @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
    <ul class="results">
      @for (r of results(); track r.id) {
        <li class="card">
          <p class="big"><strong>Locul {{ r.place }}</strong>@if (r.race.entered) { din {{ ro(r.race.entered, 0) }} } · {{ r.race.releasePlace }} · {{ ro(r.distanceM / 1000, 1) }} km</p>
          <p class="muted">
            {{ roDate(r.race.date) }} · {{ catalog.label('raceCategories', r.race.category) }} · {{ r.race.organizer }}@if (r.race.number) { · concursul {{ r.race.number }}}
          </p>
          <p class="muted">
            @if (r.speed) { Viteza {{ ro(r.speed) }} m/min · }@if (r.penalty != null) { Coeficient {{ ro(r.penalty) }} · }@if (r.fci != null) { FCI {{ ro(r.fci) }} · }
            @if (r.onPedigree) { pe pedigree: <span class="mono">{{ r.short }}</span> } @else { nu apare pe pedigree }
          </p>
          <div class="row">
            <button type="button" (click)="edit(r)"><app-icon name="editeaza" />Schimbă</button>
            <button type="button" class="link" (click)="remove(r)">Șterge</button>
          </div>
        </li>
      } @empty {
        @if (loaded()) { <p class="muted">Niciun rezultat încă. Scrie-l mai sus, așa cum apare în clasament.</p> }
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
  readonly moreOpen = computed(() => !!this.editing() && !!(this.editing()!.arrival || this.editing()!.race.releaseTime || this.editing()!.fci != null));
  f: Form = empty();
  protected readonly ro = ro;
  protected readonly roDate = roDate;

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
    return [roDate(r.date), r.releasePlace, this.catalog.label('raceCategories', r.category), r.organizer].join(' · ');
  }

  /** Concursul ales din listă completează câmpurile concursului (rămân de scris doar locul și distanța). */
  pickRace(id: string) {
    this.f.raceId = id;
    const r = this.races().find((x) => String(x.id) === id);
    if (!r) return;
    Object.assign(this.f, {
      date: r.date, releasePlace: r.releasePlace, category: r.category, organizer: r.organizer,
      number: str(r.number), releaseTime: str(r.releaseTime), entered: str(r.entered),
    });
  }

  edit(r: RaceResult) {
    this.editing.set(r);
    this.formError.set('');
    this.f = {
      raceId: String(r.race.id), date: r.race.date, releasePlace: r.race.releasePlace, category: r.race.category, organizer: r.race.organizer,
      number: str(r.race.number), releaseTime: str(r.race.releaseTime), entered: str(r.race.entered),
      place: String(r.place), distanceKm: plain(r.distanceM / 1000), arrivalDay: str(r.arrival?.day ?? 1),
      arrivalTime: str(r.arrival?.time), speed: r.speedEntered == null ? '' : plain(r.speedEntered), fci: str(r.fci), onPedigree: r.onPedigree,
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
        date: f.date, releasePlace: f.releasePlace, category: f.category, organizer: f.organizer,
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
      title: 'Ștergi acest rezultat?',
      lines: [`Locul ${r.place} · ${r.race.releasePlace} · ${roDate(r.race.date)}`, 'Nu se poate da înapoi.'],
      confirmLabel: 'Da, șterge',
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
