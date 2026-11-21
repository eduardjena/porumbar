import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api } from '../../core/api';
import { TPipe, formatDay, t } from '../../core/i18n';
import { Treatment } from '../../core/models';
import { Icon } from '../../shared/icon';
import { addDays, kindIcon, todayIso } from '../tratamente/tratament-text';

/** Câte tratamente care urmează se arată pe Panou (restul, în pagina Tratamente). */
const UPCOMING_ROWS = 3;
/** „Urmează” pe Panou: doar ce începe în următoarele 30 de zile. */
const UPCOMING_DAYS = 30;

/*
 * Banda de sus a Panoului: un rând pe fiecare tratament în curs („În curs: Tricomonază, ziua 3 din 5”) și cel mult 3
 * care urmează în 30 de zile. Atingerea duce la tratament. Fără nimic în curs sau aproape, banda nu apare deloc.
 */
@Component({
  selector: 'app-tratamente-banda',
  imports: [RouterLink, Icon, TPipe],
  template: `
    @if (running().length || upcoming().length) {
      <section class="banda" [attr.aria-label]="'meniu.tratamente' | t">
        <ul>
          @for (tr of running(); track tr.id) {
            <li>
              <a class="r now" [routerLink]="['/tratamente', tr.id]">
                <app-icon [name]="icon(tr)" [size]="24" /><span>{{ runningText(tr) }}</span><app-icon name="inainte" class="go" [size]="20" />
              </a>
            </li>
          }
          @for (tr of upcoming(); track tr.id) {
            <li>
              <a class="r" [routerLink]="['/tratamente', tr.id]">
                <app-icon [name]="icon(tr)" [size]="24" /><span>{{ 'tratamente.banda_urmeaza' | t: { nume: tr.label, data: day(tr.startDate) } }}</span><app-icon name="inainte" class="go" [size]="20" />
              </a>
            </li>
          }
        </ul>
        <a class="all" routerLink="/tratamente">{{ 'tratamente.toate' | t }}</a>
      </section>
    }
  `,
  styles: `
    .banda { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 6px; margin: 0 0 16px; }
    ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .r {
      display: flex; align-items: center; gap: 12px; min-height: 52px; padding: 6px 12px; border-radius: var(--radius-sm);
      color: var(--text); text-decoration: none; font-weight: 600;
    }
    .r:hover { background: var(--surface-2); }
    .r span { flex: 1; min-width: 0; overflow-wrap: anywhere; }
    .r.now { background: var(--accent-soft); color: var(--accent-strong); font-weight: 800; }
    .go { color: var(--muted); }
    .all { display: inline-flex; align-items: center; min-height: 48px; padding: 0 12px; font-weight: 700; }
  `,
})
export class TratamenteBanda {
  private readonly api = inject(Api);
  protected readonly running = signal<Treatment[]>([]);
  private readonly next = signal<Treatment[]>([]);
  protected readonly icon = kindIcon;
  protected readonly day = formatDay;

  protected readonly upcoming = computed(() => {
    const until = addDays(todayIso(), UPCOMING_DAYS);
    return this.next().filter((x) => x.startDate <= until).slice(0, UPCOMING_ROWS);
  });

  constructor() {
    this.load();
  }

  protected runningText(tr: Treatment) {
    return tr.days === 1 ? t('tratamente.banda_in_curs_azi', { nume: tr.label }) : t('tratamente.banda_in_curs', { nume: tr.label, zi: tr.day, zile: tr.days });
  }

  private async load() {
    try {
      const [running, next] = await Promise.all([
        this.api.get<{ treatments: Treatment[] }>('/treatments?stare=in_curs'),
        this.api.get<{ treatments: Treatment[] }>('/treatments?stare=urmeaza'),
      ]);
      this.running.set(running.treatments);
      this.next.set(next.treatments);
    } catch {
      // Banda e doar o amintire: fără ea, Panoul merge mai departe.
    }
  }
}
