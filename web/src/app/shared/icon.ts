import { Component, input } from '@angular/core';

/*
 * Iconițele aplicației: desen cu linie, aceeași grosime peste tot (24×24, linie 2). Desenele urmează setul Lucide
 * (licență ISC), scrise direct aici: fără fișiere sau servere externe (CSP 'self').
 */
export type IconName =
  | 'panou' | 'retea' | 'plus' | 'cont' | 'lista' | 'cautare' | 'editeaza' | 'arbore' | 'jurnal' | 'poze' | 'rude'
  | 'fisa' | 'iesire' | 'sterge' | 'inainte' | 'inapoi' | 'alerta' | 'porumbel' | 'inchide' | 'bifa';

@Component({
  selector: 'app-icon',
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         [attr.width]="size()" [attr.height]="size()" aria-hidden="true" focusable="false">
      @switch (name()) {
        @case ('panou') { <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /> }
        @case ('retea') { <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /> }
        @case ('plus') { <path d="M5 12h14M12 5v14" /> }
        @case ('cont') { <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /> }
        @case ('lista') { <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /> }
        @case ('cautare') { <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /> }
        @case ('editeaza') { <path d="M21.2 6.8a1 1 0 0 0-4-4L3.8 16.2a2 2 0 0 0-.5.8l-1.3 4.4a.5.5 0 0 0 .6.6l4.4-1.3a2 2 0 0 0 .8-.5z" /><path d="m15 5 4 4" /> }
        @case ('arbore') { <path d="M6 3v12" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /> }
        @case ('jurnal') { <path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /> }
        @case ('poze') { <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" /><circle cx="12" cy="13" r="3" /> }
        @case ('rude') { <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /> }
        @case ('fisa') { <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z" /><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8" /> }
        @case ('iesire') { <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /> }
        @case ('sterge') { <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /> }
        @case ('inainte') { <path d="m9 18 6-6-6-6" /> }
        @case ('inapoi') { <path d="m15 18-6-6 6-6" /> }
        @case ('alerta') { <path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3M12 9v4M12 17h.01" /> }
        @case ('porumbel') { <path d="M16 7h.01M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.3-2.3L2 20M20 7l2 .5-2 .5M10 18v3M14 17.8V21M7 18a6 6 0 0 0 3.8-10.6" /> }
        @case ('inchide') { <path d="M18 6 6 18M6 6l12 12" /> }
        @case ('bifa') { <path d="M20 6 9 17l-5-5" /> }
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; flex: none; line-height: 0; }`,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(24);
}
