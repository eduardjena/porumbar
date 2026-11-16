import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding, withNavigationErrorHandler } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/api';
import { AuthService } from './core/auth';
import { CatalogService } from './core/catalog';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(
      routes,
      withComponentInputBinding(),
      // După o versiune nouă a aplicației, paginile vechi (fișiere cu alt nume) nu mai există: o tab deschisă dinainte
      // ar rămâne blocată. Reîncărcăm pagina spre adresa cerută, o singură dată.
      withNavigationErrorHandler((e) => {
        const msg = String((e.error as Error)?.message ?? e.error);
        if (!/dynamically imported module|Importing a module script failed|error loading dynamically/i.test(msg)) return;
        try {
          const [lastUrl, lastAt] = (sessionStorage.getItem('porumbar.reload') ?? '').split('|');
          if (lastUrl === e.url && Date.now() - Number(lastAt) < 60_000) return; // tocmai am încercat: nu intrăm în buclă
          sessionStorage.setItem('porumbar.reload', `${e.url}|${Date.now()}`);
        } catch {
          /* fără spațiu local: reîncărcăm oricum */
        }
        location.assign(e.url);
      }),
    ),
    provideAppInitializer(() => {
      // Catalogul nu blochează pornirea; dacă pică, paginile îl cer din nou.
      inject(CatalogService).load().catch(() => undefined);
      return inject(AuthService).load();
    }),
  ],
};
