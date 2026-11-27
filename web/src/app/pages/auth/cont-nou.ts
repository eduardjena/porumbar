import { Component, computed, effect, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { Api, errorMessage } from '../../core/api';
import { PasswordField } from '../../shared/password-field';
import { LangSwitch } from '../../shared/lang-switch';
import { TPipe, currentLang, t } from '../../core/i18n';
import { countryOptions } from '../../core/countries';
import { countryInNumber, dialOf, examplePhone, guessCountry, phoneCountries, phoneProblem } from '../../core/phone';

/** Ca pe server: ceva@ceva.ceva, fără spații. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Erorile serverului (după `key`) și câmpul sub care apar. */
const SERVER_FIELD: Record<string, string> = {
  'eroare.email_exista': 'email', 'eroare.email_gresit': 'email', 'eroare.email_unica_folosinta': 'email',
  'eroare.telefon_tara': 'phone', 'eroare.telefon_invalid_fara_tara': 'phone',
  'eroare.telefon_scurt': 'phone', 'eroare.telefon_lung': 'phone', 'eroare.telefon_invalid': 'phone', 'eroare.tara_lipsa': 'country', 'eroare.parola_scurta': 'password',
  'eroare.parola_lunga': 'password', 'eroare.termeni_necesari': 'terms',
};

/** Termenii și condițiile, în limba ecranului (pe sit). */
const TERMS: Record<string, string> = {
  ro: 'https://www.pigeonrama.com/termeni.html',
  hu: 'https://www.pigeonrama.com/feltetelek.html',
  en: 'https://www.pigeonrama.com/terms.html',
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
    /* Telefonul: prefixul țării (un <select> nativ, invizibil, peste eticheta „RO +40”) și numărul, pe același rând. */
    .tel { display: flex; gap: 8px; align-items: stretch; }
    .tel input { flex: 1; min-width: 0; }
    .cc { position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; min-height: 52px; border: 1.5px solid var(--border-strong);
      border-radius: var(--radius-sm); background: var(--surface); font-weight: 700; white-space: nowrap; }
    .cc select { position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; min-height: 0; padding: 0; }
    .cc:focus-within { border-color: var(--accent); box-shadow: 0 0 0 4px rgb(217 33 50 / 20%); }
    .cc .chev { width: 12px; height: 8px; }
    .bad .cc { border-color: var(--danger); }
  `,
  template: `
    <div class="auth-page stack">
      <app-lang-switch />
      <div class="logo"><img src="/icon.svg" alt="" width="88" height="88" /><img class="wordmark" src="/wordmark.svg" alt="Pigeonrama" width="190" height="23" /></div>
      @if (sentTo(); as sent) {
        <h1>{{ 'cont_nou.trimis_titlu' | t }}</h1>
        <div class="notice stack" role="status">
          <span>{{ 'cont_nou.trimis_text' | t: { email: sent } }}</span>
        </div>
        @if (resent()) { <div class="notice" role="status">{{ 'confirma.trimis' | t }}</div> }
        @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
        <button type="button" class="wide" [disabled]="busy()" (click)="resend()">{{ 'confirma.trimite_din_nou' | t }}</button>
        <p class="muted">{{ 'cont_nou.ai_cont' | t }} <a routerLink="/intra">{{ 'intra.intra' | t }}</a></p>
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
            <label class="field" for="phone"><span>{{ 'cont_nou.telefon' | t }} <span class="req">*</span></span></label>
            <div class="tel">
              <span class="cc">
                <span aria-hidden="true">{{ phoneCountry }} {{ dial() }}</span>
                <svg class="chev" viewBox="0 0 12 8" aria-hidden="true"><path d="M1.5 1.5 6 6l4.5-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                <select name="phoneCountry" autocomplete="tel-country-code" [attr.aria-label]="'cont_nou.prefix_tara' | t" [(ngModel)]="phoneCountry" (ngModelChange)="onPhoneCountry($event)">
                  @for (c of phoneCountries(); track c.code) { <option [value]="c.code">{{ c.name }} {{ c.dial }}</option> }
                </select>
              </span>
              <input id="phone" type="tel" name="phone" autocomplete="tel-national" inputmode="tel" required [(ngModel)]="phone" (ngModelChange)="onPhone($event)" [attr.placeholder]="inField('phone') ?? example()" [attr.aria-invalid]="bad('phone')" />
            </div>
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
  private readonly api = inject(Api);
  name = '';
  email = '';
  phone = '';
  city = '';
  password = '';
  password2 = '';
  country = guessCountry(currentLang());
  /** Țara numărului de telefon (prefixul), aleasă lângă număr; la început, țara în care pare să fie omul. */
  phoneCountry = guessCountry(currentLang());
  private readonly phoneCountrySig = signal(this.phoneCountry);
  protected readonly dial = computed(() => dialOf(this.phoneCountrySig()));
  protected readonly example = computed(() => examplePhone(this.phoneCountrySig()));
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
  /** Prefixele: „România +40”, cu numele în limba ecranului. */
  protected readonly phoneCountries = computed(() => phoneCountries(currentLang()));

  protected onPhoneCountry(code: string) {
    this.phoneCountrySig.set(code);
    this.clear('phone');
  }

  /** Un număr scris cu +40… / 0040… schimbă singur prefixul din stânga. */
  protected onPhone(value: string) {
    this.clear('phone');
    const c = countryInNumber(value);
    if (c && c !== this.phoneCountry) {
      this.phoneCountry = c;
      this.phoneCountrySig.set(c);
    }
  }
  /** Termenii, în limba aleasă pe ecran. */
  protected readonly termsUrl = computed(() => TERMS[currentLang()] ?? TERMS['ro']);

  constructor() {
    // La schimbarea limbii, țara implicită o urmează (dacă omul n-a ales încă alta).
    let lastDefault = this.country;
    effect(() => {
      const d = guessCountry(currentLang());
      if (this.country === lastDefault) this.country = d;
      lastDefault = d;
    });
  }

  /** Încă un link de confirmare, la adresa din formular. */
  readonly resent = signal(false);
  protected async resend() {
    this.busy.set(true);
    try {
      await this.api.post('/auth/confirm/resend', { email: this.sentTo() });
      this.resent.set(true);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
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
    const problem = phone ? phoneProblem(phone, this.phoneCountry, currentLang()) : null;
    if (!phone) e['phone'] = blank('cont_nou.lipsa_telefon', 'cont_nou.gol_telefon');
    else if (problem) e['phone'] = { msg: t(problem.key, problem.vars) };
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
        name: this.name.trim(), email, phone: this.phone.trim(), phoneCountry: this.phoneCountry, city: this.city.trim(), password: this.password, lang: currentLang(), country: this.country,
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
