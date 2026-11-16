import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Api } from './api';
import { Account } from './models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(Api);
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

  async login(email: string, password: string): Promise<void> {
    const r = await this.api.post<{ account: Account }>('/auth/login', { email, password });
    this.account.set(r.account);
  }

  async register(name: string, email: string, password: string): Promise<void> {
    const r = await this.api.post<{ account: Account }>('/auth/register', { name, email, password });
    this.account.set(r.account);
  }

  async resetPassword(token: string, password: string): Promise<void> {
    const r = await this.api.post<{ account: Account }>('/auth/reset', { token, password });
    this.account.set(r.account);
  }

  async update(data: Partial<Account>): Promise<void> {
    const r = await this.api.patch<{ account: Account }>('/auth/me', data);
    this.account.set(r.account);
  }

  async logout(): Promise<void> {
    await this.api.post('/auth/logout').catch(() => undefined);
    this.account.set(null);
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

/** Paginile de intrare: cine e deja în cont merge la porumbar. */
export const guestGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.load();
  return auth.account() ? router.parseUrl('/porumbar') : true;
};
