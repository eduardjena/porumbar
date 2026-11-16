import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';

/** Comutatorul Grilă / Listă al porumbarului: aceeași pereche de butoane pe ambele pagini. */
@Component({
  selector: 'app-view-toggle',
  imports: [RouterLink, Icon],
  template: `
    <div class="toggle" role="group" aria-label="Cum arăți porumbeii">
      <a routerLink="/panou" [class.on]="current() === 'grila'" [attr.aria-current]="current() === 'grila' ? 'page' : null">
        <app-icon name="panou" [size]="22" />Grilă
      </a>
      <a routerLink="/porumbar" [class.on]="current() === 'lista'" [attr.aria-current]="current() === 'lista' ? 'page' : null">
        <app-icon name="lista" [size]="22" />Listă
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
  `,
})
export class ViewToggle {
  readonly current = input.required<'grila' | 'lista'>();
}
