import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, afterLoginUrl } from '../../core/auth';
import { errorMessage } from '../../core/api';
import { PasswordField } from '../../shared/password-field';
import { LangSwitch } from '../../shared/lang-switch';
import { TPipe, currentLang } from '../../core/i18n';

@Component({
  selector: 'app-cont-nou',
  imports: [FormsModule, RouterLink, PasswordField, LangSwitch, TPipe],
  template: `
    <div class="auth-page stack">
      <app-lang-switch />
      <div class="logo"><img src="/icon.svg" alt="Porumbar" width="88" height="88" /></div>
      <h1>{{ 'cont_nou.titlu' | t }}</h1>
      <form class="card stack" (ngSubmit)="submit()">
        <label class="field">{{ 'cont_nou.nume' | t }}
          <input name="name" autocomplete="name" required [(ngModel)]="name" />
        </label>
        <label class="field">{{ 'auth.email' | t }}
          <input type="email" name="email" autocomplete="email" inputmode="email" required [(ngModel)]="email" />
        </label>
        <app-password-field [(value)]="password" autocomplete="new-password" [hint]="'cont_nou.parola_hint' | t" />
        @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
        <button class="primary wide" type="submit" [disabled]="busy()">{{ (busy() ? 'cont_nou.se_creeaza' : 'cont_nou.fa_contul') | t }}</button>
      </form>
      <p class="muted">{{ 'cont_nou.ai_cont' | t }} <a routerLink="/intra">{{ 'intra.intra' | t }}</a></p>
    </div>
  `,
})
export default class ContNou {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  name = '';
  email = '';
  password = '';
  readonly error = signal('');
  readonly busy = signal(false);

  async submit() {
    this.error.set('');
    this.busy.set(true);
    try {
      await this.auth.register(this.name.trim(), this.email.trim(), this.password, currentLang());
      this.router.navigateByUrl(afterLoginUrl());
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
