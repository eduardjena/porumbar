import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth';
import { ConfirmService } from '../../core/confirm';
import { BoardPigeon, CoiResult, Family, PigeonSummary, TreeNode } from '../../core/models';
import { Icon, IconName } from '../../shared/icon';
import { ArboreData, Blood, TreePigeon } from './arbore-data';
import { ArborePanou } from './arbore-panou';
import { VedereCarduri } from './vedere-carduri';
import { VedereEvantai } from './vedere-evantai';
import { VedereSange } from './vedere-sange';
import Retea from './retea';

type View = 'carduri' | 'evantai' | 'sange' | 'retea' | '3d';
const VIEWS: { id: View; label: string; icon: IconName }[] = [
  { id: 'carduri', label: 'Carduri', icon: 'panou' },
  { id: 'evantai', label: 'Evantai', icon: 'rotire' },
  { id: 'sange', label: 'Linii de sânge', icon: 'ramificare' },
  { id: 'retea', label: 'Rețea', icon: 'retea' },
  { id: '3d', label: '3D', icon: 'mutare' },
];
const isView = (v: unknown): v is View => VIEWS.some((x) => x.id === v);

/** Ultimul porumbel deschis în Arbore (doar pe acest calculator), ca Arborele să se redeschidă tot pe el. */
const LAST_KEY = 'porumbar.arbore.ultimul';
function lastRoot(): number | null {
  try {
    return Number(localStorage.getItem(LAST_KEY)) || null;
  } catch {
    return null;
  }
}
function rememberRoot(id: number) {
  try {
    localStorage.setItem(LAST_KEY, String(id));
  } catch {
    /* fără memorie locală: pornește de la cel mai valoros */
  }
}

/**
 * Pagina Arbore: alegi porumbelul, apoi vederea (Carduri, Evantai, Linii de sânge, Rețea, 3D). Fără `?vedere`, se
 * deschide vederea de pornire a contului. Datele pentru Carduri / Evantai / Linii se aduc o singură dată aici.
 */
@Component({
  selector: 'app-arbore',
  imports: [FormsModule, Icon, ArborePanou, VedereCarduri, VedereEvantai, VedereSange, Retea],
  template: `
    <div class="wide">
      <div class="head">
        <div>
          <h1>{{ title() }}</h1>
          @if (rootRing()) { <p class="muted sub"><span class="mono">{{ rootRing() }}</span>@if (data(); as d) { · {{ d.offspring.length }} pui }</p> }
        </div>
        <button type="button" class="primary pick-btn" [attr.aria-expanded]="picking()" (click)="togglePicker()">
          <app-icon name="lista" />Alege alt porumbel
        </button>
      </div>

      @if (picking()) {
        <section class="picker card" aria-label="Alege porumbelul">
          <label class="search">
            <app-icon name="cautare" />
            <input type="search" placeholder="Caută după inel sau nume" aria-label="Caută după inel sau nume" [(ngModel)]="q" (ngModelChange)="suggest()" />
          </label>
          <p class="muted small">{{ q.trim() ? 'Rezultate' : 'Porumbeii tăi, cei mai valoroși primii' }} · atinge unul ca să-i vezi arborele</p>
          <div class="pick-grid">
            @for (s of pickList(); track s.id) {
              <button type="button" class="pick" [class.on]="s.id === rootId()" (click)="pick(s)">
                @if (s.value; as v) { <span class="val" [class]="'val band-' + v.band">{{ v.score ?? '–' }}</span> }
                <span class="stack">
                  <span class="mono rg">{{ s.ring?.display ?? 'Fără inel' }}</span>
                  @if (s.name) { <span class="nm">„{{ s.name }}”</span> }
                </span>
              </button>
            } @empty {
              <p class="muted">Niciun porumbel găsit.</p>
            }
          </div>
        </section>
      }

      <div class="switch-row">
        <div class="switch" role="tablist" aria-label="Cum vezi arborele">
          @for (v of views; track v.id) {
            <button type="button" role="tab" [attr.aria-selected]="view() === v.id" [class.on]="view() === v.id" (click)="go(v.id)">
              <app-icon [name]="v.icon" [size]="20" />{{ v.label }}
            </button>
          }
        </div>
        @if (view() !== defaultView()) {
          <button type="button" class="link" (click)="makeDefault()">Fă-o vederea mea de pornire</button>
        } @else {
          <span class="muted small">Vederea ta de pornire</span>
        }
      </div>

      @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }

      @switch (view()) {
        @case ('retea') {
          <app-retea [porumbel]="porumbel()" [tot]="tot()" />
        }
        @default {
          @if (data(); as d) {
            <div class="layout">
              <div class="main-view">
                @switch (view()) {
                  @case ('carduri') { <app-vedere-carduri [data]="d" [selectedId]="selected()" (select)="selected.set($event)" (open)="open($event)" /> }
                  @case ('evantai') { <app-vedere-evantai [data]="d" [selectedId]="selected()" (select)="selected.set($event)" (open)="open($event)" /> }
                  @case ('sange') { <app-vedere-sange [data]="d" [selectedId]="selected()" (select)="selected.set($event)" (open)="open($event)" /> }
                }
              </div>
              <app-arbore-panou [data]="d" [selectedId]="selected()" [from]="from()" (select)="selected.set($event)" (startHere)="startHere($event)" />
            </div>
          } @else if (!error()) {
            <p class="muted">Se încarcă arborele…</p>
          }
        }
      }
    </div>
  `,
  styles: `
    /* Arborele are nevoie de lățime: pagina iese din coloana obișnuită (până la 1560px). */
    .wide { width: min(1560px, calc(100vw - 48px)); position: relative; left: 50%; transform: translateX(-50%); }
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
    .head h1 { margin-bottom: 2px; }
    .sub { margin: 0; }
    .pick-btn { flex: none; }
    .picker { margin-top: 14px; padding: 16px; }
    .picker .small { margin: 8px 0; }
    .pick-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; max-height: 340px; overflow-y: auto; }
    .pick { justify-content: flex-start; gap: 8px; font-weight: 600; text-align: left; }
    .pick.on { border-color: var(--accent); background: var(--accent-soft); }
    .pick .stack { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
    .pick .rg { white-space: nowrap; }
    .pick .nm { color: var(--muted); font-weight: 400; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pick .val { font-size: 0.8rem; font-weight: 800; padding: 2px 7px; border-radius: 8px; flex: none; }
    .search { position: relative; display: block; max-width: 460px; }
    .search > app-icon { position: absolute; left: 16px; top: 26px; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
    .search input { padding-left: 50px; border-radius: 999px; }
    .switch-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin: 14px 0; }
    .switch { display: inline-flex; flex-wrap: wrap; padding: 4px; gap: 4px; background: var(--surface-2); border-radius: 999px; }
    .switch button { border: 0; background: none; color: var(--muted); }
    .switch button.on { background: var(--surface); color: var(--accent-strong); box-shadow: var(--shadow); }
    .small { font-size: 0.9rem; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
    .main-view { min-width: 0; }
    app-arbore-panou { position: sticky; top: 84px; }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } app-arbore-panou { position: static; } }
    @media (max-width: 767px) { .wide { width: 100%; left: 0; transform: none; } .switch { border-radius: 20px; } }
  `,
})
export default class Arbore {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  readonly porumbel = input<string>();
  readonly tot = input<string>();
  readonly vedere = input<string>();
  protected readonly views = VIEWS;

  protected readonly defaultView = computed<View>(() => {
    const v = this.auth.account()?.treeView;
    return isView(v) ? v : 'carduri';
  });
  protected readonly view = computed<View>(() => (isView(this.vedere()) ? (this.vedere() as View) : this.defaultView()));
  readonly data = signal<ArboreData | null>(null);
  readonly selected = signal(0);
  readonly error = signal('');
  readonly suggestions = signal<PigeonSummary[]>([]);
  readonly picking = signal(false);
  private readonly board = signal<BoardPigeon[]>([]);
  /** Fără căutare: porumbeii proprii după valoare; cu căutare: rezultatele (cu nota, dacă e în porumbar). */
  protected readonly pickList = computed<(PigeonSummary & { value?: BoardPigeon['value'] })[]>(() => {
    if (!this.q.trim() && !this.suggestions().length) return this.board();
    const byId = new Map(this.board().map((b) => [b.id, b]));
    return this.suggestions().map((s) => byId.get(s.id) ?? s);
  });
  q = '';
  private timer: ReturnType<typeof setTimeout> | undefined;
  private request = 0;

  protected readonly rootId = computed(() => Number(this.porumbel()) || null);
  protected readonly rootRing = computed(() => {
    const d = this.data();
    return d ? (d.pigeons[d.rootId]?.ring?.display ?? '') : '';
  });
  protected readonly title = computed(() => {
    const d = this.data();
    const r = d?.pigeons[d.rootId];
    return r && this.view() !== 'retea' ? `Arborele lui ${r.name || r.ring?.display || ''}` : 'Arborele porumbarului';
  });
  protected readonly from = computed(() => ({ din: 'arbore', radacina: this.rootId() ?? undefined, vedere: this.view() }));

  constructor() {
    effect(() => {
      const view = this.view();
      const id = this.rootId();
      const all = !!this.tot();
      untracked(() => this.load(view, id, all));
    });
  }

  private async load(view: View, id: number | null, all: boolean) {
    if (view === '3d') {
      this.router.navigate(['/arbore/3d'], { queryParams: id ? { porumbel: id } : all ? { tot: 1 } : {}, replaceUrl: true });
      return;
    }
    if (view === 'retea') return; // rețeaua își aduce singură datele
    const req = ++this.request;
    try {
      if (!id) {
        const pigeons = (await this.api.get<{ pigeons: BoardPigeon[] }>('/board')).pigeons;
        const last = lastRoot();
        const start = pigeons.find((p) => p.id === last) ?? pigeons[0];
        if (start) this.router.navigate(['/arbore'], { queryParams: { porumbel: start.id, vedere: this.vedere() || undefined }, replaceUrl: true });
        else this.error.set('Adaugă primul porumbel, apoi îi vezi aici arborele.');
        return;
      }
      if (this.data()?.rootId === id) return;
      const [t, board, coi, fam, blood] = await Promise.all([
        this.api.get<{ tree: TreeNode; pigeons: Record<number, TreePigeon> }>(`/pigeons/${id}/tree?generations=4`),
        this.api.get<{ pigeons: BoardPigeon[] }>('/board'),
        this.api.get<CoiResult>(`/pigeons/${id}/coi`),
        this.api.get<Family>(`/pigeons/${id}/family`),
        this.api.get<Blood>(`/pigeons/${id}/bloodlines`),
      ]);
      if (req !== this.request) return;
      this.board.set(board.pigeons);
      rememberRoot(id);
      const values = Object.fromEntries(board.pigeons.map((p) => [p.id, p.value]));
      const offspring = [...fam.offspring].sort((a, b) => (values[b.id]?.score ?? -1) - (values[a.id]?.score ?? -1));
      this.data.set({ rootId: id, tree: t.tree, pigeons: t.pigeons, values, coi, offspring, blood });
      this.selected.set(id);
      this.error.set('');
    } catch (e) {
      if (req === this.request) this.error.set(errorMessage(e));
    }
  }

  togglePicker() {
    this.picking.set(!this.picking());
    if (this.picking() && !this.board().length) {
      this.api.get<{ pigeons: BoardPigeon[] }>('/board').then((b) => this.board.set(b.pigeons)).catch(() => {});
    }
  }

  go(v: View) {
    this.router.navigate(['/arbore'], { queryParams: { porumbel: this.rootId() ?? undefined, tot: this.tot() || undefined, vedere: v } });
  }

  async makeDefault() {
    const label = VIEWS.find((v) => v.id === this.view())?.label ?? '';
    const ok = await this.confirm.ask({
      title: `Arborele se deschide de acum cu „${label}”?`,
      lines: ['Poți schimba oricând din comutatorul de vederi.'],
      confirmLabel: 'Da, așa',
    });
    if (!ok) return;
    try {
      await this.auth.update({ treeView: this.view() } as never);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  open(id: number) {
    this.router.navigate(['/porumbei', id], { queryParams: this.from() });
  }

  startHere(id: number) {
    this.router.navigate(['/arbore'], { queryParams: { porumbel: id, vedere: this.view() } });
  }

  suggest() {
    clearTimeout(this.timer);
    const q = this.q.trim();
    if (!q) return this.suggestions.set([]);
    this.timer = setTimeout(async () => {
      try {
        this.suggestions.set((await this.api.get<{ pigeons: PigeonSummary[] }>(`/pigeons?q=${encodeURIComponent(q)}`)).pigeons.slice(0, 8));
      } catch {
        this.suggestions.set([]);
      }
    }, 300);
  }

  pick(p: PigeonSummary) {
    this.q = '';
    this.suggestions.set([]);
    this.picking.set(false);
    this.startHere(p.id);
  }
}
