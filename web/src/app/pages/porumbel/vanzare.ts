import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService } from '../../core/confirm';
import { Pigeon } from '../../core/models';
import { Icon } from '../../shared/icon';

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
  imports: [FormsModule, Icon],
  template: `
    <section class="card stack sale">
      <h2><app-icon name="vinde" />Vinde porumbelul</h2>
      @if (sold(); as t) {
        <p class="ok">Vândut: {{ t.buyerEmail }} l-a primit pe {{ date(t.decidedAt) }}. La tine rămâne cu tot ce știai despre el.</p>
      } @else if (pending(); as t) {
        <p>Așteaptă să-l primească <strong>{{ t.buyerEmail }}</strong> (trimis pe {{ date(t.createdAt) }}){{ t.includePrivate ? ', cu notele și jurnalul' : '' }}.</p>
        <div class="row"><button type="button" (click)="cancel(t)">Anulează vânzarea</button></div>
      } @else {
        <p class="muted">Cumpărătorul primește porumbelul cu tot pedigree-ul în contul lui. Trebuie să aibă cont în Porumbar (gratuit). Dacă nu are încă, dă-i linkul sau pedigree-ul tipărit de mai sus.</p>
        <form class="stack" (ngSubmit)="sell()">
          <label class="field">Emailul cumpărătorului
            <input type="email" name="email" [(ngModel)]="email" autocomplete="off" required placeholder="cumparator@exemplu.ro" />
          </label>
          <label class="check"><input type="checkbox" name="priv" [(ngModel)]="includePrivate" /> Trimite și notele (evaluarea) și jurnalul</label>
          <div class="row"><button type="submit" class="primary" [disabled]="busy()"><app-icon name="vinde" />Trimite vânzarea</button></div>
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
  protected readonly date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('ro-RO') : '');

  constructor() {
    effect(() => {
      const id = this.pigeon().id;
      untracked(() => this.load(id));
    });
  }

  private async load(id: number) {
    try {
      const r = await this.api.get<{ outgoing: Outgoing[] }>('/transfers');
      this.mine.set(r.outgoing.filter((t) => t.pigeonId === id));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async sell() {
    this.error.set('');
    const email = this.email.trim();
    if (!email) return this.error.set('Scrie emailul cumpărătorului.');
    const p = this.pigeon();
    const ok = await this.confirm.ask({
      title: `Vinzi porumbelul ${p.ring?.display ?? ''}?`,
      lines: [
        `Cumpărătorul (${email}) îl va vedea în contul lui și îl primește cu tot pedigree-ul.`,
        this.includePrivate ? 'Primește și notele (evaluarea) și jurnalul.' : 'Notele și jurnalul rămân doar la tine.',
        'După ce îl primește, la tine porumbelul rămâne cu starea „Vândut”.',
      ],
      confirmLabel: 'Da, trimite vânzarea',
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

  async cancel(t: Outgoing) {
    const ok = await this.confirm.ask({ title: 'Anulezi vânzarea?', lines: [`${t.buyerEmail} nu va mai putea primi porumbelul.`], confirmLabel: 'Da, anulează', danger: true });
    if (!ok) return;
    try {
      await this.api.post(`/transfers/${t.id}/cancel`);
      await this.load(this.pigeon().id);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}
