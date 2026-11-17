import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService } from '../../core/confirm';
import { PedigreeV1 } from '../../core/models';
import { Icon } from '../../shared/icon';
import { PedigreePage } from '../../shared/pedigree-page';

/*
 * Pedigree-ul tipărit (A4 vertical, ca fișele de pedigree pe hârtie): 5 generații în căsuțe, strămoșii repetați colorați, jos datele
 * crescătorului alese de el și codul QR al linkului public (care duce la tot pedigree-ul, cu textele întregi).
 * „Tipărește / Salvează PDF” deschide fereastra de tipărire a browserului (de acolo se alege și PDF).
 */
@Component({
  selector: 'app-tiparire',
  imports: [RouterLink, Icon, PedigreePage],
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
      <app-pedigree-page [data]="d" [url]="url()" />
    } @else if (!error()) {
      <p class="muted">Se pregătește pedigree-ul…</p>
    }
  `,
  styles: `
    .bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    @media print {
      :host { display: block; }
      .no-print { display: none !important; }
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
