import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { errorMessage } from '../../core/api';

@Component({
  selector: 'app-cont-nou',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page stack">
      <div class="logo" aria-hidden="true">🕊</div>
      <h1>Cont nou</h1>
      <form class="card stack" (ngSubmit)="submit()">
        <label class="field">Numele tău (sau al porumbarului)
          <input name="name" autocomplete="name" required [(ngModel)]="name" />
        </label>
        <label class="field">Email
          <input type="email" name="email" autocomplete="email" inputmode="email" required [(ngModel)]="email" />
        </label>
        <label class="field">Parola
          <span class="hint">Cel puțin 10 caractere. Poate fi o propoziție, de exemplu „porumbeii mei zboară”.</span>
          <input type="password" name="password" autocomplete="new-password" required [(ngModel)]="password" />
        </label>
        @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
        <button class="primary wide" type="submit" [disabled]="busy()">{{ busy() ? 'Se creează…' : 'Fă contul' }}</button>
      </form>
      <p class="muted">Ai deja cont? <a routerLink="/intra">Intră</a></p>
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
      await this.auth.register(this.name.trim(), this.email.trim(), this.password);
      this.router.navigateByUrl('/porumbar');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
