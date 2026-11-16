import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from './icon';

export interface Crumb {
  label: string;
  link?: (string | number)[];
}

/** Drumul până la pagina curentă: „Panou › RO-15-412084 › Editează”. Ultimul pas e pagina curentă (fără legătură). */
@Component({
  selector: 'app-breadcrumbs',
  imports: [RouterLink, Icon],
  template: `
    <nav class="crumbs" aria-label="Unde ești">
      <ol>
        @for (c of items(); track $index; let last = $last) {
          <li>
            @if (c.link && !last) {
              <a [routerLink]="c.link">{{ c.label }}</a>
              <app-icon name="inainte" [size]="18" class="sep" />
            } @else {
              <span aria-current="page">{{ c.label }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styles: `
    .crumbs { margin: 0 0 6px; }
    ol { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; align-items: center; gap: 2px; font-size: 0.95rem; }
    li { display: inline-flex; align-items: center; gap: 2px; }
    a { color: var(--accent-strong); font-weight: 700; text-decoration: none; padding: 10px 4px; min-height: 44px; display: inline-flex; align-items: center; }
    a:hover { text-decoration: underline; }
    span[aria-current] { color: var(--muted); padding: 10px 4px; }
    .sep { color: var(--border-strong); }
  `,
})
export class Breadcrumbs {
  readonly items = input.required<Crumb[]>();
}
