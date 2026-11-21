import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Api, errorMessage } from '../../core/api';
import { CatalogService } from '../../core/catalog';
import { ConfirmService } from '../../core/confirm';
import { TPipe, formatDay, t } from '../../core/i18n';
import { Treatment, TreatmentPigeon } from '../../core/models';
import { Breadcrumbs, Crumb } from '../../shared/breadcrumbs';
import { Icon } from '../../shared/icon';
import { kindIcon, periodText, repeatText, statusLabel, statusText, todayIso } from './tratament-text';

/*
 * Un tratament: ce, cum, când, cui, porumbeii lui și Modifică / Oprește (doar în curs) / Șterge, fiecare cu confirmare.
 */
@Component({
  selector: 'app-tratament',
  imports: [RouterLink, Icon, TPipe, Breadcrumbs],
  template: `
    <app-breadcrumbs [items]="crumbs()" />
    @if (error()) { <div class="error" role="alert"><app-icon name="alerta" />{{ error() }}</div> }

    @if (tr(); as x) {
      <div class="title">
        <span class="ico" [class.vaccin]="x.kind === 'vaccin'"><app-icon [name]="icon(x)" [size]="30" /></span>
        <div>
          <h1>{{ x.label }}</h1>
          <p class="state"><span class="badge" [class]="'badge st-' + x.status">{{ label(x) }}</span> <strong>{{ status(x) }}</strong></p>
        </div>
      </div>

      <dl class="card facts">
        <dt>{{ 'tratamente.fel' | t }}</dt><dd>{{ catalog.label('journalTypes', x.kind) }}</dd>
        <dt>{{ 'tratamente.cum' | t }}</dt><dd>{{ catalog.label('treatmentMethods', x.method) }}</dd>
        <dt>{{ 'tratamente.perioada' | t }}</dt><dd>{{ period(x) }} <span class="muted">({{ 'tratamente.n_zile' | t: { count: x.days } }})</span></dd>
        <dt>{{ 'tratamente.cui' | t }}</dt><dd>{{ catalog.label('treatmentTargets', x.target) }} · {{ 'tratamente.n_porumbei' | t: { count: x.count } }}</dd>
        <dt>{{ 'tratamente.se_repeta' | t }}</dt>
        <dd>{{ repeat(x) }}
          @if (x.nextId) { <br /><a [routerLink]="['/tratamente', x.nextId]">{{ 'tratamente.vezi_urmatorul' | t }}</a> }
        </dd>
        @if (x.note) { <dt>{{ 'camp.nota' | t }}</dt><dd class="pre">{{ x.note }}</dd> }
      </dl>

      <div class="row actions">
        @if (x.status !== 'anulat') {
          <a class="btn primary" [routerLink]="['/tratamente', x.id, 'modifica']"><app-icon name="editeaza" />{{ 'tratamente.modifica' | t }}</a>
        }
        @if (x.status === 'in_curs') {
          <button type="button" (click)="stop(x)" [disabled]="busy()"><app-icon name="inchide" />{{ 'tratamente.opreste' | t }}</button>
        }
        <button type="button" class="danger" (click)="remove(x)" [disabled]="busy()"><app-icon name="sterge" />{{ 'tratamente.sterge' | t }}</button>
      </div>
      @if (actionError()) { <div class="error" role="alert">{{ actionError() }}</div> }

      <h2>{{ 'tratamente.porumbeii' | t }} <span class="n">{{ pigeons().length }}</span></h2>
      @if (x.status === 'urmeaza' && x.target !== 'alesi') { <p class="muted">{{ 'tratamente.lista_se_fixeaza' | t }}</p> }
      <ul class="pigeons">
        @for (p of pigeons(); track p.id) {
          <li>
            <a class="card pigeon" [routerLink]="['/porumbei', p.id]" [queryParams]="{ fila: 'jurnal' }">
              <span class="mono">{{ ring(p) }}</span>
              @if (p.name) { <span class="pname">{{ p.name }}</span> }
              @if (p.status) { <span class="muted">{{ catalog.label('statuses', p.status) }}</span> }
              <app-icon name="inainte" class="go" />
            </a>
          </li>
        } @empty { <p class="muted">{{ 'tratamente.fara_porumbei' | t }}</p> }
      </ul>
    }
  `,
  styles: `
    .title { display: flex; gap: 14px; align-items: flex-start; }
    .title h1 { margin: 0 0 4px; overflow-wrap: anywhere; }
    .ico { flex: none; width: 56px; height: 56px; border-radius: 16px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent-strong); }
    .ico.vaccin { background: var(--ok-soft); color: var(--ok); }
    .state { margin: 0 0 16px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .st-in_curs { background: var(--accent); color: var(--accent-ink); }
    .st-urmeaza { background: var(--accent-soft); color: var(--accent-strong); }
    .st-anulat { background: var(--danger-soft); color: var(--danger); }
    .facts { display: grid; grid-template-columns: max-content 1fr; gap: 8px 18px; margin: 0; }
    .facts dt { font-weight: 600; color: var(--muted); }
    .facts dd { margin: 0; overflow-wrap: anywhere; }
    .pre { white-space: pre-wrap; }
    .actions { margin: 16px 0 0; }
    h2 { display: flex; align-items: center; gap: 10px; }
    .n { font-size: 0.85rem; font-weight: 700; color: var(--muted); background: var(--surface-2); border-radius: 999px; padding: 2px 10px; }
    .pigeons { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
    .pigeon { display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: center; min-height: 56px; padding: 10px 16px; text-decoration: none; color: var(--text); }
    .pigeon .go { margin-left: auto; color: var(--muted); }
    .pname { font-weight: 600; }
    @media (max-width: 767px) {
      .facts { grid-template-columns: 1fr; gap: 2px; }
      .facts dd { margin-bottom: 8px; }
      .actions > * { flex: 1 1 100%; }
    }
  `,
})
export default class Tratament {
  private readonly api = inject(Api);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  protected readonly catalog = inject(CatalogService);
  readonly id = input.required<string>();

  protected readonly tr = signal<Treatment | null>(null);
  protected readonly pigeons = signal<TreatmentPigeon[]>([]);
  protected readonly error = signal('');
  protected readonly actionError = signal('');
  protected readonly busy = signal(false);
  protected readonly icon = kindIcon;
  protected readonly period = periodText;
  protected readonly status = statusText;
  protected readonly label = statusLabel;
  protected readonly repeat = (x: Treatment) => repeatText(x.repeat);
  protected readonly ring = (p: TreatmentPigeon) => p.ring?.display ?? t('text.fara_inel_mare');

  protected readonly crumbs = computed<Crumb[]>(() => [
    { label: t('meniu.tratamente'), link: ['/tratamente'] },
    { label: this.tr()?.label ?? '…' },
  ]);

  constructor() {
    this.catalog.load();
    effect(() => {
      const id = this.id();
      untracked(() => this.load(id));
    });
  }

  private async load(id: string) {
    try {
      const r = await this.api.get<{ treatment: Treatment; pigeons: TreatmentPigeon[] }>(`/treatments/${encodeURIComponent(id)}`);
      this.tr.set(r.treatment);
      this.pigeons.set(r.pigeons);
      this.error.set('');
    } catch (e) {
      this.error.set(errorMessage(e));
    }
  }

  protected async stop(x: Treatment) {
    const ok = await this.confirm.ask({
      title: t('tratamente.opreste_titlu'),
      lines: [
        `${x.label} · ${periodText(x)}`,
        t('tratamente.opreste_text', { zi: formatDay(todayIso()) }),
        ...(x.nextPlanned ? [t('tratamente.opreste_urmatorul')] : []),
      ],
      confirmLabel: t('tratamente.opreste_da'),
    });
    if (!ok) return;
    await this.act(async () => {
      await this.api.post(`/treatments/${x.id}/cancel`);
      await this.load(String(x.id));
    });
  }

  protected async remove(x: Treatment) {
    const ok = await this.confirm.ask({
      title: t('tratamente.sterge_titlu'),
      lines: [
        `${x.label} · ${periodText(x)}`,
        ...(x.status === 'urmeaza' ? [] : [t('tratamente.sterge_jurnal')]),
        ...(x.nextPlanned ? [t('tratamente.sterge_urmatorul')] : []),
        t('text.nu_se_poate_da_inapoi'),
      ],
      confirmLabel: t('actiune.da_sterge'),
      danger: true,
    });
    if (!ok) return;
    await this.act(async () => {
      await this.api.delete(`/treatments/${x.id}`);
      this.router.navigate(['/tratamente']);
    });
  }

  private async act(fn: () => Promise<void>) {
    this.busy.set(true);
    this.actionError.set('');
    try {
      await fn();
    } catch (e) {
      this.actionError.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
