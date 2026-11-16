import { Component, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Câmpul de parolă cu „ochi”: omul își poate vedea parola ca să verifice ce a scris, apoi o ascunde la loc. */
@Component({
  selector: 'app-password-field',
  imports: [FormsModule],
  template: `
    <label class="field">{{ label() }}
      @if (hint()) { <span class="hint">{{ hint() }}</span> }
      <span class="wrap">
        <input [type]="visible() ? 'text' : 'password'" [name]="name()" [attr.autocomplete]="autocomplete()" required
               [(ngModel)]="value" autocapitalize="off" spellcheck="false" />
        <button type="button" class="eye" (click)="visible.set(!visible())"
                [attr.aria-label]="visible() ? 'Ascunde parola' : 'Arată parola'" [attr.aria-pressed]="visible()">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            @if (visible()) {
              <path d="M10.7 5.1A10.7 10.7 0 0 1 22 12a11 11 0 0 1-1.7 2.6M14.1 14.2a3 3 0 0 1-4.2-4.2M17.5 17.5A10.8 10.8 0 0 1 2 12a10.8 10.8 0 0 1 4.4-5.4M2 2l20 20" />
            } @else {
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
            }
          </svg>
        </button>
      </span>
    </label>
  `,
  styles: `
    .wrap { position: relative; display: block; }
    .wrap input { padding-right: 64px; }
    .eye {
      position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 52px; min-height: 44px; height: 44px;
      padding: 0; border: 0; background: none; color: var(--muted); border-radius: 10px;
    }
    .eye:hover { color: var(--accent-strong); background: var(--surface-2); }
  `,
})
export class PasswordField {
  readonly label = input('Parola');
  readonly hint = input('');
  readonly name = input('password');
  readonly autocomplete = input('current-password');
  readonly value = model('');
  readonly visible = signal(false);
}
