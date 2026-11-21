import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService, changes } from '../../core/confirm';
import { PushService } from '../../core/push';
import { LANGS, TPipe, formatDay, isPublicLang, t } from '../../core/i18n';

const yes = (v: boolean | undefined) => t(v ? 'text.da' : 'text.nu');

@Component({
  selector: 'app-cont',
  imports: [FormsModule, TPipe],
  styles: `
    .subs { margin-bottom: 20px; } .subs h2 { margin: 0; } .subs p { margin: 0; }
    .h { margin: 0; }
    .sheet { display: flex; flex-direction: column; padding: 12px 14px; border: 1px dashed var(--border); border-radius: 12px; background: #fff; color: #2b2117; line-height: 1.35; }
    .sheet strong { font-size: 1.2rem; }
    .sheet .addr { white-space: pre-line; }
    .show { border: 0; padding: 0; margin: 4px 0 0; } .show legend { font-weight: 700; margin-bottom: 2px; } .show p { margin: 0 0 6px; }
    .ticks { border-collapse: collapse; width: 100%; max-width: 520px; }
    .ticks th, .ticks td { padding: 8px 6px; text-align: center; border-bottom: 1px solid var(--border); }
    .ticks thead th { font-size: 0.9rem; color: var(--muted); font-weight: 700; }
    .ticks tbody th { text-align: left; font-weight: 600; }
    .ticks input { width: 28px; height: 28px; margin: 0; }
    .steps { margin: 0; padding-left: 22px; line-height: 1.5; } .steps li { margin-bottom: 4px; }
    .check { display: flex; gap: 12px; align-items: flex-start; } .check input { width: 28px; height: 28px; margin: 0; flex: none; }
  `,
  template: `
    <h1>{{ 'cont.titlu' | t }}</h1>
    <!-- Submeniurile (Abonament, Datele de pe fișă, Ce apare pe fișă, Codul de crescător, Limba, Ieșire și ștergere)
         stau în banda de sus (app.ts), după ?sec=. -->
    @if (auth.account(); as a) {
      @if (section() === 'abonament' && !a.isAdmin && a.subscription; as s) {
        <section class="card stack subs">
          <h2>{{ 'cont.abonament' | t }}</h2>
          @if (s.start) {
            <p>{{ (s.active ? 'cont.activ' : 'cont.expirat') | t }}{{ 'cont.de_pe' | t }}<strong>{{ day(s.start) }}</strong>{{ 'cont.pana_pe' | t }}<strong>{{ day(s.end) }}</strong>@if (s.active) { {{ 'cont.zile_ramase' | t: { count: s.daysLeft } }} }.</p>
          } @else {
            <p>{{ 'cont.neactivat' | t }}</p>
          }
          @if (a.reads; as r) { <p>{{ 'cont.citiri' | t }} <strong>{{ 'cititor.citiri_din' | t: { folosite: r.used, total: r.allowed } }}</strong>&nbsp;<span class="muted">{{ 'cont.citiri_explicatie' | t: { numar: r.perYear } }}</span></p>
            @if (r.fullFrom) { <p class="muted">{{ 'cont.citiri_inceput' | t: { total: r.perYear, data: day(r.fullFrom) } }}</p> }
          }
          @if (a.sellerContact) { <p class="muted">{{ 'cont.plata_contact' | t: { contact: a.sellerContact } }}</p> }
        </section>
      }
    }
    @if (section() === 'fisa' || section() === 'apare' || section() === 'cod') {
    <form class="card stack" (ngSubmit)="save()">
      @if (section() === 'fisa' && auth.account()?.isAdmin) {
        <p class="muted">{{ 'cont.admin_explicatie' | t }}</p>
        <label class="field">{{ 'cont.nume' | t }}
          <input name="name" required [(ngModel)]="name" autocomplete="name" />
        </label>
        <label class="field">{{ 'cont.nume_pedigree' | t }} <span class="hint">{{ 'cont.nume_pedigree_hint' | t }}</span>
          <input name="pedigreeName" [(ngModel)]="pedigreeName" />
        </label>
        <label class="field">{{ 'cont.telefon' | t }}
          <input name="phone" type="tel" inputmode="tel" [(ngModel)]="phone" autocomplete="tel" />
        </label>
        <label class="field">{{ 'cont.adresa' | t }}
          <textarea name="address" [(ngModel)]="address" autocomplete="street-address" rows="3" [placeholder]="'cont.adresa_exemplu' | t"></textarea>
        </label>
      } @else if (section() === 'fisa' && auth.account(); as a) {
        <h2 class="h">{{ 'cont.date_fisa' | t }}</h2>
        <p class="muted">{{ 'cont.date_fisa_explicatie' | t }}{{ a.sellerContact ? ' (' + a.sellerContact + ')' : '' }}.</p>
        <div class="sheet">
          <strong>{{ a.pedigreeName || '—' }}</strong>
          <!-- Ca pe foaie: doar ce e bifat la „Pe fișă” (se schimbă pe loc când bifezi). -->
          @if (a.address && printAddress) { <span class="addr">{{ a.address }}</span> }
          @if (a.phone && printPhone) { <span>{{ 'cont.tel' | t: { telefon: a.phone } }}</span> }
          @if (printEmail) { <span>{{ a.email }}</span> }
        </div>
      }
      @if (section() === 'apare') {
      <fieldset class="show">
        <legend>{{ 'cont.ce_apare' | t }}</legend>
        <p class="muted">{{ 'cont.ce_apare_explicatie' | t }}</p>
        <table class="ticks">
          <thead><tr><th></th><th scope="col">{{ 'cont.col_fisa' | t }}</th><th scope="col">{{ 'cont.col_link' | t }}</th></tr></thead>
          <tbody>
            <tr><th scope="row">{{ 'cont.rand_telefon' | t }}</th>
              <td><input type="checkbox" name="printPhone" [(ngModel)]="printPhone" [attr.aria-label]="'cont.telefon_fisa' | t" /></td>
              <td><input type="checkbox" name="showPhone" [(ngModel)]="showPhone" [attr.aria-label]="'cont.telefon_link' | t" /></td></tr>
            <tr><th scope="row">{{ 'cont.rand_adresa' | t }}</th>
              <td><input type="checkbox" name="printAddress" [(ngModel)]="printAddress" [attr.aria-label]="'cont.adresa_fisa' | t" /></td>
              <td><input type="checkbox" name="showAddress" [(ngModel)]="showAddress" [attr.aria-label]="'cont.adresa_link' | t" /></td></tr>
            <tr><th scope="row">{{ 'cont.rand_email' | t }}</th>
              <td><input type="checkbox" name="printEmail" [(ngModel)]="printEmail" [attr.aria-label]="'cont.email_fisa' | t" /></td>
              <td><input type="checkbox" name="showEmail" [(ngModel)]="showEmail" [attr.aria-label]="'cont.email_link' | t" /></td></tr>
          </tbody>
        </table>
      </fieldset>
      }
      @if (section() === 'cod') {
      <label class="field">{{ 'concurs.codul_tau' | t }}
        <input class="mono" name="breederCode" [(ngModel)]="breederCode" autocapitalize="characters" autocomplete="off" spellcheck="false" [placeholder]="'text.de_exemplu' | t: { exemplu: 'VL9001' }" />
        <span class="hint">{{ 'concurs.codul_ajutor' | t }}</span>
      </label>
      }
      @if (saved()) { <div class="notice" role="status">{{ 'cont.salvat' | t }}</div> }
      @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
      <!-- Crescătorul doar vede datele de pe fișă (le pune vânzătorul): acolo nu e nimic de salvat. -->
      @if (section() !== 'fisa' || auth.account()?.isAdmin) { <button class="primary" type="submit">{{ 'actiune.salveaza' | t }}</button> }
    </form>
    }

    @if (section() === 'limba') {
      <h2>{{ 'cont.limba' | t }}</h2>
      <div class="card stack">
        <div class="row wrap" role="group" [attr.aria-label]="'cont.limba' | t">
          @for (l of langChoices(); track l.code) {
            <button type="button" [class.primary]="l.code === auth.account()?.lang" [attr.aria-pressed]="l.code === auth.account()?.lang" (click)="pickLang(l.code)">{{ l.name }}</button>
          }
        </div>
        @if (langError()) { <div class="error" role="alert">{{ langError() }}</div> }
      </div>
    }

    @if (section() === 'amintiri') {
      <h2>{{ 'amintiri.titlu' | t }}</h2>
      @if (pushState() !== 'nokeys') {
      <div class="card stack">
        <p>{{ 'amintiri.explicatie' | t }}</p>
        @switch (pushState()) {
          @case ('ios') {
            <p><strong>{{ 'amintiri.ios_titlu' | t }}</strong></p>
            <ol class="steps">
              <li>{{ 'amintiri.ios_pas1' | t }}</li>
              <li>{{ 'amintiri.ios_pas2' | t }}</li>
              <li>{{ 'amintiri.ios_pas3' | t }}</li>
            </ol>
          }
          @case ('unsupported') { <p class="muted">{{ 'amintiri.nesuportat' | t }}</p> }
          @case ('denied') { <div class="notice" role="status">{{ 'amintiri.refuzat' | t }}</div> }
          @case ('on') {
            <div class="notice" role="status">{{ 'amintiri.telefon_activ' | t }}</div>
            <button type="button" class="wide" [disabled]="pushBusy()" (click)="pushTest()">{{ 'amintiri.proba' | t }}</button>
            <button type="button" class="wide" [disabled]="pushBusy()" (click)="pushOff()">{{ 'amintiri.opreste' | t }}</button>
          }
          @case ('off') {
            <button type="button" class="primary wide" [disabled]="pushBusy()" (click)="pushOn()">{{ 'amintiri.porneste' | t }}</button>
          }
        }
        @if (pushState() === 'on' || pushState() === 'off') {
          @if ((auth.account()?.pushDevices ?? 0) > (pushState() === 'on' ? 1 : 0)) { <p class="muted">{{ 'amintiri.telefoane' | t: { count: auth.account()?.pushDevices } }}</p> }
        }
        @if (pushMessage()) { <div class="notice" role="status">{{ pushMessage() }}</div> }
        @if (pushError()) { <div class="error" role="alert">{{ pushError() }}</div> }
      </div>
      }
      <div class="card stack">
        <label class="check">
          <input type="checkbox" name="reminderEmail" [checked]="auth.account()?.reminderEmail !== false" [disabled]="emailBusy()" (change)="setReminderEmail($any($event.target).checked)" />
          <span><strong>{{ 'amintiri.email' | t }}</strong><br /><span class="muted">{{ 'amintiri.email_explicatie' | t }}</span></span>
        </label>
        @if (emailError()) { <div class="error" role="alert">{{ emailError() }}</div> }
      </div>
    }

    @if (section() === 'iesire') {
    <h2>{{ 'cont.iesire' | t }}</h2>
    <button type="button" class="wide" (click)="logout()">{{ 'cont.iesi' | t }}</button>

    <h2>{{ 'cont.stergere' | t }}</h2>
    <div class="card stack">
      <p>{{ 'cont.stergere_explicatie' | t }}</p>
      <label class="field">{{ 'cont.parola_confirmare' | t }}
        <input type="password" name="deletePassword" [(ngModel)]="deletePassword" autocomplete="current-password" />
      </label>
      @if (deleteError()) { <div class="error" role="alert">{{ deleteError() }}</div> }
      <button type="button" class="danger" [disabled]="!deletePassword" (click)="remove()">{{ 'cont.sterge_definitiv' | t }}</button>
    </div>
    }
  `,
})
export default class Cont {
  protected readonly auth = inject(AuthService);
  /** Submeniul din banda de sus (?sec=); vânzătorul n-are abonament, așa că pornește de la datele de pe fișă. */
  readonly sec = input<string>();
  protected readonly section = computed(() => {
    const all = ['abonament', 'fisa', 'apare', 'cod', 'limba', 'amintiri', 'iesire'];
    const s = this.sec();
    if (s && all.includes(s)) return s;
    return this.auth.account()?.isAdmin ? 'fisa' : 'abonament';
  });
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly push = inject(PushService);
  private pushStarted = false;
  protected readonly pushState = signal<'loading' | 'nokeys' | 'ios' | 'unsupported' | 'denied' | 'on' | 'off'>('loading');
  protected readonly pushBusy = signal(false);
  protected readonly pushMessage = signal('');
  protected readonly pushError = signal('');
  protected readonly emailBusy = signal(false);
  protected readonly emailError = signal('');
  name = this.auth.account()?.name ?? '';
  pedigreeName = this.auth.account()?.pedigreeName ?? '';
  phone = this.auth.account()?.phone ?? '';
  address = this.auth.account()?.address ?? '';
  showPhone = !!this.auth.account()?.showPhone;
  showAddress = !!this.auth.account()?.showAddress;
  showEmail = !!this.auth.account()?.showEmail;
  printPhone = this.auth.account()?.printPhone !== false;
  printAddress = this.auth.account()?.printAddress !== false;
  printEmail = this.auth.account()?.printEmail !== false;
  breederCode = this.auth.account()?.breederCode ?? '';
  deletePassword = '';
  readonly saved = signal(false);
  readonly error = signal('');
  readonly deleteError = signal('');
  protected readonly day = formatDay;

  async save() {
    this.saved.set(false);
    this.error.set('');
    const a = this.auth.account();
    const admin = !!a?.isAdmin;
    const diff = changes([
      ...(admin
        ? [
            { label: t('cont.nume'), before: a?.name, after: this.name },
            { label: t('cont.nume_pedigree'), before: a?.pedigreeName, after: this.pedigreeName },
            { label: t('cont.telefon'), before: a?.phone, after: this.phone },
            { label: t('cont.adresa'), before: a?.address, after: this.address },
          ]
        : []),
      { label: t('cont.telefon_fisa'), before: yes(a?.printPhone !== false), after: yes(this.printPhone) },
      { label: t('cont.adresa_fisa'), before: yes(a?.printAddress !== false), after: yes(this.printAddress) },
      { label: t('cont.email_fisa'), before: yes(a?.printEmail !== false), after: yes(this.printEmail) },
      { label: t('cont.telefon_link_public'), before: yes(a?.showPhone), after: yes(this.showPhone) },
      { label: t('cont.adresa_link_public'), before: yes(a?.showAddress), after: yes(this.showAddress) },
      { label: t('cont.email_link_public'), before: yes(a?.showEmail), after: yes(this.showEmail) },
      { label: t('concurs.codul_tau'), before: a?.breederCode ?? '', after: this.breederCode.trim().toUpperCase().replace(/\s+/g, '') },
    ]);
    if (!diff.length) return this.saved.set(true);
    if (!(await this.confirm.ask({ title: t('cont.salvezi'), lines: diff, confirmLabel: t('cont.da_salveaza') }))) return;
    try {
      // Crescătorul trimite doar bifele (numele, telefonul și adresa le pune vânzătorul; serverul le refuză).
      await this.auth.update({
        ...(admin ? { name: this.name, pedigreeName: this.pedigreeName || null, phone: this.phone || null, address: this.address || null } : {}),
        showPhone: this.showPhone, showAddress: this.showAddress, showEmail: this.showEmail,
        printPhone: this.printPhone, printAddress: this.printAddress, printEmail: this.printEmail,
        breederCode: this.breederCode,
      });
      this.saved.set(true);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  /** Limbile pe care omul le poate alege singur: cele publice și limba pe care i-a pus-o vânzătorul. */
  protected readonly langChoices = computed(() => {
    const mine = this.auth.account()?.lang;
    return LANGS.filter((l) => l.public || l.code === mine);
  });
  readonly langError = signal('');

  async pickLang(code: string) {
    const current = this.auth.account()?.lang;
    if (!current || code === current) return;
    this.langError.set('');
    // Dintr-o limbă „în probă” nu se mai poate întoarce singur: îl întrebăm înainte.
    if (!isPublicLang(current)) {
      const name = LANGS.find((l) => l.code === current)?.name ?? current;
      const ok = await this.confirm.ask({ title: t('cont.limba_schimbi'), lines: [t('cont.limba_avertisment', { limba: name })], confirmLabel: t('cont.limba_da') });
      if (!ok) return;
    }
    try {
      await this.auth.update({ lang: code });
    } catch (e) {
      this.langError.set(errorMessage(e));
    }
  }

  constructor() {
    // Starea telefonului se citește doar când omul deschide secțiunea.
    effect(() => {
      if (this.section() === 'amintiri' && !this.pushStarted) {
        this.pushStarted = true;
        void this.initPush();
      }
    });
  }

  private async initPush() {
    if (this.push.isIosNotInstalled()) return this.pushState.set('ios');
    if (!this.push.supported()) return this.pushState.set('unsupported');
    if (!(await this.push.publicKey())) {
      // Serverul nu are chei: nu e nimic de pornit pe telefon, rămâne doar emailul.
      return this.pushState.set('nokeys');
    }
    await this.refreshPushState();
  }

  private async refreshPushState() {
    const on = !!(await this.push.currentEndpoint());
    this.pushState.set(on ? 'on' : this.push.permission() === 'denied' ? 'denied' : 'off');
  }

  async pushOn() {
    this.pushBusy.set(true);
    this.pushMessage.set('');
    this.pushError.set('');
    try {
      const ok = await this.push.subscribe();
      if (ok) await this.auth.refresh().catch(() => undefined);
      await this.refreshPushState();
    } catch {
      this.pushError.set(t('amintiri.eroare_pornire'));
    } finally {
      this.pushBusy.set(false);
    }
  }

  async pushOff() {
    this.pushBusy.set(true);
    this.pushMessage.set('');
    this.pushError.set('');
    try {
      await this.push.unsubscribe();
      await this.auth.refresh().catch(() => undefined);
      await this.refreshPushState();
    } finally {
      this.pushBusy.set(false);
    }
  }

  async pushTest() {
    this.pushBusy.set(true);
    this.pushMessage.set('');
    this.pushError.set('');
    try {
      const endpoint = await this.push.currentEndpoint();
      if (!endpoint) return await this.refreshPushState();
      const result = await this.push.test(endpoint);
      if (result === 'ok') this.pushMessage.set(t('amintiri.proba_ok'));
      else if (result === 'gone') {
        this.pushError.set(t('amintiri.proba_expirat'));
        await this.push.unsubscribe();
        await this.refreshPushState();
      } else this.pushError.set(t('amintiri.proba_eroare'));
    } catch (e) {
      this.pushError.set(errorMessage(e));
    } finally {
      this.pushBusy.set(false);
    }
  }

  async setReminderEmail(on: boolean) {
    this.emailBusy.set(true);
    this.emailError.set('');
    try {
      await this.auth.update({ reminderEmail: on });
    } catch (e) {
      this.emailError.set(errorMessage(e));
    } finally {
      this.emailBusy.set(false);
    }
  }

  async logout() {
    await this.auth.logout();
    this.router.navigateByUrl('/intra');
  }

  async remove() {
    const ok = await this.confirm.ask({
      title: t('cont.stergi'),
      lines: [t('cont.stergi_rand1'), t('cont.nu_inapoi')],
      confirmLabel: t('cont.da_sterge'),
      danger: true,
    });
    if (!ok) return;
    this.deleteError.set('');
    try {
      await this.api.delete('/auth/me', { password: this.deletePassword });
      this.auth.account.set(null);
      this.router.navigateByUrl('/intra');
    } catch (e) {
      this.deleteError.set(errorMessage(e));
    }
  }
}
