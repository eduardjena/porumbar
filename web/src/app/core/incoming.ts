import { Injectable, inject, signal } from '@angular/core';
import { Api } from './api';

/**
 * Câți porumbei au trimis alți crescători (vânzări) și așteaptă să fie primiți. Anunțul apare sus pe orice pagină,
 * nu doar pe Panou, ca omul să nu-l rateze. Se reîncarcă la schimbarea paginii, cel mult o dată la 30 de secunde.
 */
@Injectable({ providedIn: 'root' })
export class IncomingService {
  private readonly api = inject(Api);
  readonly count = signal(0);
  private last = 0;

  async refresh(force = false) {
    if (!force && Date.now() - this.last < 30_000) return;
    this.last = Date.now();
    try {
      this.count.set((await this.api.get<{ incoming: unknown[] }>('/transfers')).incoming.length);
    } catch {
      // fără rețea / fără cont: anunțul rămâne cum era
    }
  }

  /** Pagina Vânzări știe deja lista: nu mai cerem încă o dată. */
  set(n: number) {
    this.count.set(n);
    this.last = Date.now();
  }

  reset() {
    this.count.set(0);
    this.last = 0;
  }
}
