import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CatalogService } from '../../core/catalog';
import { ConfirmService, changes } from '../../core/confirm';
import { TPipe, formatDay, t } from '../../core/i18n';
import { PigeonSummary, Treatment, TreatmentPigeon, TreatmentRepeat } from '../../core/models';
import { Breadcrumbs, Crumb } from '../../shared/breadcrumbs';
import { DateField } from '../../shared/date-field';
import { Icon } from '../../shared/icon';
import { addDays, nextStart, repeatText, todayIso } from './tratament-text';

type Target = Treatment['target'];
type RepeatChoice = 'nu' | 'zile' | 'an';
/** „Altul…”: numele îl scrie omul. */
const OTHER = '__altul';
/** Porumbeii care nu mai sunt în porumbar nu se aleg la „Aleg eu”. */
const GONE = ['vandut', 'pierdut', 'mort'];

/** Un număr întreg scris în câmp, sau null. */
const intOf = (v: string) => (/^\s*\d+\s*$/.test(v) ? Number(v) : null);
const between = (n: number | null, min: number, max: number) => n != null && n >= min && n <= max;
/** Pentru căutare: fără spații, liniuțe și bare, cu litere mici. */
const squash = (s: string) => s.toLowerCase().replace(/[\s/-]+/g, '');

/*
 * Fișa „Tratament nou” și „Modifică tratamentul” (aceeași): Ce dai, Fel, Cui (cu numărul de porumbei), Cum, Începe,
 * Câte zile (cu ziua de sfârșit), Se repetă și Notă. Obligatorii sunt doar „Ce dai”, „Cui” (cu porumbei) și „Începe”.
 */
@Component({
  selector: 'app-tratament-form',
  imports: [FormsModule, RouterLink, DateField, Icon, TPipe, Breadcrumbs],
  template: `
    <app-breadcrumbs [items]="crumbs()" />
    <h1>{{ (id() ? 'tratamente.modifica_titlu' : 'tratamente.nou') | t }}</h1>
    @if (loadError()) { <div class="error" role="alert"><app-icon name="alerta" />{{ loadError() }}</div> }

    @if (orig()?.status === 'anulat') {
      <div class="notice" role="status">{{ 'tratamente.oprit_nu_se_modifica' | t }}</div>
      <a class="btn" [routerLink]="['/tratamente', id()]">{{ 'tratamente.vezi_tratamentul' | t }}</a>
    } @else if (ready()) {
      <form class="card stack" (ngSubmit)="save()">
        <label class="field">{{ 'tratamente.ce_dai' | t }}
          <select name="choice" [ngModel]="choice()" (ngModelChange)="choice.set($event)" required>
            <option value="" disabled>{{ 'tratamente.alege_din_lista' | t }}</option>
            @for (s of catalog.catalog()?.treatmentSuggestions ?? []; track s.code) { <option [value]="s.code">{{ s.label }}</option> }
            <option [value]="other">{{ 'tratamente.altul' | t }}</option>
          </select>
        </label>
        @if (choice() === other) {
          <label class="field">{{ 'tratamente.scrie_ce_dai' | t }}
            <input name="other" [value]="otherName()" (input)="otherName.set($any($event.target).value)" maxlength="100"
                   [placeholder]="'tratamente.exemplu_nume' | t" autocomplete="off" />
          </label>
        }

        <fieldset>
          <legend>{{ 'tratamente.fel' | t }}</legend>
          <div class="choices two">
            @for (k of kinds; track k) {
              <label class="choice">
                <input type="radio" name="kind" [checked]="kind() === k" (change)="kind.set(k)" />
                <app-icon [name]="k" [size]="24" />{{ catalog.label('journalTypes', k) }}
              </label>
            }
          </div>
        </fieldset>

        <fieldset>
          <legend>{{ 'tratamente.cui' | t }}</legend>
          <div class="choices targets">
            @for (c of catalog.catalog()?.treatmentTargets ?? []; track c.code) {
              <label class="choice">
                <input type="radio" name="target" [checked]="target() === c.code" (change)="target.set($any(c.code))" />
                {{ c.code === 'alesi' ? ('tratamente.aleg_eu' | t) : c.label }}
              </label>
            }
          </div>
          @if (target() === 'alesi') {
            <p class="count">{{ 'tratamente.alesi_n' | t: { count: chosen().size } }}</p>
          } @else if (keepsList()) {
            <p class="count">{{ 'tratamente.n_porumbei' | t: { count: orig()!.count } }}</p>
          } @else if (groupCount() === 0) {
            <div class="warning" role="status"><app-icon name="alerta" />{{ 'eroare.grup_fara_porumbei' | t }}</div>
          } @else if (groupCount() != null) {
            <p class="count">{{ 'tratamente.n_porumbei' | t: { count: groupCount() } }}</p>
          }
        </fieldset>

        @if (target() === 'alesi') {
          <div class="picker stack">
            <label class="field">{{ 'tratamente.cauta_porumbei' | t }}
              <input name="search" [value]="search()" (input)="search.set($any($event.target).value)" autocomplete="off" spellcheck="false" />
            </label>
            @if (!pigeonsLoaded()) {
              <p class="muted">{{ 'perechi.se_incarca' | t }}</p>
            } @else if (!candidates().length) {
              <p class="muted">{{ 'tratamente.fara_porumbei_vii' | t }}</p>
            } @else {
              <ul class="checks">
                @for (p of shown(); track p.id) {
                  <li>
                    <label class="check pick">
                      <input type="checkbox" [checked]="chosen().has(p.id)" (change)="toggle(p.id)" />
                      <span class="mono">{{ ringOf(p) }}</span>
                      @if (p.name) { <span>{{ p.name }}</span> }
                      @if (p.status) { <span class="muted">{{ catalog.label('statuses', p.status) }}</span> }
                    </label>
                  </li>
                } @empty { <li class="muted">{{ 'tratamente.niciun_porumbel_gasit' | t }}</li> }
              </ul>
            }
          </div>
        }

        <fieldset>
          <legend>{{ 'tratamente.cum' | t }}</legend>
          <div class="choices methods">
            @for (m of catalog.catalog()?.treatmentMethods ?? []; track m.code) {
              <label class="choice">
                <input type="radio" name="method" [checked]="method() === m.code" (change)="method.set(m.code)" />{{ m.label }}
              </label>
            }
          </div>
        </fieldset>

        <div class="row dates">
          <label class="field grow">{{ 'tratamente.incepe' | t }}
            <app-date name="start" [ngModel]="startDate()" (ngModelChange)="startDate.set($event ?? '')" required />
          </label>
          <label class="field days">{{ 'tratamente.cate_zile' | t }} <span class="hint">{{ 'tratamente.zile_interval' | t }}</span>
            <input name="days" type="number" inputmode="numeric" min="1" max="60" [value]="daysText()" (input)="daysText.set($any($event.target).value)" />
          </label>
        </div>
        @if (!daysOk() && daysText().trim()) {
          <div class="error" role="alert">{{ 'tratamente.zile_gresit' | t }}</div>
        } @else if (endDate(); as end) {
          <p class="count">{{ days() === 1 ? ('tratamente.o_zi' | t: { data: day(end) }) : ('tratamente.se_termina' | t: { data: day(end) }) }}</p>
        }

        <fieldset>
          <legend>{{ 'tratamente.se_repeta' | t }}</legend>
          <div class="choices repeats">
            <label class="choice"><input type="radio" name="repeat" [checked]="repeatKind() === 'nu'" (change)="repeatKind.set('nu')" />{{ 'tratamente.repeta_nu' | t }}</label>
            <label class="choice"><input type="radio" name="repeat" [checked]="repeatKind() === 'zile'" (change)="repeatKind.set('zile')" />{{ 'tratamente.repeta_dupa_zile' | t }}</label>
            <label class="choice"><input type="radio" name="repeat" [checked]="repeatKind() === 'an'" (change)="repeatKind.set('an')" />{{ 'tratamente.repeta_an' | t }}</label>
          </div>
          @if (repeatKind() === 'zile') {
            <label class="field days">{{ 'tratamente.peste_cate_zile' | t }} <span class="hint">{{ 'tratamente.repetare_interval' | t }}</span>
              <input name="repeatDays" type="number" inputmode="numeric" min="1" max="365" [value]="repeatDaysText()" (input)="repeatDaysText.set($any($event.target).value)" />
            </label>
            @if (!repeatOk() && repeatDaysText().trim()) { <div class="error" role="alert">{{ 'tratamente.repetare_gresita' | t }}</div> }
          }
          @if (nextDate(); as n) { <p class="count">{{ 'tratamente.urmatorul_pe' | t: { data: day(n) } }}</p> }
        </fieldset>

        <label class="field">{{ 'camp.nota' | t }} <span class="hint">{{ 'tratamente.nota_hint' | t }}</span>
          <textarea name="note" [value]="note()" (input)="note.set($any($event.target).value)" maxlength="1000"></textarea>
        </label>

        @if (saveError()) { <div class="error" role="alert">{{ saveError() }}</div> }
        <div class="row">
          <button class="primary" type="submit" [disabled]="!valid() || busy()"><app-icon name="bifa" />{{ 'tratamente.salveaza' | t }}</button>
          <a class="btn" [routerLink]="id() ? ['/tratamente', id()] : ['/tratamente']">{{ 'actiune.renunta' | t }}</a>
        </div>
      </form>
    }
  `,
  styles: `
    form { max-width: 760px; }
    fieldset { border: 0; padding: 0; margin: 0; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
    legend { font-weight: 700; padding: 0; margin-bottom: 6px; }
    /*
     * Rândurile de alegeri se rup singure pe ecran îngust: fiecare carte cere cel puțin lățimea ei (dar niciodată mai mult
     * decât rândul, min(100%, …)), deci pe telefon trec una sub alta în loc să iasă din ecran (Fel la 375px ieșea cu 5px).
     */
    .choices { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 170px), 1fr)); }
    .choices.two { grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); }
    .choices.methods { grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr)); }
    .choice {
      display: flex; align-items: center; gap: 10px; min-height: 56px; min-width: 0; padding: 8px 14px; cursor: pointer; font-weight: 600; overflow-wrap: anywhere;
      border: 1.5px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface);
    }
    .choice:has(input:checked) { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-strong); box-shadow: 0 0 0 1px var(--accent) inset; }
    .choice:has(input:focus-visible) { outline: 3px solid var(--accent); outline-offset: 2px; }
    .count { margin: 0; font-weight: 700; }
    .picker { border: 2px dashed var(--border); border-radius: var(--radius); padding: 12px; }
    .checks { list-style: none; padding: 0; margin: 0; max-height: 420px; overflow-y: auto; display: flex; flex-direction: column; }
    .checks li + li { border-top: 1px solid var(--border); }
    .pick { flex-wrap: wrap; gap: 4px 12px; padding: 4px 2px; }
    .dates { align-items: flex-start; }
    .grow { flex: 1 1 220px; }
    .days { flex: 0 1 200px; }
    .days input { max-width: 200px; }
    @media (max-width: 767px) {
      .days { flex: 1 1 100%; }
      .row > button, .row > .btn { flex: 1 1 100%; }
    }
  `,
})
export default class TratamentForm {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  protected readonly catalog = inject(CatalogService);
  /** Lipsește la „Tratament nou”; la „Modifică” e tratamentul din adresă. */
  readonly id = input<string>();

  protected readonly other = OTHER;
  protected readonly kinds = ['tratament', 'vaccin'] as const;
  protected readonly day = formatDay;

  /** Tratamentul de dinainte (doar la Modifică). */
  protected readonly orig = signal<Treatment | null>(null);
  private origPigeons: TreatmentPigeon[] = [];
  protected readonly ready = signal(false);
  protected readonly loadError = signal('');
  protected readonly saveError = signal('');
  protected readonly busy = signal(false);

  protected readonly choice = signal('');
  protected readonly otherName = signal('');
  protected readonly kind = signal<'tratament' | 'vaccin'>('tratament');
  protected readonly target = signal<Target>('toti');
  protected readonly method = signal('apa');
  protected readonly startDate = signal(todayIso());
  protected readonly daysText = signal('1');
  protected readonly repeatKind = signal<RepeatChoice>('nu');
  protected readonly repeatDaysText = signal('');
  protected readonly note = signal('');
  protected readonly chosen = signal<Set<number>>(new Set());
  protected readonly search = signal('');

  /** Câți porumbei are acum grupul ales (null = se socotește). */
  protected readonly groupCount = signal<number | null>(null);
  private countAsk = 0;
  /** Porumbeii proprii din porumbar, pentru „Aleg eu” (aduși prima dată când e ales). */
  private readonly ownPigeons = signal<PigeonSummary[]>([]);
  protected readonly pigeonsLoaded = signal(false);
  private pigeonsAsked = false;

  protected readonly name = computed(() => (this.choice() === OTHER ? this.otherName().trim() : this.choice()));
  protected readonly days = computed(() => intOf(this.daysText()));
  protected readonly daysOk = computed(() => between(this.days(), 1, 60));
  protected readonly repeatDays = computed(() => intOf(this.repeatDaysText()));
  protected readonly repeatOk = computed(() => this.repeatKind() !== 'zile' || between(this.repeatDays(), 1, 365));
  protected readonly repeat = computed<TreatmentRepeat | null>(() => {
    const k = this.repeatKind();
    if (k === 'an') return { kind: 'an' };
    return k === 'zile' && this.repeatOk() ? { kind: 'zile', days: this.repeatDays()! } : null;
  });
  protected readonly endDate = computed(() => (this.startDate() && this.daysOk() ? addDays(this.startDate(), this.days()! - 1) : null));
  protected readonly nextDate = computed(() => (this.startDate() ? nextStart(this.startDate(), this.repeat()) : null));

  /**
   * La Modifică, un tratament început își păstrează lista fixată cât timp ținta rămâne aceeași și nu e mutat în viitor:
   * atunci contează porumbeii lui, nu grupul de acum.
   */
  protected readonly keepsList = computed(() => {
    const o = this.orig();
    return !!o && o.status !== 'urmeaza' && o.target !== 'alesi' && this.target() === o.target && !!this.startDate() && this.startDate() <= todayIso();
  });

  /** La „Aleg eu”: porumbeii proprii vii, plus cei deja în tratament (rămân, chiar dacă între timp au plecat). */
  protected readonly candidates = computed(() => {
    const own = this.ownPigeons().filter((p) => p.kind === 'own' && !GONE.includes(p.status ?? ''));
    const have = new Set(own.map((p) => p.id));
    const extra = this.origPigeons.filter((p) => this.orig()?.target === 'alesi' && !have.has(p.id));
    return [...own.map((p) => ({ id: p.id, ring: p.ring, name: p.name, status: p.status })), ...extra].sort((a, b) => this.ringOf(a).localeCompare(this.ringOf(b)));
  });
  protected readonly shown = computed(() => {
    const q = squash(this.search().trim());
    if (!q) return this.candidates();
    return this.candidates().filter((p) => squash(`${p.ring?.display ?? ''}${p.ring?.raw ?? ''}${p.name ?? ''}`).includes(q));
  });

  protected readonly valid = computed(() => {
    const pigeonsOk = this.target() === 'alesi' ? this.chosen().size > 0 : this.keepsList() || this.groupCount() !== 0;
    return !!this.name() && pigeonsOk && !!this.startDate() && this.daysOk() && this.repeatOk();
  });

  protected readonly crumbs = computed<Crumb[]>(() => {
    const list: Crumb = { label: t('meniu.tratamente'), link: ['/tratamente'] };
    const o = this.orig();
    return o ? [list, { label: o.label, link: ['/tratamente', o.id] }, { label: t('tratamente.modifica') }] : [list, { label: t('tratamente.nou') }];
  });

  protected readonly ringOf = (p: Pick<TreatmentPigeon, 'ring'>) => p.ring?.display ?? t('text.fara_inel_mare');

  constructor() {
    this.catalog.load();
    effect(() => {
      const id = this.id();
      untracked(() => this.init(id));
    });
    // Numărul de porumbei al grupului ales; la „Aleg eu”, lista porumbeilor.
    effect(() => {
      const target = this.target();
      if (!this.ready()) return;
      untracked(() => {
        if (target === 'alesi') this.loadPigeons();
        else this.countGroup(target);
      });
    });
  }

  private async init(id: string | undefined) {
    this.ready.set(false);
    if (!id) {
      this.ready.set(true);
      return;
    }
    try {
      const [r] = await Promise.all([
        this.api.get<{ treatment: Treatment; pigeons: TreatmentPigeon[] }>(`/treatments/${encodeURIComponent(id)}`),
        this.catalog.load(),
      ]);
      const x = r.treatment;
      const suggestions = new Set((this.catalog.catalog()?.treatmentSuggestions ?? []).map((s) => s.code));
      this.origPigeons = r.pigeons;
      this.orig.set(x);
      this.choice.set(suggestions.has(x.name) ? x.name : OTHER);
      this.otherName.set(suggestions.has(x.name) ? '' : x.name);
      this.kind.set(x.kind);
      this.target.set(x.target);
      this.method.set(x.method);
      this.startDate.set(x.startDate);
      this.daysText.set(String(x.days));
      this.repeatKind.set(x.repeat?.kind ?? 'nu');
      this.repeatDaysText.set(x.repeat?.kind === 'zile' ? String(x.repeat.days) : '');
      this.note.set(x.note ?? '');
      this.chosen.set(new Set(x.target === 'alesi' ? r.pigeons.map((p) => p.id) : []));
      this.loadError.set('');
      this.ready.set(true);
    } catch (e) {
      this.loadError.set(errorMessage(e));
    }
  }

  private async countGroup(target: Target) {
    const ask = ++this.countAsk;
    this.groupCount.set(null);
    try {
      const r = await this.api.get<{ count: number }>(`/treatments/count?target=${target}`);
      if (ask === this.countAsk) this.groupCount.set(r.count);
    } catch {
      // fără număr: serverul verifică oricum la salvare
    }
  }

  private async loadPigeons() {
    if (this.pigeonsAsked) return;
    this.pigeonsAsked = true;
    try {
      // Doar cei proprii: lista serverului are cel mult 1.000 de porumbei, iar cei externi ar veni primii.
      this.ownPigeons.set((await this.api.get<{ pigeons: PigeonSummary[] }>('/pigeons?kind=own')).pigeons);
    } catch (e) {
      this.pigeonsAsked = false;
      this.saveError.set(errorMessage(e));
    } finally {
      this.pigeonsLoaded.set(true);
    }
  }

  protected toggle(id: number) {
    this.chosen.update((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  private body() {
    return {
      name: this.name(),
      kind: this.kind(),
      method: this.method(),
      startDate: this.startDate(),
      days: this.days(),
      note: this.note().trim() || null,
      target: this.target(),
      ...(this.target() === 'alesi' ? { pigeonIds: [...this.chosen()] } : {}),
      repeat: this.repeat(),
    };
  }

  /** Numele de afișat al celui ales acum (eticheta sugestiei sau textul omului). */
  private nameLabel() {
    return this.choice() === OTHER ? this.otherName().trim() : this.catalog.label('treatmentSuggestions', this.choice());
  }

  /** Ce se schimbă față de tratamentul de dinainte, pentru confirmare. */
  private changeLines(o: Treatment): string[] {
    const c = (list: 'journalTypes' | 'treatmentMethods' | 'treatmentTargets', code: string) => this.catalog.label(list, code);
    const lines = changes([
      { label: t('tratamente.ce_dai'), before: o.label, after: this.nameLabel() },
      { label: t('tratamente.fel'), before: c('journalTypes', o.kind), after: c('journalTypes', this.kind()) },
      { label: t('tratamente.cui'), before: c('treatmentTargets', o.target), after: c('treatmentTargets', this.target()) },
      { label: t('tratamente.cum'), before: c('treatmentMethods', o.method), after: c('treatmentMethods', this.method()) },
      { label: t('tratamente.incepe'), before: formatDay(o.startDate), after: formatDay(this.startDate()) },
      { label: t('tratamente.cate_zile'), before: o.days, after: this.days() },
      { label: t('tratamente.se_repeta'), before: repeatText(o.repeat), after: repeatText(this.repeat()) },
      { label: t('camp.nota'), before: o.note, after: this.note().trim() },
    ]);
    if (o.target === 'alesi' && this.target() === 'alesi') {
      const before = new Set(this.origPigeons.map((p) => p.id));
      const now = this.chosen();
      if (before.size !== now.size || [...now].some((id) => !before.has(id))) {
        lines.push(`${c('treatmentTargets', 'alesi')}: ${t('tratamente.n_porumbei', { count: before.size })} → ${t('tratamente.n_porumbei', { count: now.size })}`);
      }
    }
    return lines;
  }

  protected async save() {
    if (!this.valid() || this.busy()) return;
    const o = this.orig();
    if (o) {
      const lines = this.changeLines(o);
      if (!lines.length) {
        this.router.navigate(['/tratamente', o.id]);
        return;
      }
      const ok = await this.confirm.ask({
        title: t('tratamente.salvezi_titlu'),
        lines: [...lines, ...(o.status === 'urmeaza' ? [] : [t('tratamente.jurnal_se_rescrie')])],
        confirmLabel: t('tratamente.salvezi_da'),
      });
      if (!ok) return;
    }
    this.busy.set(true);
    this.saveError.set('');
    try {
      const r = o
        ? await this.api.patch<{ treatment: Treatment }>(`/treatments/${o.id}`, this.body())
        : await this.api.post<{ treatment: Treatment }>('/treatments', this.body());
      this.router.navigate(['/tratamente', r.treatment.id], { replaceUrl: true });
    } catch (e) {
      this.saveError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
