import { Component, computed, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IncomingService } from './core/incoming';
import { AuthService } from './core/auth';
import { Icon, IconName } from './shared/icon';
import { ConfirmDialog } from './core/confirm';

const fmt = (d: string | null) => (d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('ro-RO') : '');

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}

const NAV: NavItem[] = [
  { path: '/panou', label: 'Panou', icon: 'panou' },
  { path: '/arbore', label: 'Arbore', icon: 'copac' },
  { path: '/porumbei/nou', label: 'Adaugă', icon: 'plus', exact: true },
  { path: '/cont', label: 'Cont', icon: 'cont' },
];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, ConfirmDialog],
  template: `
    @if (auth.account()) {
      <header class="top">
        <!-- Conținutul antetului are aceeași lățime ca pagina: meniul se aliniază cu marginea din dreapta a conținutului. -->
        <div class="top-inner">
        <a routerLink="/panou" class="brand" aria-label="Porumbar, panoul">
          <img class="brand-mark" src="/icon.svg" alt="" width="40" height="40" />
          Porumbar
        </a>
        <nav class="top-nav" aria-label="Meniu">
          @for (n of nav(); track n.path) {
            <a [routerLink]="n.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: !!n.exact }">
              <app-icon [name]="n.icon" [size]="22" />{{ n.label }}
            </a>
          }
          <button type="button" class="ghost" (click)="logout()"><app-icon name="iesire" [size]="22" />Ieși</button>
        </nav>
        </div>
      </header>
    }
    <app-confirm-dialog />
    <main [class.with-bottom]="auth.account()">
      @if (banner(); as b) { <div class="sub-banner no-print" [class]="'sub-banner ' + b.kind" role="status">{{ b.text }}</div> }
      @if (showIncoming()) {
        <!-- Pe orice pagină, până primește (sau refuză) porumbeii trimiși de alți crescători. -->
        <a class="notice incoming no-print" routerLink="/vanzari" role="status">
          <app-icon name="vinde" />
          <span>{{ incoming.count() === 1 ? 'Cineva ți-a trimis (vândut) un porumbel.' : 'Ai ' + incoming.count() + ' porumbei trimiși de alți crescători.' }}
            <strong>Apasă aici ca să-l primești.</strong></span>
        </a>
      }
      <router-outlet />
      <!-- Semnătura: pe calculator mic în colțul din dreapta jos, pe telefon la capătul paginii. -->
      <a class="made-by no-print" href="https://www.soopra.com" target="_blank" rel="noopener">Soopra</a>
    </main>
    @if (auth.account()) {
      <!-- Pe telefon, meniul stă jos, la îndemâna degetului mare. -->
      <nav class="bottom-nav" aria-label="Meniu">
        @for (n of nav(); track n.path) {
          <a [routerLink]="n.path" routerLinkActive="on" [routerLinkActiveOptions]="{ exact: !!n.exact }" [class.add]="n.icon === 'plus'">
            <span class="ico"><app-icon [name]="n.icon" [size]="n.icon === 'plus' ? 30 : 28" /></span>
            <span class="lbl">{{ n.label }}</span>
          </a>
        }
      </nav>
    }
  `,
  styles: `
    .sub-banner { margin-bottom: 14px; font-weight: 600; }
    .incoming { display: flex; align-items: center; gap: 10px; text-decoration: none; margin-bottom: 14px; font-weight: 600; min-height: 48px; }
    .incoming strong { text-decoration: underline; }
    .top {
      background: rgb(255 253 249 / 94%); border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 10; backdrop-filter: saturate(1.4) blur(10px);
    }
    .top-inner {
      max-width: 1120px; margin: 0 auto; padding: 10px 24px;
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
    }
    .top-nav > :last-child { margin-right: -16px; } /* textul „Ieși” cade exact pe marginea conținutului */
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
    .made-by {
      position: fixed; right: 12px; bottom: 8px; z-index: 5; padding: 2px 8px; border-radius: 999px;
      font-size: 0.75rem; font-weight: 600; color: var(--muted); text-decoration: none; background: rgb(255 253 249 / 85%);
    }
    .made-by:hover { color: var(--accent-strong); text-decoration: underline; }
    @media (max-width: 767px) {
      .made-by { position: static; display: block; width: fit-content; margin: 28px 0 0 auto; background: none; }
      .top-inner { padding: 8px 16px; }
      .top-nav { display: none; }
      main { padding: 16px 16px 24px; }
      main.with-bottom { padding-bottom: calc(108px + env(safe-area-inset-bottom)); }
      .bottom-nav {
        display: grid; grid-template-columns: repeat(4, 1fr); position: fixed; bottom: 0; left: 0; right: 0; z-index: 10;
        background: rgb(255 253 249 / 97%); border-top: 1px solid var(--border); backdrop-filter: saturate(1.4) blur(10px);
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
  protected readonly incoming = inject(IncomingService);
  private readonly url = signal('');
  /** Anunțul porumbeilor de primit: pentru crescători, pe orice pagină în afară de Vânzări (unde sunt chiar ei). */
  protected readonly showIncoming = computed(() => {
    const a = this.auth.account();
    return !!a && !a.isAdmin && this.incoming.count() > 0 && !this.url().startsWith('/vanzari');
  });

  constructor() {
    this.router.events.subscribe((e) => {
      if (!(e instanceof NavigationEnd)) return;
      this.url.set(e.urlAfterRedirects);
      const a = this.auth.account();
      if (a && !a.isAdmin) this.incoming.refresh();
    });
    // La intrarea în cont se verifică imediat; la ieșire anunțul dispare.
    effect(() => {
      const a = this.auth.account();
      if (a && !a.isAdmin) this.incoming.refresh(true);
      else this.incoming.reset();
    });
  }
  /** Adminul (vânzătorul) are în plus consola. */
  /** Vânzătorul (adminul) vede doar consola și contul lui; porumbarul nu-l interesează. */
  protected readonly nav = computed<NavItem[]>(() =>
    this.auth.account()?.isAdmin ? [{ path: '/vanzator', label: 'Vânzător', icon: 'vinde' }, NAV[3]] : NAV,
  );
  /** Banda de sus pentru crescători: „doar citire” sau abonamentul care expiră curând. */
  protected readonly banner = computed(() => {
    const a = this.auth.account();
    const s = a?.subscription;
    if (!a || a.isAdmin || !s) return null;
    const how = a.sellerContact ? `Pentru activare: ${a.sellerContact}.` : 'Pentru activare, ia legătura cu cel de la care ai primit programul.';
    if (!s.active) {
      const why = s.status === 'expired' ? `Abonamentul a expirat pe ${fmt(s.end)}` : 'Contul nu este activ încă';
      return { kind: 'warning', text: `${why}: poți vedea și tipări porumbeii, dar nu poți adăuga sau schimba nimic. ${how}` };
    }
    if (s.status === 'expiring') return { kind: 'notice', text: `Abonamentul expiră pe ${fmt(s.end)} (peste ${s.daysLeft} ${s.daysLeft === 1 ? 'zi' : 'zile'}). ${how}` };
    return null;
  });

  async logout() {
    await this.auth.logout();
    this.router.navigateByUrl('/intra');
  }
}
