import { Component, inject, input, signal } from '@angular/core';
import { errorMessage } from '../core/api';
import { PlataService } from '../core/plata';
import { TPipe } from '../core/i18n';
import { Icon } from './icon';

/** „Plătește 1 an”: duce la pagina de plată Polar; arată eroarea lângă buton dacă nu se poate. */
@Component({
  selector: 'app-pay-button',
  imports: [Icon, TPipe],
  template: `
    <button type="button" [class.primary]="primary()" [disabled]="busy()" (click)="go()">
      <app-icon name="bifa" />{{ (busy() ? 'plata.se_deschide' : 'plata.plateste') | t }}
    </button>
    @if (error()) { <span class="err" role="alert">{{ error() }}</span> }
  `,
  styles: `
    :host { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 10px; }
    .err { color: var(--danger); font-weight: 700; }
  `,
})
export class PayButton {
  private readonly plata = inject(PlataService);
  readonly primary = input(true);
  protected readonly busy = signal(false);
  protected readonly error = signal('');

  async go() {
    this.busy.set(true);
    this.error.set('');
    try {
      await this.plata.pay();
    } catch (e) {
      this.error.set(errorMessage(e));
      this.busy.set(false);
    }
  }
}
