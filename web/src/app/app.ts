import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth';
import { Icon, IconName } from './shared/icon';
import { ConfirmDialog } from './core/confirm';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { path: '/panou', label: 'Panou', icon: 'panou' },
  { path: '/arbore', label: 'Arbore', icon: 'ramificare' },
  { path: '/porumbei/nou', label: 'Adaugă', icon: 'plus', exact: true },
  { path: '/cont', label: 'Cont', icon: 'cont' },
];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, ConfirmDialog],
  template: `
    @if (auth.account()) {
      <header class="top">
        <a routerLink="/panou" class="brand" aria-label="Porumbar, panoul">
          <img class="brand-mark" src="/icon.svg" alt="" width="40" height="40" />
          Porumbar
        </a>
        <nav class="top-nav" aria-label="Meniu">
          @for (n of nav; track n.path) {
            <a [routerLink]="n.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: !!n.exact }">
              <app-icon [name]="n.icon" [size]="22" />{{ n.label }}
            </a>
          }
          <button type="button" class="ghost" (click)="logout()"><app-icon name="iesire" [size]="22" />Ieși</button>
        </nav>
      </header>
    }
    <app-confirm-dialog />
    <main [class.with-bottom]="auth.account()">
      <router-outlet />
    </main>
    @if (auth.account()) {
      <!-- Pe telefon, meniul stă jos, la îndemâna degetului mare. -->
      <nav class="bottom-nav" aria-label="Meniu">
        @for (n of nav; track n.path) {
          <a [routerLink]="n.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: !!n.exact }" [class.add]="n.icon === 'plus'">
            <span class="ico"><app-icon [name]="n.icon" [size]="n.icon === 'plus' ? 30 : 28" /></span>
            <span class="lbl">{{ n.label }}</span>
          </a>
        }
      </nav>
    }
  `,
  styles: `
    .top {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 10px 24px; background: rgb(255 255 255 / 92%); border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 10; backdrop-filter: saturate(1.4) blur(10px);
    }
    .brand { font-weight: 800; font-size: 1.2rem; color: var(--text); text-decoration: none; display: flex; align-items: center; gap: 10px; min-height: 48px; letter-spacing: -0.01em; }
    .brand-mark { width: 40px; height: 40px; display: block; }
    .top-nav { display: flex; gap: 4px; align-items: center; }
    .top-nav a, .top-nav .ghost {
      padding: 8px 16px; border-radius: 999px; color: var(--muted); text-decoration: none; min-height: 48px;
      display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 1rem; background: none; border: 0;
    }
    .top-nav a:hover, .top-nav .ghost:hover { background: var(--surface-2); color: var(--text); }
    .top-nav a.on { background: var(--accent-soft); color: var(--accent-strong); }
    main { max-width: 1120px; margin: 0 auto; padding: 20px 24px 40px; }
    .bottom-nav { display: none; }
    @media (max-width: 767px) {
      .top { padding: 8px 16px; }
      .top-nav { display: none; }
      main { padding: 16px 16px 24px; }
      main.with-bottom { padding-bottom: calc(108px + env(safe-area-inset-bottom)); }
      .bottom-nav {
        display: grid; grid-template-columns: repeat(4, 1fr); position: fixed; bottom: 0; left: 0; right: 0; z-index: 10;
        background: rgb(255 255 255 / 96%); border-top: 1px solid var(--border); backdrop-filter: saturate(1.4) blur(10px);
        padding: 6px 8px calc(8px + env(safe-area-inset-bottom));
      }
      .bottom-nav a {
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
        min-height: 64px; color: var(--muted); text-decoration: none; font-size: 0.85rem; font-weight: 700;
      }
      .bottom-nav .ico { width: 56px; height: 40px; border-radius: 999px; display: grid; place-items: center; transition: background-color 0.2s var(--ease); }
      .bottom-nav a.on { color: var(--accent-strong); }
      .bottom-nav a.on .ico { background: var(--accent-soft); }
      .bottom-nav a.add .ico { width: 52px; height: 40px; background: var(--accent); color: #fff; border-radius: 14px; }
      .bottom-nav a.add.on .ico { background: var(--accent-strong); }
    }
  `,
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly nav = NAV;

  async logout() {
    await this.auth.logout();
    this.router.navigateByUrl('/intra');
  }
}
