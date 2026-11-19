import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CatalogService, percent, ringText } from '../../core/catalog';
import { CoiResult, Pigeon, PigeonSummary } from '../../core/models';
import { RingInput } from '../../shared/ring-input';
import { Breadcrumbs, Crumb } from '../../shared/breadcrumbs';
import { PigeonPicker } from '../../shared/pigeon-picker';
import { ConfirmService } from '../../core/confirm';
import { Draft, draftBody, draftChanges, draftOf, emptyDraft } from './pigeon-draft';
import { TPipe, t } from '../../core/i18n';

const empty = emptyDraft;
const fromPigeon = draftOf;

/** Ciorna rămâne pe telefon până la salvare: o cădere scurtă a internetului nu pierde ce ai scris. */
const DRAFT_KEY = (id: string | undefined) => `porumbar.ciorna.${id ?? 'nou'}`;
function readDraft(id: string | undefined): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(id));
    return raw ? { ...empty(), ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}
function writeDraft(id: string | undefined, d: Draft | null) {
  try {
    if (d) localStorage.setItem(DRAFT_KEY(id), JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY(id));
  } catch {
    /* fără spațiu local: nu e grav */
  }
}

@Component({
  selector: 'app-porumbel-form',
  imports: [FormsModule, RouterLink, RingInput, Breadcrumbs, PigeonPicker, TPipe],
  template: `
    <app-breadcrumbs [items]="crumbs()" />
    <h1>{{ (id() ? 'form.titlu_editeaza' : 'porumbel.nou') | t }}</h1>
    @if (!id()) {
      <a class="paper card" routerLink="/porumbei/pedigree">
        <strong>{{ 'form.import_titlu' | t }}</strong>
        <span class="muted">{{ 'form.import_text' | t }}</span>
      </a>
      <a class="paper card" routerLink="/scaneaza">
        <strong>{{ 'form.qr_titlu' | t }}</strong>
        <span class="muted">{{ 'form.qr_text' | t }}</span>
      </a>
    }
    @if (restored()) {
      <div class="notice row" role="status">
        {{ 'form.ciorna_pastrata' | t }}
        <button type="button" class="link" (click)="discardDraft()">{{ 'form.de_la_zero' | t }}</button>
      </div>
    }
    @if (d(); as f) {
      @if (!id()) {
        <!-- Întâi părinții (cerut de crescător): cine e tatăl, cine e mama, apoi seria puiului. În afara formularului,
             ca Enter în căutarea unui părinte să nu salveze porumbelul. -->
        <section class="card stack parents">
          <h2>{{ 'porumbel.parintii' | t }}</h2>
          <p class="muted">{{ 'form.parinti_text' | t }}</p>
          <app-pigeon-picker [label]="'porumbel.tatal' | t" sex="M" [selected]="f.father ?? null" (picked)="setParent('father', $event)" />
          <app-pigeon-picker [label]="'porumbel.mama' | t" sex="F" [selected]="f.mother ?? null" (picked)="setParent('mother', $event)" />
          @if (pairCoi(); as c) {
            <div [class]="c.coi >= 0.125 ? 'warning' : 'notice'" role="status">
              @if (c.coi > 0) {
                {{ 'form.coi_pui' | t }} <strong>{{ pct(c.coi) }}</strong> {{ 'form.coi_stramosi' | t }}
                @for (x of c.common; track x.pigeon.id; let last = $last) {<strong class="mono">{{ ring(x.pigeon) }}</strong>{{ last ? '' : ', ' }}}).
              } @else {
                {{ 'form.coi_zero' | t }}
              }
            </div>
          }
        </section>
      }
      <form class="stack" (ngSubmit)="save()" (input)="keep()" (change)="keep()">
        <section class="card stack">
          <h2>{{ 'form.identitate' | t }}</h2>
          <div class="row kinds" role="radiogroup" [attr.aria-label]="'form.al_cui_aria' | t">
            <label class="check"><input type="radio" name="kind" value="own" [(ngModel)]="f.kind" /> {{ 'porumbel.din_porumbarul_meu' | t }}</label>
            <label class="check"><input type="radio" name="kind" value="external" [(ngModel)]="f.kind" /> {{ 'porumbel.nu_e_al_meu' | t }}</label>
          </div>
          <app-ring-input [(value)]="f.ring" [required]="f.kind === 'own'" />
          <fieldset class="row sexes">
            <legend>{{ 'porumbel.sexul' | t }}</legend>
            <label class="check"><input type="radio" name="sex" value="M" [(ngModel)]="f.sex" /> {{ 'sex.mascul' | t }}</label>
            <label class="check"><input type="radio" name="sex" value="F" [(ngModel)]="f.sex" /> {{ 'sex.femela' | t }}</label>
            <label class="check"><input type="radio" name="sex" value="" [(ngModel)]="f.sex" /> {{ 'form.sex_nu_stiu' | t }}</label>
          </fieldset>
          <label class="field">{{ 'form.nume' | t }} <span class="hint">{{ 'text.de_exemplu' | t: { exemplu: '„DE 546”, „Super Velden”' } }}</span>
            <input name="name" [(ngModel)]="f.name" />
          </label>
          <label class="field">{{ 'camp.data_eclozarii' | t }} <span class="hint">{{ 'text.optional' | t }}</span>
            <input type="date" name="hatchedOn" [(ngModel)]="f.hatchedOn" />
          </label>
          <label class="field">{{ 'form.crescator_origine' | t }} <span class="hint">{{ 'text.de_exemplu' | t: { exemplu: '„Van Heteren”, „Comb. Den Haan”' } }}</span>
            <input name="breederText" [(ngModel)]="f.breederText" />
          </label>
          <label class="field">{{ 'porumbel.starea' | t }}
            <select name="status" [(ngModel)]="f.status">
              <option value="">—</option>
              @for (s of cat()?.statuses ?? []; track s.code) { <option [value]="s.code">{{ s.label }}</option> }
            </select>
          </label>
        </section>

        <section class="card stack">
          <h2>{{ 'form.rasa_si_linii' | t }}</h2>
          <label class="field">{{ 'porumbel.rasa' | t }}
            <select name="breed" [(ngModel)]="f.breed">
              @for (b of cat()?.breeds ?? []; track b.code) { <option [value]="b.code">{{ b.label }}</option> }
            </select>
          </label>
          <label class="field">{{ 'form.liniile' | t }} <span class="hint">{{ 'form.liniile_ajutor' | t: { exemplu: '„Janssen, Van Heteren”' } }}</span>
            <input name="lines" [(ngModel)]="f.lines" />
          </label>
        </section>

        <section class="card stack">
          <h2>{{ 'porumbel.culoare' | t }}</h2>
          <label class="field">{{ 'form.culoarea_penajului' | t }}
            <select name="color" [(ngModel)]="f.color">
              <option value="">—</option>
              @for (c of cat()?.colors ?? []; track c.code) { <option [value]="c.code">{{ c.label }}</option> }
            </select>
          </label>
          <label class="check"><input type="checkbox" name="colorPa" [(ngModel)]="f.colorPa" /> {{ 'form.pene_albe' | t }}</label>
          <label class="field">{{ 'form.culoarea_text' | t }} <span class="hint">{{ 'text.optional' | t }}</span>
            <input name="colorText" [(ngModel)]="f.colorText" />
          </label>
          <label class="field">{{ 'form.culoarea_ochilor' | t }}
            <select name="eyeColor" [(ngModel)]="f.eyeColor">
              <option value="">—</option>
              @for (c of cat()?.eyeColors ?? []; track c.code) { <option [value]="c.code">{{ c.label }}</option> }
            </select>
          </label>
        </section>

        <section class="card stack">
          <h2>{{ 'form.evaluare' | t }}</h2>
          <p class="muted">{{ 'form.evaluare_text' | t }}</p>
          @for (c of cat()?.evalCriteria ?? []; track c.code) {
            <div class="score" role="radiogroup" [attr.aria-label]="c.label">
              <span class="score-label">{{ c.label }}</span>
              <div class="score-buttons">
                @for (n of [1, 2, 3, 4, 5]; track n) {
                  <button type="button" [class.on]="f.scores[c.code] === n" [attr.aria-pressed]="f.scores[c.code] === n"
                          (click)="setScore(c.code, n)">{{ n }}</button>
                }
              </div>
            </div>
          }
          <label class="field">{{ 'porumbel.calitati' | t }} <textarea name="calitati" [(ngModel)]="f.calitati"></textarea></label>
          <label class="field">{{ 'porumbel.de_dorit' | t }} <textarea name="deDorit" [(ngModel)]="f.deDorit"></textarea></label>
          <label class="field">{{ 'porumbel.defecte' | t }} <textarea name="defecte" [(ngModel)]="f.defecte"></textarea></label>
        </section>

        <section class="card stack">
          <h2>{{ 'form.text_pedigree' | t }}</h2>
          <label class="field">{{ 'form.text_pedigree_eticheta' | t }} <span class="hint">{{ 'form.text_pedigree_ajutor' | t }}</span>
            <textarea name="pedigreeText" [(ngModel)]="f.pedigreeText"></textarea>
          </label>
        </section>

        @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
        <div class="actions">
          <button class="primary" type="submit" [disabled]="busy()">{{ (busy() ? 'form.se_salveaza' : 'actiune.salveaza') | t }}</button>
          <button type="button" (click)="cancel()">{{ 'actiune.renunta' | t }}</button>
        </div>
      </form>
    }
  `,
  styles: `
    .paper { display: flex; flex-direction: column; gap: 4px; text-decoration: none; color: var(--text); border: 2px dashed var(--accent); margin-bottom: 16px; }
    .paper:hover { background: var(--accent-soft); }
    section h2 { margin-top: 0; }
    fieldset { border: 0; padding: 0; margin: 0; }
    legend { font-weight: 600; margin-bottom: 6px; }
    .score { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .score-label { font-weight: 600; min-width: 120px; }
    .score-buttons { display: flex; gap: 6px; }
    .score-buttons button { width: 48px; padding: 0; }
    .score-buttons button.on { background: var(--accent); color: #fff; border-color: var(--accent); }
    .actions { display: flex; gap: 12px; position: sticky; bottom: 0; padding: 12px 0; background: var(--bg); }
    .actions > * { flex: 1; }
    @media (max-width: 767px) { .actions { bottom: 76px; } }
  `,
})
export default class PorumbelForm implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly catalog = inject(CatalogService);
  readonly id = input<string>();
  protected readonly cat = computed(() => this.catalog.catalog());
  readonly d = signal<Draft | null>(null);
  /** Inelul salvat (pentru firimituri), nu cel din formular. */
  readonly savedRing = signal('');
  readonly pairCoi = signal<CoiResult | null>(null);
  protected readonly pct = percent;
  protected readonly ring = ringText;
  protected readonly crumbs = computed<Crumb[]>(() =>
    this.id()
      ? [{ label: t('meniu.panou'), link: ['/panou'] }, { label: this.savedRing() || t('form.porumbel'), link: ['/porumbei', this.id()!] }, { label: t('actiune.editeaza') }]
      : [{ label: t('meniu.panou'), link: ['/panou'] }, { label: t('porumbel.nou') }],
  );
  readonly restored = signal(false);
  private readonly confirm = inject(ConfirmService);
  /** Fișa salvată (sau goală, la porumbel nou): de aici se văd schimbările de confirmat. */
  private original: Draft = empty();
  readonly busy = signal(false);
  readonly error = signal('');

  async ngOnInit() {
    const draft = readDraft(this.id());
    try {
      const saved = this.id() ? (await this.api.get<{ pigeon: Pigeon }>(`/pigeons/${this.id()}`)).pigeon : null;
      this.savedRing.set(saved?.ring?.display ?? '');
      const base = saved ? fromPigeon(saved) : empty();
      this.original = structuredClone(base); // copie: formularul modifică obiectul din d()
      this.d.set(draft ?? base);
      this.restored.set(!!draft);
    } catch (e) {
      this.error.set(errorMessage(e));
      this.d.set(draft ?? empty());
    }
  }

  keep() {
    writeDraft(this.id(), this.d());
  }

  async discardDraft() {
    const ok = await this.confirm.ask({ title: t('form.arunci_titlu'), lines: [t('form.arunci_rand')], confirmLabel: t('form.arunci_da'), danger: true });
    if (!ok) return;
    writeDraft(this.id(), null);
    this.restored.set(false);
    this.ngOnInit();
  }

  /** „Renunță” aruncă și ciorna: altfel modificările lăsate baltă ar reapărea data viitoare peste datele salvate. */
  async cancel() {
    if (this.diff().length) {
      const ok = await this.confirm.ask({ title: t('form.renunti_titlu'), lines: this.diff(), confirmLabel: t('form.renunti_da'), cancelLabel: t('form.inapoi_la_formular'), danger: true });
      if (!ok) return;
    }
    writeDraft(this.id(), null);
    this.router.navigate(this.id() ? ['/porumbei', this.id()] : ['/panou']);
  }

  /** Ce s-a schimbat față de fișa salvată, pe înțelesul omului („Starea: Tânăr → Reproducător”). */
  private diff(): string[] {
    const b = this.d();
    return b ? draftChanges(this.original, b, this.catalog) : [];
  }

  /** Alege un părinte; liniile puiului se propun din liniile părinților, dacă n-ai scris altele. */
  async setParent(side: 'father' | 'mother', p: PigeonSummary | null) {
    const f = this.d()!;
    f[side] = p;
    const lines = (x: PigeonSummary | null | undefined) => ((x as { lines?: string[] } | null | undefined)?.lines ?? []);
    if (!f.lines.trim()) f.lines = [...new Set([...lines(f.father), ...lines(f.mother)])].join(', ');
    this.d.set({ ...f });
    this.keep();
    this.pairCoi.set(null);
    if (f.father && f.mother) {
      try {
        this.pairCoi.set(await this.api.get<CoiResult>(`/pairs/coi?sireId=${f.father.id}&damId=${f.mother.id}`));
      } catch {
        /* fără consangvinizare afișată; nu împiedică salvarea */
      }
    }
  }

  setScore(code: string, n: number) {
    const f = this.d()!;
    f.scores[code] = f.scores[code] === n ? null : n;
    this.d.set({ ...f });
    this.keep();
  }

  async save() {
    const f = this.d()!;
    // Porumbel existent: întâi arătăm ce se schimbă și cerem confirmarea (cerut de utilizator).
    if (this.id()) {
      const diff = this.diff();
      if (!diff.length) {
        writeDraft(this.id(), null);
        this.router.navigate(['/porumbei', this.id()]);
        return;
      }
      if (!(await this.confirm.ask({ title: t('form.salvezi_titlu'), lines: diff, confirmLabel: t('form.salvezi_da') }))) return;
    }
    this.busy.set(true);
    this.error.set('');
    const body = draftBody(f);
    try {
      const r = this.id()
        ? await this.api.patch<{ pigeon: Pigeon }>(`/pigeons/${this.id()}`, body)
        : await this.api.post<{ pigeon: Pigeon }>('/pigeons', body);
      // Porumbel nou: părinții aleși la început se leagă acum. Dacă legarea nu merge (de ex. o greșeală de sex),
      // porumbelul e oricum salvat, iar părinții se aleg din nou în fișa lui.
      if (!this.id() && (f.father || f.mother)) {
        await this.api
          .put(`/pigeons/${r.pigeon.id}/parents`, { fatherId: f.father?.id ?? null, motherId: f.mother?.id ?? null })
          .catch(() => undefined);
      }
      writeDraft(this.id(), null);
      this.router.navigate(['/porumbei', r.pigeon.id], { queryParams: this.id() ? {} : { nou: 1 } });
    } catch (e) {
      // Fără legătură cu serverul (status 0): mesajul spune ce să facă; altfel, eroarea serverului.
      this.error.set(e instanceof HttpErrorResponse && e.status === 0 ? t('form.fara_internet') : errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
