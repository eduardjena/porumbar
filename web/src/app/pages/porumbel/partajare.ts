import { Component, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth';
import { ConfirmService } from '../../core/confirm';
import { Pigeon } from '../../core/models';
import { Icon } from '../../shared/icon';
import { QrCode } from '../../shared/qr-code';
import { Vanzare } from './vanzare';
import { TPipe, t } from '../../core/i18n';

/*
 * Fila „QR” a porumbelului: linkul public (pornit doar de proprietar), codul QR, trimiterea, tiparul și vânzarea.
 * Cine scanează codul vede pedigree-ul fără cont și, dacă are cont, îl poate prelua (o copie în porumbarul lui).
 */
@Component({
  selector: 'app-partajare',
  imports: [RouterLink, Icon, QrCode, Vanzare, TPipe],
  template: `
    @if (pigeon().kind !== 'own') {
      <section class="card"><p class="muted">{{ 'partajare.doar_proprii' | t }}</p></section>
    } @else {
      <section class="card share">
        @if (url(); as u) {
          <div class="qr"><app-qr-code [url]="u" [size]="360" /></div>
          <div class="side stack">
            <h2>{{ 'partajare.titlu' | t: { cine: title() } }}</h2>
            <p class="muted">{{ 'partajare.cine_scaneaza' | t }}</p>
            <p class="link mono">{{ u }}</p>
            <div class="row">
              <button type="button" class="primary" (click)="copy(u)"><app-icon name="copie" />{{ (copied() ? 'partajare.copiat' : 'partajare.copiaza') | t }}</button>
              @if (canShare) { <button type="button" (click)="share(u)"><app-icon name="trimite" />{{ 'actiune.trimite' | t }}</button> }
              <a class="btn" [routerLink]="['/porumbei', pigeon().id, 'tiparire']"><app-icon name="tipar" />{{ 'porumbel.tipareste_pedigree' | t }}</a>
            </div>
            <p class="muted small">{{ 'partajare.pe_pedigree_apare' | t: { extra: extras() } }} <a routerLink="/cont">{{ 'partajare.schimba_in_cont' | t }}</a></p>
            <div class="row">
              <button type="button" (click)="renew()">{{ 'partajare.alt_link' | t }}</button>
              <button type="button" class="danger" (click)="stop()">{{ 'partajare.opreste' | t }}</button>
            </div>
          </div>
        } @else if (loaded()) {
          <div class="side stack">
            <h2><app-icon name="qr" />{{ 'partajare.link_si_qr' | t }}</h2>
            <p>{{ 'partajare.porneste_explicatie' | t }}</p>
            <p class="muted">{{ 'partajare.ce_se_vede' | t }}</p>
            <div class="row">
              <button type="button" class="primary" (click)="start()"><app-icon name="qr" />{{ 'partajare.porneste' | t }}</button>
              <a class="btn" [routerLink]="['/porumbei', pigeon().id, 'tiparire']"><app-icon name="tipar" />{{ 'porumbel.tipareste_pedigree' | t }}</a>
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
    const parts = [a?.showPhone && t('partajare.telefonul'), a?.showAddress && t('partajare.adresa'), a?.showEmail && t('partajare.emailul')].filter(Boolean);
    return parts.length ? `, ${parts.join(', ')}` : t('partajare.fara_contact');
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
      title: t('partajare.porniti_titlu'),
      lines: [t('partajare.porniti_rand1'), t('partajare.porniti_rand2')],
      confirmLabel: t('partajare.porniti_da'),
    });
    if (!ok) return;
    await this.act(() => this.api.post<{ url: string }>(`/pigeons/${this.pigeon().id}/public`));
  }

  async renew() {
    const ok = await this.confirm.ask({
      title: t('partajare.alt_link_titlu'),
      lines: [t('partajare.alt_link_rand')],
      confirmLabel: t('partajare.alt_link_da'),
    });
    if (!ok) return;
    await this.act(() => this.api.post<{ url: string }>(`/pigeons/${this.pigeon().id}/public/new`));
  }

  async stop() {
    const ok = await this.confirm.ask({
      title: t('partajare.opreste_titlu'),
      lines: [t('partajare.opreste_rand')],
      confirmLabel: t('partajare.opreste_da'),
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
      this.error.set(t('partajare.copiere_esuata'));
    }
  }

  async share(u: string) {
    try {
      await navigator.share({ title: t('partajare.titlu_trimitere', { inel: this.pigeon().ring?.display ?? '' }), url: u });
    } catch {
      /* omul a renunțat */
    }
  }
}
