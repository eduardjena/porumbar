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
      <h1>Alege-ți parola</h1>
      @if (auth.account(); as a) {
        <!-- Linkul se folosește o singură dată și te și intră în cont: redeschis, ar spune doar „folosit”. -->
        <div class="notice stack" role="status">
          <span>Ești deja în contul tău ({{ a.email }}). Dacă ți-ai ales parola din acest link, nu mai ai nevoie de el: se folosește o singură dată.</span>
          <a class="btn primary" routerLink="/panou">Mergi la porumbarul tău</a>
        </div>
      }
      <form class="card stack" (ngSubmit)="submit()">
        <app-password-field [(value)]="password" label="Parola nouă" autocomplete="new-password" hint="Cel puțin 10 caractere." />
        @if (error()) {
          <div class="error" role="alert">{{ error() }}@if (auth.account()) { Ești însă deja în cont, deci totul e în regulă. }</div>
          @if (!auth.account()) { <a routerLink="/parola-uitata">Cere un link nou</a> }
        }
        <button class="primary wide" type="submit" [disabled]="busy()">Salvează parola</button>
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
