import { Component, DestroyRef, ElementRef, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService } from '../../core/confirm';
import { AuthService } from '../../core/auth';
import { PedigreeV1 } from '../../core/models';
import { Icon } from '../../shared/icon';
import { PedigreeSheet } from '../../shared/pedigree-sheet';
import { QrCode } from '../../shared/qr-code';

/*
 * Pedigree-ul tipărit (A4 vertical, ca fișele de pedigree pe hârtie): 5 generații în căsuțe, strămoșii repetați colorați, jos datele
 * crescătorului alese de el și codul QR al linkului public (care duce la tot pedigree-ul, cu textele întregi).
 * „Tipărește / Salvează PDF” deschide fereastra de tipărire a browserului (de acolo se alege și PDF).
 */
@Component({
  selector: 'app-tiparire',
  imports: [RouterLink, Icon, PedigreeSheet, QrCode],
  template: `
    <div class="bar no-print">
      <a class="btn" [routerLink]="['/porumbei', id()]" [queryParams]="{ fila: 'qr' }"><app-icon name="inapoi" />Înapoi la porumbel</a>
      @if (!url() && loaded()) {
        <button type="button" (click)="startLink()"><app-icon name="qr" />Pune și codul QR (pornește linkul)</button>
      }
      <button type="button" class="primary" (click)="print()"><app-icon name="tipar" />Tipărește / Salvează PDF</button>
    </div>
    @if (error()) { <div class="error no-print" role="alert"><app-icon name="alerta" />{{ error() }}</div> }

    @if (data(); as d) {
      <!-- Foaia A4 vertical: 186 × 272 mm de conținut (1 mm rezervă ca să nu treacă pe a doua pagină), cu 12 mm margine liberă pe fiecare latură (imprimanta nu tipărește până în margine). -->
      <div class="preview" #preview>
        <article class="page" [style.zoom]="zoom()">
          <header>
            <div class="title">
              <h1>Pedigree porumbel: <span class="mono">{{ d.root.ring ?? 'fără inel' }}</span>@if (d.root.sex) { {{ d.root.sex }} }</h1>
              <p>@if (d.root.name) { <strong>„{{ d.root.name }}”</strong> · }{{ facts(d) }}</p>
            </div>
            @if (url(); as u) {
              <div class="qr">
                <app-qr-code [url]="u" [size]="240" />
                <span>Scanează pentru pedigree-ul complet</span>
              </div>
            }
          </header>
          <div class="sheet-area"><app-pedigree-sheet [root]="d.root" [paper]="true" /></div>
          <footer>
            <!-- Ca pe fișele crescătorilor: jos în stânga numele (echipa), adresa, telefonul, emailul — ce e completat în Cont. -->
            @let o = owner(d);
            <div class="owner">
              <strong>{{ o.name }}</strong>
              @if (o.address) { <span class="addr">{{ o.address }}</span> }
              @if (o.phone) { <span>Tel.: {{ o.phone }}</span> }
              @if (o.email) { <span>{{ o.email }}</span> }
            </div>
            <div class="stamp">
              <span>Strămoșii colorați la fel apar de mai multe ori.</span>
              <span class="made">Tipărit pe {{ today }} · <img src="/icon.svg" alt="" width="12" height="12" />Porumbar</span>
              <span class="site">www.porumbar.ro</span>
            </div>
          </footer>
        </article>
      </div>
    } @else if (!error()) {
      <p class="muted">Se pregătește pedigree-ul…</p>
    }
  `,
  styles: `
    .bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    /* Pe ecran: aceeași foaie A4 verticală ca la tipar; pe ecrane înguste e micșorată întreagă (zoom), nu tăiată. */
    .preview { padding-bottom: 12px; }
    .page {
      box-sizing: content-box; width: 186mm; height: 272mm; padding: 12mm; margin: 0 auto; background: #fff; color: #2b2117;
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
    footer { flex: none; display: flex; justify-content: space-between; align-items: flex-end; gap: 6mm; min-height: 18mm; border-top: 0.3mm solid #8f8476; padding-top: 1.5mm; }
    .owner { display: flex; flex-direction: column; font-size: 9.5pt; line-height: 1.3; }
    .owner strong { font-size: 12pt; }
    /* Adresa pe rândurile scrise în Cont (strada / localitatea), cel mult 3. */
    .owner .addr { white-space: pre-line; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
    .stamp { display: flex; flex-direction: column; align-items: flex-end; font-size: 7pt; color: #6b5d4f; }
    .stamp .made { display: inline-flex; align-items: center; gap: 0.8mm; }
    .stamp .made img { width: 3.6mm; height: 3.6mm; }
    .stamp .site { font-weight: 700; color: #2b2117; }
    @media print {
      @page { size: A4 portrait; margin: 0; }
      :host { display: block; }
      .no-print { display: none !important; }
      .preview { overflow: visible; padding: 0; }
      /* Marginea de 12 mm e în foaie (padding), nu lăsată la imprimantă: arată la fel pe orice imprimantă. */
      .page { zoom: 1 !important; border: 0; box-shadow: none; margin: 0; break-inside: avoid; page-break-after: avoid; }
    }
  `,
})
export default class Tiparire {
  private readonly api = inject(Api);
  private readonly confirm = inject(ConfirmService);
  private readonly auth = inject(AuthService);
  readonly id = input.required<string>();
  readonly data = signal<PedigreeV1 | null>(null);
  readonly url = signal<string | null>(null);
  readonly loaded = signal(false);
  readonly error = signal('');
  /** Cât se micșorează foaia pe ecran ca să încapă pe lățime (1 = mărime reală, 210 mm). */
  readonly zoom = signal(1);
  private readonly preview = viewChild<ElementRef<HTMLElement>>('preview');
  protected readonly today = new Date().toLocaleDateString('ro-RO');
  /** Datele crescătorului de jos: tot ce a completat în Cont (foaia e a lui); fără cont încărcat, ce vine cu pedigree-ul. */
  protected owner(d: PedigreeV1) {
    const a = this.auth.account();
    if (!a) return d.owner;
    return { name: a.pedigreeName || a.name, address: a.address, phone: a.phone, email: a.email };
  }
  /** Rândul de sub titlu: sexul, anul, culoarea, crescătorul (ce se știe). */
  protected facts(d: PedigreeV1) {
    const r = d.root;
    const sex = r.sex === 'M' ? 'Mascul' : r.sex === 'F' ? 'Femelă' : '';
    const color = r.colorText || (r.colorLabel ? `${r.colorLabel}${r.colorPa ? ' p.a.' : ''}` : '');
    return [sex, r.year ? String(r.year) : '', color, r.breeder ?? ''].filter(Boolean).join(' · ');
  }

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
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

  private async load(id: string) {
    try {
      const [ped, link] = await Promise.all([
        this.api.get<PedigreeV1>(`/pigeons/${id}/pedigree`),
        this.api.get<{ url: string | null }>(`/pigeons/${id}/public`),
      ]);
      this.data.set(ped);
      this.url.set(link.url);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loaded.set(true);
    }
  }

  async startLink() {
    const ok = await this.confirm.ask({
      title: 'Pornești linkul public?',
      lines: ['Codul QR de pe foaie duce la pedigree-ul porumbelului. Oricine scanează codul îl vede (fără note și jurnal).'],
      confirmLabel: 'Da, pornește',
    });
    if (!ok) return;
    try {
      this.url.set((await this.api.post<{ url: string }>(`/pigeons/${this.id()}/public`)).url);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  print() {
    window.print();
  }
}
