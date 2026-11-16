import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService, changes } from '../../core/confirm';

@Component({
  selector: 'app-cont',
  imports: [FormsModule],
  template: `
    <h1>Contul meu</h1>
    <form class="card stack" (ngSubmit)="save()">
      <p class="muted">Aceste date pot apărea pe pedigree-urile tipărite, doar dacă alegi tu.</p>
      <label class="field">Nume
        <input name="name" required [(ngModel)]="name" autocomplete="name" />
      </label>
      <label class="field">Telefon
        <input name="phone" type="tel" inputmode="tel" [(ngModel)]="phone" autocomplete="tel" />
      </label>
      <label class="field">Adresă
        <textarea name="address" [(ngModel)]="address" autocomplete="street-address"></textarea>
      </label>
      <p class="muted">Email: {{ auth.account()?.email }}</p>
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
  phone = this.auth.account()?.phone ?? '';
  address = this.auth.account()?.address ?? '';
  deletePassword = '';
  readonly saved = signal(false);
  readonly error = signal('');
  readonly deleteError = signal('');

  async save() {
    this.saved.set(false);
    this.error.set('');
    const a = this.auth.account();
    const diff = changes([
      { label: 'Nume', before: a?.name, after: this.name },
      { label: 'Telefon', before: a?.phone, after: this.phone },
      { label: 'Adresă', before: a?.address, after: this.address },
    ]);
    if (!diff.length) return this.saved.set(true);
    if (!(await this.confirm.ask({ title: 'Salvezi modificările?', lines: diff, confirmLabel: 'Da, salvează' }))) return;
    try {
      await this.auth.update({ name: this.name, phone: this.phone || null, address: this.address || null });
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
