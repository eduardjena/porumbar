import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { errorMessage } from '../../core/api';
import { PasswordField } from '../../shared/password-field';
import { LangSwitch } from '../../shared/lang-switch';
import { TPipe } from '../../core/i18n';

@Component({
  selector: 'app-parola-noua',
  imports: [FormsModule, RouterLink, PasswordField, LangSwitch, TPipe],
  template: `
    <div class="auth-page stack">
      <app-lang-switch />
      <h1>{{ 'parola_noua.titlu' | t }}</h1>
      @if (auth.account(); as a) {
        <!-- Linkul se folosește o singură dată și te și intră în cont: redeschis, ar spune doar „folosit”. -->
        <div class="notice stack" role="status">
          <span>{{ 'parola_noua.deja_in_cont' | t: { email: a.email } }}</span>
          <a class="btn primary" routerLink="/panou">{{ 'parola_noua.mergi' | t }}</a>
        </div>
      }
      <form class="card stack" (ngSubmit)="submit()">
        <app-password-field [(value)]="password" [label]="'parola_noua.eticheta' | t" autocomplete="new-password" [hint]="'parola_noua.hint' | t" />
        @if (error()) {
          <div class="error" role="alert">{{ error() }}@if (auth.account()) { {{ 'parola_noua.totusi_in_cont' | t }} }</div>
          @if (!auth.account()) { <a routerLink="/parola-uitata">{{ 'parola_noua.link_nou' | t }}</a> }
        }
        <button class="primary wide" type="submit" [disabled]="busy()">{{ 'parola_noua.salveaza' | t }}</button>
      </form>
    </div>
  `,
})
export default class ParolaNoua {
  protected readonly auth = inject(AuthService);

  constructor() {
    this.auth.load();
  }
  private readonly router = inject(Router);
  readonly token = input.required<string>();
  password = '';
  readonly error = signal('');
  readonly busy = signal(false);

  async submit() {
    this.error.set('');
    this.busy.set(true);
    try {
      await this.auth.resetPassword(this.token(), this.password);
      this.router.navigateByUrl('/panou');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
