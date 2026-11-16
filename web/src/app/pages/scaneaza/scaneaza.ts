import { Component, DestroyRef, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import jsQR from 'jsqr';
import { Icon } from '../../shared/icon';

/** Tokenul din linkul public al unui pedigree Porumbar („…/p/<token>”), sau null dacă codul e altceva. */
export function pedigreeToken(text: string): string | null {
  let url: URL;
  try {
    url = new URL(text.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  return /^\/p\/([A-Za-z0-9_-]{16,64})\/?$/.exec(url.pathname)?.[1] ?? null;
}

// Cititorul de coduri al browserului (Chrome pe Android); unde lipsește (iPhone), citim cu jsQR din imagine.
interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
declare const BarcodeDetector: { new (o: { formats: string[] }): Detector } | undefined;

/*
 * Scanarea codului QR de pe pedigree-ul altui crescător cu Porumbar, din aplicație: cu camera sau dintr-o poză.
 * Codul duce la pagina publică a porumbelului, unde e „Preia în porumbarul meu”. Codurile altor programe nu se deschid
 * (nici ca linkuri): pentru ele e „Importă pedigree”.
 */
@Component({
  selector: 'app-scaneaza',
  imports: [RouterLink, Icon],
  template: `
    <h1>Scanează codul QR</h1>
    <p class="lead">Ține telefonul deasupra codului QR de pe pedigree-ul altui crescător care folosește Porumbar. Se deschide pedigree-ul, iar de acolo îl poți prelua.</p>

    @if (live()) {
      <div class="cam">
        <video #video playsinline muted></video>
        <div class="frame" aria-hidden="true"></div>
      </div>
      <p class="muted center">Caut codul… Ține telefonul nemișcat, cu codul în pătrat.</p>
      <button type="button" class="wide" (click)="stop()"><app-icon name="inchide" />Oprește camera</button>
    } @else {
      <div class="stack">
        <button type="button" class="primary big" (click)="start()" [disabled]="busy()"><app-icon name="qr" [size]="30" />Pornește camera</button>
        <label class="btn big file">
          <app-icon name="poze" [size]="30" />Fă o poză codului (sau alege una)
          <input type="file" accept="image/*" capture="environment" (change)="fromPhoto($event)" />
        </label>
      </div>
    }

    @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
    @if (other(); as text) {
      <div class="notice stack" role="status">
        <strong>Acest cod nu e al unui pedigree din Porumbar.</strong>
        <span>În cod scrie: <span class="mono code">{{ text }}</span></span>
        <span>Pedigree-urile din alte programe (sau de pe hârtie) le treci cu „Importă pedigree”: dintr-o poză le citește programul.</span>
        <a class="btn" routerLink="/porumbei/pedigree"><app-icon name="fisa" />Importă pedigree</a>
      </div>
    }
    <canvas #canvas hidden></canvas>
  `,
  styles: `
    .lead { font-size: 1.05rem; }
    .big { min-height: 64px; font-size: 1.1rem; width: 100%; justify-content: center; }
    .file { position: relative; cursor: pointer; }
    .file input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .cam { position: relative; border-radius: 18px; overflow: hidden; background: #000; max-width: 520px; margin: 0 auto 10px; aspect-ratio: 3 / 4; }
    video { width: 100%; height: 100%; object-fit: cover; display: block; }
    .frame { position: absolute; inset: 18%; border: 4px solid #fff; border-radius: 16px; box-shadow: 0 0 0 999px rgb(0 0 0 / 35%); }
    .center { text-align: center; }
    .wide { width: 100%; justify-content: center; }
    .error, .notice { margin-top: 16px; }
    .code { word-break: break-all; }
  `,
})
export default class Scaneaza {
  private readonly router = inject(Router);
  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  readonly live = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly other = signal<string | null>(null);
  private stream: MediaStream | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private readonly detector: Detector | null = typeof BarcodeDetector === 'undefined' ? null : new BarcodeDetector({ formats: ['qr_code'] });

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  async start() {
    this.error.set('');
    this.other.set(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error.set('Browserul acesta nu poate folosi camera aici. Folosește „Fă o poză codului”.');
      return;
    }
    this.busy.set(true);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      this.live.set(true);
      await new Promise((r) => setTimeout(r)); // să apară elementul video
      const v = this.video()?.nativeElement;
      if (!v) return this.stop();
      v.srcObject = this.stream;
      await v.play();
      this.tick();
    } catch (e) {
      this.stop();
      const name = (e as DOMException)?.name;
      this.error.set(
        name === 'NotAllowedError'
          ? 'Nu ai dat voie programului să folosească camera. Poți da voie din setările browserului, sau folosește „Fă o poză codului”.'
          : name === 'NotFoundError'
            ? 'Nu am găsit nicio cameră. Folosește „Fă o poză codului”.'
            : 'Camera nu a pornit. Încearcă din nou, sau folosește „Fă o poză codului”.',
      );
    } finally {
      this.busy.set(false);
    }
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.live.set(false);
  }

  /** Câte o încercare la 250 ms, cât timp camera merge. */
  private tick() {
    this.timer = setTimeout(async () => {
      const v = this.video()?.nativeElement;
      if (!this.stream || !v) return;
      if (v.readyState >= 2) {
        const text = await this.read(v, v.videoWidth, v.videoHeight);
        if (text) return this.found(text);
      }
      this.tick();
    }, 250);
  }

  async fromPhoto(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.stop();
    this.error.set('');
    this.other.set(null);
    try {
      const img = await createImageBitmap(file);
      const text = await this.read(img, img.width, img.height);
      img.close();
      if (text) this.found(text);
      else this.error.set('Nu am găsit niciun cod QR în poză. Fă poza mai de aproape, cu codul întreg și clar.');
    } catch {
      this.error.set('Nu am putut deschide poza. Încearcă altă poză.');
    }
  }

  /** Textul codului QR din imagine (cititorul browserului, altfel jsQR pe o copie micșorată). */
  private async read(source: CanvasImageSource, width: number, height: number): Promise<string | null> {
    if (this.detector) {
      try {
        const codes = await this.detector.detect(source);
        if (codes.length) return codes[0].rawValue;
        return null;
      } catch {
        // cade pe jsQR
      }
    }
    const scale = Math.min(1, 1000 / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const c = this.canvas().nativeElement;
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, w, h);
    return jsQR(ctx.getImageData(0, 0, w, h).data, w, h)?.data ?? null;
  }

  private found(text: string) {
    this.stop();
    const token = pedigreeToken(text);
    if (token) this.router.navigate(['/p', token]);
    else this.other.set(text.slice(0, 300));
  }
}
