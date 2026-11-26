import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, afterLoginUrl } from '../../core/auth';
import { errorMessage } from '../../core/api';
import { PasswordField } from '../../shared/password-field';
import { LangSwitch } from '../../shared/lang-switch';
import { TPipe } from '../../core/i18n';

@Component({
  selector: 'app-intra',
  imports: [FormsModule, RouterLink, PasswordField, LangSwitch, TPipe],
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
        <button class="primary wide" type="submit" [disabled]="busy()">{{ (busy() ? 'intra.se_intra' : 'intra.intra') | t }}</button>
        <a routerLink="/parola-uitata">{{ 'intra.am_uitat' | t }}</a>
      </form>
      <p class="muted">{{ 'intra.nu_ai_cont' | t }} <a routerLink="/cont-nou">{{ 'intra.fa_cont' | t }}</a></p>
    </div>
  `,
})
export default class Intra {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  email = '';
  password = '';
  readonly error = signal('');
  readonly busy = signal(false);

  async submit() {
    this.error.set('');
    this.busy.set(true);
    try {
      await this.auth.login(this.email.trim(), this.password);
      this.router.navigateByUrl(afterLoginUrl());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
