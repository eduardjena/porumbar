import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';

@Component({
  selector: 'app-parola-uitata',
  imports: [FormsModule, RouterLink],
  template: `
    <div class="auth-page stack">
      <h1>Ai uitat parola?</h1>
      @if (sent()) {
        <div class="notice card">
          Dacă există un cont cu adresa <strong>{{ email }}</strong>, ți-am trimis un email cu un link pentru parola nouă.
          Linkul merge o oră. Uită-te și în dosarul „Spam”.
        </div>
        <a routerLink="/intra" class="btn wide">Înapoi la intrare</a>
      } @else {
        <form class="card stack" (ngSubmit)="submit()">
          <p>Scrie emailul contului. Îți trimitem un link cu care îți alegi o parolă nouă.</p>
          <label class="field">Email
            <input type="email" name="email" autocomplete="email" inputmode="email" required [(ngModel)]="email" />
          </label>
          @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
          <button class="primary wide" type="submit" [disabled]="busy()">Trimite linkul</button>
          <a routerLink="/intra">Înapoi la intrare</a>
        </form>
      }
    </div>
  `,
})
export default class ParolaUitata {
  private readonly api = inject(Api);
  email = '';
  readonly sent = signal(false);
  readonly error = signal('');
  readonly busy = signal(false);

  async submit() {
    this.error.set('');
    this.busy.set(true);
    try {
      await this.api.post('/auth/forgot', { email: this.email.trim() });
      this.sent.set(true);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
