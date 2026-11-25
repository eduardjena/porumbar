import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth';
import { ConfirmService } from '../../core/confirm';
import { TPipe, formatDay, t, GluePipe } from '../../core/i18n';
import { CalendarItem } from '../../core/models';
import { Icon } from '../../shared/icon';
import { addDays } from '../tratamente/tratament-text';

type SectionKey = 'intarziate' | 'azi' | 'maine' | 'urmatoarele';
interface Section {
  key: SectionKey;
  items: CalendarItem[];
}

/** Alegerea deschisă pe un rând: câte ouă limpezi sau câți pui au ieșit. */
interface Choice {
  clutchId: number;
  kind: 'limpezi' | 'iesiti';
  max: number;
}

/*
 * Banda „Cuiburile” de pe Panou (Grilă, sub banda tratamentelor; design docs/superpowers/specs/2026-11-23-calendar-cuib-design.md):
 * ce e de făcut la cuiburi azi și în următoarele zile (al doilea ou, mirarea, eclozarea, inelarea), cu butoane de o
 * atingere care scriu pe pontă prin aceleași rute ca fișa perechii. Fără nimic de arătat, banda nu apare. Ziua de azi
 * vine de la server (ora României), nu din ceasul telefonului. Contul „doar citire” vede banda cu butoanele oprite.
 */
@Component({
  selector: 'app-cuiburi-banda',
  imports: [RouterLink, Icon, TPipe, GluePipe],
  template: `
    @if (sections().length) {
      <section class="banda" [attr.aria-label]="'cuib.titlu' | t">
        <h2 class="titlu"><app-icon name="cuib" [size]="26" />{{ 'cuib.titlu' | t }}</h2>
        @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
        @for (s of sections(); track s.key) {
          <h3 class="sec" [class.sec-late]="s.key === 'intarziate'">{{ 'cuib.' + s.key | t }}</h3>
          <ul>
            @for (i of s.items; track i.clutchId + i.kind) {
              <li class="r" [class.late]="i.state === 'intarziat'" [class.last]="i.last">
                <p class="txt">
                  @if (i.state === 'intarziat') { <app-icon name="alerta" class="warn-icon" [size]="22" /> }
                  <a class="who" [routerLink]="['/perechi', i.ownPairId]" [queryParams]="{ ponta: i.clutchId }">{{ who(i) }}</a>
                  @if (i.fosterLabel) { <span class="muted"> · {{ foster(i) }}</span> }
                  <span> · {{ what(i) }}</span>
                  @if (i.last) { <strong class="red">{{ ' (' | glue }}{{ 'cuib.ultima_zi' | t }}{{ ')' | glue }}</strong> }
                  @if (i.state === 'intarziat') { <span class="tag">{{ 'cuib.intarziat' | t }}</span> }
                  @if (s.key === 'urmatoarele') { <span class="muted"> · {{ day(i.from) }}</span> }
                </p>
                <div class="acts">
                  @if (choosing(i) && choice(); as c) {
                    <span class="q">{{ (c.kind === 'limpezi' ? 'cuib.cate_limpezi' : 'cuib.cati_pui') | t }}</span>
                    @for (n of upTo(c.max); track n) {
                      <button type="button" class="primary num" [disabled]="locked()" (click)="pick(i, c, n)">{{ n }}</button>
                    }
                    <button type="button" [disabled]="busy()" (click)="choice.set(null)">{{ 'actiune.renunta' | t }}</button>
                  } @else {
                    @if (i.state !== 'viitor') {
                      @switch (i.kind) {
                        @case ('ou2') {
                          <button type="button" class="primary" [disabled]="locked()" (click)="save(i, { egg2On: today() })">{{ 'cuib.a_venit_azi' | t }}</button>
                          <button type="button" [disabled]="locked()" (click)="save(i, { eggs: 1 })">{{ 'cuib.doar_unul' | t }}</button>
                        }
                        @case ('mirare') {
                          <button type="button" class="primary" [disabled]="locked()" (click)="save(i, { candledOn: today() })">{{ 'cuib.toate_bune' | t }}</button>
                          @if (clearMax(i) === 1) {
                            <button type="button" [disabled]="locked()" (click)="save(i, { candledOn: today(), infertile: 1 })">{{ 'cuib.limpezi_n' | t: { n: 1 } }}</button>
                          } @else if (clearMax(i) > 1) {
                            <button type="button" [disabled]="locked()" (click)="choose(i, 'limpezi', clearMax(i))">{{ 'cuib.limpezi' | t }}</button>
                          }
                        }
                        @case ('eclozare') {
                          @if (i.eggsLeft === 1) {
                            <button type="button" class="primary" [disabled]="locked()" (click)="save(i, { hatchedOn: today(), hatched: 1 })">{{ 'cuib.au_iesit_n' | t: { n: 1 } }}</button>
                          } @else if (i.eggsLeft > 1) {
                            <button type="button" class="primary" [disabled]="locked()" (click)="choose(i, 'iesiti', i.eggsLeft)">{{ 'cuib.au_iesit' | t }}</button>
                          }
                          <button type="button" [disabled]="locked()" (click)="notHatched(i)">{{ 'cuib.n_au_iesit' | t }}</button>
                        }
                        @case ('inelare') {
                          @if (readOnly()) {
                            <button type="button" class="primary" disabled>{{ 'cuib.ineleaza' | t }}</button>
                          } @else {
                            <a class="btn primary" [routerLink]="['/perechi', i.ownPairId]" [queryParams]="{ inelare: i.clutchId }">{{ 'cuib.ineleaza' | t }}</a>
                          }
                          <button type="button" [disabled]="locked()" (click)="noRinging(i)">{{ 'cuib.nu_inelez' | t }}</button>
                        }
                      }
                    }
                    <button type="button" class="link stop" [disabled]="locked()" (click)="stopFollowing(i)">{{ 'cuib.nu_mai_urmari' | t }}</button>
                  }
                </div>
              </li>
            }
          </ul>
        }
        @if (readOnly()) { <p class="ro">{{ readOnlyText() }}</p> }
      </section>
    }
  `,
  styles: `
    .banda { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 10px 6px 6px; margin: 0 0 16px; }
    .titlu { display: flex; align-items: center; gap: 10px; margin: 0 12px 6px; font-size: 1.15rem; }
    .titlu app-icon { color: var(--accent-strong); }
    .sec { margin: 10px 12px 4px; font-size: 1rem; font-weight: 800; color: var(--muted); }
    .sec-late { color: var(--danger); }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
    .r {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 8px 12px; border-radius: var(--radius-sm);
      border: 1px solid var(--border);
    }
    .r.late { background: var(--danger-soft); border-color: #e7b4ae; border-left: 5px solid var(--danger); }
    .r.last { border-left: 5px solid var(--danger); }
    .txt { flex: 1 1 260px; min-width: 0; margin: 0; overflow-wrap: anywhere; line-height: 1.4; }
    .who { font-weight: 800; color: inherit; text-decoration: underline; text-underline-offset: 3px; padding: 10px 0; }
    .warn-icon { color: var(--danger); vertical-align: -4px; margin-right: 4px; }
    .red { color: var(--danger); }
    .tag {
      display: inline-block; margin-left: 6px; padding: 1px 10px; border-radius: 999px; font-size: 0.9rem; font-weight: 800;
      background: var(--danger); color: #fff;
    }
    .acts { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
    .acts button, .acts .btn { min-height: 48px; padding: 8px 16px; }
    .acts .num { min-width: 56px; }
    .acts .stop { min-height: 48px; padding: 8px 6px; font-size: 0.95rem; }
    .q { font-weight: 700; flex-basis: 100%; }
    .ro { margin: 8px 12px 4px; color: var(--warn); font-weight: 600; }
    /* Pe telefon, butoanele pe rândul de sub text, mari. */
    @media (max-width: 767px) {
      .acts { flex-basis: 100%; }
      .acts button:not(.stop), .acts .btn { flex: 1 1 auto; }
    }
  `,
})
export class CuiburiBanda {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  protected readonly items = signal<CalendarItem[]>([]);
  protected readonly today = signal('');
  protected readonly error = signal('');
  protected readonly busy = signal(false);
  protected readonly choice = signal<Choice | null>(null);
  protected readonly day = formatDay;

  /** Fără abonament contul e doar citire: serverul răspunde 402 la scriere, deci butoanele stau oprite. */
  protected readonly readOnly = computed(() => {
    const a = this.auth.account();
    return !!a && !a.isAdmin && a.subscription?.active === false;
  });
  protected readonly locked = computed(() => this.busy() || this.readOnly());
  protected readonly readOnlyText = computed(() => {
    const a = this.auth.account();
    if (!a) return '';
    const activare = a.sellerContact ? t('eroare.activare_contact', { contact: a.sellerContact }) : t('eroare.activare_vanzator');
    return t(a.subscription?.status === 'expired' ? 'eroare.doar_citire_expirat' : 'eroare.doar_citire_neactivat', { activare });
  });

  protected readonly sections = computed<Section[]>(() => {
    const today = this.today();
    const tomorrow = today ? addDays(today, 1) : '';
    const by: Record<SectionKey, CalendarItem[]> = { intarziate: [], azi: [], maine: [], urmatoarele: [] };
    for (const i of this.items()) {
      if (i.state === 'intarziat') by.intarziate.push(i);
      else if (i.state === 'azi') by.azi.push(i);
      else if (i.from === tomorrow) by.maine.push(i);
      else by.urmatoarele.push(i);
    }
    return (['intarziate', 'azi', 'maine', 'urmatoarele'] as const).map((key) => ({ key, items: by[key] })).filter((s) => s.items.length);
  });

  constructor() {
    this.load();
  }

  /** „Cuibul 7” sau, fără număr de cuib, perechea („Fulger × Vânta”). */
  protected who(i: CalendarItem) {
    return i.nest ? t('cuib.cuibul', { n: i.nest }) : i.label;
  }

  /** Ouăle sunt la doică: de la ce pereche sunt. */
  protected foster(i: CalendarItem) {
    return t('cuib.doica', { pereche: i.fosterNest ? t('perechi.cuibul', { n: i.fosterNest }) : (i.fosterLabel ?? '') });
  }

  protected what(i: CalendarItem) {
    switch (i.kind) {
      case 'ou2': return t(i.question ? 'cuib.ou2_intrebare' : 'cuib.ou2');
      case 'mirare': return t('cuib.mirare');
      case 'eclozare': return i.state === 'intarziat' ? t('cuib.eclozare_intrebare') : t('cuib.eclozare', { pana: formatDay(i.to) });
      case 'inelare': return t('cuib.inelare', { count: Math.max(1, (i.hatched ?? 0) - i.young) });
    }
  }

  /** Câte ouă pot fi limpezi: toate, fără cele sparte și puii trecuți deja. */
  protected clearMax(i: CalendarItem) {
    return i.eggs - i.broken - (i.hatched ?? 0);
  }

  protected readonly upTo = (max: number) => Array.from({ length: max }, (_, k) => k + 1);

  protected choosing(i: CalendarItem) {
    const c = this.choice();
    return !!c && this.choiceFits(c, i);
  }

  protected choiceFits(c: Choice, i: CalendarItem) {
    return c.clutchId === i.clutchId && (c.kind === 'limpezi' ? i.kind === 'mirare' : i.kind === 'eclozare');
  }

  protected choose(i: CalendarItem, kind: Choice['kind'], max: number) {
    this.error.set('');
    this.choice.set({ clutchId: i.clutchId, kind, max });
  }

  protected pick(i: CalendarItem, c: Choice, n: number) {
    return this.save(i, c.kind === 'limpezi' ? { candledOn: this.today(), infertile: n } : { hatchedOn: this.today(), hatched: n });
  }

  /** „N-au ieșit”: ouăle rămase se trec toate ca limpezi (nu mai e eclozare de așteptat). */
  protected async notHatched(i: CalendarItem) {
    const ok = await this.confirm.ask({
      title: t('cuib.n_au_iesit_titlu'),
      lines: [this.who(i), t('cuib.n_au_iesit_text', { count: i.eggsLeft })],
      confirmLabel: t('cuib.n_au_iesit_da'),
    });
    if (ok) await this.save(i, { infertile: i.eggs - i.broken - (i.hatched ?? 0) });
  }

  /** „Nu inelez”: puii neinelați se scot din pontă (de ex. au murit); câți au ieșit = câți sunt inelați. */
  protected async noRinging(i: CalendarItem) {
    const ok = await this.confirm.ask({
      title: t('cuib.nu_inelez_titlu'),
      lines: [this.who(i), t('cuib.nu_inelez_text')],
      confirmLabel: t('cuib.nu_inelez_da'),
    });
    if (ok) await this.save(i, { hatched: i.young });
  }

  /** „Nu mai urmări”: ponta iese din bandă și amintirile ei se opresc; cere confirmare (o atingere greșită ar închide totul). */
  protected async stopFollowing(i: CalendarItem) {
    const ok = await this.confirm.ask({
      title: t('cuib.nu_mai_urmari_titlu'),
      lines: [this.who(i), t('cuib.nu_mai_urmari_text')],
      confirmLabel: t('cuib.nu_mai_urmari_da'),
    });
    if (ok) await this.save(i, { calendarClosedOn: this.today() });
  }

  protected async save(i: CalendarItem, body: object) {
    if (this.locked()) return;
    this.busy.set(true);
    this.error.set('');
    try {
      await this.api.patch(`/clutches/${i.clutchId}`, body);
      this.choice.set(null);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  private async load() {
    try {
      const r = await this.api.get<{ today: string; items: CalendarItem[] }>('/breeding/calendar');
      this.today.set(r.today);
      this.items.set(r.items);
    } catch {
      // Banda e doar o amintire: fără ea, Panoul merge mai departe.
    }
  }
}
