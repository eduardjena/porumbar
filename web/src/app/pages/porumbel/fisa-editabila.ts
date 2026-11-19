import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api';
import { CatalogService, sexLabel } from '../../core/catalog';
import { ConfirmService } from '../../core/confirm';
import { TPipe, formatDay, t } from '../../core/i18n';
import { Pigeon } from '../../core/models';
import { Icon } from '../../shared/icon';
import { RingInput } from '../../shared/ring-input';
import { Draft, draftBody, draftChanges, draftOf, emptyDraft } from '../porumbel-form/pigeon-draft';

type Section = 'identitate' | 'rasa' | 'culoare' | 'evaluare' | 'text';

/*
 * Fila „Fișa” a porumbelului: tot ce are fișa, pe secțiuni, cu „—” la ce nu e completat. Fiecare secțiune are
 * butonul „Schimbă”: doar ea devine formular, cu „Salvează” / „Renunță”; înainte de salvare apare lista
 * „Ce se schimbă” (ca la formularul de odinioară). O singură secțiune deschisă odată.
 */
@Component({
  selector: 'app-fisa-editabila',
  imports: [FormsModule, NgTemplateOutlet, Icon, RingInput, TPipe],
  template: `
    @if (pigeon(); as p) {
      <section class="card stack fisa">
        <!-- Identitate -->
        <div class="sec-head">
          <h3>{{ 'form.identitate' | t }}</h3>
          @if (editing() !== 'identitate') { <button type="button" class="change" (click)="open('identitate')" [disabled]="busy()"><app-icon name="editeaza" [size]="18" />{{ 'fisa.schimba' | t }}</button> }
        </div>
        @if (editing() === 'identitate') {
          <form class="stack edit" (ngSubmit)="save()">
            <div class="row kinds" role="radiogroup" [attr.aria-label]="'form.al_cui_aria' | t">
              <label class="check"><input type="radio" name="kind" value="own" [(ngModel)]="d.kind" /> {{ 'porumbel.din_porumbarul_meu' | t }}</label>
              <label class="check"><input type="radio" name="kind" value="external" [(ngModel)]="d.kind" /> {{ 'porumbel.nu_e_al_meu' | t }}</label>
            </div>
            <app-ring-input [(value)]="d.ring" [required]="d.kind === 'own'" />
            <fieldset class="row sexes">
              <legend>{{ 'porumbel.sexul' | t }}</legend>
              <label class="check"><input type="radio" name="sex" value="M" [(ngModel)]="d.sex" /> {{ 'sex.mascul' | t }}</label>
              <label class="check"><input type="radio" name="sex" value="F" [(ngModel)]="d.sex" /> {{ 'sex.femela' | t }}</label>
              <label class="check"><input type="radio" name="sex" value="" [(ngModel)]="d.sex" /> {{ 'form.sex_nu_stiu' | t }}</label>
            </fieldset>
            <label class="field">{{ 'form.nume' | t }} <input name="name" [(ngModel)]="d.name" /></label>
            <label class="field">{{ 'camp.data_eclozarii' | t }} <input type="date" name="hatchedOn" [(ngModel)]="d.hatchedOn" /></label>
            <label class="field">{{ 'form.crescator_origine' | t }} <input name="breederText" [(ngModel)]="d.breederText" /></label>
            <label class="field">{{ 'porumbel.starea' | t }}
              <select name="status" [(ngModel)]="d.status">
                <option value="">—</option>
                @for (s of catalog.catalog()?.statuses ?? []; track s.code) { <option [value]="s.code">{{ s.label }}</option> }
              </select>
            </label>
            <ng-container *ngTemplateOutlet="actions" />
          </form>
        } @else {
          <dl class="facts">
            <dt>{{ 'form.al_cui_aria' | t }}</dt><dd>{{ (p.kind === 'own' ? 'porumbel.din_porumbarul_meu' : 'porumbel.nu_e_al_meu') | t }}</dd>
            <dt>{{ 'inel.eticheta' | t }}</dt>
            <dd><span class="mono">{{ p.ring?.display || '—' }}</span>@if (p.ring && p.ring.raw !== p.ring.display) { <span class="muted"> ({{ 'porumbel.inel_scris' | t }}: <span class="mono">{{ p.ring.raw }}</span>)</span> }</dd>
            <dt>{{ 'porumbel.sexul' | t }}</dt><dd>{{ sexLabel(p.sex) }}</dd>
            <dt>{{ 'form.nume' | t }}</dt><dd>{{ p.name || '—' }}</dd>
            <dt>{{ 'camp.data_eclozarii' | t }}</dt><dd>{{ p.hatchedOn ? day(p.hatchedOn) : '—' }}</dd>
            <dt>{{ 'form.crescator_origine' | t }}</dt><dd>{{ p.breederText || '—' }}</dd>
            <dt>{{ 'porumbel.starea' | t }}</dt><dd>{{ p.status ? catalog.label('statuses', p.status) : '—' }}</dd>
          </dl>
        }

        <!-- Rasă și linii -->
        <div class="sec-head">
          <h3>{{ 'form.rasa_si_linii' | t }}</h3>
          @if (editing() !== 'rasa') { <button type="button" class="change" (click)="open('rasa')" [disabled]="busy()"><app-icon name="editeaza" [size]="18" />{{ 'fisa.schimba' | t }}</button> }
        </div>
        @if (editing() === 'rasa') {
          <form class="stack edit" (ngSubmit)="save()">
            <label class="field">{{ 'porumbel.rasa' | t }}
              <select name="breed" [(ngModel)]="d.breed">
                @for (b of catalog.catalog()?.breeds ?? []; track b.code) { <option [value]="b.code">{{ b.label }}</option> }
              </select>
            </label>
            <label class="field">{{ 'form.liniile' | t }} <span class="hint">{{ 'form.liniile_ajutor' | t: { exemplu: '„Janssen, Van Heteren”' } }}</span>
              <input name="lines" [(ngModel)]="d.lines" />
            </label>
            <ng-container *ngTemplateOutlet="actions" />
          </form>
        } @else {
          <dl class="facts">
            <dt>{{ 'porumbel.rasa' | t }}</dt><dd>{{ p.breed ? catalog.label('breeds', p.breed) : '—' }}</dd>
            <dt>{{ 'form.liniile' | t }}</dt><dd>{{ p.lines.length ? p.lines.join(', ') : '—' }}</dd>
          </dl>
        }

        <!-- Culoare -->
        <div class="sec-head">
          <h3>{{ 'porumbel.culoare' | t }}</h3>
          @if (editing() !== 'culoare') { <button type="button" class="change" (click)="open('culoare')" [disabled]="busy()"><app-icon name="editeaza" [size]="18" />{{ 'fisa.schimba' | t }}</button> }
        </div>
        @if (editing() === 'culoare') {
          <form class="stack edit" (ngSubmit)="save()">
            <label class="field">{{ 'form.culoarea_penajului' | t }}
              <select name="color" [(ngModel)]="d.color">
                <option value="">—</option>
                @for (c of catalog.catalog()?.colors ?? []; track c.code) { <option [value]="c.code">{{ c.label }}</option> }
              </select>
            </label>
            <label class="check"><input type="checkbox" name="colorPa" [(ngModel)]="d.colorPa" /> {{ 'form.pene_albe' | t }}</label>
            <label class="field">{{ 'form.culoarea_text' | t }} <input name="colorText" [(ngModel)]="d.colorText" /></label>
            <label class="field">{{ 'form.culoarea_ochilor' | t }}
              <select name="eyeColor" [(ngModel)]="d.eyeColor">
                <option value="">—</option>
                @for (c of catalog.catalog()?.eyeColors ?? []; track c.code) { <option [value]="c.code">{{ c.label }}</option> }
              </select>
            </label>
            <ng-container *ngTemplateOutlet="actions" />
          </form>
        } @else {
          <dl class="facts">
            <dt>{{ 'form.culoarea_penajului' | t }}</dt><dd>{{ catalog.label('colors', p.color) || '—' }}</dd>
            <dt>{{ 'form.pene_albe' | t }}</dt><dd>{{ (p.colorPa ? 'text.da' : 'text.nu') | t }}</dd>
            <dt>{{ 'form.culoarea_text' | t }}</dt><dd>{{ p.colorText || '—' }}</dd>
            <dt>{{ 'form.culoarea_ochilor' | t }}</dt><dd>{{ p.eyeColor ? catalog.label('eyeColors', p.eyeColor) : '—' }}</dd>
          </dl>
        }

        <!-- Evaluare -->
        <div class="sec-head">
          <h3>{{ 'form.evaluare' | t }}</h3>
          @if (editing() !== 'evaluare') { <button type="button" class="change" (click)="open('evaluare')" [disabled]="busy()"><app-icon name="editeaza" [size]="18" />{{ 'fisa.schimba' | t }}</button> }
        </div>
        @if (editing() === 'evaluare') {
          <form class="stack edit" (ngSubmit)="save()">
            <p class="muted">{{ 'form.evaluare_text' | t }}</p>
            @for (c of catalog.catalog()?.evalCriteria ?? []; track c.code) {
              <div class="score" role="radiogroup" [attr.aria-label]="c.label">
                <span class="score-label">{{ c.label }}</span>
                <div class="score-buttons">
                  @for (n of [1, 2, 3, 4, 5]; track n) {
                    <button type="button" [class.on]="d.scores[c.code] === n" [attr.aria-pressed]="d.scores[c.code] === n" (click)="setScore(c.code, n)">{{ n }}</button>
                  }
                </div>
              </div>
            }
            <label class="field">{{ 'porumbel.calitati' | t }} <textarea name="calitati" [(ngModel)]="d.calitati"></textarea></label>
            <label class="field">{{ 'porumbel.de_dorit' | t }} <textarea name="deDorit" [(ngModel)]="d.deDorit"></textarea></label>
            <label class="field">{{ 'porumbel.defecte' | t }} <textarea name="defecte" [(ngModel)]="d.defecte"></textarea></label>
            <ng-container *ngTemplateOutlet="actions" />
          </form>
        } @else {
          <dl class="facts">
            @for (c of catalog.catalog()?.evalCriteria ?? []; track c.code) {
              <dt>{{ c.label }}</dt>
              <dd>@if (p.evaluation?.scores?.[c.code]; as sc) { <span class="stars">{{ '★'.repeat(sc) }}{{ '☆'.repeat(5 - sc) }}</span> <span class="muted">{{ sc }}/5</span> } @else { — }</dd>
            }
            <dt>{{ 'porumbel.calitati' | t }}</dt><dd class="pre">{{ p.evaluation?.calitati || '—' }}</dd>
            <dt>{{ 'porumbel.de_dorit' | t }}</dt><dd class="pre">{{ p.evaluation?.deDorit || '—' }}</dd>
            <dt>{{ 'porumbel.defecte' | t }}</dt><dd class="pre">{{ p.evaluation?.defecte || '—' }}</dd>
          </dl>
        }

        <!-- Text pentru pedigree -->
        <div class="sec-head">
          <h3>{{ 'form.text_pedigree' | t }}</h3>
          @if (editing() !== 'text') { <button type="button" class="change" (click)="open('text')" [disabled]="busy()"><app-icon name="editeaza" [size]="18" />{{ 'fisa.schimba' | t }}</button> }
        </div>
        @if (editing() === 'text') {
          <form class="stack edit" (ngSubmit)="save()">
            <label class="field">{{ 'form.text_pedigree_eticheta' | t }} <span class="hint">{{ 'form.text_pedigree_ajutor' | t }}</span>
              <textarea name="pedigreeText" [(ngModel)]="d.pedigreeText"></textarea>
            </label>
            <ng-container *ngTemplateOutlet="actions" />
          </form>
        } @else {
          <p class="pre value">{{ p.pedigreeText || '—' }}</p>
        }
      </section>
    }

    <ng-template #actions>
      @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
      <div class="row buttons">
        <button class="primary" type="submit" [disabled]="busy()"><app-icon name="bifa" [size]="20" />{{ (busy() ? 'form.se_salveaza' : 'actiune.salveaza') | t }}</button>
        <button type="button" (click)="cancel()" [disabled]="busy()">{{ 'actiune.renunta' | t }}</button>
      </div>
    </ng-template>
  `,
  styles: `
    .sec-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; }
    .sec-head:first-child { margin-top: 0; }
    .sec-head h3 { margin: 0; }
    .change {
      display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 14px; border-radius: 999px;
      background: var(--surface); border: 1px solid var(--border-strong); color: var(--accent-strong); font-weight: 700; font-size: 0.9rem; box-shadow: none;
    }
    .change:hover { border-color: var(--accent); background: var(--accent-soft); }
    .edit { padding: 14px; border-radius: 14px; background: var(--accent-soft); border: 1px solid var(--accent); }
    .buttons { gap: 10px; }
    .buttons > * { flex: 1 1 140px; }
    fieldset { border: 0; padding: 0; margin: 0; }
    legend { font-weight: 600; margin-bottom: 6px; }
    .score { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .score-label { font-weight: 600; min-width: 120px; }
    .score-buttons { display: flex; gap: 6px; }
    .score-buttons button { width: 48px; padding: 0; }
    .score-buttons button.on { background: var(--accent); color: #fff; border-color: var(--accent); }
    .facts { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0; }
    .facts dt { font-weight: 600; color: var(--muted); }
    .facts dd { margin: 0; }
    .pre { white-space: pre-wrap; }
    .value { margin: 0; }
    .mono { white-space: nowrap; }
    .stars { color: var(--accent); letter-spacing: 1px; }
    /* Pe telefon: denumirea deasupra, valoarea dedesubt, pe toată lățimea. */
    @media (max-width: 600px) {
      .facts { grid-template-columns: 1fr; gap: 0; }
      .facts dt { margin-top: 10px; font-size: 0.9rem; }
      .facts dd { font-weight: 600; }
      .edit { padding: 12px 10px; }
    }
  `,
})
export class FisaEditabila {
  private readonly api = inject(Api);
  private readonly confirm = inject(ConfirmService);
  protected readonly catalog = inject(CatalogService);
  readonly pigeon = input.required<Pigeon>();
  /** Porumbelul salvat (fișa părintelui îl pune în locul celui vechi). */
  readonly saved = output<Pigeon>();
  protected readonly sexLabel = sexLabel;
  protected readonly day = formatDay;
  readonly editing = signal<Section | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  /** Ciorna secțiunii deschise (toată fișa, ca la server să plece tot porumbelul, cum pleca și din formular). */
  d: Draft = emptyDraft();
  private original: Draft = this.d;

  constructor() {
    // Alt porumbel (sau același, salvat din altă parte): se închide editarea.
    effect(() => {
      this.pigeon();
      untracked(() => this.editing.set(null));
    });
  }

  private pending(): string[] {
    return this.editing() ? draftChanges(this.original, this.d, this.catalog) : [];
  }

  /** Deschide o secțiune; dacă alta are schimbări nesalvate, întâi întreabă. */
  async open(section: Section) {
    if (!(await this.leave())) return;
    this.original = draftOf(this.pigeon());
    this.d = structuredClone(this.original);
    this.error.set('');
    this.editing.set(section);
  }

  setScore(code: string, n: number) {
    this.d.scores[code] = this.d.scores[code] === n ? null : n;
  }

  /** „Renunță”: cu schimbări, întâi întreabă. */
  async cancel() {
    if (await this.leave()) this.editing.set(null);
  }

  private async leave(): Promise<boolean> {
    const diff = this.pending();
    if (!diff.length) return true;
    return this.confirm.ask({ title: t('form.renunti_titlu'), lines: diff, confirmLabel: t('form.renunti_da'), cancelLabel: t('fisa.inapoi'), danger: true });
  }

  async save() {
    const diff = this.pending();
    if (!diff.length) {
      this.editing.set(null);
      return;
    }
    if (!(await this.confirm.ask({ title: t('form.salvezi_titlu'), lines: diff, confirmLabel: t('form.salvezi_da') }))) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await this.api.patch<{ pigeon: Pigeon }>(`/pigeons/${this.pigeon().id}`, draftBody(this.d));
      this.editing.set(null);
      this.saved.emit(r.pigeon);
    } catch (e) {
      this.error.set(e instanceof HttpErrorResponse && e.status === 0 ? t('form.fara_internet') : errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
