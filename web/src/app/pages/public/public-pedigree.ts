import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { AuthService, rememberAfterLogin } from '../../core/auth';
import { ConfirmService } from '../../core/confirm';
import { PedigreeV1 } from '../../core/models';
import { Icon } from '../../shared/icon';
import { PedigreeSheet, colorOf } from '../../shared/pedigree-sheet';
import { LangSwitch } from '../../shared/lang-switch';
import { TPipe, currentLang, formatDate, t } from '../../core/i18n';
import { sexLabel } from '../../core/catalog';

/*
 * Pagina deschisă de codul QR / linkul public (/p/<token>): pedigree-ul pe 5 generații, fără cont. Cu cont:
 * „Preia în porumbarul meu” (o copie). Fără cont: intră sau fă-ți cont, apoi te întoarce aici. Se poate tipări.
 */
@Component({
  selector: 'app-public-pedigree',
  imports: [RouterLink, Icon, PedigreeSheet, LangSwitch, TPipe],
  template: `
    <div class="wide">
      <div class="no-print"><app-lang-switch /></div>
      @if (data(); as d) {
        <header class="top-line">
          <div>
            <p class="kicker">{{ 'public.kicker' | t }}</p>
            <h1><span class="mono">{{ d.root.ring ?? ('text.fara_inel' | t) }}</span>@if (d.root.name) { „{{ d.root.name }}” }</h1>
            <p class="muted sub">
              {{ sex(d.root.sex) }}@if (d.root.year) { · {{ d.root.year }} }@if (color(); as c) { · {{ c }} }
              · {{ 'public.crescator' | t }} <strong>{{ d.owner.name }}</strong>@if (d.owner.phone) { · {{ d.owner.phone }} }@if (d.owner.email) { · {{ d.owner.email }} }
              @if (d.owner.address) { <br />{{ d.owner.address }} }
            </p>
          </div>
          <div class="acts no-print">
            @if (auth.account()) {
              @if (done(); as id) {
                <a class="btn primary" [routerLink]="['/porumbei', id]"><app-icon name="fisa" />{{ 'public.e_la_tine' | t }}</a>
              } @else {
                <button type="button" class="primary" (click)="take()" [disabled]="busy()"><app-icon name="plus" />{{ 'public.preia' | t }}</button>
              }
            } @else {
              <button type="button" class="primary" (click)="go('/intra')"><app-icon name="cont" />{{ 'public.intra_preia' | t }}</button>
              <button type="button" (click)="go('/cont-nou')">{{ 'public.fa_cont' | t }}</button>
            }
            <button type="button" (click)="print()"><app-icon name="tipar" />{{ 'actiune.tipareste' | t }}</button>
          </div>
        </header>
        @if (!auth.account()) {
          <p class="notice no-print">{{ 'public.reclama' | t }}</p>
        }
        @if (error()) { <div class="error no-print" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
        <app-pedigree-sheet [root]="d.root" [lang]="lang()" />
        <p class="muted foot">{{ 'public.generat' | t: { data: when(d.generatedAt) } }}</p>
      } @else if (error()) {
        <section class="card gone">
          <h1>{{ 'public.indisponibil' | t }}</h1>
          <p>{{ error() }}</p>
          <a class="btn primary" routerLink="/">{{ 'public.mergi' | t }}</a>
        </section>
      } @else {
        <p class="muted">{{ 'public.se_incarca' | t }}</p>
      }
    </div>
  `,
  styles: `
    .wide { width: min(1400px, calc(100vw - 48px)); margin-left: calc((100% - min(1400px, 100vw - 48px)) / 2); }
    .top-line { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 12px 24px; margin-bottom: 14px; }
    .kicker { margin: 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--accent-strong); font-size: 0.85rem; }
    h1 { margin: 2px 0; }
    .sub { margin: 0; }
    .acts { display: flex; flex-wrap: wrap; gap: 8px; }
    .foot { margin-top: 12px; font-size: 0.85rem; }
    .gone { max-width: 560px; }
    @media (max-width: 767px) { .wide { width: 100%; margin-left: 0; } }
    @media print {
      .no-print { display: none !important; }
      .wide { width: 100%; margin: 0; }
    }
  `,
})
export default class PublicPedigree {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  protected readonly auth = inject(AuthService);
  readonly token = input.required<string>();
  readonly data = signal<PedigreeV1 | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly done = signal<number | null>(null);
  protected readonly lang = currentLang;
  protected readonly when = (iso: string) => formatDate(iso);
  protected readonly sex = (s: string | null) => sexLabel(s);
  protected readonly color = computed(() => {
    const r = this.data()?.root;
    return r ? colorOf(r, this.lang()) : '';
  });

  constructor() {
    this.auth.load();
    effect(() => {
      const t = this.token();
      untracked(() => this.load(t));
    });
  }

  private async load(token: string) {
    try {
      this.data.set(await this.api.get<PedigreeV1>(`/public/${encodeURIComponent(token)}`));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  go(path: string) {
    rememberAfterLogin(`/p/${this.token()}`);
    this.router.navigateByUrl(path);
  }

  print() {
    window.print();
  }

  async take() {
    const d = this.data();
    if (!d) return;
    // Două feluri: doar pedigree-ul (strămoș / împrumut) sau porumbelul e acum al lui (l-a cumpărat).
    const ok = await this.confirm.ask({
      title: t('public.preia_titlu', { inel: d.root.ring ?? '' }),
      lines: [t('public.preia_rand1'), t('public.preia_rand2')],
      confirmLabel: t('public.preia_da'),
    });
    if (!ok) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await this.api.post<{ pigeonId: number }>(`/public/${encodeURIComponent(this.token())}/import`, { kind: 'external' });
      this.done.set(r.pigeonId);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
