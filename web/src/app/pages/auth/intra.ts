import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { errorMessage } from '../../core/api';

@Component({
  selector: 'app-intra',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page stack">
      <div class="logo" aria-hidden="true">🕊</div>
      <h1>Intră în porumbarul tău</h1>
      <form class="card stack" (ngSubmit)="submit()">
        <label class="field">Email
          <input type="email" name="email" autocomplete="email" inputmode="email" required [(ngModel)]="email" />
        </label>
        <label class="field">Parola
          <input type="password" name="password" autocomplete="current-password" required [(ngModel)]="password" />
        </label>
        @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
        <button class="primary wide" type="submit" [disabled]="busy()">{{ busy() ? 'Se intră…' : 'Intră' }}</button>
        <a routerLink="/parola-uitata">Am uitat parola</a>
      </form>
      <p class="muted">Nu ai cont? <a routerLink="/cont-nou">Fă-ți un cont nou</a></p>
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
      this.router.navigateByUrl('/porumbar');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
