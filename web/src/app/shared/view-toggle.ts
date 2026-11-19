import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';
import { TPipe } from '../core/i18n';

/** Comutatorul Grilă / Listă al porumbarului (pe „Rezultate concurs” niciunul nu e aprins). */
@Component({
  selector: 'app-view-toggle',
  imports: [RouterLink, Icon, TPipe],
  template: `
    <div class="toggle" role="group" [attr.aria-label]="'vedere.cum_arati' | t">
      <a routerLink="/panou" [class.on]="current() === 'grila'" [attr.aria-current]="current() === 'grila' ? 'page' : null">
        <app-icon name="panou" [size]="22" />{{ 'vedere.grila' | t }}
      </a>
      <a routerLink="/porumbar" [class.on]="current() === 'lista'" [attr.aria-current]="current() === 'lista' ? 'page' : null">
        <app-icon name="lista" [size]="22" />{{ 'vedere.lista' | t }}
      </a>
    </div>
  `,
  styles: `
    .toggle { display: inline-flex; padding: 4px; gap: 4px; background: var(--surface-2); border-radius: 999px; }
    a {
      display: inline-flex; align-items: center; gap: 8px; min-height: 48px; padding: 0 18px; border-radius: 999px;
      color: var(--muted); font-weight: 700; text-decoration: none;
    }
    a.on { background: var(--surface); color: var(--accent-strong); box-shadow: var(--shadow); }
    /* Pe telefon: pe toată lățimea, trei părți egale, ca să încapă pe un rând. */
    @media (max-width: 767px) {
      :host { display: block; width: 100%; }
      .toggle { display: flex; width: 100%; }
      a { flex: 1 1 0; justify-content: center; gap: 6px; padding: 0 6px; font-size: 0.95rem; }
    }
  `,
})
export class ViewToggle {
  readonly current = input.required<'grila' | 'lista' | null>();
}
