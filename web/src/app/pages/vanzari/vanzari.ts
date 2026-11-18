import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService } from '../../core/confirm';
import { formatDate, t, TPipe } from '../../core/i18n';
import { IncomingService } from '../../core/incoming';
import { Icon } from '../../shared/icon';

interface Incoming {
  id: number;
  ring: string | null;
  name: string | null;
  sellerName: string;
  includePrivate: boolean;
  createdAt: string;
}
interface Outgoing {
  id: number;
  pigeonId: number;
  status: 'pending' | 'accepted' | 'cancelled';
  buyerEmail: string;
  createdAt: string;
  decidedAt: string | null;
}

/** Porumbeii primiți (de acceptat) și cei vânduți de tine. */
@Component({
  selector: 'app-vanzari',
  imports: [RouterLink, Icon, TPipe],
  template: `
    <h1>{{ 'vanzari.titlu' | t }}</h1>
    @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
    @if (received(); as r) {
      <section class="card stack in" role="status">
        <strong><app-icon name="bifa" />{{ 'vanzari.e_in_porumbar' | t }}</strong>
        <div class="warning stack">
          <strong>{{ 'text.de_verificat' | t: { n: r.conflicts.length } }}</strong>
          @for (c of r.conflicts; track $index) { <span>{{ c.message }}</span> }
        </div>
        <div class="row"><a class="btn primary" [routerLink]="['/porumbei', r.pigeonId]"><app-icon name="fisa" />{{ 'actiune.deschide_fisa' | t }}</a></div>
      </section>
    }

    <h2>{{ 'vanzari.vin_la_tine' | t }}</h2>
    @for (tr of incoming(); track tr.id) {
      <section class="card stack in">
        <div><strong class="mono">{{ tr.ring ?? ('text.fara_inel' | t) }}</strong>@if (tr.name) { „{{ tr.name }}” } · {{ 'vanzari.de_la' | t }} <strong>{{ tr.sellerName }}</strong></div>
        <p class="muted">{{ (tr.includePrivate ? 'vanzari.primesti_tot' : 'vanzari.primesti_pedigree') | t }}</p>
        <div class="row">
          <button type="button" class="primary" (click)="accept(tr)"><app-icon name="bifa" />{{ 'vanzari.primesc' | t }}</button>
          <button type="button" (click)="refuse(tr)">{{ 'vanzari.nu_primesc' | t }}</button>
        </div>
      </section>
    } @empty {
      <p class="muted">{{ 'vanzari.niciunul' | t }}</p>
    }

    <h2>{{ 'vanzari.vandute' | t }}</h2>
    @for (o of outgoing(); track o.id) {
      <a class="card out" [routerLink]="['/porumbei', o.pigeonId]" [queryParams]="{ fila: 'qr' }">
        <span>{{ o.buyerEmail }}</span>
        <span class="st" [class]="'st ' + o.status">{{ label(o.status) }}</span>
        <span class="muted">{{ date(o.decidedAt ?? o.createdAt) }}</span>
      </a>
    } @empty {
      <p class="muted">{{ 'vanzari.nimic' | t }}</p>
    }
  `,
  styles: `
    .in { margin-bottom: 12px; }
    .in p { margin: 0; }
    .out { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; text-decoration: none; color: var(--text); margin-bottom: 8px; }
    .st { font-weight: 800; }
    .st.accepted { color: var(--ok); }
    .st.pending { color: var(--accent-strong); }
    .st.cancelled { color: var(--muted); }
  `,
})
export default class Vanzari implements OnInit {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  /** Anunțul de sus („Cineva ți-a trimis un porumbel”) se ține la zi de aici. */
  private readonly waiting = inject(IncomingService);
  readonly incoming = signal<Incoming[]>([]);
  readonly outgoing = signal<Outgoing[]>([]);
  readonly error = signal('');
  /** Primit, dar cu diferențe față de ce aveai deja (le arătăm înainte de a deschide fișa). */
  readonly received = signal<{ pigeonId: number; conflicts: { message: string }[] } | null>(null);
  protected readonly date = (iso: string) => formatDate(iso);
  protected readonly label = (s: Outgoing['status']) => t(`vanzari.st_${s}`);

  ngOnInit() {
    this.load();
  }

  private async load() {
    try {
      const r = await this.api.get<{ incoming: Incoming[]; outgoing: Outgoing[] }>('/transfers');
      this.incoming.set(r.incoming);
      this.waiting.set(r.incoming.length);
      this.outgoing.set(r.outgoing);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async accept(tr: Incoming) {
    const ok = await this.confirm.ask({
      title: t('vanzari.primesti_titlu', { inel: tr.ring ?? '' }),
      lines: [t('vanzari.primesti_text', { vanzator: tr.sellerName })],
      confirmLabel: t('vanzari.da_primesc'),
    });
    if (!ok) return;
    try {
      const r = await this.api.post<{ pigeonId: number; conflicts: { message: string }[] }>(`/transfers/${tr.id}/accept`);
      await this.waiting.refresh(true);
      if (r.conflicts?.length) {
        this.received.set(r);
        await this.load();
      } else {
        this.router.navigate(['/porumbei', r.pigeonId]);
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async refuse(tr: Incoming) {
    const ok = await this.confirm.ask({ title: t('vanzari.refuzi_titlu'), lines: [t('vanzari.refuzi_text', { vanzator: tr.sellerName })], confirmLabel: t('vanzari.da_refuz'), danger: true });
    if (!ok) return;
    try {
      await this.api.post(`/transfers/${tr.id}/cancel`);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
