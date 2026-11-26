import { Component, computed, inject, input, signal, effect, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CatalogService, ringText, sexLabel } from '../../core/catalog';
import { TPipe, formatDay, t, GluePipe, glue } from '../../core/i18n';
import { Family, JournalEntry, Pigeon } from '../../core/models';
import { PigeonChip } from '../../shared/pigeon-chip';
import { ParentsEditor } from '../../shared/parents-editor';
import { Arbore } from './arbore';
import { Partajare } from './partajare';
import RezultateToate from '../rezultate/rezultate-toate';
import ConcursRezultate from '../concurs/concurs-rezultate';
import { FisaEditabila } from './fisa-editabila';
import { Breadcrumbs, Crumb } from '../../shared/breadcrumbs';
import { ConfirmService } from '../../core/confirm';
import { IconName } from '../../shared/icon';
import { DateField } from '../../shared/date-field';
import { todayIso } from '../../core/today';

type Tab = 'fisa' | 'rezultate' | 'introdu' | 'rude' | 'arbore' | 'jurnal' | 'qr';
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'fisa', label: 'porumbel.fila_fisa', icon: 'porumbel' },
  { id: 'rezultate', label: 'porumbel.fila_rezultate', icon: 'cupa' },
  { id: 'introdu', label: 'porumbel.fila_introdu', icon: 'plus' },
  { id: 'rude', label: 'porumbel.fila_rude', icon: 'rude' },
  { id: 'arbore', label: 'porumbel.fila_arbore', icon: 'fisa' },
  { id: 'jurnal', label: 'porumbel.fila_jurnal', icon: 'jurnal' },
  { id: 'qr', label: 'porumbel.fila_qr', icon: 'qr' },
];

@Component({
  selector: 'app-porumbel',
  imports: [DateField, FormsModule, RouterLink, PigeonChip, ParentsEditor, Arbore, Breadcrumbs, Partajare, RezultateToate, ConcursRezultate, FisaEditabila, TPipe, GluePipe],
  template: `
    @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
    @if (p(); as p) {
      <app-breadcrumbs [items]="[origin(), { label: ring(p) }]" />
      <div class="title">
        <div>
          <h1><span class="mono">{{ ring(p) }}</span>@if (p.name) { <span class="name">{{ ' „' | glue }}{{ p.name }}{{ '”' | glue }}</span> }</h1>
          <p class="row sub">
            <span [class]="'sex-' + (p.sex ?? '')">{{ sexLabel(p.sex) }}</span>
            @if (p.status) { <span class="badge">{{ catalog.label('statuses', p.status) }}</span> }
            @if (p.kind === 'external') { <span class="badge">{{ 'porumbel.nu_e_al_meu_mic' | t }}</span> }
          </p>
        </div>
      </div>

      <!-- Filele fișei (și „Vezi în arbore”, „Înapoi”) stau în banda de submeniuri de sus (app.ts), după ?fila=. -->

      @switch (tab()) {
        @case ('fisa') {
          <!-- Tot ce are fișa, pe secțiuni; fiecare secțiune se schimbă pe loc („Schimbă”). -->
          <app-fisa-editabila [pigeon]="p" (saved)="pigeonSaved($event)" />
          <h2>{{ 'porumbel.parintii' | t }}</h2>
          <app-parents-editor [pigeonId]="p.id" [initialFather]="family()?.father ?? null" [initialMother]="family()?.mother ?? null"
                              (saved)="parentsSaved($event)" />

          <!-- Ștergerea: doar acest porumbel, cu confirmare; departe de restul butoanelor, ca să nu fie apăsată din greșeală. -->
          <section class="card stack delete-zone">
            <h3>{{ 'porumbel.stergerea' | t }}</h3>
            <p class="muted">{{ 'porumbel.stergerea_text' | t }}</p>
            @if (deleteError()) { <div class="error" role="alert">{{ deleteError() }}</div> }
            <div><button type="button" class="danger" (click)="removePigeon(p)">{{ 'porumbel.sterge_buton' | t: { inel: p.ring?.display ?? '' } }}</button></div>
          </section>
        }
        @case ('rude') {
          @if (family(); as f) {
            <section class="card stack">
              <h3>{{ 'porumbel.tatal' | t }}</h3><app-pigeon-chip [pigeon]="f.father" />
              <h3>{{ 'porumbel.mama' | t }}</h3><app-pigeon-chip [pigeon]="f.mother" />
              <h3>{{ 'porumbel.frati' | t: { numar: f.fullSiblings.length } }}</h3>
              @for (x of f.fullSiblings; track x.id) { <app-pigeon-chip [pigeon]="x" /> } @empty { <p class="muted">{{ 'porumbel.niciunul' | t }}</p> }
              <h3>{{ 'porumbel.frati_vitregi' | t: { numar: f.halfSiblings.length } }}</h3>
              @for (x of f.halfSiblings; track x.id) { <app-pigeon-chip [pigeon]="x" /> } @empty { <p class="muted">{{ 'porumbel.niciunul' | t }}</p> }
              <h3>{{ 'porumbel.pui' | t: { numar: f.offspring.length } }}</h3>
              @for (x of f.offspring; track x.id) { <app-pigeon-chip [pigeon]="x" /> } @empty { <p class="muted">{{ 'porumbel.niciunul' | t }}</p> }
            </section>
          }
        }
        @case ('arbore') {
          <app-arbore [pigeonId]="p.id" [version]="version()" (addParent)="openParent($event.id)" />
        }
        @case ('rezultate') {
          <!-- Același tabel ca la Rezultate concurs → Listare rezultate, doar cu rezultatele acestui porumbel. -->
          <app-rezultate-toate [pigeonId]="p.id" />
        }
        @case ('introdu') {
          <!-- Același ecran ca la Rezultate concurs → Introdu rezultat nou; porumbelul acesta e primul în listă. -->
          <app-concurs-rezultate [focusPigeon]="p.id" (saved)="showTab('rezultate')" />
        }
        @case ('qr') {
          <app-partajare [pigeon]="p" />
        }
        @case ('jurnal') {
          <form class="card stack" (ngSubmit)="addEntry()">
            <div class="row">
              <label class="field grow">{{ 'camp.data' | t }} <app-date name="jdate" [(ngModel)]="jDate" required /></label>
              <label class="field grow">{{ 'porumbel.jurnal_tip' | t }}
                <select name="jtype" [(ngModel)]="jType">
                  @for (jt of catalog.catalog()?.journalTypes ?? []; track jt.code) { <option [value]="jt.code">{{ jt.label }}</option> }
                </select>
              </label>
            </div>
            <label class="field">{{ 'camp.nota' | t }} <textarea name="jtext" [(ngModel)]="jText" required></textarea></label>
            @if (jError()) { <div class="error" role="alert">{{ jError() }}</div> }
            <button class="primary" type="submit" [disabled]="!jText.trim()">{{ 'porumbel.adauga_in_jurnal' | t }}</button>
          </form>
          <ul class="entries">
            @for (e of journal(); track e.id) {
              <li class="card">
                <div class="row between"><strong>{{ day(e.date) }} · {{ catalog.label('journalTypes', e.type) }}</strong>
                  <!-- Intrarea scrisă de un tratament se schimbă sau se șterge doar din tratament. -->
                  @if (e.treatmentId) {
                    <a class="link-btn" [routerLink]="['/tratamente', e.treatmentId]">{{ 'tratamente.vezi_tratamentul' | t }}</a>
                  } @else {
                    <button type="button" class="link" (click)="removeEntry(e)">{{ 'actiune.sterge' | t }}</button>
                  }</div>
                <p class="pre">{{ e.text }}</p>
              </li>
            } @empty { <p class="muted">{{ 'porumbel.nicio_nota' | t }}</p> }
          </ul>
        }
      }
    }
  `,
  styles: `
    .delete-zone { margin-top: 28px; border-color: #e7b4ae; }
    .delete-zone h3 { margin: 0; }
    .delete-zone p { margin: 0; }
    .title { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
    .title h1 { margin-bottom: 4px; }
    .name { font-weight: 400; }
    .sub { margin: 0 0 12px; }
    .facts { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0; }
    .facts dt { font-weight: 600; color: var(--muted); }
    .facts dd { margin: 0; }
    .pre { white-space: pre-wrap; }
    .grow { flex: 1 1 160px; }
    .between { justify-content: space-between; }
    .entries { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
    .link-btn { display: inline-flex; align-items: center; min-height: 44px; padding: 8px 4px; font-weight: 600; }
  `,
})
export default class Porumbel {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  protected readonly catalog = inject(CatalogService);
  readonly id = input.required<string>();
  protected readonly day = formatDay;
  /** De unde a venit omul (?din=arbore|lista; arbore3d = linkuri vechi), ca firimiturile să-l întoarcă acolo. */
  readonly din = input<string>();
  readonly radacina = input<string>();
  readonly tot = input<string>();
  readonly vedere = input<string>();
  /** Fila deschisă la intrare (?fila=qr, de ex. din Vânzări). */
  readonly fila = input<string>();
  protected readonly origin = computed<Crumb>(() => {
    const q = { porumbel: this.radacina() || undefined, tot: this.tot() || undefined, vedere: this.vedere() || undefined };
    switch (this.din()) {
      case 'arbore': return { label: t('meniu.arbore'), link: ['/arbore'], query: q };
      case 'arbore3d': return { label: t('meniu.arbore'), link: ['/arbore'], query: { ...q, vedere: undefined } };
      case 'lista': return { label: t('porumbel.firimitura_lista'), link: ['/porumbar'] };
      default: return { label: t('meniu.panou'), link: ['/panou'] };
    }
  });
  protected readonly tabs = TABS;
  protected readonly sexLabel = sexLabel;
  protected readonly ring = ringText;

  readonly tab = signal<Tab>('fisa');
  readonly p = signal<Pigeon | null>(null);
  readonly family = signal<Family | null>(null);
  readonly journal = signal<JournalEntry[]>([]);
  readonly version = signal(0);
  readonly error = signal('');
  readonly jError = signal('');
  jDate = todayIso();
  jType = 'nota';
  jText = '';

  constructor() {
    // Fila vine din adresă (?fila=, din banda de submeniuri); porumbelul se încarcă doar când se schimbă el.
    effect(() => {
      const fila = this.fila();
      this.tab.set(TABS.some((t) => t.id === fila) ? (fila as Tab) : 'fisa');
    });
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  /** Trece la altă filă (prin adresă, ca banda de sus să se aprindă la fel). */
  showTab(tab: Tab) {
    this.router.navigate([], { queryParams: { fila: tab === 'fisa' ? undefined : tab }, queryParamsHandling: 'merge' });
  }

  /** După „Salvează” într-o secțiune a fișei: porumbelul nou peste cel vechi (și arborele din fila Pedigree). */
  pigeonSaved(p: Pigeon) {
    this.p.set(p);
    this.version.update((v) => v + 1);
  }

  private async load(id: string) {
    try {
      const [p, f, j] = await Promise.all([
        this.api.get<{ pigeon: Pigeon }>(`/pigeons/${id}`),
        this.api.get<Family>(`/pigeons/${id}/family`),
        this.api.get<{ entries: JournalEntry[] }>(`/pigeons/${id}/journal`),
      ]);
      this.p.set(p.pigeon);
      this.family.set(f);
      this.journal.set(j.entries);
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async parentsSaved(p: Pigeon) {
    this.p.set(p);
    this.family.set(await this.api.get<Family>(`/pigeons/${p.id}/family`));
    this.version.update((v) => v + 1);
  }

  openParent(id: number) {
    if (id === this.p()?.id) this.tab.set('fisa');
    else this.router.navigate(['/porumbei', id]);
  }

  async addEntry() {
    this.jError.set('');
    try {
      await this.api.post(`/pigeons/${this.id()}/journal`, { date: this.jDate, type: this.jType, text: this.jText });
      this.jText = '';
      this.journal.set((await this.api.get<{ entries: JournalEntry[] }>(`/pigeons/${this.id()}/journal`)).entries);
    } catch (e) {
      this.jError.set(errorMessage(e));
    }
  }

  readonly deleteError = signal('');

  /** Șterge porumbelul deschis (unul singur), după o confirmare care spune exact ce se pierde. */
  async removePigeon(p: Pigeon) {
    this.deleteError.set('');
    const who = [p.ring?.display ?? t('text.fara_inel'), p.name ? glue('„') + p.name + glue('”') : ''].filter(Boolean).join(glue(' '));
    const ok = await this.confirm.ask({
      title: t('porumbel.sterge_titlu', { cine: who }),
      lines: [t('porumbel.sterge_rand1'), t('porumbel.sterge_rand2'), t('text.nu_se_poate_da_inapoi')],
      confirmLabel: t('porumbel.sterge_da'),
      danger: true,
    });
    if (!ok) return;
    try {
      await this.api.delete(`/pigeons/${p.id}`);
      this.router.navigate(['/panou']);
    } catch (e) {
      this.deleteError.set(errorMessage(e));
    }
  }

  async removeEntry(e: JournalEntry) {
    const ok = await this.confirm.ask({
      title: t('porumbel.sterge_nota_titlu'),
      lines: [`${formatDay(e.date)} · ${this.catalog.label('journalTypes', e.type)}${glue(': ')}${e.text.slice(0, 80)}`, t('text.nu_se_poate_da_inapoi')],
      confirmLabel: t('actiune.da_sterge'),
      danger: true,
    });
    if (!ok) return;
    await this.api.delete(`/journal/${e.id}`);
    this.journal.update((list) => list.filter((x) => x.id !== e.id));
  }

}
