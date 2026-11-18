import { Component, computed, inject, output, signal } from '@angular/core';
import { Api, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth';
import { t, TPipe } from '../../core/i18n';
import { Icon } from '../../shared/icon';

/** Un porumbel citit din poză (aceeași formă ca la import). */
export interface PedigreeNode {
  ring: string | null;
  name: string | null;
  color: string | null;
  text: string | null;
  breeder: string | null;
  sex?: 'M' | 'F';
  father: PedigreeNode | null;
  mother: PedigreeNode | null;
}

const MAX_SIDE = 2200; // destul pentru scrisul mărunt de pe pedigree, fără să trimitem 10 MB de pe telefon

/** Poza se micșorează în browser (JPEG); PDF-ul pleacă așa cum e. */
async function prepare(file: File): Promise<{ mime: string; data: string }> {
  if (file.type === 'application/pdf') return { mime: file.type, data: await toBase64(file) };
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error(t('cititor.poza_nepregatita')))), 'image/jpeg', 0.88));
  return { mime: 'image/jpeg', data: await toBase64(blob) };
}

function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/*
 * „Citește din poză sau PDF”: trimite fișierul la server (Claude îl citește), iar căsuțele goale se completează.
 * Nimic nu se salvează până nu apasă omul „Adaugă pedigree-ul”; poza nu se păstrează nicăieri.
 */
@Component({
  selector: 'app-cititor-poza',
  imports: [Icon, TPipe],
  template: `
    <section class="card reader">
      <div class="text">
        <h2>{{ 'cititor.titlu' | t }}</h2>
        <p class="muted">{{ 'cititor.intro' | t }}
          @if (!isAdmin() && reads(); as r) { {{ 'cititor.citiri' | t }} <strong>{{ 'cititor.citiri_din' | t: { folosite: r.used, total: r.allowed } }}</strong>. }</p>
      </div>
      @if (noReads()) {
        <p class="warning">{{ contact() ? ('cititor.fara_citiri_contact' | t: { numar: reads()!.allowed, contact: contact() }) : ('cititor.fara_citiri' | t: { numar: reads()!.allowed }) }}</p>
      } @else {
        <label class="btn primary pick" [class.busy]="busy()">
          <app-icon name="poze" />{{ (busy() ? 'cititor.se_citeste' : 'cititor.citeste') | t }}
          <input type="file" accept="image/*,application/pdf" (change)="pick($event)" [disabled]="busy()" />
        </label>
      }
      @if (message(); as m) { <div [class]="m.kind" role="status">{{ m.text }}</div> }
    </section>
  `,
  styles: `
    .reader { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px; margin: 12px 0; border-style: dashed; border-width: 2px; }
    .text { flex: 1 1 360px; }
    .text h2 { margin: 0 0 4px; }
    .text p { margin: 0; }
    .pick { position: relative; cursor: pointer; }
    .pick input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
    .pick.busy { opacity: 0.7; cursor: progress; }
    .reader > div[role='status'] { flex-basis: 100%; }
  `,
})
export class CititorPoza {
  private readonly api = inject(Api);
  private readonly auth = inject(AuthService);
  readonly read = output<PedigreeNode>();
  protected readonly isAdmin = computed(() => !!this.auth.account()?.isAdmin);
  protected readonly contact = computed(() => this.auth.account()?.sellerContact ?? null);
  /** Citirile din poze ale anului de abonament (incluse în abonament). */
  protected readonly reads = computed(() => this.auth.account()?.reads ?? null);
  protected readonly noReads = computed(() => !this.isAdmin() && !!this.reads() && this.reads()!.used >= this.reads()!.allowed);
  readonly busy = signal(false);
  readonly message = signal<{ kind: 'notice' | 'warning' | 'error'; text: string } | null>(null);

  async pick(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.busy.set(true);
    this.message.set(null);
    try {
      const body = await prepare(file);
      const r = await this.api.post<{ root: PedigreeNode; filled: number; notes: string }>('/pedigrees/read', body);
      this.read.emit(r.root);
      this.auth.refresh().catch(() => undefined); // contorul de citiri
      const text = `${t('cititor.completat', { count: r.filled })}${r.notes ? ' ' + r.notes : ''}`;
      this.message.set({ kind: r.notes ? 'warning' : 'notice', text });
    } catch (e) {
      this.message.set({ kind: 'error', text: errorMessage(e) });
    } finally {
      this.busy.set(false);
    }
  }
}
