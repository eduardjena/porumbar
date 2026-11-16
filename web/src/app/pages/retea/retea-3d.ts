import { Component, ElementRef, OnDestroy, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { sexLabel } from '../../core/catalog';
import { Network, NetworkNode, PigeonSummary } from '../../core/models';
import { Icon } from '../../shared/icon';

/*
 * Arborele în 3D (la buton; 2D rămâne vederea de pornire). Fiecare porumbel e o sferă; înălțimea = anul nașterii
 * (strămoșii jos, puii sus); mărimea = câți pui are; culoarea = nota. Pe linii curg mici „pulsuri” de la părinți spre pui.
 * Biblioteca 3D (three.js + 3d-force-graph) se încarcă doar pe această pagină.
 */

interface Node3D extends NetworkNode {
  x?: number;
  y?: number;
  z?: number;
  fy?: number;
}
interface Link3D {
  source: number | Node3D;
  target: number | Node3D;
  role: 'father' | 'mother';
}

// Culorile scenei: fundal închis, cald (spațiu), sfere luminoase în tonurile paletei „Pământ”.
const BG = '#17120e';
const BAND = ['#8a7f73', '#cfe3a6', '#b5d67a', '#93c25b', '#74ad3c', '#5a9a2a']; // 0 = fără date … 5 = cei mai buni
const EXTERNAL = '#c9b49b';
const ROOT = '#ff7a4d';
const FATHER = '#8fb6e6';
const MOTHER = '#e7a3cc';
const DIM = '#3a3029';

@Component({
  selector: 'app-retea-3d',
  imports: [RouterLink, Icon],
  template: `
    <div class="head">
      <div>
        <h1>Arborele în 3D</h1>
        <p class="muted intro">Sus sunt cei mai tineri, jos strămoșii. Sferele mari au mulți pui. Atinge o sferă ca să-i vezi ramurile; dublu clic deschide fișa.</p>
      </div>
      <a class="btn" [routerLink]="['/arbore']" [queryParams]="back()"><app-icon name="ramificare" />Înapoi la 2D</a>
    </div>

    @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }

    <div class="stage">
      <div #scene class="scene" role="img" aria-label="Arborele porumbarului în trei dimensiuni"></div>
      <div class="hint" aria-hidden="true">Trage ca să rotești · rotița sau două degete pentru mărire</div>
      <div class="legend">
        <span><i class="dot" style="background:#5a9a2a"></i>notă mare</span>
        <span><i class="dot" style="background:#cfe3a6"></i>notă mică</span>
        <span><i class="dot" style="background:#c9b49b"></i>din alt porumbar</span>
        <span><i class="line" style="background:#8fb6e6"></i>tată</span>
        <span><i class="line" style="background:#e7a3cc"></i>mamă</span>
      </div>
      <div class="tools">
        <button type="button" (click)="toggleSpin()" [attr.aria-pressed]="spinning()" [title]="spinning() ? 'Oprește rotirea' : 'Pornește rotirea'">
          {{ spinning() ? 'Oprește rotirea' : 'Rotește' }}
        </button>
        <button type="button" (click)="fit()" title="Arată tot arborele"><app-icon name="panou" />Arată tot</button>
      </div>
    </div>

    @if (selected(); as s) {
      <aside class="selected card" aria-live="polite">
        <div class="sel-body">
          <span class="score" [class]="'score band-' + s.band">{{ s.score ?? '–' }}</span>
          <div>
            <div><strong class="mono">{{ s.ring }}</strong> @if (s.name) { <span class="name">{{ s.name }}</span> }</div>
            <div class="muted">{{ sexText(s.sex) }}@if (s.year) { · {{ s.year }} } · {{ s.offspringCount }} pui@if (s.kind === 'external') { · din alt porumbar }</div>
          </div>
          <button type="button" class="icon-btn" aria-label="Închide" title="Închide" (click)="clearSelection()"><app-icon name="inchide" /></button>
        </div>
        <div class="row">
          <a class="btn primary" [routerLink]="['/porumbei', s.id]" [queryParams]="from()"><app-icon name="fisa" />Deschide fișa</a>
          <a class="btn" [routerLink]="['/arbore/3d']" [queryParams]="{ porumbel: s.id }"><app-icon name="retea" />Pornește de aici</a>
        </div>
      </aside>
    }
  `,
  styles: `
    .head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
    .head h1 { margin-bottom: 4px; }
    .intro { margin: 0 0 12px; max-width: 70ch; }
    .stage { position: relative; border-radius: var(--radius); overflow: hidden; background: ${BG}; box-shadow: var(--shadow); }
    .scene { height: max(460px, calc(100dvh - 300px)); }
    .hint { position: absolute; left: 16px; top: 14px; color: #e9dccb; font-size: 0.9rem; opacity: 0.85; pointer-events: none; }
    .legend { position: absolute; left: 16px; bottom: 14px; display: flex; flex-wrap: wrap; gap: 6px 14px; color: #f3e7d7; font-size: 0.85rem; pointer-events: none; }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
    .line { width: 18px; height: 3px; border-radius: 2px; display: inline-block; }
    .tools { position: absolute; right: 12px; top: 12px; display: flex; gap: 8px; }
    .tools button { background: rgb(255 253 249 / 92%); }
    .selected { margin-top: 12px; display: flex; flex-direction: column; gap: 12px; }
    .sel-body { display: flex; gap: 14px; align-items: center; }
    .sel-body > div { flex: 1; min-width: 0; }
    .name { font-weight: 700; margin-left: 6px; }
    .score { flex: none; width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center; font-size: 1.25rem; font-weight: 800; }
    .icon-btn { width: 52px; padding: 0; border: 0; background: var(--surface-2); }
    @media (max-width: 767px) {
      .scene { height: max(420px, calc(100dvh - 330px)); }
      .tools { top: auto; bottom: 56px; }
      .hint { right: 16px; }
    }
  `,
})
export default class Retea3d implements OnDestroy {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  readonly porumbel = input<string>();
  readonly tot = input<string>();
  private readonly scene = viewChild.required<ElementRef<HTMLDivElement>>('scene');

  readonly selected = signal<NetworkNode | null>(null);
  readonly error = signal('');
  readonly spinning = signal(true);
  protected readonly sexText = sexLabel;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private graph: any = null;
  private resize: ResizeObserver | null = null;
  private lit: Set<number> | null = null;
  private rootId: number | null = null;
  private lastClick = { id: 0, at: 0 };

  /** De unde vine omul în fișă: firimiturile îl întorc aici. */
  protected from = () => ({ din: 'arbore3d', radacina: this.rootId ?? undefined });
  protected back = () => (this.rootId ? { porumbel: this.rootId } : this.tot() ? { tot: 1 } : {});

  constructor() {
    effect(() => {
      const id = Number(this.porumbel()) || null;
      const all = !!this.tot();
      untracked(() => this.load(id, all));
    });
  }

  ngOnDestroy() {
    this.resize?.disconnect();
    this.graph?._destructor();
  }

  private async load(id: number | null, all: boolean) {
    try {
      if (!id && !all) {
        // Ca în 2D: fără porumbel ales, pornim de la cel mai valoros.
        const best = (await this.api.get<{ pigeons: PigeonSummary[] }>('/board')).pigeons[0];
        if (best) this.router.navigate(['/arbore/3d'], { queryParams: { porumbel: best.id }, replaceUrl: true });
        return;
      }
      this.rootId = id;
      const net = await this.api.get<Network>(id ? `/network?rootId=${id}&up=8&down=4` : '/network');
      this.error.set('');
      await this.draw(net);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  private async draw(net: Network) {
    const { default: ForceGraph3D } = await import('3d-force-graph');
    const years = net.nodes.map((n) => n.year).filter((y): y is number => y != null);
    const mid = years.length ? (Math.min(...years) + Math.max(...years)) / 2 : 2015;
    // Înălțimea fixă după an: fiecare an = 14 unități; cei fără an plutesc liber.
    const nodes: Node3D[] = net.nodes.map((n) => ({ ...n, fy: n.year != null ? (n.year - mid) * 14 : undefined }));
    const links: Link3D[] = net.edges.map((e) => ({ source: e.from, target: e.to, role: e.role }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const parents = new Map<number, number[]>();
    const kids = new Map<number, number[]>();
    for (const e of net.edges) {
      (parents.get(e.to) ?? parents.set(e.to, []).get(e.to)!).push(e.from);
      (kids.get(e.from) ?? kids.set(e.from, []).get(e.from)!).push(e.to);
    }
    const related = (id: number) => {
      const out = new Set<number>([id]);
      for (const map of [parents, kids]) {
        const stack = [id];
        while (stack.length) for (const n of map.get(stack.pop()!) ?? []) if (!out.has(n)) out.add(n), stack.push(n);
      }
      return out;
    };
    const idOf = (x: number | Node3D) => (typeof x === 'object' ? x.id : x);
    const nodeColor = (n: Node3D) => {
      if (this.lit && !this.lit.has(n.id)) return DIM;
      if (n.id === this.rootId) return ROOT;
      return n.kind === 'external' ? EXTERNAL : BAND[n.band] ?? BAND[0];
    };
    const linkOn = (l: Link3D) => !this.lit || (this.lit.has(idOf(l.source)) && this.lit.has(idOf(l.target)));

    this.graph?._destructor();
    const el = this.scene().nativeElement;
    el.innerHTML = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.graph = (new ForceGraph3D(el, { controlType: 'orbit' }) as any)
      .backgroundColor(BG)
      .showNavInfo(false)
      .width(el.clientWidth)
      .height(el.clientHeight)
      .nodeRelSize(6)
      .nodeVal((n: Node3D) => (n.kind === 'external' ? 1.2 : 2 + Math.min(n.offspringCount, 25) * 0.6))
      .nodeOpacity(0.95)
      .nodeResolution(20)
      .nodeColor(nodeColor)
      .nodeLabel(
        (n: Node3D) =>
          `<div style="font:600 15px system-ui;padding:6px 10px;background:#fffdf9;color:#2b2117;border-radius:10px">${n.ring}${n.name ? ' · ' + n.name : ''}${n.year ? ' · ' + n.year : ''}</div>`,
      )
      .linkColor((l: Link3D) => (linkOn(l) ? (l.role === 'father' ? FATHER : MOTHER) : DIM))
      .linkOpacity(0.55)
      .linkWidth((l: Link3D) => (this.lit && linkOn(l) ? 1.6 : 0.6))
      .linkDirectionalParticles((l: Link3D) => (linkOn(l) ? 2 : 0))
      .linkDirectionalParticleSpeed(0.006)
      .linkDirectionalParticleWidth(1.6)
      .linkDirectionalParticleColor(() => '#ffe3bf')
      .onNodeClick((n: Node3D) => {
        const now = Date.now();
        if (this.lastClick.id === n.id && now - this.lastClick.at < 400) {
          this.router.navigate(['/porumbei', n.id], { queryParams: this.from() }); // dublu clic: fișa
          return;
        }
        this.lastClick = { id: n.id, at: now };
        this.lit = related(n.id);
        this.selected.set(byId.get(n.id) ?? null);
        this.refreshColors();
        const d = 120;
        const r = Math.hypot(n.x ?? 0, n.y ?? 0, n.z ?? 0) || 1;
        this.graph.cameraPosition({ x: (n.x ?? 0) * (1 + d / r), y: (n.y ?? 0) * (1 + d / r), z: (n.z ?? 0) * (1 + d / r) + d }, n, 900);
        this.setSpin(false);
      })
      .onBackgroundClick(() => this.clearSelection())
      .graphData({ nodes, links });

    // Sferele se resping mai tare: generațiile se desfac în lățime, nu stau una peste alta.
    this.graph.d3Force('charge')?.strength(-140);
    this.graph.d3Force('link')?.distance(45);

    const controls = this.graph.controls();
    controls.autoRotate = this.spinning();
    controls.autoRotateSpeed = 0.7;
    controls.addEventListener('start', () => this.setSpin(false));
    this.graph.onEngineStop(() => this.graph.zoomToFit(600, 40));

    this.resize?.disconnect();
    this.resize = new ResizeObserver(() => this.graph?.width(el.clientWidth).height(el.clientHeight));
    this.resize.observe(el);
  }

  private refreshColors() {
    if (!this.graph) return;
    // Biblioteca recalculează culorile doar când primește din nou funcțiile.
    this.graph
      .nodeColor(this.graph.nodeColor())
      .linkColor(this.graph.linkColor())
      .linkWidth(this.graph.linkWidth())
      .linkDirectionalParticles(this.graph.linkDirectionalParticles());
  }

  private setSpin(on: boolean) {
    this.spinning.set(on);
    if (this.graph) this.graph.controls().autoRotate = on;
  }

  toggleSpin() {
    this.setSpin(!this.spinning());
  }

  fit() {
    this.graph?.zoomToFit(600, 40);
  }

  clearSelection() {
    this.selected.set(null);
    this.lit = null;
    this.refreshColors();
  }
}
