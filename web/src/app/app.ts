import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    @if (auth.account()) {
      <header class="top">
        <a routerLink="/porumbar" class="brand" aria-label="Porumbar, pagina principală">
          <span class="brand-mark" aria-hidden="true">🕊</span> Porumbar
        </a>
        <nav class="top-nav" aria-label="Meniu">
          <a routerLink="/porumbar" routerLinkActive="on">Porumbarul meu</a>
          <a routerLink="/porumbei/nou" routerLinkActive="on">Porumbel nou</a>
          <a routerLink="/cont" routerLinkActive="on">Contul meu</a>
          <button type="button" class="link" (click)="logout()">Ieși</button>
        </nav>
      </header>
    }
    <main [class.with-bottom]="auth.account()">
      <router-outlet />
    </main>
    @if (auth.account()) {
      <!-- Pe telefon, meniul stă jos, la îndemâna degetului mare. -->
      <nav class="bottom-nav" aria-label="Meniu">
        <a routerLink="/porumbar" routerLinkActive="on"><span aria-hidden="true">🏠</span>Porumbar</a>
        <a routerLink="/porumbei/nou" routerLinkActive="on"><span aria-hidden="true">＋</span>Adaugă</a>
        <a routerLink="/cont" routerLinkActive="on"><span aria-hidden="true">👤</span>Contul meu</a>
      </nav>
    }
  `,
  styles: `
    .top {
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      padding: 8px 24px; background: var(--surface); border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 10;
    }
    .brand { font-weight: 700; font-size: 1.25rem; color: var(--text); text-decoration: none; display: flex; align-items: center; gap: 8px; min-height: 48px; }
    .brand-mark { font-size: 1.5rem; }
    .top-nav { display: flex; gap: 4px; align-items: center; }
    .top-nav a, .top-nav .link {
      padding: 10px 14px; border-radius: 10px; color: var(--text); text-decoration: none; min-height: 48px;
      display: inline-flex; align-items: center; font-size: 1rem; background: none; border: 0; cursor: pointer;
    }
    .top-nav a.on { background: var(--accent-soft); color: var(--accent-strong); font-weight: 600; }
    main { max-width: 1100px; margin: 0 auto; padding: 16px; }
    .bottom-nav { display: none; }
    @media (max-width: 767px) {
      .top { padding: 4px 16px; }
      .top-nav { display: none; }
      main.with-bottom { padding-bottom: 96px; }
      .bottom-nav {
        display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 10;
        background: var(--surface); border-top: 1px solid var(--border);
        padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
      }
      .bottom-nav a {
        flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
        min-height: 60px; color: var(--muted); text-decoration: none; font-size: 0.85rem; border-radius: 12px;
      }
      .bottom-nav a span { font-size: 1.4rem; line-height: 1; }
      .bottom-nav a.on { color: var(--accent-strong); font-weight: 700; background: var(--accent-soft); }
    }
  `,
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  async logout() {
    await this.auth.logout();
    this.router.navigateByUrl('/intra');
  }
}
