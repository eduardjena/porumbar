import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { PedigreeV1 } from '../../core/models';
import { Icon } from '../../shared/icon';
import { PedigreePage } from '../../shared/pedigree-page';
import { Arbore } from './arbore';

type View = 'fisa' | 'arbore';
const KEY = 'porumbar.pedigreeView';

/*
 * Fila Pedigree a porumbelului. Implicit „Ca pe fișă”: aceeași foaie A4 verticală ca la tipar (5 generații, cu crescătorul,
 * rezultatele și textele de pedigree), ca omul să vadă exact ce iese pe hârtie. „Arbore”: arborele de lucru, unde se adaugă
 * părinții și se aleg câte generații se văd. Alegerea se ține minte pe telefon / calculator.
 */
@Component({
  selector: 'app-pedigree-fila',
  imports: [RouterLink, Icon, PedigreePage, Arbore],
  template: `
    <div class="bar">
      <div class="toggle" role="group" aria-label="Cum arăți pedigree-ul">
        <button type="button" [class.on]="view() === 'fisa'" [attr.aria-pressed]="view() === 'fisa'" (click)="setView('fisa')">
          <app-icon name="fisa" [size]="22" />Ca pe fișă
        </button>
        <button type="button" [class.on]="view() === 'arbore'" [attr.aria-pressed]="view() === 'arbore'" (click)="setView('arbore')">
          <app-icon name="copac" [size]="22" />Arbore
        </button>
      </div>
      @if (view() === 'fisa') {
        <a class="btn" [routerLink]="['/porumbei', pigeonId(), 'tiparire']"><app-icon name="tipar" />Tipărește</a>
      }
    </div>

    @if (view() === 'fisa') {
      @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
      @if (data(); as d) {
        <app-pedigree-page [data]="d" [url]="url()" />
        <p class="muted small">Așa arată foaia tipărită. Ca să adaugi părinți lipsă sau să vezi mai multe generații, apasă „Arbore”.</p>
      } @else if (!error()) {
        <p class="muted">Se pregătește pedigree-ul…</p>
      }
    } @else {
      <app-arbore [pigeonId]="pigeonId()" [version]="version()" (addParent)="addParent.emit($event)" />
    }
  `,
  styles: `
    .bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
    .toggle { display: inline-flex; padding: 4px; gap: 4px; background: var(--surface-2); border-radius: 999px; }
    .toggle button {
      display: inline-flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 18px; border-radius: 999px; border: 0;
      background: transparent; color: var(--muted); font-weight: 700; box-shadow: none;
    }
    .toggle button.on { background: var(--surface); color: var(--accent-strong); box-shadow: var(--shadow); }
    .small { font-size: 0.9rem; }
  `,
})
export class PedigreeFila {
  private readonly api = inject(Api);
  readonly pigeonId = input.required<number>();
  /** Crește când se schimbă părinții, ca foaia și arborele să se reîncarce. */
  readonly version = input(0);
  readonly addParent = output<{ id: number; side: string }>();

  readonly view = signal<View>(readView());
  readonly data = signal<PedigreeV1 | null>(null);
  readonly url = signal<string | null>(null);
  readonly error = signal('');

  constructor() {
    effect(() => {
      const id = this.pigeonId();
      this.version();
      if (this.view() !== 'fisa') return;
      untracked(() => this.load(id));
    });
  }

  setView(v: View) {
    this.view.set(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* fără memorie în browser: rămâne doar pe pagina asta */
    }
  }

  private async load(id: number) {
    try {
      const [ped, link] = await Promise.all([
        this.api.get<PedigreeV1>(`/pigeons/${id}/pedigree`),
        this.api.get<{ url: string | null }>(`/pigeons/${id}/public`),
      ]);
      this.data.set(ped);
      this.url.set(link.url);
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }
}

function readView(): View {
  try {
    return localStorage.getItem(KEY) === 'arbore' ? 'arbore' : 'fisa';
  } catch {
    return 'fisa';
  }
}
