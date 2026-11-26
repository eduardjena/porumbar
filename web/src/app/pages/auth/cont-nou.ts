import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, afterLoginUrl } from '../../core/auth';
import { errorMessage } from '../../core/api';
import { PasswordField } from '../../shared/password-field';
import { LangSwitch } from '../../shared/lang-switch';
import { TPipe, currentLang, t } from '../../core/i18n';
import { countryOptions, defaultCountry } from '../../core/countries';

/** Termenii și condițiile, în limba ecranului (pe sit). */
const TERMS: Record<string, string> = {
  ro: 'https://www.pigeonrama.com/termeni.html',
  hu: 'https://www.pigeonrama.com/feltetelek.html',
  ja: 'https://www.pigeonrama.com/ja-kiyaku.html',
};

/**
 * Înscrierea: nume, email, telefon, localitate, parola de două ori, țara și bifa termenilor. Contul se face „doar citire”; linkul din
 * emailul de confirmare pornește singur proba de 30 de zile (fără vânzător).
 */
@Component({
  selector: 'app-cont-nou',
  imports: [FormsModule, RouterLink, PasswordField, LangSwitch, TPipe],
  styles: `
    /* Capcana pentru roboți: în afara ecranului (nu display:none, ca să o completeze și ei), fără etichetă pentru cititorul de ecran. */
    .hp { position: absolute; left: -10000px; top: auto; width: 1px; height: 1px; overflow: hidden; }
    label.terms { align-items: flex-start; font-weight: 500; }
    label.terms input { margin-top: 2px; }
  `,
  template: `
    <div class="auth-page stack">
      <!-- Intrat în cont (după înscriere) e antetul aplicației sus; limba se schimbă atunci din Cont. -->
      @if (!sentTo()) { <app-lang-switch /> }
      <div class="logo"><img src="/icon.svg" alt="" width="88" height="88" /><img class="wordmark" src="/wordmark.svg" alt="Pigeonrama" width="190" height="23" /></div>
      @if (sentTo(); as sent) {
        <h1>{{ 'cont_nou.trimis_titlu' | t }}</h1>
        <div class="notice stack" role="status">
          <span>{{ 'cont_nou.trimis_text' | t: { email: sent } }}</span>
        </div>
        <button type="button" class="primary wide" (click)="enter()">{{ 'cont_nou.spre_panou' | t }}</button>
      } @else {
        <h1>{{ 'cont_nou.titlu' | t }}</h1>
        <form class="card stack" (ngSubmit)="submit()">
          <label class="field">{{ 'cont_nou.nume' | t }}
            <input name="name" autocomplete="name" required [(ngModel)]="name" />
          </label>
          <label class="field">{{ 'auth.email' | t }}
            <input type="email" name="email" autocomplete="email" inputmode="email" required [(ngModel)]="email" />
          </label>
          <label class="field">{{ 'cont_nou.telefon' | t }}
            <input type="tel" name="phone" autocomplete="tel" inputmode="tel" required [(ngModel)]="phone" />
          </label>
          <label class="field">{{ 'cont_nou.localitate' | t }}
            <input name="city" autocomplete="address-level2" required [(ngModel)]="city" />
          </label>
          <label class="field">{{ 'cont_nou.tara' | t }}
            <select name="country" autocomplete="country" required [(ngModel)]="country">
              <option value="" disabled></option>
              @for (c of countries(); track c.code) { <option [value]="c.code">{{ c.name }}</option> }
            </select>
          </label>
          <app-password-field [(value)]="password" autocomplete="new-password" [hint]="'cont_nou.parola_hint' | t" />
          <app-password-field [(value)]="password2" name="password2" autocomplete="new-password" [label]="'cont_nou.parola_din_nou' | t" />
          <div class="hp" aria-hidden="true"><input type="text" name="website" tabindex="-1" autocomplete="off" [(ngModel)]="website" /></div>
          <label class="check terms">
            <input type="checkbox" name="terms" [(ngModel)]="terms" />
            <span>{{ 'cont_nou.termeni_bifa' | t }}<a [href]="termsUrl()" target="_blank" rel="noopener">{{ 'cont_nou.termeni_link' | t }}</a></span>
          </label>
          @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
          <button class="primary wide" type="submit" [disabled]="busy()">{{ (busy() ? 'cont_nou.se_creeaza' : 'cont_nou.fa_contul') | t }}</button>
        </form>
        <p class="muted">{{ 'cont_nou.ai_cont' | t }} <a routerLink="/intra">{{ 'intra.intra' | t }}</a></p>
      }
    </div>
  `,
})
export default class ContNou {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  name = '';
  email = '';
  phone = '';
  city = '';
  password = '';
  password2 = '';
  country = defaultCountry(currentLang());
  website = '';
  terms = false;
  readonly error = signal('');
  readonly busy = signal(false);
  /** După trimitere: adresa la care a plecat linkul (ecranul „Ți-am trimis un email”). */
  readonly sentTo = signal('');
  /** Țările, cu numele în limba ecranului. */
  protected readonly countries = computed(() => countryOptions(currentLang()));
  /** Termenii, în limba aleasă pe ecran. */
  protected readonly termsUrl = computed(() => TERMS[currentLang()] ?? TERMS['ro']);

  constructor() {
    // La schimbarea limbii, țara implicită o urmează (dacă omul n-a ales încă alta).
    let lastDefault = this.country;
    effect(() => {
      const d = defaultCountry(currentLang());
      if (this.country === lastDefault) this.country = d;
      lastDefault = d;
    });
  }

  protected enter() {
    this.router.navigateByUrl(afterLoginUrl());
  }

  async submit() {
    this.error.set('');
    if (this.password !== this.password2) {
      this.error.set(t('eroare.parole_diferite'));
      return;
    }
    this.busy.set(true);
    try {
      const email = this.email.trim();
      await this.auth.register({
        name: this.name.trim(), email, phone: this.phone.trim(), city: this.city.trim(), password: this.password, lang: currentLang(), country: this.country,
        acceptTerms: this.terms, website: this.website,
      });
      this.sentTo.set(email);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
