import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService, changes } from '../../core/confirm';
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
  `,
  template: `
    <h1>{{ 'cont.titlu' | t }}</h1>
    @if (auth.account(); as a) {
      @if (!a.isAdmin && a.subscription; as s) {
        <section class="card stack subs">
          <h2>{{ 'cont.abonament' | t }}</h2>
          @if (s.start) {
            <p>{{ (s.active ? 'cont.activ' : 'cont.expirat') | t }}{{ 'cont.de_pe' | t }}<strong>{{ day(s.start) }}</strong>{{ 'cont.pana_pe' | t }}<strong>{{ day(s.end) }}</strong>@if (s.active) { {{ 'cont.zile_ramase' | t: { count: s.daysLeft } }} }.</p>
          } @else {
            <p>{{ 'cont.neactivat' | t }}</p>
          }
          @if (a.reads; as r) { <p>{{ 'cont.citiri' | t }} <strong>{{ 'cititor.citiri_din' | t: { folosite: r.used, total: r.allowed } }}</strong> <span class="muted">{{ 'cont.citiri_explicatie' | t: { numar: r.perYear } }}</span></p>
            @if (r.fullFrom) { <p class="muted">{{ 'cont.citiri_inceput' | t: { total: r.perYear, data: day(r.fullFrom) } }}</p> }
          }
          @if (a.sellerContact) { <p class="muted">{{ 'cont.plata_contact' | t: { contact: a.sellerContact } }}</p> }
        </section>
      }
    }
    <form class="card stack" (ngSubmit)="save()">
      @if (auth.account()?.isAdmin) {
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
      } @else if (auth.account(); as a) {
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
      <label class="field">{{ 'concurs.codul_tau' | t }}
        <input class="mono" name="breederCode" [(ngModel)]="breederCode" autocapitalize="characters" autocomplete="off" spellcheck="false" [placeholder]="'text.de_exemplu' | t: { exemplu: 'VL9001' }" />
        <span class="hint">{{ 'concurs.codul_ajutor' | t }}</span>
      </label>
      @if (saved()) { <div class="notice" role="status">{{ 'cont.salvat' | t }}</div> }
      @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
      <button class="primary" type="submit">{{ 'actiune.salveaza' | t }}</button>
    </form>

    @if (langChoices().length > 1) {
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
  `,
})
export default class Cont {
  protected readonly auth = inject(AuthService);
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
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
