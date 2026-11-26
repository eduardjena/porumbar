import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Api } from './api';
import { Account } from './models';
import { PushService } from './push';

/** Ciornele formularelor (porumbar.ciorna.*) nu trebuie să rămână pentru următorul cont de pe același telefon. */
export function clearDrafts() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith('porumbar.ciorna.')) localStorage.removeItem(key);
  } catch {
    /* fără acces la spațiul local */
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(Api);
  private readonly push = inject(PushService);
  readonly account = signal<Account | null>(null);
  private loaded: Promise<void> | null = null;

  /** Află o singură dată, la pornire, dacă omul e intrat în cont. */
  load(): Promise<void> {
    this.loaded ??= this.api
      .get<{ account: Account }>('/auth/me')
      .then((r) => this.account.set(r.account))
      .catch(() => this.account.set(null));
    return this.loaded;
  }

  /** Citește din nou contul (de ex. citirile rămase după o citire, abonamentul după activare). */
  async refresh(): Promise<void> {
    const r = await this.api.get<{ account: Account }>('/auth/me');
    this.account.set(r.account);
  }

  async login(email: string, password: string): Promise<void> {
    const r = await this.api.post<{ account: Account }>('/auth/login', { email, password });
    this.account.set(r.account);
    // Telefonul își păstrează amintirile: abonamentul bun trece la contul intrat acum, altul se scoate (fără să țină intrarea în loc).
    void this.push.keepOrDrop();
  }

  /**
   * Contul se face și omul e intrat (cookie de sesiune), dar cu emailul neconfirmat (doar citire până deschide linkul din
   * email). Răspunsul gol (capcana de roboți) nu intră în cont.
   */
  async register(data: { name: string; email: string; phone: string; city: string; password: string; lang: string; country: string; acceptTerms: boolean; website: string }): Promise<void> {
    const r = await this.api.post<{ account: Account | null }>('/auth/register', data);
    if (!r.account) return;
    this.account.set(r.account);
    void this.push.keepOrDrop();
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const r = await this.api.post<{ account: Account }>('/auth/reset', { token, password });
    this.account.set(r.account);
    void this.push.keepOrDrop();
  }

  async update(data: Partial<Account>): Promise<void> {
    const r = await this.api.patch<{ account: Account }>('/auth/me', data);
    // Răspunsul la PATCH nu are numărul de telefoane abonate: îl păstrăm pe cel știut.
    this.account.set({ ...r.account, pushDevices: r.account.pushDevices ?? this.account()?.pushDevices });
  }

  async logout(): Promise<void> {
    // Abonamentul de notificări al telefonului se șterge întâi (cât mai e sesiunea), dar nu ținem ieșirea în loc mai mult de 3 secunde.
    await Promise.race([this.push.unsubscribe(), new Promise<void>((done) => setTimeout(done, 3000))]).catch(() => undefined);
    await this.api.post('/auth/logout').catch(() => undefined);
    this.account.set(null);
    clearDrafts();
  }
}

const AFTER_LOGIN = 'porumbar.dupa-intrare';
/** Unde se întoarce omul după ce intră în cont / își face cont (de ex. pagina publică a unui pedigree). */
export function rememberAfterLogin(url: string) {
  try {
    sessionStorage.setItem(AFTER_LOGIN, url);
  } catch {
    /* fără memorie: ajunge la panou */
  }
}
export function afterLoginUrl(): string {
  try {
    const url = sessionStorage.getItem(AFTER_LOGIN);
    sessionStorage.removeItem(AFTER_LOGIN);
    // Doar adrese din program (fără „//alt-site”).
    return url && url.startsWith('/') && !url.startsWith('//') ? url : '/panou';
  } catch {
    return '/panou';
  }
}

/** Paginile porumbarului: doar cu cont. */
// inject() merge doar înainte de primul await, deci Router-ul se ia de la început.
export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.load();
  return auth.account() ? true : router.parseUrl('/intra');
};

/** Consola vânzătorului: doar adminul. */
export const adminGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.load();
  if (!auth.account()) return router.parseUrl('/intra');
  return auth.account()?.isAdmin ? true : router.parseUrl('/panou');
};

/** Pagina de start a vânzătorului e consola: „Panou” (și orice trimite acolo) îl duce la /vanzator. */
export const sellerHomeGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.load();
  return auth.account()?.isAdmin ? router.parseUrl('/vanzator') : true;
};

/** Paginile de intrare: cine e deja în cont merge la porumbar. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.load();
  return auth.account() ? router.parseUrl('/panou') : true;
};
