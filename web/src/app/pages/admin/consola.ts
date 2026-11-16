import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService } from '../../core/confirm';
import { Icon } from '../../shared/icon';

type Status = 'pending' | 'active' | 'expiring' | 'expired';
interface Row {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  status: Status;
  daysLeft: number | null;
  aiCredit: number;
  pigeons: number;
  reads: number;
  reminderSentAt: string | null;
  invited: boolean;
}
interface Event {
  kind: 'subscription' | 'credit' | 'password-link' | 'reminder';
  amount: number | null;
  note: string | null;
  createdAt: string;
}
type Counts = Record<'all' | Status, number>;

const FILTERS: { id: '' | Status; label: string }[] = [
  { id: '', label: 'Toți' },
  { id: 'expiring', label: 'Expiră curând' },
  { id: 'pending', label: 'Neactivați' },
  { id: 'active', label: 'Activi' },
  { id: 'expired', label: 'Expirați' },
];
const STATUS_LABEL: Record<Status, string> = { pending: 'Neactivat', active: 'Activ', expiring: 'Expiră curând', expired: 'Expirat' };
const EVENT_LABEL: Record<Event['kind'], string> = { subscription: 'Abonament', credit: 'Credit', 'password-link': 'Link parolă nouă', reminder: 'Memento trimis' };

const iso = (d: Date) => d.toISOString().slice(0, 10);
function plusOneYear(start: string) {
  const [y, m, d] = start.split('-').map(Number);
  const end = new Date(Date.UTC(y + 1, m - 1, d));
  if (end.getUTCMonth() !== m - 1) end.setUTCDate(0);
  return iso(end);
}

/*
 * Consola vânzătorului (doar adminul): toți crescătorii, cu abonamentul, creditul pentru citiri și câți porumbei au.
 * După plată: Activează / Prelungește (un an de la data aleasă) și Adaugă credit. Fără să vadă parola cuiva:
 * „Link de parolă nouă” (pe email, iar linkul apare și aici, ca să-l trimită pe telefon).
 */
@Component({
  selector: 'app-consola',
  imports: [FormsModule, Icon],
  template: `
    <div class="wide">
      <div class="title-row">
        <h1>Consola vânzătorului</h1>
        <button type="button" class="primary" (click)="toggleNew()" [attr.aria-expanded]="showNew()"><app-icon name="plus" />Crescător nou</button>
      </div>

      @if (showNew()) {
        <section class="card stack new">
          <h2>Crescător nou</h2>
          <p class="muted">Faci contul pentru el. Primește un link (7 zile) cu care își alege singur parola și intră direct în porumbarul lui.</p>
          <div class="grid2">
            <label class="field">Nume <input [(ngModel)]="nb.name" name="nbName" autocomplete="off" /></label>
            <label class="field">Email <input type="email" [(ngModel)]="nb.email" name="nbEmail" autocomplete="off" /></label>
            <label class="field">Telefon (pentru WhatsApp) <input type="tel" [(ngModel)]="nb.phone" name="nbPhone" autocomplete="off" placeholder="07xx xxx xxx" /></label>
            <label class="field">Notă (opțional) <input [(ngModel)]="nb.note" name="nbNote" placeholder="de ex. plătit cash, 150 lei" /></label>
          </div>
          <label class="check"><input type="checkbox" [(ngModel)]="nb.activate" name="nbAct" /> A plătit deja: activează abonamentul</label>
          @if (nb.activate) {
            <div class="row">
              <label class="field">Începe pe <input type="date" [(ngModel)]="nb.start" name="nbStart" /></label>
              <span class="muted">→ ține până pe <strong>{{ nb.start ? date(endFor(nb.start)) : '—' }}</strong></span>
            </div>
          }
          <label class="field narrow">Credit pentru citirea pozelor ($, opțional) <input type="number" step="0.5" min="0" [(ngModel)]="nb.credit" name="nbCredit" /></label>
          <div class="row">
            <button type="button" class="primary" (click)="createBreeder()"><app-icon name="bifa" />Fă contul</button>
            <button type="button" (click)="toggleNew()">Renunță</button>
          </div>
        </section>
      }

      @if (invite(); as iv) {
        <section class="card stack new" role="status">
          <h2><app-icon name="bifa" />Contul lui {{ iv.name }} e făcut</h2>
          <p>Trimite-i linkul de mai jos (valabil 7 zile). Când îl deschide, își alege parola și intră.{{ iv.emailed ? ' L-am trimis și pe email.' : '' }}</p>
          <p class="link mono">{{ iv.link }}</p>
          <div class="row">
            <button type="button" (click)="copy(iv.link)"><app-icon name="copie" />{{ copied() ? 'Copiat' : 'Copiază linkul' }}</button>
            <a class="btn primary" [href]="whatsapp(iv)" target="_blank" rel="noopener"><app-icon name="trimite" />Trimite pe WhatsApp</a>
            <button type="button" (click)="invite.set(null)">Gata</button>
          </div>
        </section>
      }
      @if (mailConfigured() === false) {
        <p class="warning">Emailurile nu pleacă încă (lipsește setarea SMTP_URL pe server): memento-urile și linkurile de parolă apar doar aici, în consolă. Linkurile le poți trimite tu pe telefon.</p>
      }
      <div class="tiles" role="tablist" aria-label="Filtre">
        @for (f of filters; track f.id) {
          <button type="button" role="tab" class="tile" [class.on]="filter() === f.id" [class.warn]="f.id === 'expiring' && counts()?.expiring"
                  [attr.aria-selected]="filter() === f.id" (click)="setFilter(f.id)">
            <strong>{{ count(f.id) }}</strong><span>{{ f.label }}</span>
          </button>
        }
      </div>
      @if (counts()?.expiring) {
        <p class="warning">De încasat: {{ counts()!.expiring }} {{ counts()!.expiring === 1 ? 'abonament expiră' : 'abonamente expiră' }} în cel mult 30 de zile. Crescătorii au primit memento{{ mailConfigured() ? ' pe email' : ' (doar în consolă: emailul nu e configurat)' }}.</p>
      }
      <label class="search">
        <app-icon name="cautare" />
        <input type="search" placeholder="Caută după nume, email sau telefon" aria-label="Caută" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      </label>
      @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }

      <div class="layout">
        <div class="list">
          <div class="thead" aria-hidden="true"><span>Crescător</span><span>Abonament</span><span>Credit</span><span>Porumbei</span></div>
          @for (r of shown(); track r.id) {
            <button type="button" class="tr" [class.sel]="r.id === selectedId()" (click)="open(r.id)">
              <span class="who"><strong>{{ r.name }}</strong><span class="muted">{{ r.email }}@if (r.phone) { · {{ r.phone }} }</span></span>
              <span class="sub">
                <span class="st" [class]="'st ' + r.status">{{ statusLabel[r.status] }}@if (r.invited) { <span class="inv">· n-a intrat încă</span> }</span>
                @if (r.subscriptionEnd) { <span class="muted">până pe {{ date(r.subscriptionEnd) }}@if (r.status === 'expiring') { ({{ r.daysLeft }} zile) }</span> }
              </span>
              <span class="mono">{{ money(r.aiCredit) }}</span>
              <span class="mono">{{ r.pigeons }}</span>
            </button>
          } @empty {
            <p class="muted pad">{{ loaded() ? 'Niciun crescător aici.' : 'Se încarcă…' }}</p>
          }
        </div>

        @if (detail(); as d) {
          <aside class="card detail stack">
            <div class="row between">
              <h2>{{ d.name }}</h2>
              <button type="button" class="icon-btn" aria-label="Închide" (click)="selectedId.set(null)"><app-icon name="inchide" /></button>
            </div>
            @if (d.invited) { <p class="warning">Nu și-a ales încă parola. Dacă a pierdut linkul, trimite-i unul nou mai jos („Link de parolă nouă”, 7 zile).</p> }
            <p class="muted">{{ d.email }}@if (d.phone) { · {{ d.phone }} }<br />Cont din {{ date(d.createdAt) }} · ultima vizită: {{ d.lastSeenAt ? date(d.lastSeenAt) : '—' }} · {{ d.pigeons }} porumbei · {{ d.reads }} citiri din poze</p>

            <section class="stack box">
              <h3>Abonament <span class="st" [class]="'st ' + d.status">{{ statusLabel[d.status] }}</span></h3>
              @if (d.subscriptionStart) { <p>De pe {{ date(d.subscriptionStart) }} până pe {{ date(d.subscriptionEnd!) }}.@if (d.reminderSentAt) { Memento trimis pe {{ date(d.reminderSentAt) }}. }</p> }
              <div class="row">
                <label class="field">Începe pe <input type="date" [(ngModel)]="startDate" name="start" /></label>
                <span class="muted">→ ține până pe <strong>{{ startDate ? date(endFor(startDate)) : '—' }}</strong></span>
              </div>
              <label class="field">Notă (opțional) <input [(ngModel)]="subNote" name="subNote" placeholder="de ex. plătit cash, 150 lei" /></label>
              <button type="button" class="primary" (click)="activate(d)"><app-icon name="bifa" />{{ d.subscriptionStart ? 'Prelungește / schimbă abonamentul' : 'Activează abonamentul' }}</button>
            </section>

            <section class="stack box">
              <h3>Credit pentru citirea pozelor: {{ money(d.aiCredit) }}</h3>
              <div class="row">
                <label class="field">Suma ($) <input type="number" step="0.5" [(ngModel)]="creditAmount" name="amount" /></label>
                <label class="field grow">Notă <input [(ngModel)]="creditNote" name="creditNote" placeholder="de ex. plătit 25 lei" /></label>
              </div>
              <button type="button" (click)="addCredit(d)"><app-icon name="plus" />Adaugă creditul</button>
            </section>

            <section class="stack box">
              <h3>Nu mai poate intra?</h3>
              <p class="muted">Primește pe email un link (24 de ore; 7 zile dacă n-a intrat încă niciodată) cu care își alege singur parola. Linkul îl vezi și aici, ca să i-l trimiți pe telefon.</p>
              <button type="button" (click)="passwordLink(d)"><app-icon name="trimite" />Trimite link de parolă nouă</button>
              @if (link(); as l) {
                <p class="link mono">{{ l.link }}</p>
                <div class="row">
                  <button type="button" (click)="copy(l.link)"><app-icon name="copie" />{{ copied() ? 'Copiat' : 'Copiază linkul' }}</button>
                  <span class="muted">{{ l.emailed ? 'Trimis și pe email.' : 'Emailul nu a plecat: trimite-i linkul tu.' }}</span>
                </div>
              }
            </section>

            <section class="stack">
              <h3>Istoric</h3>
              @for (e of events(); track $index) {
                <div class="ev"><span class="muted">{{ date(e.createdAt) }}</span> <strong>{{ eventLabel[e.kind] }}</strong>@if (e.amount != null) { {{ money(e.amount) }} }@if (e.note) { · {{ e.note }} }</div>
              } @empty { <p class="muted">Nimic încă.</p> }
            </section>
          </aside>
        }
      </div>
    </div>
  `,
  styles: `
    .title-row { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }
    .title-row h1 { margin: 0; }
    .new { margin: 12px 0; }
    .new h2 { margin: 0; display: flex; align-items: center; gap: 10px; }
    .new p { margin: 0; }
    .grid2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 16px; }
    .narrow { max-width: 320px; }
    .inv { color: var(--muted); font-weight: 600; }
    @media (max-width: 767px) { .grid2 { grid-template-columns: 1fr; } }
    .wide { width: min(1400px, calc(100vw - 48px)); margin-left: calc((100% - min(1400px, 100vw - 48px)) / 2); }
    .tiles { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin: 8px 0 14px; }
    .tile { flex-direction: column; align-items: flex-start; gap: 2px; padding: 12px 16px; border-radius: 16px; background: var(--surface); }
    .tile strong { font-size: 1.6rem; }
    .tile.on { border-color: var(--accent); background: var(--accent-soft); }
    .tile.warn strong { color: var(--accent-strong); }
    .search { position: relative; display: block; max-width: 520px; margin-bottom: 12px; }
    .search > app-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
    .search input { padding-left: 50px; border-radius: 999px; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 440px; gap: 16px; align-items: start; }
    .layout:has(> .list:only-child) { grid-template-columns: 1fr; }
    .list { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
    .thead, .tr { display: grid; grid-template-columns: minmax(0, 2.2fr) minmax(0, 1.6fr) 90px 90px; gap: 12px; align-items: center; padding: 10px 16px; }
    .thead { font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); border-bottom: 1px solid var(--border); }
    .tr { width: 100%; text-align: left; border: 0; border-bottom: 1px solid var(--border); border-radius: 0; background: none; font-weight: 400; min-height: 64px; }
    .tr:hover, .tr.sel { background: var(--accent-soft); }
    .who, .sub { display: flex; flex-direction: column; min-width: 0; }
    .who .muted { font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sub .muted { font-size: 0.85rem; }
    .st { font-weight: 800; font-size: 0.9rem; }
    .st.active { color: var(--ok); }
    .st.expiring { color: var(--accent-strong); }
    .st.expired { color: var(--danger); }
    .st.pending { color: var(--muted); }
    .pad { padding: 16px; }
    .detail { position: sticky; top: 84px; max-height: calc(100dvh - 100px); overflow-y: auto; }
    .detail h2, .detail h3 { margin: 0; }
    .detail h3 { display: flex; gap: 10px; align-items: baseline; font-size: 1.05rem; }
    .detail p { margin: 0; }
    .box { border-top: 1px solid var(--border); padding-top: 12px; }
    .between { justify-content: space-between; align-items: center; }
    .grow { flex: 1; }
    .icon-btn { width: 48px; padding: 0; }
    .link { word-break: break-all; background: var(--surface-2); padding: 8px 10px; border-radius: 10px; font-size: 0.85rem; }
    .ev { font-size: 0.92rem; }
    @media (max-width: 1000px) {
      .wide { width: 100%; margin-left: 0; }
      .layout { grid-template-columns: 1fr; }
      .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .thead { display: none; }
      .tr { grid-template-columns: 1fr auto; }
      .tr > .mono { display: none; }
      .detail { position: static; max-height: none; }
    }
  `,
})
export default class Consola implements OnInit {
  private readonly api = inject(Api);
  private readonly confirm = inject(ConfirmService);
  protected readonly filters = FILTERS;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly eventLabel = EVENT_LABEL;
  readonly rows = signal<Row[]>([]);
  readonly counts = signal<Counts | null>(null);
  readonly mailConfigured = signal<boolean | null>(null);
  readonly filter = signal<'' | Status>('');
  readonly q = signal('');
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly selectedId = signal<number | null>(null);
  readonly events = signal<Event[]>([]);
  readonly link = signal<{ link: string; emailed: boolean } | null>(null);
  readonly copied = signal(false);
  readonly showNew = signal(false);
  readonly invite = signal<{ name: string; phone: string | null; link: string; emailed: boolean } | null>(null);
  nb = { name: '', email: '', phone: '', note: '', activate: false, start: iso(new Date()), credit: 0 };
  startDate = '';
  subNote = '';
  creditAmount = 5;
  creditNote = '';

  protected readonly shown = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.rows().filter((r) => !q || [r.name, r.email, r.phone].some((x) => String(x ?? '').toLowerCase().includes(q)));
  });
  protected readonly detail = computed(() => this.rows().find((r) => r.id === this.selectedId()) ?? null);
  protected readonly date = (v: string) => new Date(v.length === 10 ? `${v}T12:00:00Z` : v).toLocaleDateString('ro-RO');
  protected readonly money = (n: number) => `${n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
  protected readonly endFor = plusOneYear;
  protected count(id: '' | Status) {
    const c = this.counts();
    return c ? (id ? c[id] : c.all) : '–';
  }

  ngOnInit() {
    this.load();
  }

  async setFilter(f: '' | Status) {
    this.filter.set(f);
    await this.load();
  }

  private async load() {
    try {
      const r = await this.api.get<{ accounts: Row[]; counts: Counts; mailConfigured: boolean }>(`/admin/accounts${this.filter() ? `?filter=${this.filter()}` : ''}`);
      this.rows.set(r.accounts);
      this.counts.set(r.counts);
      this.mailConfigured.set(r.mailConfigured);
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loaded.set(true);
    }
  }

  async open(id: number) {
    this.selectedId.set(id);
    this.link.set(null);
    const r = this.rows().find((x) => x.id === id);
    // Prelungirea pornește de unde se termină abonamentul de acum; altfel de azi.
    this.startDate = r && (r.status === 'active' || r.status === 'expiring') && r.subscriptionEnd ? r.subscriptionEnd : iso(new Date());
    this.subNote = '';
    this.creditAmount = 5;
    this.creditNote = '';
    try {
      this.events.set((await this.api.get<{ events: Event[] }>(`/admin/accounts/${id}`)).events);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  private async refresh(id: number) {
    await this.load();
    if (this.rows().some((r) => r.id === id)) {
      this.events.set((await this.api.get<{ events: Event[] }>(`/admin/accounts/${id}`)).events);
    } else {
      // A ieșit din filtrul curent (de ex. din „Neactivați” după activare): arătăm tot.
      this.filter.set('');
      await this.load();
      this.events.set((await this.api.get<{ events: Event[] }>(`/admin/accounts/${id}`)).events);
    }
  }

  toggleNew() {
    this.showNew.set(!this.showNew());
    this.error.set('');
  }

  /** Mesajul pentru WhatsApp; cu telefon, direct în conversația lui (07xx → +407xx). */
  protected whatsapp(iv: { name: string; phone: string | null; link: string }) {
    const text = `Bună ziua, ${iv.name}! V-am făcut contul în Porumbar. Deschideți linkul, alegeți-vă o parolă și intrați: ${iv.link}`;
    let digits = (iv.phone ?? '').replace(/\D/g, '');
    if (digits.startsWith('0')) digits = `40${digits.slice(1)}`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
  }

  async createBreeder() {
    const b = this.nb;
    if (!b.name.trim() || !b.email.trim()) return this.error.set('Scrie numele și emailul crescătorului.');
    const credit = Number(b.credit) || 0;
    const lines = [`${b.name.trim()} · ${b.email.trim()}${b.phone.trim() ? ' · ' + b.phone.trim() : ''}`];
    lines.push(b.activate ? `Abonament de pe ${this.date(b.start)} până pe ${this.date(plusOneYear(b.start))} (confirmă doar dacă ai primit banii).` : 'Fără abonament deocamdată: contul e doar pentru citire până îl activezi.');
    if (credit > 0) lines.push(`Credit pentru citiri: ${this.money(credit)}.`);
    const ok = await this.confirm.ask({ title: 'Faci contul acestui crescător?', lines, confirmLabel: 'Da, fă contul' });
    if (!ok) return;
    try {
      const r = await this.api.post<{ account: Row; link: string; emailed: boolean }>('/admin/accounts', {
        name: b.name.trim(), email: b.email.trim(), phone: b.phone.trim() || null, note: b.note.trim() || null,
        activate: b.activate, start: b.activate ? b.start : undefined, credit,
      });
      this.invite.set({ name: r.account.name, phone: r.account.phone, link: r.link, emailed: r.emailed });
      this.showNew.set(false);
      this.nb = { name: '', email: '', phone: '', note: '', activate: false, start: iso(new Date()), credit: 0 };
      this.filter.set('');
      await this.load();
      await this.open(r.account.id);
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async activate(d: Row) {
    if (!this.startDate) return this.error.set('Alege data de început.');
    const ok = await this.confirm.ask({
      title: `${d.subscriptionStart ? 'Prelungești' : 'Activezi'} abonamentul lui ${d.name}?`,
      lines: [`De pe ${this.date(this.startDate)} până pe ${this.date(plusOneYear(this.startDate))}.`, 'Confirmă doar după ce ai primit banii.'],
      confirmLabel: 'Da, activează',
    });
    if (!ok) return;
    try {
      await this.api.post(`/admin/accounts/${d.id}/subscription`, { start: this.startDate, note: this.subNote || null });
      await this.refresh(d.id);
      // Următoarea prelungire ar porni de la noul sfârșit.
      this.startDate = this.detail()?.subscriptionEnd ?? this.startDate;
      this.subNote = '';
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async addCredit(d: Row) {
    const amount = Number(this.creditAmount);
    if (!amount) return this.error.set('Scrie suma în dolari.');
    const ok = await this.confirm.ask({
      title: `${amount > 0 ? 'Adaugi' : 'Scazi'} ${this.money(Math.abs(amount))} lui ${d.name}?`,
      lines: [`Creditul pentru citirea pozelor devine ${this.money(Math.max(0, d.aiCredit + amount))}.`],
      confirmLabel: 'Da',
    });
    if (!ok) return;
    try {
      await this.api.post(`/admin/accounts/${d.id}/credit`, { amount, note: this.creditNote || null });
      await this.refresh(d.id);
      this.creditNote = '';
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async passwordLink(d: Row) {
    const ok = await this.confirm.ask({
      title: `Trimiți un link de parolă nouă lui ${d.name}?`,
      lines: [`Pleacă pe ${d.email}. Parola veche merge în continuare până când își alege una nouă.`],
      confirmLabel: 'Da, trimite',
    });
    if (!ok) return;
    try {
      this.link.set(await this.api.post<{ link: string; emailed: boolean; hours: number }>(`/admin/accounts/${d.id}/password-link`));
      this.events.set((await this.api.get<{ events: Event[] }>(`/admin/accounts/${d.id}`)).events);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      /* omul copiază de mână */
    }
  }
}
