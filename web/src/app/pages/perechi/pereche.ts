import { Component, Injector, afterNextRender, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService } from '../../core/confirm';
import { percent, ringText, sexShort } from '../../core/catalog';
import { formatDay, t, TPipe } from '../../core/i18n';
import { Clutch, Pair, PigeonSummary } from '../../core/models';
import { Icon } from '../../shared/icon';
import { Breadcrumbs } from '../../shared/breadcrumbs';
import { statusLabel } from './perechi';
import { CuloriPui } from './culori-pui';
import { DateField } from '../../shared/date-field';

const today = () => new Date().toISOString().slice(0, 10);

/** Textul cheii în bucăți: valorile din `bold` se scriu îngroșat (de ex. datele din „între {de} și {pana}”). */
function boldParts(key: string, bold: Record<string, unknown>, plain: Record<string, unknown> = {}) {
  return t(key, plain)
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((part) => {
      const name = /^\{(\w+)\}$/.exec(part)?.[1];
      return name && name in bold ? { text: String(bold[name]), bold: true } : { text: part, bold: false };
    });
}

/** Ce se completează pe o pontă (ouăle, apoi eclozarea), ca texte de formular. */
interface ClutchForm {
  egg1On: string;
  egg2On: string;
  candledOn: string;
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
 * Din banda „Cuiburile” se vine cu `?inelare=<ponta>`: ponta se derulează în vedere, cu pasul de inelare deschis.
 */
@Component({
  selector: 'app-pereche',
  imports: [DateField, FormsModule, RouterLink, Icon, TPipe, Breadcrumbs, CuloriPui],
  template: `
    @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
    @if (pair(); as p) {
      <app-breadcrumbs [items]="crumbs()" />
      <h1 class="birds">
        <a [routerLink]="['/porumbei', p.cock?.id]"><span class="sx sM">{{ 'sex.m' | t }}</span><span class="mono">{{ ring(p.cock) }}</span></a>
        <span class="x">×</span>
        <a [routerLink]="['/porumbei', p.hen?.id]"><span class="sx sF">{{ 'sex.f' | t }}</span><span class="mono">{{ ring(p.hen) }}</span></a>
      </h1>
      <p class="meta">
        <span class="badge">{{ status(p.status) }}</span>
        @if (p.pairedOn) { <span>{{ 'perechi.din_data' | t: { data: date(p.pairedOn) } }}</span> }
        @if (p.separatedOn) { <span>{{ 'perechi.despartiti_pe' | t: { data: date(p.separatedOn) } }}</span> }
        @if (p.nest) { <span>{{ 'perechi.cuibul' | t: { n: p.nest } }}</span> }
      </p>
      <div [class]="p.coi >= 0.125 ? 'warning' : 'notice'" role="status">
        @if (p.coi > 0) { {{ 'perechi.coi_au' | t }} <strong>{{ pct(p.coi) }}</strong>. }
        @else { {{ 'perechi.fara_stramosi_comuni' | t }} }
      </div>

      @if (!editing()) {
        <div class="row actions">
          @if (p.status === 'planificata') { <button type="button" class="primary" (click)="startPair(p)"><app-icon name="bifa" />{{ 'perechi.i_am_pus_azi' | t }}</button> }
          <button type="button" (click)="openEdit(p)"><app-icon name="editeaza" />{{ 'perechi.schimba_perechea' | t }}</button>
        </div>
      } @else {
        <form class="card stack" (ngSubmit)="saveEdit()">
          <label class="field">{{ 'camp.data_imperecherii' | t }} <span class="hint">{{ 'perechi.hint_goala_planuita' | t }}</span><app-date name="pairedOn" [(ngModel)]="e.pairedOn" /></label>
          <label class="field">{{ 'camp.data_despartirii' | t }} <span class="hint">{{ 'perechi.hint_goala_impreuna' | t }}</span><app-date name="separatedOn" [(ngModel)]="e.separatedOn" /></label>
          <label class="field">{{ 'perechi.cuibul_boxa' | t }} <input name="nest" [(ngModel)]="e.nest" /></label>
          <label class="field">{{ 'camp.nota' | t }} <textarea name="note" [(ngModel)]="e.note"></textarea></label>
          @if (editError()) { <div class="error" role="alert">{{ editError() }}</div> }
          <div class="row">
            <button class="primary" type="submit"><app-icon name="bifa" />{{ 'actiune.salveaza' | t }}</button>
            <button type="button" (click)="editing.set(false)">{{ 'actiune.renunta' | t }}</button>
          </div>
        </form>
      }
      @if (p.note) { <p class="pre">{{ p.note }}</p> }

      <app-culori-pui [pairId]="p.id" />

      <h2>{{ 'perechi.ponte_titlu' | t }}</h2>
      @if (p.status !== 'planificata') {
        <form class="card stack" (ngSubmit)="addClutch()">
          <h3>{{ 'perechi.ponta_noua' | t }}</h3>
          <div class="row">
            <label class="field grow">{{ 'perechi.primul_ou' | t }} <app-date name="egg1" [(ngModel)]="egg1On" required /></label>
            <label class="field grow">{{ 'perechi.al_doilea_ou' | t }} <span class="hint">{{ 'perechi.daca_e' | t }}</span><app-date name="egg2" [(ngModel)]="egg2On" /></label>
          </div>
          @if (clutchError()) { <div class="error" role="alert">{{ clutchError() }}</div> }
          <button class="primary" type="submit" [disabled]="!egg1On"><app-icon name="ou" />{{ 'perechi.adauga_ponta' | t }}</button>
        </form>
      } @else {
        <p class="muted">{{ 'perechi.ponte_dupa' | t }}</p>
      }

      <ul class="clutches">
        @for (c of p.clutches ?? []; track c.id) {
          <li class="card stack ponta" [id]="'ponta-' + c.id">
            <div class="row between">
              <strong>{{ c.egg2On ? ('perechi.oua_doua' | t: { data1: date(c.egg1On), data2: date(c.egg2On) }) : ('perechi.oua_una' | t: { data: date(c.egg1On) }) }}<span class="muted"> {{ 'perechi.n_oua' | t: { count: c.eggs } }}</span></strong>
              <button type="button" class="link" (click)="removeClutch(c)">{{ 'actiune.sterge' | t }}</button>
            </div>
            @if (c.foster) { <p class="muted">{{ 'perechi.clocite_de_doica' | t: { pereche: ring(c.foster.cock) + ' × ' + ring(c.foster.hen) } }}</p> }
            @if (c.candledOn) { <p class="step">{{ 'perechi.mirat_pe' | t: { data: date(c.candledOn) } }}</p> }
            @if (c.calendarClosedOn) {
              <p class="step closed"><span class="muted">{{ 'perechi.inchisa_calendar' | t }}</span>
                <button type="button" class="link" (click)="followAgain(c)">{{ 'perechi.urmareste_din_nou' | t }}</button></p>
            }
            @if (c.expectedHatch; as h) {
              <p class="step">@for (x of parts('perechi.ies_intre', { de: date(h.from), pana: date(h.to) }); track $index) {@if (x.bold) {<strong>{{ x.text }}</strong>} @else {<ng-container>{{ x.text }}</ng-container>}}</p>
            }
            @if (c.hatchedOn) {
              <p class="step">@for (x of parts('perechi.au_iesit', { data: date(c.hatchedOn) }, { n: c.hatched ?? '?' }); track $index) {@if (x.bold) {<strong>{{ x.text }}</strong>} @else {<ng-container>{{ x.text }}</ng-container>}}@if (c.infertile) { · {{ 'perechi.n_limpezi' | t: { n: c.infertile } }}}@if (c.broken) { · {{ 'perechi.n_sparte' | t: { n: c.broken } }}}.</p>
              <p class="step">@for (x of parts('perechi.se_ineleaza', { de: date(c.ringFrom), pana: date(c.ringTo) }); track $index) {@if (x.bold) {<strong>{{ x.text }}</strong>} @else {<ng-container>{{ x.text }}</ng-container>}}</p>
            }

            @if (clutchEdit() === c.id) {
              <form class="stack sub" (ngSubmit)="saveClutch(c)">
                <div class="row">
                  <label class="field grow">{{ 'camp.data_eclozarii' | t }} <app-date name="hatchedOn" [(ngModel)]="cf.hatchedOn" /></label>
                  <label class="field grow">{{ 'camp.cati_pui' | t }}
                    <select name="hatched" [(ngModel)]="cf.hatched">@for (n of nums(cf.eggs); track n) { <option [ngValue]="n">{{ n }}</option> }</select>
                  </label>
                </div>
                <div class="row">
                  <label class="field grow">{{ 'perechi.oua_limpezi_nefecundate' | t }}
                    <select name="infertile" [(ngModel)]="cf.infertile">@for (n of nums(cf.eggs); track n) { <option [ngValue]="n">{{ n }}</option> }</select>
                  </label>
                  <label class="field grow">{{ 'camp.oua_sparte' | t }}
                    <select name="broken" [(ngModel)]="cf.broken">@for (n of nums(cf.eggs); track n) { <option [ngValue]="n">{{ n }}</option> }</select>
                  </label>
                </div>
                <div class="row">
                  <label class="field grow">{{ 'perechi.primul_ou' | t }} <app-date name="cegg1" [(ngModel)]="cf.egg1On" /></label>
                  <label class="field grow">{{ 'perechi.al_doilea_ou' | t }} <app-date name="cegg2" [(ngModel)]="cf.egg2On" /></label>
                  <label class="field grow">{{ 'camp.data_mirarii' | t }} <span class="hint">{{ 'perechi.daca_e' | t }}</span><app-date name="ccandled" [(ngModel)]="cf.candledOn" /></label>
                  <label class="field grow">{{ 'camp.cate_oua' | t }}
                    <select name="eggs" [(ngModel)]="cf.eggs">@for (n of [1, 2, 3]; track n) { <option [ngValue]="n">{{ n }}</option> }</select>
                  </label>
                </div>
                @if (fosters().length) {
                  <label class="field">{{ 'perechi.doica' | t }} <span class="hint">{{ 'perechi.doica_hint' | t }}</span>
                    <select name="foster" [(ngModel)]="cf.fosterPairId">
                      <option [ngValue]="null">{{ 'perechi.fara_doica' | t }}</option>
                      @for (f of fosters(); track f.id) { <option [ngValue]="f.id">{{ ring(f.cock) }} × {{ ring(f.hen) }}@if (f.nest) { ({{ 'perechi.cuibul' | t: { n: f.nest } }})}</option> }
                    </select>
                  </label>
                }
                <label class="field">{{ 'camp.nota' | t }} <textarea name="cnote" [(ngModel)]="cf.note"></textarea></label>
                @if (clutchError()) { <div class="error" role="alert">{{ clutchError() }}</div> }
                <div class="row">
                  <button class="primary" type="submit"><app-icon name="bifa" />{{ 'actiune.salveaza' | t }}</button>
                  <button type="button" (click)="clutchEdit.set(null)">{{ 'actiune.renunta' | t }}</button>
                </div>
              </form>
            } @else {
              <div class="row">
                <button type="button" [class.primary]="!c.hatchedOn" (click)="openClutch(c)"><app-icon name="editeaza" />{{ (c.hatchedOn ? 'perechi.schimba_ponta' : 'perechi.au_iesit_puii') | t }}</button>
              </div>
            }

            @if (c.young.length) {
              <h4>{{ 'perechi.puii_inelati' | t }}</h4>
              <ul class="young">
                @for (y of c.young; track y.id) {
                  <li><a [routerLink]="['/porumbei', y.id]" class="mono">{{ ring(y) }}</a><span class="muted"> · {{ sex(y.sex) }}@if (y.name) { · „{{ y.name }}”}</span></li>
                }
              </ul>
            }
            @if (c.hatchedOn && c.young.length < (c.hatched ?? c.eggs)) {
              @if (ringFor() === c.id) {
                <form class="stack sub" (ngSubmit)="ringYoung(c)">
                  <label class="field">{{ 'perechi.inelul_puiului' | t }} <input name="ring" class="mono" [(ngModel)]="yRing" required placeholder="RO-26-800540" /></label>
                  @if (suggested()) { <span class="hint">{{ 'perechi.propus' | t }}</span> }
                  <div class="row">
                    <label class="field grow">{{ 'perechi.sexul' | t }}
                      <select name="ysex" [(ngModel)]="ySex"><option value="">{{ 'perechi.nu_se_stie' | t }}</option><option value="M">{{ 'sex.mascul' | t }}</option><option value="F">{{ 'sex.femela' | t }}</option></select>
                    </label>
                    <label class="field grow">{{ 'text.nume' | t }} <span class="hint">{{ 'perechi.nu_e_obligatoriu' | t }}</span><input name="yname" [(ngModel)]="yName" /></label>
                  </div>
                  @if (youngError()) { <div class="error" role="alert">{{ youngError() }}</div> }
                  <div class="row">
                    <button class="primary" type="submit" [disabled]="!yRing.trim() || busy()"><app-icon name="bifa" />{{ 'perechi.ineleaza_puiul' | t }}</button>
                    <button type="button" (click)="ringFor.set(null)">{{ 'actiune.renunta' | t }}</button>
                  </div>
                </form>
              } @else {
                <button type="button" class="primary" (click)="openRing(c)"><app-icon name="plus" />{{ 'perechi.ineleaza_un_pui' | t }}</button>
              }
            }
          </li>
        } @empty {
          @if (p.status !== 'planificata') { <p class="muted">{{ 'perechi.nicio_ponta' | t }}</p> }
        }
      </ul>

      <section class="card stack delete-zone">
        <h3>{{ 'perechi.stergerea' | t }}</h3>
        <p class="muted">{{ 'perechi.stergerea_text' | t }}</p>
        <div><button type="button" class="danger" (click)="removePair(p)">{{ 'perechi.sterge_perechea' | t }}</button></div>
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
    .closed { display: flex; flex-wrap: wrap; align-items: center; gap: 0 10px; }
    .closed .link { min-height: 48px; }
    .ponta { scroll-margin-top: 16px; }
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
  private readonly injector = inject(Injector);
  readonly id = input.required<string>();
  /** `?inelare=<ponta>` (din banda „Cuiburile”): deschide inelarea acelei ponte. */
  readonly inelare = input<string | undefined>();
  /** Ponta din `?inelare` deja deschisă (o singură dată, nu la fiecare reîncărcare). */
  private ringOpened: string | null = null;
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
  cf: ClutchForm = { egg1On: '', egg2On: '', candledOn: '', eggs: 2, hatchedOn: '', hatched: 2, infertile: 0, broken: 0, fosterPairId: null, note: '' };
  egg1On = today();
  egg2On = '';
  yRing = '';
  ySex = '';
  yName = '';
  protected readonly status = statusLabel;
  protected readonly date = formatDay;
  protected readonly pct = percent;
  protected readonly parts = boldParts;
  protected readonly sex = (s: string | null) => t(s === 'M' ? 'perechi.sex_mascul' : s === 'F' ? 'perechi.sex_femela' : 'perechi.sex_necunoscut');
  protected readonly crumbs = computed(() => {
    const p = this.pair();
    if (!p) return [];
    return [{ label: t('perechi.sezon', { sezon: p.season }), link: ['/perechi'], query: { sezon: p.season } }, { label: `${this.ring(p.cock)} × ${this.ring(p.hen)}` }];
  });
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
      this.openRingFromLink(pair);
      const others = await this.api.get<{ pairs: Pair[] }>(`/pairs?season=${pair.season}`);
      this.fosters.set(others.pairs.filter((x) => x.id !== pair.id && x.status !== 'planificata'));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  private reload() {
    return this.load(this.id());
  }

  /** Venit din banda „Cuiburile”: ponta cerută se derulează în vedere și, dacă mai are pui de inelat, se deschide inelarea. */
  private openRingFromLink(pair: Pair) {
    const wanted = this.inelare();
    if (!wanted || wanted === this.ringOpened) return;
    this.ringOpened = wanted;
    const c = pair.clutches?.find((x) => String(x.id) === wanted);
    if (!c) return;
    if (c.hatchedOn && c.young.length < (c.hatched ?? c.eggs)) void this.openRing(c);
    afterNextRender(() => document.getElementById(`ponta-${c.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), { injector: this.injector });
  }

  /** „Urmărește din nou”: ponta închisă cu „Nu mai urmări” revine în banda „Cuiburile”. */
  async followAgain(c: Clutch) {
    try {
      await this.api.patch(`/clutches/${c.id}`, { calendarClosedOn: null });
      await this.reload();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
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
      egg1On: c.egg1On, egg2On: c.egg2On ?? '', candledOn: c.candledOn ?? '', eggs: c.eggs, hatchedOn: c.hatchedOn ?? today(),
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
        egg1On: f.egg1On, egg2On: f.egg2On || null, candledOn: f.candledOn || null, eggs: f.eggs, hatchedOn: f.hatchedOn || null, hatched: f.hatchedOn ? f.hatched : null,
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
      title: t('perechi.sterge_ponta_titlu'),
      lines: [t('perechi.oua_din', { data: formatDay(c.egg1On) }), c.young.length ? t('perechi.puii_raman') : t('text.nu_se_poate_da_inapoi')],
      confirmLabel: t('perechi.sterge_ponta_da'),
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
      title: t('perechi.sterge_perechea_titlu'),
      lines: [t('perechi.sterge_perechea_cine', { mascul: this.ring(p.cock), femela: this.ring(p.hen), sezon: p.season }), t('perechi.sterge_perechea_text'), t('text.nu_se_poate_da_inapoi')],
      confirmLabel: t('perechi.sterge_perechea_da'),
      danger: true,
    });
    if (!ok) return;
    await this.api.delete(`/pairs/${p.id}`);
    this.router.navigate(['/perechi'], { queryParams: { sezon: p.season } });
  }
}
