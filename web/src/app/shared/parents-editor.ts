import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { Api, errorMessage } from '../core/api';
import { CoiResult, Pigeon, PigeonSummary } from '../core/models';
import { percent, ringText } from '../core/catalog';
import { PigeonPicker } from './pigeon-picker';
import { ConfirmService, changes } from '../core/confirm';
import { TPipe, t, GluePipe } from '../core/i18n';

/** Tatăl și mama: alegi pe fiecare după inel, vezi cât de înrudiți ar fi puii lor, apoi confirmi. */
@Component({
  selector: 'app-parents-editor',
  imports: [PigeonPicker, TPipe, GluePipe],
  template: `
    <div class="stack">
      <app-pigeon-picker [label]="'parinti.tatal' | t" sex="M" [selected]="father()" (picked)="father.set($event); changed()" />
      <app-pigeon-picker [label]="'parinti.mama' | t" sex="F" [selected]="mother()" (picked)="mother.set($event); changed()" />
      @if (coi(); as c) {
        <div [class]="c.coi >= 0.125 ? 'warning' : 'notice'" role="status">
          @if (c.coi > 0) {
            {{ 'parinti.coi' | t }}{{ ' ' | glue }}<strong>{{ pct(c.coi) }}</strong>{{ '. ' | glue }}{{ 'parinti.stramosi_comuni' | t }}{{ ' ' | glue }}@for (x of c.common; track x.pigeon.id; let last = $last) {<strong class="mono">{{ ring(x.pigeon) }}</strong>{{ last ? '' : (', ' | glue) }}}{{ '.' | glue }}
          } @else {
            {{ 'parinti.fara_stramosi_comuni' | t }}
          }
        </div>
      }
      @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
      @if (dirty()) {
        <button type="button" class="primary" (click)="save()" [disabled]="busy()">{{ 'parinti.confirma' | t }}</button>
      }
    </div>
  `,
})
export class ParentsEditor {
  private readonly api = inject(Api);
  private readonly confirm = inject(ConfirmService);
  readonly pigeonId = input.required<number>();
  readonly initialFather = input<PigeonSummary | null>(null);
  readonly initialMother = input<PigeonSummary | null>(null);
  readonly saved = output<Pigeon>();

  readonly father = signal<PigeonSummary | null>(null);
  readonly mother = signal<PigeonSummary | null>(null);
  readonly coi = signal<CoiResult | null>(null);
  readonly dirty = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  protected readonly pct = percent;
  protected readonly ring = ringText;

  constructor() {
    // Doar părinții primiți de la pagină pornesc efectul; alegerile omului (father/mother) nu trebuie să-l repornească.
    effect(() => {
      const f = this.initialFather();
      const m = this.initialMother();
      untracked(() => {
        this.father.set(f);
        this.mother.set(m);
        this.dirty.set(false);
        this.updateCoi();
      });
    });
  }

  changed() {
    this.dirty.set(true);
    this.error.set('');
    this.updateCoi();
  }

  private async updateCoi() {
    const f = this.father();
    const m = this.mother();
    if (!f || !m) return this.coi.set(null);
    try {
      this.coi.set(await this.api.get<CoiResult>(`/pairs/coi?sireId=${f.id}&damId=${m.id}`));
    } catch {
      this.coi.set(null);
    }
  }

  async save() {
    const diff = changes([
      { label: t('parinti.tatal'), before: this.initialFather() ? ringText(this.initialFather()) : '', after: this.father() ? ringText(this.father()) : '' },
      { label: t('parinti.mama'), before: this.initialMother() ? ringText(this.initialMother()) : '', after: this.mother() ? ringText(this.mother()) : '' },
    ]);
    if (diff.length && !(await this.confirm.ask({ title: t('parinti.schimbi'), lines: diff, confirmLabel: t('parinti.da_schimba') }))) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await this.api.put<{ pigeon: Pigeon }>(`/pigeons/${this.pigeonId()}/parents`, {
        fatherId: this.father()?.id ?? null,
        motherId: this.mother()?.id ?? null,
      });
      this.dirty.set(false);
      this.saved.emit(r.pigeon);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
