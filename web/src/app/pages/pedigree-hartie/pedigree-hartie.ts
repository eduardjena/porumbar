import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth';
import { ConfirmService } from '../../core/confirm';
import { t, TPipe, GluePipe, glue } from '../../core/i18n';
import { Kind, LookupResult } from '../../core/models';
import { Icon } from '../../shared/icon';
import { previewRing } from '../../shared/ring-preview';
import { generationName, roleName } from '../retea/arbore-data';
import { CititorPoza, PedigreeNode } from './cititor-poza';

/*
 * „Importă pedigree”: pedigree-ul primit de la cineva (hârtie, PDF, poză) se trece tot dintr-o dată, în 31 de
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
const DRAFT_KEY = 'porumbar.ciorna.pedigree-hartie'; // doar ca să ștergem ciornele vechi
const blank = (): Slot => ({ ring: '', name: '', color: '', text: '' });
const emptyDraft = (): Draft => ({ kind: 'own', sex: '', slots: Array.from({ length: SLOTS + 1 }, blank) });
const genOf = (i: number) => Math.floor(Math.log2(i));
const pathOf = (i: number): ('F' | 'M')[] => {
  const out: ('F' | 'M')[] = [];
  for (let x = i; x > 1; x = Math.floor(x / 2)) out.unshift(x % 2 ? 'M' : 'F');
  return out;
};
const filled = (s: Slot) => !!(s.ring.trim() || s.name.trim() || s.color.trim() || s.text.trim());

/** Pagina pornește mereu goală (vânzătorul a cerut-o): ciorna păstrată de versiunile vechi se șterge. */
function forgetOldDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* fără memorie locală: nu e nimic de șters */
  }
}

@Component({
  selector: 'app-pedigree-hartie',
  imports: [FormsModule, RouterLink, Icon, TPipe, GluePipe, CititorPoza],
  template: `
    <!-- În cadrul Panoului: titlul și explicația („hartie.intro”) le pune cadrul; totul stă în lățimea site-ului. -->
    <div class="wide">

      @if (result(); as r) {
        <section class="card done" role="status">
          <h2><app-icon name="bifa" />{{ 'hartie.e_in_program' | t }}</h2>
          <p>{{ 'hartie.rezultat_noi' | t: { count: r.created } }}{{ ', ' | glue }}{{ 'hartie.rezultat_existau' | t: { count: r.reused } }}</p>
          @if (r.conflicts.length) {
            <div class="warning stack">
              <strong>{{ 'text.de_verificat' | t: { n: r.conflicts.length } }}</strong>
              @for (c of r.conflicts; track $index) { <span>{{ c.message }}</span> }
            </div>
          }
          <div class="row">
            <a class="btn primary" [routerLink]="['/porumbei', r.pigeonId]"><app-icon name="fisa" />{{ 'actiune.deschide_fisa' | t }}</a>
            <a class="btn" [routerLink]="['/arbore']" [queryParams]="{ porumbel: r.pigeonId }"><app-icon name="copac" />{{ 'hartie.vezi_arborele' | t }}</a>
            <button type="button" (click)="startOver()"><app-icon name="plus" />{{ 'hartie.inca_unul' | t }}</button>
          </div>
        </section>
      } @else {
        <app-cititor-poza (read)="fillFromReading($event)" />

        <section class="card top-fields">
          <h2>{{ 'hartie.sau_de_mana' | t }}</h2>
          <fieldset class="kind">
            <!-- Pentru cititoarele de ecran; pe ecran titlul de mai sus și textul butoanelor spun destul. -->
            <legend class="vh">{{ 'hartie.porumbelul_este' | t }}</legend>
            <label><input type="radio" name="kind" value="own" [ngModel]="d().kind" (ngModelChange)="setKind($event)" /> {{ 'hartie.al_meu' | t }}</label>
            <label><input type="radio" name="kind" value="external" [ngModel]="d().kind" (ngModelChange)="setKind($event)" /> {{ 'hartie.nu_al_meu' | t }} <span class="muted">{{ 'hartie.imprumutat' | t }}</span></label>
          </fieldset>
          <label class="sex">{{ 'hartie.sexul' | t }}
            <select [ngModel]="d().sex" (ngModelChange)="setSex($event)">
              <option value="">{{ 'hartie.nu_stiu' | t }}</option>
              <option value="M">{{ 'sex.mascul' | t }}</option>
              <option value="F">{{ 'sex.femela' | t }}</option>
            </select>
          </label>
        </section>

        <div class="heads" aria-hidden="true">
          @for (g of gens; track g) { <div>{{ genName(g) }}</div> }
        </div>
        <div class="sheet" #sheet>
          <svg class="links" aria-hidden="true"><path class="tata" [attr.d]="links().father" /><path class="mama" [attr.d]="links().mother" /></svg>
          @for (i of indexes; track i) {
            @let s = d().slots[i];
            @let g = gen(i);
            <div class="slot" [attr.data-i]="i" [class]="'slot g' + g" [style.grid-column]="g + 1" [style.grid-row]="rowOf(i)"
                 [class.hidden-mobile]="g >= 3 && !openGen()[g]" [class.has]="filled(s)">
              @if (i === 1 || i === 2 || i === 4 || i === 8 || i === 16) {
                <button type="button" class="gen-toggle" (click)="toggleGen(g)" [attr.aria-expanded]="g < 3 || openGen()[g]">
                  {{ genName(g) }}{{ ' ' | glue }}<span class="muted">{{ '(' | glue }}{{ countIn(g) }}/{{ 2 ** g }}{{ ')' | glue }}</span>
                </button>
              }
              <div class="role">
                @if (i > 1) { <span class="av" [class]="'av sex-' + (i % 2 ? 'F' : 'M')">{{ (i % 2 ? 'sex.f' : 'sex.m') | t }}</span> }
                {{ role(i) }}
              </div>
              <input class="mono ring" [ngModel]="s.ring" (ngModelChange)="set(i, 'ring', $event)" (blur)="check(i)"
                     [attr.aria-label]="'hartie.aria_inel' | t: { rol: role(i) }" [placeholder]="'hartie.ph_inel' | t" autocomplete="off" />
              @if (hints()[i]; as h) { <span class="hint" [class]="'hint ' + h.kind">{{ h.text }}</span> }
              @if (g <= 2) {
                <input [ngModel]="s.name" (ngModelChange)="set(i, 'name', $event)" [attr.aria-label]="'hartie.aria_nume' | t: { rol: role(i) }" [placeholder]="'text.nume' | t" />
                <input [ngModel]="s.color" (ngModelChange)="set(i, 'color', $event)" [attr.aria-label]="'hartie.aria_culoare' | t: { rol: role(i) }" [placeholder]="'hartie.ph_culoare' | t" />
              }
              <textarea [rows]="g <= 1 ? 3 : g === 2 ? 2 : 1" [ngModel]="s.text" (ngModelChange)="set(i, 'text', $event)"
                        [attr.aria-label]="'hartie.aria_text' | t: { rol: role(i) }" [placeholder]="'hartie.ph_text' | t"></textarea>
            </div>
          }
        </div>

        @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
        <div class="actions">
          <button type="button" class="primary big" [disabled]="saving()" (click)="save()">
            <app-icon name="bifa" />{{ saving() ? ('text.se_salveaza' | t) : ('hartie.adauga_n' | t: { n: count() }) }}
          </button>
          <button type="button" class="link" (click)="clearAll()">{{ 'hartie.goleste_tot' | t }}</button>
        </div>
      }
    </div>
  `,
  styles: `
    .wide { width: 100%; }
    .top-fields { display: flex; flex-wrap: wrap; gap: 12px 32px; align-items: flex-end; margin: 12px 0; }
    .kind { border: 0; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 6px 24px; }
    .kind legend { font-weight: 700; margin-bottom: 6px; }
    .top-fields h2 { flex-basis: 100%; margin: 0; }
    .vh { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    .kind label { display: flex; align-items: center; gap: 8px; min-height: 44px; }
    .sex { display: flex; flex-direction: column; gap: 4px; font-weight: 700; }
    .heads { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 28px; margin: 16px 0 6px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.85rem; color: var(--muted); }
    .sheet { position: relative; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); grid-template-rows: repeat(16, minmax(64px, auto)); gap: 6px 28px; }
    /* Liniile de descendență: de la fiecare porumbel, spre tată (sus) și mamă (jos), ca pe pedigree-ul de hârtie. */
    .links { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; overflow: visible; }
    .links path { fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }
    /* Aceleași culori ca în Arbore → Carduri și în Rețea: tata albastru, mama roz. */
    .links .tata { stroke: #9fb8cf; }
    .links .mama { stroke: #d2a6c9; }
    .slot { position: relative; z-index: 1; align-self: center; display: flex; flex-direction: column; gap: 4px; padding: 8px; border-radius: 14px; background: var(--surface); border: 1px solid var(--border); }
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
      .heads, .links { display: none; }
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
  private readonly auth = inject(AuthService);
  protected readonly gens = [0, 1, 2, 3, 4];
  protected readonly indexes = Array.from({ length: SLOTS }, (_, k) => k + 1);
  protected readonly gen = genOf;
  protected readonly filled = filled;
  protected readonly genName = generationName;
  protected readonly role = (i: number) => roleName(pathOf(i));

  readonly d = signal<Draft>(emptyDraft());
  readonly hints = signal<Record<number, Hint>>({});
  readonly openGen = signal<Record<number, boolean>>({});
  readonly error = signal('');
  readonly saving = signal(false);
  readonly result = signal<ImportResult | null>(null);
  protected readonly count = computed(() => this.d().slots.filter(filled).length);

  private readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');
  /** Liniile dintre căsuțe (calea SVG), măsurate după ce s-au așezat căsuțele. */
  protected readonly links = signal({ father: '', mother: '' });

  constructor() {
    forgetOldDraft();
    let ro: ResizeObserver | undefined;
    effect(() => {
      ro?.disconnect();
      const el = this.sheet()?.nativeElement;
      if (!el) return;
      ro = new ResizeObserver(() => this.drawLinks(el));
      ro.observe(el);
      el.querySelectorAll('.slot').forEach((s) => ro!.observe(s));
    });
    inject(DestroyRef).onDestroy(() => ro?.disconnect());
  }

  /** Copil → părinți: din mijlocul marginii drepte a copilului, la jumătatea spațiului, apoi la tată și la mamă. */
  private drawLinks(el: HTMLElement) {
    if (getComputedStyle(el).display !== 'grid') return this.links.set({ father: '', mother: '' });
    const box = el.getBoundingClientRect();
    const at = new Map<number, DOMRect>();
    el.querySelectorAll<HTMLElement>('.slot[data-i]').forEach((s) => at.set(+s.dataset['i']!, s.getBoundingClientRect()));
    const r = (v: number) => Math.round(v) + 0.5;
    const d = { father: '', mother: '' };
    for (let i = 1; 2 * i + 1 <= SLOTS; i++) {
      const c = at.get(i), f = at.get(2 * i), m = at.get(2 * i + 1);
      if (!c || !f || !m) continue;
      const x1 = r(c.right - box.left), y1 = r(c.top + c.height / 2 - box.top), x2 = r(f.left - box.left), xm = r((x1 + x2) / 2);
      // Colțurile puțin rotunjite (6px, mai puțin dacă nu e loc).
      const to = (p: DOMRect) => {
        const y = r(p.top + p.height / 2 - box.top), dir = Math.sign(y - y1);
        const k = Math.min(6, xm - x1, x2 - xm, Math.abs(y - y1) / 2);
        return `M${x1} ${y1}H${xm - k}Q${xm} ${y1} ${xm} ${y1 + dir * k}V${y - dir * k}Q${xm} ${y} ${xm + k} ${y}H${x2}`;
      };
      d.father += to(f);
      d.mother += to(m);
    }
    this.links.set(d);
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
    // Limba contului: la conturile japoneze, 25-AB-01234 (fără „JPN”) se citește ca JP, ca la salvare.
    const p = previewRing(ring, this.auth.account()?.lang);
    if (!p.ok) {
      // Porumbelul meu: un inel nerecunoscut se păstrează cum e scris (avertisment blând); maghiarul fără organizator, nu.
      const mine = i === 1 && this.d().kind === 'own';
      if (mine && p.needsClub) return this.hint(i, { kind: 'bad', text: t('eroare.inel_hu_asociatie') });
      if (mine && !p.unknown) return this.hint(i, { kind: 'bad', text: t('eroare.inel_necitit') });
      return this.hint(i, { kind: 'new', text: mine ? t('inel.nerecunoscut') : t('hartie.hint_necitit') });
    }
    if (p.unringed) return this.hint(i, { kind: 'unringed', text: t('text.fara_inel_mare') });
    try {
      const r = await this.api.get<LookupResult>(`/pigeons/lookup?ring=${encodeURIComponent(ring)}`);
      if (this.d().slots[i].ring.trim() !== ring) return; // s-a schimbat între timp
      const m = r.matches[0];
      if (!m) return this.hint(i, { kind: 'new', text: t('hartie.hint_nou', { inel: p.display }) });
      const who = m.pigeon.name ? `${glue(' „')}${m.pigeon.name}${glue('”')}` : '';
      this.hint(i, { kind: 'existing', text: t('hartie.hint_exista', { inel: `${r.ring.display}${who}` }) });
      // Părinții pe care programul îi știe deja se completează în căsuțele goale.
      const add: [number, string | undefined][] = [
        [2 * i, m.father?.ring?.display],
        [2 * i + 1, m.mother?.ring?.display],
      ];
      for (const [k, parentRing] of add) {
        if (k > SLOTS || !parentRing || filled(this.d().slots[k])) continue;
        this.set(k, 'ring', parentRing);
        this.hint(k, { kind: 'filled', text: t('hartie.hint_completat') });
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
        title: t('hartie.citit_titlu'),
        lines: [t('hartie.citit_text', { n: this.count() }), t('hartie.citit_renunta')],
        confirmLabel: t('hartie.citit_da'),
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
      this.error.set(t('hartie.fara_inel_radacina'));
      return;
    }
    const ok = await this.confirm.ask({
      title: t('hartie.adaug_titlu'),
      lines: [
        t(this.d().kind === 'own' ? 'hartie.adaug_al_meu' : 'hartie.adaug_extern', { n: this.count(), inel: root.ring.trim() }),
        t('hartie.adaug_text'),
      ],
      confirmLabel: t('hartie.adaug_da'),
    });
    if (!ok) return;
    this.saving.set(true);
    try {
      const r = await this.api.post<ImportResult>('/pedigrees/import', { root: this.tree(1), rootKind: this.d().kind });
      this.result.set(r);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  async clearAll() {
    if (this.count() && !(await this.confirm.ask({ title: t('hartie.golesti_titlu'), lines: [t('hartie.golesti_text')], confirmLabel: t('hartie.golesti_da'), danger: true }))) return;
    this.startOver();
  }

  startOver() {
    this.result.set(null);
    this.hints.set({});
    this.d.set(emptyDraft());
  }
}
