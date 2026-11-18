import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService } from '../../core/confirm';
import { PedigreeV1 } from '../../core/models';
import { Icon } from '../../shared/icon';
import { PedigreePage } from '../../shared/pedigree-page';
import { ShareButton } from '../../shared/share-button';
import { LANGS, TPipe, currentLang, ensureLang, t } from '../../core/i18n';
import { AuthService } from '../../core/auth';
import { sheetLang } from '../../core/share-pdf';

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
      <a class="btn" [routerLink]="['/porumbei', id()]" [queryParams]="{ fila: inapoi() === 'arbore' ? 'arbore' : 'qr' }"><app-icon name="inapoi" />{{ 'tiparire.inapoi' | t }}</a>
      @if (!url() && loaded()) {
        <button type="button" (click)="startLink()"><app-icon name="qr" />{{ 'tiparire.pune_qr' | t }}</button>
      }
      <button type="button" class="primary" (click)="print()"><app-icon name="tipar" />{{ 'tiparire.tipareste_pdf' | t }}</button>
      <app-share-button [pigeonId]="+id()" />
      @if (langChoices().length > 1) {
        <label class="lang">{{ 'tiparire.limba_fisei' | t }}
          <select [value]="lang()" (change)="pickLang($any($event.target).value)">
            @for (l of langChoices(); track l.code) { <option [value]="l.code" [selected]="l.code === lang()">{{ l.name }}</option> }
          </select>
        </label>
      }
    </div>
    @if (error()) { <div class="error no-print" role="alert"><app-icon name="alerta" />{{ error() }}</div> }

    @if (data(); as d) {
      <app-pedigree-page [data]="d" [url]="url()" [lang]="lang()" />
    } @else if (!error()) {
      <p class="muted">{{ 'tiparire.se_pregateste' | t }}</p>
    }
  `,
  styles: `
    .bar { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; align-items: center; }
    .lang { display: flex; align-items: center; gap: 8px; font-weight: 600; }
    .lang select { min-height: 48px; }
    @media print {
      :host { display: block; }
      .no-print { display: none !important; }
    }
  `,
})
export default class Tiparire {
  private readonly api = inject(Api);
  private readonly confirm = inject(ConfirmService);
  readonly id = input.required<string>();
  /** De unde s-a venit (?inapoi=arbore din fila Pedigree), ca „Înapoi” să ducă tot acolo; altfel la fila QR. */
  readonly inapoi = input<string>();
  readonly data = signal<PedigreeV1 | null>(null);
  readonly url = signal<string | null>(null);
  readonly loaded = signal(false);
  readonly error = signal('');
  private readonly auth = inject(AuthService);
  /** Limbile fișei: româna, limbile publice și limba contului (una „în probă” doar la cine o are). */
  protected readonly langChoices = computed(() => {
    const mine = this.auth.account()?.lang;
    return LANGS.filter((l) => l.code === 'ro' || l.public || l.code === mine);
  });
  /** Limba fișei: cea aleasă aici (ține și pentru PDF-ul de la „Trimite”), altfel limba ecranului. */
  protected readonly lang = computed(() => {
    const chosen = sheetLang();
    return chosen && this.langChoices().some((l) => l.code === chosen) ? chosen : currentLang();
  });

  async pickLang(code: string) {
    await ensureLang(code).catch(() => undefined);
    sheetLang.set(code);
  }

  constructor() {
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
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

  print() {
    window.print();
  }
}
