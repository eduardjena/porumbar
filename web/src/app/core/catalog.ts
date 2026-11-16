import { Injectable, inject, signal } from '@angular/core';
import { Api } from './api';
import { Catalog, CodeLabel, PigeonSummary } from './models';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly api = inject(Api);
  readonly catalog = signal<Catalog | null>(null);
  private loading: Promise<void> | null = null;

  load(): Promise<void> {
    this.loading ??= this.api.get<Catalog>('/catalog').then((c) => this.catalog.set(c));
    return this.loading;
  }

  label(list: keyof Catalog, code: string | null | undefined): string {
    if (!code) return '';
    return (this.catalog()?.[list] as CodeLabel[] | undefined)?.find((x) => x.code === code)?.label ?? code;
  }
}

export const sexLabel = (s: string | null | undefined) => (s === 'M' ? 'Mascul' : s === 'F' ? 'Femelă' : 'Sex necunoscut');
export const sexShort = (s: string | null | undefined) => (s === 'M' ? 'M' : s === 'F' ? 'F' : '?');
export const ringText = (p: PigeonSummary | null | undefined) => p?.ring?.display ?? 'Fără inel';
/** Consangvinizarea ca procent românesc: 0.125 → „12,5%”, 0.0625 → „6,25%”. */
export const percent = (x: number) => `${(Math.round(x * 10000) / 100).toLocaleString('ro-RO')}%`;
