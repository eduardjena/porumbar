import { Component, ElementRef, HostListener, booleanAttribute, computed, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TPipe, currentLang, formatDay, localeOf, t } from '../core/i18n';
import { Icon } from './icon';
import { todayIso } from '../core/today';

/*
 * Câmpul de dată al aplicației, în locul lui <input type="date">: calendarul browserului vine în limba telefonului
 * (adesea engleză, cu luna înaintea zilei); aici totul e în limba aleasă în Pigeonrama (RO 18.11.2026, HU 2026. 11. 18.).
 * Se poate scrie data de mână sau alege din calendar. Valoarea rămâne „AAAA-LL-ZZ” (ce așteaptă serverul), '' când e goală.
 */
const pad = (n: number) => String(n).padStart(2, '0');
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const valid = (y: number, m: number, d: number) => {
  const x = new Date(Date.UTC(y, m, d));
  return y >= 1900 && y <= 2100 && x.getUTCFullYear() === y && x.getUTCMonth() === m && x.getUTCDate() === d;
};

/** Ce a scris omul → „AAAA-LL-ZZ”, '' pentru gol, null dacă nu se înțelege. Anul în față (HU) sau la coadă (RO). */
export function parseDay(text: string): string | null {
  const parts = text.trim().match(/\d+/g);
  if (!parts) return text.trim() ? null : '';
  if (parts.length !== 3) return null;
  let [a, b, c] = parts.map(Number);
  let y: number, m: number, d: number;
  if (parts[0].length === 4) [y, m, d] = [a, b, c];
  else {
    if (parts[2].length === 2) c += 2000;
    else if (parts[2].length !== 4) return null;
    [d, m, y] = [a, b, c];
  }
  return valid(y, m - 1, d) ? iso(y, m - 1, d) : null;
}

const cap = (s: string) => s.charAt(0).toLocaleUpperCase() + s.slice(1);

@Component({
  selector: 'app-date',
  imports: [Icon, TPipe],
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateField), multi: true }],
  template: `
    <div class="d">
      <input type="text" inputmode="numeric" autocomplete="off" [value]="text()" [placeholder]="'data.model' | t"
             [disabled]="disabled()" [class.bad]="bad()" [attr.aria-invalid]="bad() || null"
             (input)="typed($any($event.target).value)" (blur)="commit()" (keydown.enter)="commit()" />
      <button type="button" class="cal" [disabled]="disabled()" (click)="toggle()" [attr.aria-expanded]="open()"
              [attr.aria-label]="'data.alege' | t" [title]="'data.alege' | t">
        <app-icon name="calendar" [size]="24" />
      </button>
      @if (open()) {
        <div class="pop" role="dialog" [attr.aria-label]="'data.alege' | t">
          <div class="nav">
            <button type="button" class="step" (click)="move(-1)" [attr.aria-label]="'data.luna_trecuta' | t"><app-icon name="inapoi" [size]="22" /></button>
            <select [value]="month()" (change)="month.set(+$any($event.target).value)" [attr.aria-label]="'data.luna' | t">
              @for (name of monthNames(); track $index) { <option [value]="$index" [selected]="$index === month()">{{ name }}</option> }
            </select>
            <select [value]="year()" (change)="year.set(+$any($event.target).value)" [attr.aria-label]="'data.anul' | t">
              @for (y of years(); track y) { <option [value]="y" [selected]="y === year()">{{ y }}</option> }
            </select>
            <button type="button" class="step" (click)="move(1)" [attr.aria-label]="'data.luna_urmatoare' | t"><app-icon name="inainte" [size]="22" /></button>
          </div>
          <div class="grid">
            @for (w of weekDays(); track $index) { <span class="wd">{{ w }}</span> }
            @for (c of cells(); track $index) {
              @if (c) {
                <button type="button" class="day" [class.on]="c.iso === value()" [class.today]="c.iso === today"
                        [attr.aria-pressed]="c.iso === value()" [attr.aria-label]="label(c.iso)" (click)="pick(c.iso)">{{ c.day }}</button>
              } @else { <span></span> }
            }
          </div>
          <div class="foot">
            <button type="button" class="link" (click)="pick(today)">{{ 'data.azi' | t }}</button>
            @if (!required() && value()) { <button type="button" class="link" (click)="pick('')">{{ 'data.sterge' | t }}</button> }
            <button type="button" class="link" (click)="close()">{{ 'data.inchide' | t }}</button>
          </div>
        </div>
      }
    </div>
    @if (bad()) { <span class="err">{{ 'data.gresita' | t: { exemplu: example() } }}</span> }
  `,
  styles: `
    :host { display: block; font-weight: 400; }
    .d { position: relative; }
    .d > input { padding-right: 60px; font-variant-numeric: tabular-nums; }
    .d > input.bad { border-color: var(--danger); }
    .cal { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); min-height: 44px; width: 48px; padding: 0; border: 0; background: none; color: var(--accent-strong); border-radius: 10px; }
    .cal:active { transform: translateY(-50%) scale(0.96); }
    .pop {
      position: absolute; z-index: 60; top: calc(100% + 6px); left: 0; width: min(352px, calc(100vw - 32px));
      background: var(--surface); border: 1.5px solid var(--border-strong); border-radius: var(--radius-sm, 12px);
      box-shadow: 0 12px 32px rgb(40 25 10 / 18%); padding: 12px;
    }
    .nav { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; }
    .nav select { min-height: 44px; padding: 6px 8px; flex: 1 1 auto; width: auto; min-width: 0; font-weight: 700; }
    .nav select:last-of-type { flex: 0 0 auto; }
    .step { min-height: 44px; width: 44px; padding: 0; flex: none; border-radius: 10px; }
    .grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; text-align: center; }
    .wd { font-size: 0.82rem; font-weight: 700; color: var(--muted); padding: 4px 0; }
    .day { min-height: 44px; padding: 0; border: 0; background: none; border-radius: 10px; font-weight: 600; font-variant-numeric: tabular-nums; }
    .day:hover { background: var(--bg, #eceee8); }
    .day.today { box-shadow: inset 0 0 0 1.5px var(--accent); }
    .day.on { background: var(--accent); color: var(--accent-ink, #fff); }
    .foot { display: flex; justify-content: space-between; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
    .err { display: block; margin-top: 4px; color: var(--danger); font-size: 0.9rem; font-weight: 600; }
  `,
})
export class DateField implements ControlValueAccessor {
  private readonly host = inject(ElementRef<HTMLElement>);
  /** La câmpurile obligatorii nu apare „Șterge” (validarea o face tot ngModel, prin același atribut). */
  readonly required = input(false, { transform: booleanAttribute });

  protected readonly value = signal('');
  protected readonly text = signal('');
  protected readonly bad = signal(false);
  protected readonly disabled = signal(false);
  protected readonly open = signal(false);
  protected readonly year = signal(new Date().getFullYear());
  protected readonly month = signal(new Date().getMonth());
  protected readonly today = todayIso();

  private onChange: (v: string) => void = () => {};
  private onTouched: () => void = () => {};

  protected readonly monthNames = computed(() => {
    const f = new Intl.DateTimeFormat(localeOf(currentLang()), { month: 'long', timeZone: 'UTC' });
    return Array.from({ length: 12 }, (_, m) => cap(f.format(new Date(Date.UTC(2026, m, 15)))));
  });
  /** Săptămâna începe luni (ca în calendarele de la noi și din Ungaria). */
  protected readonly weekDays = computed(() => {
    const f = new Intl.DateTimeFormat(localeOf(currentLang()), { weekday: 'short', timeZone: 'UTC' });
    return Array.from({ length: 7 }, (_, i) => cap(f.format(new Date(Date.UTC(2026, 10, 16 + i))).replace(/\.$/, '')));
  });
  protected readonly years = computed(() => {
    const last = Math.max(new Date().getFullYear() + 1, this.year());
    const first = Math.min(1990, this.year());
    return Array.from({ length: last - first + 1 }, (_, i) => last - i);
  });
  protected readonly cells = computed(() => {
    const y = this.year(), m = this.month();
    const lead = (new Date(Date.UTC(y, m, 1)).getUTCDay() + 6) % 7;
    const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const out: ({ day: number; iso: string } | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= days; d++) out.push({ day: d, iso: iso(y, m, d) });
    return out;
  });
  protected readonly example = computed(() => (currentLang(), formatDay(this.today)));
  protected readonly label = (v: string) => new Date(`${v}T12:00:00Z`).toLocaleDateString(localeOf(currentLang()), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

  writeValue(v: string | null): void {
    const val = v ?? '';
    this.value.set(val);
    this.text.set(formatDay(val || null));
    this.bad.set(false);
  }
  registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
  registerOnTouched(fn: () => void): void { this.onTouched = fn; }
  setDisabledState(d: boolean): void { this.disabled.set(d); }

  protected typed(v: string) {
    this.text.set(v);
    this.bad.set(false);
  }

  protected commit() {
    const v = parseDay(this.text());
    if (v === null) {
      this.bad.set(true);
      this.value.set('');
      this.onChange('');
    } else this.set(v);
    this.onTouched();
  }

  protected toggle() {
    if (this.open()) return this.close();
    const v = this.value() || this.today;
    this.year.set(+v.slice(0, 4));
    this.month.set(+v.slice(5, 7) - 1);
    this.open.set(true);
  }

  protected move(step: number) {
    const m = this.month() + step;
    this.year.update((y) => y + Math.floor(m / 12));
    this.month.set(((m % 12) + 12) % 12);
  }

  protected pick(v: string) {
    this.set(v);
    this.onTouched();
    this.close();
    this.host.nativeElement.querySelector('input')?.focus();
  }

  protected close() { this.open.set(false); }

  private set(v: string) {
    const changed = v !== this.value();
    this.value.set(v);
    this.text.set(formatDay(v || null));
    this.bad.set(false);
    if (changed) this.onChange(v);
  }

  @HostListener('document:pointerdown', ['$event'])
  protected outside(e: Event) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.close();
  }

  @HostListener('keydown.escape')
  protected escape() { this.close(); }
}
