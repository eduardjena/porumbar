import { Component, computed, inject, output, signal } from '@angular/core';
import { Api, errorMessage } from '../../core/api';
import { AuthService } from '../../core/auth';
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
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Poza nu a putut fi pregătită.'))), 'image/jpeg', 0.88));
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
  imports: [Icon],
  template: `
    <section class="card reader">
      <div class="text">
        <h2>Ai pedigree-ul în poză sau în PDF?</h2>
        <p class="muted">Programul îl citește și completează căsuțele. Tu doar verifici și corectezi. Poza nu se păstrează.
          @if (!isAdmin()) { Credit pentru citiri: <strong>{{ credit() }}</strong>. }</p>
      </div>
      @if (noCredit()) {
        <p class="warning">Nu mai ai credit pentru citirea pozelor. Completează căsuțele de mână (inelele pe care le ai deja se completează singure) sau cere credit{{ contact() ? ': ' + contact() : ' de la cel de la care ai primit programul' }}.</p>
      } @else {
        <label class="btn primary pick" [class.busy]="busy()">
          <app-icon name="poze" />{{ busy() ? 'Se citește… (până la un minut)' : 'Citește din poză sau PDF' }}
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
  protected readonly credit = computed(() => `${(this.auth.account()?.aiCredit ?? 0).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`);
  protected readonly noCredit = computed(() => !this.isAdmin() && (this.auth.account()?.aiCredit ?? 0) <= 0);
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
      this.auth.refresh().catch(() => undefined); // creditul rămas
      const text = `Am completat ${r.filled} ${r.filled === 1 ? 'căsuță' : 'căsuțe'}. Verifică fiecare inel înainte să salvezi.${r.notes ? ' ' + r.notes : ''}`;
      this.message.set({ kind: r.notes ? 'warning' : 'notice', text });
    } catch (e) {
      this.message.set({ kind: 'error', text: errorMessage(e) });
    } finally {
      this.busy.set(false);
    }
  }
}
