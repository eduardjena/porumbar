import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth';
import { ConfirmService } from '../../core/confirm';
import { BoardPigeon, CoiResult, Family, PigeonSummary, TreeNode } from '../../core/models';
import { t, TPipe } from '../../core/i18n';
import { Icon, IconName } from '../../shared/icon';
import { ArboreData, Blood, lastRoot, rememberRoot, TreePigeon } from './arbore-data';
import { ArborePanou } from './arbore-panou';
import { VedereCarduri } from './vedere-carduri';
import { VedereEvantai } from './vedere-evantai';
import { VedereSange } from './vedere-sange';
import Retea from './retea';

type View = 'carduri' | 'evantai' | 'sange' | 'retea';
const VIEWS: { id: View; /** cheia din dicționar */ label: string; icon: IconName }[] = [
  { id: 'carduri', label: 'arbore.vedere_carduri', icon: 'panou' },
  { id: 'evantai', label: 'arbore.vedere_evantai', icon: 'rotire' },
  { id: 'sange', label: 'arbore.vedere_sange', icon: 'ramificare' },
  { id: 'retea', label: 'arbore.vedere_retea', icon: 'retea' },
];
const isView = (v: unknown): v is View => VIEWS.some((x) => x.id === v);


/**
 * Pagina Arbore: alegi porumbelul, apoi vederea (Carduri, Evantai, Linii de sânge, Rețea). Fără `?vedere`, se
 * deschide vederea de pornire a contului. Datele pentru Carduri / Evantai / Linii se aduc o singură dată aici.
 */
@Component({
  selector: 'app-arbore',
  imports: [FormsModule, NgTemplateOutlet, Icon, TPipe, ArborePanou, VedereCarduri, VedereEvantai, VedereSange, Retea],
  template: `
    <div class="wide">
      <!-- Stânga barei: titlul. -->
      <ng-template #titleTpl>
        <div class="bar-title">
          <h1>{{ title() }}</h1>
          @if (rootRing() && data()?.rootId === rootId()) { <span class="muted"><span class="mono">{{ rootRing() }}</span>@if (data(); as d) { · {{ 'arbore.n_pui' | t: { n: d.offspring.length } }} }</span> }
        </div>
      </ng-template>

      <!-- Capătul din dreapta al barei: „Alege alt porumbel”, cu lista care se deschide sub bară. -->
      <ng-template #pickTpl>
        <button type="button" class="primary" [attr.aria-expanded]="picking()" (click)="togglePicker($event)">
          <app-icon name="lista" />{{ 'arbore.alege_alt' | t }}
        </button>
        @if (picking()) {
          <section class="picker card" [style.top.px]="pickerTop()" [style.--picker-top.px]="pickerTop()" [attr.aria-label]="'arbore.aria_alege' | t" (keydown.escape)="picking.set(false)">
            <div class="picker-head">
              <label class="search">
                <app-icon name="cautare" />
                <input type="search" [placeholder]="'arbore.cauta' | t" [attr.aria-label]="'arbore.cauta' | t" [(ngModel)]="q" (ngModelChange)="suggest()" />
              </label>
              <button type="button" class="close" (click)="picking.set(false)" [attr.aria-label]="'arbore.inchide_lista' | t" [title]="'actiune.inchide' | t"><app-icon name="inchide" /></button>
            </div>
            <p class="muted small">{{ (q.trim() ? 'arbore.rezultate' : 'arbore.cei_mai_valorosi') | t }} · {{ 'arbore.atinge_unul' | t }}</p>
            <div class="pick-grid">
              @for (s of pickList(); track s.id) {
                <button type="button" class="pick" [class.on]="s.id === rootId()" (click)="pick(s)">
                  @if (s.value; as v) { <span class="val" [class]="'val band-' + v.band">{{ v.score ?? '–' }}</span> }
                  <span class="stack">
                    <span class="mono rg">{{ s.ring?.display ?? ('text.fara_inel_mare' | t) }}</span>
                    @if (s.name) { <span class="nm">„{{ s.name }}”</span> }
                  </span>
                </button>
              } @empty {
                <p class="muted">{{ 'arbore.niciun_gasit' | t }}</p>
              }
            </div>
          </section>
        }
      </ng-template>

      @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }

      <div class="tree-bar" role="toolbar" [attr.aria-label]="'arbore.aria_comenzi' | t">
          <div class="bar-left"><ng-container [ngTemplateOutlet]="titleTpl" /></div>
          <div class="tree-bar-right">
            <div class="seg" role="tablist" [attr.aria-label]="'arbore.aria_vederi' | t">
              @for (v of views; track v.id) {
                <button type="button" role="tab" [attr.aria-selected]="view() === v.id" [class.on]="view() === v.id" (click)="go(v.id)">
                  <app-icon [name]="v.icon" [size]="20" />{{ v.label | t }}
                </button>
              }
            </div>
            @if (view() !== defaultView()) {
              <button type="button" class="link" (click)="makeDefault()">{{ 'arbore.fa_pornire' | t }}</button>
            }
            <div class="pick-wrap"><ng-container [ngTemplateOutlet]="pickTpl" /></div>
          </div>
        </div>

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
              <p class="muted">{{ 'arbore.se_incarca' | t }}</p>
            }
          }
        }
    </div>
  `,
  styles: `
    /* Arborele are nevoie de lățime: pagina iese din coloana obișnuită (până la 1560px). */
    .wide { width: min(1560px, calc(100vw - 48px)); margin-left: calc((100% - min(1560px, 100vw - 48px)) / 2); }
    /* Lista se deschide sub bară, peste arbore (fixă, ca să nu fie tăiată de bara care se derulează pe telefon). */
    .picker {
      position: fixed; z-index: 50; top: 132px; left: 50%; transform: translateX(-50%); width: min(820px, calc(100vw - 24px));
      max-height: calc(100dvh - var(--picker-top, 150px) - 16px); display: flex; flex-direction: column; padding: 14px; box-shadow: 0 24px 60px -16px rgb(43 33 23 / 45%);
    }
    .picker-head { display: flex; gap: 8px; align-items: center; }
    .picker-head .search { flex: 1; }
    .close { width: 48px; padding: 0; flex: none; }
    @media (max-width: 767px) {
      /* Pe telefon, meniul de jos (~80px) acoperă partea de jos a ecranului. */
      .picker { max-height: calc(100dvh - var(--picker-top, 150px) - 96px - env(safe-area-inset-bottom)); }
    }
    .picker .small { margin: 8px 0; }
    .pick-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; min-height: 0; overflow-y: auto; grid-auto-rows: max-content; align-content: start; padding: 2px; }
    .pick { justify-content: flex-start; gap: 10px; font-weight: 600; text-align: left; min-height: 58px; height: auto; padding: 8px 12px; border-radius: 14px; }
    .pick.on { border-color: var(--accent); background: var(--accent-soft); }
    .pick .stack { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
    .pick .rg { white-space: nowrap; }
    .pick .nm { color: var(--muted); font-weight: 400; font-size: 0.9rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pick .val { font-size: 0.8rem; font-weight: 800; padding: 2px 7px; border-radius: 8px; flex: none; }
    .search { position: relative; display: block; max-width: 460px; }
    .search > app-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
    .search input { padding-left: 50px; border-radius: 999px; }
    .small { font-size: 0.9rem; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
    .main-view { min-width: 0; }
    app-arbore-panou { position: sticky; top: 136px; }
    @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } app-arbore-panou { position: static; } }
    @media (max-width: 767px) { .wide { width: 100%; margin-left: 0; } }
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

  /** Vederea de pornire a contului (implicit Carduri). */
  protected readonly defaultView = computed<View>(() => {
    const v = this.auth.account()?.treeView;
    return isView(v) ? v : 'carduri';
  });
  protected readonly view = computed<View>(() => {
    const v = this.vedere();
    return isView(v) ? v : this.defaultView();
  });
  readonly data = signal<ArboreData | null>(null);
  readonly selected = signal(0);
  readonly error = signal('');
  readonly suggestions = signal<PigeonSummary[]>([]);
  readonly picking = signal(false);
  readonly searching = signal(false);
  private searchReq = 0;
  /** Lista se deschide chiar sub bară (bara poate fi lipită sus sau mai jos în pagină). */
  protected readonly pickerTop = signal(150);
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
    return r && this.view() !== 'retea' ? t('arbore.titlu_lui', { nume: r.name || r.ring?.display || '' }) : t('arbore.titlu_porumbar');
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
    if (view === 'retea') return; // rețeaua își aduce singură datele
    const req = ++this.request;
    try {
      if (!id) {
        const pigeons = (await this.api.get<{ pigeons: BoardPigeon[] }>('/board')).pigeons;
        const last = lastRoot();
        const start = pigeons.find((p) => p.id === last) ?? pigeons[0];
        if (req !== this.request) return;
        if (start) this.router.navigate(['/arbore'], { queryParams: { porumbel: start.id, vedere: this.vedere() || undefined }, replaceUrl: true });
        else this.error.set(t('arbore.adauga_primul'));
        return;
      }
      if (this.data()?.rootId === id) return;
      const [treeRes, board, coi, fam, blood] = await Promise.all([
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
      this.data.set({ rootId: id, tree: treeRes.tree, pigeons: treeRes.pigeons, values, coi, offspring, blood });
      this.selected.set(id);
      this.error.set('');
    } catch (e) {
      if (req === this.request) this.error.set(errorMessage(e));
    }
  }

  togglePicker(ev: Event) {
    const bar = (ev.currentTarget as HTMLElement).closest('.tree-bar');
    this.pickerTop.set(Math.round((bar?.getBoundingClientRect().bottom ?? 142) + 8));
    this.picking.set(!this.picking());
    if (this.picking() && !this.board().length) {
      this.api.get<{ pigeons: BoardPigeon[] }>('/board').then((b) => this.board.set(b.pigeons)).catch(() => {});
    }
  }

  go(v: View) {
    this.router.navigate(['/arbore'], { queryParams: { porumbel: this.rootId() ?? undefined, tot: this.tot() || undefined, vedere: v } });
  }

  async makeDefault() {
    const key = VIEWS.find((v) => v.id === this.view())?.label;
    const label = key ? t(key) : '';
    const ok = await this.confirm.ask({
      title: t('arbore.confirma_pornire_titlu', { vedere: label }),
      lines: [t('arbore.confirma_pornire_text')],
      confirmLabel: t('actiune.da_asa'),
    });
    if (!ok) return;
    try {
      await this.auth.update({ treeView: this.view() });
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
    const req = ++this.searchReq;
    this.searching.set(!!q);
    if (!q) return this.suggestions.set([]);
    this.timer = setTimeout(async () => {
      try {
        const found = (await this.api.get<{ pigeons: PigeonSummary[] }>(`/pigeons?q=${encodeURIComponent(q)}`)).pigeons.slice(0, 24);
        if (req === this.searchReq) this.suggestions.set(found);
      } catch {
        if (req === this.searchReq) this.suggestions.set([]);
      } finally {
        if (req === this.searchReq) this.searching.set(false);
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
