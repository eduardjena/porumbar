import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TPipe } from '../core/i18n';
import { previewRing } from './ring-preview';

/*
 * Câmpul de inel: arată sub el ce a înțeles programul, ca omul să vadă imediat dacă a scris bine. Regulile sunt chiar
 * cele de pe server (shared/ring-preview.ts → src/rings.js). Un inel nerecunoscut nu e o eroare: se păstrează cum a fost
 * scris, cu rugămintea „verifică-l”; doar inelul maghiar fără organizator se refuză la un porumbel propriu.
 */
@Component({
  selector: 'app-ring-input',
  imports: [FormsModule, TPipe],
  template: `
    <label class="field">{{ label() || ('inel.eticheta' | t) }}
      <span class="hint">{{ 'inel.exemplu' | t }}</span>
      <input class="mono" [name]="name()" [(ngModel)]="value" autocapitalize="characters" autocomplete="off" spellcheck="false" />
    </label>
    @if (value().trim()) {
      @if (preview().ok) {
        <p class="ok" role="status">
          {{ 'inel.recunoscut' | t }} <strong class="mono">{{ preview().unringed ? ('text.fara_inel' | t) : preview().display }}</strong>@if (preview().sex) {, {{ (preview().sex === 'M' ? 'inel.mascul' : 'inel.femela') | t }}}
        </p>
      } @else if (required() && preview().needsClub) {
        <p class="bad" role="status">{{ 'eroare.inel_hu_asociatie' | t }}</p>
      } @else if (required() && !preview().unknown) {
        <p class="bad" role="status">{{ 'eroare.inel_necitit' | t }}</p>
      } @else if (required()) {
        <p class="warn" role="status">{{ 'inel.nerecunoscut' | t }}</p>
      } @else {
        <p class="muted" role="status">{{ 'inel.neobisnuit' | t }}</p>
      }
    }
  `,
  styles: `
    .ok { color: var(--accent-strong); margin: 4px 0 0; }
    .bad { color: var(--danger); font-weight: 600; margin: 4px 0 0; }
    .warn { color: var(--warn); margin: 4px 0 0; }
  `,
})
export class RingInput {
  /** Fără etichetă: „Inelul”, din dicționar. */
  readonly label = input('');
  readonly name = input('ring');
  readonly required = input(true);
  readonly value = model('');
  protected readonly preview = computed(() => previewRing(this.value()));
}
