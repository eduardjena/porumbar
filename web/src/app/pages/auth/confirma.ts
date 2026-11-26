import { Component, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { Api, errorMessage } from '../../core/api';
import { Account } from '../../core/models';
import { LangSwitch } from '../../shared/lang-switch';
import { TPipe } from '../../core/i18n';

/** Linkul din emailul de confirmare: confirmă emailul și pornește proba de 30 de zile (merge și cu cont intrat, și fără). */
@Component({
  selector: 'app-confirma',
  imports: [RouterLink, LangSwitch, TPipe],
  template: `
    <div class="auth-page stack">
      <!-- Intrat în cont e antetul aplicației sus; limba se schimbă atunci din Cont. -->
      @if (!auth.account()) { <app-lang-switch /> }
      <div class="logo"><img src="/icon.svg" alt="" width="88" height="88" /><img class="wordmark" src="/wordmark.svg" alt="Pigeonrama" width="190" height="23" /></div>
      <h1>{{ 'confirma.titlu' | t }}</h1>
      @if (state() === 'wait') {
        <p role="status">{{ 'confirma.se_confirma' | t }}</p>
      } @else if (state() === 'done') {
        <div class="notice stack" role="status">
          <strong>{{ (trial() ? 'confirma.proba_pornita' : 'confirma.confirmat') | t }}</strong>
          <a class="btn primary wide" [routerLink]="auth.account() ? '/panou' : '/intra'">{{ (auth.account() ? 'confirma.la_panou' : 'intra.intra') | t }}</a>
        </div>
      } @else {
        <div class="error" role="alert">{{ error() }}</div>
        @if (auth.account()) {
          @if (sent()) { <div class="notice" role="status">{{ 'confirma.trimis' | t }}</div> }
          <button type="button" class="wide" [disabled]="busy()" (click)="resend()">{{ 'confirma.trimite_din_nou' | t }}</button>
          <a class="btn wide" routerLink="/panou">{{ 'confirma.la_panou' | t }}</a>
        } @else {
          <a class="btn wide" routerLink="/intra">{{ 'confirma.intra' | t }}</a>
        }
      }
    </div>
  `,
})
export default class Confirma {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  readonly token = input.required<string>();
  protected readonly state = signal<'wait' | 'done' | 'error'>('wait');
  protected readonly trial = signal(false);
  protected readonly error = signal('');
  protected readonly sent = signal(false);
  protected readonly busy = signal(false);

  constructor() {
    queueMicrotask(() => this.confirm());
  }

  private async confirm() {
    await this.auth.load();
    try {
      const r = await this.api.post<{ account: Account }>('/auth/confirm', { token: this.token() });
      this.trial.set(r.account?.subscription?.status === 'trial');
      // Linkul te bagă în cont (serverul a făcut sesiunea): contul și banda probei, fără reîncărcare.
      await this.auth.refresh().catch(() => undefined);
      this.state.set('done');
    } catch (e) {
      this.error.set(errorMessage(e));
      this.state.set('error');
    }
  }

  protected async resend() {
    this.busy.set(true);
    this.sent.set(false);
    try {
      await this.api.post('/auth/confirm/resend');
      this.sent.set(true);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
