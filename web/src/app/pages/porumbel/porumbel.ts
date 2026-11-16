import { Component, computed, inject, input, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CatalogService, sexLabel } from '../../core/catalog';
import { Family, JournalEntry, Pigeon } from '../../core/models';
import { PigeonChip } from '../../shared/pigeon-chip';
import { ParentsEditor } from '../../shared/parents-editor';
import { Arbore } from './arbore';
import { Breadcrumbs } from '../../shared/breadcrumbs';
import { Icon, IconName } from '../../shared/icon';

type Tab = 'fisa' | 'rude' | 'arbore' | 'jurnal';
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'fisa', label: 'Fișa', icon: 'porumbel' },
  { id: 'rude', label: 'Rude', icon: 'rude' },
  { id: 'arbore', label: 'Pedigree', icon: 'fisa' },
  { id: 'jurnal', label: 'Jurnal', icon: 'jurnal' },
];

@Component({
  selector: 'app-porumbel',
  imports: [FormsModule, RouterLink, PigeonChip, ParentsEditor, Arbore, Icon, Breadcrumbs],
  template: `
    @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
    @if (p(); as p) {
      <app-breadcrumbs [items]="[{ label: 'Panou', link: ['/panou'] }, { label: p.ring?.display ?? 'Fără inel' }]" />
      <div class="title">
        <div>
          <h1><span class="mono">{{ p.ring?.display ?? 'Fără inel' }}</span>@if (p.name) { <span class="name"> „{{ p.name }}”</span> }</h1>
          <p class="row sub">
            <span [class]="'sex-' + (p.sex ?? '')">{{ sexLabel(p.sex) }}</span>
            @if (p.status) { <span class="badge">{{ catalog.label('statuses', p.status) }}</span> }
            @if (p.kind === 'external') { <span class="badge">din alt porumbar</span> }
          </p>
        </div>
        <div class="row">
          <a class="btn" [routerLink]="['/arbore']" [queryParams]="{ porumbel: p.id }"><app-icon name="retea" />Vezi în arbore</a>
          <a class="btn" [routerLink]="['/porumbei', p.id, 'editeaza']"><app-icon name="editeaza" />Editează</a>
        </div>
      </div>

      <nav class="tabs" role="tablist">
        @for (t of tabs; track t.id) {
          <button type="button" role="tab" [attr.aria-selected]="tab() === t.id" [class.on]="tab() === t.id" (click)="tab.set(t.id)">
            <app-icon [name]="t.icon" [size]="26" /><span>{{ t.label }}</span>
          </button>
        }
      </nav>

      @switch (tab()) {
        @case ('fisa') {
          <section class="card stack">
            <dl class="facts">
              <dt>Rasa</dt><dd>{{ catalog.label('breeds', p.breed) }}</dd>
              @if (p.lines.length) { <dt>Linii</dt><dd>{{ p.lines.join(', ') }}</dd> }
              <dt>Culoare</dt>
              <dd>{{ catalog.label('colors', p.color) || '—' }}@if (p.colorPa) {, pene albe}@if (p.colorText) { <span class="muted">({{ p.colorText }})</span>}</dd>
              @if (p.eyeColor) { <dt>Ochi</dt><dd>{{ catalog.label('eyeColors', p.eyeColor) }}</dd> }
              @if (p.hatchedOn) { <dt>Eclozat</dt><dd>{{ p.hatchedOn }}</dd> }
              @if (p.breederText) { <dt>Crescător</dt><dd>{{ p.breederText }}</dd> }
              @if (p.ring && p.ring.raw !== p.ring.display) { <dt>Inel scris</dt><dd class="mono">{{ p.ring.raw }}</dd> }
            </dl>
            @if (p.pedigreeText) { <h3>Pe pedigree</h3><p class="pre">{{ p.pedigreeText }}</p> }
            @if (hasEvaluation()) {
              <h3>Evaluare</h3>
              <dl class="facts">
                @for (c of catalog.catalog()?.evalCriteria ?? []; track c.code) {
                  @if (p.evaluation.scores?.[c.code]; as s) { <dt>{{ c.label }}</dt><dd>{{ '★'.repeat(s) }}{{ '☆'.repeat(5 - s) }} <span class="muted">{{ s }}/5</span></dd> }
                }
              </dl>
              @if (p.evaluation.calitati) { <p><strong>Calități:</strong> {{ p.evaluation.calitati }}</p> }
              @if (p.evaluation.deDorit) { <p><strong>De dorit:</strong> {{ p.evaluation.deDorit }}</p> }
              @if (p.evaluation.defecte) { <p><strong>Defecte:</strong> {{ p.evaluation.defecte }}</p> }
            }
          </section>
          <h2>Părinții</h2>
          <app-parents-editor [pigeonId]="p.id" [initialFather]="family()?.father ?? null" [initialMother]="family()?.mother ?? null"
                              (saved)="parentsSaved($event)" />
        }
        @case ('rude') {
          @if (family(); as f) {
            <section class="card stack">
              <h3>Tatăl</h3><app-pigeon-chip [pigeon]="f.father" />
              <h3>Mama</h3><app-pigeon-chip [pigeon]="f.mother" />
              <h3>Frați și surori ({{ f.fullSiblings.length }})</h3>
              @for (x of f.fullSiblings; track x.id) { <app-pigeon-chip [pigeon]="x" /> } @empty { <p class="muted">Niciunul în porumbar.</p> }
              <h3>Frați vitregi — un singur părinte comun ({{ f.halfSiblings.length }})</h3>
              @for (x of f.halfSiblings; track x.id) { <app-pigeon-chip [pigeon]="x" /> } @empty { <p class="muted">Niciunul în porumbar.</p> }
              <h3>Pui ({{ f.offspring.length }})</h3>
              @for (x of f.offspring; track x.id) { <app-pigeon-chip [pigeon]="x" /> } @empty { <p class="muted">Niciunul în porumbar.</p> }
            </section>
          }
        }
        @case ('arbore') {
          <app-arbore [pigeonId]="p.id" [version]="version()" (addParent)="openParent($event.id)" />
        }
        @case ('jurnal') {
          <form class="card stack" (ngSubmit)="addEntry()">
            <div class="row">
              <label class="field grow">Data <input type="date" name="jdate" [(ngModel)]="jDate" required /></label>
              <label class="field grow">Ce e
                <select name="jtype" [(ngModel)]="jType">
                  @for (t of catalog.catalog()?.journalTypes ?? []; track t.code) { <option [value]="t.code">{{ t.label }}</option> }
                </select>
              </label>
            </div>
            <label class="field">Notă <textarea name="jtext" [(ngModel)]="jText" required></textarea></label>
            @if (jError()) { <div class="error" role="alert">{{ jError() }}</div> }
            <button class="primary" type="submit" [disabled]="!jText.trim()">Adaugă în jurnal</button>
          </form>
          <ul class="entries">
            @for (e of journal(); track e.id) {
              <li class="card">
                <div class="row between"><strong>{{ e.date }} · {{ catalog.label('journalTypes', e.type) }}</strong>
                  <button type="button" class="link" (click)="removeEntry(e)">Șterge</button></div>
                <p class="pre">{{ e.text }}</p>
              </li>
            } @empty { <p class="muted">Nicio notă încă.</p> }
          </ul>
        }
      }
    }
  `,
  styles: `
    .title { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
    .title h1 { margin-bottom: 4px; }
    .name { font-weight: 400; }
    .sub { margin: 0 0 12px; }
    .tabs { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; margin: 12px 0 18px; padding: 6px; background: var(--surface-2); border-radius: 20px; }
    .tabs button {
      border: 0; border-radius: 14px; background: none; color: var(--muted); flex-direction: column; gap: 2px;
      min-height: 64px; padding: 6px 4px; font-size: 0.85rem;
    }
    .tabs button.on { background: var(--surface); color: var(--accent-strong); box-shadow: var(--shadow); }
    .facts { display: grid; grid-template-columns: max-content 1fr; gap: 6px 16px; margin: 0; }
    .facts dt { font-weight: 600; color: var(--muted); }
    .facts dd { margin: 0; }
    .pre { white-space: pre-wrap; }
    .grow { flex: 1 1 160px; }
    .between { justify-content: space-between; }
    .entries { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  `,
})
export default class Porumbel {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly catalog = inject(CatalogService);
  readonly id = input.required<string>();
  protected readonly tabs = TABS;
  protected readonly sexLabel = sexLabel;

  readonly tab = signal<Tab>('fisa');
  readonly p = signal<Pigeon | null>(null);
  readonly family = signal<Family | null>(null);
  readonly journal = signal<JournalEntry[]>([]);
  readonly version = signal(0);
  readonly error = signal('');
  readonly jError = signal('');
  jDate = new Date().toISOString().slice(0, 10);
  jType = 'nota';
  jText = '';
  protected readonly hasEvaluation = computed(() => {
    const e = this.p()?.evaluation;
    return !!e && (Object.keys(e.scores ?? {}).length > 0 || !!e.calitati || !!e.deDorit || !!e.defecte);
  });

  constructor() {
    effect(() => {
      const id = this.id();
      this.tab.set('fisa');
      this.load(id);
    });
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

  async removeEntry(e: JournalEntry) {
    if (!confirm('Ștergi această notă?')) return;
    await this.api.delete(`/journal/${e.id}`);
    this.journal.update((list) => list.filter((x) => x.id !== e.id));
  }

}
