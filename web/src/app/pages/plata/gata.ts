import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth';
import { PlataService } from '../../core/plata';
import { TPipe, formatDay } from '../../core/i18n';
import { Icon } from '../../shared/icon';

/*
 * Întoarcerea de la pagina de plată Polar (/plata/gata?checkout_id=…). Contul se activează din webhook, nu de aici:
 * citim starea contului la câteva secunde, cel mult ~40 s. Plătit = activ cu mai mult de 30 de zile înainte (și după
 * o prelungire din „expiră curând”, anul nou trece de 30 de zile).
 */
@Component({
  selector: 'app-plata-gata',
  imports: [RouterLink, Icon, TPipe],
  template: `
    <section class="card stack done">
      <h1>{{ 'plata.titlu' | t }}</h1>
      @if (paidUntil(); as end) {
        <p class="ok"><app-icon name="bifa" />{{ 'plata.gata' | t: { data: end } }}</p>
        <p class="muted">{{ 'plata.chitanta' | t }}</p>
      } @else if (waiting()) {
        <p>{{ 'plata.se_activeaza' | t }}</p>
      } @else {
        <p>{{ 'plata.dureaza' | t }}</p>
      }
      <a class="btn primary" routerLink="/panou">{{ 'plata.spre_panou' | t }}</a>
    </section>
  `,
  styles: `
    .done { max-width: 560px; margin: 24px auto; }
    .ok { display: flex; gap: 10px; align-items: center; font-size: 1.2rem; font-weight: 700; color: var(--ok); }
  `,
})
export default class PlataGata implements OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly plata = inject(PlataService);
  protected readonly waiting = signal(true);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private tries = 0;
  protected readonly paidUntil = computed(() => {
    const s = this.auth.account()?.subscription;
    return s && (s.status === 'active' || s.status === 'expiring') && (s.daysLeft ?? 0) > 30 && s.end ? formatDay(s.end) : null;
  });

  constructor() {
    void this.check();
  }

  private async check() {
    await this.auth.refresh().catch(() => undefined);
    if (this.paidUntil()) {
      this.waiting.set(false);
      void this.plata.load();
      return;
    }
    if (++this.tries >= 20) {
      this.waiting.set(false);
      return;
    }
    this.timer = setTimeout(() => void this.check(), 2000);
  }

  ngOnDestroy() {
    if (this.timer) clearTimeout(this.timer);
  }
}
