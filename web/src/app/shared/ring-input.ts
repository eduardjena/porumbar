import { Component, computed, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

/*
 * Câmpul de inel: arată sub el ce a înțeles programul, ca omul să vadă imediat dacă a scris bine.
 * Aceleași reguli ca pe server (src/rings.js), simplificate: doar pentru mesajul de sub câmp.
 */
const COUNTRIES: Record<string, string> = { RO: 'RO', NL: 'NL', BE: 'BE', BELG: 'BE', B: 'BE', DV: 'DV', D: 'DV', DE: 'DV', GB: 'GB', PL: 'PL', HU: 'HU', BG: 'BG', MD: 'MD', FR: 'FR', AT: 'AT', AUS: 'AT', AUT: 'AT', ES: 'ES', ESP: 'ES', E: 'ES' };
const SEX: Record<string, 'M' | 'F'> = { L: 'M', M: 'M', T: 'F', F: 'F' };

export function previewRing(text: string): { ok: boolean; display: string; sex: 'M' | 'F' | null; unringed: boolean } {
  let s = text.trim().toUpperCase().replace(/\s+/g, ' ');
  let sex: 'M' | 'F' | null = null;
  const m0 = s.match(/^(.*?)(?:\s+|(?<=\d))([LMTF])$/);
  if (m0 && m0[1]) {
    sex = SEX[m0[2]];
    s = m0[1].trim();
  }
  if (/^0+$/.test(s)) return { ok: true, display: 'fără inel', sex, unringed: true };
  const yy = (y: string) => (y.length === 4 ? y.slice(2) : y);
  const strip = (n: string) => n.replace(/^0+(?=\d)/, '');
  let m = s.match(/^([A-Z]{1,4})[\s-]+(\d{1,5})[\s-]+(\d{2})[\s-]+(\d+)$/);
  if (m && COUNTRIES[m[1]] === 'DV' && m[2].length > 2) return { ok: true, display: `DV-${strip(m[2]).padStart(5, '0')}-${m[3]}-${strip(m[4])}`, sex, unringed: false };
  // Anul în față, apoi clubul (myloft): DV 17-01063-813, AUS 18-301-1405.
  m = s.match(/^([A-Z]{1,4})[\s-]+(\d{2})[\s-]+(\d{3,5})[\s-]+(\d+)$/);
  if (m && COUNTRIES[m[1]]) {
    const c = COUNTRIES[m[1]];
    const display = c === 'DV' ? `DV-${strip(m[3]).padStart(5, '0')}-${m[2]}-${strip(m[4])}` : `${c}-${m[2]}-${strip(m[3])}-${strip(m[4])}`;
    return { ok: true, display, sex, unringed: false };
  }
  m = s.match(/^([A-Z]{1,4})[\s-]+(\d{2}|\d{4})[\s-]+(\d+)$/);
  if (m && COUNTRIES[m[1]]) return { ok: true, display: `${COUNTRIES[m[1]]}-${yy(m[2])}-${strip(m[3])}`, sex, unringed: false };
  m = s.match(/^([A-Z]{1,4})\s+(\d{4,})\s*-\s*(\d{4})$/);
  if (m && COUNTRIES[m[1]]) return { ok: true, display: `${COUNTRIES[m[1]]}-${yy(m[3])}-${strip(m[2])}`, sex, unringed: false };
  m = s.match(/^(\d+)\s*[/-]\s*(\d{2}|\d{4})(?:[\s-]+([A-Z]{1,4}))?$/);
  if (m && (!m[3] || COUNTRIES[m[3]])) return { ok: true, display: `${m[3] ? COUNTRIES[m[3]] : 'RO'}-${yy(m[2])}-${strip(m[1])}`, sex, unringed: false };
  return { ok: false, display: '', sex, unringed: false };
}

@Component({
  selector: 'app-ring-input',
  imports: [FormsModule],
  template: `
    <label class="field">{{ label() }}
      <span class="hint">De exemplu RO-25-276971, 276971/25 RO sau RO 25 276971. Litera de la final (M/F, L/T) spune sexul.</span>
      <input class="mono" [name]="name()" [(ngModel)]="value" autocapitalize="characters" autocomplete="off" spellcheck="false" />
    </label>
    @if (value().trim()) {
      @if (preview().ok) {
        <p class="ok" role="status">
          Recunoscut: <strong class="mono">{{ preview().display }}</strong>@if (preview().sex) {, {{ preview().sex === 'M' ? 'mascul' : 'femelă' }}}
        </p>
      } @else if (required()) {
        <p class="bad" role="status">Nu pot citi inelul. Scrie-l ca în exemplu: RO-25-123456.</p>
      } @else {
        <p class="muted" role="status">Nu e un inel obișnuit: se păstrează exact cum l-ai scris.</p>
      }
    }
  `,
  styles: `
    .ok { color: var(--accent-strong); margin: 4px 0 0; }
    .bad { color: var(--danger); font-weight: 600; margin: 4px 0 0; }
  `,
})
export class RingInput {
  readonly label = input('Inelul');
  readonly name = input('ring');
  readonly required = input(true);
  readonly value = model('');
  protected readonly preview = computed(() => previewRing(this.value()));
}
