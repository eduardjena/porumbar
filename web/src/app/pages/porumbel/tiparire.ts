import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService } from '../../core/confirm';
import { PedigreeV1 } from '../../core/models';
import { Icon } from '../../shared/icon';
import { PedigreeSheet } from '../../shared/pedigree-sheet';
import { QrCode } from '../../shared/qr-code';

/*
 * Pedigree-ul tipărit (A4 orizontal, spec §7): 5 generații în căsuțe, strămoșii repetați colorați, jos datele
 * crescătorului alese de el și codul QR al linkului public (care duce la tot pedigree-ul, cu textele întregi).
 * „Tipărește / Salvează PDF” deschide fereastra de tipărire a browserului (de acolo se alege și PDF).
 */
@Component({
  selector: 'app-tiparire',
  imports: [RouterLink, Icon, PedigreeSheet, QrCode],
  template: `
    <div class="bar no-print">
      <a class="btn" [routerLink]="['/porumbei', id()]" [queryParams]="{ fila: 'qr' }"><app-icon name="inapoi" />Înapoi la porumbel</a>
      @if (!url() && loaded()) {
        <button type="button" (click)="startLink()"><app-icon name="qr" />Pune și codul QR (pornește linkul)</button>
      }
      <button type="button" class="primary" (click)="print()"><app-icon name="tipar" />Tipărește / Salvează PDF</button>
    </div>
    @if (error()) { <div class="error no-print" role="alert"><app-icon name="alerta" />{{ error() }}</div> }

    @if (data(); as d) {
      <article class="page">
        <header>
          <div>
            <p class="kicker">Pedigree</p>
            <h1><span class="mono">{{ d.root.ring ?? 'fără inel' }}</span>@if (d.root.name) { „{{ d.root.name }}” }</h1>
          </div>
          <p class="brand">Porumbar</p>
        </header>
        <app-pedigree-sheet [root]="d.root" [compact]="true" />
        <footer>
          <div class="owner">
            <strong>Crescător: {{ d.owner.name }}</strong>
            @if (d.owner.phone) { <span>Tel.: {{ d.owner.phone }}</span> }
            @if (d.owner.email) { <span>{{ d.owner.email }}</span> }
            @if (d.owner.address) { <span>{{ d.owner.address }}</span> }
            <span class="muted">Tipărit pe {{ today }}. Strămoșii colorați la fel apar de mai multe ori.</span>
          </div>
          @if (url(); as u) {
            <div class="qr">
              <app-qr-code [url]="u" [size]="240" />
              <span>Scanează pentru pedigree-ul complet</span>
            </div>
          }
        </footer>
      </article>
    } @else if (!error()) {
      <p class="muted">Se pregătește pedigree-ul…</p>
    }
  `,
  styles: `
    .bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .page { width: min(1062px, 100%); margin: 0 auto; background: #fff; padding: 0; border: 1px solid var(--border); border-radius: 12px; }
    header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid var(--text); padding-bottom: 4px; margin-bottom: 6px; }
    .kicker { margin: 0; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; font-size: 0.75rem; color: var(--accent-strong); }
    h1 { margin: 0; font-size: 1.3rem; }
    .brand { margin: 0; font-weight: 800; color: var(--muted); }
    footer { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-top: 6px; border-top: 1px solid var(--border); padding-top: 4px; }
    .owner { display: flex; flex-direction: column; gap: 2px; font-size: 0.9rem; }
    .qr { display: flex; flex-direction: column; align-items: center; gap: 2px; width: 92px; font-size: 6.5pt; text-align: center; }
    .owner { font-size: 8pt !important; }
    .qr app-qr-code { width: 92px; }
    @media print {
      @page { size: A4 landscape; margin: 8mm; }
      :host { display: block; }
      .no-print { display: none !important; }
      .page { width: 100%; border: 0; padding: 0; border-radius: 0; break-inside: avoid; }
    }
  `,
})
export default class Tiparire {
  private readonly api = inject(Api);
  private readonly confirm = inject(ConfirmService);
  readonly id = input.required<string>();
  readonly data = signal<PedigreeV1 | null>(null);
  readonly url = signal<string | null>(null);
  readonly loaded = signal(false);
  readonly error = signal('');
  protected readonly today = new Date().toLocaleDateString('ro-RO');

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  private async load(id: string) {
    try {
      const [ped, link] = await Promise.all([
        this.api.get<PedigreeV1>(`/pigeons/${id}/pedigree`),
        this.api.get<{ url: string | null }>(`/pigeons/${id}/public`),
      ]);
      this.data.set(ped);
      this.url.set(link.url);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loaded.set(true);
    }
  }

  async startLink() {
    const ok = await this.confirm.ask({
      title: 'Pornești linkul public?',
      lines: ['Codul QR de pe foaie duce la pedigree-ul porumbelului. Oricine scanează codul îl vede (fără note și jurnal).'],
      confirmLabel: 'Da, pornește',
    });
    if (!ok) return;
    try {
      this.url.set((await this.api.post<{ url: string }>(`/pigeons/${this.id()}/public`)).url);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  print() {
    window.print();
  }
}
