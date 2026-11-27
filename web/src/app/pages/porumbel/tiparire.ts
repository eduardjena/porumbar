import { Component, ElementRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService } from '../../core/confirm';
import { PedigreeV1 } from '../../core/models';
import { Icon } from '../../shared/icon';
import { PedigreePage } from '../../shared/pedigree-page';
import { ShareButton } from '../../shared/share-button';
import { LANGS, TPipe, currentLang, ensureLang, t } from '../../core/i18n';
import { AuthService } from '../../core/auth';
import { sheetLang } from '../../core/share-pdf';
import { allowedSheetLang, sheetLangs } from '../../core/sheet-langs';
import { loadJapaneseFont } from '../../core/font-ja';
import { loadSheetFonts } from '../../core/sheet-fonts';
import { within } from '../../core/within';
import { parseIds } from '../../shared/fise-toate';
import { TrialPigeon } from '../../core/trial-pigeon';

interface Sheet { id: number; pedigree: PedigreeV1; url: string | null }

/*
 * Pedigree-ul tipărit (A4 vertical, ca fișele de pedigree pe hârtie): 5 generații în căsuțe, strămoșii repetați colorați, jos datele
 * crescătorului alese de el și codul QR al linkului public (care duce la tot pedigree-ul, cu textele întregi).
 * „Tipărește / Salvează PDF” deschide fereastra de tipărire a browserului (de acolo se alege și PDF).
 */
@Component({
  selector: 'app-tiparire',
  imports: [RouterLink, Icon, PedigreePage, ShareButton, TPipe],
  template: `
    <div class="bar no-print">
      @if (single()) {
        <a class="btn" [routerLink]="['/porumbei', id()]" [queryParams]="{ fila: inapoi() === 'arbore' ? 'arbore' : 'qr' }"><app-icon name="inapoi" />{{ 'tiparire.inapoi' | t }}</a>
        @if (!url() && data()) {
          <button type="button" (click)="startLink()"><app-icon name="qr" />{{ 'tiparire.pune_qr' | t }}</button>
        }
      } @else {
        <a class="btn" [routerLink]="inapoi() === 'porumbar' ? '/porumbar' : '/panou'"><app-icon name="inapoi" />{{ 'tiparire.inapoi_porumbei' | t }}</a>
        @if (sheets().length) { <strong class="count">{{ 'tiparire.fise_numar' | t: { count: sheets().length } }}</strong> }
      }
      @if ((single() && data()) || sheets().length) {
        <button type="button" class="primary" [disabled]="preparing()" (click)="print()"><app-icon name="tipar" />{{ 'tiparire.tipareste_pdf' | t }}</button>
      }
      @if (single() && data()) { <app-share-button [pigeonId]="+id()!" /> }
      @if (langChoices().length > 1) {
        <label class="lang">{{ 'tiparire.limba_fisei' | t }}
          <select [value]="lang()" (change)="pickLang($any($event.target).value)">
            @for (l of langChoices(); track l.code) { <option [value]="l.code" [selected]="l.code === lang()">{{ l.name }}</option> }
          </select>
        </label>
      }
    </div>
    @if (!single() && withoutQr().length) {
      <div class="noqr no-print">
        <span>{{ 'tiparire.fara_qr' | t: { count: withoutQr().length } }}</span>
        <button type="button" (click)="startLinks()"><app-icon name="qr" />{{ 'tiparire.pune_qr_toate' | t }}</button>
      </div>
    }
    @if (error()) { <div class="error no-print" role="alert"><app-icon name="alerta" />{{ error() }}</div> }

    @if (single()) {
      @if (data(); as d) {
        <app-pedigree-page [data]="d" [url]="url()" [lang]="lang()" />
      } @else if (!error()) {
        <p class="muted">{{ 'tiparire.se_pregateste' | t }}</p>
      }
    } @else if (!loaded() && !error()) {
      <p class="muted">{{ 'tiparire.se_pregatesc' | t: { count: wanted().length } }}</p>
    } @else if (loaded() && !sheets().length && !error()) {
      <p class="muted">{{ 'tiparire.nicio_fisa' | t }}</p>
    } @else {
      @for (sh of sheets(); track sh.id) {
        <app-pedigree-page [data]="sh.pedigree" [url]="sh.url" [lang]="lang()" />
      }
    }
  `,
  styles: `
    .bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; align-items: center; }
    .lang { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    .lang select { min-height: 48px; }
    .count { font-size: 1.1rem; }
    .noqr { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; margin-bottom: 16px; }
    @media print {
      :host { display: block; }
      .no-print { display: none !important; }
      app-pedigree-page + app-pedigree-page { display: block; break-before: page; page-break-before: always; }
    }
  `,
})
export default class Tiparire {
  private readonly api = inject(Api);
  private readonly confirm = inject(ConfirmService);
  private readonly trial = inject(TrialPigeon);
  private readonly router = inject(Router);
  /** Fără `id` (ruta /porumbei/tiparire?ids=…) se tipăresc mai multe fișe, câte una pe pagină. */
  readonly id = input<string>();
  readonly ids = input<string>();
  /** De unde s-a venit (?inapoi=arbore din fila Pedigree, ?inapoi=porumbar la mai multe fișe), ca „Înapoi” să ducă tot acolo. */
  readonly inapoi = input<string>();
  protected readonly single = computed(() => !!this.id());
  protected readonly wanted = computed(() => parseIds(this.ids()));
  readonly sheets = signal<Sheet[]>([]);
  protected readonly withoutQr = computed(() => this.sheets().filter((s) => !s.url));
  readonly data = signal<PedigreeV1 | null>(null);
  readonly url = signal<string | null>(null);
  readonly loaded = signal(false);
  readonly error = signal('');
  private readonly auth = inject(AuthService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly langChoices = computed(() => sheetLangs(LANGS, this.auth.account()?.lang));
  /** Limba fișei: cea aleasă aici (ține și pentru PDF-ul de la „Trimite”), altfel limba ecranului. */
  protected readonly lang = computed(() => allowedSheetLang(sheetLang(), LANGS, this.auth.account()?.lang, currentLang()));
  /** Se așteaptă literele japoneze înainte de tipar. */
  protected readonly preparing = signal(false);

  async pickLang(code: string) {
    await ensureLang(code).catch(() => undefined);
    sheetLang.set(code);
  }

  constructor() {
    effect(() => {
      const id = this.id();
      const wanted = this.wanted();
      untracked(() => (id ? this.load(id) : this.loadMany(wanted)));
    });
  }

  private async load(id: string) {
    try {
      // În probă: întâi alegerea porumbelului (cine renunță se întoarce la porumbel).
      if (!(await this.trial.ensureChosen(+id))) {
        await this.router.navigate(['/porumbei', id]);
        return;
      }
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

  private async loadMany(wanted: number[]) {
    this.loaded.set(false);
    this.error.set('');
    try {
      if (wanted.length) this.sheets.set((await this.api.get<{ sheets: Sheet[] }>(`/sheets?ids=${wanted.join(',')}`)).sheets);
      else this.sheets.set([]);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loaded.set(true);
    }
  }

  async startLinks() {
    const missing = this.withoutQr();
    const ok = await this.confirm.ask({
      title: t('partajare.porniti_titlu'),
      lines: [t('tiparire.porniti_rand'), t('tiparire.porniti_toate_rand', { count: missing.length })],
      confirmLabel: t('partajare.porniti_da'),
    });
    if (!ok) return;
    try {
      const res = await this.api.post<{ sheets: { id: number; url: string }[] }>('/sheets/public', { ids: missing.map((s) => s.id) });
      const urls = new Map(res.sheets.map((s) => [s.id, s.url]));
      this.sheets.update((list) => list.map((s) => (urls.has(s.id) ? { ...s, url: urls.get(s.id)! } : s)));
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async startLink() {
    const ok = await this.confirm.ask({
      title: t('partajare.porniti_titlu'),
      lines: [t('tiparire.porniti_rand')],
      confirmLabel: t('partajare.porniti_da'),
    });
    if (!ok) return;
    try {
      this.url.set((await this.api.post<{ url: string }>(`/pigeons/${this.id()}/public`)).url);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  /**
   * În japoneză așteptăm întâi literele foilor (de obicei sunt deja pe ecran, deci nu se simte), dar cel mult 3 secunde:
   * fără rețea se tipărește cu fontul sistemului. Celelalte limbi: imediat, direct din apăsare.
   */
  print() {
    if (this.lang() !== 'ja') return window.print();
    if (this.preparing()) return;
    this.preparing.set(true);
    const el = this.host.nativeElement;
    void within(loadJapaneseFont().then(() => loadSheetFonts(el)), 3000).then(() => {
      this.preparing.set(false);
      // Omul poate să fi plecat între timp de pe pagină.
      if (el.isConnected) window.print();
    });
  }
}
