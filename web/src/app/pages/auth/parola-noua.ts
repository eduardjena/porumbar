import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { errorMessage } from '../../core/api';
import { PasswordField } from '../../shared/password-field';

@Component({
  selector: 'app-parola-noua',
  imports: [FormsModule, RouterLink, PasswordField],
  template: `
    <div class="auth-page stack">
      <h1>Parolă nouă</h1>
      <form class="card stack" (ngSubmit)="submit()">
        <app-password-field [(value)]="password" label="Parola nouă" autocomplete="new-password" hint="Cel puțin 10 caractere." />
        @if (error()) {
          <div class="error" role="alert">{{ error() }}</div>
          <a routerLink="/parola-uitata">Cere un link nou</a>
        }
        <button class="primary wide" type="submit" [disabled]="busy()">Salvează parola</button>
      </form>
    </div>
  `,
})
export default class ParolaNoua {
  private readonly auth = inject(AuthService);
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
