import { Injectable, inject, signal } from '@angular/core';
import { Api } from './api';

/*
 * Plata online prin Polar: dacă e pornită pe server și dacă acest cont poate plăti acum (proba, proba terminată,
 * abonamentul care expiră sau a expirat). „Plătește” cere serverului o sesiune de plată și duce omul la pagina Polar;
 * se întoarce la /plata/gata, unde așteptăm să vină activarea (webhook-ul).
 */
@Injectable({ providedIn: 'root' })
export class PlataService {
  private readonly api = inject(Api);
  readonly state = signal<{ online: boolean; canPay: boolean } | null>(null);

  async load() {
    try {
      this.state.set(await this.api.get<{ online: boolean; canPay: boolean }>('/plata'));
    } catch {
      this.state.set(null);
    }
  }

  /** Spre pagina de plată Polar (pleacă de pe site; se întoarce singur după plată). */
  async pay() {
    const r = await this.api.post<{ url: string }>('/plata/checkout');
    window.location.assign(r.url);
  }
}
