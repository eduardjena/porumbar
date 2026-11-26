import { ApplicationRef, EnvironmentInjector, Injectable, createComponent, inject, signal } from '@angular/core';
import { LANGS, currentLang, ensureLang, t } from './i18n';
import { Api } from './api';
import { AuthService } from './auth';
import { ConfirmService } from './confirm';
import { PedigreeV1 } from './models';
import { PDF_TIMEOUT_MS, withTimeout } from './within';
import { loadJapaneseFont } from './font-ja';
import { loadSheetFonts, sheetFontCss } from './sheet-fonts';
import { allowedSheetLang } from './sheet-langs';
import { PedigreePage } from '../shared/pedigree-page';

export type ShareOutcome = 'shared' | 'cancelled' | 'downloaded';

/*
 * „Trimite” fișa de pedigree ca PDF (WhatsApp, mail, Messenger…), din browser, fără aplicație de telefon.
 * Fișa e aceeași ca la tipar: o desenăm în afara ecranului la mărimea reală (A4), o facem poză la rezoluție mare și o punem
 * într-un PDF A4. Apoi o dăm meniului de partajare al telefonului (Web Share); unde browserul nu poate trimite fișiere
 * (de ex. Firefox pe calculator), PDF-ul se descarcă. Bibliotecile se încarcă doar la prima apăsare.
 */
/** Limba aleasă pentru fișă (pe pagina de tipărire); `null` = limba ecranului. Se citește prin `allowedSheetLang`. */
export const sheetLang = signal<string | null>(null);

@Injectable({ providedIn: 'root' })
export class SharePdfService {
  private readonly api = inject(Api);
  private readonly appRef = inject(ApplicationRef);
  private readonly env = inject(EnvironmentInjector);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  /** Id-ul porumbelului a cărui fișă se pregătește acum (butoanele arată „Se pregătește…”). */
  readonly busy = signal<number | null>(null);

  async sharePigeon(id: number): Promise<ShareOutcome> {
    this.busy.set(id);
    let file: File;
    try {
      // O rețea blocată nu ține butonul în „Se pregătește…” la nesfârșit: după 30 s, eroare și butonul revine.
      file = await withTimeout(
        (async () => {
          const [data, link] = await Promise.all([
            this.api.get<PedigreeV1>(`/pigeons/${id}/pedigree`),
            this.api.get<{ url: string | null }>(`/pigeons/${id}/public`),
          ]);
          return this.makePdf(data, link.url);
        })(),
        PDF_TIMEOUT_MS,
        () => new Error(t('pdf.prea_lent')),
      );
    } finally {
      this.busy.set(null);
    }
    return this.share(file);
  }

  /** Fișa A4 ca PDF (o pagină, imagine la ~280 dpi). */
  async makePdf(data: PedigreeV1, url: string | null): Promise<File> {
    const lang = allowedSheetLang(sheetLang(), LANGS, this.auth.account()?.lang, currentLang());
    await ensureLang(lang).catch(() => undefined);
    if (lang === 'ja') await loadJapaneseFont();
    const [{ toCanvas }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
    // Lățimea locului: mai mare decât foaia (210 mm ≈ 794 px), ca foaia să nu fie micșorată.
    const host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText = 'position:fixed;left:-20000px;top:0;width:840px;pointer-events:none;';
    document.body.appendChild(host);
    const el = host.appendChild(document.createElement('app-pedigree-page'));
    const ref = createComponent(PedigreePage, { environmentInjector: this.env, hostElement: el });
    try {
      ref.setInput('data', data);
      ref.setInput('url', url);
      ref.setInput('lang', lang);
      this.appRef.attachView(ref.hostView);
      ref.changeDetectorRef.detectChanges();
      const page = host.querySelector<HTMLElement>('article.page')!;
      await loadSheetFonts(page);
      // Codul QR se desenează după ce se încarcă biblioteca lui; așteptăm să fie gata.
      for (let i = 0; i < 40; i++) {
        const qr = host.querySelector('canvas');
        if (!url || (qr && qr.width > 0)) break;
        await new Promise((r) => setTimeout(r, 50));
      }
      await new Promise((r) => setTimeout(r, 50));
      const canvas = await toCanvas(page, {
        pixelRatio: 3,
        fontEmbedCSS: await sheetFontCss(page),
        backgroundColor: '#ffffff',
        // Pe foaia trimisă: fără chenarul și umbra de pe ecran.
        style: { border: '0', boxShadow: 'none', margin: '0', zoom: '1' },
      });
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
      pdf.setProperties({ title: `Pedigree ${data.root.ring ?? ''}`.trim(), creator: 'Pigeonrama (www.pigeonrama.com)' });
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297);
      const name = `pedigree-${(data.root.ring ?? 'porumbel').replace(/[^A-Za-z0-9-]+/g, '-')}.pdf`;
      return new File([pdf.output('blob')], name, { type: 'application/pdf' });
    } finally {
      this.appRef.detachView(ref.hostView);
      ref.destroy();
      host.remove();
    }
  }

  /** Meniul de partajare al telefonului; dacă nu se poate trimite un fișier, PDF-ul se descarcă. */
  async share(file: File): Promise<ShareOutcome> {
    const data: ShareData = { files: [file], title: file.name };
    if (!navigator.canShare?.(data)) {
      download(file);
      return 'downloaded';
    }
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      const name = (e as DOMException)?.name;
      if (name === 'AbortError') return 'cancelled';
      if (name !== 'NotAllowedError') throw e;
    }
    // Pregătirea a durat și browserul nu mai consideră apăsarea „proaspătă”: încă o apăsare, pe fișa gata.
    const ok = await this.confirm.ask({
      title: t('pdf.gata'),
      lines: [t('pdf.gata_rand', { fisier: file.name })],
      confirmLabel: t('pdf.trimite'),
    });
    if (!ok) return 'cancelled';
    try {
      await navigator.share(data);
      return 'shared';
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return 'cancelled';
      download(file);
      return 'downloaded';
    }
  }
}

function download(file: File) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
}
