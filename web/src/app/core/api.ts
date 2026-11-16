import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, firstValueFrom, throwError } from 'rxjs';

/** Mesajul de eroare trimis de server (`{ error }`) sau unul pe înțelesul omului. */
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const msg = (err.error as { error?: string } | null)?.error;
    if (msg) return msg;
    return err.status === 0 ? 'Nu s-a putut ajunge la server. Verifică internetul și încearcă din nou.' : `A apărut o eroare (${err.status}).`;
  }
  return err instanceof Error ? err.message : 'A apărut o eroare.';
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

  /** Trimite un fișier (poză) ca atare, cu tipul lui. */
  upload<T>(path: string, file: Blob): Promise<T> {
    return firstValueFrom(this.http.post<T>(`/api${path}`, file, { headers: { 'Content-Type': file.type || 'application/octet-stream' } }));
  }
}

/** La sesiune expirată, omul ajunge la pagina de intrare. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  return next(req).pipe(
    catchError((err: unknown) => {
      const authCall = req.url.startsWith('/api/auth/');
      if (err instanceof HttpErrorResponse && err.status === 401 && !authCall) router.navigateByUrl('/intra');
      return throwError(() => err);
    }),
  );
};
