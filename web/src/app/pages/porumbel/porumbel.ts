import { Component, computed, inject, input, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CatalogService, sexLabel } from '../../core/catalog';
import { Family, JournalEntry, Photo, Pigeon } from '../../core/models';
import { PigeonChip } from '../../shared/pigeon-chip';
import { ParentsEditor } from '../../shared/parents-editor';
import { Arbore } from './arbore';
import { Icon, IconName } from '../../shared/icon';

/** Pozele de pe telefon sunt mari: le micșorăm la cel mult 2000 px înainte de trimitere (mai rapid pe date mobile). */
async function shrink(file: File, max = 2000): Promise<Blob> {
  try {
    const img = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    if (scale === 1 && file.size < 2_000_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}

type Tab = 'fisa' | 'rude' | 'arbore' | 'jurnal' | 'poze';
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'fisa', label: 'Fișa', icon: 'fisa' },
  { id: 'rude', label: 'Rude', icon: 'rude' },
  { id: 'arbore', label: 'Arbore', icon: 'arbore' },
  { id: 'jurnal', label: 'Jurnal', icon: 'jurnal' },
  { id: 'poze', label: 'Poze', icon: 'poze' },
];
const PHOTO_KINDS = [
  { code: 'corp', label: 'Corp' },
  { code: 'aripa', label: 'Aripă' },
  { code: 'ochi', label: 'Ochi' },
  { code: 'altele', label: 'Altele' },
];

@Component({
  selector: 'app-porumbel',
  imports: [FormsModule, RouterLink, PigeonChip, ParentsEditor, Arbore, Icon],
  template: `
    @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
    @if (p(); as p) {
      <div class="title">
        <div>
          <h1><span class="mono">{{ p.ring?.display ?? 'Fără inel' }}</span>@if (p.name) { <span class="name"> „{{ p.name }}”</span> }</h1>
          <p class="row sub">
            <span [class]="'sex-' + (p.sex ?? '')">{{ sexLabel(p.sex) }}</span>
            @if (p.status) { <span class="badge">{{ catalog.label('statuses', p.status) }}</span> }
            @if (p.kind === 'external') { <span class="badge">strămoș (al altcuiva)</span> }
          </p>
        </div>
        <div class="row">
          <a class="btn" [routerLink]="['/retea']" [queryParams]="{ porumbel: p.id }"><app-icon name="retea" />Rețea</a>
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
        @case ('poze') {
          <div class="card stack">
            <label class="field">Ce arată poza
              <select name="pkind" [(ngModel)]="photoKind">
                @for (k of photoKinds; track k.code) { <option [value]="k.code">{{ k.label }}</option> }
              </select>
            </label>
            <label class="btn primary upload">
              <app-icon name="poze" /> Fă o poză sau alege din telefon
              <input type="file" accept="image/jpeg,image/png,image/webp" (change)="upload($event)" hidden />
            </label>
            @if (pError()) { <div class="error" role="alert">{{ pError() }}</div> }
          </div>
          <div class="photos">
            @for (ph of photos(); track ph.id) {
              <figure class="card">
                <img [src]="ph.url" [alt]="'Poză: ' + kindLabel(ph.kind)" loading="lazy" />
                <figcaption class="row between">{{ kindLabel(ph.kind) }} <button type="button" class="link" (click)="removePhoto(ph)">Șterge</button></figcaption>
              </figure>
            } @empty { <p class="muted">Nicio poză încă.</p> }
          </div>
        }
      }
    }
  `,
  styles: `
    .title { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
    .title h1 { margin-bottom: 4px; }
    .name { font-weight: 400; }
    .sub { margin: 0 0 12px; }
    .tabs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin: 12px 0 18px; padding: 6px; background: var(--surface-2); border-radius: 20px; }
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
    .upload { cursor: pointer; }
    .photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin-top: 12px; }
    .photos figure { margin: 0; padding: 8px; }
    .photos img { width: 100%; border-radius: 10px; display: block; aspect-ratio: 4 / 3; object-fit: cover; background: var(--surface-2); }
  `,
})
export default class Porumbel {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  protected readonly catalog = inject(CatalogService);
  readonly id = input.required<string>();
  protected readonly tabs = TABS;
  protected readonly photoKinds = PHOTO_KINDS;
  protected readonly sexLabel = sexLabel;

  readonly tab = signal<Tab>('fisa');
  readonly p = signal<Pigeon | null>(null);
  readonly family = signal<Family | null>(null);
  readonly journal = signal<JournalEntry[]>([]);
  readonly photos = signal<Photo[]>([]);
  readonly version = signal(0);
  readonly error = signal('');
  readonly jError = signal('');
  readonly pError = signal('');
  jDate = new Date().toISOString().slice(0, 10);
  jType = 'nota';
  jText = '';
  photoKind = 'corp';
  protected readonly hasEvaluation = computed(() => {
    const e = this.p()?.evaluation;
    return !!e && (Object.keys(e.scores ?? {}).length > 0 || !!e.calitati || !!e.deDorit || !!e.defecte);
  });
  protected readonly kindLabel = (k: string) => PHOTO_KINDS.find((x) => x.code === k)?.label ?? k;

  constructor() {
    effect(() => {
      const id = this.id();
      this.tab.set('fisa');
      this.load(id);
    });
  }

  private async load(id: string) {
    try {
      const [p, f, j, ph] = await Promise.all([
        this.api.get<{ pigeon: Pigeon }>(`/pigeons/${id}`),
        this.api.get<Family>(`/pigeons/${id}/family`),
        this.api.get<{ entries: JournalEntry[] }>(`/pigeons/${id}/journal`),
        this.api.get<{ photos: Photo[] }>(`/pigeons/${id}/photos`),
      ]);
      this.p.set(p.pigeon);
      this.family.set(f);
      this.journal.set(j.entries);
      this.photos.set(ph.photos);
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

  async upload(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.pError.set('');
    try {
      const r = await this.api.upload<{ photo: Photo }>(`/pigeons/${this.id()}/photos?kind=${this.photoKind}`, await shrink(file));
      this.photos.update((list) => [...list, r.photo]);
    } catch (e) {
      this.pError.set(errorMessage(e));
    }
  }

  async removePhoto(ph: Photo) {
    if (!confirm('Ștergi această poză?')) return;
    await this.api.delete(`/photos/${ph.id}`);
    this.photos.update((list) => list.filter((x) => x.id !== ph.id));
  }
}
