import { Component, ElementRef, OnDestroy, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  BufferGeometry, CanvasTexture, DoubleSide, Group, LineBasicMaterial, LineLoop, MOUSE, Mesh, MeshBasicMaterial,
  PlaneGeometry, Sprite, SpriteMaterial, TOUCH, Vector3,
} from 'three';
import { Api, errorMessage } from '../../core/api';
import { sexLabel } from '../../core/catalog';
import { Network, NetworkNode, PigeonSummary } from '../../core/models';
import { Icon } from '../../shared/icon';
import { GENERATION_NAMES, lastRoot, rememberRoot } from './arbore-data';

/*
 * Arborele în 3D, în pagina Arbore (comutatorul 2D / 3D). Fiecare porumbel e o sferă; mărimea = câți pui are;
 * culoarea = nota. Cu un porumbel ales: „Etaje” = un etaj pe generație (puii sus, strămoșii jos, etajele au nume)
 * sau „Orbite” = porumbelul în centru, generațiile pe cercuri. Fără porumbel ales („Tot porumbarul”): înălțimea = anul.
 * Biblioteca 3D (three.js + 3d-force-graph) se încarcă doar când omul trece pe 3D.
 */

interface Node3D extends NetworkNode {
  x?: number;
  y?: number;
  z?: number;
  fx?: number;
  fy?: number;
  fz?: number;
}
interface Link3D {
  source: number | Node3D;
  target: number | Node3D;
  role: 'father' | 'mother';
}
type Layout = 'etaje' | 'orbite';

// Culorile scenei: fundal închis, cald (spațiu), sfere luminoase în tonurile paletei „Pământ”.
const BG = '#17120e';
const BAND = ['#8a7f73', '#cfe3a6', '#b5d67a', '#93c25b', '#74ad3c', '#5a9a2a']; // 0 = fără date … 5 = cei mai buni
const EXTERNAL = '#c9b49b';
const ROOT = '#ff7a4d';
const FATHER = '#8fb6e6';
const MOTHER = '#e7a3cc';
const DIM = '#2a221c';
const FLOOR = 70; // distanța dintre două etaje (generații)
const ORBIT = 80; // cât crește raza la fiecare generație de strămoși
const LAYOUT_KEY = 'porumbar.3d.asezare';

/** Numele etajului: generația față de porumbel (negativ = strămoși, pozitiv = urmași). */
export function floorName(g: number): string {
  if (g === 0) return 'Porumbelul';
  if (g === 1) return 'Puii';
  if (g === 2) return 'Nepoții';
  if (g > 2) return `Urmași, generația ${g}`;
  return GENERATION_NAMES[-g] ?? `Strămoși, generația ${-g}`;
}

/**
 * Generația fiecărui porumbel față de rădăcină (cea mai apropiată, dacă apare pe mai multe drumuri) și locul
 * strămoșilor în pedigree (tatăl = 2i, mama = 2i + 1), pentru orbite.
 */
function generations(root: number, fatherOf: Map<number, number>, motherOf: Map<number, number>, kids: Map<number, number[]>) {
  const gen = new Map<number, number>([[root, 0]]);
  const slot = new Map<number, number>([[root, 0]]);
  let frontier = [root];
  for (let d = 1; frontier.length; d++) {
    const next: number[] = [];
    for (const id of frontier) {
      for (const [p, bit] of [[fatherOf.get(id), 0], [motherOf.get(id), 1]] as const) {
        if (p == null || gen.has(p)) continue;
        gen.set(p, -d);
        slot.set(p, slot.get(id)! * 2 + bit);
        next.push(p);
      }
    }
    frontier = next;
  }
  frontier = [root];
  for (let d = 1; frontier.length; d++) {
    const next: number[] = [];
    for (const id of frontier) for (const k of kids.get(id) ?? []) if (!gen.has(k)) gen.set(k, d), next.push(k);
    frontier = next;
  }
  return { gen, slot };
}

/** Raza cercului urmașilor: destul de largă cât să nu se atingă sferele. */
const kidOrbit = (g: number, count: number) => Math.max(ORBIT * g, (count * 16) / (2 * Math.PI));

/** Eticheta unui etaj / cerc: scrisă pe o pânză, aceeași mărime pe ecran oricât de departe e camera. */
function floorLabel(text: string, at: Vector3, strong: boolean): Sprite {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d')!;
  const font = '700 40px system-ui, sans-serif';
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 40;
  c.width = w;
  c.height = 64;
  ctx.font = font;
  ctx.fillStyle = strong ? '#ff7a4d' : 'rgba(58, 47, 38, 0.92)';
  ctx.beginPath();
  ctx.roundRect(0, 0, w, 64, 32);
  ctx.fill();
  ctx.fillStyle = strong ? '#1b120c' : '#f3e6d6';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 20, 34);
  const sprite = new Sprite(new SpriteMaterial({ map: new CanvasTexture(c), depthTest: false, transparent: true, sizeAttenuation: false }));
  sprite.scale.set((0.04 * w) / 64, 0.04, 1);
  sprite.center.set(0, 0.5); // textul pornește de la punct spre dreapta
  sprite.position.copy(at);
  sprite.renderOrder = 5;
  return sprite;
}

/** Etajele: câte un plan subțire, semitransparent, pentru fiecare generație, cu numele pe margine. */
function floors(nodes: Node3D[], gen: Map<number, number>): Group {
  const group = new Group();
  const placed = nodes.filter((n) => gen.has(n.id));
  const span = Math.max(80, ...placed.map((n) => Math.max(Math.abs(n.x ?? 0), Math.abs(n.z ?? 0)))) + 40;
  const levels = [...new Set(placed.map((n) => gen.get(n.id)!))].sort((a, b) => a - b);
  for (const g of levels) {
    const y = g * FLOOR;
    const plane = new Mesh(
      new PlaneGeometry(span * 2, span * 2),
      new MeshBasicMaterial({ color: g === 0 ? 0xff7a4d : 0xf3e6d6, transparent: true, opacity: g === 0 ? 0.1 : 0.05, side: DoubleSide, depthWrite: false }),
    );
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = y;
    group.add(plane);
    const edge = new LineLoop(
      new BufferGeometry().setFromPoints([new Vector3(-span, y, -span), new Vector3(span, y, -span), new Vector3(span, y, span), new Vector3(-span, y, span)]),
      new LineBasicMaterial({ color: g === 0 ? 0xff7a4d : 0x8a7f73, transparent: true, opacity: 0.45 }),
    );
    group.add(edge);
    group.add(floorLabel(floorName(g), new Vector3(-span, y, span), g === 0));
  }
  return group;
}

/** Orbitele: un cerc subțire pentru fiecare generație de strămoși (în jurul porumbelului) și pentru urmași (deasupra). */
function orbitRings(nodes: Node3D[], gen: Map<number, number>): Group {
  const group = new Group();
  const circle = (r: number, y: number, color: number) => {
    const pts = Array.from({ length: 96 }, (_, i) => new Vector3(Math.cos((i / 96) * 2 * Math.PI) * r, y, Math.sin((i / 96) * 2 * Math.PI) * r));
    group.add(new LineLoop(new BufferGeometry().setFromPoints(pts), new LineBasicMaterial({ color, transparent: true, opacity: 0.5 })));
  };
  const count = new Map<number, number>();
  for (const n of nodes) if (gen.has(n.id)) count.set(gen.get(n.id)!, (count.get(gen.get(n.id)!) ?? 0) + 1);
  for (const [g, c] of count) {
    if (g === 0) continue;
    const r = g < 0 ? -g * ORBIT : kidOrbit(g, c);
    const y = g < 0 ? 0 : g * FLOOR;
    circle(r, y, g < 0 ? 0x8a7f73 : 0xff7a4d);
    group.add(floorLabel(floorName(g), new Vector3(r + 8, y, 0), false));
  }
  group.add(floorLabel(floorName(0), new Vector3(14, 0, 0), true));
  return group;
}

function readLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === 'orbite' ? 'orbite' : 'etaje';
  } catch {
    return 'etaje';
  }
}

@Component({
  selector: 'app-retea-3d',
  imports: [RouterLink, Icon],
  template: `
    @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }

    <!-- Vizualizatorul (bara + scena) poate trece pe tot ecranul. -->
    <div #viewer class="viewer" [class.full]="full()">
      <div class="tree-bar" role="toolbar" aria-label="Comenzi pentru arbore">
        <ng-content select="[bara]" />
        <div class="tree-bar-right">
          @if (hasRoot()) {
            <div class="seg" role="group" aria-label="Așezarea">
              <button type="button" [class.on]="layout() === 'etaje'" [attr.aria-pressed]="layout() === 'etaje'" (click)="setLayout('etaje')" title="Un etaj pentru fiecare generație">Etaje</button>
              <button type="button" [class.on]="layout() === 'orbite'" [attr.aria-pressed]="layout() === 'orbite'" (click)="setLayout('orbite')" title="Porumbelul în centru, generațiile pe cercuri">Orbite</button>
            </div>
          }
          <div class="seg" role="group" aria-label="Ce face tragerea">
            <button type="button" [class.on]="mode() === 'rotate'" [attr.aria-pressed]="mode() === 'rotate'" (click)="setMode('rotate')" title="Tragerea rotește arborele"><app-icon name="rotire" />Rotește</button>
            <button type="button" [class.on]="mode() === 'pan'" [attr.aria-pressed]="mode() === 'pan'" (click)="setMode('pan')" title="Tragerea mută arborele"><app-icon name="mutare" />Mută</button>
          </div>
          <div class="seg" role="group" aria-label="Mărire">
            <button type="button" (click)="zoom(0.75)" title="Mărește" aria-label="Mărește"><app-icon name="plus" /></button>
            <button type="button" (click)="zoom(1.33)" title="Micșorează" aria-label="Micșorează"><app-icon name="minus" /></button>
          </div>
          <button type="button" (click)="fit()" title="Arată tot arborele"><app-icon name="panou" />Arată tot</button>
          <button type="button" (click)="toggleSpin()" [class.on]="spinning()" [attr.aria-pressed]="spinning()" [title]="spinning() ? 'Oprește rotirea automată' : 'Pornește rotirea automată'">
            <app-icon name="rotire" />Rotire
          </button>
          <button type="button" (click)="toggleFull()" [title]="full() ? 'Ieși din ecranul întreg (Esc)' : 'Ecran întreg'">
            <app-icon [name]="full() ? 'inchide' : 'mutare'" />{{ full() ? 'Ieși din ecran întreg' : 'Ecran întreg' }}
          </button>
          <ng-content select="[bara-dreapta]" />
        </div>
      </div>
      <p class="how">{{ intro() }} Trage: {{ mode() === 'rotate' ? 'rotești' : 'muți' }} · rotița: mărești · clic: ramurile · dublu clic: fișa.</p>

      <div class="stage">
        <div #scene class="scene" role="img" aria-label="Arborele în trei dimensiuni"></div>
        <div class="legend">
          <span><i class="dot" style="background:#5a9a2a"></i>notă mare</span>
          <span><i class="dot" style="background:#cfe3a6"></i>notă mică</span>
          <span><i class="dot" style="background:#c9b49b"></i>din alt porumbar</span>
          <span><i class="line" style="background:#8fb6e6"></i>tată</span>
          <span><i class="line" style="background:#e7a3cc"></i>mamă</span>
        </div>
      </div>
    <!-- Cardul porumbelului ales stă în vizualizator, ca să se vadă și pe ecran întreg. -->
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
        <div class="parents">
          <button type="button" class="parent father" [disabled]="!selFather()" (click)="select(selFather()!.id)" title="Arată tatăl">
            <span class="tag">Tatăl</span><span class="mono">{{ selFather()?.ring ?? 'necunoscut' }}</span>
          </button>
          <button type="button" class="parent mother" [disabled]="!selMother()" (click)="select(selMother()!.id)" title="Arată mama">
            <span class="tag">Mama</span><span class="mono">{{ selMother()?.ring ?? 'necunoscută' }}</span>
          </button>
        </div>
        <div class="row">
          <a class="btn primary" [routerLink]="['/porumbei', s.id]" [queryParams]="from()"><app-icon name="fisa" />Deschide fișa</a>
          <a class="btn" [routerLink]="['/arbore']" [queryParams]="{ porumbel: s.id, vedere: '3d' }"><app-icon name="ramificare" />Pornește de aici</a>
        </div>
      </aside>
    }
    </div>
  `,
  styles: `
    :host { display: block; }
    .viewer { position: relative; }
    .viewer.full { position: fixed; inset: 0; z-index: 100; background: var(--bg); padding: 12px 16px 16px; display: flex; flex-direction: column; }
    .viewer:fullscreen { background: var(--bg); padding: 12px 16px 16px; display: flex; flex-direction: column; }
    .viewer.full .tree-bar, .viewer:fullscreen .tree-bar { position: static; }
    .viewer.full .stage, .viewer:fullscreen .stage { flex: 1; min-height: 0; }
    .viewer.full .scene, .viewer:fullscreen .scene { height: 100%; }
    .tree-bar-right button.on { border-color: var(--accent); color: var(--accent-strong); }
    .stage { position: relative; border-radius: var(--radius); overflow: hidden; background: ${BG}; box-shadow: var(--shadow); }
    .scene { height: max(460px, calc(100dvh - 260px)); }
    .how { margin: 0 0 10px; color: var(--muted); }
    .legend { position: absolute; left: 16px; bottom: 14px; display: flex; flex-wrap: wrap; gap: 6px 14px; color: #f3e7d7; font-size: 0.85rem; pointer-events: none; }
    .legend span { display: inline-flex; align-items: center; gap: 6px; }
    .dot { width: 12px; height: 12px; border-radius: 50%; display: inline-block; }
    .line { width: 18px; height: 3px; border-radius: 2px; display: inline-block; }
    .selected { margin-top: 12px; display: flex; flex-direction: column; gap: 12px; }
    .viewer.full .selected, .viewer:fullscreen .selected { position: absolute; right: 28px; bottom: 28px; width: min(440px, calc(100% - 56px)); margin: 0; box-shadow: 0 18px 50px -12px rgb(0 0 0 / 45%); }
    .parents { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .parent { justify-content: center; border-radius: 14px; flex-direction: column; align-items: flex-start; gap: 0; padding: 6px 14px; }
    .parent .tag { font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }
    .parent.father { border-color: #8fb6e6; background: #eef4fb; color: #1f4a73; }
    .parent.mother { border-color: #e7a3cc; background: #fbeff6; color: #7a2a62; }
    .sel-body { display: flex; gap: 14px; align-items: center; }
    .sel-body > div { flex: 1; min-width: 0; }
    .name { font-weight: 700; margin-left: 6px; }
    .score { flex: none; width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center; font-size: 1.25rem; font-weight: 800; }
    .icon-btn { width: 52px; padding: 0; border: 0; background: var(--surface-2); }
    @media (max-width: 767px) {
      .how { display: none; }
      .scene { height: max(420px, calc(100dvh - 300px)); }
    }
  `,
})
export default class Retea3d implements OnDestroy {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  readonly porumbel = input<string>();
  readonly tot = input<string>();
  private readonly scene = viewChild.required<ElementRef<HTMLDivElement>>('scene');
  private readonly viewer = viewChild.required<ElementRef<HTMLDivElement>>('viewer');
  readonly full = signal(false);
  private readonly onFsChange = () => {
    if (!document.fullscreenElement) this.full.set(false);
  };

  readonly selected = signal<NetworkNode | null>(null);
  readonly selFather = signal<NetworkNode | null>(null);
  readonly selMother = signal<NetworkNode | null>(null);
  private selectFn: ((id: number) => void) | null = null;
  readonly error = signal('');
  readonly spinning = signal(true);
  /** Ce face tragerea cu mouse-ul / degetul: rotește sau mută arborele. */
  readonly mode = signal<'rotate' | 'pan'>('rotate');
  /** Cu porumbel ales: etaje pe generații sau orbite în jurul lui (ținut minte pe acest calculator). */
  readonly layout = signal<Layout>(readLayout());
  readonly hasRoot = signal(false);
  protected readonly sexText = sexLabel;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private graph: any = null;
  private resize: ResizeObserver | null = null;
  private lit: Set<number> | null = null;
  private rootId: number | null = null;
  private net: Network | null = null;
  private lastClick = { id: 0, at: 0 };
  private hovered: Node3D | null = null;
  private pointerReady = false;
  private request = 0;

  /** De unde vine omul în fișă: firimiturile îl întorc aici. */
  protected from = () => ({ din: 'arbore', radacina: this.rootId ?? undefined, vedere: '3d' });
  protected intro = () =>
    !this.hasRoot()
      ? 'Sus cei mai tineri, jos cei mai bătrâni (după an).'
      : this.layout() === 'etaje'
        ? 'Un etaj pentru fiecare generație: puii sus, strămoșii jos.'
        : 'Porumbelul în centru, strămoșii pe cercuri (tatăl stânga, mama dreapta), puii deasupra.';


  constructor() {
    document.addEventListener('fullscreenchange', this.onFsChange);
    effect(() => {
      const id = Number(this.porumbel()) || null;
      const all = !!this.tot();
      untracked(() => this.load(id, all));
    });
  }

  ngOnDestroy() {
    document.removeEventListener('fullscreenchange', this.onFsChange);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    this.resize?.disconnect();
    this.graph?._destructor();
  }

  private async load(id: number | null, all: boolean) {
    const req = ++this.request;
    try {
      if (!id && !all) {
        // Ca în 2D: fără porumbel ales, pornim de la ultimul ales (sau de la cel mai valoros).
        const pigeons = (await this.api.get<{ pigeons: PigeonSummary[] }>('/board')).pigeons;
        const last = lastRoot();
        const start = pigeons.find((p) => p.id === last) ?? pigeons[0];
        if (start) this.router.navigate(['/arbore'], { queryParams: { porumbel: start.id, vedere: '3d' }, replaceUrl: true });
        return;
      }
      this.rootId = id;
      this.hasRoot.set(!!id);
      if (id) rememberRoot(id);
      const net = await this.api.get<Network>(id ? `/network?rootId=${id}&up=8&down=4` : '/network');
      if (req !== this.request) return; // între timp s-a ales alt porumbel
      this.error.set('');
      await this.draw(net);
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  private async draw(net: Network) {
    this.net = net;
    const { default: ForceGraph3D } = await import('3d-force-graph');
    const parents = new Map<number, number[]>();
    const kids = new Map<number, number[]>();
    const fatherOf = new Map<number, number>();
    const motherOf = new Map<number, number>();
    for (const e of net.edges) {
      (parents.get(e.to) ?? parents.set(e.to, []).get(e.to)!).push(e.from);
      (kids.get(e.from) ?? kids.set(e.from, []).get(e.from)!).push(e.to);
      (e.role === 'father' ? fatherOf : motherOf).set(e.to, e.from);
    }
    const root = this.rootId != null && net.nodes.some((n) => n.id === this.rootId) ? this.rootId : null;
    const { gen, slot } = root != null ? generations(root, fatherOf, motherOf, kids) : { gen: new Map<number, number>(), slot: new Map<number, number>() };
    const orbits = root != null && this.layout() === 'orbite';

    let nodes: Node3D[];
    if (root == null) {
      // „Tot porumbarul”: nu există o generație de referință, așa că înălțimea = anul nașterii (14 unități pe an).
      // Porumbeii fără an primesc un an estimat după pui (cu 3 ani înainte), ca să nu plutească departe.
      const years = net.nodes.map((n) => n.year).filter((y): y is number => y != null);
      const mid = years.length ? (Math.min(...years) + Math.max(...years)) / 2 : 2015;
      const estYear = new Map<number, number>();
      for (const n of net.nodes) if (n.year != null) estYear.set(n.id, n.year);
      for (let pass = 0; pass < 10; pass++) {
        for (const e of net.edges) {
          if (estYear.has(e.from) || !estYear.has(e.to)) continue;
          estYear.set(e.from, estYear.get(e.to)! - 3);
        }
      }
      nodes = net.nodes.map((n) => {
        const y = estYear.get(n.id);
        return { ...n, fy: y != null ? (y - mid) * 14 : undefined };
      });
    } else if (!orbits) {
      // Etaje: înălțimea = generația față de porumbelul ales (puii sus, strămoșii jos), un etaj = FLOOR unități.
      nodes = net.nodes.map((n) => ({ ...n, fy: gen.has(n.id) ? gen.get(n.id)! * FLOOR : undefined }));
    } else {
      // Orbite: porumbelul în centru; strămoșii pe cercuri tot mai largi (tatăl în stânga, mama în dreapta, ca în
      // evantai); puii pe cercuri separate, deasupra. Pozițiile sunt fixe, nimic nu se mișcă.
      const down = new Map<number, number[]>();
      for (const n of net.nodes) {
        const g = gen.get(n.id);
        if (g != null && g > 0) down.set(g, [...(down.get(g) ?? []), n.id]);
      }
      nodes = net.nodes.map((n) => {
        const g = gen.get(n.id);
        if (g == null) return { ...n };
        if (g === 0) return { ...n, fx: 0, fy: 0, fz: 0 };
        if (g < 0) {
          const d = -g;
          const a = Math.PI / 2 + (2 * Math.PI * (slot.get(n.id)! + 0.5)) / 2 ** d;
          return { ...n, fx: Math.cos(a) * d * ORBIT, fy: 0, fz: Math.sin(a) * d * ORBIT };
        }
        const row = down.get(g)!;
        const r = kidOrbit(g, row.length);
        const a = (2 * Math.PI * (row.indexOf(n.id) + 0.5)) / row.length;
        return { ...n, fx: Math.cos(a) * r, fy: g * FLOOR, fz: Math.sin(a) * r };
      });
    }
    const links: Link3D[] = net.edges.map((e) => ({ source: e.from, target: e.to, role: e.role }));
    const byId = new Map(nodes.map((n) => [n.id, n]));
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

    // Etichete scrise deasupra sferelor: porumbelul ales, tatăl și mama lui (desenate pe o pânză, ca imagine în scenă).
    const label = (text: string, bg: string, fg: string) => {
      const c = document.createElement('canvas');
      const ctx = c.getContext('2d')!;
      const font = '700 44px system-ui, sans-serif';
      ctx.font = font;
      const w = Math.ceil(ctx.measureText(text).width) + 48;
      c.width = w;
      c.height = 80;
      ctx.font = font;
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(0, 0, w, 80, 40);
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 24, 42);
      const sprite = new Sprite(new SpriteMaterial({ map: new CanvasTexture(c), depthTest: false, transparent: true, sizeAttenuation: false }));
      // Aceeași mărime pe ecran oricât de aproape sau departe e camera (citibil și când vezi tot arborele).
      sprite.scale.set((0.05 * w) / 80, 0.05, 1);
      sprite.position.set(0, 16, 0);
      sprite.renderOrder = 10;
      return sprite;
    };
    const nodeObject = (n: Node3D) => {
      const sel = this.selected();
      if (!sel) return null;
      if (n.id === sel.id) return label(`${n.ring}${n.name ? ' · ' + n.name : ''}`, '#fffdf9', '#2b2117');
      if (n.id === fatherOf.get(sel.id)) return label(`TATĂL · ${n.ring}`, '#dbe9f8', '#1f4a73');
      if (n.id === motherOf.get(sel.id)) return label(`MAMA · ${n.ring}`, '#f8dfee', '#7a2a62');
      return null;
    };
    this.selectFn = (id: number) => {
      this.lit = related(id);
      this.selected.set(byId.get(id) ?? null);
      this.selFather.set(byId.get(fatherOf.get(id) ?? -1) ?? null);
      this.selMother.set(byId.get(motherOf.get(id) ?? -1) ?? null);
      this.refreshColors();
      this.setSpin(false); // camera rămâne unde a lăsat-o omul
    };

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
      .nodeVal((n: Node3D) => (n.kind === 'external' ? 1.2 : 2 + Math.min(n.offspringCount, 25) * 0.6) * (n.id === this.selected()?.id ? 3 : 1))
      .nodeOpacity(0.95)
      .nodeResolution(20)
      .nodeColor(nodeColor)
      .nodeThreeObjectExtend(true)
      .nodeThreeObject(nodeObject)
      .nodeLabel(
        (n: Node3D) =>
          `<div style="font:600 15px system-ui;padding:6px 10px;background:#fffdf9;color:#2b2117;border-radius:10px">${n.ring}${n.name ? ' · ' + n.name : ''}${n.year ? ' · ' + n.year : ''}</div>`,
      )
      .linkColor((l: Link3D) => (linkOn(l) ? (l.role === 'father' ? FATHER : MOTHER) : DIM))
      .linkOpacity(0.7)
      .linkWidth((l: Link3D) => (this.lit ? (linkOn(l) ? 3 : 0.2) : 0.6))
      .linkDirectionalParticles((l: Link3D) => (linkOn(l) ? (this.lit ? 4 : 2) : 0))
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
        this.select(n.id);
      })
      // Sferele nu se trag cu mouse-ul: tragerea rotește / mută vederea, iar arborele nu se rearanjează.
      .enableNodeDrag(false)
      .onBackgroundClick(() => this.clearSelection())
      .onNodeHover((n: Node3D | null) => (this.hovered = n))
      .graphData({ nodes, links });

    // Orbitele se văd de sus, înclinat (din lateral, cercurile ar fi doar o linie). Etajele: din față, ușor de sus.
    if (orbits) this.graph.cooldownTicks(60).cameraPosition({ x: 0, y: 520, z: 420 }, { x: 0, y: 0, z: 0 });
    else if (root != null) this.graph.cooldownTime(5000).cameraPosition({ x: 0, y: 160, z: 600 }, { x: 0, y: 0, z: 0 });
    // Sferele se resping mai tare: generațiile se desfac în lățime, nu stau una peste alta.
    this.graph.d3Force('charge')?.strength(-140);
    this.graph.d3Force('link')?.distance(45);

    const controls = this.graph.controls();
    controls.autoRotate = this.spinning();
    controls.autoRotateSpeed = 0.7;
    controls.addEventListener('start', () => this.setSpin(false));
    this.applyMode();
    // Când arborele s-a așezat: încape tot în ecran și se rotește în jurul mijlocului lui (nu al porumbelului de jos).
    let fitted = false;
    this.graph.onEngineStop(() => {
      // Doar prima dată: după aceea vederea rămâne exact cum o lasă omul.
      if (fitted) return;
      fitted = true;
      if (root != null) this.graph.scene().add(orbits ? orbitRings(nodes, gen) : floors(nodes, gen));
      this.fit();
    });
    // Apăsat pe o sferă și tras: rotirea se face în jurul acelui porumbel (vine ușor în centru).
    // Pivotul se schimbă doar când omul începe să tragă (nu la un simplu clic, care alege porumbelul).
    // Ascultătorii se pun o singură dată pe scenă (draw se repetă la Etaje / Orbite).
    if (!this.pointerReady) {
      this.pointerReady = true;
      let press: { node: Node3D; x: number; y: number } | null = null;
      el.addEventListener('pointerdown', (e: PointerEvent) => {
        press = e.button === 0 && this.mode() === 'rotate' && this.hovered ? { node: this.hovered, x: e.clientX, y: e.clientY } : null;
      }, { capture: true });
      el.addEventListener('pointermove', (e: PointerEvent) => {
        if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 6) {
          this.pivotOn(press.node);
          press = null;
        }
      }, { capture: true });
      el.addEventListener('pointerup', () => (press = null), { capture: true });
    }

    this.resize?.disconnect();
    this.resize = new ResizeObserver(() => this.graph?.width(el.clientWidth).height(el.clientHeight));
    this.resize.observe(el);
  }

  setLayout(l: Layout) {
    if (this.layout() === l) return;
    this.layout.set(l);
    try {
      localStorage.setItem(LAYOUT_KEY, l);
    } catch {
      /* fără memorie locală */
    }
    const sel = this.selected()?.id;
    if (this.net) this.draw(this.net).then(() => sel && this.select(sel));
  }

  /** Alege un porumbel (din scenă sau din butoanele Tatăl / Mama ale cardului). */
  select(id: number) {
    this.selectFn?.(id);
  }

  private refreshColors() {
    if (!this.graph) return;
    // Biblioteca recalculează culorile, mărimile și etichetele doar când primește din nou funcțiile.
    this.graph
      .nodeColor(this.graph.nodeColor())
      .nodeVal(this.graph.nodeVal())
      .nodeThreeObject(this.graph.nodeThreeObject())
      .linkColor(this.graph.linkColor())
      .linkWidth(this.graph.linkWidth())
      .linkDirectionalParticles(this.graph.linkDirectionalParticles());
  }

  private setSpin(on: boolean) {
    this.spinning.set(on);
    if (this.graph) this.graph.controls().autoRotate = on;
  }

  setMode(m: 'rotate' | 'pan') {
    this.mode.set(m);
    this.applyMode();
    this.setSpin(false);
  }

  /** Tragerea cu butonul stâng / un deget face ce e ales; clic dreapta mută mereu, rotița mărește. */
  private applyMode() {
    const c = this.graph?.controls();
    if (!c) return;
    const pan = this.mode() === 'pan';
    c.enablePan = true;
    c.screenSpacePanning = true;
    c.mouseButtons = { LEFT: pan ? MOUSE.PAN : MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: pan ? MOUSE.ROTATE : MOUSE.PAN };
    c.touches = { ONE: pan ? TOUCH.PAN : TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };
  }

  /** Mărire cu butoanele: camera se apropie / se depărtează de punctul la care se uită. */
  zoom(factor: number) {
    if (!this.graph) return;
    const c = this.graph.controls();
    const p = this.graph.cameraPosition();
    const t = c.target;
    this.graph.cameraPosition({ x: t.x + (p.x - t.x) * factor, y: t.y + (p.y - t.y) * factor, z: t.z + (p.z - t.z) * factor }, t, 300);
    this.setSpin(false);
  }

  /** Ecran întreg: Fullscreen API unde se poate; altfel (iPhone) vizualizatorul acoperă toată pagina. */
  async toggleFull() {
    if (this.full()) {
      this.full.set(false);
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined);
      return;
    }
    this.full.set(true);
    const el = this.viewer().nativeElement;
    if (el.requestFullscreen) await el.requestFullscreen().catch(() => undefined);
  }

  toggleSpin() {
    this.setSpin(!this.spinning());
  }

  fit() {
    if (!this.graph) return;
    this.graph.zoomToFit(600, 40);
    // Punctul în jurul căruia se rotește: mijlocul tuturor porumbeilor.
    const nodes: Node3D[] = this.graph.graphData().nodes;
    if (!nodes.length) return;
    const min = { x: Infinity, y: Infinity, z: Infinity };
    const max = { x: -Infinity, y: -Infinity, z: -Infinity };
    for (const n of nodes) for (const k of ['x', 'y', 'z'] as const) {
      min[k] = Math.min(min[k], n[k] ?? 0);
      max[k] = Math.max(max[k], n[k] ?? 0);
    }
    const center = { x: (min.x + max.x) / 2, y: (min.y + max.y) / 2, z: (min.z + max.z) / 2 };
    setTimeout(() => this.graph?.cameraPosition(this.graph.cameraPosition(), center, 300), 650);
  }

  /** Rotirea în jurul porumbelului apăsat: camera rămâne pe loc și se întoarce lin spre el. */
  private pivotOn(n: Node3D) {
    this.graph.cameraPosition(this.graph.cameraPosition(), { x: n.x ?? 0, y: n.y ?? 0, z: n.z ?? 0 }, 250);
    this.setSpin(false);
  }

  clearSelection() {
    this.selected.set(null);
    this.selFather.set(null);
    this.selMother.set(null);
    this.lit = null;
    this.refreshColors();
  }
}
