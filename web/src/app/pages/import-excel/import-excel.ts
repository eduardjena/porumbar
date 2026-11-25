import { Component, ElementRef, Injector, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth';
import { ConfirmService } from '../../core/confirm';
import { formatDateTime, localeOf, t, TPipe, glue } from '../../core/i18n';
import { ImportProblem, ImportSummary, ImportUndo, LastImport } from '../../core/models';
import { Icon } from '../../shared/icon';
import {
  Field, ImportRow, buildRows, canContinue, findHeader, guessColumns, parsePasted,
} from '../../shared/tabel-coloane';
import type { Sheet } from '../../shared/tabel-fisier';
import { PorumbarState } from '../panou/porumbar-state';

/*
 * „Adu porumbeii din Excel” (/porumbei/excel, în cadrul Panoului): trei pași și ecranul de la final.
 *   1. tabelul: fișierul ales (.xlsx, .xls, .csv) sau tabelul lipit; fișierul se citește aici, în browser, cu SheetJS
 *      (shared/tabel-fisier.ts, adus cu import() doar când omul alege un fișier, ca restul aplicației să nu-l încarce);
 *   2. coloanele: câte un card pe coloană, cu ce a ghicit programul (shared/tabel-coloane.ts) și o listă de corectat;
 *   3. rezumatul exact (POST /api/import/excel/preview: importul încercat și anulat pe server), apoi „Adaugă porumbeii”
 *      (POST /api/import/excel, aceleași rânduri).
 * La server pleacă doar celulele coloanelor alese. Ultimul import se poate anula 7 zile (banda de sus).
 */

type Step = 'tabel' | 'coloane' | 'rezumat' | 'gata';
type Busy = '' | 'citire' | 'verificare' | 'salvare' | 'anulare';
type Body = { rows: ImportRow[]; defaultCountry?: string };

/** Ca pe server (src/table-import.js, MAX_ROWS). */
const MAX_ROWS = 3000;
const MAX_COLS = 20;
/** Câte rânduri cu probleme se văd până la „Arată toate”. */
const FIRST_PROBLEMS = 10;
/** Țările din lista „Inelele fără țară sunt din:” (toate citite de rings.js cu „XX 24 0117345”). */
const COUNTRIES = ['RO', 'HU', 'DE', 'NL', 'BE', 'PL', 'CZ', 'SK', 'RS', 'BG', 'MD', 'UA', 'IT', 'FR', 'GB', 'US', 'AT', 'SI', 'HR'];
const FIELDS: Field[] = [
  'inel', 'inel_tara', 'inel_an', 'inel_club', 'inel_numar', 'nume', 'sex', 'culoare', 'ochi', 'rasa', 'linii', 'eclozare',
  'crescator', 'stare', 'tata', 'mama', 'observatii', 'ignor',
];
const PROBLEM_KINDS: ImportProblem['kind'][] = ['inel_necitit', 'fara_inel', 'dublura', 'conflict', 'parinte_necitit'];
const hasText = (r: string[]) => r.some((c) => c.trim() !== '');
/** O valoare cu cifre și fără nicio literă: un inel fără țară (24-0117345). */
const noCountry = (v: string | undefined) => !!v && /\d/.test(v) && !/\p{L}/u.test(v);
/** Extensiile și tipurile fișierelor (pe Android, alegătorul de fișiere se uită la tip). */
const ACCEPT = [
  '.xlsx', '.xls', '.csv', '.txt',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel',
  'text/csv', 'text/comma-separated-values', 'text/plain',
].join(',');

@Component({
  selector: 'app-import-excel',
  imports: [FormsModule, RouterLink, NgTemplateOutlet, Icon, TPipe],
  template: `
    <!-- În cadrul Panoului: titlul și explicația („excel.intro”) le pune cadrul. -->
    <div class="wide stack">
      @if (last(); as l) {
        @if (step() !== 'gata') {
          <div class="notice undo-band">
            <app-icon name="rotire" />
            <div class="grow">
              <div>{{ 'excel.banda' | t: { count: l.created, data: when(l.createdAt) } }}</div>
              <div>{{ 'excel.banda_pana' | t: { data: when(l.undoUntil) } }}</div>
            </div>
            <button type="button" class="danger" [disabled]="!!busy()" (click)="undo()">
              {{ busy() === 'anulare' ? ('excel.se_anuleaza' | t) : ('excel.anuleaza' | t) }}
            </button>
          </div>
        }
      }
      @if (message()) { <div class="notice" role="status"><app-icon name="bifa" />{{ message() }}</div> }
      @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }

      @switch (step()) {
        @case ('tabel') {
          <section class="card stack">
            <h2 #stepHead tabindex="-1">{{ 'excel.pas1' | t }}</h2>
            <input #file class="vh" type="file" [accept]="accept" tabindex="-1" aria-hidden="true" (change)="pickFile($event)" />
            <div>
              <button type="button" class="primary big" [disabled]="!!busy()" (click)="file.click()">
                <app-icon name="tabel" />{{ busy() === 'citire' ? ('excel.se_citeste' | t) : ('excel.alege_fisier' | t) }}
              </button>
              <p class="muted">{{ 'excel.fisier_ajutor' | t }}</p>
            </div>
            <label class="field">{{ 'excel.sau_lipeste' | t }}
              <textarea rows="6" [ngModel]="pasted()" (ngModelChange)="pasted.set($event)" [placeholder]="'excel.lipeste_ph' | t"
                        autocomplete="off" spellcheck="false"></textarea>
            </label>
            <div class="actions">
              <button type="button" class="primary big" [disabled]="!pasted().trim() || !!busy()" (click)="usePasted()">
                {{ 'excel.mai_departe' | t }}<app-icon name="inainte" />
              </button>
            </div>
          </section>
        }

        @case ('coloane') {
          <section class="card stack">
            <h2 #stepHead tabindex="-1">{{ 'excel.pas2' | t }}</h2>
            <p class="muted">{{ 'excel.pas2_ajutor' | t }}</p>
            @if (sheets().length > 1) {
              <label class="field">{{ 'excel.foaia' | t }}
                <select [ngModel]="sheetIndex()" (ngModelChange)="pickSheet($event)">
                  @for (s of sheets(); track $index) { <option [ngValue]="$index">{{ s.name }}</option> }
                </select>
              </label>
            }
            <p class="source"><strong>{{ source() || ('excel.sursa_lipit' | t) }}</strong> · {{ 'excel.randuri' | t: { count: dataRows() } }}</p>
            <label class="check">
              <input type="checkbox" [ngModel]="hasHeader()" (ngModelChange)="setHeader($event)" />
              {{ titleAt() === 0 ? ('excel.primul_rand_titlu' | t) : ('excel.rand_titlu' | t: { n: titleAt() + 1 }) }}
            </label>
            @if (tooWide()) { <div class="warning">{{ 'excel.doar_20' | t: { max: maxCols } }}</div> }

            <div class="cols">
              @for (f of fields(); track $index; let i = $index) {
                <div class="col" [class.off]="f === 'ignor'">
                  <div class="col-head">
                    <span class="muted">{{ 'excel.coloana' | t: { litera: letter(i) } }}</span>
                    @if (hasHeader() && header(i)) { <strong class="col-title">{{ header(i) }}</strong> }
                  </div>
                  <ul class="examples">
                    @for (e of examples()[i]; track $index) { <li>{{ e }}</li> } @empty { <li class="muted">{{ 'excel.goala' | t }}</li> }
                  </ul>
                  <label class="field">{{ 'excel.ce_este' | t }}
                    <select [ngModel]="f" (ngModelChange)="setField(i, $event)">
                      @for (o of fieldList; track o) { <option [value]="o">{{ 'excel.camp.' + o | t }}</option> }
                    </select>
                  </label>
                </div>
              }
            </div>

            @if (needsCountry()) {
              <label class="field">{{ 'excel.tara_fara' | t }}
                <select [ngModel]="country()" (ngModelChange)="country.set($event)">
                  @for (c of countries(); track c.code) { <option [value]="c.code">{{ c.label }}</option> }
                </select>
                <span class="hint">{{ 'excel.tara_ajutor' | t }}</span>
              </label>
            }
            @if (!canGo()) { <div class="warning"><app-icon name="alerta" />{{ 'excel.lipseste_inel' | t }}</div> }
            <div class="actions">
              <button type="button" class="primary big" [disabled]="!canGo() || !!busy()" (click)="toSummary()">
                {{ 'excel.mai_departe' | t }}<app-icon name="inainte" />
              </button>
              <button type="button" class="link" (click)="go('tabel')">{{ 'excel.inapoi' | t }}</button>
            </div>
          </section>
        }

        @case ('rezumat') {
          <section class="card stack" aria-live="polite">
            <h2 #stepHead tabindex="-1">{{ 'excel.pas3' | t }}</h2>
            @if (busy() === 'verificare') { <p>{{ 'excel.se_verifica' | t }}</p> }
            @if (summary(); as s) {
              <ng-container [ngTemplateOutlet]="counts" [ngTemplateOutletContext]="{ $implicit: s }" />
              @if (nothing()) { <div class="warning">{{ 'excel.nimic_de_adaugat' | t }}</div> }
              @if (s.problems.length) { <ng-container [ngTemplateOutlet]="problemList" [ngTemplateOutletContext]="{ $implicit: s }" /> }
            }
            <div class="actions">
              @if (summary() && !nothing()) {
                <button type="button" class="primary big" [disabled]="!!busy()" (click)="save()">
                  <app-icon name="bifa" />{{ busy() === 'salvare' ? ('excel.se_adauga' | t) : ('excel.adauga' | t) }}
                </button>
              }
              <button type="button" class="link" [disabled]="busy() === 'salvare' || busy() === 'verificare'" (click)="go('coloane')">{{ 'excel.inapoi' | t }}</button>
            </div>
          </section>
        }

        @case ('gata') {
          @if (result(); as r) {
            <section class="card stack done" role="status">
              <h2 #stepHead tabindex="-1"><app-icon name="bifa" />{{ 'excel.gata' | t: { count: r.created } }}</h2>
              @if (r.ancestors) { <p>{{ 'excel.gata_stramosi' | t: { count: r.ancestors } }}</p> }
              @if (r.existing) { <p>{{ 'excel.gata_existau' | t: { count: r.existing } }}</p> }
              @if (r.problems.length) { <ng-container [ngTemplateOutlet]="problemList" [ngTemplateOutletContext]="{ $implicit: r }" /> }
              <div class="actions">
                <a class="btn primary big" routerLink="/porumbar"><app-icon name="lista" />{{ 'excel.vezi_porumbeii' | t }}</a>
                @if (r.importId && last()?.id === r.importId) {
                  <button type="button" class="danger" [disabled]="!!busy()" (click)="undo()">
                    <app-icon name="rotire" />{{ busy() === 'anulare' ? ('excel.se_anuleaza' | t) : ('excel.anuleaza' | t) }}
                  </button>
                }
                <button type="button" class="link" (click)="startOver()">{{ 'excel.alt_tabel' | t }}</button>
              </div>
            </section>
          }
        }
      }
    </div>

    <!-- Cifrele rezumatului: câți noi, câți există, câți strămoși, apoi problemele pe feluri. -->
    <ng-template #counts let-s>
      <ul class="counts">
        <li class="good"><app-icon name="plus" />{{ 'excel.noi' | t: { count: s.created } }}</li>
        @if (s.existing) { <li><app-icon name="bifa" />{{ 'excel.exista' | t: { count: s.existing } }}</li> }
        @if (s.ancestors) { <li><app-icon name="copac" />{{ 'excel.stramosi' | t: { count: s.ancestors } }}</li> }
        @for (k of kindCounts(s); track k.kind) { <li class="bad"><app-icon name="alerta" />{{ 'excel.pb.' + k.kind | t: { count: k.count } }}</li> }
      </ul>
    </ng-template>

    <!-- Rândurile cu probleme: numărul rândului din Excel și motivul; primele 10, apoi „Arată toate”. -->
    <ng-template #problemList let-s>
      <h3>{{ 'excel.probleme_titlu' | t }}</h3>
      <ol class="problems">
        @for (p of showAll() ? s.problems : s.problems.slice(0, firstProblems); track $index) {
          <li><strong class="line">{{ 'excel.rand_n' | t: { n: p.line } }}</strong>&ngsp;<span>{{ p.message }}</span></li>
        }
      </ol>
      @if (!showAll() && s.problems.length > firstProblems) {
        <button type="button" class="link" (click)="showAll.set(true)">{{ 'excel.arata_toate' | t: { n: s.problems.length } }}</button>
      }
      @if ((showAll() || s.problems.length <= firstProblems) && s.problemCount > s.problems.length) {
        <p class="muted">{{ 'excel.lista_primele' | t: { n: s.problems.length, total: s.problemCount } }}</p>
      }
    </ng-template>
  `,
  styles: `
    .vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; opacity: 0; }
    .grow { flex: 1 1 200px; min-width: 0; }
    .undo-band { flex-wrap: wrap; align-items: center; }
    .undo-band button { flex: none; }
    .big { min-height: 56px; font-size: 1.1rem; padding: 0 24px; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; }
    .card h2 { margin: 0; display: flex; align-items: center; gap: 10px; }
    .card h3 { margin: 4px 0 0; }
    /* Titlul pasului primește focusul la schimbarea pasului; conturul doar pentru tastatură. */
    .card h2:focus:not(:focus-visible) { outline: none; }
    .source { margin: 0; overflow-wrap: anywhere; }
    /* Câte un card pe coloană: unul sub altul pe telefon, mai multe pe rând pe ecran lat. */
    .cols { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: 12px; }
    .col { display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: var(--radius-sm); border: 2px solid var(--accent); background: var(--surface); min-width: 0; }
    .col.off { border: 1.5px dashed var(--border-strong); background: var(--surface-2); }
    .col-head { display: flex; flex-direction: column; gap: 2px; }
    .col-title { font-size: 1.05rem; overflow-wrap: anywhere; }
    .examples { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; font-family: var(--mono); font-size: 0.95rem; }
    .examples li { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .counts { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; font-size: 1.05rem; }
    .counts li { display: flex; align-items: flex-start; gap: 10px; }
    .counts li app-icon { margin-top: 3px; }
    .counts .good { font-weight: 700; color: var(--ok); }
    .counts .bad { color: var(--warn); font-weight: 600; }
    .problems { margin: 0; padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
    .problems li { padding: 8px 12px; border-radius: var(--radius-sm); background: var(--warn-soft); overflow-wrap: anywhere; }
    .problems .line { white-space: nowrap; }
    .done h2 { color: var(--ok); }
    @media (max-width: 480px) {
      .actions > .big, .actions > .btn, .undo-band button { width: 100%; }
    }
  `,
})
export default class ImportExcel {
  private readonly api = inject(Api);
  private readonly confirm = inject(ConfirmService);
  private readonly state = inject(PorumbarState);
  private readonly auth = inject(AuthService);
  private readonly injector = inject(Injector);
  /** Titlul pasului de pe ecran (unul singur odată). */
  private readonly stepHead = viewChild<ElementRef<HTMLElement>>('stepHead');
  protected readonly fieldList = FIELDS;
  protected readonly firstProblems = FIRST_PROBLEMS;
  protected readonly maxCols = MAX_COLS;
  protected readonly accept = ACCEPT;

  readonly step = signal<Step>('tabel');
  readonly busy = signal<Busy>('');
  readonly error = signal('');
  readonly message = signal('');
  readonly pasted = signal('');
  /** Foile fișierului ales (una singură pentru .csv); goală pentru tabelul lipit. */
  readonly sheets = signal<Sheet[]>([]);
  readonly sheetIndex = signal(0);
  /** Numele fișierului; gol = tabelul lipit. */
  readonly source = signal('');
  readonly rows = signal<string[][]>([]);
  /** Rândul de antet (indicele în `rows`) sau -1 fără antet; rândurile de deasupra lui nu pleacă la server. */
  readonly headerRow = signal(-1);
  /** Rândul care devine antet când omul bifează „e titlu” (cel găsit sau primul rând nevid). */
  readonly titleAt = signal(0);
  protected readonly hasHeader = computed(() => this.headerRow() >= 0);
  readonly fields = signal<Field[]>([]);
  /** Țara pusă în față inelelor care nu se citesc fără ea: implicit România, la conturile maghiare Ungaria. */
  readonly country = signal(this.auth.account()?.lang === 'hu' ? 'HU' : 'RO');
  readonly summary = signal<ImportSummary | null>(null);
  readonly result = signal<ImportSummary | null>(null);
  readonly last = signal<LastImport | null>(null);
  readonly showAll = signal(false);
  /** Ce s-a trimis la previzualizare; salvarea trimite exact aceleași rânduri. */
  private sent: Body | null = null;

  /** Rândurile cu date (fără antet, fără ce e deasupra lui și fără rândurile goale). */
  protected readonly dataRows = computed(() => this.rows().slice(this.headerRow() + 1).filter(hasText).length);
  protected readonly tooWide = computed(() => this.rows().some((r) => r.length > MAX_COLS));
  protected readonly canGo = computed(() => canContinue(this.fields()));
  protected readonly built = computed(() => buildRows(this.rows(), this.fields(), this.headerRow()));
  /**
   * Lista de țări apare dacă vreun inel, al porumbelului sau al unui părinte, n-are nicio literă (de ex. 24-0117345):
   * serverul pune țara aleasă tuturor acestor inele.
   */
  protected readonly needsCountry = computed(() =>
    this.built().some((r) => noCountry(r.ring) || noCountry(r.father) || noCountry(r.mother)));
  protected readonly nothing = computed(() => {
    const s = this.summary();
    return !!s && !s.created && !s.existing && !s.ancestors;
  });
  /** Primele 3 celule nevide din fiecare coloană (de sub antet). */
  protected readonly examples = computed(() => {
    const data = this.rows().slice(this.headerRow() + 1);
    return this.fields().map((_, i) => {
      const out: string[] = [];
      for (const r of data) {
        const c = (r[i] ?? '').trim();
        if (c) out.push(c.length > 60 ? `${c.slice(0, 60)}…` : c);
        if (out.length === 3) break;
      }
      return out;
    });
  });
  /** Numele țărilor în limba ecranului (Intl), cu codul alături. */
  protected readonly countries = computed(() => {
    let names: Intl.DisplayNames | null = null;
    try {
      names = new Intl.DisplayNames([localeOf()], { type: 'region' });
    } catch {
      /* browser vechi: doar codul */
    }
    return COUNTRIES.map((code) => ({ code, label: names ? `${names.of(code) ?? code} (${code})` : code }));
  });

  constructor() {
    void this.loadLast();
  }

  private async loadLast() {
    try {
      this.last.set((await this.api.get<{ last: LastImport | null }>('/import/excel/last')).last);
    } catch {
      /* fără bandă: nu e grav */
    }
  }

  protected when(d: string) {
    return formatDateTime(d, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
  }

  protected letter(i: number) {
    return String.fromCharCode(65 + i);
  }

  protected header(i: number) {
    return (this.rows()[this.headerRow()]?.[i] ?? '').trim();
  }

  /** Problemele pe feluri; dacă lista e tăiată (peste 100), doar totalul, ca cifrele să nu mintă. */
  protected kindCounts(s: ImportSummary): { kind: string; count: number }[] {
    if (!s.problemCount) return [];
    if (s.problemCount > s.problems.length) return [{ kind: 'total', count: s.problemCount }];
    return PROBLEM_KINDS.map((kind) => ({ kind, count: s.problems.filter((p) => p.kind === kind).length })).filter((k) => k.count);
  }

  /**
   * Alt pas: sus pe pagină, iar focusul pe titlul pasului nou (butonul apăsat dispare; cititorul de ecran și tastatura
   * pornesc de la titlu).
   */
  go(step: Step) {
    this.error.set('');
    this.step.set(step);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    afterNextRender(() => this.stepHead()?.nativeElement.focus({ preventScroll: true }), { injector: this.injector });
  }

  private clear() {
    this.error.set('');
    this.message.set('');
  }

  /** Fișierul ales: SheetJS se aduce abia acum (import dinamic), citirea se face în browser. */
  async pickFile(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.clear();
    this.busy.set('citire');
    try {
      const m = await import('../../shared/tabel-fisier');
      if (file.size > m.MAX_FILE_BYTES) throw new Error('fisier_mare');
      const sheets = m.readWorkbook(await file.arrayBuffer(), file.name, parsePasted);
      if (!sheets.length) throw new Error('fisier_necitit');
      const i = m.firstSheetWithData(sheets);
      this.sheets.set(sheets);
      this.source.set(file.name);
      this.sheetIndex.set(i);
      this.useTable(sheets[i].rows);
    } catch (e) {
      this.error.set(t(e instanceof Error && e.message === 'fisier_mare' ? 'excel.fisier_mare' : 'excel.fisier_necitit'));
    } finally {
      this.busy.set('');
    }
  }

  usePasted() {
    this.clear();
    this.sheets.set([]);
    this.source.set('');
    this.useTable(parsePasted(this.pasted()));
  }

  pickSheet(i: number) {
    this.sheetIndex.set(i);
    this.useTable(this.sheets()[i]?.rows ?? [], true);
  }

  /**
   * Tabelul nou: antetul (căutat în primele 5 rânduri nevide, sub titlul tabelului) și coloanele ghicite, apoi pasul 2.
   * Rândurile goale rămân pe loc, ca numărul rândului din rezumat să fie cel din Excel (buildRows le sare).
   */
  private useTable(rows: string[][], stay = false) {
    const header = findHeader(rows);
    this.rows.set(rows);
    this.headerRow.set(header);
    this.titleAt.set(header >= 0 ? header : Math.max(0, rows.findIndex(hasText)));
    this.fields.set(guessColumns(rows, header));
    this.summary.set(null);
    if (!this.dataRows()) {
      this.error.set(t('excel.tabel_gol'));
      if (!stay) return;
    } else this.error.set('');
    if (!stay) this.go('coloane');
  }

  setHeader(v: boolean) {
    const header = v ? this.titleAt() : -1;
    this.headerRow.set(header);
    this.fields.set(guessColumns(this.rows(), header));
  }

  /** Fiecare câmp cel mult o dată: coloana care îl avea înainte devine „nu iau”. */
  setField(i: number, f: Field) {
    const next = this.fields().map((x, k) => (k !== i && f !== 'ignor' && x === f ? 'ignor' : x));
    next[i] = f;
    this.fields.set(next);
  }

  /** Pasul 3: rezumatul exact de la server (importul încercat și anulat). */
  async toSummary() {
    this.clear();
    const rows = this.built();
    if (!rows.length) return this.error.set(t('excel.tabel_gol'));
    if (rows.length > MAX_ROWS) return this.error.set(t('excel.prea_multe_randuri', { n: rows.length, max: MAX_ROWS }));
    const body: Body = { rows, ...(this.needsCountry() ? { defaultCountry: this.country() } : {}) };
    this.sent = body;
    this.summary.set(null);
    this.showAll.set(false);
    this.go('rezumat');
    this.busy.set('verificare');
    try {
      const summary = await this.api.post<ImportSummary>('/import/excel/preview', body);
      // Un răspuns întârziat la o cerere mai veche nu are voie să ia locul rezumatului celei noi.
      if (this.sent === body) this.summary.set(summary);
    } catch (e) {
      if (this.sent === body) this.error.set(errorMessage(e));
    } finally {
      if (this.sent === body) this.busy.set('');
    }
  }

  async save() {
    if (!this.sent) return;
    this.clear();
    this.busy.set('salvare');
    try {
      const r = await this.api.post<ImportSummary>('/import/excel', this.sent);
      this.result.set(r);
      this.showAll.set(false);
      this.go('gata');
      void this.state.load(); // Grila și Lista arată porumbeii noi
      await this.loadLast();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set('');
    }
  }

  /** „Anulează importul”: mesajul spune ce a făcut anularea (`deleted`, `kept`), nu cifrele importului. */
  async undo() {
    const ok = await this.confirm.ask({
      title: t('excel.anulezi_titlu'),
      lines: [t('excel.anulezi_text')],
      confirmLabel: t('excel.anulezi_da'),
      danger: true,
    });
    if (!ok) return;
    this.clear();
    this.busy.set('anulare');
    try {
      const u = await this.api.post<ImportUndo>('/import/excel/undo');
      const kept = u.kept > 0 ? `${glue(' ')}${t('excel.anulat_ramas', { count: u.kept })}` : '';
      this.last.set(null);
      if (this.step() === 'gata') this.startOver();
      this.message.set(`${t('excel.anulat', { count: u.deleted })}${kept}`);
      void this.state.load();
    } catch (e) {
      this.error.set(errorMessage(e));
      if (e instanceof HttpErrorResponse && e.status === 404) this.last.set(null);
    } finally {
      this.busy.set('');
    }
  }

  startOver() {
    this.clear();
    this.result.set(null);
    this.summary.set(null);
    this.sent = null;
    this.rows.set([]);
    this.fields.set([]);
    this.sheets.set([]);
    this.source.set('');
    this.pasted.set('');
    this.go('tabel');
  }
}
