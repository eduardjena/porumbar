import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService } from '../../core/confirm';
import { percent, ringText, sexShort } from '../../core/catalog';
import { Clutch, Pair, PigeonSummary } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Breadcrumbs } from '../../shared/breadcrumbs';
import { STATUS_LABEL, roDate } from './perechi';
import { CuloriPui } from './culori-pui';

const today = () => new Date().toISOString().slice(0, 10);

/** Ce se completează pe o pontă (ouăle, apoi eclozarea), ca texte de formular. */
interface ClutchForm {
  egg1On: string;
  egg2On: string;
  eggs: number;
  hatchedOn: string;
  hatched: number;
  infertile: number;
  broken: number;
  fosterPairId: number | null;
  note: string;
}

/*
 * O pereche: datele ei, pontele (ouă → eclozare așteptată → eclozare → inelare) și puii inelați din fiecare pontă.
 * La inelare se propune inelul următor din seriile de inele; puiul devine porumbel cu tatăl și mama perechii.
 */
@Component({
  selector: 'app-pereche',
  imports: [FormsModule, RouterLink, Icon, Breadcrumbs, CuloriPui],
  template: `
    @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
    @if (pair(); as p) {
      <app-breadcrumbs [items]="[{ label: 'Perechi ' + p.season, link: ['/perechi'], query: { sezon: p.season } }, { label: ring(p.cock) + ' × ' + ring(p.hen) }]" />
      <h1 class="birds">
        <a [routerLink]="['/porumbei', p.cock?.id]"><span class="sx sM">M</span><span class="mono">{{ ring(p.cock) }}</span></a>
        <span class="x">×</span>
        <a [routerLink]="['/porumbei', p.hen?.id]"><span class="sx sF">F</span><span class="mono">{{ ring(p.hen) }}</span></a>
      </h1>
      <p class="meta">
        <span class="badge">{{ status[p.status] }}</span>
        @if (p.pairedOn) { <span>din {{ date(p.pairedOn) }}</span> }
        @if (p.separatedOn) { <span>despărțiți pe {{ date(p.separatedOn) }}</span> }
        @if (p.nest) { <span>cuibul {{ p.nest }}</span> }
      </p>
      <div [class]="p.coi >= 0.125 ? 'warning' : 'notice'" role="status">
        @if (p.coi > 0) { Puii acestei perechi au consangvinizare <strong>{{ pct(p.coi) }}</strong>. }
        @else { Masculul și femela nu au strămoși comuni cunoscuți: puii nu sunt consangvini. }
      </div>

      @if (!editing()) {
        <div class="row actions">
          @if (p.status === 'planificata') { <button type="button" class="primary" (click)="startPair(p)"><app-icon name="bifa" />I-am pus împreună azi</button> }
          <button type="button" (click)="openEdit(p)"><app-icon name="editeaza" />Schimbă perechea</button>
        </div>
      } @else {
        <form class="card stack" (ngSubmit)="saveEdit()">
          <label class="field">Data împerecherii <span class="hint">(goală = doar plănuită)</span><input type="date" name="pairedOn" [(ngModel)]="e.pairedOn" /></label>
          <label class="field">Data despărțirii <span class="hint">(goală = sunt încă împreună)</span><input type="date" name="separatedOn" [(ngModel)]="e.separatedOn" /></label>
          <label class="field">Cuibul / boxa <input name="nest" [(ngModel)]="e.nest" /></label>
          <label class="field">Notă <textarea name="note" [(ngModel)]="e.note"></textarea></label>
          @if (editError()) { <div class="error" role="alert">{{ editError() }}</div> }
          <div class="row">
            <button class="primary" type="submit"><app-icon name="bifa" />Salvează</button>
            <button type="button" (click)="editing.set(false)">Renunță</button>
          </div>
        </form>
      }
      @if (p.note) { <p class="pre">{{ p.note }}</p> }

      <app-culori-pui [pairId]="p.id" />

      <h2>Ponte</h2>
      @if (p.status !== 'planificata') {
        <form class="card stack" (ngSubmit)="addClutch()">
          <h3>Pontă nouă</h3>
          <div class="row">
            <label class="field grow">Primul ou <input type="date" name="egg1" [(ngModel)]="egg1On" required /></label>
            <label class="field grow">Al doilea ou <span class="hint">(dacă e)</span><input type="date" name="egg2" [(ngModel)]="egg2On" /></label>
          </div>
          @if (clutchError()) { <div class="error" role="alert">{{ clutchError() }}</div> }
          <button class="primary" type="submit" [disabled]="!egg1On"><app-icon name="ou" />Adaugă ponta</button>
        </form>
      } @else {
        <p class="muted">Ponte se adaugă după ce pui perechea împreună.</p>
      }

      <ul class="clutches">
        @for (c of p.clutches ?? []; track c.id) {
          <li class="card stack">
            <div class="row between">
              <strong>Ouă: {{ date(c.egg1On) }}@if (c.egg2On) { și {{ date(c.egg2On) }}}<span class="muted"> ({{ c.eggs }} {{ c.eggs === 1 ? 'ou' : 'ouă' }})</span></strong>
              <button type="button" class="link" (click)="removeClutch(c)">Șterge</button>
            </div>
            @if (c.foster) { <p class="muted">Clocite de doica {{ ring(c.foster.cock) }} × {{ ring(c.foster.hen) }}</p> }
            @if (c.expectedHatch; as h) {
              <p class="step">Puii ar trebui să iasă între <strong>{{ date(h.from) }}</strong> și <strong>{{ date(h.to) }}</strong>.</p>
            }
            @if (c.hatchedOn) {
              <p class="step">Au ieșit pe <strong>{{ date(c.hatchedOn) }}</strong>: {{ c.hatched ?? '?' }} {{ c.hatched === 1 ? 'pui' : 'pui' }}@if (c.infertile) { · {{ c.infertile }} limpezi}@if (c.broken) { · {{ c.broken }} sparte}.</p>
              <p class="step">Se inelează între <strong>{{ date(c.ringFrom) }}</strong> și <strong>{{ date(c.ringTo) }}</strong>.</p>
            }

            @if (clutchEdit() === c.id) {
              <form class="stack sub" (ngSubmit)="saveClutch(c)">
                <div class="row">
                  <label class="field grow">Data eclozării <input type="date" name="hatchedOn" [(ngModel)]="cf.hatchedOn" /></label>
                  <label class="field grow">Câți pui au ieșit
                    <select name="hatched" [(ngModel)]="cf.hatched">@for (n of nums(cf.eggs); track n) { <option [ngValue]="n">{{ n }}</option> }</select>
                  </label>
                </div>
                <div class="row">
                  <label class="field grow">Ouă limpezi (nefecundate)
                    <select name="infertile" [(ngModel)]="cf.infertile">@for (n of nums(cf.eggs); track n) { <option [ngValue]="n">{{ n }}</option> }</select>
                  </label>
                  <label class="field grow">Ouă sparte
                    <select name="broken" [(ngModel)]="cf.broken">@for (n of nums(cf.eggs); track n) { <option [ngValue]="n">{{ n }}</option> }</select>
                  </label>
                </div>
                <div class="row">
                  <label class="field grow">Primul ou <input type="date" name="cegg1" [(ngModel)]="cf.egg1On" /></label>
                  <label class="field grow">Al doilea ou <input type="date" name="cegg2" [(ngModel)]="cf.egg2On" /></label>
                  <label class="field grow">Câte ouă
                    <select name="eggs" [(ngModel)]="cf.eggs">@for (n of [1, 2, 3]; track n) { <option [ngValue]="n">{{ n }}</option> }</select>
                  </label>
                </div>
                @if (fosters().length) {
                  <label class="field">Doica <span class="hint">(altă pereche care clocește ouăle)</span>
                    <select name="foster" [(ngModel)]="cf.fosterPairId">
                      <option [ngValue]="null">— fără doică —</option>
                      @for (f of fosters(); track f.id) { <option [ngValue]="f.id">{{ ring(f.cock) }} × {{ ring(f.hen) }}@if (f.nest) { (cuibul {{ f.nest }})}</option> }
                    </select>
                  </label>
                }
                <label class="field">Notă <textarea name="cnote" [(ngModel)]="cf.note"></textarea></label>
                @if (clutchError()) { <div class="error" role="alert">{{ clutchError() }}</div> }
                <div class="row">
                  <button class="primary" type="submit"><app-icon name="bifa" />Salvează</button>
                  <button type="button" (click)="clutchEdit.set(null)">Renunță</button>
                </div>
              </form>
            } @else {
              <div class="row">
                <button type="button" [class.primary]="!c.hatchedOn" (click)="openClutch(c)"><app-icon name="editeaza" />{{ c.hatchedOn ? 'Schimbă ponta' : 'Au ieșit puii' }}</button>
              </div>
            }

            @if (c.young.length) {
              <h4>Puii inelați</h4>
              <ul class="young">
                @for (y of c.young; track y.id) {
                  <li><a [routerLink]="['/porumbei', y.id]" class="mono">{{ ring(y) }}</a><span class="muted"> · {{ sex(y.sex) }}@if (y.name) { · „{{ y.name }}”}</span></li>
                }
              </ul>
            }
            @if (c.hatchedOn && c.young.length < (c.hatched ?? c.eggs)) {
              @if (ringFor() === c.id) {
                <form class="stack sub" (ngSubmit)="ringYoung(c)">
                  <label class="field">Inelul puiului <input name="ring" class="mono" [(ngModel)]="yRing" required placeholder="RO-26-800540" /></label>
                  @if (suggested()) { <span class="hint">Propus din seria ta de inele. Îl poți schimba.</span> }
                  <div class="row">
                    <label class="field grow">Sexul
                      <select name="ysex" [(ngModel)]="ySex"><option value="">Nu se știe încă</option><option value="M">Mascul</option><option value="F">Femelă</option></select>
                    </label>
                    <label class="field grow">Nume <span class="hint">(nu e obligatoriu)</span><input name="yname" [(ngModel)]="yName" /></label>
                  </div>
                  @if (youngError()) { <div class="error" role="alert">{{ youngError() }}</div> }
                  <div class="row">
                    <button class="primary" type="submit" [disabled]="!yRing.trim() || busy()"><app-icon name="bifa" />Inelează puiul</button>
                    <button type="button" (click)="ringFor.set(null)">Renunță</button>
                  </div>
                </form>
              } @else {
                <button type="button" class="primary" (click)="openRing(c)"><app-icon name="plus" />Inelează un pui</button>
              }
            }
          </li>
        } @empty {
          @if (p.status !== 'planificata') { <p class="muted">Nicio pontă încă.</p> }
        }
      </ul>

      <section class="card stack delete-zone">
        <h3>Ștergerea perechii</h3>
        <p class="muted">Se șterg perechea și pontele ei. Puii inelați rămân în porumbar, cu tatăl și mama lor.</p>
        <div><button type="button" class="danger" (click)="removePair(p)">Șterge perechea</button></div>
      </section>
    }
  `,
  styles: `
    .birds { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .birds a { display: inline-flex; align-items: center; gap: 6px; color: var(--text); text-decoration: none; }
    .x { color: var(--muted); }
    .sx { width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; font-size: 0.8rem; color: #fff; }
    .sx.sM { background: var(--male); }
    .sx.sF { background: var(--female); }
    .meta { display: flex; flex-wrap: wrap; gap: 6px 14px; color: var(--muted); align-items: center; }
    .actions { margin: 12px 0; }
    .grow { flex: 1 1 160px; }
    .between { justify-content: space-between; }
    .clutches { list-style: none; padding: 0; display: flex; flex-direction: column; gap: 12px; margin-top: 14px; }
    .step { margin: 0; }
    .sub { border-top: 1px solid var(--border); padding-top: 12px; }
    h3, h4 { margin: 0; }
    .young { margin: 0; padding-left: 20px; }
    .young li { margin: 4px 0; }
    .pre { white-space: pre-wrap; }
    .delete-zone { margin-top: 28px; border-color: #e7b4ae; }
    .delete-zone p { margin: 0; }
  `,
})
export default class Pereche {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  readonly id = input.required<string>();
  readonly pair = signal<Pair | null>(null);
  readonly fosters = signal<Pair[]>([]);
  readonly error = signal('');
  readonly editError = signal('');
  readonly clutchError = signal('');
  readonly youngError = signal('');
  readonly editing = signal(false);
  readonly clutchEdit = signal<number | null>(null);
  readonly ringFor = signal<number | null>(null);
  readonly suggested = signal(false);
  readonly busy = signal(false);
  e = { pairedOn: '', separatedOn: '', nest: '', note: '' };
  cf: ClutchForm = { egg1On: '', egg2On: '', eggs: 2, hatchedOn: '', hatched: 2, infertile: 0, broken: 0, fosterPairId: null, note: '' };
  egg1On = today();
  egg2On = '';
  yRing = '';
  ySex = '';
  yName = '';
  protected readonly status = STATUS_LABEL;
  protected readonly date = roDate;
  protected readonly pct = percent;
  protected readonly sex = (s: string | null) => (s === 'M' ? 'mascul' : s === 'F' ? 'femelă' : 'sex necunoscut');
  protected readonly ring = (p: PigeonSummary | null | undefined) => (p ? ringText(p) : '—');
  protected readonly nums = (max: number) => Array.from({ length: max + 1 }, (_, i) => i);
  protected readonly sexShort = sexShort;

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  private async load(id: string) {
    try {
      const pair = (await this.api.get<{ pair: Pair }>(`/pairs/${id}`)).pair;
      this.pair.set(pair);
      this.error.set('');
      const others = await this.api.get<{ pairs: Pair[] }>(`/pairs?season=${pair.season}`);
      this.fosters.set(others.pairs.filter((x) => x.id !== pair.id && x.status !== 'planificata'));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  private reload() {
    return this.load(this.id());
  }

  async startPair(p: Pair) {
    try {
      await this.api.patch(`/pairs/${p.id}`, { pairedOn: today() });
      await this.reload();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  openEdit(p: Pair) {
    this.e = { pairedOn: p.pairedOn ?? '', separatedOn: p.separatedOn ?? '', nest: p.nest ?? '', note: p.note ?? '' };
    this.editError.set('');
    this.editing.set(true);
  }

  async saveEdit() {
    try {
      await this.api.patch(`/pairs/${this.id()}`, {
        pairedOn: this.e.pairedOn || null, separatedOn: this.e.separatedOn || null, nest: this.e.nest || null, note: this.e.note || null,
        season: this.pair()?.season,
      });
      this.editing.set(false);
      await this.reload();
    } catch (e) {
      this.editError.set(errorMessage(e));
    }
  }

  async addClutch() {
    this.clutchError.set('');
    try {
      await this.api.post(`/pairs/${this.id()}/clutches`, { egg1On: this.egg1On, egg2On: this.egg2On || null });
      this.egg1On = today();
      this.egg2On = '';
      await this.reload();
    } catch (e) {
      this.clutchError.set(errorMessage(e));
    }
  }

  openClutch(c: Clutch) {
    this.clutchError.set('');
    this.cf = {
      egg1On: c.egg1On, egg2On: c.egg2On ?? '', eggs: c.eggs, hatchedOn: c.hatchedOn ?? today(),
      hatched: c.hatched ?? Math.max(0, c.eggs - c.infertile - c.broken), infertile: c.infertile, broken: c.broken,
      fosterPairId: c.fosterPairId, note: c.note ?? '',
    };
    this.clutchEdit.set(c.id);
  }

  async saveClutch(c: Clutch) {
    this.clutchError.set('');
    const f = this.cf;
    try {
      await this.api.patch(`/clutches/${c.id}`, {
        egg1On: f.egg1On, egg2On: f.egg2On || null, eggs: f.eggs, hatchedOn: f.hatchedOn || null, hatched: f.hatchedOn ? f.hatched : null,
        infertile: f.infertile, broken: f.broken, fosterPairId: f.fosterPairId, note: f.note || null,
      });
      this.clutchEdit.set(null);
      await this.reload();
    } catch (e) {
      this.clutchError.set(errorMessage(e));
    }
  }

  async removeClutch(c: Clutch) {
    const ok = await this.confirm.ask({
      title: 'Ștergi ponta?',
      lines: [`Ouă din ${roDate(c.egg1On)}.`, c.young.length ? 'Puii inelați din ea rămân în porumbar.' : 'Nu se poate da înapoi.'],
      confirmLabel: 'Da, șterge ponta',
      danger: true,
    });
    if (!ok) return;
    await this.api.delete(`/clutches/${c.id}`);
    await this.reload();
  }

  async openRing(c: Clutch) {
    this.youngError.set('');
    this.yRing = '';
    this.ySex = '';
    this.yName = '';
    this.suggested.set(false);
    this.ringFor.set(c.id);
    try {
      const year = (c.hatchedOn ?? c.egg1On).slice(0, 4);
      const r = await this.api.get<{ ring: string | null }>(`/ring-series/next?year=${year}`);
      if (r.ring && !this.yRing) {
        this.yRing = r.ring;
        this.suggested.set(true);
      }
    } catch {
      // fără propunere: omul scrie inelul
    }
  }

  async ringYoung(c: Clutch) {
    this.youngError.set('');
    this.busy.set(true);
    try {
      await this.api.post(`/clutches/${c.id}/young`, { ring: this.yRing, sex: this.ySex || null, name: this.yName || null });
      this.ringFor.set(null);
      await this.reload();
    } catch (e) {
      this.youngError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async removePair(p: Pair) {
    const ok = await this.confirm.ask({
      title: 'Ștergi perechea?',
      lines: [`${this.ring(p.cock)} × ${this.ring(p.hen)}, sezonul ${p.season}.`, 'Se șterg și pontele ei. Puii inelați rămân în porumbar.', 'Nu se poate da înapoi.'],
      confirmLabel: 'Da, șterge perechea',
      danger: true,
    });
    if (!ok) return;
    await this.api.delete(`/pairs/${p.id}`);
    this.router.navigate(['/perechi'], { queryParams: { sezon: p.season } });
  }
}
