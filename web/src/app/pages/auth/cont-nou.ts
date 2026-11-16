import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { errorMessage } from '../../core/api';
import { PasswordField } from '../../shared/password-field';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-cont-nou',
  imports: [FormsModule, RouterLink, Icon, PasswordField],
  template: `
    <div class="auth-page stack">
      <div class="logo" aria-hidden="true"><app-icon name="porumbel" [size]="56" /></div>
      <h1>Cont nou</h1>
      <form class="card stack" (ngSubmit)="submit()">
        <label class="field">Numele tău (sau al porumbarului)
          <input name="name" autocomplete="name" required [(ngModel)]="name" />
        </label>
        <label class="field">Email
          <input type="email" name="email" autocomplete="email" inputmode="email" required [(ngModel)]="email" />
        </label>
        <app-password-field [(value)]="password" autocomplete="new-password" hint="Cel puțin 10 caractere. Poate fi o propoziție, de exemplu „porumbeii mei zboară”." />
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
      this.router.navigateByUrl('/panou');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
