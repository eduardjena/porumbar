import { Component, HostListener, computed, input, model, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CodeLabel } from '../../core/models';
import { Icon } from '../../shared/icon';
import { GROUPS, GroupKey, SORTS, SortKey, ViewState, currentYear, filterCount } from './panou-view';

type Panel = 'sort' | 'group' | 'filter' | null;

/**
 * O singură bară pentru panou: căutarea, „Ordonează”, „Grupează”, „Filtre” și, dedesubt, filtrele rapide.
 * Pe calculator, alegerile se deschid sub buton; pe telefon, de jos în sus, cu variante mari.
 */
@Component({
  selector: 'app-panou-bar',
  imports: [FormsModule, NgTemplateOutlet, Icon],
  template: `
    <div class="bar">
      <label class="search">
        <app-icon name="cautare" />
        <input type="search" placeholder="Caută inel, nume, culoare, crescător, linie, an" aria-label="Caută porumbei"
               [ngModel]="state().q" (ngModelChange)="patch({ q: $event })" />
      </label>
      <div class="tools">
        <button type="button" class="tool" [class.on]="open() === 'sort'" [attr.aria-expanded]="open() === 'sort'" (click)="toggle('sort')">
          <app-icon name="ordonare" [size]="20" /><span class="txt"><span class="what">Ordonează</span><strong>{{ sortLabel() }}</strong></span><app-icon class="chev" name="jos" [size]="18" />
        </button>
        <button type="button" class="tool" [class.on]="open() === 'group'" [attr.aria-expanded]="open() === 'group'" (click)="toggle('group')">
          <app-icon name="grupare" [size]="20" /><span class="txt"><span class="what">Grupează</span><strong>{{ groupLabel() }}</strong></span><app-icon class="chev" name="jos" [size]="18" />
        </button>
        <button type="button" class="tool" [class.on]="open() === 'filter'" [attr.aria-expanded]="open() === 'filter'" (click)="toggle('filter')">
          <app-icon name="filtru" [size]="20" /><span class="txt"><span class="what">Filtre</span><strong>{{ count() ? (count() === 1 ? '1 pus' : count() + ' puse') : 'niciunul' }}</strong></span>@if (count()) { <span class="count">{{ count() }}</span> }<app-icon class="chev" name="jos" [size]="18" />
        </button>
      </div>

      @if (open(); as o) {
        <div class="backdrop" (click)="open.set(null)"></div>
        <div class="panel" role="dialog" [attr.aria-label]="o === 'sort' ? 'Ordonează' : o === 'group' ? 'Grupează' : 'Filtre'">
          <div class="panel-head">
            <strong>{{ o === 'sort' ? 'Ordonează după' : o === 'group' ? 'Grupează după' : 'Filtre' }}</strong>
            <button type="button" class="close" (click)="open.set(null)" aria-label="Închide"><app-icon name="inchide" /></button>
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
              <p class="sub">Rapide</p>
              <div class="chips">
                <ng-container *ngTemplateOutlet="quick" />
              </div>
              <p class="sub">Starea</p>
              <div class="chips">
                @for (s of statuses(); track s.code) {
                  <button type="button" class="qchip" [class.on]="state().statuses.includes(s.code)" [attr.aria-pressed]="state().statuses.includes(s.code)" (click)="toggleIn('statuses', s.code)">{{ s.label }}</button>
                }
              </div>
              @if (years().length) {
                <p class="sub">Anul</p>
                <div class="chips">
                  @for (y of years(); track y) {
                    <button type="button" class="qchip" [class.on]="state().years.includes(y)" [attr.aria-pressed]="state().years.includes(y)" (click)="toggleIn('years', y)">{{ y }}</button>
                  }
                </div>
              }
              <div class="panel-foot">
                <button type="button" (click)="clear()" [disabled]="!count()">Șterge filtrele</button>
                <button type="button" class="primary" (click)="open.set(null)">Gata</button>
              </div>
            }
          }
        </div>
      }
    </div>

    <div class="chips quick" role="group" aria-label="Filtre rapide">
      <ng-container *ngTemplateOutlet="quick" />
    </div>

    <ng-template #quick>
      <button type="button" class="qchip" [class.on]="state().sex === 'M'" [attr.aria-pressed]="state().sex === 'M'" (click)="patch({ sex: state().sex === 'M' ? '' : 'M' })">Masculi</button>
      <button type="button" class="qchip" [class.on]="state().sex === 'F'" [attr.aria-pressed]="state().sex === 'F'" (click)="patch({ sex: state().sex === 'F' ? '' : 'F' })">Femele</button>
      <button type="button" class="qchip" [class.on]="state().young" [attr.aria-pressed]="state().young" (click)="patch({ young: !state().young })">Puii anului {{ year }}</button>
      <button type="button" class="qchip" [class.on]="state().prizes" [attr.aria-pressed]="state().prizes" (click)="patch({ prizes: !state().prizes })">Cu premii</button>
      <button type="button" class="qchip" [class.on]="state().breeding" [attr.aria-pressed]="state().breeding" (click)="patch({ breeding: !state().breeding })">Reproducători</button>
      <button type="button" class="qchip" [class.on]="state().todo" [attr.aria-pressed]="state().todo" (click)="patch({ todo: !state().todo })">De completat</button>
    </ng-template>
  `,
  styles: `
    :host { display: block; margin-bottom: 18px; }
    .bar { position: relative; display: grid; grid-template-columns: minmax(220px, 1fr) auto; gap: 10px; align-items: center; }
    .search { position: relative; display: block; }
    .search app-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
    .search input { padding-left: 50px; border-radius: 999px; }
    .tools { display: flex; gap: 8px; }
    .tool {
      display: inline-flex; align-items: center; gap: 6px; min-height: 52px; padding: 0 14px; border-radius: 999px; white-space: nowrap;
      background: var(--surface); border: 1px solid var(--border-strong); color: var(--text); font-weight: 600; box-shadow: none;
    }
    .tool .txt { display: inline-flex; gap: 6px; min-width: 0; }
    .tool .what { color: var(--muted); font-weight: 600; }
    .tool .what::after { content: ':'; }
    .tool strong { font-weight: 800; overflow: hidden; text-overflow: ellipsis; }
    .tool .chev { color: var(--muted); }
    .tool.on { border-color: var(--accent); background: var(--accent-soft); }
    .count { min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; display: inline-grid; place-items: center; background: var(--accent); color: #fff; font-size: 0.8rem; font-weight: 800; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chips.quick { margin-top: 10px; }
    .qchip {
      min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--border-strong); background: var(--surface);
      color: var(--text); font-weight: 700; font-size: 0.95rem; box-shadow: none;
    }
    .qchip.on { background: var(--accent); border-color: var(--accent); color: #fff; }
    .backdrop { position: fixed; inset: 0; z-index: 30; background: transparent; }
    .panel {
      position: absolute; right: 0; top: calc(100% + 8px); z-index: 31; width: min(400px, 100%); max-height: min(70vh, 620px); overflow: auto;
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
    .panel-foot { display: flex; justify-content: space-between; gap: 10px; padding: 14px 6px 4px; }
    @media (max-width: 1060px) {
      .bar { grid-template-columns: 1fr; }
      .tools { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
      .tool { justify-content: center; padding: 4px 10px; min-width: 0; min-height: 56px; border-radius: 16px; }
      /* Pe ecrane înguste: ce face butonul, iar dedesubt alegerea de acum. */
      .tool .txt { flex-direction: column; gap: 0; align-items: flex-start; line-height: 1.15; }
      .tool .what { color: var(--text); font-weight: 800; }
      .tool .what::after { content: none; }
      .tool .txt strong { color: var(--muted); font-weight: 600; font-size: 0.85em; max-width: 100%; white-space: nowrap; }
    }
    @media (max-width: 767px) {
      .tool { flex-direction: column; gap: 2px; min-height: 68px; font-size: 0.85rem; padding: 4px 6px; position: relative; }
      .tool .txt { align-items: center; max-width: 100%; }
      .tool .chev { display: none; }
      .tool .count { position: absolute; top: 4px; right: 8px; }
      .chips.quick { flex-wrap: nowrap; overflow-x: auto; margin: 10px -16px 0; padding: 0 16px 4px; scrollbar-width: none; }
      .chips.quick .qchip { flex: none; }
      /* Pe telefon: de jos în sus, peste tot ecranul, cu fundal întunecat. */
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
  readonly open = signal<Panel>(null);
  protected readonly sorts = SORTS;
  protected readonly groups = GROUPS;
  protected readonly year = currentYear();
  protected readonly count = computed(() => filterCount(this.state()));
  protected readonly sortLabel = computed(() => SORTS.find((s) => s.key === this.state().sort)?.label ?? '');
  protected readonly groupLabel = computed(() => (this.state().group === 'none' ? 'fără' : GROUPS.find((g) => g.key === this.state().group)?.label ?? ''));

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
