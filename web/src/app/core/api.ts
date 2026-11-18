import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';
import { AuthService } from './auth';
import { currentLang, t } from './i18n';

/** Mesajul de eroare trimis de server (`{ error }`) sau unul pe înțelesul omului. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const msg = (err.error as { error?: string } | null)?.error;
    if (msg) return msg;
    return err.status === 0 ? t('eroare.fara_server') : t('eroare.cod', { cod: err.status });
  }
  return err instanceof Error ? err.message : t('eroare.oarecare');
}

@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  get<T>(path: string): Promise<T> {
    return firstValueFrom(this.http.get<T>(`/api${path}`));
  }

  // Corpul e mereu JSON: serverul refuză cererile care modifică date fără application/json.
  post<T>(path: string, body: object = {}): Promise<T> {
    return firstValueFrom(this.http.post<T>(`/api${path}`, body));
  }

  patch<T>(path: string, body: object): Promise<T> {
    return firstValueFrom(this.http.patch<T>(`/api${path}`, body));
  }

  put<T>(path: string, body: object): Promise<T> {
    return firstValueFrom(this.http.put<T>(`/api${path}`, body));
  }

  delete<T>(path: string, body: object = {}): Promise<T> {
    return firstValueFrom(this.http.delete<T>(`/api${path}`, { body }));
  }

}

/** La sesiune expirată, omul ajunge la pagina de intrare. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const auth = inject(AuthService);
  // Limba ecranului (serverul o folosește doar pentru limbile publice; cu cont contează limba contului).
  if (req.url.startsWith('/api/')) req = req.clone({ setHeaders: { 'Accept-Language': currentLang() } });
  return next(req).pipe(
    catchError((err: unknown) => {
      const authCall = req.url.startsWith('/api/auth/');
      if (err instanceof HttpErrorResponse && err.status === 401 && !authCall) {
        // Sesiunea a expirat (sau parola s-a schimbat pe alt dispozitiv): fără cont în memorie, altfel pagina de
        // intrare ne-ar trimite înapoi în porumbar și omul ar rămâne blocat pe eroare.
        auth.account.set(null);
        router.navigateByUrl('/intra');
      }
      return throwError(() => err);
    }),
  );
};
