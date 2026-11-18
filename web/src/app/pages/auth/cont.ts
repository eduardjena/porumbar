import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService, changes } from '../../core/confirm';

const yes = (v: boolean | undefined) => (v ? 'da' : 'nu');

@Component({
  selector: 'app-cont',
  imports: [FormsModule],
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
    <h1>Contul meu</h1>
    @if (auth.account(); as a) {
      @if (!a.isAdmin && a.subscription; as s) {
        <section class="card stack subs">
          <h2>Abonament</h2>
          @if (s.start) {
            <p>{{ s.active ? 'Activ' : 'Expirat' }}: de pe <strong>{{ day(s.start) }}</strong> până pe <strong>{{ day(s.end) }}</strong>@if (s.active) { (mai sunt {{ s.daysLeft }} zile) }.</p>
          } @else {
            <p>Contul nu este activ încă. Până la activare poți doar să vezi porumbeii.</p>
          }
          <p>Credit pentru citirea pedigree-urilor din poze: <strong>{{ money(a.aiCredit ?? 0) }}</strong> <span class="muted">(o citire costă în jur de 0,10–0,15 $)</span></p>
          @if (a.sellerContact) { <p class="muted">Plată, activare și credit: {{ a.sellerContact }}</p> }
        </section>
      }
    }
    <form class="card stack" (ngSubmit)="save()">
      @if (auth.account()?.isAdmin) {
        <p class="muted">Pe pedigree-ul tipărit apar jos, în stânga, numele de pe pedigree și ce bifezi mai jos.</p>
        <label class="field">Nume
          <input name="name" required [(ngModel)]="name" autocomplete="name" />
        </label>
        <label class="field">Numele de pe pedigree <span class="hint">(echipa sau crescătoria, de ex. „Popescu-Ionescu Team”)</span>
          <input name="pedigreeName" [(ngModel)]="pedigreeName" />
        </label>
        <label class="field">Telefon
          <input name="phone" type="tel" inputmode="tel" [(ngModel)]="phone" autocomplete="tel" />
        </label>
        <label class="field">Adresă
          <textarea name="address" [(ngModel)]="address" autocomplete="street-address" rows="3" placeholder="Strada, numărul&#10;Localitatea, județul"></textarea>
        </label>
      } @else if (auth.account(); as a) {
        <h2 class="h">Datele de pe fișă</h2>
        <p class="muted">Așa apar jos, în stânga, pe pedigree. Le schimbă doar cel de la care ai primit programul{{ a.sellerContact ? ' (' + a.sellerContact + ')' : '' }}.</p>
        <div class="sheet">
          <strong>{{ a.pedigreeName || '—' }}</strong>
          <!-- Ca pe foaie: doar ce e bifat la „Pe fișă” (se schimbă pe loc când bifezi). -->
          @if (a.address && printAddress) { <span class="addr">{{ a.address }}</span> }
          @if (a.phone && printPhone) { <span>Tel.: {{ a.phone }}</span> }
          @if (printEmail) { <span>{{ a.email }}</span> }
        </div>
      }
      <fieldset class="show">
        <legend>Ce apare pe lângă nume</legend>
        <p class="muted">Numele apare mereu. Linkul public și codul QR le poate vedea oricine le are.</p>
        <table class="ticks">
          <thead><tr><th></th><th scope="col">Pe fișă și în PDF</th><th scope="col">La link și codul QR</th></tr></thead>
          <tbody>
            <tr><th scope="row">Telefonul</th>
              <td><input type="checkbox" name="printPhone" [(ngModel)]="printPhone" aria-label="Telefonul pe fișă" /></td>
              <td><input type="checkbox" name="showPhone" [(ngModel)]="showPhone" aria-label="Telefonul la link" /></td></tr>
            <tr><th scope="row">Adresa</th>
              <td><input type="checkbox" name="printAddress" [(ngModel)]="printAddress" aria-label="Adresa pe fișă" /></td>
              <td><input type="checkbox" name="showAddress" [(ngModel)]="showAddress" aria-label="Adresa la link" /></td></tr>
            <tr><th scope="row">Emailul</th>
              <td><input type="checkbox" name="printEmail" [(ngModel)]="printEmail" aria-label="Emailul pe fișă" /></td>
              <td><input type="checkbox" name="showEmail" [(ngModel)]="showEmail" aria-label="Emailul la link" /></td></tr>
          </tbody>
        </table>
      </fieldset>
      @if (saved()) { <div class="notice" role="status">Salvat.</div> }
      @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
      <button class="primary" type="submit">Salvează</button>
    </form>

    <h2>Ieșire</h2>
    <button type="button" class="wide" (click)="logout()">Ieși din cont</button>

    <h2>Ștergerea contului</h2>
    <div class="card stack">
      <p>Se șterg contul și toți porumbeii, pozele și notele tale. Nu se poate da înapoi.</p>
      <label class="field">Scrie parola ca să confirmi
        <input type="password" name="deletePassword" [(ngModel)]="deletePassword" autocomplete="current-password" />
      </label>
      @if (deleteError()) { <div class="error" role="alert">{{ deleteError() }}</div> }
      <button type="button" class="danger" [disabled]="!deletePassword" (click)="remove()">Șterge contul definitiv</button>
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
  deletePassword = '';
  readonly saved = signal(false);
  readonly error = signal('');
  readonly deleteError = signal('');
  protected readonly day = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('ro-RO') : '');
  protected readonly money = (n: number) => `${n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;

  async save() {
    this.saved.set(false);
    this.error.set('');
    const a = this.auth.account();
    const admin = !!a?.isAdmin;
    const diff = changes([
      ...(admin
        ? [
            { label: 'Nume', before: a?.name, after: this.name },
            { label: 'Numele de pe pedigree', before: a?.pedigreeName, after: this.pedigreeName },
            { label: 'Telefon', before: a?.phone, after: this.phone },
            { label: 'Adresă', before: a?.address, after: this.address },
          ]
        : []),
      { label: 'Telefonul pe fișă', before: yes(a?.printPhone !== false), after: yes(this.printPhone) },
      { label: 'Adresa pe fișă', before: yes(a?.printAddress !== false), after: yes(this.printAddress) },
      { label: 'Emailul pe fișă', before: yes(a?.printEmail !== false), after: yes(this.printEmail) },
      { label: 'Telefonul pe linkul public', before: yes(a?.showPhone), after: yes(this.showPhone) },
      { label: 'Adresa pe linkul public', before: yes(a?.showAddress), after: yes(this.showAddress) },
      { label: 'Emailul pe linkul public', before: yes(a?.showEmail), after: yes(this.showEmail) },
    ]);
    if (!diff.length) return this.saved.set(true);
    if (!(await this.confirm.ask({ title: 'Salvezi modificările?', lines: diff, confirmLabel: 'Da, salvează' }))) return;
    try {
      // Crescătorul trimite doar bifele (numele, telefonul și adresa le pune vânzătorul; serverul le refuză).
      await this.auth.update({
        ...(admin ? { name: this.name, pedigreeName: this.pedigreeName || null, phone: this.phone || null, address: this.address || null } : {}),
        showPhone: this.showPhone, showAddress: this.showAddress, showEmail: this.showEmail,
        printPhone: this.printPhone, printAddress: this.printAddress, printEmail: this.printEmail,
      });
      this.saved.set(true);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async logout() {
    await this.auth.logout();
    this.router.navigateByUrl('/intra');
  }

  async remove() {
    const ok = await this.confirm.ask({
      title: 'Ștergi contul și tot porumbarul?',
      lines: ['Se șterg toți porumbeii, notele și datele contului.', 'Nu se poate da înapoi.'],
      confirmLabel: 'Da, șterge tot',
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
