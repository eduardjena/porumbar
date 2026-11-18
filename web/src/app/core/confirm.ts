import { Component, Injectable, effect, inject, signal, viewChild, ElementRef } from '@angular/core';
import { TPipe } from './i18n';
import { Icon } from '../shared/icon';

export interface ConfirmOptions {
  title: string;
  /** Rândurile explicației, de ex. lista schimbărilor („Starea: Tânăr → Reproducător”). */
  lines?: string[];
  confirmLabel: string;
  cancelLabel?: string;
  /** Ștergere sau altceva ireversibil: butonul de confirmare e roșu. */
  danger?: boolean;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * Confirmarea cerută de utilizator pentru orice ștergere sau modificare: o fereastră a aplicației, cu butoane mari,
 * nu mesajul mic al browserului. `await confirm.ask({...})` întoarce true doar dacă omul a apăsat butonul de confirmare.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<Pending | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    this.pending()?.resolve(false);
    return new Promise((resolve) => this.pending.set({ ...options, resolve }));
  }

  answer(ok: boolean) {
    const p = this.pending();
    this.pending.set(null);
    p?.resolve(ok);
  }
}

/** Lista schimbărilor dintre două versiuni ale acelorași câmpuri: „Eticheta: vechi → nou”. */
export function changes(fields: { label: string; before: unknown; after: unknown }[]): string[] {
  const show = (v: unknown) => (v == null || v === '' || (Array.isArray(v) && !v.length) ? '—' : Array.isArray(v) ? v.join(', ') : String(v));
  return fields.filter((f) => show(f.before) !== show(f.after)).map((f) => `${f.label}: ${show(f.before)} → ${show(f.after)}`);
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [Icon, TPipe],
  template: `
    <dialog #dlg (cancel)="$event.preventDefault(); svc.answer(false)" aria-labelledby="confirm-title">
      @if (svc.pending(); as p) {
        <div class="body">
          <span class="ico" [class.danger]="p.danger"><app-icon [name]="p.danger ? 'sterge' : 'alerta'" [size]="28" /></span>
          <h2 id="confirm-title">{{ p.title }}</h2>
          @if (p.lines?.length) {
            <ul>
              @for (l of p.lines; track $index) { <li>{{ l }}</li> }
            </ul>
          }
        </div>
        <div class="actions">
          <button type="button" (click)="svc.answer(false)">{{ p.cancelLabel ?? ('actiune.renunta' | t) }}</button>
          <button type="button" [class]="p.danger ? 'danger-solid' : 'primary'" (click)="svc.answer(true)" autofocus>{{ p.confirmLabel }}</button>
        </div>
      }
    </dialog>
  `,
  styles: `
    dialog {
      border: 0; border-radius: 20px; padding: 0; width: min(480px, calc(100vw - 32px)); background: var(--surface); color: var(--text);
      box-shadow: 0 24px 60px -12px rgb(16 32 48 / 35%);
    }
    dialog::backdrop { background: rgb(16 32 48 / 45%); }
    .body { padding: 24px 24px 8px; }
    .ico { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent-strong); }
    .ico.danger { background: var(--danger-soft); color: var(--danger); }
    h2 { margin: 14px 0 8px; font-size: 1.25rem; }
    ul { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; }
    .actions { display: flex; gap: 10px; padding: 16px 24px 24px; }
    .actions button { flex: 1; }
    .danger-solid { background: var(--danger); border-color: var(--danger); color: #fff; }
  `,
})
export class ConfirmDialog {
  protected readonly svc = inject(ConfirmService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const open = !!this.svc.pending();
      const el = this.dlg().nativeElement;
      if (open && !el.open) el.showModal();
      if (!open && el.open) el.close();
    });
  }
}
