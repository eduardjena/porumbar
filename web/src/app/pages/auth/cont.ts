import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon';
import { AuthService } from '../../core/auth';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService, changes } from '../../core/confirm';

const yes = (v: boolean | undefined) => (v ? 'da' : 'nu');

@Component({
  selector: 'app-cont',
  imports: [FormsModule, RouterLink, Icon],
  styles: `.subs { margin-bottom: 20px; } .subs h2 { margin: 0; } .subs p { margin: 0; } .show { border: 0; padding: 0; margin: 4px 0 0; } .show legend { font-weight: 700; margin-bottom: 2px; } .show p { margin: 0; }`,
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
      <p class="muted">Pe pedigree-ul tipărit apar jos, în stânga, numele, adresa, telefonul și emailul completate aici.</p>
      <label class="field">Nume
        <input name="name" required [(ngModel)]="name" autocomplete="name" />
      </label>
      <label class="field">Numele de pe pedigree <span class="hint">(echipa sau crescătoria, de ex. „Popescu-Ionescu Team”; gol = numele de mai sus)</span>
        <input name="pedigreeName" [(ngModel)]="pedigreeName" />
      </label>
      <label class="field">Telefon
        <input name="phone" type="tel" inputmode="tel" [(ngModel)]="phone" autocomplete="tel" />
      </label>
      <label class="field">Adresă
        <textarea name="address" [(ngModel)]="address" autocomplete="street-address" rows="3" placeholder="Strada, numărul&#10;Localitatea, județul"></textarea>
      </label>
      <p class="muted">Email: {{ auth.account()?.email }}</p>
      <fieldset class="stack show">
        <legend>Ce apare pe linkul public și la codul QR</legend>
        <p class="muted">Acolo îl poate vedea oricine are linkul: numele apare mereu, restul doar dacă bifezi. Pe foaia tipărită apar toate.</p>
        <label class="check"><input type="checkbox" name="showPhone" [(ngModel)]="showPhone" /> Telefonul</label>
        <label class="check"><input type="checkbox" name="showAddress" [(ngModel)]="showAddress" /> Adresa</label>
        <label class="check"><input type="checkbox" name="showEmail" [(ngModel)]="showEmail" /> Emailul</label>
      </fieldset>
      @if (saved()) { <div class="notice" role="status">Salvat.</div> }
      @if (error()) { <div class="error" role="alert">{{ error() }}</div> }
      <button class="primary" type="submit">Salvează</button>
    </form>

    <h2>Vânzări</h2>
    <a class="btn wide" routerLink="/vanzari"><app-icon name="vinde" />Porumbei primiți și vânduți</a>

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
    const diff = changes([
      { label: 'Nume', before: a?.name, after: this.name },
      { label: 'Numele de pe pedigree', before: a?.pedigreeName, after: this.pedigreeName },
      { label: 'Telefon', before: a?.phone, after: this.phone },
      { label: 'Adresă', before: a?.address, after: this.address },
      { label: 'Telefonul pe linkul public', before: yes(a?.showPhone), after: yes(this.showPhone) },
      { label: 'Adresa pe linkul public', before: yes(a?.showAddress), after: yes(this.showAddress) },
      { label: 'Emailul pe linkul public', before: yes(a?.showEmail), after: yes(this.showEmail) },
    ]);
    if (!diff.length) return this.saved.set(true);
    if (!(await this.confirm.ask({ title: 'Salvezi modificările?', lines: diff, confirmLabel: 'Da, salvează' }))) return;
    try {
      await this.auth.update({
        name: this.name, pedigreeName: this.pedigreeName || null, phone: this.phone || null, address: this.address || null,
        showPhone: this.showPhone, showAddress: this.showAddress, showEmail: this.showEmail,
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
