import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api';
import { CatalogService } from '../../core/catalog';
import { ConfirmService } from '../../core/confirm';
import { Race, RaceResult } from '../../core/models';
import { Icon } from '../../shared/icon';
import { TPipe, formatDay, t } from '../../core/i18n';
import { DateField } from '../../shared/date-field';

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
/** Un număr de pus înapoi în câmp: fără puncte de mii, cu virgulă („196,608”). */
const plain = (n: number) => String(n).replace('.', ',');

/*
 * Schimbarea unui rezultat la concurs (deschisă din tabelul de rezultate: fila Rezultate a porumbelului sau
 * Rezultate concurs → Listare rezultate). Aceleași câmpuri ca clasamentul; viteza și coeficientul le calculează
 * programul. Rezultatele noi se pun din „Introdu rezultat nou”. Gata = `done` ('salvat' | 'sters' | 'renuntat').
 */
@Component({
  selector: 'app-rezultat-editor',
  imports: [DateField, FormsModule, Icon, TPipe],
  template: `
    <form class="card stack editor" (ngSubmit)="save()">
      <h3>{{ 'rezultate.schimba_titlu' | t }}</h3>
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
          <label class="field grow">{{ 'camp.data' | t }} <app-date name="date" [(ngModel)]="f.date" required /></label>
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
      <div class="row buttons">
        <button class="primary" type="submit" [disabled]="busy()"><app-icon name="bifa" />{{ 'rezultate.salveaza_schimbarea' | t }}</button>
        <button type="button" (click)="cancel()" [disabled]="busy()">{{ 'actiune.renunta' | t }}</button>
        <button type="button" class="danger" (click)="remove()" [disabled]="busy()"><app-icon name="sterge" />{{ 'rezultate.sterge_rezultatul' | t }}</button>
      </div>
    </form>

  `,
  styles: `
    h3 { margin: 0; }
    .editor { border: 1px solid var(--accent); background: var(--accent-soft); margin-bottom: 14px; }
    .buttons { gap: 10px; }
    .buttons > * { flex: 1 1 150px; }
    fieldset { border: 1px solid var(--border); border-radius: 14px; padding: 12px 14px 14px; margin: 0; }
    legend { font-weight: 800; padding: 0 6px; }
    .grow { flex: 1 1 200px; }
    .check { display: flex; align-items: center; gap: 10px; font-weight: 600; min-height: 48px; }
    .check input { width: 24px; height: 24px; }
    details summary { cursor: pointer; font-weight: 700; min-height: 48px; display: flex; align-items: center; color: var(--accent-strong); }
    .more { padding-top: 8px; }
  `,
})
export class RezultatEditor {
  private readonly api = inject(Api);
  private readonly confirm = inject(ConfirmService);
  protected readonly catalog = inject(CatalogService);
  /** Rezultatul de schimbat. */
  readonly result = input.required<RaceResult>();
  readonly done = output<'salvat' | 'sters' | 'renuntat'>();
  readonly races = signal<Race[]>([]);
  readonly formError = signal('');
  readonly busy = signal(false);
  readonly moreOpen = computed(() => !!(this.result().arrival || this.result().race.releaseTime || this.result().fciEntered != null));
  f: Form = empty();
  protected readonly laterDays = [2, 3, 4, 5, 6, 7];

  constructor() {
    this.catalog.load();
    this.api.get<{ races: Race[] }>('/races').then((r) => this.races.set(r.races)).catch(() => undefined);
    effect(() => {
      const r = this.result();
      untracked(() => this.fill(r));
    });
  }

  protected raceLabel(r: Race) {
    return [formatDay(r.date), r.releasePlace, this.catalog.label('raceCategories', r.category), r.organizer, r.level ? this.catalog.label('raceLevels', r.level) : null]
      .filter(Boolean)
      .join(' · ');
  }

  /** Concursul ales din listă completează câmpurile concursului. */
  pickRace(id: string) {
    this.f.raceId = id;
    const r = this.races().find((x) => String(x.id) === id);
    if (!r) return;
    Object.assign(this.f, {
      date: r.date, releasePlace: r.releasePlace, category: r.category, organizer: r.organizer, level: r.level ?? '',
      number: str(r.number), releaseTime: str(r.releaseTime), entered: str(r.entered),
    });
  }

  private fill(r: RaceResult) {
    this.formError.set('');
    this.f = {
      raceId: String(r.race.id), date: r.race.date, releasePlace: r.race.releasePlace, category: r.race.category, organizer: r.race.organizer, level: r.race.level ?? '',
      number: str(r.race.number), releaseTime: str(r.race.releaseTime), entered: str(r.race.entered),
      place: String(r.place), distanceKm: plain(r.distanceM / 1000), arrivalDay: str(r.arrival?.day ?? 1),
      arrivalTime: str(r.arrival?.time), speed: r.speedEntered == null ? '' : plain(r.speedEntered), fci: r.fciEntered == null ? '' : plain(r.fciEntered), onPedigree: r.onPedigree,
    };
  }

  cancel() {
    this.done.emit('renuntat');
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
      await this.api.patch(`/results/${this.result().id}`, body);
      this.done.emit('salvat');
    } catch (e) {
      this.formError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async remove() {
    const r = this.result();
    const ok = await this.confirm.ask({
      title: t('rezultate.sterge_titlu'),
      lines: [`${t('rezultate.locul', { loc: r.place })} · ${r.race.releasePlace} · ${formatDay(r.race.date)}`, t('text.nu_se_poate_da_inapoi')],
      confirmLabel: t('actiune.da_sterge'),
      danger: true,
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      await this.api.delete(`/results/${r.id}`);
      this.done.emit('sters');
    } catch (e) {
      this.formError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
