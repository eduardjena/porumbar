import { Component, computed, inject, input, signal } from '@angular/core';
import { errorMessage } from '../core/api';
import { SharePdfService } from '../core/share-pdf';
import { Icon } from './icon';
import { TPipe, t } from '../core/i18n';

/** Butonul „Trimite”: fișa de pedigree ca PDF, prin meniul de partajare al telefonului (iconița obișnuită de share). */
@Component({
  selector: 'app-share-button',
  imports: [Icon, TPipe],
  template: `
    <button type="button" (click)="send()" [disabled]="busy()" [attr.aria-busy]="busy()">
      <app-icon name="trimite" />{{ (busy() ? 'trimite.se_pregateste' : 'trimite.trimite') | t }}
    </button>
    @if (note(); as n) { <span class="note" [class.err]="isError()" role="status">{{ n }}</span> }
  `,
  styles: `
    :host { display: inline-flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .note { font-size: 0.9rem; color: var(--muted); }
    .note.err { color: var(--danger, #b42318); }
  `,
})
export class ShareButton {
  private readonly share = inject(SharePdfService);
  readonly pigeonId = input.required<number>();
  protected readonly busy = computed(() => this.share.busy() === this.pigeonId());
  protected readonly note = signal('');
  protected readonly isError = signal(false);

  async send() {
    this.note.set('');
    this.isError.set(false);
    try {
      const r = await this.share.sharePigeon(this.pigeonId());
      if (r === 'downloaded') this.note.set(t('trimite.descarcat'));
    } catch (e) {
      this.isError.set(true);
      this.note.set(t('trimite.eroare', { eroare: errorMessage(e) }));
    }
  }
}
