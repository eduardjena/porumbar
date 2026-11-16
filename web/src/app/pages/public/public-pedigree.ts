import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { AuthService, rememberAfterLogin } from '../../core/auth';
import { ConfirmService } from '../../core/confirm';
import { PedigreeV1 } from '../../core/models';
import { Icon } from '../../shared/icon';
import { PedigreeSheet } from '../../shared/pedigree-sheet';

/*
 * Pagina deschisă de codul QR / linkul public (/p/<token>): pedigree-ul pe 5 generații, fără cont. Cu cont:
 * „Preia în porumbarul meu” (o copie). Fără cont: intră sau fă-ți cont, apoi te întoarce aici. Se poate tipări.
 */
@Component({
  selector: 'app-public-pedigree',
  imports: [RouterLink, Icon, PedigreeSheet],
  template: `
    <div class="wide">
      @if (data(); as d) {
        <header class="top-line">
          <div>
            <p class="kicker">Pedigree</p>
            <h1><span class="mono">{{ d.root.ring ?? 'fără inel' }}</span>@if (d.root.name) { „{{ d.root.name }}” }</h1>
            <p class="muted sub">
              {{ sex(d.root.sex) }}@if (d.root.year) { · {{ d.root.year }} }@if (color(); as c) { · {{ c }} }
              · crescător: <strong>{{ d.owner.name }}</strong>@if (d.owner.phone) { · {{ d.owner.phone }} }@if (d.owner.email) { · {{ d.owner.email }} }
              @if (d.owner.address) { <br />{{ d.owner.address }} }
            </p>
          </div>
          <div class="acts no-print">
            @if (auth.account()) {
              @if (done(); as id) {
                <a class="btn primary" [routerLink]="['/porumbei', id]"><app-icon name="fisa" />E în porumbarul tău: deschide fișa</a>
              } @else {
                <button type="button" class="primary" (click)="take()" [disabled]="busy()"><app-icon name="plus" />Preia în porumbarul meu</button>
              }
            } @else {
              <button type="button" class="primary" (click)="go('/intra')"><app-icon name="cont" />Intră ca să-l preiei</button>
              <button type="button" (click)="go('/cont-nou')">Fă-ți cont</button>
            }
            <button type="button" (click)="print()"><app-icon name="tipar" />Tipărește</button>
          </div>
        </header>
        @if (!auth.account()) {
          <p class="notice no-print">Ții evidența porumbeilor pe hârtie? În Porumbar pedigree-urile se trec dintr-o poză și se dau mai departe cu un cod QR. Ca să preiei porumbei, contul trebuie să fie activ.</p>
        }
        @if (error()) { <div class="error no-print" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
        <app-pedigree-sheet [root]="d.root" />
        <p class="muted foot">Generat de Porumbar pe {{ when(d.generatedAt) }}. Strămoșii colorați la fel apar de mai multe ori în pedigree.</p>
      } @else if (error()) {
        <section class="card gone">
          <h1>Pedigree indisponibil</h1>
          <p>{{ error() }}</p>
          <a class="btn primary" routerLink="/">Mergi la Porumbar</a>
        </section>
      } @else {
        <p class="muted">Se încarcă pedigree-ul…</p>
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
  protected readonly when = (iso: string) => new Date(iso).toLocaleDateString('ro-RO');
  protected readonly sex = (s: string | null) => (s === 'M' ? 'Mascul' : s === 'F' ? 'Femelă' : 'Sex necunoscut');
  protected readonly color = computed(() => {
    const r = this.data()?.root;
    return r ? r.colorText || (r.colorLabel ? `${r.colorLabel}${r.colorPa ? ' p.a.' : ''}` : '') : '';
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
      title: `Preiei pedigree-ul lui ${d.root.ring ?? ''}?`,
      lines: [
        'Se copiază în porumbarul tău ca porumbel care nu e în porumbarul tău (de ex. împrumutat pentru pui), cu strămoșii lui.',
        'Strămoșii pe care îi ai deja nu se dublează. Dacă l-ai cumpărat, îl poți trece apoi ca al tău din fișa lui.',
      ],
      confirmLabel: 'Da, preia',
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
