import { Component, computed, inject } from '@angular/core';
import { InstallService } from '../core/install';
import { TPipe } from '../core/i18n';

/**
 * „Instalează aplicația”: pune Pigeonrama pe ecranul telefonului. Butonul apare doar când browserul oferă instalarea;
 * pe Android, fără ofertă, apar pașii din meniul browserului. Deja instalată (deschisă din iconiță): nu apare nimic.
 */
@Component({
  selector: 'app-install-app',
  imports: [TPipe],
  template: `
    @if (state() !== 'none') {
      <div class="card stack install">
        <h3>{{ 'instalare.titlu' | t }}</h3>
        @switch (state()) {
          @case ('done') { <div class="notice" role="status">{{ 'instalare.gata' | t }}</div> }
          @case ('button') {
            <p>{{ 'instalare.explicatie' | t }}</p>
            <button type="button" class="primary wide" (click)="install()">{{ 'instalare.buton' | t }}</button>
          }
          @case ('manual') {
            <p>{{ 'instalare.explicatie' | t }}</p>
            <p class="muted">{{ 'instalare.manual' | t }}</p>
          }
        }
      </div>
    }
  `,
  styles: `.install h3 { margin: 0; }`,
})
export class InstallApp {
  private readonly svc = inject(InstallService);
  private readonly standalone = this.svc.standalone();
  private readonly android = this.svc.android();

  protected readonly state = computed<'none' | 'done' | 'button' | 'manual'>(() => {
    if (this.svc.justInstalled()) return 'done';
    if (this.standalone) return 'none';
    if (this.svc.canInstall()) return 'button';
    return this.android ? 'manual' : 'none';
  });

  protected install() {
    void this.svc.install();
  }
}
