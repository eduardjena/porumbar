import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PigeonSummary } from '../core/models';
import { CatalogService, ringText, sexShort } from '../core/catalog';

/** Un porumbel pe scurt: inel, sex, nume, culoare. Cu `link`, duce la fișa lui. */
@Component({
  selector: 'app-pigeon-chip',
  imports: [RouterLink],
  template: `
    @if (pigeon(); as p) {
      @if (link()) {
        <a class="chip" [routerLink]="['/porumbei', p.id]">
          <span class="mono ring">{{ ring() }}</span>
          <span [class]="'sex-' + (p.sex ?? '')">{{ sex() }}</span>
          @if (p.name) { <span class="name">„{{ p.name }}”</span> }
          @if (color()) { <span class="muted">{{ color() }}</span> }
          @if (p.kind === 'external') { <span class="badge">strămoș</span> }
        </a>
      } @else {
        <span class="chip plain">
          <span class="mono ring">{{ ring() }}</span>
          <span [class]="'sex-' + (p.sex ?? '')">{{ sex() }}</span>
          @if (p.name) { <span class="name">„{{ p.name }}”</span> }
          @if (color()) { <span class="muted">{{ color() }}</span> }
        </span>
      }
    } @else {
      <span class="muted">necunoscut</span>
    }
  `,
  styles: `
    .chip { display: inline-flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; text-decoration: none; color: var(--text); }
    a.chip { min-height: 48px; align-items: center; }
    a.chip .ring { color: var(--accent-strong); text-decoration: underline; }
    .ring { font-weight: 700; }
  `,
})
export class PigeonChip {
  private readonly catalog = inject(CatalogService);
  readonly pigeon = input<PigeonSummary | null>(null);
  readonly link = input(true);
  protected readonly ring = computed(() => ringText(this.pigeon()));
  protected readonly sex = computed(() => sexShort(this.pigeon()?.sex));
  protected readonly color = computed(() => this.catalog.label('colors', this.pigeon()?.color));
}
