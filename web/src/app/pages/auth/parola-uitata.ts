import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { TPipe, GluePipe } from '../../core/i18n';
import { LangSwitch } from '../../shared/lang-switch';

@Component({
  selector: 'app-parola-uitata',
  imports: [FormsModule, RouterLink, LangSwitch, TPipe, GluePipe],
  template: `
    <div class="auth-page stack">
      <app-lang-switch />
      <h1>{{ 'parola_uitata.titlu' | t }}</h1>
      @if (sent()) {
        <div class="notice card">
          <span class="flow">{{ 'parola_uitata.trimis_1' | t }}{{ ' ' | glue }}<strong>{{ email }}</strong>{{ 'parola_uitata.trimis_2' | t }}{{ ' ' | glue }}{{ 'parola_uitata.trimis_3' | t }}</span>
        </div>
        <a routerLink="/intra" class="btn wide">{{ 'parola_uitata.inapoi' | t }}</a>
      } @else {
        <form class="card stack" (ngSubmit)="submit()">
          <p>{{ 'parola_uitata.explicatie' | t }}</p>
          <label class="field">{{ 'auth.email' | t }}
            <input type="email" name="email" autocomplete="email" inputmode="email" required [(ngModel)]="email" />
          </label>
          @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
          <button class="primary wide" type="submit" [disabled]="busy()">{{ 'parola_uitata.trimite' | t }}</button>
          <a routerLink="/intra">{{ 'parola_uitata.inapoi' | t }}</a>
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
