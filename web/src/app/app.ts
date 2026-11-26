import { Component, ElementRef, HostListener, afterRenderEffect, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { IncomingService } from './core/incoming';
import { AuthService } from './core/auth';
import { Icon, IconName } from './shared/icon';
import { ConfirmDialog } from './core/confirm';
import { TPipe, currentLang, formatDay, t } from './core/i18n';

interface NavItem {
  path: string;
  /** Cheia din dicționar. */
  label: string;
  icon: IconName;
  exact?: boolean;
  /** Alte pagini din aceeași parte a aplicației: butonul rămâne aprins și pe ele. */
  also?: RegExp;
}

/** Un submeniu din bandă: unde duce și dacă e aprins. */
interface BandItem {
  label: string;
  icon: IconName;
  link: string[];
  query?: Record<string, string | undefined>;
  on: boolean;
  /** Numărul din colț (de ex. porumbeii care vin la tine). */
  badge?: number;
}

const TREE_VIEWS: { id: string; label: string; icon: IconName }[] = [
  { id: 'carduri', label: 'arbore.vedere_carduri', icon: 'panou' },
  { id: 'evantai', label: 'arbore.vedere_evantai', icon: 'rotire' },
  { id: 'sange', label: 'arbore.vedere_sange', icon: 'ramificare' },
  { id: 'retea', label: 'arbore.vedere_retea', icon: 'retea' },
];
const PIGEON_TABS: { id: string; label: string; icon: IconName }[] = [
  { id: 'fisa', label: 'porumbel.fila_fisa', icon: 'porumbel' },
  { id: 'rezultate', label: 'porumbel.fila_rezultate', icon: 'cupa' },
  { id: 'introdu', label: 'porumbel.fila_introdu', icon: 'plus' },
  { id: 'rude', label: 'porumbel.fila_rude', icon: 'rude' },
  { id: 'arbore', label: 'porumbel.fila_arbore', icon: 'fisa' },
  { id: 'jurnal', label: 'porumbel.fila_jurnal', icon: 'jurnal' },
  { id: 'qr', label: 'porumbel.fila_qr', icon: 'qr' },
];

const NAV: NavItem[] = [
  // Panoul: Grilă / Listă / Rezultate, fișa unui porumbel și ce se deschide din panou (rezultate concurs, scanare, tratamente).
  { path: '/panou', label: 'meniu.panou', icon: 'panou', also: /^\/(porumbar|concursuri|scaneaza|tratamente|porumbei\/(\d+|pedigree|excel))(\/|\?|$)/ },
  { path: '/arbore', label: 'meniu.arbore', icon: 'copac' },
  { path: '/perechi', label: 'meniu.perechi', icon: 'ou' },
  { path: '/porumbei/nou', label: 'meniu.adauga', icon: 'plus', exact: true },
  // Vânzări: porumbeii trimiși de alți crescători (cu numărul lor deasupra) și cei vânduți de om.
  { path: '/vanzari', label: 'meniu.vanzari', icon: 'vinde' },
  { path: '/cont', label: 'meniu.cont', icon: 'cont' },
];

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, Icon, ConfirmDialog, TPipe],
  template: `
    @if (auth.account()) {
      <header class="top">
        <!-- Conținutul antetului are aceeași lățime ca pagina: meniul se aliniază cu marginea din dreapta a conținutului. -->
        <div class="top-inner">
        <a routerLink="/panou" class="brand" [attr.aria-label]="'meniu.brand' | t">
          <img class="brand-mark" src="/icon.svg" alt="" width="40" height="40" />
          Pigeonrama
        </a>
        <nav #topNav class="top-nav" [attr.aria-label]="'meniu.meniu' | t">
          @for (n of nav(); track n.path) {
            <a [routerLink]="n.path" [class.on]="isOn(n)" [attr.aria-current]="isOn(n) ? 'page' : null" [attr.aria-label]="ariaOf(n)">
              <span class="ico"><app-icon [name]="n.icon" [size]="22" />@if (badgeOf(n); as b) { <span class="badge" aria-hidden="true">{{ b }}</span> }</span>{{ n.label | t }}
            </a>
          }
        </nav>
        </div>
        <!-- Banda de submeniuri (macheta A): ce are partea în care ești; stă lipită sus, cu meniul mare. -->
        @if (band(); as b) {
          <nav class="band" [attr.aria-label]="'meniu.submeniu' | t">
            <div class="band-inner">
              <!-- Rândul pornește sub butonul din meniul mare de care ține (alignBand). -->
              <div #bandRow class="band-row">
              @for (i of b.items; track i.label) {
                <a class="pill" [routerLink]="i.link" [queryParams]="i.query ?? null" [class.on]="i.on" [attr.aria-current]="i.on ? 'page' : null">
                  <app-icon [name]="i.icon" [size]="18" />{{ i.label | t }}@if (i.badge) { <span class="count">{{ i.badge > 9 ? '9+' : i.badge }}</span> }
                </a>
              }
              </div>
            </div>
          </nav>
        }
      </header>
    }
    <app-confirm-dialog />
    <main [class.with-bottom]="auth.account()">
      @if (banner(); as b) { <div class="sub-banner no-print" [class]="'sub-banner ' + b.kind" role="status">{{ b.text }}</div> }
      <router-outlet />
      <!-- Semnătura: pe calculator mic în colțul din dreapta jos, pe telefon la capătul paginii. -->
      <a class="made-by no-print" href="https://www.soopra.com" target="_blank" rel="noopener">Soopra</a>
    </main>
    @if (auth.account()) {
      <!-- Pe telefon, meniul stă jos, la îndemâna degetului mare. -->
      <nav class="bottom-nav" [attr.aria-label]="'meniu.meniu' | t">
        @for (n of nav(); track n.path) {
          <a [routerLink]="n.path" [class.on]="isOn(n)" [attr.aria-current]="isOn(n) ? 'page' : null" [class.add]="n.icon === 'plus'" [attr.aria-label]="ariaOf(n)">
            <span class="ico"><app-icon [name]="n.icon" [size]="n.icon === 'plus' ? 30 : 28" />@if (badgeOf(n); as b) { <span class="badge" aria-hidden="true">{{ b }}</span> }</span>
            <span class="lbl">{{ n.label | t }}</span>
          </a>
        }
      </nav>
    }
  `,
  styles: `
    .sub-banner { margin-bottom: 14px; font-weight: 600; }
    /* Numărul de porumbei trimiși de alți crescători, ca o notificare deasupra iconiței Vânzări. */
    .top-nav .ico, .bottom-nav .ico { position: relative; }
    .top-nav .ico { display: inline-grid; }
    /* Sus, în meniul de pe calculator: bulina mai mică, deasupra iconiței, fără să intre peste text. */
    .top-nav .badge { top: -9px; right: -5px; min-width: 18px; height: 18px; padding: 0 4px; font-size: 0.7rem; }
    .badge {
      position: absolute; top: -7px; right: -9px; min-width: 20px; height: 20px; padding: 0 5px; border-radius: 999px;
      display: grid; place-items: center; background: #c62828; color: #fff; font-size: 0.75rem; font-weight: 800; line-height: 1;
      box-shadow: 0 0 0 2px var(--surface);
    }
    /* Rândul meniului mare pe fundal închis; banda de submeniuri, dedesubt, rămâne deschisă. */
    .top {
      background: #e4d8c4; border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 10; backdrop-filter: saturate(1.4) blur(10px);
    }
    /* Rândul de sus are înălțime fixă; butoanele meniului îl umplu de sus până jos (celule, nu pastile). */
    .top-inner {
      max-width: 1120px; margin: 0 auto; padding: 0 24px; min-height: 68px;
      display: flex; align-items: stretch; justify-content: flex-start; gap: 16px;
    }
    /* Banda de submeniuri: celule ca în meniul mare (evidențierea pe toată celula); pe telefon se derulează cu degetul. */
    .band { background: var(--surface); }
    .band-inner {
      max-width: 1120px; margin: 0 auto; padding: 0 24px; display: flex; overflow-x: auto; scrollbar-width: none;
    }
    .band-inner::-webkit-scrollbar { display: none; }
    .band-row { display: flex; gap: 0; width: max-content; }
    /* Când nu încap de sub meniul părinte până la margine: celule mai înguste, cu literă mai mică. */
    .band-row.compact .pill { padding: 0 10px; gap: 4px; font-size: 0.82rem; }
    .band-row.compact .pill.on { font-size: 0.94rem; }
    .pill {
      flex: none; display: inline-flex; align-items: center; gap: 6px; min-height: 48px; padding: 0 14px; border-radius: 0; white-space: nowrap;
      background: none; border: 0; color: var(--muted); font-weight: 500; font-size: 0.9rem; text-decoration: none; box-shadow: none;
    }
    .pill:hover { background: none; color: var(--text); }
    /* Submeniul ales: doar litera (îngroșată, mai mare, neagră), ca la meniul mare. */
    .pill.on { color: var(--text); font-weight: 800; font-size: 1.02rem; }
    .pill .count { min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; display: inline-grid; place-items: center; background: #c62828; color: #fff; font-size: 0.75rem; font-weight: 800; }
    .brand { font-weight: 800; font-size: 1.2rem; color: var(--text); text-decoration: none; display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 10px 0; letter-spacing: -0.01em; }
    .brand-mark { width: 40px; height: 40px; display: block; }
    /* Meniul mare la mijlocul spațiului dintre siglă și marginea din dreapta („Ieși” stă în Cont → Ieșire și ștergere). */
    .top-nav { display: flex; gap: 0; align-items: stretch; flex: 1 1 auto; justify-content: center; margin-left: 8px; }
    /* Fără celule și fără linii: butonul ales se vede doar prin literă (îngroșată, mai mare, neagră); restul, gri. */
    .top-nav a {
      padding: 0 16px; border-radius: 0; color: var(--muted); text-decoration: none; min-height: 48px; box-shadow: none;
      display: inline-flex; align-items: center; gap: 8px; font-weight: 500; font-size: 1rem; background: none; border: 0;
    }
    .top-nav a:hover { background: none; color: var(--text); }
    .top-nav a.on { color: var(--text); font-weight: 800; font-size: 1.12rem; }
    /* Calculatoare mai înguste / tablete: meniul de sus mai strâns (iconița deasupra textului), ca să încapă tot. */
    @media (min-width: 768px) and (max-width: 1060px) {
      .top-nav a { flex-direction: column; justify-content: center; gap: 2px; padding: 0 10px; font-size: 0.8rem; }
      .top-nav a.on { font-size: 0.92rem; }
    }
    @media (min-width: 768px) and (max-width: 900px) {
      .brand { font-size: 0; gap: 0; }
    }
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
      .band-inner { padding: 0 16px; }
      .pill { font-size: 0.85rem; padding: 0 12px; }
      .pill.on { font-size: 0.98rem; }
      .top-nav { display: none; }
      main { padding: 16px 16px 24px; }
      main.with-bottom { padding-bottom: calc(108px + env(safe-area-inset-bottom)); }
      .bottom-nav {
        display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; position: fixed; bottom: 0; left: 0; right: 0; z-index: 10;
        background: rgb(255 253 249 / 97%); border-top: 1px solid var(--border); backdrop-filter: saturate(1.4) blur(10px);
        padding: 0 0 env(safe-area-inset-bottom);
      }
      .bottom-nav a {
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
        min-height: 72px; padding: 4px 0; min-width: 0; color: var(--muted); text-decoration: none; font-size: 0.8rem; font-weight: 500; white-space: nowrap;
      }
      .bottom-nav .badge { top: -4px; right: 2px; min-width: 22px; height: 22px; font-size: 0.8rem; }
      .bottom-nav .ico { width: 52px; height: 40px; display: grid; place-items: center; }
      /* Și jos: doar litera (îngroșată, mai mare, neagră). */
      .bottom-nav a.on { color: var(--text); font-weight: 800; font-size: 0.9rem; }
      .bottom-nav a.add .ico { width: 52px; height: 40px; background: var(--accent); color: #fff; border-radius: 14px; }
      .bottom-nav a.add.on .ico { background: var(--accent-strong); }
      /* Japoneza: „アカウント” e mai lat decât o șesime de ecran; coloane după text, cu aceeași mărime a literei. */
      :host-context(html[lang="ja"]) .bottom-nav { grid-auto-columns: auto; }
      :host-context(html[lang="ja"]) .bottom-nav a .ico { width: 44px; }
    }
  `,
})
export class App {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  protected readonly incoming = inject(IncomingService);
  /** Numărul de deasupra iconiței Vânzări: porumbeii trimiși de alți crescători, care așteaptă să fie primiți. */
  protected badgeOf(n: NavItem): string | null {
    if (n.path !== '/vanzari') return null;
    const c = this.incoming.count();
    return c > 0 ? (c > 9 ? '9+' : String(c)) : null;
  }
  protected ariaOf(n: NavItem): string | null {
    const c = n.path === '/vanzari' ? this.incoming.count() : 0;
    return c > 0 ? t('meniu.de_primit', { eticheta: t(n.label), count: c }) : null;
  }

  /** Adresa curentă, ca butonul din meniu să știe când e aprins. */
  private readonly url = signal(this.router.url);
  /** Câte pagini s-au deschis în aplicație (pentru „Înapoi”: fără istoric, duce la Panou). */

  /** Submeniurile părții în care ești (Panou, fișa unui porumbel, Arbore); altundeva banda nu apare. */
  protected readonly band = computed<{ items: BandItem[] } | null>(() => {
    const tree = this.router.parseUrl(this.url());
    const path = this.url().split(/[?#]/)[0];
    const q = tree.queryParams as Record<string, string | undefined>;
    const panou: [string, string, IconName, boolean][] = [
      ['/panou', 'panou.sub_porumbei', 'panou', path === '/panou'],
      ['/porumbar', 'vedere.lista', 'lista', path === '/porumbar'],
      ['/concursuri', 'panou.rezultate_concurs', 'cupa', path.startsWith('/concursuri')],
      ['/porumbei/pedigree', 'panou.importa_pedigree', 'fisa', path === '/porumbei/pedigree'],
      ['/porumbei/excel', 'panou.din_excel', 'tabel', path === '/porumbei/excel'],
      ['/scaneaza', 'panou.scaneaza_qr', 'qr', path === '/scaneaza'],
      ['/tratamente', 'meniu.tratamente', 'tratament', path === '/tratamente' || path.startsWith('/tratamente/')],
    ];
    if (panou.some(([, , , on]) => on)) return { items: panou.map(([link, label, icon, on]) => ({ link: [link], label, icon, on })) };
    const pigeon = /^\/porumbei\/(\d+)$/.exec(path);
    if (pigeon) {
      const id = pigeon[1];
      const fila = PIGEON_TABS.some((x) => x.id === q['fila']) ? q['fila'] : 'fisa';
      // De unde a venit omul (din=, radacina=…) rămâne în adresă, ca firimiturile să-l ducă înapoi acolo.
      const keep = { din: q['din'], radacina: q['radacina'], tot: q['tot'], vedere: q['vedere'] };
      return {
        items: [
          ...PIGEON_TABS.map((x) => ({ link: ['/porumbei', id], query: { ...keep, fila: x.id === 'fisa' ? undefined : x.id }, label: x.label, icon: x.icon, on: fila === x.id })),
          { link: ['/arbore'], query: { porumbel: id }, label: 'porumbel.vezi_in_arbore', icon: 'copac' as IconName, on: false },
        ],
      };
    }
    // Perechi, Vânzări și Cont: fiecare parte a paginii e un submeniu (?sec=).
    const sec = q['sec'];
    if (path === '/perechi' || /^\/perechi\/\d+$/.test(path)) {
      const list = path === '/perechi';
      const current = !list ? null : sec === 'noua' || sec === 'inele' ? sec : 'sezon';
      const keep = { sezon: q['sezon'] };
      return {
        items: [
          { link: ['/perechi'], query: { ...keep, sec: undefined }, label: 'perechi.sub_sezon', icon: 'ou' as IconName, on: current === 'sezon' },
          { link: ['/perechi'], query: { ...keep, sec: 'noua' }, label: 'perechi.pereche_noua', icon: 'plus' as IconName, on: current === 'noua' },
          { link: ['/perechi'], query: { sec: 'inele' }, label: 'perechi.inelele_mele', icon: 'lista' as IconName, on: current === 'inele' },
        ],
      };
    }
    if (path === '/vanzari') {
      const sold = sec === 'vandute';
      return {
        items: [
          { link: ['/vanzari'], query: { sec: undefined }, label: 'vanzari.sub_vin', icon: 'porumbel' as IconName, on: !sold, badge: this.incoming.count() },
          { link: ['/vanzari'], query: { sec: 'vandute' }, label: 'vanzari.vandute', icon: 'vinde' as IconName, on: sold },
        ],
      };
    }
    if (path === '/cont') {
      const admin = !!this.auth.account()?.isAdmin;
      const all: [string, string, IconName][] = [
        ...(admin ? [] : [['abonament', 'cont.abonament', 'bifa'] as [string, string, IconName]]),
        ['fisa', 'cont.date_fisa', 'fisa'],
        ['apare', 'cont.sub_apare', 'editeaza'],
        ['cod', 'cont.sub_cod', 'cupa'],
        ['limba', 'cont.limba', 'lista'],
        ['amintiri', 'cont.sub_amintiri', 'clopot'],
        ['iesire', 'cont.sub_iesire', 'iesire'],
      ];
      const current = all.some(([k]) => k === sec) ? sec : all[0][0];
      return { items: all.map(([k, label, icon], i) => ({ link: ['/cont'], query: { sec: i === 0 ? undefined : k }, label, icon, on: current === k })) };
    }
    if (path === '/arbore') {
      const fallback = this.auth.account()?.treeView;
      const current = TREE_VIEWS.some((v) => v.id === q['vedere']) ? q['vedere'] : TREE_VIEWS.some((v) => v.id === fallback) ? fallback : 'carduri';
      return {
        items: TREE_VIEWS.map((v) => ({ link: ['/arbore'], query: { porumbel: q['porumbel'], tot: q['tot'], vedere: v.id }, label: v.label, icon: v.icon, on: current === v.id })),
      };
    }
    return null;
  });

  private readonly topNav = viewChild<ElementRef<HTMLElement>>('topNav');
  private readonly bandRow = viewChild<ElementRef<HTMLElement>>('bandRow');

  /**
   * Banda pornește sub butonul din meniul mare de care ține și merge spre dreapta. Dacă nu încape până la margine,
   * butoanele se fac mai mici; dacă tot nu încape, rândul se trage spre stânga cât trebuie. Pe telefon (meniul mare e
   * jos) pornește de la margine și se derulează cu degetul.
   */
  private alignBand() {
    const row = this.bandRow()?.nativeElement;
    if (!row) return;
    const box = row.parentElement as HTMLElement;
    const nav = this.topNav()?.nativeElement;
    const parent = nav && getComputedStyle(nav).display !== 'none' ? nav.querySelector<HTMLElement>('a.on') : null;
    row.style.marginLeft = '0px';
    row.classList.remove('compact');
    if (!parent) return;
    const cs = getComputedStyle(box);
    const contentLeft = box.getBoundingClientRect().left + parseFloat(cs.paddingLeft);
    const room = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    let start = Math.max(0, Math.round(parent.getBoundingClientRect().left - contentLeft));
    if (row.offsetWidth > room - start) {
      row.classList.add('compact');
      if (row.offsetWidth > room - start) start = Math.max(0, room - row.offsetWidth);
    }
    row.style.marginLeft = `${start}px`;
  }

  @HostListener('window:resize')
  protected onResize() {
    this.alignBand();
  }

  protected isOn(n: NavItem): boolean {
    const url = this.url();
    const path = url.split(/[?#]/)[0];
    const own = n.exact ? path === n.path : path === n.path || path.startsWith(`${n.path}/`);
    return own || !!n.also?.test(url);
  }

  constructor() {
    // După fiecare desenare în care s-a schimbat banda (alt meniu, altă pagină), ea se așază sub meniul părinte; și ori de
    // câte ori meniul mare sau banda își schimbă mărimea (literele se încarcă mai târziu, fereastra se lărgește).
    const sizes = typeof ResizeObserver === 'function' ? new ResizeObserver(() => this.alignBand()) : null;
    afterRenderEffect((onCleanup) => {
      this.band();
      this.url();
      const nav = this.topNav()?.nativeElement;
      const row = this.bandRow()?.nativeElement;
      this.alignBand();
      if (!sizes) return;
      if (nav) sizes.observe(nav);
      if (row?.parentElement) sizes.observe(row.parentElement);
      onCleanup(() => sizes.disconnect());
    });
    document.fonts?.ready.then(() => this.alignBand()).catch(() => undefined);
    this.router.events.subscribe((e) => {
      if (!(e instanceof NavigationEnd)) return;
      this.url.set(e.urlAfterRedirects);
      const a = this.auth.account();
      if (a && !a.isAdmin) this.incoming.refresh();
    });
    // La intrarea în cont se verifică imediat; la ieșire numărul dispare.
    effect(() => {
      const a = this.auth.account();
      if (a && !a.isAdmin) this.incoming.refresh(true);
      else this.incoming.reset();
    });
    // Titlul paginii (din app.routes) se reface când se schimbă limba, fără să mai navigheze omul.
    effect(() => {
      currentLang();
      untracked(() => {
        let r = this.router.routerState.snapshot.root;
        while (r.firstChild) r = r.firstChild;
        const title = r.routeConfig?.title;
        if (typeof title === 'function') this.title.setTitle((title as () => string)());
      });
    });
  }
  /** Adminul (vânzătorul) are în plus consola. */
  /** Vânzătorul (adminul) vede doar consola și contul lui; porumbarul nu-l interesează. */
  protected readonly nav = computed<NavItem[]>(() =>
    this.auth.account()?.isAdmin ? [{ path: '/vanzator', label: 'meniu.vanzator', icon: 'vinde' }, NAV[NAV.length - 1]] : NAV,
  );
  /** Banda de sus pentru crescători: „doar citire” sau abonamentul care expiră curând. */
  protected readonly banner = computed(() => {
    const a = this.auth.account();
    const s = a?.subscription;
    if (!a || a.isAdmin || !s) return null;
    // Fraza de activare începe cu un spațiu (aceleași chei ca la erorile „doar citire” de pe server).
    const activare = a.sellerContact ? t('eroare.activare_contact', { contact: a.sellerContact }) : t('eroare.activare_vanzator');
    if (!s.active) {
      const text = s.status === 'expired' ? t('banda.expirat', { data: formatDay(s.end), activare }) : t('banda.neactivat', { activare });
      return { kind: 'warning', text };
    }
    if (s.status === 'expiring') return { kind: 'notice', text: t('banda.expira', { data: formatDay(s.end), count: s.daysLeft, activare }) };
    return null;
  });

}
