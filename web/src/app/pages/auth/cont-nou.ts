import { Component, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, afterLoginUrl } from '../../core/auth';
import { errorMessage } from '../../core/api';
import { PasswordField } from '../../shared/password-field';
import { LangSwitch } from '../../shared/lang-switch';
import { TPipe, currentLang, t } from '../../core/i18n';
import { countryOptions, defaultCountry } from '../../core/countries';

/** Ca pe server: ceva@ceva.ceva, fără spații. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Câte cifre are telefonul (și cele scrise cu tastatura japoneză, ０-９). */
const phoneDigits = (phone: string) => (phone.match(/\p{Nd}/gu) ?? []).length;

/** Erorile serverului (după `key`) și câmpul sub care apar. */
const SERVER_FIELD: Record<string, string> = {
  'eroare.email_exista': 'email', 'eroare.email_gresit': 'email', 'eroare.email_unica_folosinta': 'email',
  'eroare.telefon_gresit': 'phone', 'eroare.tara_lipsa': 'country', 'eroare.parola_scurta': 'password',
  'eroare.parola_lunga': 'password', 'eroare.termeni_necesari': 'terms',
};

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
    /* Câmpul greșit: chenar roșu și, dedesubt, ce trebuie scris. */
    .bad input, .bad select { border-color: var(--danger); box-shadow: 0 0 0 3px var(--danger-soft); }
    .bad input::placeholder { color: var(--danger); opacity: 1; font-weight: 600; }
    .bad ::ng-deep input::placeholder { color: var(--danger); opacity: 1; font-weight: 600; }
    /* Câmpul de parolă e o componentă separată: stilul trebuie să ajungă și în ea. */
    .bad ::ng-deep input { border-color: var(--danger); box-shadow: 0 0 0 3px var(--danger-soft); }
    .field-error { color: var(--danger); font-weight: 700; font-size: 0.95rem; margin-top: -4px; }
    .req { color: var(--danger); }
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
        <form class="card stack" (ngSubmit)="submit()" novalidate>
          <p class="muted">{{ 'cont_nou.obligatorii' | t }}</p>
          <div data-f="name" [class.bad]="bad('name')" class="stack">
            <label class="field"><span>{{ 'cont_nou.nume' | t }} <span class="req">*</span></span>
              <input name="name" autocomplete="name" required [(ngModel)]="name" (ngModelChange)="clear('name')" [attr.placeholder]="inField('name')" [attr.aria-invalid]="bad('name')" />
            </label>
            @if (err('name'); as e) { <div class="field-error" role="alert">{{ e }}</div> }
          </div>
          <div data-f="email" [class.bad]="bad('email')" class="stack">
            <label class="field"><span>{{ 'auth.email' | t }} <span class="req">*</span></span>
              <input type="email" name="email" autocomplete="email" inputmode="email" required [(ngModel)]="email" (ngModelChange)="clear('email')" [attr.placeholder]="inField('email')" [attr.aria-invalid]="bad('email')" />
            </label>
            @if (err('email'); as e) { <div class="field-error" role="alert">{{ e }}</div> }
            @if (errors()['email']?.exists) {
              <div class="muted">{{ 'cont_nou.email_folosit_ajutor' | t }}<a routerLink="/intra">{{ 'intra.intra' | t }}</a> · <a routerLink="/parola-uitata">{{ 'intra.am_uitat' | t }}</a></div>
            }
          </div>
          <div data-f="phone" [class.bad]="bad('phone')" class="stack">
            <label class="field"><span>{{ 'cont_nou.telefon' | t }} <span class="req">*</span></span>
              <input type="tel" name="phone" autocomplete="tel" inputmode="tel" required [(ngModel)]="phone" (ngModelChange)="clear('phone')" [attr.placeholder]="inField('phone')" [attr.aria-invalid]="bad('phone')" />
            </label>
            @if (err('phone'); as e) { <div class="field-error" role="alert">{{ e }}</div> }
          </div>
          <div data-f="city" [class.bad]="bad('city')" class="stack">
            <label class="field"><span>{{ 'cont_nou.localitate' | t }} <span class="req">*</span></span>
              <input name="city" autocomplete="address-level2" required [(ngModel)]="city" (ngModelChange)="clear('city')" [attr.placeholder]="inField('city')" [attr.aria-invalid]="bad('city')" />
            </label>
            @if (err('city'); as e) { <div class="field-error" role="alert">{{ e }}</div> }
          </div>
          <div data-f="country" [class.bad]="bad('country')" class="stack">
            <label class="field"><span>{{ 'cont_nou.tara' | t }} <span class="req">*</span></span>
              <select name="country" autocomplete="country" required [(ngModel)]="country" (ngModelChange)="clear('country')" [attr.aria-invalid]="bad('country')">
                <option value="" disabled></option>
                @for (c of countries(); track c.code) { <option [value]="c.code">{{ c.name }}</option> }
              </select>
            </label>
            @if (err('country'); as e) { <div class="field-error" role="alert">{{ e }}</div> }
          </div>
          <div data-f="password" [class.bad]="bad('password')" class="stack">
            <app-password-field [(value)]="password" (valueChange)="clear('password')" [placeholder]="inField('password') ?? ''" autocomplete="new-password" [label]="('parola_camp.parola' | t) + ' *'" [hint]="'cont_nou.parola_hint' | t" />
            @if (err('password'); as e) { <div class="field-error" role="alert">{{ e }}</div> }
          </div>
          <div data-f="password2" [class.bad]="bad('password2')" class="stack">
            <app-password-field [(value)]="password2" (valueChange)="clear('password2')" [placeholder]="inField('password2') ?? ''" name="password2" autocomplete="new-password" [label]="('cont_nou.parola_din_nou' | t) + ' *'" />
            @if (err('password2'); as e) { <div class="field-error" role="alert">{{ e }}</div> }
          </div>
          <div class="hp" aria-hidden="true"><input type="text" name="website" tabindex="-1" autocomplete="off" [(ngModel)]="website" /></div>
          <div data-f="terms" [class.bad]="bad('terms')" class="stack">
            <label class="check terms">
              <input type="checkbox" name="terms" [(ngModel)]="terms" (ngModelChange)="clear('terms')" [attr.aria-invalid]="bad('terms')" />
              <span>{{ 'cont_nou.termeni_bifa' | t }}<a [href]="termsUrl()" target="_blank" rel="noopener">{{ 'cont_nou.termeni_link' | t }}</a> <span class="req">*</span></span>
            </label>
            @if (err('terms'); as e) { <div class="field-error" role="alert">{{ e }}</div> }
          </div>
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
  /** Ce e greșit la fiecare câmp (după ce omul a apăsat „Fă contul”); se șterge când scrie în el. */
  protected readonly errors = signal<Record<string, { msg: string; empty?: string; exists?: boolean }>>({});
  /** Câmpul e greșit (chenar roșu). */
  protected bad(field: string): boolean { return !!this.errors()[field]; }
  /** Mesajul de sub câmp: doar când în câmp e scris ceva greșit (câmpul gol are textul înăuntru). */
  protected err(field: string): string { const e = this.errors()[field]; return e && !e.empty ? e.msg : ''; }
  /** Textul din câmpul gol, cu roșu: ce trebuie scris. */
  protected inField(field: string): string | null { return this.errors()[field]?.empty ?? null; }
  protected clear(field: string) {
    if (this.errors()[field]) this.errors.update(({ [field]: _, ...rest }) => rest);
  }
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

  /** Câmpurile obligatorii, în ordinea de pe ecran: ce lipsește sau e greșit, cu ce trebuie scris. */
  private check(): Record<string, { msg: string; empty?: string }> {
    const e: Record<string, { msg: string; empty?: string }> = {};
    const blank = (key: string, example: string) => ({ msg: t(key), empty: t(example) });
    if (!this.name.trim()) e['name'] = blank('cont_nou.lipsa_nume', 'cont_nou.gol_nume');
    const email = this.email.trim();
    if (!email) e['email'] = blank('cont_nou.lipsa_email', 'cont_nou.gol_email');
    else if (!EMAIL_RE.test(email)) e['email'] = { msg: `${t('eroare.email_gresit')} ${t('cont_nou.lipsa_email')}` };
    const phone = this.phone.trim();
    const digits = phoneDigits(phone);
    if (!phone) e['phone'] = blank('cont_nou.lipsa_telefon', 'cont_nou.gol_telefon');
    else if (digits < 6) e['phone'] = { msg: t('eroare.telefon_gresit', { n: digits }) };
    if (!this.city.trim()) e['city'] = blank('cont_nou.lipsa_localitate', 'cont_nou.gol_localitate');
    if (!this.country) e['country'] = { msg: t('eroare.tara_lipsa') };
    if (!this.password) e['password'] = blank('cont_nou.lipsa_parola', 'cont_nou.gol_parola');
    else if ([...this.password].length < 10) e['password'] = { msg: t('cont_nou.lipsa_parola') };
    if (!this.password2) e['password2'] = blank('cont_nou.lipsa_parola2', 'cont_nou.gol_parola2');
    else if (this.password !== this.password2) e['password2'] = { msg: t('eroare.parole_diferite') };
    if (!this.terms) e['terms'] = { msg: t('eroare.termeni_necesari') };
    return e;
  }

  /** Sus la câmpul greșit, cu cursorul în el. */
  private goTo(field: string) {
    setTimeout(() => {
      const box = document.querySelector<HTMLElement>(`[data-f="${field}"]`);
      box?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      box?.querySelector<HTMLElement>('input, select')?.focus({ preventScroll: true });
    });
  }

  async submit() {
    this.error.set('');
    const errors = this.check();
    this.errors.set(errors);
    const first = Object.keys(errors)[0];
    if (first) {
      this.error.set(t('cont_nou.verifica'));
      this.goTo(first);
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
      // Greșelile găsite de server (de ex. emailul deja folosit) apar sub câmpul lor.
      const key = e instanceof HttpErrorResponse ? (e.error as { key?: string } | null)?.key : undefined;
      const field = key ? SERVER_FIELD[key] : undefined;
      if (field) {
        this.errors.set({ [field]: { msg: errorMessage(e), exists: key === 'eroare.email_exista' } });
        this.error.set(t('cont_nou.verifica'));
        this.goTo(field);
      } else {
        this.error.set(errorMessage(e));
      }
    } finally {
      this.busy.set(false);
    }
  }
}
