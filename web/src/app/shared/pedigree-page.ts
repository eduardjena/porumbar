import { Component, DestroyRef, ElementRef, computed, effect, inject, input, signal, viewChild } from '@angular/core';
import { PedigreeV1 } from '../core/models';
import { PedigreeSheet, colorOf, sheetHasTm } from './pedigree-sheet';
import { currentLang, glueIn, localeOf, tIn } from '../core/i18n';
import { QrCode } from './qr-code';

/*
 * Foaia de pedigree A4 vertical, ca fișele pe hârtie: 5 generații în căsuțe, strămoșii repetați colorați, jos datele
 * crescătorului și, dacă linkul public e pornit, codul QR. Aceeași foaie se tipărește (pagina de tipar) și se vede în fila
 * Pedigree a porumbelului. Pe ecranele înguste e micșorată întreagă (zoom), nu tăiată.
 */
@Component({
  selector: 'app-pedigree-page',
  imports: [PedigreeSheet, QrCode],
  // Foaia poate fi în altă limbă decât ecranul: limba ei alege fontul (styles.css) și ruperea rândurilor.
  host: { '[attr.lang]': 'L()' },
  template: `
    @let d = data();
    <!-- 186 × 272 mm de conținut (1 mm rezervă ca să nu treacă pe a doua pagină), cu 12 mm margine liberă pe fiecare latură. -->
    <div class="preview" #preview>
      <article class="page" [style.zoom]="zoom()">
        <header>
          <div class="title">
            <h1>{{ tx('fisa.titlu') }}{{ gl(' ') }}<span class="mono">{{ d.root.ring ?? tx('text.fara_inel') }}</span>@if (d.root.sex) { {{ tx(d.root.sex === 'M' ? 'sex.m' : 'sex.f') }} }</h1>
            <p>@if (d.root.name) { <strong>{{ gl('„') }}{{ d.root.name }}{{ gl('”') }}</strong> · }{{ facts() }}</p>
          </div>
          @if (url(); as u) {
            <div class="qr">
              <app-qr-code [url]="u" [size]="240" />
              <span>{{ tx('fisa.scaneaza') }}</span>
            </div>
          }
        </header>
        <div class="sheet-area"><app-pedigree-sheet [root]="d.root" [paper]="true" [lang]="L()" /></div>
        <footer>
          <!-- Ca pe fișele crescătorilor: jos în stânga numele (echipa), adresa, telefonul, emailul — ce e completat în Cont. -->
          @let o = owner();
          <div class="owner">
            <strong>{{ o.name }}</strong>
            @if (o.address) { <span class="addr">{{ o.address }}</span> }
            @if (o.phone) { <span>{{ tx('fisa.tel') }}{{ gl(' ') }}{{ o.phone }}</span> }
            @if (o.email) { <span>{{ o.email }}</span> }
          </div>
          <div class="stamp">
            <span>{{ tx('fisa.repetati') }}</span>
            <!-- Doar dacă foaia are „T+M”; un rând de 7 pt în coloana de jos, care rămâne sub cei 18 mm ai subsolului. -->
            @if (hasTm()) { <span>{{ tx('fisa.tm') }}</span> }
            <span class="made">{{ tx('fisa.tiparit_pe') }} {{ today() }} · <img src="/icon.svg" alt="" width="12" height="12" />Pigeonrama</span>
            <span class="site">www.pigeonrama.com</span>
          </div>
        </footer>
      </article>
    </div>
  `,
  styles: `
    :host { display: block; }
    .preview { padding-bottom: 12px; }
    .page {
      box-sizing: content-box; width: 186mm; height: 272mm; padding: 12mm; margin: 0 auto; background: #fff; color: #263343;
      line-height: 1.5; /* la fel în orice limbă (ecranul japonez are rânduri mai înalte), ca foaia să rămână pe o pagină */
      display: flex; flex-direction: column; gap: 3mm; border: 1px solid var(--border); box-shadow: var(--shadow);
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    header { flex: none; display: flex; justify-content: space-between; align-items: flex-start; gap: 6mm; height: 24mm; }
    .title h1 { margin: 0; font-size: 15pt; letter-spacing: 0.01em; }
    .title h1 .mono { font-size: 1em; }
    .title p { margin: 1.5mm 0 0; font-size: 10pt; }
    .qr { flex: none; display: flex; flex-direction: column; align-items: center; gap: 0.8mm; width: 24mm; font-size: 5.5pt; text-align: center; line-height: 1.15; }
    .qr app-qr-code { width: 22mm; }
    .sheet-area { flex: 1; min-height: 0; }
    footer { flex: none; display: flex; justify-content: space-between; align-items: flex-end; gap: 6mm; min-height: 18mm; border-top: 0.3mm solid #8a929c; padding-top: 1.5mm; }
    .owner { display: flex; flex-direction: column; font-size: 9.5pt; line-height: 1.3; }
    .owner strong { font-size: 12pt; }
    /* Adresa pe rândurile scrise în Cont (strada / localitatea), cel mult 3. */
    .owner .addr { white-space: pre-line; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
    .stamp { display: flex; flex-direction: column; align-items: flex-end; font-size: 7pt; color: #55606f; }
    .stamp .made { display: inline-flex; align-items: center; gap: 0.8mm; }
    .stamp .made img { width: 3.6mm; height: 3.6mm; }
    .stamp .site { font-weight: 700; color: #263343; }
    @media print {
      @page { size: A4 portrait; margin: 0; }
      .preview { overflow: visible; padding: 0; }
      /* Marginea de 12 mm e în foaie (padding), nu lăsată la imprimantă: arată la fel pe orice imprimantă. */
      .page { zoom: 1 !important; border: 0; box-shadow: none; margin: 0; break-inside: avoid; page-break-after: avoid; }
    }
  `,
})
export class PedigreePage {
  readonly data = input.required<PedigreeV1>();
  /** Linkul public (codul QR de pe foaie); fără link, foaia nu are cod. */
  readonly url = input<string | null>(null);
  /** Cât se micșorează foaia pe ecran ca să încapă pe lățime (1 = mărime reală, 210 mm). */
  readonly zoom = signal(1);
  private readonly preview = viewChild<ElementRef<HTMLElement>>('preview');
  /** Limba foii (implicit limba ecranului); dicționarul ei trebuie adus înainte (ensureLang). */
  readonly lang = input<string | null>(null);
  protected readonly L = () => this.lang() ?? currentLang();
  protected tx(key: string) {
    return tIn(this.L(), key);
  }
  /** Semnul lipit, în limba foii. */
  protected gl(text: string) {
    return glueIn(this.L(), text);
  }
  protected readonly today = () => new Date().toLocaleDateString(localeOf(this.L()));
  /** Foaia (5 generații) are strămoși „T+M”? Atunci jos se explică semnul. */
  protected readonly hasTm = computed(() => sheetHasTm(this.data().root));

  /** Datele crescătorului de jos: cum le dă serverul (numele de pe fișă pus de vânzător + ce a bifat omul pentru fișă). */
  protected owner() {
    return this.data().owner;
  }

  /** Rândul de sub titlu: sexul, anul, culoarea, crescătorul (ce se știe). */
  protected facts() {
    const r = this.data().root;
    const sex = r.sex === 'M' ? this.tx('sex.mascul') : r.sex === 'F' ? this.tx('sex.femela') : '';
    const color = colorOf(r, this.L());
    return [sex, r.year ? String(r.year) : '', color, r.breeder ?? ''].filter(Boolean).join(' · ');
  }

  constructor() {
    // Foaia are 210 mm (≈ 794 px); pe ecranele mai înguste o micșorăm toată, ca să se vadă pagina verticală întreagă.
    let observer: ResizeObserver | undefined;
    effect(() => {
      const el = this.preview()?.nativeElement;
      observer?.disconnect();
      if (!el) return;
      const fit = () => this.zoom.set(Math.min(1, el.clientWidth / ((210 / 25.4) * 96 + 2)));
      observer = new ResizeObserver(fit);
      observer.observe(el);
      fit();
    });
    inject(DestroyRef).onDestroy(() => observer?.disconnect());
  }
}
