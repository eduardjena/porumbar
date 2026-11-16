import { Component, ElementRef, OnDestroy, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { Core, ElementDefinition, NodeSingular } from 'cytoscape';
import { Api, errorMessage } from '../../core/api';
import { sexLabel } from '../../core/catalog';
import { Network, NetworkNode, PigeonSummary } from '../../core/models';
import { Icon } from '../../shared/icon';
import { lastRoot, rememberRoot } from './arbore-data';

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/*
 * Rețeaua de rudenie: fiecare porumbel apare o singură dată, cu linii de la părinți la pui. Strămoșii comuni (cu mai
 * mulți urmași aici) au chenar gros: acolo se întâlnesc liniile genealogice. Cytoscape (mărire / mutare cu degetele,
 * atingere pe noduri) și așezarea dagre se încarcă doar pe această pagină.
 */
@Component({
  selector: 'app-retea',
  imports: [FormsModule, RouterLink, Icon],
  template: `
    <p class="muted intro">Fiecare porumbel apare o singură dată. Chenarul gros arată strămoșii comuni, unde se întâlnesc liniile. Atinge un porumbel ca să-i vezi ramurile.</p>
    <div class="controls">
      <button type="button" [class.primary]="!!tot() && !rootId()" (click)="showAll()"><app-icon name="retea" />Tot porumbarul</button>
    </div>
    @if (suggestions().length) {
      <ul class="suggestions card">
        @for (s of suggestions(); track s.id) {
          <li><button type="button" (click)="pick(s)">
            <span class="mono">{{ s.ring?.display ?? 'Fără inel' }}</span>
            @if (s.name) { <span>{{ s.name }}</span> }
            @if (s.kind === 'external') { <span class="badge">nu e în porumbarul meu</span> }
          </button></li>
        }
      </ul>
    }

    @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }
    @if (net()?.truncated) { <div class="warning"><app-icon name="alerta" />Arăt doar cei mai tineri {{ net()!.nodes.length }} porumbei. Alege un porumbel ca să vezi rudele lui.</div> }
    @if (!rootId() && !tot()) {
      <div class="notice"><app-icon name="cautare" />Adaugă primul porumbel, apoi îl vezi aici cu strămoșii și urmașii lui.</div>
    }
    @if (rootLabel()) { <p class="from">Pornind de la <strong class="mono">{{ rootLabel() }}</strong>: strămoșii pe 5 generații și urmașii pe 3.</p> }

    <div class="graph-wrap">
      <div #graph class="graph" role="img" aria-label="Arborele porumbarului"></div>
      @if (net() && !net()!.nodes.length) {
        <div class="graph-empty muted">Niciun porumbel de arătat încă.</div>
      }
      <div class="zoom">
        <button type="button" aria-label="Mărește" title="Mărește" (click)="zoom(1.25)"><app-icon name="plus" /></button>
        <button type="button" aria-label="Micșorează" title="Micșorează" (click)="zoom(0.8)"><app-icon name="minus" /></button>
        <button type="button" aria-label="Arată tot arborele" title="Arată tot arborele" (click)="fit()"><app-icon name="panou" /></button>
      </div>
    </div>

    @if (selected(); as s) {
      <aside class="selected card" aria-live="polite">
        <div class="sel-body">
          <span class="score" [class]="'score band-' + s.band">{{ s.score ?? '–' }}</span>
          <div>
            <div><strong class="mono">{{ s.ring }}</strong> @if (s.name) { <span class="name">{{ s.name }}</span> }</div>
            <div class="muted">{{ sexText(s.sex) }}@if (s.year) { · {{ s.year }} } · {{ s.offspringCount }} pui@if (s.kind === 'external') { · nu e în porumbarul tău }</div>
          </div>
          <button type="button" class="icon-btn" aria-label="Închide" (click)="clearSelection()"><app-icon name="inchide" /></button>
        </div>
        <div class="row">
          <a class="btn primary" [routerLink]="['/porumbei', s.id]" [queryParams]="from()"><app-icon name="fisa" />Deschide fișa</a>
          <button type="button" (click)="startFrom(s)"><app-icon name="retea" />Pornește de aici</button>
        </div>
      </aside>
    }
  `,
  styles: `

    .intro { margin: 0 0 16px; max-width: 70ch; }
    .controls { display: flex; gap: 10px; }
    .search { position: relative; display: block; }
    .search app-icon { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--muted); pointer-events: none; }
    .search input { padding-left: 50px; border-radius: 999px; }
    .suggestions { list-style: none; margin: 8px 0 0; padding: 6px; display: flex; flex-direction: column; }
    .suggestions button { width: 100%; justify-content: flex-start; border: 0; border-radius: 10px; background: none; font-weight: 600; }
    .suggestions button:hover { background: var(--surface-2); }
    .from { margin: 12px 0 0; }
    .graph-wrap { position: relative; margin-top: 12px; }
    .graph {
      height: max(440px, calc(100dvh - 330px)); background: var(--surface); border: 1px solid var(--border);
      border-radius: var(--radius); box-shadow: var(--shadow); touch-action: none;
    }
    .graph-empty { position: absolute; inset: 0; display: grid; place-items: center; }
    .zoom { position: absolute; right: 12px; top: 12px; display: flex; flex-direction: column; gap: 8px; }
    .zoom button { width: 52px; padding: 0; background: var(--surface); }
    .selected { position: sticky; bottom: 12px; margin-top: 12px; display: flex; flex-direction: column; gap: 12px; }
    .sel-body { display: flex; gap: 14px; align-items: center; }
    .sel-body > div { flex: 1; min-width: 0; }
    .name { font-weight: 700; margin-left: 6px; }
    .score { flex: none; width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center; font-size: 1.25rem; font-weight: 800; }
    .icon-btn { width: 52px; padding: 0; border: 0; background: var(--surface-2); }
    @media (max-width: 767px) {
      .controls { grid-template-columns: 1fr; }
      .graph { height: max(380px, calc(100dvh - 380px)); }
      .selected { position: fixed; left: 12px; right: 12px; bottom: calc(92px + env(safe-area-inset-bottom)); z-index: 5; }
    }
  `,
})
export default class Retea implements OnDestroy {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  /** Porumbelul de la care pornește rețeaua (?porumbel=<id>). */
  readonly porumbel = input<string>();
  /** ?tot=1: tot porumbarul (cel mult 200 de porumbei, ca telefonul să nu se blocheze). */
  readonly tot = input<string>();
  private readonly graph = viewChild.required<ElementRef<HTMLDivElement>>('graph');

  q = '';
  readonly rootId = signal<number | null>(null);
  readonly rootLabel = signal('');
  readonly net = signal<Network | null>(null);
  readonly selected = signal<NetworkNode | null>(null);
  readonly suggestions = signal<PigeonSummary[]>([]);
  readonly error = signal('');
  protected readonly sexText = sexLabel;
  /** De unde vine omul în fișă: firimiturile îl întorc în Arbore, la același porumbel. */
  protected from = () => ({ din: 'arbore', radacina: this.rootId() ?? undefined, tot: this.tot() ? 1 : undefined, vedere: 'retea' });
  private cy: Core | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private request = 0;

  constructor() {
    effect(() => {
      const id = Number(this.porumbel()) || null;
      const all = !!this.tot();
      untracked(() => {
        this.rootId.set(id);
        if (id) rememberRoot(id);
        if (id || all) this.load();
        else this.startFromBest();
      });
    });
  }

  ngOnDestroy() {
    clearTimeout(this.timer);
    this.cy?.destroy();
  }

  suggest() {
    clearTimeout(this.timer);
    const q = this.q.trim();
    if (!q) return this.suggestions.set([]);
    this.timer = setTimeout(async () => {
      try {
        const r = await this.api.get<{ pigeons: PigeonSummary[] }>(`/pigeons?q=${encodeURIComponent(q)}`);
        this.suggestions.set(r.pigeons.slice(0, 8));
      } catch {
        this.suggestions.set([]);
      }
    }, 300);
  }

  /** Fără porumbel ales: pornim de la cel mai valoros din porumbar (primul de pe panou), nu de la o pagină goală. */
  private async startFromBest() {
    this.net.set(null);
    this.cy?.destroy();
    this.cy = null;
    try {
      // Ca în celelalte vederi: ultimul porumbel ales, altfel cel mai valoros.
      const pigeons = (await this.api.get<{ pigeons: PigeonSummary[] }>('/board')).pigeons;
      const start = pigeons.find((p) => p.id === lastRoot()) ?? pigeons[0];
      if (start) this.router.navigate(['/arbore'], { queryParams: { porumbel: start.id, vedere: 'retea' }, replaceUrl: true });
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  pick(p: PigeonSummary) {
    this.q = '';
    this.suggestions.set([]);
    this.router.navigate(['/arbore'], { queryParams: { porumbel: p.id, vedere: 'retea' } });
  }

  startFrom(n: NetworkNode) {
    this.router.navigate(['/arbore'], { queryParams: { porumbel: n.id, vedere: 'retea' } });
  }

  showAll() {
    this.router.navigate(['/arbore'], { queryParams: { tot: 1, vedere: 'retea' } });
  }

  zoom(factor: number) {
    if (!this.cy) return;
    this.cy.zoom({ level: this.cy.zoom() * factor, renderedPosition: { x: this.cy.width() / 2, y: this.cy.height() / 2 } });
  }

  fit() {
    this.cy?.fit(undefined, 24);
  }

  clearSelection() {
    this.selected.set(null);
    this.cy?.elements().removeClass('faded lit picked');
  }

  private async load() {
    const id = this.rootId();
    const req = ++this.request;
    this.selected.set(null);
    try {
      const net = await this.api.get<Network>(id ? `/network?rootId=${id}&up=5&down=3` : '/network');
      if (req !== this.request) return; // a venit între timp o cerere mai nouă
      this.net.set(net);
      this.rootLabel.set(id ? (net.nodes.find((n) => n.id === id)?.ring ?? '') : '');
      this.error.set('');
      await this.draw(net, id);
    } catch (e) {
      if (req === this.request) {
        this.error.set(errorMessage(e));
        this.net.set(null);
        this.cy?.destroy();
        this.cy = null;
      }
    }
  }

  private async draw(net: Network, rootId: number | null) {
    const [{ default: cytoscape }, { default: dagre }] = await Promise.all([import('cytoscape'), import('cytoscape-dagre')]);
    try {
      cytoscape.use(dagre);
    } catch {
      /* deja înregistrat */
    }
    const outgoing = new Map<number, number>();
    for (const e of net.edges) outgoing.set(e.from, (outgoing.get(e.from) ?? 0) + 1);
    const byId = new Map(net.nodes.map((n) => [n.id, n]));

    const elements: ElementDefinition[] = [
      ...net.nodes.map((n) => ({
        data: {
          id: String(n.id),
          label: `${n.ring}${n.year ? `\n${n.year}` : ''}${n.name ? `\n${n.name.slice(0, 18)}` : ''}`,
          band: n.kind === 'own' ? n.band : -1,
        },
        classes: [
          n.sex === 'F' ? 'female' : n.sex === 'M' ? 'male' : '',
          n.kind === 'external' ? 'external' : '',
          (outgoing.get(n.id) ?? 0) >= 2 ? 'hub' : '',
          n.id === rootId ? 'root' : '',
        ].join(' '),
      })),
      ...net.edges.map((e) => ({ data: { id: `${e.from}-${e.to}`, source: String(e.from), target: String(e.to), role: e.role } })),
    ];

    const band = (b: number, part: 'bg' | 'ink') => {
      if (b < 0) return part === 'bg' ? css('--surface') : css('--text');
      return css(part === 'bg' ? `--band-${b}` : `--band-${b}-ink`);
    };

    this.cy?.destroy();
    this.cy = cytoscape({
      container: this.graph().nativeElement,
      elements,
      minZoom: 0.15,
      maxZoom: 3,
      wheelSensitivity: 0.3,
      style: [
        {
          selector: 'node',
          style: {
            shape: 'round-rectangle',
            width: 168,
            height: 66,
            'background-color': (ele: NodeSingular) => band(ele.data('band'), 'bg'),
            color: (ele: NodeSingular) => band(ele.data('band'), 'ink'),
            label: 'data(label)',
            'text-wrap': 'wrap',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-family': css('--font'),
            'font-size': 15,
            'font-weight': 700,
            'line-height': 1.25,
            'border-width': 2,
            'border-color': css('--border-strong'),
          },
        },
        { selector: 'node.male', style: { 'border-color': css('--male') } },
        { selector: 'node.female', style: { 'border-color': css('--female') } },
        { selector: 'node.external', style: { 'border-style': 'dashed' } },
        { selector: 'node.hub', style: { 'border-width': 5 } },
        { selector: 'node.root', style: { 'outline-width': 4, 'outline-color': css('--accent'), 'outline-offset': 4 } as never },
        {
          selector: 'edge',
          style: {
            width: 2.5,
            'curve-style': 'taxi',
            'taxi-direction': 'rightward',
            'line-color': css('--border-strong'),
            'target-arrow-shape': 'triangle',
            'target-arrow-color': css('--border-strong'),
            'arrow-scale': 0.9,
          },
        },
        { selector: 'edge[role = "father"]', style: { 'line-color': '#9fb8cf', 'target-arrow-color': '#9fb8cf' } },
        { selector: 'edge[role = "mother"]', style: { 'line-color': '#d2a6c9', 'target-arrow-color': '#d2a6c9' } },
        { selector: '.faded', style: { opacity: 0.15 } },
        // Porumbelul atins: chenar albastru și un halou pastel în jur, ca să se vadă clar pe care ești.
        {
          selector: 'node.picked',
          style: {
            'border-width': 4,
            'border-color': css('--accent'),
            'border-style': 'solid',
            // halou pastel, moale, în jurul porumbelului ales (cerut de utilizator)
            'underlay-color': '#f3c9b5',
            'underlay-opacity': 1,
            'underlay-padding': 26,
            'underlay-shape': 'round-rectangle',
            'underlay-corner-radius': 40,
            'underlay-fill': 'radial-gradient',
            'underlay-gradient-stop-colors': 'rgba(240,180,150,0.95) rgba(246,205,185,0.7) rgba(250,228,215,0)',
            'underlay-gradient-stop-positions': '0% 60% 100%',
            'z-index': 20,
          } as never,
        },
        { selector: 'edge.lit', style: { width: 4, 'line-color': css('--accent'), 'target-arrow-color': css('--accent') } },
      ],
      layout: { name: 'dagre', rankDir: 'LR', nodeSep: 18, rankSep: 70, edgeSep: 10, padding: 24 } as never,
    });

    this.cy.on('tap', 'node', (evt) => {
      const node = evt.target as NodeSingular;
      const related = node.predecessors().union(node.successors()).union(node);
      this.cy!.elements().addClass('faded').removeClass('lit picked');
      node.addClass('picked');
      // Porumbelul ales vine în mijlocul ecranului (nu rămâne sub cardul de jos).
      this.cy!.animate({ center: { eles: node }, zoom: Math.max(this.cy!.zoom(), 0.85) }, { duration: 300 });
      related.removeClass('faded');
      related.edges().addClass('lit');
      this.selected.set(byId.get(Number(node.id())) ?? null);
    });
    // Dublu clic (sau dublă atingere) pe un porumbel: deschide fișa lui.
    this.cy.on('dbltap', 'node', (evt) => this.router.navigate(['/porumbei', Number((evt.target as NodeSingular).id())], { queryParams: this.from() }));
    this.cy.on('tap', (evt) => {
      if (evt.target === this.cy) this.clearSelection();
    });
    // Pornind de la un porumbel: text citibil (nu toată rețeaua micșorată), centrat pe el; restul se vede derulând.
    if (rootId) {
      const root = this.cy.getElementById(String(rootId));
      this.cy.zoom(Math.max(this.cy.zoom(), 0.85));
      this.cy.center(root);
    }
  }
}
