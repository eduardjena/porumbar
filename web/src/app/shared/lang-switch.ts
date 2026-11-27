import { Component, ElementRef, HostListener, computed, inject, viewChild } from '@angular/core';
import { currentLang, publicLangs, rememberGuestLang, useLang } from '../core/i18n';

/**
 * Alegerea limbii pe paginile fără cont, ca pe sit: steagul rotund al limbii de acum, cu o săgeată sub el, în colțul
 * din dreapta sus pe paginile de intrare (styles.css, .auth-page); lista se deschide sub el. Apare doar când sunt cel puțin două limbi publice. Un <details>.
 */
@Component({
  selector: 'app-lang-switch',
  template: `
    @if (langs().length > 1) {
      <details #box class="lang">
        <summary [attr.title]="label()" [attr.aria-label]="label()">
          <span class="flag" aria-hidden="true">@switch (lang()) {
            @case ('hu') { <svg viewBox="0 0 3 3"><rect width="3" height="3" fill="#477050"/><rect width="3" height="2" fill="#fff"/><rect width="3" height="1" fill="#ce2939"/></svg> }
            @case ('en') { <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice"><rect width="60" height="30" fill="#012169"/><path d="M0 0 60 30M60 0 0 30" stroke="#fff" stroke-width="6"/><path d="M0 0 60 30M60 0 0 30" stroke="#c8102e" stroke-width="2"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/></svg> }
            @case ('ja') { <svg viewBox="0 0 3 3"><rect width="3" height="3" fill="#fff"/><circle cx="1.5" cy="1.5" r="0.8" fill="#bc002d"/></svg> }
            @default { <svg viewBox="0 0 3 3"><rect width="1" height="3" fill="#002b7f"/><rect x="1" width="1" height="3" fill="#fcd116"/><rect x="2" width="1" height="3" fill="#ce1126"/></svg> }
          }</span>
          <svg class="chev" viewBox="0 0 12 8" aria-hidden="true"><path d="M1.5 1.5 6 6l4.5-4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </summary>
        <ul class="panel">
          @for (l of langs(); track l.code) {
            <li>
              <button type="button" [attr.lang]="l.code" [class.on]="l.code === lang()" [attr.aria-current]="l.code === lang() ? 'true' : null" (click)="pick(l.code)">
                <span class="flag" aria-hidden="true">@switch (l.code) {
            @case ('hu') { <svg viewBox="0 0 3 3"><rect width="3" height="3" fill="#477050"/><rect width="3" height="2" fill="#fff"/><rect width="3" height="1" fill="#ce2939"/></svg> }
            @case ('en') { <svg viewBox="0 0 60 30" preserveAspectRatio="xMidYMid slice"><rect width="60" height="30" fill="#012169"/><path d="M0 0 60 30M60 0 0 30" stroke="#fff" stroke-width="6"/><path d="M0 0 60 30M60 0 0 30" stroke="#c8102e" stroke-width="2"/><path d="M30 0v30M0 15h60" stroke="#fff" stroke-width="10"/><path d="M30 0v30M0 15h60" stroke="#c8102e" stroke-width="6"/></svg> }
            @case ('ja') { <svg viewBox="0 0 3 3"><rect width="3" height="3" fill="#fff"/><circle cx="1.5" cy="1.5" r="0.8" fill="#bc002d"/></svg> }
            @default { <svg viewBox="0 0 3 3"><rect width="1" height="3" fill="#002b7f"/><rect x="1" width="1" height="3" fill="#fcd116"/><rect x="2" width="1" height="3" fill="#ce1126"/></svg> }
          }</span><span>{{ l.name }}</span>
              </button>
            </li>
          }
        </ul>
      </details>
    }
  `,
  styles: `
    :host { display: flex; justify-content: flex-end; }
    .lang { position: relative; }
    summary {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px;
      min-width: 52px; min-height: 52px; padding: 4px; border-radius: 14px; cursor: pointer; list-style: none; user-select: none;
    }
    summary::-webkit-details-marker { display: none; }
    summary:hover, .lang[open] summary { background: var(--surface-2); }
    summary:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
    .chev { width: 12px; height: 8px; color: var(--text); transition: transform .15s; }
    .lang[open] .chev { transform: rotate(180deg); }
    .flag { position: relative; display: inline-block; width: 30px; height: 30px; flex: none; border-radius: 50%; overflow: hidden; }
    .flag::after { content: ''; position: absolute; inset: 0; border-radius: 50%; box-shadow: inset 0 0 0 1px rgb(38 51 67 / 30%); }
    .flag svg { display: block; width: 100%; height: 100%; }
    .panel {
      position: absolute; right: 0; top: calc(100% + 8px); min-width: 200px; margin: 0; padding: 6px; list-style: none;
      background: var(--surface); border: 1px solid var(--border-strong); border-radius: 14px;
      box-shadow: 0 24px 40px -24px rgb(38 51 67 / 45%);
    }
    .panel button {
      display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 0 12px; border: 0; border-radius: 10px;
      background: none; color: var(--text); font-weight: 750; font-size: 1.1rem; text-align: left; white-space: nowrap;
    }
    .panel button:hover { background: var(--surface-2); }
    .panel button.on { color: var(--accent); }
    .panel button.on::after { content: '✓'; margin-left: auto; padding-left: 12px; font-weight: 800; }
    @media print { :host { display: none; } }
  `,
})
export class LangSwitch {
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly box = viewChild<ElementRef<HTMLDetailsElement>>('box');
  protected readonly lang = currentLang;
  protected readonly langs = computed(() => publicLangs());
  /** Textul pentru cititoarele de ecran: în toate limbile publice, ca să-l înțeleagă oricine. */
  protected readonly label = computed(() => `Limba / Nyelv / Language / 言語: ${this.langs().find((l) => l.code === this.lang())?.name ?? ''}`);

  protected async pick(code: string) {
    this.close();
    rememberGuestLang(code);
    await useLang(code);
  }

  private close() {
    this.box()?.nativeElement.removeAttribute('open');
  }

  /** Lista se închide la o apăsare în afara ei. */
  @HostListener('document:click', ['$event'])
  protected outside(e: Event) {
    if (!this.host.nativeElement.contains(e.target as Node)) this.close();
  }
}
