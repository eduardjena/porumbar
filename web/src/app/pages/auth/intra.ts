import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, afterLoginUrl } from '../../core/auth';
import { Api, errorMessage } from '../../core/api';
import { HttpErrorResponse } from '@angular/common/http';
import { PasswordField } from '../../shared/password-field';
import { LangSwitch } from '../../shared/lang-switch';
import { TPipe } from '../../core/i18n';
import { InstallApp } from '../../shared/install-app';

@Component({
  selector: 'app-intra',
  imports: [FormsModule, RouterLink, PasswordField, LangSwitch, TPipe, InstallApp],
  template: `
    <div class="auth-page stack">
      <app-lang-switch />
      <div class="logo"><img src="/icon.svg" alt="" width="88" height="88" /><img class="wordmark" src="/wordmark.svg" alt="Pigeonrama" width="190" height="23" /></div>
      <h1>{{ 'intra.titlu' | t }}</h1>
      <form class="card stack" (ngSubmit)="submit()">
        <label class="field">{{ 'auth.email' | t }}
          <input type="email" name="email" autocomplete="email" inputmode="email" required [(ngModel)]="email" />
        </label>
        <app-password-field [(value)]="password" />
        @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
        <!-- Contul încă neconfirmat: un link nou de confirmare, la emailul scris aici. -->
        @if (unconfirmed()) {
          @if (resent()) { <div class="notice" role="status">{{ 'confirma.trimis' | t }}</div> }
          <button type="button" class="wide" [disabled]="busy()" (click)="resend()">{{ 'confirma.trimite_din_nou' | t }}</button>
        }
        <button class="primary wide" type="submit" [disabled]="busy()">{{ (busy() ? 'intra.se_intra' : 'intra.intra') | t }}</button>
        <a routerLink="/parola-uitata">{{ 'intra.am_uitat' | t }}</a>
      </form>
      <p class="muted">{{ 'intra.nu_ai_cont' | t }} <a routerLink="/cont-nou">{{ 'intra.fa_cont' | t }}</a></p>
      <app-install-app />
    </div>
  `,
})
export default class Intra {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly api = inject(Api);
  email = '';
  password = '';
  readonly error = signal('');
  /** Intrarea a fost oprită pentru că emailul nu e confirmat. */
  readonly unconfirmed = signal(false);
  readonly resent = signal(false);
  readonly busy = signal(false);

  async submit() {
    this.error.set('');
    this.unconfirmed.set(false);
    this.resent.set(false);
    this.busy.set(true);
    try {
      await this.auth.login(this.email.trim(), this.password);
      this.router.navigateByUrl(afterLoginUrl());
    } catch (e) {
      this.error.set(errorMessage(e));
      this.unconfirmed.set(e instanceof HttpErrorResponse && (e.error as { key?: string } | null)?.key === 'eroare.email_neconfirmat');
    } finally {
      this.busy.set(false);
    }
  }

  /** Încă un link de confirmare, la emailul din formular. */
  async resend() {
    this.busy.set(true);
    try {
      await this.api.post('/auth/confirm/resend', { email: this.email.trim() });
      this.resent.set(true);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
