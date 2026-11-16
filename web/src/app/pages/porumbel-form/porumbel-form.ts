import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CatalogService } from '../../core/catalog';
import { Kind, Pigeon, Sex } from '../../core/models';
import { RingInput } from '../../shared/ring-input';

interface Draft {
  kind: Kind;
  ring: string;
  sex: Sex | '';
  name: string;
  breed: string;
  lines: string;
  color: string;
  colorPa: boolean;
  colorText: string;
  eyeColor: string;
  status: string;
  hatchedOn: string;
  breederText: string;
  pedigreeText: string;
  scores: Record<string, number | null>;
  calitati: string;
  deDorit: string;
  defecte: string;
}

const empty = (): Draft => ({
  kind: 'own', ring: '', sex: '', name: '', breed: 'voiajor', lines: '', color: '', colorPa: false, colorText: '', eyeColor: '',
  status: '', hatchedOn: '', breederText: '', pedigreeText: '', scores: {}, calitati: '', deDorit: '', defecte: '',
});

const fromPigeon = (p: Pigeon): Draft => ({
  kind: p.kind, ring: p.ring?.raw ?? '', sex: p.sex ?? '', name: p.name ?? '', breed: p.breed, lines: p.lines.join(', '),
  color: p.color ?? '', colorPa: p.colorPa, colorText: p.colorText ?? '', eyeColor: p.eyeColor ?? '', status: p.status ?? '',
  hatchedOn: p.hatchedOn ?? '', breederText: p.breederText ?? '', pedigreeText: p.pedigreeText ?? '',
  scores: { ...(p.evaluation.scores ?? {}) }, calitati: p.evaluation.calitati ?? '', deDorit: p.evaluation.deDorit ?? '',
  defecte: p.evaluation.defecte ?? '',
});

/** Ciorna rămâne pe telefon până la salvare: o cădere scurtă a internetului nu pierde ce ai scris. */
const DRAFT_KEY = (id: string | undefined) => `porumbar.ciorna.${id ?? 'nou'}`;
function readDraft(id: string | undefined): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY(id));
    return raw ? { ...empty(), ...JSON.parse(raw) } : null;
  } catch {
    return null;
  }
}
function writeDraft(id: string | undefined, d: Draft | null) {
  try {
    if (d) localStorage.setItem(DRAFT_KEY(id), JSON.stringify(d));
    else localStorage.removeItem(DRAFT_KEY(id));
  } catch {
    /* fără spațiu local: nu e grav */
  }
}

@Component({
  selector: 'app-porumbel-form',
  imports: [FormsModule, RingInput],
  template: `
    <h1>{{ id() ? 'Editează porumbelul' : 'Porumbel nou' }}</h1>
    @if (restored()) {
      <div class="notice row" role="status">
        Am păstrat ce scriseseși data trecută.
        <button type="button" class="link" (click)="discardDraft()">Începe de la zero</button>
      </div>
    }
    @if (d(); as f) {
      <form class="stack" (ngSubmit)="save()" (input)="keep()" (change)="keep()">
        <section class="card stack">
          <h2>Identitate</h2>
          <div class="row kinds" role="radiogroup" aria-label="Al cui e porumbelul">
            <label class="check"><input type="radio" name="kind" value="own" [(ngModel)]="f.kind" /> E porumbelul meu</label>
            <label class="check"><input type="radio" name="kind" value="external" [(ngModel)]="f.kind" /> E un strămoș (al altcuiva)</label>
          </div>
          <app-ring-input [(value)]="f.ring" [required]="f.kind === 'own'" />
          <fieldset class="row sexes">
            <legend>Sexul</legend>
            <label class="check"><input type="radio" name="sex" value="M" [(ngModel)]="f.sex" /> Mascul</label>
            <label class="check"><input type="radio" name="sex" value="F" [(ngModel)]="f.sex" /> Femelă</label>
            <label class="check"><input type="radio" name="sex" value="" [(ngModel)]="f.sex" /> Nu știu încă</label>
          </fieldset>
          <label class="field">Nume sau poreclă <span class="hint">de ex. „DE 546”, „Super Velden”</span>
            <input name="name" [(ngModel)]="f.name" />
          </label>
          <label class="field">Data eclozării <span class="hint">opțional</span>
            <input type="date" name="hatchedOn" [(ngModel)]="f.hatchedOn" />
          </label>
          <label class="field">Crescătorul de origine <span class="hint">de ex. „Van Heteren”, „Comb. Den Haan”</span>
            <input name="breederText" [(ngModel)]="f.breederText" />
          </label>
          <label class="field">Starea
            <select name="status" [(ngModel)]="f.status">
              <option value="">—</option>
              @for (s of cat()?.statuses ?? []; track s.code) { <option [value]="s.code">{{ s.label }}</option> }
            </select>
          </label>
        </section>

        <section class="card stack">
          <h2>Rasă și linii</h2>
          <label class="field">Rasa
            <select name="breed" [(ngModel)]="f.breed">
              @for (b of cat()?.breeds ?? []; track b.code) { <option [value]="b.code">{{ b.label }}</option> }
            </select>
          </label>
          <label class="field">Liniile <span class="hint">despărțite prin virgulă, de ex. „Janssen, Van Heteren”</span>
            <input name="lines" [(ngModel)]="f.lines" />
          </label>
        </section>

        <section class="card stack">
          <h2>Culoare</h2>
          <label class="field">Culoarea penajului
            <select name="color" [(ngModel)]="f.color">
              <option value="">—</option>
              @for (c of cat()?.colors ?? []; track c.code) { <option [value]="c.code">{{ c.label }}</option> }
            </select>
          </label>
          <label class="check"><input type="checkbox" name="colorPa" [(ngModel)]="f.colorPa" /> Are pene albe (p.a.)</label>
          <label class="field">Culoarea, cum o scrii tu <span class="hint">opțional</span>
            <input name="colorText" [(ngModel)]="f.colorText" />
          </label>
          <label class="field">Culoarea ochilor
            <select name="eyeColor" [(ngModel)]="f.eyeColor">
              <option value="">—</option>
              @for (c of cat()?.eyeColors ?? []; track c.code) { <option [value]="c.code">{{ c.label }}</option> }
            </select>
          </label>
        </section>

        <section class="card stack">
          <h2>Evaluare la mână</h2>
          <p class="muted">Note de la 1 (slab) la 5 (foarte bun). Lasă gol ce n-ai evaluat.</p>
          @for (c of cat()?.evalCriteria ?? []; track c.code) {
            <div class="score" role="radiogroup" [attr.aria-label]="c.label">
              <span class="score-label">{{ c.label }}</span>
              <div class="score-buttons">
                @for (n of [1, 2, 3, 4, 5]; track n) {
                  <button type="button" [class.on]="f.scores[c.code] === n" [attr.aria-pressed]="f.scores[c.code] === n"
                          (click)="setScore(c.code, n)">{{ n }}</button>
                }
              </div>
            </div>
          }
          <label class="field">Calități <textarea name="calitati" [(ngModel)]="f.calitati"></textarea></label>
          <label class="field">De dorit <textarea name="deDorit" [(ngModel)]="f.deDorit"></textarea></label>
          <label class="field">Defecte <textarea name="defecte" [(ngModel)]="f.defecte"></textarea></label>
        </section>

        <section class="card stack">
          <h2>Text pentru pedigree</h2>
          <label class="field">Ce să scrie în căsuța lui pe pedigree <span class="hint">titluri, palmares, de ex. „Super reproducătoare”</span>
            <textarea name="pedigreeText" [(ngModel)]="f.pedigreeText"></textarea>
          </label>
        </section>

        @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
        <div class="actions">
          <button class="primary" type="submit" [disabled]="busy()">{{ busy() ? 'Se salvează…' : 'Salvează' }}</button>
          <button type="button" (click)="cancel()">Renunță</button>
        </div>
      </form>
    }
  `,
  styles: `
    section h2 { margin-top: 0; }
    fieldset { border: 0; padding: 0; margin: 0; }
    legend { font-weight: 600; margin-bottom: 6px; }
    .score { display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap; }
    .score-label { font-weight: 600; min-width: 120px; }
    .score-buttons { display: flex; gap: 6px; }
    .score-buttons button { width: 48px; padding: 0; }
    .score-buttons button.on { background: var(--accent); color: #fff; border-color: var(--accent); }
    .actions { display: flex; gap: 12px; position: sticky; bottom: 0; padding: 12px 0; background: var(--bg); }
    .actions > * { flex: 1; }
    @media (max-width: 767px) { .actions { bottom: 76px; } }
  `,
})
export default class PorumbelForm implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly catalog = inject(CatalogService);
  readonly id = input<string>();
  protected readonly cat = computed(() => this.catalog.catalog());
  readonly d = signal<Draft | null>(null);
  readonly restored = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');

  async ngOnInit() {
    const draft = readDraft(this.id());
    try {
      const base = this.id() ? fromPigeon((await this.api.get<{ pigeon: Pigeon }>(`/pigeons/${this.id()}`)).pigeon) : empty();
      this.d.set(draft ?? base);
      this.restored.set(!!draft);
    } catch (e) {
      this.error.set(errorMessage(e));
      this.d.set(draft ?? empty());
    }
  }

  keep() {
    writeDraft(this.id(), this.d());
  }

  discardDraft() {
    writeDraft(this.id(), null);
    this.restored.set(false);
    this.ngOnInit();
  }

  /** „Renunță” aruncă și ciorna: altfel modificările lăsate baltă ar reapărea data viitoare peste datele salvate. */
  cancel() {
    writeDraft(this.id(), null);
    this.router.navigate(this.id() ? ['/porumbei', this.id()] : ['/panou']);
  }

  setScore(code: string, n: number) {
    const f = this.d()!;
    f.scores[code] = f.scores[code] === n ? null : n;
    this.d.set({ ...f });
    this.keep();
  }

  async save() {
    const f = this.d()!;
    this.busy.set(true);
    this.error.set('');
    const scores = Object.fromEntries(Object.entries(f.scores).filter(([, v]) => v != null));
    const body = {
      kind: f.kind,
      ring: f.ring.trim() || null,
      sex: f.sex || null,
      name: f.name.trim() || null,
      breed: f.breed,
      lines: f.lines.split(',').map((s) => s.trim()).filter(Boolean),
      color: f.color || null,
      colorPa: f.colorPa,
      colorText: f.colorText.trim() || null,
      eyeColor: f.eyeColor || null,
      status: f.status || null,
      hatchedOn: f.hatchedOn || null,
      breederText: f.breederText.trim() || null,
      pedigreeText: f.pedigreeText.trim() || null,
      evaluation: { scores, calitati: f.calitati || null, deDorit: f.deDorit || null, defecte: f.defecte || null },
    };
    try {
      const r = this.id()
        ? await this.api.patch<{ pigeon: Pigeon }>(`/pigeons/${this.id()}`, body)
        : await this.api.post<{ pigeon: Pigeon }>('/pigeons', body);
      writeDraft(this.id(), null);
      this.router.navigate(['/porumbei', r.pigeon.id], { queryParams: this.id() ? {} : { nou: 1 } });
    } catch (e) {
      const msg = errorMessage(e);
      this.error.set(msg.startsWith('Nu s-a putut ajunge') ? 'Nu s-a putut salva. Verifică internetul și apasă din nou Salvează.' : msg);
    } finally {
      this.busy.set(false);
    }
  }
}
