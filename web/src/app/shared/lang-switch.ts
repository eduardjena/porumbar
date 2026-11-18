import { Component, computed } from '@angular/core';
import { currentLang, publicLangs, rememberGuestLang, useLang } from '../core/i18n';

/** Butoanele de limbă pe paginile fără cont; apar doar când sunt cel puțin două limbi publice. */
@Component({
  selector: 'app-lang-switch',
  template: `
    @if (langs().length > 1) {
      <div class="langs" role="group" [attr.aria-label]="'Limba / Nyelv'">
        @for (l of langs(); track l.code) {
          <button type="button" [class.on]="l.code === lang()" [attr.aria-pressed]="l.code === lang()" (click)="pick(l.code)">{{ l.name }}</button>
        }
      </div>
    }
  `,
  styles: `
    .langs { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
    button { min-height: 48px; padding: 0 16px; font-size: 1rem; }
    button.on { background: var(--accent-soft); border-color: var(--accent); font-weight: 700; }
  `,
})
export class LangSwitch {
  protected readonly lang = currentLang;
  protected readonly langs = computed(() => publicLangs());

  protected async pick(code: string) {
    rememberGuestLang(code);
    await useLang(code);
  }
}
