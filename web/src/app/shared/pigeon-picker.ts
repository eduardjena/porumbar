import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../core/api';
import { HistoryCard, LookupResult, Pigeon, PigeonSummary, Sex } from '../core/models';
import { CatalogService } from '../core/catalog';
import { PigeonChip } from './pigeon-chip';

/*
 * Alegerea unui părinte după inel (cerut de crescător): scrii inelul și vezi imediat istoricul acelui porumbel —
 * părinții lui, câți pui are și care — apoi îl alegi. Dacă nu e în porumbar, îl adaugi pe loc ca strămoș.
 */
@Component({
  selector: 'app-pigeon-picker',
  imports: [FormsModule, PigeonChip],
  template: `
    <div class="picker stack">
      <div class="head">
        <strong>{{ label() }}</strong>
        @if (selected()) {
          <span class="row"><app-pigeon-chip [pigeon]="selected()" [link]="false" />
            <button type="button" class="link" (click)="clear()">Schimbă</button></span>
        }
      </div>

      @if (!selected()) {
        <label class="field">
          <span class="hint">Scrie inelul {{ sex() === 'M' ? 'tatălui' : 'mamei' }}</span>
          <input class="mono" [name]="'ring-' + sex()" [(ngModel)]="ring" (ngModelChange)="search()"
                 placeholder="de ex. RO-24-199163" autocapitalize="characters" autocomplete="off" spellcheck="false" />
        </label>
        @if (searching()) { <p class="muted">Caut…</p> }
        @for (c of result()?.matches ?? []; track c.pigeon.id) {
          <div class="history card stack">
            <app-pigeon-chip [pigeon]="c.pigeon" [link]="false" />
            @if (c.pigeon.lines.length) { <p class="muted">Linii: {{ c.pigeon.lines.join(', ') }}</p> }
            @if (c.pigeon.pedigreeText) { <p class="text">{{ c.pigeon.pedigreeText }}</p> }
            <p>Tată: <app-pigeon-chip [pigeon]="c.father" [link]="false" /></p>
            <p>Mamă: <app-pigeon-chip [pigeon]="c.mother" [link]="false" /></p>
            <p><strong>{{ c.offspringCount }} {{ c.offspringCount === 1 ? 'pui' : 'pui' }}</strong> în porumbar</p>
            @if (c.offspring.length) {
              <ul class="kids">
                @for (k of c.offspring; track k.id) { <li><app-pigeon-chip [pigeon]="k" [link]="false" /></li> }
              </ul>
            }
            @if (wrongSex(c)) {
              <div class="warning">Acest porumbel e {{ c.pigeon.sex === 'M' ? 'mascul' : 'femelă' }}: nu poate fi {{ sex() === 'M' ? 'tatăl' : 'mama' }}.</div>
            } @else {
              <button type="button" class="primary" (click)="pick(c.pigeon)">Alege ca {{ sex() === 'M' ? 'tată' : 'mamă' }}</button>
            }
          </div>
        }
        @if (result() && !result()!.matches.length && ring.trim()) {
          <div class="card stack">
            <p>Inelul <strong class="mono">{{ result()!.ring.display }}</strong> nu e în porumbarul tău. Îl adaugi ca strămoș?</p>
            <label class="field">Nume sau poreclă <span class="hint">opțional</span>
              <input [name]="'name-' + sex()" [(ngModel)]="newName" />
            </label>
            <label class="field">Culoarea <span class="hint">opțional, cum scrie pe pedigree</span>
              <input [name]="'color-' + sex()" [(ngModel)]="newColor" />
            </label>
            <label class="field">Ce scrie pe pedigree despre el <span class="hint">opțional</span>
              <textarea [name]="'text-' + sex()" [(ngModel)]="newText"></textarea>
            </label>
            <button type="button" class="primary" (click)="addExternal()" [disabled]="busy()">Adaugă și alege</button>
          </div>
        }
        @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
      }
    </div>
  `,
  styles: `
    .picker { border: 2px dashed var(--border); border-radius: var(--radius); padding: 12px; }
    .head { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
    .history p { margin: 0; }
    .text { white-space: pre-wrap; color: var(--muted); }
    .kids { margin: 0; padding-left: 20px; }
  `,
})
export class PigeonPicker {
  private readonly api = inject(Api);
  protected readonly catalog = inject(CatalogService);
  readonly label = input.required<string>();
  readonly sex = input.required<Sex>();
  readonly selected = input<PigeonSummary | null>(null);
  readonly picked = output<PigeonSummary | null>();

  ring = '';
  newName = '';
  newColor = '';
  newText = '';
  readonly result = signal<LookupResult | null>(null);
  readonly searching = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  private timer: ReturnType<typeof setTimeout> | undefined;

  protected readonly wrongSex = (c: HistoryCard) => c.pigeon.sex != null && c.pigeon.sex !== this.sex();

  search() {
    clearTimeout(this.timer);
    this.result.set(null);
    if (!this.ring.trim()) return;
    this.timer = setTimeout(() => this.lookup(), 400);
  }

  private async lookup() {
    this.searching.set(true);
    this.error.set('');
    try {
      this.result.set(await this.api.get<LookupResult>(`/pigeons/lookup?ring=${encodeURIComponent(this.ring.trim())}`));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.searching.set(false);
    }
  }

  pick(p: PigeonSummary) {
    this.picked.emit(p);
    this.ring = '';
    this.result.set(null);
  }

  clear() {
    this.picked.emit(null);
  }

  async addExternal() {
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await this.api.post<{ pigeon: Pigeon }>('/pigeons', {
        kind: 'external',
        ring: this.ring.trim(),
        sex: this.sex(),
        name: this.newName || null,
        colorText: this.newColor || null,
        pedigreeText: this.newText || null,
      });
      this.newName = this.newColor = this.newText = '';
      this.pick(r.pigeon);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
