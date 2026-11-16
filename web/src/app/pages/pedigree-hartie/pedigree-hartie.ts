import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService } from '../../core/confirm';
import { Kind, LookupResult } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Breadcrumbs } from '../../shared/breadcrumbs';
import { previewRing } from '../../shared/ring-input';
import { GENERATION_NAMES, roleName } from '../retea/arbore-data';
import { CititorPoza, PedigreeNode } from './cititor-poza';

/*
 * „Pedigree pe hârtie”: pedigree-ul primit de la cineva (hârtie, PDF, poză) se trece tot dintr-o dată, în 31 de
 * căsuțe așezate ca pe foaie: porumbelul în stânga, părinții, bunicii, străbunicii, răstrăbunicii spre dreapta.
 * Căsuța i: tatăl e 2i, mama 2i + 1 (1 = porumbelul). Un inel pe care îl ai deja e recunoscut și părinții lui
 * cunoscuți se completează singuri. Ciorna stă pe telefon până la salvare. Serverul: POST /api/pedigrees/import.
 */

interface Slot {
  ring: string;
  name: string;
  color: string;
  text: string;
}
interface Hint {
  kind: 'existing' | 'new' | 'bad' | 'unringed' | 'filled';
  text: string;
}
interface ImportResult {
  pigeonId: number;
  created: number;
  reused: number;
  conflicts: { ring: string; message: string }[];
}
interface Draft {
  kind: Kind;
  sex: '' | 'M' | 'F';
  slots: Slot[];
}

const SLOTS = 31;
const DRAFT_KEY = 'porumbar.ciorna.pedigree-hartie';
const blank = (): Slot => ({ ring: '', name: '', color: '', text: '' });
const emptyDraft = (): Draft => ({ kind: 'own', sex: '', slots: Array.from({ length: SLOTS + 1 }, blank) });
const genOf = (i: number) => Math.floor(Math.log2(i));
const pathOf = (i: number): ('F' | 'M')[] => {
  const out: ('F' | 'M')[] = [];
  for (let x = i; x > 1; x = Math.floor(x / 2)) out.unshift(x % 2 ? 'M' : 'F');
  return out;
};
const filled = (s: Slot) => !!(s.ring.trim() || s.name.trim() || s.color.trim() || s.text.trim());

function readDraft(): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
    return d && Array.isArray(d.slots) && d.slots.length === SLOTS + 1 ? d : null;
  } catch {
    return null;
  }
}
function writeDraft(d: Draft | null) {
  try {
    if (d && d.slots.some(filled)) localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* fără memorie locală: ciorna nu se păstrează */
  }
}

@Component({
  selector: 'app-pedigree-hartie',
  imports: [FormsModule, RouterLink, Icon, Breadcrumbs, CititorPoza],
  template: `
    <div class="wide">
      <app-breadcrumbs [items]="[{ label: 'Porumbel nou', link: ['/porumbei/nou'] }, { label: 'Pedigree pe hârtie' }]" />
      <div class="head">
        <div>
          <h1>Pedigree pe hârtie</h1>
          <p class="muted intro">Ai primit un pedigree pe hârtie, în PDF sau în poză? Trece-l aici tot dintr-o dată. Inelele pe care le ai deja în program sunt recunoscute și nu se dublează.</p>
        </div>
      </div>

      @if (result(); as r) {
        <section class="card done" role="status">
          <h2><app-icon name="bifa" />Pedigree-ul e în program</h2>
          <p>{{ r.created }} {{ r.created === 1 ? 'porumbel nou' : 'porumbei noi' }}, {{ r.reused }} {{ r.reused === 1 ? 'era deja' : 'erau deja' }} în program.</p>
          @if (r.conflicts.length) {
            <div class="warning stack">
              <strong>De verificat ({{ r.conflicts.length }}):</strong>
              @for (c of r.conflicts; track $index) { <span>{{ c.message }}</span> }
            </div>
          }
          <div class="row">
            <a class="btn primary" [routerLink]="['/porumbei', r.pigeonId]"><app-icon name="fisa" />Deschide fișa</a>
            <a class="btn" [routerLink]="['/arbore']" [queryParams]="{ porumbel: r.pigeonId }"><app-icon name="ramificare" />Vezi arborele</a>
            <button type="button" (click)="startOver()"><app-icon name="plus" />Încă un pedigree</button>
          </div>
        </section>
      } @else {
        @if (restored()) {
          <div class="notice row" role="status">
            Am păstrat ce scriseseși data trecută.
            <button type="button" class="link" (click)="clearAll()">Începe de la zero</button>
          </div>
        }

        <app-cititor-poza (read)="fillFromReading($event)" />

        <section class="card top-fields">
          <fieldset class="kind">
            <legend>Porumbelul de pe pedigree este</legend>
            <label><input type="radio" name="kind" value="own" [ngModel]="d().kind" (ngModelChange)="setKind($event)" /> Din porumbarul meu</label>
            <label><input type="radio" name="kind" value="external" [ngModel]="d().kind" (ngModelChange)="setKind($event)" /> Din alt porumbar <span class="muted">(de ex. împrumutat pentru pui)</span></label>
          </fieldset>
          <label class="sex">Sexul porumbelului
            <select [ngModel]="d().sex" (ngModelChange)="setSex($event)">
              <option value="">nu știu</option>
              <option value="M">Mascul</option>
              <option value="F">Femelă</option>
            </select>
          </label>
        </section>

        <div class="heads" aria-hidden="true">
          @for (g of gens; track g) { <div>{{ genName(g) }}</div> }
        </div>
        <div class="sheet">
          @for (i of indexes; track i) {
            @let s = d().slots[i];
            @let g = gen(i);
            <div class="slot" [class]="'slot g' + g" [style.grid-column]="g + 1" [style.grid-row]="rowOf(i)"
                 [class.hidden-mobile]="g >= 3 && !openGen()[g]" [class.has]="filled(s)">
              @if (i === 1 || i === 2 || i === 4 || i === 8 || i === 16) {
                <button type="button" class="gen-toggle" (click)="toggleGen(g)" [attr.aria-expanded]="g < 3 || openGen()[g]">
                  {{ genName(g) }} <span class="muted">({{ countIn(g) }}/{{ 2 ** g }})</span>
                </button>
              }
              <div class="role">
                @if (i > 1) { <span class="av" [class]="'av sex-' + (i % 2 ? 'F' : 'M')">{{ i % 2 ? 'F' : 'M' }}</span> }
                {{ role(i) }}
              </div>
              <input class="mono ring" [ngModel]="s.ring" (ngModelChange)="set(i, 'ring', $event)" (blur)="check(i)"
                     [attr.aria-label]="role(i) + ': inel'" placeholder="Inel, ex. RO-15-412084" autocomplete="off" />
              @if (hints()[i]; as h) { <span class="hint" [class]="'hint ' + h.kind">{{ h.text }}</span> }
              @if (g <= 2) {
                <input [ngModel]="s.name" (ngModelChange)="set(i, 'name', $event)" [attr.aria-label]="role(i) + ': nume'" placeholder="Nume" />
                <input [ngModel]="s.color" (ngModelChange)="set(i, 'color', $event)" [attr.aria-label]="role(i) + ': culoare'" placeholder="Culoare, ex. Solzat p.a." />
              }
              <textarea [rows]="g <= 1 ? 3 : g === 2 ? 2 : 1" [ngModel]="s.text" (ngModelChange)="set(i, 'text', $event)"
                        [attr.aria-label]="role(i) + ': ce scrie pe pedigree'" placeholder="Ce scrie pe pedigree (crescător, rezultate)"></textarea>
            </div>
          }
        </div>

        @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
        <div class="actions">
          <button type="button" class="primary big" [disabled]="saving()" (click)="save()">
            <app-icon name="bifa" />{{ saving() ? 'Se salvează…' : 'Adaugă pedigree-ul (' + count() + ' căsuțe)' }}
          </button>
          <button type="button" class="link" (click)="clearAll()">Golește tot</button>
        </div>
      }
    </div>
  `,
  styles: `
    .wide { width: min(1560px, calc(100vw - 48px)); margin-left: calc((100% - min(1560px, 100vw - 48px)) / 2); }
    .intro { margin: 0 0 12px; max-width: 75ch; }
    .top-fields { display: flex; flex-wrap: wrap; gap: 12px 32px; align-items: flex-end; margin: 12px 0; }
    .kind { border: 0; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 6px 24px; }
    .kind legend { font-weight: 700; margin-bottom: 6px; }
    .kind label { display: flex; align-items: center; gap: 8px; min-height: 44px; }
    .sex { display: flex; flex-direction: column; gap: 4px; font-weight: 700; }
    .heads { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin: 16px 0 6px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.85rem; color: var(--muted); }
    .sheet { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); grid-template-rows: repeat(16, minmax(64px, auto)); gap: 6px 10px; }
    .slot { align-self: center; display: flex; flex-direction: column; gap: 4px; padding: 8px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); }
    .slot.has { border-color: #c2b39c; }
    .slot.g0 { border: 2px solid var(--accent); }
    .slot input, .slot textarea, .slot select { min-height: 38px; padding: 6px 10px; font-size: 0.95rem; border-radius: 10px; }
    .slot textarea { resize: vertical; }
    .slot.g3, .slot.g4 { padding: 6px; gap: 3px; }
    .slot.g3 input, .slot.g4 input, .slot.g3 textarea, .slot.g4 textarea { min-height: 32px; font-size: 0.88rem; padding: 4px 8px; }
    .role { display: flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--accent-strong); }
    .av { width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 0.7rem; color: #fff; }
    .av.sex-M { background: var(--male); }
    .av.sex-F { background: var(--female); }
    .ring { font-weight: 700; }
    .hint { font-size: 0.8rem; font-weight: 600; }
    .hint.existing, .hint.filled { color: var(--ok); }
    .hint.bad { color: var(--danger); }
    .hint.new, .hint.unringed { color: var(--muted); }
    .gen-toggle { display: none; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: 16px; margin: 20px 0 40px; }
    .big { min-height: 56px; font-size: 1.1rem; padding: 0 24px; }
    .done { margin-top: 12px; }
    .done h2 { display: flex; align-items: center; gap: 10px; }
    @media (max-width: 1000px) {
      .wide { width: 100%; margin-left: 0; }
      .heads { display: none; }
      /* Pe ecran îngust: căsuțele pe rând, pe generații; străbunicii și răstrăbunicii se deschid la cerere. */
      .sheet { display: flex; flex-direction: column; gap: 8px; }
      .slot { grid-row: auto !important; grid-column: auto !important; }
      .slot.hidden-mobile { display: none; }
      .gen-toggle { display: flex; justify-content: space-between; margin: 10px -8px 6px; border-radius: 12px; font-weight: 800; }
      .slot.hidden-mobile:has(.gen-toggle) { display: flex; border: 0; background: none; padding: 0; }
      .slot.hidden-mobile:has(.gen-toggle) > :not(.gen-toggle) { display: none; }
    }
  `,
})
export default class PedigreeHartie {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  protected readonly gens = [0, 1, 2, 3, 4];
  protected readonly indexes = Array.from({ length: SLOTS }, (_, k) => k + 1);
  protected readonly gen = genOf;
  protected readonly filled = filled;
  protected readonly genName = (g: number) => GENERATION_NAMES[g];
  protected readonly role = (i: number) => roleName(pathOf(i));

  readonly d = signal<Draft>(readDraft() ?? emptyDraft());
  readonly restored = signal(!!readDraft());
  readonly hints = signal<Record<number, Hint>>({});
  readonly openGen = signal<Record<number, boolean>>({});
  readonly error = signal('');
  readonly saving = signal(false);
  readonly result = signal<ImportResult | null>(null);
  protected readonly count = computed(() => this.d().slots.filter(filled).length);

  constructor() {
    effect(() => {
      const d = this.d();
      untracked(() => writeDraft(this.result() ? null : d));
    });
  }

  /** Rândul din grilă: porumbelul ocupă 16 rânduri, părinții câte 8 … răstrăbunicii câte unul. */
  protected rowOf(i: number) {
    const g = genOf(i);
    const span = 16 / 2 ** g;
    const start = (i - 2 ** g) * span + 1;
    return `${start} / span ${span}`;
  }

  protected countIn(g: number) {
    let n = 0;
    for (let i = 2 ** g; i < 2 ** (g + 1); i++) if (filled(this.d().slots[i])) n++;
    return n;
  }

  toggleGen(g: number) {
    if (g < 3) return;
    this.openGen.set({ ...this.openGen(), [g]: !this.openGen()[g] });
  }

  set(i: number, field: keyof Slot, value: string) {
    const slots = this.d().slots.slice();
    slots[i] = { ...slots[i], [field]: value };
    this.d.set({ ...this.d(), slots });
    if (field === 'ring') {
      const h = { ...this.hints() };
      delete h[i];
      this.hints.set(h);
    }
  }

  setKind(kind: Kind) {
    this.d.set({ ...this.d(), kind });
  }

  setSex(sex: '' | 'M' | 'F') {
    this.d.set({ ...this.d(), sex });
  }

  /** La ieșirea din căsuța inelului: ce a înțeles programul și dacă porumbelul e deja în cont. */
  async check(i: number) {
    const ring = this.d().slots[i].ring.trim();
    if (!ring) return;
    const p = previewRing(ring);
    if (!p.ok) return this.hint(i, { kind: i === 1 && this.d().kind === 'own' ? 'bad' : 'new', text: i === 1 && this.d().kind === 'own' ? 'Inelul nu poate fi citit. Ex.: RO-15-412084' : 'Inel necitit: se trece așa cum e scris.' });
    if (p.unringed) return this.hint(i, { kind: 'unringed', text: 'Fără inel' });
    try {
      const r = await this.api.get<LookupResult>(`/pigeons/lookup?ring=${encodeURIComponent(ring)}`);
      if (this.d().slots[i].ring.trim() !== ring) return; // s-a schimbat între timp
      const m = r.matches[0];
      if (!m) return this.hint(i, { kind: 'new', text: `${p.display} · nou în program` });
      const who = m.pigeon.name ? ` „${m.pigeon.name}”` : '';
      this.hint(i, { kind: 'existing', text: `${r.ring.display}${who} · îl ai deja, se folosește acela` });
      // Părinții pe care programul îi știe deja se completează în căsuțele goale.
      const add: [number, string | undefined][] = [
        [2 * i, m.father?.ring?.display],
        [2 * i + 1, m.mother?.ring?.display],
      ];
      for (const [k, parentRing] of add) {
        if (k > SLOTS || !parentRing || filled(this.d().slots[k])) continue;
        this.set(k, 'ring', parentRing);
        this.hint(k, { kind: 'filled', text: 'Completat din program' });
        await this.check(k);
      }
    } catch {
      /* fără rețea: doar nu arătăm nimic */
    }
  }

  private hint(i: number, h: Hint) {
    this.hints.set({ ...this.hints(), [i]: h });
  }

  /** Căsuțele completate din citirea pozei / PDF-ului (doar cele goale; ce ai scris tu rămâne). */
  async fillFromReading(root: PedigreeNode) {
    // Ciorna veche (alt pedigree început altă dată) nu se amestecă pe tăcute cu pedigree-ul citit acum.
    if (this.count() > 0) {
      const fresh = await this.confirm.ask({
        title: 'Începi pedigree-ul de la zero cu ce s-a citit?',
        lines: [`Ai deja ${this.count()} căsuțe completate. „Da” le golește și pune doar ce s-a citit din poză.`, '„Renunță” păstrează ce ai scris și completează doar căsuțele goale.'],
        confirmLabel: 'Da, de la zero',
      });
      if (fresh) this.d.set({ ...emptyDraft(), kind: this.d().kind });
    }
    const slots = this.d().slots.slice();
    const put = (n: PedigreeNode | null | undefined, i: number) => {
      if (!n || i > SLOTS) return;
      const cur = slots[i];
      slots[i] = {
        ring: cur.ring || n.ring || '',
        name: cur.name || n.name || '',
        color: cur.color || n.color || '',
        text: cur.text || [n.text, n.breeder].filter(Boolean).join(' · '),
      };
      put(n.father, 2 * i);
      put(n.mother, 2 * i + 1);
    };
    put(root, 1);
    const sex = this.d().sex || (root.sex === 'M' || root.sex === 'F' ? root.sex : '');
    this.d.set({ ...this.d(), sex, slots });
    this.hints.set({});
    for (let i = 1; i <= SLOTS; i++) if (slots[i].ring) this.check(i);
  }

  private tree(i: number): unknown {
    if (i > SLOTS) return null;
    const s = this.d().slots[i];
    const father = this.tree(2 * i);
    const mother = this.tree(2 * i + 1);
    if (!filled(s) && !father && !mother) return null;
    return {
      ring: s.ring.trim() || null,
      name: s.name.trim() || null,
      color: s.color.trim() || null,
      text: s.text.trim() || null,
      ...(i === 1 && this.d().sex ? { sex: this.d().sex } : {}),
      father,
      mother,
    };
  }

  async save() {
    this.error.set('');
    const root = this.d().slots[1];
    if (!root.ring.trim()) {
      this.error.set('Scrie întâi inelul porumbelului (prima căsuță).');
      return;
    }
    const ok = await this.confirm.ask({
      title: 'Adaug pedigree-ul în program?',
      lines: [
        `${this.count()} căsuțe completate; porumbelul ${root.ring.trim()} ${this.d().kind === 'own' ? 'din porumbarul meu' : 'din alt porumbar'}.`,
        'Porumbeii pe care îi ai deja se folosesc așa cum sunt; doar ce lipsea se completează.',
      ],
      confirmLabel: 'Da, adaugă',
    });
    if (!ok) return;
    this.saving.set(true);
    try {
      const r = await this.api.post<ImportResult>('/pedigrees/import', { root: this.tree(1), rootKind: this.d().kind });
      this.result.set(r);
      writeDraft(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  async clearAll() {
    if (this.count() && !(await this.confirm.ask({ title: 'Golești toate căsuțele?', lines: ['Ce ai scris aici se pierde.'], confirmLabel: 'Da, golește', danger: true }))) return;
    this.startOver();
  }

  startOver() {
    this.result.set(null);
    this.restored.set(false);
    this.hints.set({});
    this.d.set(emptyDraft());
    writeDraft(null);
  }
}
