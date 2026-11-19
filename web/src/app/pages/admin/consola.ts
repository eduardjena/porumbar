import { UpperCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, errorMessage } from '../../core/api';
import { ConfirmService } from '../../core/confirm';
import { Icon } from '../../shared/icon';
import { IdentityFields, IdentityForm, emptyIdentity, identityBody } from './identity-fields';

type Status = 'pending' | 'active' | 'expiring' | 'expired';
interface Row {
  lang?: string;
  id: number;
  name: string;
  email: string;
  phone: string | null;
  kind: 'pf' | 'firma';
  sheetName: string | null;
  address: string | null;
  cnp: string | null;
  companyName: string | null;
  cui: string | null;
  regCom: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  lastLoginAt: string | null;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  status: Status;
  daysLeft: number | null;
  pigeons: number;
  /** Citirile din poze în anul curent de abonament: folosite / limită, costul lor în dolari. */
  reads: { used: number; allowed: number; perYear: number; costUsd: number };
  readsTotal: number;
  reminderSentAt: string | null;
  invited: boolean;
}
interface Event {
  kind: 'subscription' | 'credit' | 'password-link' | 'reminder' | 'created' | 'identity' | 'reads';
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
const EVENT_LABEL: Record<Event['kind'], string> = {
  subscription: 'Abonament', credit: 'Credit', 'password-link': 'Link parolă nouă', reminder: 'Memento trimis', created: 'Cont făcut', identity: 'Date pe fișă', reads: 'Citiri în plus',
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
function plusOneYear(start: string) {
  const [y, m, d] = start.split('-').map(Number);
  const end = new Date(Date.UTC(y + 1, m - 1, d));
  if (end.getUTCMonth() !== m - 1) end.setUTCDate(0);
  return iso(end);
}

/*
 * Consola vânzătorului (doar adminul): toți crescătorii, cu abonamentul, citirile din poze (câte și cât au costat) și câți porumbei au.
 * După plată: Activează / Prelungește (un an de la data aleasă); la nevoie, citiri în plus. Fără să vadă parola cuiva:
 * „Link de parolă nouă” (pe email, iar linkul apare și aici, ca să-l trimită pe telefon).
 */
@Component({
  selector: 'app-consola',
  imports: [FormsModule, Icon, IdentityFields, UpperCasePipe],
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
          <app-identity-fields [form]="nbIdent" id="nb" />
          <div class="grid2">
            <label class="field">Email <input type="email" [(ngModel)]="nb.email" name="nbEmail" autocomplete="off" /></label>
            <label class="field">Notă (opțional) <input [(ngModel)]="nb.note" name="nbNote" placeholder="de ex. plătit cash, 150 lei" /></label>
          </div>
          <label class="check"><input type="checkbox" [(ngModel)]="nb.activate" name="nbAct" /> A plătit deja: activează abonamentul</label>
          @if (nb.activate) {
            <div class="row">
              <label class="field">Începe pe <input type="date" [(ngModel)]="nb.start" name="nbStart" /></label>
              <span class="muted">→ ține până pe <strong>{{ nb.start ? date(endFor(nb.start)) : '—' }}</strong></span>
            </div>
          }
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
          <div class="thead" aria-hidden="true"><span>Crescător</span><span>Abonament</span><span>Ultima intrare</span><span>Citiri</span><span>Cost</span><span>Porumbei</span></div>
          @for (r of shown(); track r.id) {
            <button type="button" class="tr" [class.sel]="r.id === selectedId()" (click)="open(r.id)">
              <span class="who"><strong>{{ r.name }}</strong><span class="muted">@if (r.sheetName && r.sheetName !== r.name) { pe fișă: {{ r.sheetName }} · }@if (r.lang && r.lang !== 'ro') { limba: {{ r.lang | uppercase }} · }{{ r.email }}@if (r.phone) { · {{ r.phone }} }</span></span>
              <span class="sub">
                <span class="st" [class]="'st ' + r.status">{{ statusLabel[r.status] }}@if (r.invited) { <span class="inv">· n-a intrat încă</span> }</span>
                @if (r.subscriptionEnd) { <span class="muted">până pe {{ date(r.subscriptionEnd) }}@if (r.status === 'expiring') { ({{ r.daysLeft }} zile) }</span> }
              </span>
              <span class="seen" [title]="r.lastLoginAt ? 'Ultima intrare: ' + when(r.lastLoginAt) : 'Nu a intrat încă'">{{ ago(r.lastLoginAt) }}</span>
              <span class="mono" [class.full]="r.reads.used >= r.reads.allowed" [title]="'Citiri din poze în anul de abonament: ' + r.reads.used + ' din ' + r.reads.allowed">{{ r.reads.used }} / {{ r.reads.allowed }}</span>
              <span class="mono" title="Costul acestor citiri (cât plătești la Anthropic)">{{ money(r.reads.costUsd) }}</span>
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
            <p class="muted">{{ d.email }}@if (d.phone) { · {{ d.phone }} }<br />Cont din {{ date(d.createdAt) }} · ultima intrare: {{ d.lastLoginAt ? when(d.lastLoginAt) : 'încă niciuna' }} · ultima activitate: {{ d.lastSeenAt ? when(d.lastSeenAt) : '—' }} · {{ d.pigeons }} porumbei · {{ d.readsTotal }} citiri din poze de la început</p>

            <section class="stack box">
              <h3>Date pe fișă</h3>
              @if (editIdent(); as f) {
                <app-identity-fields [form]="f" id="ed" />
                <div class="row">
                  <button type="button" class="primary" (click)="saveIdentity(d, f)"><app-icon name="bifa" />Salvează</button>
                  <button type="button" (click)="editIdent.set(null)">Renunță</button>
                </div>
              } @else {
                @if (d.sheetName) {
                  <div class="sheet">
                    <strong>{{ d.sheetName }}</strong>
                    @if (d.address) { <span class="addr">{{ d.address }}</span> }
                    @if (d.phone) { <span>Tel.: {{ d.phone }}</span> }
                    <span>{{ d.email }}</span>
                  </div>
                } @else {
                  <p class="warning">Nu are încă nume pe fișă. Fără el abonamentul nu se poate activa.</p>
                }
                <p class="muted">@if (d.kind === 'firma') { Firmă: {{ d.companyName || '—' }} · CUI {{ d.cui || '—' }} · Reg. Com. {{ d.regCom || '—' }} · contact: {{ d.name }} } @else { Persoană fizică: {{ d.name }} · CNP {{ d.cnp || '—' }} }</p>
                <button type="button" (click)="startEdit(d)"><app-icon name="editeaza" />Modifică datele de pe fișă</button>
              }
            </section>

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
              <h3>Citiri din poze: {{ d.reads.used }} din {{ d.reads.allowed }} <span class="muted">· cost {{ money(d.reads.costUsd) }}</span></h3>
              <p class="muted">Incluse în abonament: {{ d.reads.perYear }} pe an (cel mult 20 pe zi). La prelungire contorul pornește iar de la zero.</p>
              <div class="row">
                <label class="field">Citiri în plus <input type="number" step="1" [(ngModel)]="extraReads" name="extraReads" /></label>
                <label class="field grow">Notă <input [(ngModel)]="readsNote" name="readsNote" placeholder="de ex. a cerut mai multe" /></label>
              </div>
              <button type="button" (click)="addReads(d)"><app-icon name="plus" />Dă citiri în plus</button>
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
    .thead, .tr { display: grid; grid-template-columns: minmax(0, 2.2fr) minmax(0, 1.6fr) 120px 90px 80px 70px; gap: 12px; align-items: center; padding: 10px 16px; }
    .thead { font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); border-bottom: 1px solid var(--border); }
    .full { color: var(--danger); font-weight: 700; }
    .tr { width: 100%; text-align: left; border: 0; border-bottom: 1px solid var(--border); border-radius: 0; background: none; font-weight: 400; min-height: 64px; }
    .tr:hover, .tr.sel { background: var(--accent-soft); }
    .who, .sub { display: flex; flex-direction: column; min-width: 0; }
    .who .muted { font-size: 0.88rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .sub .muted { font-size: 0.85rem; }
    .st { font-weight: 800; font-size: 0.9rem; }
    .seen { font-size: 0.9rem; }
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
    .sheet { display: flex; flex-direction: column; padding: 10px 12px; border: 1px dashed var(--border); border-radius: 10px; background: #fff; color: #2b2117; line-height: 1.35; }
    .sheet strong { font-size: 1.1rem; }
    .sheet .addr { white-space: pre-line; }
    @media (max-width: 1000px) {
      .wide { width: 100%; margin-left: 0; }
      .layout { grid-template-columns: 1fr; }
      .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .thead { display: none; }
      .tr { grid-template-columns: 1fr auto; }
      .tr > .mono, .tr > .seen { display: none; }
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
  nb = { email: '', note: '', activate: false, start: iso(new Date()) };
  nbIdent: IdentityForm = emptyIdentity();
  /** Formularul „Date pe fișă” deschis în fișa crescătorului (null = doar se văd). */
  readonly editIdent = signal<IdentityForm | null>(null);
  startDate = '';
  subNote = '';
  extraReads = 50;
  readsNote = '';

  protected readonly shown = computed(() => {
    const q = this.q().trim().toLowerCase();
    return this.rows().filter((r) => !q || [r.name, r.sheetName, r.companyName, r.email, r.phone].some((x) => String(x ?? '').toLowerCase().includes(q)));
  });
  protected readonly detail = computed(() => this.rows().find((r) => r.id === this.selectedId()) ?? null);
  protected readonly date = (v: string) => new Date(v.length === 10 ? `${v}T12:00:00Z` : v).toLocaleDateString('ro-RO');
  /** Data și ora, ca „16.11.2026, 19:09”. */
  protected readonly when = (v: string) => new Date(v).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  /** Cât de recent a intrat: „azi, 19:09”, „ieri”, „acum 5 zile”, „n-a intrat”. */
  protected readonly ago = (v: string | null) => {
    if (!v) return 'n-a intrat';
    const d = new Date(v);
    const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
    if (days <= 0) return `azi, ${d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}`;
    if (days === 1) return 'ieri';
    if (days < 30) return `acum ${days} zile`;
    return this.date(v);
  };
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
    this.editIdent.set(null);
    const r = this.rows().find((x) => x.id === id);
    // Prelungirea pornește de unde se termină abonamentul de acum; altfel de azi.
    this.startDate = r && (r.status === 'active' || r.status === 'expiring') && r.subscriptionEnd ? r.subscriptionEnd : iso(new Date());
    this.subNote = '';
    this.extraReads = 50;
    this.readsNote = '';
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

  startEdit(d: Row) {
    this.editIdent.set({
      kind: d.kind, name: d.name, cnp: d.cnp ?? '', companyName: d.companyName ?? '', cui: d.cui ?? '', regCom: d.regCom ?? '',
      sheetName: d.sheetName ?? '', phone: d.phone ?? '', address: d.address ?? '', lang: d.lang ?? 'ro',
    });
  }

  async saveIdentity(d: Row, f: IdentityForm) {
    if (!f.name.trim()) return this.error.set('Scrie numele.');
    try {
      await this.api.patch(`/admin/accounts/${d.id}/identity`, identityBody(f));
      this.editIdent.set(null);
      this.error.set('');
      await this.refresh(d.id);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async createBreeder() {
    const b = this.nb;
    const ident = identityBody(this.nbIdent);
    if (!ident.name || !b.email.trim()) return this.error.set('Scrie numele și emailul crescătorului.');
    if (b.activate && !ident.sheetName) return this.error.set('Ca să activezi abonamentul, scrie și numele de pe fișă.');
    const lines = [`${ident.name} · ${b.email.trim()}${ident.phone ? ' · ' + ident.phone : ''}`];
    if (ident.sheetName) lines.push(`Pe fișă: ${ident.sheetName}.`);
    lines.push(b.activate ? `Abonament de pe ${this.date(b.start)} până pe ${this.date(plusOneYear(b.start))} (confirmă doar dacă ai primit banii).` : 'Fără abonament deocamdată: contul e doar pentru citire până îl activezi.');
    const ok = await this.confirm.ask({ title: 'Faci contul acestui crescător?', lines, confirmLabel: 'Da, fă contul' });
    if (!ok) return;
    try {
      const r = await this.api.post<{ account: Row; link: string; emailed: boolean }>('/admin/accounts', {
        ...ident, email: b.email.trim(), note: b.note.trim() || null,
        activate: b.activate, start: b.activate ? b.start : undefined,
      });
      this.invite.set({ name: r.account.name, phone: r.account.phone, link: r.link, emailed: r.emailed });
      this.showNew.set(false);
      this.nb = { email: '', note: '', activate: false, start: iso(new Date()) };
      this.nbIdent = emptyIdentity();
      this.filter.set('');
      await this.load();
      await this.open(r.account.id);
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  async activate(d: Row) {
    if (!d.sheetName) return this.error.set('Pune întâi numele de pe fișă (la „Date pe fișă”), apoi activează abonamentul.');
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

  async addReads(d: Row) {
    const amount = Number(this.extraReads);
    if (!Number.isInteger(amount) || !amount) return this.error.set('Scrie câte citiri, de exemplu 50 (sau -10 ca să scazi).');
    const ok = await this.confirm.ask({
      title: `${amount > 0 ? 'Dai' : 'Scazi'} ${Math.abs(amount)} citiri ${amount > 0 ? 'în plus lui' : 'de la'} ${d.name}?`,
      lines: [`Pentru anul acesta de abonament poate citi ${Math.max(d.reads.perYear, d.reads.allowed + amount)} poze (a folosit ${d.reads.used}).`],
      confirmLabel: 'Da',
    });
    if (!ok) return;
    try {
      await this.api.post(`/admin/accounts/${d.id}/reads`, { amount, note: this.readsNote || null });
      await this.refresh(d.id);
      this.readsNote = '';
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
