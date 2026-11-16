import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth';
import { ConfirmService } from '../../core/confirm';
import { Pigeon } from '../../core/models';
import { Icon } from '../../shared/icon';
import { QrCode } from '../../shared/qr-code';
import { Vanzare } from './vanzare';

/*
 * Fila „QR” a porumbelului: linkul public (pornit doar de proprietar), codul QR, trimiterea, tiparul și vânzarea.
 * Cine scanează codul vede pedigree-ul fără cont și, dacă are cont, îl poate prelua (o copie în porumbarul lui).
 */
@Component({
  selector: 'app-partajare',
  imports: [RouterLink, Icon, QrCode, Vanzare],
  template: `
    @if (pigeon().kind !== 'own') {
      <section class="card"><p class="muted">Porumbeii „din alt porumbar” nu au link public: îl dă proprietarul lor.</p></section>
    } @else {
      <section class="card share">
        @if (url(); as u) {
          <div class="qr"><app-qr-code [url]="u" [size]="360" /></div>
          <div class="side stack">
            <h2>Pedigree-ul lui {{ title() }}</h2>
            <p class="muted">Cine scanează codul sau deschide linkul vede pedigree-ul pe 5 generații, fără cont. Cu cont, îl poate prelua în porumbarul lui.</p>
            <p class="link mono">{{ u }}</p>
            <div class="row">
              <button type="button" class="primary" (click)="copy(u)"><app-icon name="copie" />{{ copied() ? 'Copiat' : 'Copiază linkul' }}</button>
              @if (canShare) { <button type="button" (click)="share(u)"><app-icon name="trimite" />Trimite</button> }
              <a class="btn" [routerLink]="['/porumbei', pigeon().id, 'tiparire']"><app-icon name="tipar" />Tipărește pedigree-ul</a>
            </div>
            <p class="muted small">Pe pedigree apare: numele tău{{ extras() }}. <a routerLink="/cont">Schimbă în Contul meu</a></p>
            <div class="row">
              <button type="button" (click)="renew()">Fă alt link (vechiul nu mai merge)</button>
              <button type="button" class="danger" (click)="stop()">Oprește linkul</button>
            </div>
          </div>
        } @else if (loaded()) {
          <div class="side stack">
            <h2><app-icon name="qr" />Link și cod QR pentru pedigree</h2>
            <p>Pornește linkul ca să dai pedigree-ul altui crescător: îl scanează cu telefonul sau îl deschide din mesaj. Doar cine are linkul îl vede; îl poți opri oricând.</p>
            <p class="muted">Se văd: inelul, sexul, numele, culoarea, crescătorul și textul pentru pedigree, pe 5 generații. Nu se văd: notele, jurnalul, starea.</p>
            <div class="row">
              <button type="button" class="primary" (click)="start()"><app-icon name="qr" />Pornește linkul</button>
              <a class="btn" [routerLink]="['/porumbei', pigeon().id, 'tiparire']"><app-icon name="tipar" />Tipărește pedigree-ul</a>
            </div>
          </div>
        }
        @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
      </section>
      <app-vanzare [pigeon]="pigeon()" />
    }
  `,
  styles: `
    .share { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
    .qr { flex: 0 0 280px; background: #fff; border-radius: 16px; padding: 10px; border: 1px solid var(--border); }
    .qr app-qr-code { width: 100%; }
    .side { flex: 1 1 320px; min-width: 0; }
    .side h2 { margin: 0; display: flex; align-items: center; gap: 10px; }
    .link { word-break: break-all; background: var(--surface-2); padding: 10px 12px; border-radius: 12px; margin: 0; }
    .small { font-size: 0.9rem; margin: 0; }
    .share > .error { flex-basis: 100%; }
    @media (max-width: 767px) { .qr { flex-basis: 100%; max-width: 360px; margin: 0 auto; } }
  `,
})
export class Partajare {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);
  readonly pigeon = input.required<Pigeon>();
  readonly url = signal<string | null>(null);
  readonly loaded = signal(false);
  readonly copied = signal(false);
  readonly error = signal('');
  protected readonly canShare = typeof navigator !== 'undefined' && 'share' in navigator;

  constructor() {
    effect(() => {
      const id = this.pigeon().id;
      untracked(() => this.load(id));
    });
  }

  protected title() {
    const p = this.pigeon();
    return p.name ? `„${p.name}”` : (p.ring?.display ?? '');
  }

  protected extras() {
    const a = this.auth.account();
    const parts = [a?.showPhone && 'telefonul', a?.showAddress && 'adresa', a?.showEmail && 'emailul'].filter(Boolean);
    return parts.length ? `, ${parts.join(', ')}` : ' (fără telefon, adresă sau email)';
  }

  private async load(id: number) {
    try {
      this.url.set((await this.api.get<{ url: string | null }>(`/pigeons/${id}/public`)).url);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loaded.set(true);
    }
  }

  async start() {
    const ok = await this.confirm.ask({
      title: 'Pornești linkul public?',
      lines: ['Oricine are linkul sau scanează codul vede pedigree-ul acestui porumbel (fără note și jurnal).', 'Îl poți opri oricând.'],
      confirmLabel: 'Da, pornește',
    });
    if (!ok) return;
    await this.act(() => this.api.post<{ url: string }>(`/pigeons/${this.pigeon().id}/public`));
  }

  async renew() {
    const ok = await this.confirm.ask({
      title: 'Faci alt link?',
      lines: ['Linkul și codul QR de acum nu vor mai merge (și cele tipărite deja).'],
      confirmLabel: 'Da, fă altul',
    });
    if (!ok) return;
    await this.act(() => this.api.post<{ url: string }>(`/pigeons/${this.pigeon().id}/public/new`));
  }

  async stop() {
    const ok = await this.confirm.ask({
      title: 'Oprești linkul?',
      lines: ['Nimeni nu va mai putea deschide pedigree-ul cu linkul sau codul QR de acum.'],
      confirmLabel: 'Da, oprește',
      danger: true,
    });
    if (!ok) return;
    this.error.set('');
    try {
      await this.api.delete(`/pigeons/${this.pigeon().id}/public`);
      this.url.set(null);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  private async act(fn: () => Promise<{ url: string }>) {
    this.error.set('');
    try {
      this.url.set((await fn()).url);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async copy(u: string) {
    try {
      await navigator.clipboard.writeText(u);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.error.set('Nu am putut copia. Selectează linkul și copiază-l de mână.');
    }
  }

  async share(u: string) {
    try {
      await navigator.share({ title: `Pedigree ${this.pigeon().ring?.display ?? ''}`, url: u });
    } catch {
      /* omul a renunțat */
    }
  }
}
