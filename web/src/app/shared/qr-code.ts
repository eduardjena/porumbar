import { Component, ElementRef, effect, input, viewChild } from '@angular/core';

/** Codul QR al unei adrese, desenat în browser (biblioteca se încarcă doar unde e nevoie de QR). */
@Component({
  selector: 'app-qr-code',
  template: `<canvas #c role="img" [attr.aria-label]="'Cod QR pentru ' + url()"></canvas>`,
  styles: `:host { display: inline-block; line-height: 0; max-width: 100%; } canvas { width: 100%; height: auto; image-rendering: pixelated; }`,
})
export class QrCode {
  readonly url = input.required<string>();
  readonly size = input(320);
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('c');

  constructor() {
    effect(async () => {
      const url = this.url();
      const size = this.size();
      const el = this.canvas().nativeElement;
      const QRCode = (await import('qrcode')).default;
      await QRCode.toCanvas(el, url, { width: size, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2b2117', light: '#ffffff' } });
      // Biblioteca pune lățimea în stil; mărimea pe ecran o dă locul în care stă codul (CSS-ul de mai jos).
      el.style.removeProperty('width');
      el.style.removeProperty('height');
    });
  }
}
