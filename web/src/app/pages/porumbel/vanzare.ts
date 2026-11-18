import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService } from '../../core/confirm';
import { Pigeon } from '../../core/models';
import { Icon } from '../../shared/icon';
import { TPipe, formatDate, t } from '../../core/i18n';

interface Outgoing {
  id: number;
  pigeonId: number;
  status: 'pending' | 'accepted' | 'cancelled';
  buyerEmail: string;
  includePrivate: boolean;
  createdAt: string;
  decidedAt: string | null;
}

/*
 * „Vinde porumbelul” (pe fila QR): emailul cumpărătorului (care are cont în Porumbar) și bifa pentru note și jurnal.
 * Cumpărătorul acceptă în contul lui; până atunci vânzarea se poate anula. La vânzător porumbelul rămâne, „Vândut”.
 */
@Component({
  selector: 'app-vanzare',
  imports: [FormsModule, Icon, TPipe],
  template: `
    <section class="card stack sale">
      <h2><app-icon name="vinde" />{{ 'vanzare.titlu' | t }}</h2>
      @if (sold(); as s) {
        <p class="ok">{{ 'vanzare.vandut' | t: { email: s.buyerEmail, data: date(s.decidedAt) } }}</p>
      } @else if (pending(); as s) {
        <p>{{ 'vanzare.asteapta' | t }} <strong>{{ s.buyerEmail }}</strong> {{ 'vanzare.trimis_pe' | t: { data: date(s.createdAt) } }}{{ s.includePrivate ? ('vanzare.cu_notele' | t) : '' }}.</p>
        <div class="row"><button type="button" (click)="cancel(s)">{{ 'vanzare.anuleaza' | t }}</button></div>
      } @else {
        <p class="muted">{{ 'vanzare.explicatie' | t }}</p>
        <form class="stack" (ngSubmit)="sell()">
          <label class="field">{{ 'vanzare.email_cumparator' | t }}
            <input type="email" name="email" [(ngModel)]="email" autocomplete="off" required [placeholder]="'vanzare.email_exemplu' | t" />
          </label>
          <label class="check"><input type="checkbox" name="priv" [(ngModel)]="includePrivate" /> {{ 'vanzare.trimite_si_notele' | t }}</label>
          <div class="row"><button type="submit" class="primary" [disabled]="busy()"><app-icon name="vinde" />{{ 'vanzare.trimite' | t }}</button></div>
        </form>
      }
      @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
    </section>
  `,
  styles: `
    .sale { margin-top: 16px; }
    .sale h2 { margin: 0; display: flex; align-items: center; gap: 10px; }
    .sale p { margin: 0; }
    .ok { color: var(--ok); font-weight: 700; }
  `,
})
export class Vanzare {
  private readonly api = inject(Api);
  private readonly confirm = inject(ConfirmService);
  readonly pigeon = input.required<Pigeon>();
  readonly mine = signal<Outgoing[]>([]);
  readonly busy = signal(false);
  readonly error = signal('');
  email = '';
  includePrivate = false;
  protected readonly pending = computed(() => this.mine().find((t) => t.status === 'pending') ?? null);
  protected readonly sold = computed(() => this.mine().find((t) => t.status === 'accepted') ?? null);
  protected readonly date = (iso: string | null) => (iso ? formatDate(iso) : '');

  constructor() {
    effect(() => {
      const id = this.pigeon().id;
      untracked(() => this.load(id));
    });
  }

  private async load(id: number) {
    try {
      const r = await this.api.get<{ outgoing: Outgoing[] }>(`/transfers?pigeon=${id}`);
      if (id === this.pigeon().id) this.mine.set(r.outgoing.filter((t) => t.pigeonId === id));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async sell() {
    this.error.set('');
    const email = this.email.trim();
    if (!email) return this.error.set(t('eroare.email_cumparator'));
    const p = this.pigeon();
    const ok = await this.confirm.ask({
      title: t('vanzare.confirma_titlu', { inel: p.ring?.display ?? '' }),
      lines: [
        t('vanzare.confirma_rand1', { email }),
        t(this.includePrivate ? 'vanzare.confirma_cu_note' : 'vanzare.confirma_fara_note'),
        t('vanzare.confirma_rand3'),
      ],
      confirmLabel: t('vanzare.confirma_da'),
    });
    if (!ok) return;
    this.busy.set(true);
    try {
      await this.api.post(`/pigeons/${p.id}/transfers`, { email, includePrivate: this.includePrivate });
      this.email = '';
      await this.load(p.id);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }

  async cancel(s: Outgoing) {
    const ok = await this.confirm.ask({ title: t('vanzare.anuleaza_titlu'), lines: [t('vanzare.anuleaza_rand', { email: s.buyerEmail })], confirmLabel: t('vanzare.anuleaza_da'), danger: true });
    if (!ok) return;
    try {
      await this.api.post(`/transfers/${s.id}/cancel`);
      await this.load(this.pigeon().id);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
