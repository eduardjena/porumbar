import { Injectable, inject, signal } from '@angular/core';
import { Api } from './api';
import { Catalog, CodeLabel, PigeonSummary } from './models';
import { formatNumber, t } from './i18n';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(Api);
  readonly catalog = signal<Catalog | null>(null);
  private loading: Promise<void> | null = null;

  load(): Promise<void> {
    this.loading ??= this.api.get<Catalog>('/catalog').then((c) => this.catalog.set(c));
    return this.loading;
  }

  /** Din nou, de exemplu după schimbarea limbii (etichetele vin traduse de la server). */
  reload(): Promise<void> {
    this.loading = null;
    return this.load();
  }

  label(list: keyof Catalog, code: string | null | undefined): string {
    if (!code) return '';
    return (this.catalog()?.[list] as CodeLabel[] | undefined)?.find((x) => x.code === code)?.label ?? code;
  }
}

export const sexLabel = (s: string | null | undefined) => t(s === 'M' ? 'sex.mascul' : s === 'F' ? 'sex.femela' : 'sex.necunoscut');
/** Litera sexului: M / F în română, H / T în maghiară (hím / tojó). */
export const sexShort = (s: string | null | undefined) => (s === 'M' ? t('sex.m') : s === 'F' ? t('sex.f') : '?');
export const ringText = (p: PigeonSummary | null | undefined) => p?.ring?.display ?? t('text.fara_inel_mare');
/** Consangvinizarea ca procent, după limbă: 0.125 → „12,5%”, 0.0625 → „6,25%”. */
export const percent = (x: number) => `${formatNumber(Math.round(x * 10000) / 100)}%`;
