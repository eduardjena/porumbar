import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth';
import { CatalogService } from '../../core/catalog';
import { TPipe, formatDay, formatNumber, t } from '../../core/i18n';
import { PigeonSummary, Race } from '../../core/models';
import { Icon } from '../../shared/icon';
import { PastedRow, ownRows, readPasted, ringKeyOf } from '../../shared/clasament';
import { PorumbarState } from '../panou/porumbar-state';

/** Concursul, ca în formularul unui rezultat (texte, ca să primească și „196,608”). */
interface RaceForm {
  raceId: string;
  date: string;
  releasePlace: string;
  category: string;
  organizer: string;
  level: string;
  number: string;
  releaseTime: string;
  entered: string;
}

/** Un rând din clasamentul lipit, legat de porumbelul omului (sau „porumbel nou?”). */
interface PastedPick {
  row: PastedRow;
  pigeon: PigeonSummary | null;
  checked: boolean;
}

const today = () => new Date().toISOString().slice(0, 10);
const emptyRace = (): RaceForm => ({ raceId: '', date: today(), releasePlace: '', category: 'viteza', organizer: '', level: '', number: '', releaseTime: '', entered: '' });
const str = (v: number | string | null | undefined) => (v == null ? '' : String(v));
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const opt = (v: string) => (v.trim() === '' ? null : v.trim());
/** Porumbeii care nu mai zboară nu apar în listă. */
const GONE = new Set(['vandut', 'pierdut', 'mort']);

/*
 * „Rezultatele unui concurs”: toți porumbeii omului la același concurs, deodată. Două drumuri:
 *  - de mână: alege concursul (sau îl scrie o dată), distanța o dată, apoi doar locul la fiecare porumbel;
 *  - lipirea clasamentului: textul copiat de om de pe columba.ro se citește în telefon (shared/clasament.ts) și la
 *    server pleacă doar rândurile lui (după codul de crescător sau după inelele lui).
 * Nu se citește din poză (decizia vânzătorului).
 */
@Component({
  selector: 'app-concurs-rezultate',
  imports: [FormsModule, Icon, TPipe],
  template: `

    @if (done(); as d) {
      <div class="notice" role="status">
        <app-icon name="bifa" />{{ 'concurs.salvate' | t: { count: d.added } }}@if (d.skipped) { {{ 'concurs.deja' | t: { count: d.skipped } }} }
      </div>
    }

    <section class="card stack paste">
      <h2><app-icon name="copie" />{{ 'concurs.lipeste_titlu' | t }}</h2>
      <p class="muted">{{ 'concurs.lipeste_cum' | t }}</p>
      <label class="field">{{ 'concurs.codul_tau' | t }}
        <input class="mono code" name="code" [(ngModel)]="code" autocapitalize="characters" autocomplete="off" spellcheck="false" [placeholder]="'text.de_exemplu' | t: { exemplu: 'VL9001' }" />
        <span class="hint">{{ 'concurs.codul_ajutor' | t }}</span>
      </label>
      <label class="field">{{ 'concurs.textul' | t }}
        <textarea name="pasted" rows="4" [(ngModel)]="pasted" [placeholder]="'concurs.lipeste_aici' | t"></textarea>
      </label>
      <div class="row">
        <button type="button" class="primary" (click)="readPaste()" [disabled]="!pasted.trim()"><app-icon name="cautare" />{{ 'concurs.citeste' | t }}</button>
        @if (picks().length) { <button type="button" class="link" (click)="clearPaste()">{{ 'concurs.renunta_lipire' | t }}</button> }
      </div>
      @if (pasteNote()) { <p class="warning">{{ pasteNote() }}</p> }
    </section>

    <form class="stack" (ngSubmit)="save()">
      <fieldset class="card stack">
        <legend>{{ 'concurs.concursul' | t }}</legend>
        @if (races().length && !picks().length) {
          <label class="field">{{ 'rezultate.concursul' | t }}
            <select name="raceId" [ngModel]="race.raceId" (ngModelChange)="pickRace($event)">
              <option value="">{{ 'rezultate.concurs_nou' | t }}</option>
              @for (r of races(); track r.id) { <option [value]="r.id">{{ raceLabel(r) }}</option> }
            </select>
          </label>
        }
        @if (!race.raceId) {
          <div class="row">
            <label class="field grow">{{ 'camp.data' | t }} <input type="date" name="date" [(ngModel)]="race.date" required /></label>
            <label class="field grow">{{ 'camp.categoria' | t }}
              <select name="category" [(ngModel)]="race.category">
                @for (c of catalog.catalog()?.raceCategories ?? []; track c.code) { <option [value]="c.code">{{ c.label }}</option> }
              </select>
            </label>
          </div>
          <div class="row">
            <label class="field grow">{{ 'camp.locul_lansarii' | t }}
              <input name="releasePlace" [(ngModel)]="race.releasePlace" (ngModelChange)="suggestDistance()" [placeholder]="'rezultate.ex_lansare' | t" required />
            </label>
            <label class="field grow">{{ 'rezultate.organizator' | t }} <input name="organizer" [(ngModel)]="race.organizer" [placeholder]="'rezultate.ex_organizator' | t" required /></label>
          </div>
          <div class="row">
            <label class="field grow">{{ 'camp.clasamentul' | t }}
              <select name="level" [(ngModel)]="race.level">
                <option value="">{{ 'rezultate.clasament_nespus' | t }}</option>
                @for (l of catalog.catalog()?.raceLevels ?? []; track l.code) { <option [value]="l.code">{{ l.label }}</option> }
              </select>
            </label>
            <label class="field grow">{{ 'rezultate.angajati' | t }}
              <input name="entered" [(ngModel)]="race.entered" inputmode="numeric" [placeholder]="'text.de_exemplu' | t: { exemplu: '10023' }" />
            </label>
          </div>
        }
        @if (!picks().length) {
          <label class="field">{{ 'concurs.distanta' | t }}
            <input name="distanceKm" [(ngModel)]="distanceKm" inputmode="decimal" [placeholder]="'text.de_exemplu' | t: { exemplu: '196,608' }" />
            <span class="hint">{{ 'concurs.distanta_ajutor' | t }}</span>
          </label>
        }
      </fieldset>

      @if (picks().length) {
        <section class="card stack">
          <h2>{{ 'concurs.gasite' | t: { count: picks().length } }}</h2>
          <ul class="picks">
            @for (p of picks(); track $index) {
              <li>
                <label class="pick" [class.new]="!p.pigeon">
                  <input type="checkbox" [name]="'pick' + $index" [(ngModel)]="p.checked" />
                  <span>
                    @if (p.pigeon?.name || !p.pigeon) { <strong>{{ p.pigeon ? p.pigeon.name : ('concurs.porumbel_nou' | t) }}</strong> · }
                    <span class="mono">{{ p.row.ring }}</span> ·
                    {{ 'rezultate.locul' | t: { loc: p.row.place } }}@if (enteredNum()) { {{ 'rezultate.din' | t: { numar: formatNumber(enteredNum()!) } }} }
                  </span>
                </label>
              </li>
            }
          </ul>
        </section>
      } @else {
        <section class="card stack">
          <h2>{{ 'concurs.porumbeii_tai' | t }}</h2>
          <label class="field">{{ 'concurs.cauta' | t }}
            <input name="q" [(ngModel)]="q" [placeholder]="'concurs.cauta_ajutor' | t" />
          </label>
          <ul class="places">
            @for (p of shown(); track p.id) {
              <li>
                <span class="who"><span class="mono">{{ p.ring?.display ?? '—' }}</span>@if (p.name) { <strong>{{ p.name }}</strong> }</span>
                <label class="place">{{ 'concurs.locul' | t }}
                  <input [name]="'place' + p.id" inputmode="numeric" pattern="[0-9]*" [ngModel]="places()[p.id] ?? ''" (ngModelChange)="setPlace(p.id, $event)" />
                </label>
              </li>
            } @empty {
              @if (loaded()) { <li class="muted">{{ 'concurs.niciun_porumbel' | t }}</li> }
            }
          </ul>
        </section>
      }

      @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
      <button class="primary big" type="submit" [disabled]="busy() || !toSave()">
        <app-icon name="bifa" />{{ (!toSave() ? 'concurs.salveaza_gol' : picks().length ? 'concurs.adauga_toate' : 'concurs.salveaza') | t: { count: toSave() } }}
      </button>
    </form>
  `,
  styles: `
    h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 1.2rem; }
    fieldset { border: 1px solid var(--border); margin: 0; }
    legend { font-weight: 800; padding: 0 6px; }
    .grow { flex: 1 1 200px; }
    .code { max-width: 14ch; }
    textarea { width: 100%; font-family: inherit; font-size: 1rem; }
    .places, .picks { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; }
    .places li { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-bottom: 1px solid var(--border); }
    .who { display: flex; flex-direction: column; gap: 2px; }
    .place { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    .place input { width: 7ch; min-height: 48px; font-size: 1.2rem; text-align: center; }
    .pick { display: flex; align-items: center; gap: 12px; min-height: 56px; padding: 6px 0; border-bottom: 1px solid var(--border); cursor: pointer; }
    .pick input { width: 26px; height: 26px; flex: none; }
    .pick.new strong { color: var(--accent-strong); }
    .big { min-height: 56px; font-size: 1.1rem; align-self: flex-start; }
  `,
})
export default class ConcursRezultate {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly state = inject(PorumbarState);
  protected readonly catalog = inject(CatalogService);
  protected readonly formatNumber = (n: number) => formatNumber(n);

  readonly races = signal<Race[]>([]);
  readonly pigeons = signal<PigeonSummary[]>([]);
  readonly places = signal<Record<number, string>>({});
  readonly picks = signal<PastedPick[]>([]);
  readonly loaded = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly pasteNote = signal('');
  readonly done = signal<{ added: number; skipped: number } | null>(null);
  race: RaceForm = emptyRace();
  distanceKm = '';
  code = this.auth.account()?.breederCode ?? '';
  pasted = '';
  q = '';

  /** Pe fișa unui porumbel (fila „Introdu rezultat nou”): el apare primul în listă. */
  readonly focusPigeon = input<number | null>(null);
  /** După salvare (fișa porumbelului trece atunci la fila Rezultate). */
  readonly saved = output<void>();
  protected readonly active = computed(() => {
    const list = this.pigeons().filter((p) => p.kind === 'own' && !GONE.has(p.status ?? ''));
    const first = this.focusPigeon();
    return first ? [...list.filter((p) => p.id === first), ...list.filter((p) => p.id !== first)] : list;
  });
  protected enteredNum() {
    return this.race.entered ? Number(this.race.entered) || null : null;
  }
  /** Câte rezultate pleacă la „Salvează”: locurile scrise sau rândurile bifate. */
  protected toSave() {
    return this.picks().length ? this.picks().filter((p) => p.checked).length : Object.values(this.places()).filter((v) => v.trim()).length;
  }

  constructor() {
    this.catalog.load();
    this.load();
  }

  private async load() {
    try {
      const [races, pigeons] = await Promise.all([
        this.api.get<{ races: Race[] }>('/races'),
        this.api.get<{ pigeons: PigeonSummary[] }>('/pigeons?kind=own'),
      ]);
      this.races.set(races.races);
      this.pigeons.set(pigeons.pigeons);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loaded.set(true);
    }
  }

  /** Lista de porumbei, filtrată după ce scrie omul (ultimele cifre ale inelului sau numele). */
  protected shown() {
    const q = fold(this.q);
    if (!q) return this.active();
    return this.active().filter((p) => fold(`${p.ring?.display ?? ''} ${p.ring?.number ?? ''} ${p.name ?? ''}`).includes(q));
  }

  setPlace(id: number, value: string) {
    this.places.update((m) => ({ ...m, [id]: String(value ?? '').replace(/\D/g, '') }));
    this.done.set(null);
  }

  protected raceLabel(r: Race) {
    return [formatDay(r.date), r.releasePlace, this.catalog.label('raceCategories', r.category), r.organizer, r.level ? this.catalog.label('raceLevels', r.level) : null]
      .filter(Boolean)
      .join(' · ');
  }

  pickRace(id: string) {
    const r = this.races().find((x) => String(x.id) === id);
    if (!r) {
      this.race = emptyRace();
      return;
    }
    this.race = {
      raceId: id, date: r.date, releasePlace: r.releasePlace, category: r.category, organizer: r.organizer, level: r.level ?? '',
      number: str(r.number), releaseTime: str(r.releaseTime), entered: str(r.entered),
    };
    if (r.distanceM) this.distanceKm = String(r.distanceM / 1000).replace('.', ',');
  }

  /** Același porumbar, același loc de lansare: distanța de data trecută. */
  suggestDistance() {
    if (this.distanceKm.trim()) return;
    const place = fold(this.race.releasePlace);
    const prev = this.races().find((r) => fold(r.releasePlace) === place && r.distanceM);
    if (prev?.distanceM) this.distanceKm = String(prev.distanceM / 1000).replace('.', ',');
  }

  /** Citește textul lipit în telefon; păstrează doar rândurile omului. */
  async readPaste() {
    this.pasteNote.set('');
    this.done.set(null);
    const parsed = readPasted(this.pasted);
    if (!parsed.rows.length) return this.pasteNote.set(t('concurs.lipire_nimic'));
    const code = this.code.trim().toUpperCase().replace(/\s+/g, '');
    if (code && code !== (this.auth.account()?.breederCode ?? '')) {
      try {
        await this.api.patch('/auth/me', { breederCode: code });
        await this.auth.refresh();
      } catch (e) {
        return this.pasteNote.set(errorMessage(e));
      }
    }
    const byKey = new Map<string, PigeonSummary>();
    for (const p of this.pigeons()) {
      const k = p.ring ? ringKeyOf(p.ring.country, p.ring.year, p.ring.number) : null;
      if (k && !byKey.has(k)) byKey.set(k, p);
    }
    const mine = ownRows(parsed, code || null, new Set(byKey.keys()));
    // Textul lipit nu se mai ține nici în pagină: din el rămân doar rândurile omului.
    this.pasted = '';
    if (!mine.length) return this.pasteNote.set(t(code ? 'concurs.lipire_niciunul' : 'concurs.lipire_fara_cod'));
    const r = parsed.race;
    this.race = {
      ...emptyRace(),
      date: r.date ?? today(), releasePlace: r.releasePlace ?? '', category: r.category ?? 'viteza', organizer: r.organizer ?? '',
      level: r.organizer ? 'filiala' : '', number: str(r.number), releaseTime: str(r.releaseTime), entered: str(r.entered),
    };
    this.picks.set(
      mine.map((row) => {
        const pigeon = byKey.get(ringKeyOf(row.country, row.year, row.number)!) ?? null;
        return { row, pigeon, checked: !!pigeon };
      }),
    );
    if (!r.date || !r.releasePlace || !r.organizer) this.pasteNote.set(t('concurs.lipire_fara_antet'));
  }

  clearPaste() {
    this.picks.set([]);
    this.pasteNote.set('');
    this.race = emptyRace();
  }

  async save() {
    this.error.set('');
    const r = this.race;
    const race = r.raceId
      ? this.races().find((x) => String(x.id) === r.raceId)!
      : { date: r.date, releasePlace: r.releasePlace, category: r.category, organizer: r.organizer, level: opt(r.level), number: opt(r.number), releaseTime: opt(r.releaseTime), entered: opt(r.entered) };
    const picks = this.picks();
    const body = picks.length
      ? {
          race,
          source: 'lipit',
          rows: picks.filter((p) => p.checked).map(({ row, pigeon }) => ({
            ...(pigeon ? { pigeonId: pigeon.id } : { newPigeon: { ring: row.ring, sex: row.sex } }),
            place: row.place,
            distanceKm: row.distanceKm,
            arrival: { day: row.day, time: row.time },
            speed: row.speed,
            fci: row.fci,
          })),
        }
      : {
          race,
          source: 'manual',
          distanceKm: opt(this.distanceKm),
          rows: Object.entries(this.places())
            .filter(([, v]) => v.trim())
            .map(([id, place]) => ({ pigeonId: Number(id), place })),
        };
    this.busy.set(true);
    try {
      const res = await this.api.post<{ added: number; skipped: unknown[] }>('/races/results', body);
      this.done.set({ added: res.added, skipped: res.skipped.length });
      this.places.set({});
      this.picks.set([]);
      this.race = emptyRace();
      this.distanceKm = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      await this.load();
      // Listarea rezultatelor și panoul (ordonarea după rezultate) văd și ce s-a adăugat acum.
      this.state.load();
      this.saved.emit();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
