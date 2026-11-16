import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService } from '../../core/confirm';
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
  imports: [RouterLink, Icon],
  template: `
    <h1>Vânzări</h1>
    @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
    @if (received(); as r) {
      <section class="card stack in" role="status">
        <strong><app-icon name="bifa" />Porumbelul e în porumbarul tău.</strong>
        <div class="warning stack">
          <strong>De verificat ({{ r.conflicts.length }}):</strong>
          @for (c of r.conflicts; track $index) { <span>{{ c.message }}</span> }
        </div>
        <div class="row"><a class="btn primary" [routerLink]="['/porumbei', r.pigeonId]"><app-icon name="fisa" />Deschide fișa</a></div>
      </section>
    }

    <h2>Porumbei care vin la tine</h2>
    @for (t of incoming(); track t.id) {
      <section class="card stack in">
        <div><strong class="mono">{{ t.ring ?? 'fără inel' }}</strong>@if (t.name) { „{{ t.name }}” } · de la <strong>{{ t.sellerName }}</strong></div>
        <p class="muted">Îl primești în porumbarul tău cu tot pedigree-ul{{ t.includePrivate ? ', notele și jurnalul' : '' }}. Strămoșii pe care îi ai deja nu se dublează.</p>
        <div class="row">
          <button type="button" class="primary" (click)="accept(t)"><app-icon name="bifa" />Primesc porumbelul</button>
          <button type="button" (click)="refuse(t)">Nu îl primesc</button>
        </div>
      </section>
    } @empty {
      <p class="muted">Niciun porumbel în așteptare. Când cineva îți vinde un porumbel pe emailul contului tău, apare aici.</p>
    }

    <h2>Vândute de tine</h2>
    @for (t of outgoing(); track t.id) {
      <a class="card out" [routerLink]="['/porumbei', t.pigeonId]" [queryParams]="{ fila: 'qr' }">
        <span>{{ t.buyerEmail }}</span>
        <span class="st" [class]="'st ' + t.status">{{ label(t.status) }}</span>
        <span class="muted">{{ date(t.decidedAt ?? t.createdAt) }}</span>
      </a>
    } @empty {
      <p class="muted">Nimic încă. Vinzi un porumbel din fișa lui, fila „QR”.</p>
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
  readonly incoming = signal<Incoming[]>([]);
  readonly outgoing = signal<Outgoing[]>([]);
  readonly error = signal('');
  /** Primit, dar cu diferențe față de ce aveai deja (le arătăm înainte de a deschide fișa). */
  readonly received = signal<{ pigeonId: number; conflicts: { message: string }[] } | null>(null);
  protected readonly date = (iso: string) => new Date(iso).toLocaleDateString('ro-RO');
  protected readonly label = (s: Outgoing['status']) => ({ pending: 'În așteptare', accepted: 'Primit', cancelled: 'Anulat' })[s];

  ngOnInit() {
    this.load();
  }

  private async load() {
    try {
      const r = await this.api.get<{ incoming: Incoming[]; outgoing: Outgoing[] }>('/transfers');
      this.incoming.set(r.incoming);
      this.outgoing.set(r.outgoing);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async accept(t: Incoming) {
    const ok = await this.confirm.ask({
      title: `Primești porumbelul ${t.ring ?? ''}?`,
      lines: [`De la ${t.sellerName}. Intră în porumbarul tău, ca porumbel al tău, cu tot pedigree-ul.`],
      confirmLabel: 'Da, îl primesc',
    });
    if (!ok) return;
    try {
      const r = await this.api.post<{ pigeonId: number; conflicts: { message: string }[] }>(`/transfers/${t.id}/accept`);
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

  async refuse(t: Incoming) {
    const ok = await this.confirm.ask({ title: 'Nu primești porumbelul?', lines: [`${t.sellerName} va vedea vânzarea anulată.`], confirmLabel: 'Da, refuz', danger: true });
    if (!ok) return;
    try {
      await this.api.post(`/transfers/${t.id}/cancel`);
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
