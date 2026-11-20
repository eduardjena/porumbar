import { Component, input } from '@angular/core';

/*
 * Iconițele aplicației: desen cu linie, aceeași grosime peste tot (24×24, linie 2). Desenele urmează setul Lucide
 * (licență ISC), scrise direct aici: fără fișiere sau servere externe (CSP 'self').
 */
export type IconName =
  | 'panou' | 'retea' | 'plus' | 'cont' | 'lista' | 'cautare' | 'editeaza' | 'arbore' | 'jurnal' | 'poze' | 'rude'
  | 'fisa' | 'minus' | 'ramificare' | 'rotire' | 'mutare' | 'iesire' | 'sterge' | 'inainte' | 'inapoi' | 'alerta' | 'porumbel' | 'inchide' | 'bifa' | 'copac' | 'qr' | 'tipar' | 'trimite' | 'ordonare' | 'grupare' | 'filtru' | 'jos' | 'copie' | 'vinde' | 'cupa' | 'ou' | 'calendar';

@Component({
  selector: 'app-icon',
  template: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
         [attr.width]="size()" [attr.height]="size()" aria-hidden="true" focusable="false">
      @switch (name()) {
        @case ('panou') { <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /> }
        @case ('retea') { <circle cx="5" cy="6" r="2.5" /><circle cx="19" cy="6" r="2.5" /><circle cx="12" cy="18" r="2.5" /><path d="M7.5 6h9M6.3 8.2l4.4 7.6M17.7 8.2l-4.4 7.6" /> }
        @case ('calendar') { <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" /> }
        @case ('plus') { <path d="M5 12h14M12 5v14" /> }
        @case ('minus') { <path d="M5 12h14" /> }
        @case ('rotire') { <path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" /> }
        @case ('mutare') { <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" /> }
        @case ('ramificare') { <circle cx="5" cy="12" r="2.5" /><circle cx="19" cy="5" r="2.5" /><circle cx="19" cy="19" r="2.5" /><path d="M7.5 12h3.5a2 2 0 0 0 2-2V7a2 2 0 0 1 2-2h1.5M11 12a2 2 0 0 1 2 2v3a2 2 0 0 0 2 2h1.5" /> }
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
        <!-- Arborele genealogic: trunchi și ramuri, la capete câte un porumbel (aleasă de utilizator, varianta A). -->
        @case ('copac') { <path d="M9 21.5h6M12 21.5V7.3M12 15.5 7.2 10.6M12 15.5l4.8-4.9" /><circle cx="5.6" cy="8.9" r="2.3" /><circle cx="18.4" cy="8.9" r="2.3" /><circle cx="12" cy="4.9" r="2.3" /> }
        @case ('qr') { <rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" /><rect width="5" height="5" x="3" y="16" rx="1" /><path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01M12 16v.01M16 12h1M21 12v.01M12 21v-1" /> }
        @case ('tipar') { <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect width="12" height="8" x="6" y="14" /> }
        @case ('trimite') { <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" /> }
        @case ('ordonare') { <path d="m21 16-4 4-4-4M17 20V4M3 8l4-4 4 4M7 4v16" /> }
        @case ('grupare') { <path d="M12.8 2.2a2 2 0 0 0-1.6 0L2.6 6.1a1 1 0 0 0 0 1.8l8.6 3.9a2 2 0 0 0 1.6 0l8.6-3.9a1 1 0 0 0 0-1.8z" /><path d="m22 17.7-9.2 4.1a2 2 0 0 1-1.6 0L2 17.7M22 12.7l-9.2 4.1a2 2 0 0 1-1.6 0L2 12.7" /> }
        @case ('filtru') { <path d="M10 20a1 1 0 0 0 .6.9l2 1A1 1 0 0 0 14 21v-7a2 2 0 0 1 .5-1.3l7.2-8A1 1 0 0 0 21 3H3a1 1 0 0 0-.7 1.7l7.2 8A2 2 0 0 1 10 14z" /> }
        @case ('jos') { <path d="m6 9 6 6 6-6" /> }
        @case ('copie') { <rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2" /> }
        @case ('ou') { <path d="M12 22c6.2 0 7.9-5.6 7.5-10-.4-4.3-3.9-10-7.5-10S4.9 7.7 4.5 12c-.4 4.4 1.3 10 7.5 10z" /> }
        @case ('cupa') { <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.7V17c0 .6-.5 1-1 1.2C7.9 18.8 7 20.2 7 22M14 14.7V17c0 .6.5 1 1 1.2 1.1.6 2 2 2 3.8" /><path d="M18 2H6v7a6 6 0 0 0 12 0z" /> }
        @case ('vinde') { <path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z" /><circle cx="7.5" cy="7.5" r=".5" /> }
      }
    </svg>
  `,
  styles: `:host { display: inline-flex; flex: none; line-height: 0; }`,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(24);
}
