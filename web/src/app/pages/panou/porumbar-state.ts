import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Api, errorMessage } from '../../core/api';
import { CatalogService } from '../../core/catalog';
import { t } from '../../core/i18n';
import { BoardPigeon, RaceResult, Ring } from '../../core/models';
import { ViewState, buildGroups, countLine, loadView, saveView, showsResults } from './panou-view';

/** Un rezultat din lista tuturor, cu porumbelul lui (fila Rezultate). */
export type ResultRow = RaceResult & { pigeon: { id: number; name: string | null; sex: 'M' | 'F' | null; ring: Ring | null } };

/*
 * Ce au în comun filele Grilă / Listă / Rezultate (cadrul lor, porumbar-cadru.ts): porumbeii panoului, încărcați o
 * singură dată cât stai pe aceste file, și alegerea din bară (căutare, ordonare, grupare, filtre), ținută minte pe
 * telefon. Trecerea de la o filă la alta nu mai încarcă nimic din nou și nu redesenează antetul și bara.
 */
@Injectable({ providedIn: 'root' })
export class PorumbarState {
  private readonly api = inject(Api);
  private readonly catalog = inject(CatalogService);

  readonly all = signal<BoardPigeon[]>([]);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly view = signal<ViewState>(loadView());
  /** Rezultatele tuturor porumbeilor (fila Rezultate), încărcate prima dată când e deschisă. */
  readonly results = signal<ResultRow[]>([]);
  readonly resultsLoaded = signal(false);
  /** Câte rezultate se văd pe fila Rezultate (după filtre), pentru rândul de sub titlu. */
  readonly resultsShown = signal(0);

  readonly groups = computed(() => buildGroups(this.all(), this.view(), this.catalog.catalog()));
  readonly shownCount = computed(() => this.groups().reduce((n, g) => n + g.items.length, 0));
  readonly years = computed(() => [...new Set(this.all().map((p) => p.year).filter((y): y is number => !!y))].sort((a, b) => b - a));
  readonly resultsMode = computed(() => showsResults(this.view()));
  readonly countLine = computed(() => countLine(this.all().length, this.shownCount(), this.view()));
  readonly byId = computed(() => new Map(this.all().map((p) => [p.id, p])));

  constructor() {
    effect(() => saveView(this.view()));
  }

  /** La intrarea în cadru: porumbeii proaspeți (puteau fi schimbați între timp pe altă pagină). */
  async load() {
    this.catalog.load();
    this.resultsLoaded.set(false);
    try {
      this.all.set((await this.api.get<{ pigeons: BoardPigeon[] }>('/board')).pigeons);
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loaded.set(true);
    }
  }

  async loadResults() {
    if (this.resultsLoaded()) return;
    try {
      this.results.set((await this.api.get<{ results: ResultRow[] }>('/results')).results);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.resultsLoaded.set(true);
    }
  }

  /** Rândul de sub titlu pe fila Rezultate. */
  resultsLine() {
    const total = this.results().length;
    const shown = this.resultsShown();
    return shown === total ? t('toate.numar', { count: total }) : `${t('toate.numar', { count: total })} · ${t('toate.numar_afisate', { count: shown })}`;
  }
}
