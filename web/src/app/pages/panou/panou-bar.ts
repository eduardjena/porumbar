import { Component, HostListener, computed, input, model, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CodeLabel } from '../../core/models';
import { Icon } from '../../shared/icon';
import { TPipe, t } from '../../core/i18n';
import { GROUPS, GroupKey, SORTS, SortKey, ViewState, currentYear, filterCount } from './panou-view';

type Panel = 'sort' | 'group' | 'filter' | null;

/**
 * O singură bară pentru panou, pe un rând: căutarea, „Ordonează”, „Grupează”, „Filtre” și filtrele rapide.
 * Pe calculator, alegerile se deschid sub buton; pe telefon, de jos în sus, cu variante mari.
 */
@Component({
  selector: 'app-panou-bar',
  imports: [FormsModule, NgTemplateOutlet, Icon, TPipe],
  template: `
    <div class="bar">
      <label class="search">
        <app-icon name="cautare" />
        <input type="search" [placeholder]="'panou.cauta' | t" [title]="'panou.cauta_ajutor' | t" [attr.aria-label]="'panou.cauta_ajutor' | t"
               [ngModel]="state().q" (ngModelChange)="patch({ q: $event })" />
      </label>

      <!-- Pastile scurte (iconiță + un cuvânt), cu lățime mărginită: bara rămâne pe un rând orice s-ar alege. -->
      <div class="tools">
        @if (orderTools()) {
        <button type="button" class="tool" [class.on]="open() === 'sort'" [attr.aria-expanded]="open() === 'sort'" (click)="toggle('sort')"
                [title]="'panou.ordoneaza_val' | t: { ordonare: sortLabel() }" [attr.aria-label]="'panou.ordoneaza_val' | t: { ordonare: sortLabel() }">
          <app-icon name="ordonare" [size]="18" /><span class="lbl">{{ sortShort() }}</span>
        </button>
        <button type="button" class="tool" [class.on]="open() === 'group' || state().group !== 'none'" [attr.aria-expanded]="open() === 'group'" (click)="toggle('group')"
                [title]="'panou.grupeaza_val' | t: { grupare: groupLabel() }" [attr.aria-label]="'panou.grupeaza_val' | t: { grupare: groupLabel() }">
          <app-icon name="grupare" [size]="18" /><span class="lbl">{{ groupShort() }}</span>
        </button>
        }
        <button type="button" class="tool" [class.on]="open() === 'filter' || count() > 0" [attr.aria-expanded]="open() === 'filter'" (click)="toggle('filter')"
                [title]="'panou.filtre_val' | t: { numar: count() || ('panou.niciunul' | t) }" [attr.aria-label]="'panou.filtre_val' | t: { numar: count() || ('panou.niciunul' | t) }">
          <app-icon name="filtru" [size]="18" /><span class="lbl">{{ 'panou.filtre' | t }}</span>@if (count()) { <span class="count">{{ count() }}</span> }
        </button>

        @if (open(); as o) {
          <div class="backdrop" (click)="open.set(null)"></div>
          <div class="panel" role="dialog" [attr.aria-label]="(o === 'sort' ? 'panou.ordoneaza' : o === 'group' ? 'panou.grupeaza' : 'panou.filtre') | t">
            <div class="panel-head">
              <strong>{{ (o === 'sort' ? 'panou.ordoneaza_dupa' : o === 'group' ? 'panou.grupeaza_dupa' : 'panou.filtre') | t }}</strong>
              <button type="button" class="close" (click)="open.set(null)" [attr.aria-label]="'actiune.inchide' | t"><app-icon name="inchide" /></button>
            </div>
            @switch (o) {
              @case ('sort') {
                @for (s of sorts; track s.key) {
                  <button type="button" class="opt" [class.sel]="state().sort === s.key" [attr.aria-pressed]="state().sort === s.key" (click)="pick({ sort: s.key })">
                    <span><strong>{{ s.label }}</strong><small>{{ s.hint }}</small></span>@if (state().sort === s.key) { <app-icon name="bifa" /> }
                  </button>
                }
              }
              @case ('group') {
                @for (g of groups; track g.key) {
                  <button type="button" class="opt" [class.sel]="state().group === g.key" [attr.aria-pressed]="state().group === g.key" (click)="pick({ group: g.key })">
                    <span><strong>{{ g.label }}</strong><small>{{ g.hint }}</small></span>@if (state().group === g.key) { <app-icon name="bifa" /> }
                  </button>
                }
              }
              @case ('filter') {
                <p class="sub">{{ 'panou.rapide' | t }}</p>
                <div class="chips"><ng-container *ngTemplateOutlet="quick" /></div>
                <p class="sub">{{ 'porumbel.starea' | t }}</p>
                <div class="chips">
                  @for (s of statuses(); track s.code) {
                    <button type="button" class="qchip" [class.on]="state().statuses.includes(s.code)" [attr.aria-pressed]="state().statuses.includes(s.code)" (click)="toggleIn('statuses', s.code)">{{ s.label }}</button>
                  }
                </div>
                @if (years().length) {
                  <p class="sub">{{ 'camp.anul' | t }}</p>
                  <div class="chips">
                    @for (y of years(); track y) {
                      <button type="button" class="qchip" [class.on]="state().years.includes(y)" [attr.aria-pressed]="state().years.includes(y)" (click)="toggleIn('years', y)">{{ y }}</button>
                    }
                  </div>
                }
                <div class="panel-foot">
                  <button type="button" (click)="clear()" [disabled]="!count()">{{ 'panou.sterge_filtrele' | t }}</button>
                  <button type="button" class="primary" (click)="open.set(null)">{{ 'actiune.gata' | t }}</button>
                </div>
              }
            }
          </div>
        }
      </div>

      <div class="chips quick" role="group" [attr.aria-label]="'panou.filtre_rapide' | t">
        <ng-container *ngTemplateOutlet="quick" />
      </div>
    </div>

    <ng-template #quick>
      <button type="button" class="qchip" [class.on]="state().sex === 'M'" [attr.aria-pressed]="state().sex === 'M'" (click)="patch({ sex: state().sex === 'M' ? '' : 'M' })">{{ 'porumbel.masculi' | t }}</button>
      <button type="button" class="qchip" [class.on]="state().sex === 'F'" [attr.aria-pressed]="state().sex === 'F'" (click)="patch({ sex: state().sex === 'F' ? '' : 'F' })">{{ 'porumbel.femele' | t }}</button>
      <button type="button" class="qchip" [class.on]="state().young" [attr.aria-pressed]="state().young" (click)="patch({ young: !state().young })" [title]="'panou.grupa.puii_anului' | t: { an: year }">{{ 'panou.pui_an' | t: { an: year } }}</button>
      <button type="button" class="qchip" [class.on]="state().prizes" [attr.aria-pressed]="state().prizes" (click)="patch({ prizes: !state().prizes })" [title]="'panou.premiati_ajutor' | t">{{ 'panou.grupa.premiati' | t }}</button>
      <button type="button" class="qchip more" [class.on]="state().breeding" [attr.aria-pressed]="state().breeding" (click)="patch({ breeding: !state().breeding })">{{ 'panou.reproducatori' | t }}</button>
      <button type="button" class="qchip more" [class.on]="state().todo" [attr.aria-pressed]="state().todo" (click)="patch({ todo: !state().todo })" [title]="'panou.de_completat_ajutor' | t">{{ 'panou.de_completat' | t }}</button>
    </ng-template>
  `,
  styles: `
    :host { display: block; margin-bottom: 18px; }
    /* Un singur rând: căutarea ia ce rămâne, pastilele și butoanele rapide au lățimea lor (scurtă, fixă). */
    .bar { display: flex; align-items: center; gap: 5px; flex-wrap: nowrap; }
    .search { position: relative; display: block; flex: 1 1 180px; min-width: 140px; }
    .search app-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
    .search input { padding-left: 44px; border-radius: 999px; min-height: 44px; height: 44px; font-size: 0.95rem; text-overflow: ellipsis; }
    .tools { position: relative; display: flex; gap: 5px; flex: none; }
    .tool, .qchip {
      display: inline-flex; align-items: center; gap: 5px; min-height: 44px; padding: 0 10px; border-radius: 999px; white-space: nowrap;
      background: var(--surface); border: 1px solid var(--border-strong); color: var(--text); font-weight: 700; font-size: 0.82rem; box-shadow: none;
    }
    /* Lățime fixă: rândul nu se lungește orice s-ar alege (textul prea lung se scurtează cu „…”, întreg în titlu). */
    .tool { width: 110px; justify-content: center; padding: 0 8px; }
    .tool .lbl { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .tool.on { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-strong); }
    .count { min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px; display: inline-grid; place-items: center; background: var(--accent); color: #fff; font-size: 0.75rem; font-weight: 800; }
    .chips { display: flex; flex-wrap: wrap; gap: 5px; }
    .chips.quick { flex: none; flex-wrap: nowrap; }
    .qchip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
    .backdrop { position: fixed; inset: 0; z-index: 30; background: transparent; }
    .panel {
      position: absolute; left: 0; top: calc(100% + 8px); z-index: 31; width: 380px; max-height: min(70vh, 620px); overflow: auto;
      background: var(--surface); border: 1px solid var(--border); border-radius: 20px; box-shadow: 0 18px 50px rgb(43 33 23 / 22%); padding: 10px;
    }
    .panel-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 6px 8px; }
    .panel-head strong { font-size: 1.1rem; }
    .close { min-height: 44px; width: 44px; padding: 0; border: 0; background: none; box-shadow: none; display: grid; place-items: center; color: var(--muted); }
    .opt {
      width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; text-align: left; min-height: 56px;
      padding: 8px 12px; border: 0; border-radius: 14px; background: none; box-shadow: none; color: var(--text);
    }
    .opt span { display: flex; flex-direction: column; }
    .opt small { color: var(--muted); font-size: 0.85rem; font-weight: 400; }
    .opt:hover { background: var(--surface-2); }
    .opt.sel { background: var(--accent-soft); color: var(--accent-strong); }
    .sub { margin: 10px 6px 6px; font-weight: 800; color: var(--muted); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .panel .chips { padding: 0 6px; }
    .panel .qchip { font-size: 0.95rem; }
    .panel-foot { display: flex; justify-content: space-between; gap: 10px; padding: 14px 6px 4px; }
    /* Mai îngust de atât, toate nu mai încap pe un rând: butoanele rapide trec pe rândul al doilea (tot unul singur). */
    @media (max-width: 1120px) {
      .bar { flex-wrap: wrap; }
      .tool { width: auto; padding: 0 10px; }
      .tool .lbl { max-width: 92px; }
      .chips.quick { flex-basis: 100%; }
    }
    @media (max-width: 767px) {
      .search { flex-basis: 100%; }
      .tools { flex-basis: 100%; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .tool { justify-content: center; padding: 0 6px; gap: 4px; font-size: 0.82rem; min-width: 0; }
      .tool .lbl { max-width: none; }
      /* Telefon: patru butoane rapide pe un rând (Reproducători și De completat sunt în „Filtre”, la „Rapide”). */
      .chips.quick .qchip { flex: 1 1 auto; min-width: 0; padding: 0 8px; min-height: 40px; font-size: 0.78rem; justify-content: center; }
      .chips.quick .more { display: none; }
      .backdrop { background: rgb(20 14 8 / 45%); }
      .panel {
        position: fixed; left: 0; right: 0; bottom: 0; top: auto; width: auto; max-height: 82vh; border-radius: 24px 24px 0 0;
        padding: 12px 12px calc(16px + env(safe-area-inset-bottom));
      }
    }
  `,
})
export class PanouBar {
  readonly state = model.required<ViewState>();
  readonly statuses = input<CodeLabel[]>([]);
  readonly years = input<number[]>([]);
  /** „Ordonează” și „Grupează” (pe fila Rezultate nu: rezultatele au ordonarea lor). */
  readonly orderTools = input(true);
  readonly open = signal<Panel>(null);
  protected readonly sorts = SORTS;
  protected readonly groups = GROUPS;
  protected readonly year = currentYear();
  protected readonly count = computed(() => filterCount(this.state()));
  protected readonly sortLabel = computed(() => SORTS.find((s) => s.key === this.state().sort)?.label ?? '');
  protected readonly groupLabel = computed(() => (this.state().group === 'none' ? t('panou.grupare_fara') : GROUPS.find((g) => g.key === this.state().group)?.label ?? ''));
  protected readonly sortShort = computed(() => SORTS.find((s) => s.key === this.state().sort)?.short ?? '');
  protected readonly groupShort = computed(() => GROUPS.find((g) => g.key === this.state().group)?.short ?? t('panou.grupare.none_scurt'));

  toggle(p: Exclude<Panel, null>) {
    this.open.set(this.open() === p ? null : p);
  }

  patch(p: Partial<ViewState>) {
    this.state.set({ ...this.state(), ...p });
  }

  /** Ordonarea / gruparea: se alege și se închide. */
  pick(p: { sort?: SortKey; group?: GroupKey }) {
    this.patch(p);
    this.open.set(null);
  }

  toggleIn(field: 'statuses' | 'years', value: string | number) {
    const list = this.state()[field] as (string | number)[];
    this.patch({ [field]: list.includes(value) ? list.filter((x) => x !== value) : [...list, value] } as Partial<ViewState>);
  }

  clear() {
    this.patch({ sex: '', young: false, prizes: false, breeding: false, todo: false, statuses: [], years: [] });
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.open.set(null);
  }
}
