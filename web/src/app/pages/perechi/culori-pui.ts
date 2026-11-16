import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api';

/** Factorii de culoare ai unui părinte (ca în src/color-genetics.js). */
interface Factors {
  sex: 'M' | 'F';
  base: string | null;
  baseHidden?: string | null;
  pattern: string | null;
  patternHidden?: string | null;
  spread: boolean | null;
  spreadHidden?: boolean | null;
  dilute: boolean | null;
  diluteHidden?: boolean | null;
}
interface Young { name: string; pct: number; carries: string[] }
interface Prediction { cocks: Young[]; hens: Young[]; unknown: string[] }

const BASES = [{ v: 'BA', l: 'Roșu (cenușiu)' }, { v: '+', l: 'Albastru / negru' }, { v: 'b', l: 'Maro (cafeniu)' }];
const PATTERNS = [{ v: 'CT', l: 'Solzat închis' }, { v: 'C', l: 'Solzat' }, { v: '+', l: 'Cu dungi' }, { v: 'c', l: 'Fără dungi' }];
const lower = (list: { v: string; l: string }[], v: string | null) => (v ? list.slice(list.findIndex((x) => x.v === v) + 1) : []);

/*
 * Culorile probabile ale puilor perechii. Pornește de la culorile din fișe (și ce poartă ascuns, dedus din părinții
 * lor); omul poate corecta ce știe mai bine. Rezultatul e pe sexe, pentru că roșul / albastrul / maroul și diluția
 * sunt legate de sex.
 */
@Component({
  selector: 'app-culori-pui',
  imports: [FormsModule],
  template: `
    <section class="card stack">
      <h2>Culorile probabile ale puilor</h2>
      @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
      @if (result(); as r) {
        <div class="cols">
          <div>
            <h3><span class="sx sM">M</span> Pui masculi</h3>
            @for (y of r.cocks; track y.name + y.carries.join()) {
              <div class="bar"><span class="fill" [style.width.%]="y.pct"></span><span class="txt"><strong>{{ y.pct }}%</strong> {{ y.name }}@if (y.carries.length) {<span class="muted"> · poartă ascuns: {{ y.carries.join(', ') }}</span>}</span></div>
            }
          </div>
          <div>
            <h3><span class="sx sF">F</span> Pui femele</h3>
            @for (y of r.hens; track y.name + y.carries.join()) {
              <div class="bar"><span class="fill" [style.width.%]="y.pct"></span><span class="txt"><strong>{{ y.pct }}%</strong> {{ y.name }}@if (y.carries.length) {<span class="muted"> · poartă ascuns: {{ y.carries.join(', ') }}</span>}</span></div>
            }
          </div>
        </div>
        @if (r.unknown.length) {
          <p class="notice">Nu știm la amândoi părinții: <strong>{{ r.unknown.join(', ') }}</strong>. Partea asta nu intră în calcul; o poți completa mai jos.</p>
        }
      }
      <details>
        <summary>Corectează culorile părinților (ce știi mai bine)</summary>
        @if (sire && dam) {
          <div class="cols edit">
            @for (side of sides; track side.key) {
              @let f = side.key === 'sire' ? sire : dam;
              <fieldset class="stack">
                <legend>{{ side.label }}</legend>
                <label class="field">Culoarea de bază
                  <select [(ngModel)]="f.base" [name]="side.key + 'base'" (ngModelChange)="f.baseHidden = null; recalc()">
                    <option [ngValue]="null">Nu știu</option>
                    @for (o of bases; track o.v) { <option [ngValue]="o.v">{{ o.l }}</option> }
                  </select>
                </label>
                @if (f.sex === 'M' && lowerBases(f.base).length) {
                  <label class="field">Poartă ascuns
                    <select [(ngModel)]="f.baseHidden" [name]="side.key + 'baseH'" (ngModelChange)="recalc()">
                      <option [ngValue]="null">Nimic (sau nu știu)</option>
                      @for (o of lowerBases(f.base); track o.v) { <option [ngValue]="o.v">{{ o.l }}</option> }
                    </select>
                  </label>
                }
                <label class="field">Desenul aripii
                  <select [(ngModel)]="f.pattern" [name]="side.key + 'pat'" (ngModelChange)="f.patternHidden = null; recalc()">
                    <option [ngValue]="null">Nu știu</option>
                    @for (o of patterns; track o.v) { <option [ngValue]="o.v">{{ o.l }}</option> }
                  </select>
                </label>
                @if (lowerPatterns(f.pattern).length) {
                  <label class="field">Desen ascuns
                    <select [(ngModel)]="f.patternHidden" [name]="side.key + 'patH'" (ngModelChange)="recalc()">
                      <option [ngValue]="null">Nimic (sau nu știu)</option>
                      @for (o of lowerPatterns(f.pattern); track o.v) { <option [ngValue]="o.v">{{ o.l }}</option> }
                    </select>
                  </label>
                }
                <label class="field">Negru uniform (spread)
                  <select [(ngModel)]="f.spread" [name]="side.key + 'spr'" (ngModelChange)="f.spreadHidden = null; recalc()">
                    <option [ngValue]="null">Nu știu</option><option [ngValue]="true">Da</option><option [ngValue]="false">Nu</option>
                  </select>
                </label>
                @if (f.spread === true) {
                  <label class="check"><input type="checkbox" [name]="side.key + 'sprH'" [ngModel]="f.spreadHidden === false" (ngModelChange)="f.spreadHidden = $event ? false : null; recalc()" /> Un părinte al lui nu era uniform</label>
                }
                <label class="field">Diluat (argintiu, gălbui)
                  <select [(ngModel)]="f.dilute" [name]="side.key + 'dil'" (ngModelChange)="f.diluteHidden = null; recalc()">
                    <option [ngValue]="null">Nu știu</option><option [ngValue]="true">Da</option><option [ngValue]="false">Nu</option>
                  </select>
                </label>
                @if (f.sex === 'M' && f.dilute === false) {
                  <label class="check"><input type="checkbox" [name]="side.key + 'dilH'" [ngModel]="f.diluteHidden === true" (ngModelChange)="f.diluteHidden = $event ? true : null; recalc()" /> Poartă diluția ascuns</label>
                }
              </fieldset>
            }
          </div>
        }
      </details>
      <p class="muted small">Sunt procente, nu garanții: un porumbel poate purta ascuns ce nu se vede pe pene. Calculul folosește genetica
        clasică a porumbeilor (culoarea de bază și diluția legate de sex, desenul și negrul uniform); bălțatul, tărcatul, albul și
        alte gene nu intră.</p>
    </section>
  `,
  styles: `
    h2, h3 { margin: 0; }
    h3 { display: flex; align-items: center; gap: 8px; font-size: 1.05rem; margin-bottom: 6px; }
    .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
    .bar { position: relative; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; margin-bottom: 6px; min-height: 44px; display: flex; align-items: center; }
    .fill { position: absolute; inset: 0 auto 0 0; background: var(--accent-soft); }
    .txt { position: relative; padding: 6px 10px; }
    .sx { width: 24px; height: 24px; border-radius: 50%; display: inline-grid; place-items: center; font-size: 0.75rem; color: #fff; }
    .sx.sM { background: var(--male); }
    .sx.sF { background: var(--female); }
    details summary { cursor: pointer; font-weight: 700; min-height: 48px; display: flex; align-items: center; color: var(--accent-strong); }
    fieldset { border: 1px solid var(--border); border-radius: 14px; padding: 10px 12px 12px; margin: 0; }
    legend { font-weight: 800; padding: 0 6px; }
    .check { display: flex; align-items: center; gap: 10px; font-weight: 600; min-height: 44px; }
    .check input { width: 22px; height: 22px; }
    .small { font-size: 0.9rem; margin: 0; }
  `,
})
export class CuloriPui {
  private readonly api = inject(Api);
  readonly pairId = input.required<number>();
  readonly result = signal<Prediction | null>(null);
  readonly error = signal('');
  sire: Factors | null = null;
  dam: Factors | null = null;
  protected readonly bases = BASES;
  protected readonly patterns = PATTERNS;
  protected readonly sides = [{ key: 'sire', label: 'Masculul' }, { key: 'dam', label: 'Femela' }] as const;
  protected readonly lowerBases = (v: string | null) => lower(BASES, v);
  protected readonly lowerPatterns = (v: string | null) => lower(PATTERNS, v);

  constructor() {
    effect(() => {
      const id = this.pairId();
      untracked(() => this.load(id));
    });
  }

  private async load(id: number) {
    try {
      const r = await this.api.get<{ sire: Factors; dam: Factors; result: Prediction }>(`/pairs/${id}/colors`);
      this.sire = r.sire;
      this.dam = r.dam;
      this.result.set(r.result);
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async recalc() {
    try {
      this.result.set(await this.api.post<Prediction>('/colors/predict', { sire: this.sire, dam: this.dam }));
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
